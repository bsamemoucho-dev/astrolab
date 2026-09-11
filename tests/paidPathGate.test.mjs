// Le tunnel payant exige un rédacteur.
//
// Motif : avec le paiement actif et sans clé de rédacteur IA, un client payait
// pour recevoir un document portant « Ce document n'est pas prêt pour la
// livraison ». Deux protections sont mesurées ici :
//   1. avant tout débit, le service refuse (503) — le client ne paie pas ;
//   2. si le paiement a déjà eu lieu (session fournie), la commande est
//      enregistrée pour rester récupérable, la rédaction échoue, et aucun
//      brouillon n'est livré.
//
// Le refus ne s'applique QUE là où l'argent circule : sans paiement configuré
// (développement, démonstration), le parcours public continue de produire un
// brouillon technique étiqueté comme tel.

import assert from "node:assert/strict";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";

const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "ASTROLAB_LLM_API_KEY"];
const STRIPE_KEYS = {
  STRIPE_SECRET_KEY: "sk_live_abc123456789",
  STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789"
};
const PLACE = {
  selectedName: "Paris, France",
  country: "France",
  normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
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

test("paiement actif sans rédacteur : la commande est refusée avant tout débit", async () => {
  await withEnv(STRIPE_KEYS, async () => {
    const app = await startApp();
    try {
      const config = await fetch(`${app.baseUrl}/api/config`).then((r) => r.json());
      assert.equal(config.payments.configured, true);
      assert.equal(config.llmConfigured, false);

      const refus = await post(app.baseUrl, "/api/public/readings", {
        firstName: "Test",
        birthDate: "1990-01-15",
        timePrecision: "exact",
        timeValue: "12:30",
        resolvedPlace: PLACE
      });
      assert.equal(refus.status, 503);
      assert.match(refus.payload.error, /rédaction est momentanément indisponible/i);
      assert.match(refus.payload.error, /ne serez pas débité/i);

      // Rien n'a été enregistré : aucune commande fantôme à récupérer.
      const state = await app.store.load();
      assert.equal((state.publicReadings ?? []).length, 0);
    } finally {
      await app.close();
    }
  });
});

test("paiement actif sans rédacteur, client déjà débité : commande conservée, aucun brouillon livré", async () => {
  await withEnv(STRIPE_KEYS, async () => {
    const app = await startApp();
    const fetchOriginal = globalThis.fetch;
    // Stripe confirme le paiement : c'est le seul appel réseau attendu ici.
    globalThis.fetch = async (url, init) => {
      if (String(url).includes("api.stripe.com/v1/checkout/sessions/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "cs_test_paye",
            payment_status: "paid",
            amount_total: 2000,
            currency: "eur",
            customer_details: { email: "client@example.com" }
          })
        };
      }
      return fetchOriginal(url, init);
    };
    try {
      const reponse = await post(app.baseUrl, "/api/public/readings", {
        firstName: "Test",
        birthDate: "1990-01-15",
        timePrecision: "exact",
        timeValue: "12:30",
        resolvedPlace: PLACE,
        paymentSessionId: "cs_test_paye"
      });
      assert.equal(reponse.status, 503);
      assert.match(reponse.payload.error, /commande est enregistrée/i);

      const state = await app.store.load();
      assert.equal(state.publicReadings.length, 1);
      const delivery = state.publicReadings[0];
      // La commande reste récupérable : c'est ce qui évite de faire payer deux fois.
      assert.equal(delivery.status, "failed");
      assert.match(delivery.reference, /^L-\d{4}-/);
      assert.match(delivery.token, /^[A-HJ-NP-Z2-9]{32}$/);
      // Et aucun brouillon technique n'a été livré à quelqu'un qui a payé.
      assert.equal(delivery.reading, null);
    } finally {
      globalThis.fetch = fetchOriginal;
      await app.close();
    }
  });
});

test("paiement actif avec rédacteur : le paiement reste exigé normalement", async () => {
  await withEnv({ ...STRIPE_KEYS, ASTROLAB_LLM_API_KEY: "cle-de-test" }, async () => {
    const app = await startApp();
    try {
      const config = await fetch(`${app.baseUrl}/api/config`).then((r) => r.json());
      assert.equal(config.llmConfigured, true);

      const sansPaiement = await post(app.baseUrl, "/api/public/readings", {
        firstName: "Test",
        birthDate: "1990-01-15",
        timePrecision: "exact",
        timeValue: "12:30",
        resolvedPlace: PLACE
      });
      assert.equal(sansPaiement.status, 402);
      assert.match(sansPaiement.payload.error, /paiement est requis/i);
    } finally {
      await app.close();
    }
  });
});

test("sans paiement configuré, le parcours public reste utilisable en brouillon", async () => {
  // Développement, démonstration, auto-hébergement sans encaissement : le refus
  // ne doit pas s'appliquer là où personne ne paie.
  await withEnv({}, async () => {
    const app = await startApp();
    try {
      const config = await fetch(`${app.baseUrl}/api/config`).then((r) => r.json());
      assert.equal(config.payments.configured, false);

      const reponse = await post(app.baseUrl, "/api/public/readings", {
        firstName: "Test",
        birthDate: "1990-01-15",
        timePrecision: "exact",
        timeValue: "12:30",
        resolvedPlace: PLACE
      });
      assert.equal(reponse.status, 200);
      assert.equal(reponse.payload.writerMode, "template");
      assert.match(reponse.payload.html, /brouillon/i);
    } finally {
      await app.close();
    }
  });
});
