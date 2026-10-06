import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { OUTBOX_STALE_SENDING_MS } from "../src/notifications/mailer.mjs";

async function startApp() {
  const { server, store } = createApp({ store: new JsonStore(null), outboxMaintenance: false, backgroundReadingJobs: false });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    store,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function request(baseUrl, path, { method = "GET", body, cookie, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...headers,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text || "null");
  } catch {
    payload = null;
  }
  return {
    status: response.status,
    payload,
    text,
    headers: response.headers
  };
}

async function rawRequest(baseUrl, path, { cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { headers: cookie ? { cookie } : {} });
  return { status: response.status, text: await response.text(), headers: response.headers };
}

async function adminCookie(store) {
  await store.transact((state) => {
    state.users.push({
      id: "admin_1",
      email: "admin@example.test",
      emailVerifiedAt: new Date().toISOString(),
      primaryRole: "admin",
      createdAt: new Date().toISOString(),
      deletedAt: null
    });
    state.sessions.push({
      id: "session_1",
      userId: "admin_1",
      token: "admin-token",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });
  });
  return "astrolab_session=admin-token";
}

async function userCookie(store) {
  await store.transact((state) => {
    state.users.push({
      id: "user_1",
      email: "user@example.test",
      emailVerifiedAt: new Date().toISOString(),
      primaryRole: "user",
      createdAt: new Date().toISOString(),
      deletedAt: null
    });
    state.sessions.push({
      id: "session_user",
      userId: "user_1",
      token: "user-token",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });
  });
  return "astrolab_session=user-token";
}

function reading(overrides = {}) {
  const createdAt = overrides.createdAt ?? new Date().toISOString();
  return {
    id: overrides.id ?? "reading_1",
    reference: overrides.reference ?? "L-2026-ADMIN-0001",
    token: overrides.token ?? "TOKENADMINTESTTOKENADMINTEST1234",
    paymentSessionId: overrides.paymentSessionId ?? "cs_live_admin",
    email: overrides.email ?? "client@example.test",
    amountCents: 300,
    currency: "eur",
    language: "fr",
    freeAccess: false,
    sharedFreeAccessQuota: false,
    accessCodeId: null,
    status: overrides.status ?? "ready",
    input: null,
    reading: overrides.status === "ready" || overrides.status === undefined ? { html: "<p>ok</p>", markdown: "ok" } : null,
    error: overrides.error ?? null,
    errorCode: overrides.errorCode ?? null,
    progress: { completedSections: 1, totalSections: 1, currentSection: null },
    generation: { attempt: 1, leaseId: null, leaseUntil: null, startedAt: createdAt, finishedAt: overrides.finishedAt ?? createdAt },
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides
  };
}

function mail(overrides = {}) {
  return {
    id: overrides.id ?? "mail_1",
    to: overrides.to ?? "client@example.test",
    type: overrides.type ?? "public_reading_link",
    status: overrides.status ?? "sent",
    attempts: overrides.attempts ?? 1,
    subject: "Votre lecture Lastro est prête",
    body: "ok",
    html: "<p>ok</p>",
    deliveryId: overrides.deliveryId ?? "reading_1",
    emailKey: overrides.emailKey ?? "public_reading_link:reading_1:ready",
    purpose: overrides.purpose ?? "ready",
    reference: overrides.reference ?? "L-2026-ADMIN-0001",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    sentAt: overrides.sentAt,
    sendingStartedAt: overrides.sendingStartedAt,
    failedAt: overrides.failedAt,
    providerMessageId: overrides.providerMessageId,
    error: overrides.error,
    failureKind: overrides.failureKind,
    manualReviewRequired: overrides.manualReviewRequired
  };
}

test("admin readings page and API refuse unauthenticated requests without leaking client data", async () => {
  const app = await startApp();
  try {
    await app.store.transact((state) => {
      state.publicReadings.push(reading({ email: "secret-client@example.test" }));
    });
    const page = await rawRequest(app.baseUrl, "/rouflaquette");
    assert.equal(page.status, 401);
    assert.equal(page.headers.get("cache-control"), "no-store");
    assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.doesNotMatch(page.text, /secret-client@example\.test/);

    const api = await request(app.baseUrl, "/api/admin/readings");
    assert.equal(api.status, 401);
    assert.doesNotMatch(api.text, /secret-client@example\.test/);
  } finally {
    await app.close();
  }
});

test("admin role can access the protected page; normal users cannot", async () => {
  const app = await startApp();
  try {
    const normal = await userCookie(app.store);
    const refused = await rawRequest(app.baseUrl, "/rouflaquette", { cookie: normal });
    assert.equal(refused.status, 403);

    const admin = await adminCookie(app.store);
    const oldPath = await rawRequest(app.baseUrl, "/admin/readings", { cookie: admin });
    assert.equal(oldPath.status, 404);
    assert.doesNotMatch(oldPath.text, /Lectures publiques/);

    const page = await rawRequest(app.baseUrl, "/rouflaquette", { cookie: admin });
    assert.equal(page.status, 200);
    assert.match(page.text, /Lectures publiques/);
    assert.match(page.text, /Europe\/Paris/);
    assert.doesNotMatch(page.text, /innerHTML/);
    assert.equal(page.headers.get("cache-control"), "no-store");
    assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
  } finally {
    await app.close();
  }
});

test("admin readings list caps at 200, orders newest first, filters and searches existing data", async () => {
  const app = await startApp();
  try {
    const admin = await adminCookie(app.store);
    await app.store.transact((state) => {
      for (let index = 0; index < 205; index += 1) {
        state.publicReadings.push(reading({
          id: `reading_${index}`,
          reference: `L-2026-${String(index).padStart(3, "0")}`,
          token: `TOKEN${String(index).padStart(27, "A")}`,
          email: index === 3 ? "search-me@example.test" : `client${index}@example.test`,
          status: index % 4 === 0 ? "queued" : index % 4 === 1 ? "generating" : index % 4 === 2 ? "ready" : "failed",
          paymentSessionId: index === 7 ? null : `cs_${index}`,
          freeAccess: index === 7,
          accessCodeId: index === 8 ? "access_8" : null,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
          updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
          error: index % 4 === 3 ? "échec court" : null
        }));
      }
      state.outbox.push(mail({ deliveryId: "reading_2", providerMessageId: "sent-2", sentAt: new Date().toISOString() }));
      state.outbox.push(mail({ id: "mail_failed", deliveryId: "reading_3", status: "failed", error: "Brevo KO", failedAt: new Date().toISOString() }));
      state.outbox.push(mail({
        id: "mail_stale",
        deliveryId: "reading_4",
        status: "sending",
        sendingStartedAt: new Date(Date.now() - OUTBOX_STALE_SENDING_MS - 1000).toISOString()
      }));
    });

    const all = await request(app.baseUrl, "/api/admin/readings", { cookie: admin });
    assert.equal(all.status, 200);
    assert.equal(all.payload.maxResults, 200);
    assert.equal(all.payload.readings.length, 200);
    assert.equal(all.payload.readings[0].reference, "L-2026-204");
    assert.ok(all.payload.readings.some((entry) => entry.readingStatus === "queued"));
    assert.ok(all.payload.readings.some((entry) => entry.readingStatus === "generating"));
    assert.ok(all.payload.readings.some((entry) => entry.readingStatus === "ready"));
    assert.ok(all.payload.readings.some((entry) => entry.readingStatus === "failed"));

    const email = await request(app.baseUrl, "/api/admin/readings?q=search-me@example.test", { cookie: admin });
    assert.equal(email.payload.readings.length, 1);
    assert.equal(email.payload.readings[0].clientEmail, "search-me@example.test");

    const reference = await request(app.baseUrl, "/api/admin/readings?q=L-2026-003", { cookie: admin });
    assert.equal(reference.payload.readings[0].reference, "L-2026-003");

    const failed = await request(app.baseUrl, "/api/admin/readings?filter=failed", { cookie: admin });
    assert.ok(failed.payload.readings.every((entry) => entry.readingStatus === "failed"));

    const emailAction = await request(app.baseUrl, "/api/admin/readings?filter=email_action", { cookie: admin });
    assert.ok(emailAction.payload.readings.some((entry) => entry.emailStatus === "sending_stale"));
    assert.ok(emailAction.payload.readings.some((entry) => entry.emailStatus === "failed"));

    const sourceCode = all.payload.readings.find((entry) => entry.id === "reading_7");
    const sourceAccess = all.payload.readings.find((entry) => entry.id === "reading_8");
    assert.equal(sourceCode.source, "Code de test");
    assert.equal(sourceAccess.source, "Code d’accès");
  } finally {
    await app.close();
  }
});

test("admin readings expose old readings without email and do not invent links or sources", async () => {
  const app = await startApp();
  try {
    const admin = await adminCookie(app.store);
    await app.store.transact((state) => {
      state.publicReadings.push(reading({
        id: "reading_old",
        reference: "L-2026-OLD",
        email: null,
        paymentSessionId: null,
        freeAccess: false,
        status: "queued"
      }));
    });
    const response = await request(app.baseUrl, "/api/admin/readings", { cookie: admin });
    const old = response.payload.readings[0];
    assert.equal(old.clientEmail, null);
    assert.equal(old.emailStatus, "unknown");
    assert.equal(old.source, "—");
    assert.equal(old.link, null);
  } finally {
    await app.close();
  }
});

test("ready readings expose /r token, failed readings expose action details and email alert statuses", async () => {
  const app = await startApp();
  try {
    const admin = await adminCookie(app.store);
    await app.store.transact((state) => {
      state.publicReadings.push(reading({ id: "reading_ready", reference: "L-READY", token: "READYTOKENREADYTOKENREADYTOKEN1234", status: "ready" }));
      state.publicReadings.push(reading({
        id: "reading_failed",
        reference: "L-FAILED",
        status: "failed",
        error: "Erreur utile\navec stack ignorée".repeat(20),
        errorCode: "llm_failed"
      }));
      state.outbox.push(mail({ id: "ready_mail", deliveryId: "reading_ready", status: "sent", sentAt: new Date().toISOString() }));
      state.outbox.push(mail({ id: "failure_mail", deliveryId: "reading_failed", type: "public_reading_failure", status: "sent", sentAt: new Date().toISOString() }));
      state.outbox.push(mail({ id: "admin_mail", deliveryId: "reading_failed", type: "admin_alert", status: "failed", error: "admin ko" }));
    });
    const response = await request(app.baseUrl, "/api/admin/readings", { cookie: admin });
    const ready = response.payload.readings.find((entry) => entry.id === "reading_ready");
    const failed = response.payload.readings.find((entry) => entry.id === "reading_failed");
    assert.match(ready.link, /\/r\/READYTOKENREADYTOKENREADYTOKEN1234$/);
    assert.equal(ready.canView, true);
    assert.equal(ready.canResendEmail, true);
    assert.match(ready.resendWarning, /doublon/);
    assert.equal(failed.failure.message, "Action requise");
    assert.equal(failed.failure.clientFailureEmail, "sent");
    assert.equal(failed.failure.adminAlertEmail, "failed");
    assert.ok(failed.failure.error.length <= 180);
  } finally {
    await app.close();
  }
});

test("admin resend requires readingId, explicit confirmation and queues only one reading email", async () => {
  const app = await startApp();
  try {
    const admin = await adminCookie(app.store);
    await app.store.transact((state) => {
      state.publicReadings.push(reading({ id: "reading_resend", reference: "L-RESEND", token: "RESENDTOKENRESENDTOKENRESEND1234" }));
      state.publicReadings.push(reading({ id: "reading_other", reference: "L-OTHER", token: "OTHERTOKENOTHERTOKENOTHER123456" }));
    });

    const missing = await request(app.baseUrl, "/api/admin/readings/resend-email", {
      method: "POST",
      cookie: admin,
      headers: { "x-astrolab-admin-action": "resend-email" },
      body: { readingId: "reading_resend" }
    });
    assert.equal(missing.status, 400);

    const noHeader = await request(app.baseUrl, "/api/admin/readings/resend-email", {
      method: "POST",
      cookie: admin,
      body: { readingId: "reading_resend", confirm: "reading_resend" }
    });
    assert.equal(noHeader.status, 403);

    const ok = await request(app.baseUrl, "/api/admin/readings/resend-email", {
      method: "POST",
      cookie: admin,
      headers: { "x-astrolab-admin-action": "resend-email" },
      body: { readingId: "reading_resend", confirm: "reading_resend" }
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.payload.skipped, true);
    const state = await app.store.load();
    const resent = state.outbox.filter((entry) => entry.purpose?.startsWith("admin_resend:"));
    assert.equal(resent.length, 1);
    assert.equal(resent[0].deliveryId, "reading_resend");
    assert.match(resent[0].body, /\/r\/RESENDTOKENRESENDTOKENRESEND1234/);
    assert.doesNotMatch(resent[0].body, /OTHERTOKEN/);
  } finally {
    await app.close();
  }
});

test("admin page keeps hostile client data as fetched text and no public API lists clients", async () => {
  const app = await startApp();
  try {
    const admin = await adminCookie(app.store);
    const hostile = "<script>alert(1)</script>@example.test";
    await app.store.transact((state) => {
      state.publicReadings.push(reading({ id: "reading_xss", reference: "L-XSS", email: hostile }));
    });
    const page = await rawRequest(app.baseUrl, "/rouflaquette", { cookie: admin });
    assert.equal(page.status, 200);
    assert.doesNotMatch(page.text, /<script>alert\(1\)<\/script>@example\.test/);
    assert.match(page.text, /createTextNode/);
    assert.doesNotMatch(page.text, /\.innerHTML\s*=/);

    const api = await request(app.baseUrl, "/api/admin/readings?q=script", { cookie: admin });
    assert.equal(api.payload.readings[0].clientEmail, hostile);

    const publicList = await request(app.baseUrl, "/api/public/readings");
    assert.notEqual(publicList.status, 200);
    assert.doesNotMatch(publicList.text, /alert\(1\)|example\.test/);
  } finally {
    await app.close();
  }
});
