// « Pas de règlement, pas de lecture » — vérifié de bout en bout.
//
// Ce fichier attaque le tunnel comme le ferait un client mal intentionné : sans
// session, avec une session non payée, avec une session payée pour autre chose,
// avec une session payée au mauvais prix. Dans tous ces cas, AUCUNE lecture ne
// doit être produite — et le seul cas où elle l'est, c'est un paiement vérifié
// côté serveur auprès de Stripe, au bon montant.
//
// Le vrai parcours payant est aussi exercé jusqu'au bout, avec un faux rédacteur :
// un client qui paie vraiment reçoit bien sa lecture.

import assert from "node:assert/strict";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";

const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "ASTROLAB_LLM_API_KEY", "ASTROLAB_LLM_BASE_URL", "ASTROLAB_ALLOW_FREE_READINGS", "ASTROLAB_TEST_CODE"];
const STRIPE_KEYS = {
  STRIPE_SECRET_KEY: "sk_test_abc123456789",
  STRIPE_PUBLISHABLE_KEY: "pk_test_abc123456789"
};
const PLACE = {
  selectedName: "Paris, France",
  country: "France",
  normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
};
const NAISSANCE = {
  firstName: "Test",
  birthDate: "1990-01-15",
  timePrecision: "exact",
  timeValue: "12:30",
  resolvedPlace: PLACE,
  language: "fr"
};

async function withEnv(values, run) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

async function startApp() {
  const { server, store } = createApp({ store: new JsonStore(null) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    store,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function post(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }).then(async (response) => ({ status: response.status, payload: await response.json().catch(() => null) }));
}

// Faux Stripe : seule la lecture d'une session est simulée. Les appels au
// rédacteur IA sont comptés séparément par les tests qui en ont besoin.
function withSession(session, run) {
  const original = globalThis.fetch;
  const appels = [];
  globalThis.fetch = async (url, init) => {
    const cible = String(url);
    if (cible.includes("api.stripe.com/v1/checkout/sessions/")) {
      appels.push(cible);
      return { ok: true, status: 200, json: async () => session };
    }
    return original(url, init);
  };
  return Promise.resolve(run(appels)).finally(() => {
    globalThis.fetch = original;
  });
}

const SESSION_PAYEE = (extra = {}) => ({
  id: "cs_test_paye",
  payment_status: "paid",
  amount_total: 2500,
  currency: "eur",
  metadata: { purpose: "lastro_lecture", pricing: "lastro-pricing@1.0.0" },
  customer_details: { email: "client@example.test" },
  ...extra
});

test("aucune session : le paiement est exigé, aucune lecture n'est produite", async () => {
  await withEnv({ ...STRIPE_KEYS, ASTROLAB_LLM_API_KEY: "cle-de-test" }, async () => {
    const app = await startApp();
    try {
      const reponse = await post(app.baseUrl, "/api/public/readings", NAISSANCE);
      assert.equal(reponse.status, 402);
      assert.match(reponse.payload.error, /paiement est requis/i);
      // Rien n'est enregistré, et surtout aucune rédaction n'a été lancée.
      const state = await app.store.load();
      assert.equal((state.publicReadings ?? []).length, 0);
    } finally {
      await app.close();
    }
  });
});

test("session non payée : refus, et aucune lecture", async () => {
  await withEnv({ ...STRIPE_KEYS, ASTROLAB_LLM_API_KEY: "cle-de-test" }, () =>
    withSession(SESSION_PAYEE({ payment_status: "unpaid" }), async () => {
      const app = await startApp();
      try {
        const reponse = await post(app.baseUrl, "/api/public/readings", { ...NAISSANCE, paymentSessionId: "cs_test_paye" });
        assert.equal(reponse.status, 402);
        assert.match(reponse.payload.error, /n'est pas encore confirmé/i);
        assert.equal((await app.store.load()).publicReadings.length, 0);
      } finally {
        await app.close();
      }
    })
  );
});

test("session payée pour un autre produit ou à un autre prix : refus", async () => {
  await withEnv({ ...STRIPE_KEYS, ASTROLAB_LLM_API_KEY: "cle-de-test" }, async () => {
    const app = await startApp();
    try {
      // Payée 1 € : ce n'est pas le prix de la lecture.
      await withSession(SESSION_PAYEE({ amount_total: 100 }), async () => {
        const cher = await post(app.baseUrl, "/api/public/readings", { ...NAISSANCE, paymentSessionId: "cs_test_paye" });
        assert.equal(cher.status, 402);
        assert.equal(cher.payload.code, "amount_mismatch");
        assert.match(cher.payload.error, /ne correspond pas à une lecture/i);
      });
      // Payée mais marquée pour autre chose.
      await withSession(SESSION_PAYEE({ metadata: { purpose: "autre_produit" } }), async () => {
        const autre = await post(app.baseUrl, "/api/public/readings", { ...NAISSANCE, paymentSessionId: "cs_test_paye" });
        assert.equal(autre.status, 402);
        assert.equal(autre.payload.code, "foreign_session");
      });
      // Devise étrangère.
      await withSession(SESSION_PAYEE({ currency: "usd" }), async () => {
        const devise = await post(app.baseUrl, "/api/public/readings", { ...NAISSANCE, paymentSessionId: "cs_test_paye" });
        assert.equal(devise.status, 402);
        assert.equal(devise.payload.code, "currency_mismatch");
      });
      // Dans les trois cas : aucune commande enregistrée, aucune lecture produite.
      assert.equal((await app.store.load()).publicReadings.length, 0);
    } finally {
      await app.close();
    }
  });
});

test("session au prix de l'offre de lancement : acceptée", async () => {
  // 15 € est un prix légitime : le client a utilisé le code de lancement.
  await withEnv({ ...STRIPE_KEYS }, () =>
    withSession(SESSION_PAYEE({ amount_total: 1500 }), async () => {
      const app = await startApp();
      try {
        const reponse = await post(app.baseUrl, "/api/public/readings", { ...NAISSANCE, paymentSessionId: "cs_test_paye" });
        // Pas de rédacteur ici : la commande est enregistrée (récupérable) mais
        // aucun brouillon n'est livré — c'est le seul statut possible après le
        // contrôle du paiement, ce qui prouve que la session a été acceptée.
        assert.equal(reponse.status, 503);
        assert.match(reponse.payload.error, /commande est enregistrée/i);
        const state = await app.store.load();
        assert.equal(state.publicReadings.length, 1);
        assert.equal(state.publicReadings[0].amountCents, 1500);
      } finally {
        await app.close();
      }
    })
  );
});

test("session payée avant la marque produit : acceptée, mais signalée", async () => {
  await withEnv({ ...STRIPE_KEYS }, () =>
    withSession(SESSION_PAYEE({ metadata: undefined }), async () => {
      const app = await startApp();
      try {
        const reponse = await post(app.baseUrl, "/api/public/readings", { ...NAISSANCE, paymentSessionId: "cs_test_paye" });
        // Refuser casserait la reprise d'un client déjà débité pendant le
        // déploiement : on accepte sur le montant.
        assert.equal(reponse.status, 503);
        assert.match(reponse.payload.error, /commande est enregistrée/i);
      } finally {
        await app.close();
      }
    })
  );
});

test("le paiement n'est pas ouvert quand la rédaction ne peut pas suivre", async () => {
  await withEnv(STRIPE_KEYS, async () => {
    const app = await startApp();
    try {
      const reponse = await post(app.baseUrl, "/api/public/checkout-session", { promoCode: "bessbousse10" });
      assert.equal(reponse.status, 503);
      assert.equal(reponse.payload.code, "writer_unavailable");
      assert.match(reponse.payload.error, /ne serez pas débité/i);
    } finally {
      await app.close();
    }
  });
});

test("le parcours payant complet produit bien la lecture", async () => {
  await withEnv(
    { ...STRIPE_KEYS, ASTROLAB_LLM_API_KEY: "cle-de-test", ASTROLAB_LLM_BASE_URL: "https://redacteur.test/v1" },
    () =>
      withSession(SESSION_PAYEE(), async () => {
        const app = await startApp();
        const fetchOriginal = globalThis.fetch;
        let sections = 0;
        globalThis.fetch = async (url, init) => {
          const cible = String(url);
          if (cible.startsWith("https://api.stripe.com")) {
            return { ok: true, status: 200, json: async () => SESSION_PAYEE() };
          }
          if (cible.startsWith("https://redacteur.test")) {
            sections += 1;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                choices: [{ message: { content: `Passage ${sections}. Cette dynamique se lit dans la manière de tenir le cap, avec patience et mesure, sans rien forcer.` } }],
                usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
              })
            };
          }
          return fetchOriginal(url, init);
        };
        try {
          const reponse = await post(app.baseUrl, "/api/public/readings", { ...NAISSANCE, paymentSessionId: "cs_test_paye" });
          assert.equal(reponse.status, 200, JSON.stringify(reponse.payload).slice(0, 400));
          assert.equal(reponse.payload.writerMode, "llm");
          assert.match(reponse.payload.html, /<html/i);
          assert.ok(reponse.payload.delivery?.link, "le client reçoit son lien");
          // Le rédacteur a bien été appelé : la lecture n'est pas un brouillon.
          assert.equal(sections > 5, true, `appels au rédacteur : ${sections}`);

          // Un paiement = une lecture : rappeler avec la même session relivre la
          // même lecture, sans régénérer et sans redemander de paiement.
          const avant = sections;
          const rejoue = await post(app.baseUrl, "/api/public/readings", { ...NAISSANCE, paymentSessionId: "cs_test_paye" });
          assert.equal(rejoue.status, 200);
          assert.equal(rejoue.payload.delivery.link, reponse.payload.delivery.link);
          assert.equal(sections, avant, "aucune régénération");
        } finally {
          globalThis.fetch = fetchOriginal;
          await app.close();
        }
      })
  );
});

test("en production, une configuration de paiement absente refuse les lectures", async () => {
  // Le pire scénario possible pour ce tunnel : plus de clés Stripe dans
  // l'environnement de production, et le site se met à offrir les lectures.
  const precedent = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await withEnv({}, async () => {
      const app = await startApp();
      try {
        const reponse = await post(app.baseUrl, "/api/public/readings", NAISSANCE);
        assert.equal(reponse.status, 503);
        assert.equal(reponse.payload.code, "payment_not_configured");
        assert.match(reponse.payload.error, /ne serez pas débité/i);
        assert.equal((await app.store.load()).publicReadings.length, 0);
      } finally {
        await app.close();
      }
    });

    // Le mode gratuit reste possible, mais il faut l'écrire.
    await withEnv({ ASTROLAB_ALLOW_FREE_READINGS: "1" }, async () => {
      const app = await startApp();
      try {
        const reponse = await post(app.baseUrl, "/api/public/readings", NAISSANCE);
        assert.equal(reponse.status, 200);
        assert.equal(reponse.payload.writerMode, "template");
      } finally {
        await app.close();
      }
    });
  } finally {
    if (precedent === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = precedent;
    }
  }
});

test("un code de test reste utilisable même en production sans paiement", async () => {
  const precedent = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await withEnv({ ASTROLAB_TEST_CODE: "code-exploitant-1234" }, async () => {
      const app = await startApp();
      try {
        const reponse = await post(app.baseUrl, "/api/public/readings", { ...NAISSANCE, testCode: "code-exploitant-1234" });
        assert.equal(reponse.status, 200);
        assert.equal(reponse.payload.freeAccess, true);
      } finally {
        await app.close();
      }
    });
  } finally {
    if (precedent === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = precedent;
    }
  }
});
