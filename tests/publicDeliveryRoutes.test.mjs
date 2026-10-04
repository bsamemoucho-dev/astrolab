import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";

async function startApp(options = {}) {
  const { server, store } = createApp({ store: new JsonStore(null), ...options });
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

async function waitForStatus(baseUrl, readingId, wanted) {
  let last = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    last = await request(baseUrl, `/api/public/readings/${readingId}/status`);
    if (last.payload?.status === wanted) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return last;
}

const INVALID_INPUT = { firstName: "Test" };
const VALID_INPUT = {
  firstName: "Test",
  birthDate: "1990-01-15",
  timePrecision: "exact",
  timeValue: "12:30",
  resolvedPlace: {
    selectedName: "Paris, France",
    normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
  }
};

test("une demande invalide est refusée avant de créer une lecture", async () => {
  const app = await startApp();
  try {
    const failed = await request(app.baseUrl, "/api/public/readings", { method: "POST", body: INVALID_INPUT });
    assert.equal(failed.status, 400);
    assert.match(failed.payload.error, /date de naissance/i);
    assert.equal((await app.store.load()).publicReadings.length, 0);
  } finally {
    await app.close();
  }
});

test("le POST crée un job durable et la lecture devient récupérable après génération", async () => {
  const app = await startApp({
    publicReadingWriter: async (_input, options = {}) => {
      await options.onProgress?.({ completedSections: 1, totalSections: 2, currentSection: "identity" });
      await options.onProgress?.({ completedSections: 2, totalSections: 2, currentSection: null });
      return { html: "<!doctype html><p>ok</p>", markdown: "ok", writerMode: "test", language: "fr", dossier: { generatedSectionCount: 2 } };
    }
  });
  try {
    const started = await request(app.baseUrl, "/api/public/readings", { method: "POST", body: VALID_INPUT });
    assert.equal(started.status, 202);
    assert.equal(started.payload.status, "queued");
    assert.ok(started.payload.readingId);
    assert.ok(started.payload.delivery.link);

    let status = started.payload;
    for (let attempt = 0; attempt < 20 && status.status !== "ready"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      status = (await request(app.baseUrl, `/api/public/readings/${started.payload.readingId}/status`)).payload;
    }
    assert.equal(status.status, "ready");
    assert.equal(status.progress.completedSections, 2);
    const token = started.payload.delivery.link.match(/\/r\/([^/]+)$/)[1];
    const view = await request(app.baseUrl, `/api/public/deliveries/${token}`);
    assert.equal(view.status, 200);
    assert.equal(view.payload.delivery.status, "ready");
    assert.match(view.payload.delivery.reading.html, /<!doctype html>/);
    assert.equal("token" in view.payload.delivery, false);
  } finally {
    await app.close();
  }
});

test("une lecture queued survit à un redémarrage simulé et reprend ensuite", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lastro-reading-job-"));
  const dbPath = join(dir, "state.json");
  const first = createApp({
    dbPath,
    backgroundReadingJobs: false,
    publicReadingWriter: async () => {
      throw new Error("ne doit pas tourner avant redémarrage");
    }
  });
  await new Promise((resolve) => first.server.listen(0, "127.0.0.1", resolve));
  const firstUrl = `http://127.0.0.1:${first.server.address().port}`;
  try {
    const started = await request(firstUrl, "/api/public/readings", { method: "POST", body: VALID_INPUT });
    assert.equal(started.status, 202);
    assert.equal(started.payload.status, "queued");
  } finally {
    await new Promise((resolve) => first.server.close(resolve));
  }

  const second = createApp({
    dbPath,
    publicReadingWriter: async (_input, options = {}) => {
      await options.onProgress?.({ completedSections: 1, totalSections: 1, currentSection: null });
      return { html: "<!doctype html><p>reprise</p>", markdown: "reprise", writerMode: "test", dossier: { generatedSectionCount: 1 } };
    }
  });
  await new Promise((resolve) => second.server.listen(0, "127.0.0.1", resolve));
  const secondUrl = `http://127.0.0.1:${second.server.address().port}`;
  try {
    const state = await second.store.load();
    const readingId = state.publicReadings[0].id;
    const ready = await waitForStatus(secondUrl, readingId, "ready");
    assert.equal(ready.payload.status, "ready");
  } finally {
    await new Promise((resolve) => second.server.close(resolve));
  }
});

test("les polls répétés ne lancent pas deux générations simultanées", async () => {
  let resolveWriter;
  const writerDone = new Promise((resolve) => {
    resolveWriter = resolve;
  });
  let calls = 0;
  const app = await startApp({
    publicReadingWriter: async () => {
      calls += 1;
      await writerDone;
      return { html: "<!doctype html><p>ok</p>", markdown: "ok", writerMode: "test", dossier: { generatedSectionCount: 1 } };
    }
  });
  try {
    const started = await request(app.baseUrl, "/api/public/readings", { method: "POST", body: VALID_INPUT });
    assert.equal(started.status, 202);
    await Promise.all([
      request(app.baseUrl, `/api/public/readings/${started.payload.readingId}/status`),
      request(app.baseUrl, `/api/public/readings/${started.payload.readingId}/status`),
      request(app.baseUrl, `/api/public/readings/${started.payload.readingId}/status`)
    ]);
    assert.equal(calls, 1);
    resolveWriter();
    const ready = await waitForStatus(app.baseUrl, started.payload.readingId, "ready");
    assert.equal(ready.payload.status, "ready");
  } finally {
    await app.close();
  }
});

test("une erreur de génération devient un statut failed persistant", async () => {
  const app = await startApp({
    publicReadingWriter: async () => {
      const error = new Error("LLM indisponible pour le test");
      error.code = "llm_test_failure";
      throw error;
    }
  });
  try {
    const started = await request(app.baseUrl, "/api/public/readings", { method: "POST", body: VALID_INPUT });
    assert.equal(started.status, 202);
    const failed = await waitForStatus(app.baseUrl, started.payload.readingId, "failed");
    assert.equal(failed.payload.status, "failed");
    assert.match(failed.payload.delivery.link, /\/r\//);
    const state = await app.store.load();
    assert.equal(state.publicReadings[0].status, "failed");
    assert.equal(state.publicReadings[0].errorCode, "llm_test_failure");
    assert.match(state.publicReadings[0].error, /LLM indisponible/);
    assert.match(failed.payload.delivery.link, /\/r\//);
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
    const { createPaidDelivery } = await import("../src/models/publicDeliveryService.mjs");
    const { delivery } = await createPaidDelivery(app.store, { input: VALID_INPUT });
    const { token } = delivery;

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
  const app = await startApp({
    publicReadingWriter: async () => {
      throw new Error("échec de test");
    }
  });
  try {
    const { createPaidDelivery, markDeliveryFailed } = await import("../src/models/publicDeliveryService.mjs");
    const { delivery } = await createPaidDelivery(app.store, { input: VALID_INPUT });
    await markDeliveryFailed(app.store, delivery.id, "échec initial", "test_failure");
    const { token } = delivery;

    const retry = await request(app.baseUrl, `/api/public/deliveries/${token}/regenerate`, { method: "POST" });
    assert.equal(retry.status, 200);
    assert.equal(retry.payload.delivery.status, "queued");

    const state = await app.store.load();
    assert.equal(state.publicReadings.length, 1);
    assert.equal(["queued", "generating", "failed"].includes(state.publicReadings[0].status), true);
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
