import test from "node:test";
import assert from "node:assert/strict";

import { createEmbeddedCheckoutSession } from "../src/payments/stripe.mjs";

const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_CURRENCY"];

function withKeys(values, run) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  try {
    return run();
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

// Remplace fetch par un faux Stripe et capture les corps envoyés.
function withFakeStripe(reply, run) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? Object.fromEntries(new URLSearchParams(options.body)) : {};
    calls.push({ url: String(url), body });
    const answer = reply(calls.length, body);
    return {
      ok: answer.ok !== false,
      status: answer.status ?? (answer.ok === false ? 400 : 200),
      json: async () => answer.payload
    };
  };
  return Promise.resolve(run(calls)).finally(() => {
    globalThis.fetch = original;
  });
}

test("la session de paiement utilise les paramètres attendus par l'API Stripe actuelle", async () => {
  await withKeys(
    { STRIPE_SECRET_KEY: "sk_live_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789" },
    () =>
      withFakeStripe(
        () => ({
          ok: true,
          payload: { id: "cs_live_1", client_secret: "cs_live_1_secret", amount_total: 1000, currency: "eur" }
        }),
        async (calls) => {
          const session = await createEmbeddedCheckoutSession({ amountCents: 1000 });
          const sent = calls[0].body;
          assert.equal(calls.length, 1);
          assert.equal(sent.ui_mode, "embedded_page");
          assert.equal(sent.mode, "payment");
          assert.equal(sent.redirect_on_completion, "never");
          assert.equal(sent.billing_address_collection, "auto");
          assert.equal(sent["phone_number_collection[enabled]"], "false");
          assert.equal(sent["automatic_tax[enabled]"], "false");
          assert.equal(sent.allow_promotion_codes, "false");
          assert.equal(sent.submit_type, "auto");
          assert.equal(sent.integration_identifier, "hosted_web_0001");
          assert.equal(sent.origin_context, "web");
          // Réservé au mode abonnement : ne doit pas être envoyé ici.
          assert.equal("payment_method_collection" in sent, false);
          assert.equal(sent["line_items[0][price_data][unit_amount]"], "1000");
          assert.equal(sent["line_items[0][price_data][currency]"], "eur");
          // Paramètre supprimé de l'API Stripe : ne doit plus être envoyé.
          assert.equal("automatic_payment_methods" in sent, false);
          assert.equal("automatic_payment_methods[enabled]" in sent, false);
          assert.equal(session.sessionId, "cs_live_1");
          assert.equal(session.clientSecret, "cs_live_1_secret");
        }
      )
  );
});

test("le montant est encadré par l'offre : 5 € minimum, 50 € maximum", async () => {
  await withKeys(
    { STRIPE_SECRET_KEY: "sk_live_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789" },
    () =>
      withFakeStripe(
        () => ({ ok: true, payload: { id: "cs_live_3", client_secret: "cs_live_3_secret", amount_total: 5000, currency: "eur" } }),
        async (calls) => {
          // Tous les appels sont lancés avant le moindre await : la configuration
          // d'environnement n'est disponible que pendant la phase synchrone.
          const tooLow = createEmbeddedCheckoutSession({ amountCents: 400 });
          const tooHigh = createEmbeddedCheckoutSession({ amountCents: 5001 });
          const minimum = createEmbeddedCheckoutSession({ amountCents: 500 });
          const maximum = createEmbeddedCheckoutSession({ amountCents: 5000 });

          await assert.rejects(tooLow, /entre 5 € et 50 €/);
          await assert.rejects(tooHigh, /entre 5 € et 50 €/);
          await Promise.all([minimum, maximum]);
          // Les deux refus n'ont pas appelé Stripe, les deux acceptations oui.
          assert.equal(calls.length, 2);
          assert.equal(calls[0].body["line_items[0][price_data][unit_amount]"], "500");
          assert.equal(calls[1].body["line_items[0][price_data][unit_amount]"], "5000");
        }
      )
  );
});

test("un compte épinglé à une ancienne version d'API retombe sur ui_mode embedded", async () => {
  await withKeys(
    { STRIPE_SECRET_KEY: "sk_live_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789" },
    () =>
      withFakeStripe(
        (attempt) =>
          attempt === 1
            ? { ok: false, status: 400, payload: { error: { message: "Invalid value for ui_mode: embedded_page" } } }
            : { ok: true, payload: { id: "cs_live_2", client_secret: "cs_live_2_secret", amount_total: 1000, currency: "eur" } },
        async (calls) => {
          const session = await createEmbeddedCheckoutSession({ amountCents: 1000 });
          assert.equal(calls.length, 2);
          assert.equal(calls[0].body.ui_mode, "embedded_page");
          assert.equal(calls[1].body.ui_mode, "embedded");
          assert.equal(session.sessionId, "cs_live_2");
        }
      )
  );
});

test("une erreur de clé n'est jamais masquée par un nouvel essai", async () => {
  await withKeys(
    { STRIPE_SECRET_KEY: "sk_live_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789" },
    () =>
      withFakeStripe(
        () => ({ ok: false, status: 401, payload: { error: { message: "Invalid API Key provided: sk_live_***789" } } }),
        async (calls) => {
          await assert.rejects(() => createEmbeddedCheckoutSession({ amountCents: 1000 }), /Invalid API Key/);
          assert.equal(calls.length, 1);
        }
      )
  );
});
