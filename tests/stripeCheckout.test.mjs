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
