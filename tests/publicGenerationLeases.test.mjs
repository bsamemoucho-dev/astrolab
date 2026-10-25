import assert from "node:assert/strict";
import test from "node:test";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";
import {
  claimDeliveryGeneration,
  claimNextDeliveryGeneration,
  createPaidDelivery,
  markDeliveryFailed,
  markDeliveryGenerating,
  markDeliveryProgress,
  markDeliveryQueued,
  markDeliveryReady,
  MAX_AUTOMATIC_GENERATION_RECOVERIES,
  PUBLIC_GENERATION_RECOVERY_VERSION
} from "../src/models/publicDeliveryService.mjs";

// These tests must never reach a model, payment provider or mail provider.
const originalBaseUrl = process.env.PUBLIC_BASE_URL;
process.env.PUBLIC_BASE_URL = "https://lastro.example.invalid";
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  if (new URL(url).hostname !== "127.0.0.1") throw new Error("External network forbidden in lease tests");
  return originalFetch(url, options);
};
test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalBaseUrl === undefined) delete process.env.PUBLIC_BASE_URL;
  else process.env.PUBLIC_BASE_URL = originalBaseUrl;
});

const reading = (text = "validated fixture") => ({ html: `<p>${text}</p>`, markdown: text, dossier: { generatedSectionCount: 1 } });
async function fixture(now = Date.now()) {
  const store = new JsonStore(null);
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "fictional-session", email: "fixture@example.invalid" }, now);
  return { store, delivery };
}
async function entry(store, id) { return (await store.load()).publicReadings.find((row) => row.id === id); }
async function until(predicate, message = "condition not reached") {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
}
async function startApp(store, options = {}) {
  const app = createApp({ store, outboxMaintenance: false, generationRecoveryIntervalMs: 5, ...options });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  return { ...app, baseUrl: `http://127.0.0.1:${app.server.address().port}`, close: () => new Promise((resolve) => app.server.close(resolve)) };
}

test("concurrent claims reserve one owner, and active retries do not revoke it", async () => {
  const { store, delivery } = await fixture();
  const claims = await Promise.all([
    claimDeliveryGeneration(store, delivery.id, { leaseId: "owner-a" }),
    claimDeliveryGeneration(store, delivery.id, { leaseId: "owner-b" })
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  const owner = (await entry(store, delivery.id)).generation.leaseId;
  const before = JSON.stringify(await entry(store, delivery.id));
  assert.equal(await markDeliveryQueued(store, delivery.id), null);
  assert.equal(await markDeliveryGenerating(store, delivery.id), null);
  assert.equal(JSON.stringify(await entry(store, delivery.id)), before);
  assert.equal((await entry(store, delivery.id)).generation.leaseId, owner);
});

test("leased progress and completions require the exact owner token", async () => {
  const { store, delivery } = await fixture();
  const t = Date.now();
  await claimDeliveryGeneration(store, delivery.id, { leaseId: "owner-a", now: t, leaseMs: 100 });
  const before = JSON.stringify(await entry(store, delivery.id));
  for (const leaseId of [null, "wrong-owner"]) {
    assert.equal(await markDeliveryProgress(store, delivery.id, { completedSections: 99 }, { leaseId }), null);
    assert.equal(await markDeliveryReady(store, delivery.id, reading("wrong"), { leaseId }), null);
    assert.equal(await markDeliveryFailed(store, delivery.id, "wrong", "wrong", { leaseId }), null);
  }
  assert.equal(JSON.stringify(await entry(store, delivery.id)), before);
  await markDeliveryProgress(store, delivery.id, { completedSections: 1, totalSections: 2 }, { leaseId: "owner-a", now: t + 10, leaseMs: 100 });
  assert.equal((await entry(store, delivery.id)).generation.leaseUntil, new Date(t + 110).toISOString());
  assert.equal((await markDeliveryReady(store, delivery.id, reading(), { leaseId: "owner-a" })).status, "ready");
});

test("superseded workers cannot alter progress or overwrite ready and failed states", async () => {
  const { store, delivery } = await fixture();
  const t = Date.now();
  await claimDeliveryGeneration(store, delivery.id, { leaseId: "old", now: t, leaseMs: 10 });
  await claimDeliveryGeneration(store, delivery.id, { leaseId: "new", now: t + 11, leaseMs: 100 });
  assert.equal(await markDeliveryProgress(store, delivery.id, { completedSections: 99 }, { leaseId: "old" }), null);
  assert.equal(await markDeliveryReady(store, delivery.id, reading("old"), { leaseId: "old" }), null);
  assert.equal(await markDeliveryFailed(store, delivery.id, "old failed", "old", { leaseId: "old" }), null);
  await markDeliveryReady(store, delivery.id, reading("new"), { leaseId: "new" });
  const ready = JSON.stringify(await entry(store, delivery.id));
  assert.equal(await markDeliveryReady(store, delivery.id, reading("late"), { leaseId: "new" }), null);
  assert.equal(await markDeliveryFailed(store, delivery.id, "late", "late", { leaseId: "old" }), null);
  assert.equal(await markDeliveryFailed(store, delivery.id, "unleased late"), null);
  assert.equal(JSON.stringify(await entry(store, delivery.id)), ready);
  const second = await createPaidDelivery(store, { paymentSessionId: "second-fixture" });
  await claimDeliveryGeneration(store, second.delivery.id, { leaseId: "failing" });
  await markDeliveryFailed(store, second.delivery.id, "expected", "fixture_failure", { leaseId: "failing" });
  const failed = JSON.stringify(await entry(store, second.delivery.id));
  assert.equal(await markDeliveryReady(store, second.delivery.id, reading(), { leaseId: "failing" }), null);
  assert.equal(JSON.stringify(await entry(store, second.delivery.id)), failed);
});

test("synchronous unleased producers remain valid, but cannot bypass a lease", async () => {
  const { store, delivery } = await fixture();
  await markDeliveryGenerating(store, delivery.id);
  assert.equal((await markDeliveryReady(store, delivery.id, reading())).status, "ready");
  const second = await createPaidDelivery(store, { paymentSessionId: "sync-failure" });
  assert.equal((await markDeliveryFailed(store, second.delivery.id, "expected fixture failure")).status, "failed");
  assert.equal(await markDeliveryReady(store, second.delivery.id, reading()), null);
});

test("automatic recoveries are bounded and polling cannot reset the limit", async () => {
  const t = Date.now() - 1000;
  const { store, delivery } = await fixture(t);
  await claimDeliveryGeneration(store, delivery.id, { leaseId: "initial", now: t, leaseMs: 10 });
  assert.equal(MAX_AUTOMATIC_GENERATION_RECOVERIES, 1);
  const recovered = await claimNextDeliveryGeneration(store, { leaseId: "recovery", now: t + 11, leaseMs: 10, recoveryEligibleOnly: true });
  assert.equal(recovered.generation.automaticRecoveries, 1);
  assert.equal(await claimNextDeliveryGeneration(store, { leaseId: "forbidden", now: t + 22, recoveryEligibleOnly: true }), null);
  assert.equal(await claimDeliveryGeneration(store, delivery.id, { leaseId: "poll-cannot-bypass", now: t + 23 }), null);
  const blocked = await entry(store, delivery.id);
  assert.equal(blocked.generation.attempt, 2);
  assert.equal(blocked.generation.recoveryStatus, "manual_review_required");
  assert.equal(blocked.generation.recoveryReason, "automatic_recovery_limit_reached");
  assert.equal((await store.load()).outbox.length, 0);
  // A deliberate retry remains possible without creating another order/payment.
  assert.ok(await markDeliveryQueued(store, delivery.id, { now: t + 24 }));
  const explicit = await claimDeliveryGeneration(store, delivery.id, { leaseId: "explicit", now: t + 25 });
  assert.equal(explicit.generation.automaticRecoveries, 0);
  assert.equal((await store.load()).publicReadings.length, 1);
  assert.equal(explicit.paymentSessionId, "fictional-session");
});

test("boot and periodic recovery exclude every legacy queued or abandoned job", async () => {
  const { store, delivery } = await fixture();
  const second = await createPaidDelivery(store, { paymentSessionId: "old-queued" });
  await claimDeliveryGeneration(store, delivery.id, { leaseId: "old", now: Date.now() - 1000, leaseMs: 10 });
  await store.transact((state) => { for (const row of state.publicReadings) delete row.generation.recoveryVersion; });
  let calls = 0;
  const app = await startApp(store, { publicReadingWriter: async () => { calls++; return reading(); } });
  try {
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(calls, 0);
    assert.equal((await entry(store, delivery.id)).status, "generating");
    assert.equal((await entry(store, second.delivery.id)).status, "queued");
    assert.equal((await store.load()).outbox.length, 0);
  } finally { await app.close(); }
});

test("a new job whose lease expires after boot resumes once without client polling", async () => {
  const { store, delivery } = await fixture();
  await claimDeliveryGeneration(store, delivery.id, { leaseId: "interrupted", leaseMs: 80 });
  let calls = 0;
  const app = await startApp(store, { publicReadingWriter: async () => { calls++; return reading("recovered"); } });
  try {
    assert.equal(calls, 0);
    await until(async () => (await entry(store, delivery.id)).status === "ready");
    assert.equal(calls, 1);
    const done = await entry(store, delivery.id);
    assert.equal(done.generation.recoveryVersion, PUBLIC_GENERATION_RECOVERY_VERSION);
    assert.equal(done.generation.attempt, 2);
    assert.equal(done.generation.automaticRecoveries, 1);
    await until(async () => (await store.load()).outbox.filter((mail) => mail.purpose === "ready").length === 1);
    assert.equal((await store.load()).outbox.filter((mail) => mail.purpose === "ready").length, 1);
  } finally { await app.close(); }
});

test("periodic scans never reclaim a locally active job even after lease expiry", async () => {
  const { store, delivery } = await fixture();
  let finish;
  const result = new Promise((resolve) => { finish = resolve; });
  let calls = 0;
  const app = await startApp(store, { publicReadingWriter: async () => { calls++; return result; } });
  try {
    await until(() => calls === 1);
    const leaseId = (await entry(store, delivery.id)).generation.leaseId;
    await store.transact((state) => { state.publicReadings[0].generation.leaseUntil = new Date(Date.now() - 1).toISOString(); });
    await new Promise((resolve) => setTimeout(resolve, 35));
    assert.equal(calls, 1);
    assert.equal((await entry(store, delivery.id)).generation.leaseId, leaseId);
    assert.equal((await entry(store, delivery.id)).generation.attempt, 1);
    finish(reading());
    await until(async () => (await entry(store, delivery.id)).status === "ready");
  } finally { finish(reading()); await app.close(); }
});

for (const outcome of ["success", "failure"]) {
  test(`a superseded HTTP worker's late ${outcome} produces no document change or notification`, async () => {
    const { store, delivery } = await fixture();
    let finish, fail, onProgress;
    const pending = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    let calls = 0;
    const app = await startApp(store, { publicReadingWriter: async (_input, options) => { calls++; onProgress = options.onProgress; return pending; } });
    try {
      await until(() => calls === 1);
      await store.transact((state) => { state.publicReadings[0].generation.leaseUntil = new Date(Date.now() - 1).toISOString(); });
      await claimDeliveryGeneration(store, delivery.id, { leaseId: "replacement" });
      await markDeliveryReady(store, delivery.id, reading("winning replacement"), { leaseId: "replacement" });
      const before = JSON.stringify(await entry(store, delivery.id));
      await onProgress({ completedSections: 99 });
      if (outcome === "success") finish(reading("late losing result")); else fail(new Error("late losing failure"));
      await new Promise((resolve) => setTimeout(resolve, 35));
      assert.equal(JSON.stringify(await entry(store, delivery.id)), before);
      assert.equal((await store.load()).outbox.length, 0);
      const status = await fetch(`${app.baseUrl}/api/public/readings/${delivery.id}/status`).then((response) => response.json());
      assert.equal(status.status, "ready");
      assert.equal(calls, 1);
    } finally { finish(reading()); await app.close(); }
  });
}

test("HTTP regenerate preserves an active lease and does not create another job", async () => {
  const { store, delivery } = await fixture();
  await claimDeliveryGeneration(store, delivery.id, { leaseId: "still-active" });
  const before = JSON.stringify(await entry(store, delivery.id));
  let calls = 0;
  const app = await startApp(store, { backgroundReadingJobs: false, publicReadingWriter: async () => { calls++; return reading(); } });
  try {
    const response = await fetch(`${app.baseUrl}/api/public/deliveries/${delivery.token}/regenerate`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).delivery.status, "generating");
    assert.equal(JSON.stringify(await entry(store, delivery.id)), before);
    assert.equal(calls, 0);
  } finally { await app.close(); }
});

test("backgroundReadingJobs false disables startup and periodic recovery", async () => {
  const { store, delivery } = await fixture();
  let calls = 0;
  const app = await startApp(store, { backgroundReadingJobs: false, publicReadingWriter: async () => { calls++; return reading(); } });
  try {
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(calls, 0);
    assert.equal((await entry(store, delivery.id)).status, "queued");
  } finally { await app.close(); }
});

test("server close clears recovery timers before a lease expires", async () => {
  const { store, delivery } = await fixture();
  await claimDeliveryGeneration(store, delivery.id, { leaseId: "old", leaseMs: 80 });
  let calls = 0;
  const app = await startApp(store, { publicReadingWriter: async () => { calls++; return reading(); } });
  await app.close();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(calls, 0);
  assert.equal((await entry(store, delivery.id)).generation.attempt, 1);
});


test("HTTP status polling never restarts or opts in legacy jobs; only an explicit POST does", async () => {
  const { store, delivery } = await fixture();
  const queued = await createPaidDelivery(store, { paymentSessionId: "legacy-queued-status" });
  await claimDeliveryGeneration(store, delivery.id, { leaseId: "legacy-expired", leaseMs: 10, now: Date.now() - 1000 });
  await store.transact((state) => { for (const row of state.publicReadings) delete row.generation.recoveryVersion; });
  const before = JSON.stringify((await store.load()).publicReadings);
  let calls = 0;
  const app = await startApp(store, { publicReadingWriter: async () => { calls++; return reading("explicitly resumed"); } });
  try {
    for (const id of [delivery.id, queued.delivery.id, delivery.id]) {
      const response = await fetch(`${app.baseUrl}/api/public/readings/${id}/status`);
      assert.equal(response.status, 200);
      assert.ok(["generating", "queued"].includes((await response.json()).status));
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(calls, 0);
    assert.equal(JSON.stringify((await store.load()).publicReadings), before);
    assert.equal((await entry(store, delivery.id)).generation.attempt, 1);
    assert.equal((await entry(store, delivery.id)).generation.recoveryVersion, undefined);
    const resume = await fetch(`${app.baseUrl}/api/public/deliveries/${delivery.token}/regenerate`, { method: "POST" });
    assert.equal(resume.status, 200);
    await until(async () => (await entry(store, delivery.id)).status === "ready");
    assert.equal(calls, 1);
    assert.equal((await entry(store, delivery.id)).generation.recoveryVersion, PUBLIC_GENERATION_RECOVERY_VERSION);
    assert.equal((await entry(store, queued.delivery.id)).status, "queued");
    assert.equal((await store.load()).publicReadings.length, 2);
  } finally { await app.close(); }
});


test("HTTP status lookup leaves the entire snapshot intact, including expired records", async () => {
  const { store, delivery } = await fixture();
  await store.transact((state) => {
    state.publicReadings.push({ ...structuredClone(state.publicReadings[0]), id: "expired-status-fixture", expiresAt: new Date(Date.now() - 1000).toISOString() });
  });
  const before = JSON.stringify(await store.load());
  let calls = 0;
  const app = await startApp(store, { backgroundReadingJobs: false, publicReadingWriter: async () => { calls++; return reading(); } });
  try {
    const expired = await fetch(`${app.baseUrl}/api/public/readings/expired-status-fixture/status`);
    assert.equal(expired.status, 404);
    const current = await fetch(`${app.baseUrl}/api/public/readings/${delivery.id}/status`);
    assert.equal(current.status, 200);
    assert.equal(JSON.stringify(await store.load()), before);
    assert.equal(calls, 0);
  } finally { await app.close(); }
});


test("startup and repeated recovery scans neither delete expired records nor alter legacy snapshots", async () => {
  const { store } = await fixture();
  await store.transact((state) => {
    const source = structuredClone(state.publicReadings[0]);
    delete state.publicReadings[0].generation.recoveryVersion;
    state.publicReadings.push(
      { ...structuredClone(source), id: "expired-queued-scan", expiresAt: new Date(Date.now() - 1000).toISOString() },
      { ...structuredClone(source), id: "expired-generating-scan", status: "generating", expiresAt: new Date(Date.now() - 1000).toISOString(), generation: { ...source.generation, leaseId: "expired-owner", leaseUntil: new Date(Date.now() - 1000).toISOString(), automaticRecoveries: MAX_AUTOMATIC_GENERATION_RECOVERIES } }
    );
  });
  const before = JSON.stringify(await store.load());
  assert.equal(await claimNextDeliveryGeneration(store, { recoveryEligibleOnly: true }), null);
  assert.equal(JSON.stringify(await store.load()), before);
  let calls = 0;
  const app = await startApp(store, { publicReadingWriter: async () => { calls++; return reading(); } });
  try {
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(calls, 0);
    assert.equal(JSON.stringify(await store.load()), before);
  } finally { await app.close(); }
});
