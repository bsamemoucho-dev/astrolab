import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { resetTestCodeFailures } from "../src/payments/freeAccess.mjs";

const CODE = "test-code-1234567890";
const KEYS = [
  "TEST_KEYS",
  "ASTROLAB_TEST_CODE",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "ASTROLAB_LLM_API_KEY"
];
// Un site qui encaisse doit pouvoir rédiger : ces scénarios de paiement ne sont
// atteignables qu'avec un rédacteur configuré (sinon le service refuse AVANT tout
// débit, voir le test suivant).
const STRIPE_ON_WITH_WRITER = {
  STRIPE_SECRET_KEY: "sk_live_abc123456789",
  STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789",
  ASTROLAB_LLM_API_KEY: "cle-de-test"
};

async function startApp() {
  const { server, store } = createApp({ store: new JsonStore(null) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    store,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function withEnv(values, run) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  resetTestCodeFailures();
  try {
    // `await` est indispensable : sinon la configuration serait restaurée avant
    // que le corps asynchrone du test n'ait lu les variables d'environnement.
    return await run();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    resetTestCodeFailures();
  }
}

async function post(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, payload: await response.json() };
}

const STRIPE_ON = {
  STRIPE_SECRET_KEY: "sk_live_abc123456789",
  STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789"
};

test("sans code configuré, /api/config l'annonce et aucun code n'est accepté", async () => {
  await withEnv({}, async () => {
    const app = await startApp();
    try {
      const config = await fetch(`${app.baseUrl}/api/config`).then((r) => r.json());
      assert.equal(config.testCodeEnabled, false);
      const refused = await post(app.baseUrl, "/api/public/readings", { testCode: CODE });
      assert.equal(refused.status, 400);
      assert.match(refused.payload.error, /aucun code de test/i);
    } finally {
      await app.close();
    }
  });
});

test("un code trop court est refusé à la configuration", async () => {
  await withEnv({ ASTROLAB_TEST_CODE: "court" }, async () => {
    const app = await startApp();
    try {
      const config = await fetch(`${app.baseUrl}/api/config`).then((r) => r.json());
      assert.equal(config.testCodeEnabled, false);
      const refused = await post(app.baseUrl, "/api/public/readings", { testCode: "court" });
      assert.equal(refused.status, 400);
    } finally {
      await app.close();
    }
  });
});

test("le code de test remplace le paiement obligatoire", async () => {
  await withEnv({ ...STRIPE_ON_WITH_WRITER, ASTROLAB_TEST_CODE: CODE }, async () => {
    const app = await startApp();
    try {
      const config = await fetch(`${app.baseUrl}/api/config`).then((r) => r.json());
      assert.equal(config.testCodeEnabled, true);
      assert.equal(config.payments.configured, true);

      // Sans code : le paiement est exigé.
      const withoutCode = await post(app.baseUrl, "/api/public/readings", { firstName: "Test" });
      assert.equal(withoutCode.status, 402);
      assert.match(withoutCode.payload.error, /paiement est requis/i);

      // Avec le bon code : on passe le garde-fou de paiement et on arrive à la
      // validation des données (400 sur la date manquante) — donc plus de 402.
      const withCode = await post(app.baseUrl, "/api/public/readings", { testCode: CODE, firstName: "Test" });
      assert.equal(withCode.status, 400);
      assert.match(withCode.payload.error, /date de naissance/i);
    } finally {
      await app.close();
    }
  });
});

test("un mauvais code est refusé sans révéler le bon", async () => {
  await withEnv({ ...STRIPE_ON, ASTROLAB_TEST_CODE: CODE }, async () => {
    const app = await startApp();
    try {
      const refused = await post(app.baseUrl, "/api/public/readings", {
        testCode: "mauvais-code-123456",
        firstName: "Test"
      });
      assert.equal(refused.status, 403);
      assert.match(refused.payload.error, /invalide/i);
      assert.doesNotMatch(JSON.stringify(refused.payload), new RegExp(CODE));
    } finally {
      await app.close();
    }
  });
});

test("le code de test fonctionne même si les clés Stripe sont inutilisables", async () => {
  await withEnv(
    { STRIPE_SECRET_KEY: "pas-une-cle", STRIPE_PUBLISHABLE_KEY: "pas-une-cle-non-plus", ASTROLAB_TEST_CODE: CODE },
    async () => {
      const app = await startApp();
      try {
        // Les clés invalides bloquent normalement la lecture (503)…
        const blocked = await post(app.baseUrl, "/api/public/readings", { firstName: "Test" });
        assert.equal(blocked.status, 503);
        // …mais le code de test permet de continuer à travailler.
        const withCode = await post(app.baseUrl, "/api/public/readings", { testCode: CODE, firstName: "Test" });
        assert.equal(withCode.status, 400);
        assert.match(withCode.payload.error, /date de naissance/i);
      } finally {
        await app.close();
      }
    }
  );
});

test("les tentatives répétées de code invalide sont limitées", async () => {
  await withEnv({ ASTROLAB_TEST_CODE: CODE }, async () => {
    const app = await startApp();
    try {
      let last = null;
      for (let attempt = 0; attempt < 21; attempt += 1) {
        last = await post(app.baseUrl, "/api/public/readings", { testCode: `mauvais-${attempt}-123456`, firstName: "Test" });
      }
      assert.equal(last.status, 429);
      assert.match(last.payload.error, /trop de codes/i);

      // Le bon code reste accepté (la limite ne porte que sur les échecs).
      const good = await post(app.baseUrl, "/api/public/readings", { testCode: CODE, firstName: "Test" });
      assert.equal(good.status, 400);
    } finally {
      await app.close();
    }
  });
});
