import assert from "node:assert/strict";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { emailConfiguration, emailEnabled, flushQueuedEmails, sendEmail } from "../src/notifications/mailer.mjs";
import { createPaidDelivery, queueDeliveryEmail, deliveryLink } from "../src/models/publicDeliveryService.mjs";

const KEYS = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"];

async function withEnv(values, run) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  try {
    // `await` indispensable : sinon la configuration serait restaurée avant que
    // le corps asynchrone du test ne l'ait lue.
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

function withFakeBrevo(handler, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), headers: options.headers, body: options.body ? JSON.parse(options.body) : null });
    const answer = await handler(calls.length, calls.at(-1));
    return {
      ok: answer.ok !== false,
      status: answer.status ?? (answer.ok === false ? 400 : 201),
      json: async () => answer.payload ?? {}
    };
  };
  return Promise.resolve(run(calls)).finally(() => {
    globalThis.fetch = original;
  });
}

test("sans clé Brevo, l'envoi est désactivé et rien ne part", async () => {
  await withEnv({}, async () => {
    assert.equal(emailEnabled(), false);
    assert.equal(emailConfiguration(), null);
    await assert.rejects(() => sendEmail({ to: "client@example.com", subject: "x", text: "y" }), /pas configuré/);
  });
});

test("une clé sans adresse d'expédition ne suffit pas", async () => {
  await withEnv({ BREVO_API_KEY: "xkeysib-test" }, async () => {
    assert.equal(emailEnabled(), false);
  });
});

test("l'envoi utilise l'API Brevo avec la bonne clé et le bon destinataire", async () => {
  await withEnv(
    { BREVO_API_KEY: "xkeysib-test", BREVO_SENDER_EMAIL: "contact@lastro.fr", BREVO_SENDER_NAME: "Lastro" },
    () =>
      withFakeBrevo(
        () => ({ ok: true, payload: { messageId: "1" } }),
        async (calls) => {
          const result = await sendEmail({ to: "client@example.com", subject: "Votre lecture", text: "Lien : https://lastro.fr/r/ABC" });
          assert.equal(result.delivered, true);
          assert.equal(calls.length, 1);
          assert.equal(calls[0].url, "https://api.brevo.com/v3/smtp/email");
          assert.equal(calls[0].headers["api-key"], "xkeysib-test");
          assert.equal(calls[0].body.sender.email, "contact@lastro.fr");
          assert.equal(calls[0].body.to[0].email, "client@example.com");
          assert.match(calls[0].body.textContent, /lastro\.fr\/r\//);
        }
      )
  );
});

test("un refus du service d'e-mail remonte un message clair", async () => {
  await withEnv({ BREVO_API_KEY: "xkeysib-test", BREVO_SENDER_EMAIL: "contact@lastro.fr" }, () =>
    withFakeBrevo(
      () => ({ ok: false, status: 401, payload: { message: "Key not found" } }),
      async () => {
        await assert.rejects(
          () => sendEmail({ to: "client@example.com", subject: "x", text: "y" }),
          (error) => {
            assert.equal(error.status, 502);
            assert.match(error.message, /Key not found/);
            assert.match(error.publicMessage, /lien/i);
            return true;
          }
        );
      }
    )
  );
});

test("la file d'envoi marque les messages envoyés et conserve les échecs", async () => {
  const store = new JsonStore(null);
  const ok = await createPaidDelivery(store, { paymentSessionId: "cs_ok", email: "bon@example.com" });
  const ko = await createPaidDelivery(store, { paymentSessionId: "cs_ko", email: "mauvais@example.com" });
  await queueDeliveryEmail(store, ok.delivery, { link: deliveryLink(ok.delivery.token, "https://lastro.fr") });
  await queueDeliveryEmail(store, ko.delivery, { link: deliveryLink(ko.delivery.token, "https://lastro.fr") });

  await withEnv({ BREVO_API_KEY: "xkeysib-test", BREVO_SENDER_EMAIL: "contact@lastro.fr" }, async () => {
    const result = await flushQueuedEmails(store, {
      send: async ({ to }) => {
        if (to === "mauvais@example.com") {
          throw new Error("adresse refusée");
        }
        return { delivered: true };
      }
    });
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 1);
  });

  const state = await store.load();
  const sent = state.outbox.find((mail) => mail.to === "bon@example.com");
  const failed = state.outbox.find((mail) => mail.to === "mauvais@example.com");
  assert.ok(sent.sentAt);
  assert.equal(failed.sentAt, undefined);
  assert.match(failed.error, /refusée/);
  assert.equal(failed.attempts, 1);
});

test("sans configuration, la file d'envoi est laissée intacte", async () => {
  const store = new JsonStore(null);
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_skip", email: "client@example.com" });
  await queueDeliveryEmail(store, delivery, { link: deliveryLink(delivery.token, "https://lastro.fr") });

  await withEnv({}, async () => {
    const result = await flushQueuedEmails(store);
    assert.equal(result.skipped, true);
    assert.equal(result.sent, 0);
  });

  const state = await store.load();
  assert.equal(state.outbox.at(-1).sentAt, undefined);
  assert.ok(state.outbox.at(-1).link);
});
