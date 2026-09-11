import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";

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

async function request(baseUrl, path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

// Une date de naissance manquante fait échouer la rédaction AVANT tout appel au
// fournisseur de texte : on teste ainsi l'enregistrement de la commande sans
// consommer de génération.
const INVALID_INPUT = { firstName: "Test" };

test("une commande est enregistrée avant la rédaction, même si celle-ci échoue", async () => {
  const app = await startApp();
  try {
    const failed = await request(app.baseUrl, "/api/public/readings", { method: "POST", body: INVALID_INPUT });
    assert.equal(failed.status, 400);
    assert.match(failed.payload.error, /date de naissance/i);

    const state = await app.store.load();
    assert.equal(state.publicReadings.length, 1);
    const delivery = state.publicReadings[0];
    assert.equal(delivery.status, "failed");
    assert.match(delivery.reference, /^L-\d{4}-/);
    assert.match(delivery.token, /^[A-HJ-NP-Z2-9]{32}$/);
    assert.equal(delivery.reading, null);
    assert.equal(delivery.input.firstName, "Test");
    // Rien de sensible n'est conservé avec la commande.
    assert.equal("paymentSessionId" in delivery.input, false);
    assert.equal("testCode" in delivery.input, false);

    // Le lien permet de retrouver la commande et de comprendre ce qui s'est passé.
    const view = await request(app.baseUrl, `/api/public/deliveries/${delivery.token}`);
    assert.equal(view.status, 200);
    assert.equal(view.payload.delivery.status, "failed");
    assert.equal(view.payload.delivery.reference, delivery.reference);
    assert.equal(view.payload.delivery.reading, null);
    assert.equal("token" in view.payload.delivery, false);
  } finally {
    await app.close();
  }
});

test("un jeton inconnu ne donne accès à rien", async () => {
  const app = await startApp();
  try {
    const unknown = await request(app.baseUrl, "/api/public/deliveries/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    assert.equal(unknown.status, 404);
    assert.match(unknown.payload.error, /inconnu|expiré/i);
  } finally {
    await app.close();
  }
});

test("le client peut supprimer sa lecture, et n'y a plus accès ensuite", async () => {
  const app = await startApp();
  try {
    await request(app.baseUrl, "/api/public/readings", { method: "POST", body: INVALID_INPUT });
    const state = await app.store.load();
    const { token } = state.publicReadings[0];

    const removed = await request(app.baseUrl, `/api/public/deliveries/${token}`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.equal(removed.payload.deleted, true);

    const after = await request(app.baseUrl, `/api/public/deliveries/${token}`);
    assert.equal(after.status, 404);
    assert.equal((await app.store.load()).publicReadings.length, 0);
  } finally {
    await app.close();
  }
});

test("une reprise de rédaction ne redemande jamais de paiement", async () => {
  const app = await startApp();
  try {
    await request(app.baseUrl, "/api/public/readings", { method: "POST", body: INVALID_INPUT });
    const { token } = (await app.store.load()).publicReadings[0];

    // La reprise échoue à nouveau (données toujours incomplètes) mais elle passe
    // par la rédaction, sans repasser par la caisse.
    const retry = await request(app.baseUrl, `/api/public/deliveries/${token}/regenerate`, { method: "POST" });
    assert.equal(retry.status, 400);
    assert.match(retry.payload.error, /date de naissance/i);

    const state = await app.store.load();
    assert.equal(state.publicReadings.length, 1);
    assert.equal(state.publicReadings[0].status, "failed");
    assert.equal(state.publicReadings[0].token, token);
  } finally {
    await app.close();
  }
});

test("un lien perdu est renvoyé par e-mail, sans rien révéler à un curieux", async () => {
  const app = await startApp();
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("api.brevo.com")) {
      sent.push(JSON.parse(options.body));
      return { ok: true, status: 201, json: async () => ({ messageId: "1" }) };
    }
    return originalFetch(url, options);
  };
  const previousKey = process.env.BREVO_API_KEY;
  const previousSender = process.env.BREVO_SENDER_EMAIL;
  process.env.BREVO_API_KEY = "xkeysib-test";
  process.env.BREVO_SENDER_EMAIL = "contact@lastro.fr";
  try {
    const { createPaidDelivery, markDeliveryReady } = await import("../src/models/publicDeliveryService.mjs");
    const { delivery } = await createPaidDelivery(app.store, {
      paymentSessionId: "cs_recover",
      email: "client@example.com"
    });
    await markDeliveryReady(app.store, delivery.id, { html: "<p>x</p>", markdown: "x" });

    const wrong = await request(app.baseUrl, "/api/public/deliveries/recover", {
      method: "POST",
      body: { reference: delivery.reference, email: "quelquun@ailleurs.fr" }
    });
    const right = await request(app.baseUrl, "/api/public/deliveries/recover", {
      method: "POST",
      body: { reference: delivery.reference, email: "client@example.com" }
    });
    const unknown = await request(app.baseUrl, "/api/public/deliveries/recover", {
      method: "POST",
      body: { reference: "L-2026-AAAAAA-BBBB", email: "client@example.com" }
    });

    // Réponse identique dans les trois cas : on n'apprend rien sur l'existence
    // d'une commande ni sur l'adresse associée.
    assert.deepEqual(wrong.payload, { requested: true });
    assert.deepEqual(right.payload, { requested: true });
    assert.deepEqual(unknown.payload, { requested: true });
    // Un seul e-mail est parti : celui de la bonne adresse.
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0].email, "client@example.com");
    assert.match(sent[0].textContent, new RegExp(delivery.token));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) {
      delete process.env.BREVO_API_KEY;
    } else {
      process.env.BREVO_API_KEY = previousKey;
    }
    if (previousSender === undefined) {
      delete process.env.BREVO_SENDER_EMAIL;
    } else {
      process.env.BREVO_SENDER_EMAIL = previousSender;
    }
    await app.close();
  }
});

test("l'exploitant peut tester l'envoi d'un e-mail sans passer par un paiement", async () => {
  const app = await startApp();
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("api.brevo.com")) {
      sent.push(JSON.parse(options.body));
      return { ok: true, status: 201, json: async () => ({ messageId: "42" }) };
    }
    return originalFetch(url, options);
  };
  const previous = {
    key: process.env.BREVO_API_KEY,
    sender: process.env.BREVO_SENDER_EMAIL,
    code: process.env.ASTROLAB_TEST_CODE,
    allowlist: process.env.ASTROLAB_TEST_EMAIL_ALLOWLIST
  };
  process.env.BREVO_API_KEY = "xkeysib-test";
  process.env.BREVO_SENDER_EMAIL = "contact@lastro.fr";
  process.env.ASTROLAB_TEST_CODE = "mon-code-de-test-2026";
  try {
    // Sans le bon code, rien ne part.
    const refused = await request(app.baseUrl, "/api/public/test-email", {
      method: "POST",
      body: { testCode: "mauvais-code-123456", to: "contact@lastro.fr" }
    });
    assert.equal(refused.status, 403);
    assert.equal(sent.length, 0);

    // Le code de test est fait pour être partagé : le détenir ne donne pas le
    // droit d'écrire à n'importe qui depuis notre domaine.
    const horsListe = await request(app.baseUrl, "/api/public/test-email", {
      method: "POST",
      body: { testCode: "mon-code-de-test-2026", to: "inconnu@example.com" }
    });
    assert.equal(horsListe.status, 403);
    assert.match(horsListe.payload.error, /autorisée/i);
    assert.equal(sent.length, 0);

    // L'expéditeur lui-même reste joignable, sans tenir compte de la casse.
    const ok = await request(app.baseUrl, "/api/public/test-email", {
      method: "POST",
      body: { testCode: "mon-code-de-test-2026", to: "Contact@Lastro.fr" }
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.payload.sent, true);
    assert.equal(ok.payload.to, "c***@lastro.fr");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0].email, "Contact@Lastro.fr");
    assert.match(sent[0].subject, /Test d'envoi Lastro/);

    // Une adresse explicitement autorisée passe : les essais ont besoin d'une
    // autre boîte que celle de l'expéditeur.
    process.env.ASTROLAB_TEST_EMAIL_ALLOWLIST = "bassam@example.com, autre@example.com";
    const autorise = await request(app.baseUrl, "/api/public/test-email", {
      method: "POST",
      body: { testCode: "mon-code-de-test-2026", to: "Bassam@Example.com" }
    });
    assert.equal(autorise.status, 200);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].to[0].email, "Bassam@Example.com");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [
      ["BREVO_API_KEY", previous.key],
      ["BREVO_SENDER_EMAIL", previous.sender],
      ["ASTROLAB_TEST_CODE", previous.code],
      ["ASTROLAB_TEST_EMAIL_ALLOWLIST", previous.allowlist]
    ]) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await app.close();
  }
});

test("le lien de récupération part dans la file d'envoi d'e-mails", async () => {
  const app = await startApp();
  try {
    const { queueDeliveryEmail, deliveryLink, createPaidDelivery, markDeliveryReady } = await import(
      "../src/models/publicDeliveryService.mjs"
    );
    const { delivery } = await createPaidDelivery(app.store, { paymentSessionId: "cs_test_mail", email: "client@example.com" });
    await markDeliveryReady(app.store, delivery.id, { html: "<p>x</p>", markdown: "x" });
    await queueDeliveryEmail(app.store, delivery, { link: deliveryLink(delivery.token, "https://lastro.fr") });

    const state = await app.store.load();
    const mail = state.outbox.at(-1);
    assert.equal(mail.type, "public_reading_link");
    assert.equal(mail.to, "client@example.com");
    assert.match(mail.link, new RegExp(delivery.token));
  } finally {
    await app.close();
  }
});
