import assert from "node:assert/strict";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { detectStaleSendingEmails, emailConfiguration, emailEnabled, flushQueuedEmails, OUTBOX_RETRY_DELAY_MS, sendEmail } from "../src/notifications/mailer.mjs";
import { createPaidDelivery, queueAdminAlert, queueDeliveryEmail, deliveryLink } from "../src/models/publicDeliveryService.mjs";

const KEYS = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME", "BREVO_REPLY_TO", "ADMIN_ALERT_EMAIL"];

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
    {
      BREVO_API_KEY: "xkeysib-test",
      BREVO_SENDER_EMAIL: "contact@lastro.fr",
      BREVO_SENDER_NAME: "Lastro",
      BREVO_REPLY_TO: "support@lastro.fr"
    },
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
          assert.equal(calls[0].body.replyTo.email, "support@lastro.fr");
          assert.equal(calls[0].body.to[0].email, "client@example.com");
          assert.match(calls[0].body.textContent, /lastro\.fr\/r\//);
          assert.equal(result.providerMessageId, "1");
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
  assert.equal(sent.status, "sent");
  assert.ok(sent.sentAt);
  assert.equal(sent.providerMessageId, null);
  assert.equal(failed.status, "pending");
  assert.equal(failed.sentAt, undefined);
  assert.match(failed.error, /refusée/);
  assert.equal(failed.attempts, 1);
});

test("deux flush concurrents réservent le même e-mail une seule fois", async () => {
  const store = new JsonStore(null);
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_concurrent", email: "client@example.com" });
  await queueDeliveryEmail(store, delivery, { link: deliveryLink(delivery.token, "https://lastro.fr") });

  await withEnv({ BREVO_API_KEY: "xkeysib-test", BREVO_SENDER_EMAIL: "contact@lastro.fr" }, async () => {
    let sends = 0;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const send = async () => {
      sends += 1;
      await gate;
      return { delivered: true, providerMessageId: "brevo-once" };
    };
    const first = flushQueuedEmails(store, { send });
    const second = flushQueuedEmails(store, { send });
    await new Promise((resolve) => setTimeout(resolve, 10));
    release();
    const results = await Promise.all([first, second]);
    assert.equal(results.reduce((total, result) => total + result.sent, 0), 1);
    assert.equal(sends, 1);
  });

  const state = await store.load();
  assert.equal(state.outbox[0].status, "sent");
  assert.equal(state.outbox[0].attempts, 1);
  assert.equal(state.outbox[0].providerMessageId, "brevo-once");
});

test("un échec est réellement retenté après le délai, puis envoyé", async () => {
  const store = new JsonStore(null);
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_retry", email: "client@example.com" });
  await queueDeliveryEmail(store, delivery, { link: deliveryLink(delivery.token, "https://lastro.fr") });

  await withEnv({ BREVO_API_KEY: "xkeysib-test", BREVO_SENDER_EMAIL: "contact@lastro.fr" }, async () => {
    let calls = 0;
    const first = await flushQueuedEmails(store, {
      send: async () => {
        calls += 1;
        throw new Error("temporaire");
      }
    });
    assert.equal(first.failed, 1);
    assert.equal(calls, 1);

    // Le retry n'est pas immédiat.
    const blocked = await flushQueuedEmails(store, {
      send: async () => {
        calls += 1;
        return { delivered: true };
      }
    });
    assert.equal(blocked.sent, 0);
    assert.equal(calls, 1);

    await store.transact((state) => {
      state.outbox[0].nextAttemptAt = new Date(Date.now() - OUTBOX_RETRY_DELAY_MS).toISOString();
    });
    const retry = await flushQueuedEmails(store, {
      send: async () => {
        calls += 1;
        return { delivered: true, providerMessageId: "retry-ok" };
      }
    });
    assert.equal(retry.sent, 1);
    assert.equal(calls, 2);
  });

  const state = await store.load();
  assert.equal(state.outbox[0].status, "sent");
  assert.equal(state.outbox[0].attempts, 2);
  assert.equal(state.outbox[0].providerMessageId, "retry-ok");
});

test("la file borne les retries à trois tentatives", async () => {
  const store = new JsonStore(null);
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_max_retry", email: "client@example.com" });
  await queueDeliveryEmail(store, delivery, { link: deliveryLink(delivery.token, "https://lastro.fr") });

  await withEnv({ BREVO_API_KEY: "xkeysib-test", BREVO_SENDER_EMAIL: "contact@lastro.fr" }, async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await store.transact((state) => {
        if (state.outbox[0].nextAttemptAt) {
          state.outbox[0].nextAttemptAt = new Date(Date.now() - OUTBOX_RETRY_DELAY_MS).toISOString();
        }
      });
      await flushQueuedEmails(store, {
        send: async () => {
          throw new Error(`refus ${attempt + 1}`);
        }
      });
    }
    const ignored = await flushQueuedEmails(store, {
      send: async () => ({ delivered: true })
    });
    assert.equal(ignored.sent, 0);
  });

  const state = await store.load();
  assert.equal(state.outbox[0].status, "failed");
  assert.equal(state.outbox[0].attempts, 3);
  assert.equal(state.outbox[0].nextAttemptAt, null);
});

test("un e-mail bloqué en sending devient une revue manuelle sans renvoi automatique", async () => {
  const store = new JsonStore(null);
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_stale", email: "client@example.com" });
  await queueDeliveryEmail(store, delivery, { link: deliveryLink(delivery.token, "https://lastro.fr") });
  await store.transact((state) => {
    state.outbox[0].status = "sending";
    state.outbox[0].attempts = 1;
    state.outbox[0].sendingStartedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    state.outbox[0].providerMessageId = "maybe-sent";
  });

  const stale = await detectStaleSendingEmails(store, { staleMs: 10 * 60 * 1000 });
  assert.equal(stale.length, 1);

  let sends = 0;
  await withEnv({ BREVO_API_KEY: "xkeysib-test", BREVO_SENDER_EMAIL: "contact@lastro.fr" }, async () => {
    await flushQueuedEmails(store, {
      send: async () => {
        sends += 1;
        return { delivered: true };
      }
    });
  });

  const state = await store.load();
  assert.equal(sends, 0);
  assert.equal(state.outbox[0].status, "failed");
  assert.equal(state.outbox[0].manualReviewRequired, true);
  assert.equal(state.outbox[0].failureKind, "sending_stale");
  assert.equal(state.outbox[0].providerMessageId, "maybe-sent");
});

test("un échec définitif d'alerte admin produit un log explicite", async () => {
  const store = new JsonStore(null);
  await withEnv(
    {
      BREVO_API_KEY: "xkeysib-test",
      BREVO_SENDER_EMAIL: "contact@lastro.fr",
      ADMIN_ALERT_EMAIL: "admin@example.com"
    },
    async () => {
      await queueAdminAlert(store, {
        delivery: { id: "reading_alert", reference: "L-2026-ALERTE-TEST", email: "client@example.com" },
        failureType: "email_public_reading_link_failed",
        status: "failed",
        attempts: 3,
        error: "test"
      });
      assert.match((await store.load()).outbox[0].body, /dossier disponible/);
      assert.match((await store.load()).outbox[0].body, /renvoyer manuellement/);
      const originalError = console.error;
      const logs = [];
      console.error = (...items) => {
        logs.push(items.join(" "));
      };
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await store.transact((state) => {
            if (state.outbox[0].nextAttemptAt) {
              state.outbox[0].nextAttemptAt = new Date(Date.now() - OUTBOX_RETRY_DELAY_MS).toISOString();
            }
          });
          await flushQueuedEmails(store, {
            types: ["admin_alert"],
            send: async () => {
              throw new Error("Brevo admin KO");
            }
          });
        }
      } finally {
        console.error = originalError;
      }
      const state = await store.load();
      assert.equal(state.outbox[0].status, "failed");
      assert.equal(state.outbox[0].attempts, 3);
      assert.equal(logs.some((line) => line.includes("[ADMIN_ALERT_FAILED]") && line.includes("Brevo admin KO")), true);
    }
  );
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
