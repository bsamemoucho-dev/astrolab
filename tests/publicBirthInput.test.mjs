// Invalid birth-time input must stop before an entitlement, checkout or job is created.
// Every provider is simulated; the only real HTTP requests target this in-memory app.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";
import { createAccessCodes, countUsableAccessCodes } from "../src/models/accessCodeService.mjs";
import { assertPublicReadingInput } from "../src/models/publicReadingService.mjs";
import { createPaidDelivery, markDeliveryFailed, markDeliveryReady } from "../src/models/publicDeliveryService.mjs";
import { LASTRO_PRICING_VERSION, READING_PURPOSE } from "../src/payments/pricing.mjs";

const BIRTH = Object.freeze({ birthDate: "1990-01-15", timePrecision: "exact", timeValue: "12:30",
  resolvedPlace: { selectedName: "Paris, France", normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" } } });
const EMAIL = "fictional-reader@example.test";
const SHARED_CODE = "OWNER-OFFLINE-FIXTURE-ONLY";
const INVITATION_TOKEN = "F".repeat(43);
const sha = value => createHash("sha256").update(value).digest("hex");
const invalidTimes = [undefined, null, "", " \t ", "24:00", "12:60", "12:30:60", "9:5", "not-a-time"];
const INVALID_INPUTS = [
  ...["exact", "approximate"].flatMap(timePrecision => invalidTimes.map(timeValue => ({
    label: `${timePrecision}, invalid hour ${JSON.stringify(timeValue)}`, input: { ...BIRTH, timePrecision, timeValue }
  }))),
  ...[
    { timeStart: undefined, timeEnd: "11:00" }, { timeStart: "09:00", timeEnd: undefined },
    { timeStart: "", timeEnd: "11:00" }, { timeStart: "09:00", timeEnd: " " },
    { timeStart: "25:00", timeEnd: "11:00" }, { timeStart: "09:00", timeEnd: "11:70" },
    { timeStart: "09:00", timeEnd: "09:00" }, { timeStart: "11:00", timeEnd: "09:00" },
    { timeStart: "09:00:00", timeEnd: "09:00" }, { timeStart: "09:00:01", timeEnd: "09:00" }
  ].map((bounds, index) => ({ label: `interval, invalid bounds ${index + 1}`, input: { ...BIRTH, timePrecision: "interval", timeValue: null, ...bounds } }))
];

function invalidInput(error) {
  assert.equal(error.status, 400);
  assert.equal(error.code, "INVALID_READING_INPUT");
  assert.ok(error.message.trim(), "the visitor needs an actionable error rather than a background failure");
  return true;
}

for (const { label, input } of INVALID_INPUTS) {
  test(`birth prevalidation rejects ${label}`, () => assert.throws(() => assertPublicReadingInput(input), invalidInput));
}

for (const input of [
  { ...BIRTH, timeValue: "00:00" }, { ...BIRTH, timeValue: "23:59:59" },
  { ...BIRTH, timePrecision: "approximate", timeValue: "00:00", timeMarginMinutes: 30 },
  { ...BIRTH, timePrecision: "unknown", timeValue: null },
  { ...BIRTH, timePrecision: "interval", timeValue: null, timeStart: "09:00", timeEnd: "11:00" },
  { ...BIRTH, timePrecision: "interval", timeValue: null, timeStart: "09:00", timeEnd: "09:00:01" },
  { ...BIRTH, timePrecision: "interval", timeValue: null, timeStart: "00:00", timeEnd: "00:00:01" }
]) {
  test(`birth prevalidation accepts ${input.timePrecision}, ${input.timeValue ?? input.timeStart ?? "no hour"}`, () => {
    const before = structuredClone(input);
    assert.doesNotThrow(() => assertPublicReadingInput(input));
    assert.deepEqual(input, before, "validation must not invent or rewrite birth data");
  });
}

for (const [label, input] of [
  ["impossible date", { ...BIRTH, birthDate: "1990-02-30" }],
  ["invalid precision", { ...BIRTH, timePrecision: "invented" }],
  ["invalid approximate margin", { ...BIRTH, timePrecision: "approximate", timeMarginMinutes: 0 }],
  ["nonexistent local hour", { ...BIRTH, birthDate: "2026-03-29", timeValue: "02:30" }],
  ["ambiguous local hour", { ...BIRTH, birthDate: "2026-10-25", timeValue: "02:30" }]
]) {
  test(`birth prevalidation rejects ${label} before any provider`, () => assert.throws(() => assertPublicReadingInput(input), invalidInput));
}

async function fixture(run) {
  const savedEnv = { ...process.env }, originalFetch = globalThis.fetch;
  for (const key of Object.keys(process.env)) if (/^(?:ASTROLAB_|STRIPE_|BREVO_|OPENAI_|ANTHROPIC_|GEMINI_|GOOGLE_)|^(?:NODE_ENV|PUBLIC_BASE_URL)$/.test(key)) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: "development", STRIPE_SECRET_KEY: "sk_test_offline_fixture", STRIPE_PUBLISHABLE_KEY: "pk_test_offline_fixture",
    ASTROLAB_LLM_API_KEY: "offline-fixture", ASTROLAB_LLM_BASE_URL: "https://writer.example.test/v1", ASTROLAB_TEST_CODE: SHARED_CODE });
  const store = new JsonStore(null), calls = { checkout: 0, paymentReads: 0, writer: 0, email: 0, unexpected: 0 };
  const metadata = { purpose: READING_PURPOSE, pricing: LASTRO_PRICING_VERSION, pricing_base_cents: "1800", pricing_total_cents: "1800", pricing_discount_cents: "0", pricing_currency: "eur" };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return originalFetch(input, init);
    if (url.hostname === "api.stripe.com" && url.pathname === "/v1/checkout/sessions" && init.method === "POST") {
      calls.checkout++;
      return new Response(JSON.stringify({ id: "cs_test_offline_created", client_secret: "cs_test_offline_secret", payment_status: "unpaid" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.hostname === "api.stripe.com" && url.pathname === "/v1/checkout/sessions/cs_test_offline_paid" && (!init.method || init.method === "GET")) {
      calls.paymentReads++;
      return new Response(JSON.stringify({ id: "cs_test_offline_paid", status: "complete", payment_status: "paid", amount_total: 1800, currency: "eur", metadata }), { status: 200, headers: { "content-type": "application/json" } });
    }
    calls.unexpected++;
    assert.fail(`unexpected external request in offline birth-input test: ${url.hostname}`);
  };
  const app = createApp({ store, outboxMaintenance: false, backgroundReadingJobs: false,
    publicReadingWriter: async () => { calls.writer++; assert.fail("invalid input must never reach the writer"); },
    invitationEmailSender: async () => { calls.email++; assert.fail("no invitation should be sent by birth validation"); } });
  await new Promise((resolve, reject) => { app.server.once("error", reject); app.server.listen(0, "127.0.0.1", resolve); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (path, body) => {
    const res = await originalFetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  try { await run({ store, calls, post }); }
  finally {
    await new Promise(resolve => app.server.close(resolve));
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
}

function rejected(response) {
  assert.equal(response.status, 400);
  assert.equal(response.data.code, "INVALID_READING_INPUT");
  assert.ok(response.data.error);
  assert.doesNotMatch(JSON.stringify(response.data), /generation_failed|sk_test_|offline_secret/);
}

test("invalid hours cannot consume a single-use code, create a dossier or enqueue mail", async () => fixture(async ({ store, calls, post }) => {
  const [code] = createAccessCodes(await store.load(), { count: 1 });
  const before = JSON.stringify(await store.load());
  for (const { input } of INVALID_INPUTS) rejected(await post("/api/public/readings", { ...input, accessCode: code.code, deliveryEmail: EMAIL }));
  assert.equal(JSON.stringify(await store.load()), before);
  assert.equal(countUsableAccessCodes(await store.load()), 1);
  assert.deepEqual(calls, { checkout: 0, paymentReads: 0, writer: 0, email: 0, unexpected: 0 });
}));

test("invalid hours preserve the reserved code and personal free invitation", async () => fixture(async ({ store, calls, post }) => {
  const state = await store.load();
  const [code] = createAccessCodes(state, { count: 1, codeLength: 12, usageLimit: 1 });
  state.accessCodes[0].emailInvitationId = "inv_offline_fixture";
  state.emailInvitations = [{ id: "inv_offline_fixture", kind: "free", tokenHash: sha(INVITATION_TOKEN), recipientEmail: EMAIL,
    accessCodeId: code.id, usedAt: null, revokedAt: null, language: "fr" }];
  const before = JSON.stringify(state);
  for (const { input } of INVALID_INPUTS) rejected(await post("/api/public/readings", { ...input, invitationToken: INVITATION_TOKEN, deliveryEmail: EMAIL }));
  assert.equal(JSON.stringify(await store.load()), before);
  assert.deepEqual(calls, { checkout: 0, paymentReads: 0, writer: 0, email: 0, unexpected: 0 });
}));

test("invalid hours do not spend the shared owner's five-reading quota", async () => fixture(async ({ store, calls, post }) => {
  for (let i = 0; i < 6; i++) rejected(await post("/api/public/readings", { ...BIRTH, timeValue: null, testCode: SHARED_CODE, deliveryEmail: EMAIL }));
  assert.equal((await store.load()).publicReadings.length, 0);
  for (let i = 0; i < 5; i++) {
    assert.equal((await post("/api/public/readings", { ...BIRTH, testCode: SHARED_CODE, deliveryEmail: EMAIL })).status, 202);
  }
  assert.equal((await post("/api/public/readings", { ...BIRTH, testCode: SHARED_CODE, deliveryEmail: EMAIL })).status, 429);
  assert.equal((await store.load()).publicReadings.length, 5);
  assert.equal((await store.load()).outbox.length, 0);
  assert.deepEqual(calls, { checkout: 0, paymentReads: 0, writer: 0, email: 0, unexpected: 0 });
}));

test("checkout rejects missing or invalid readingInput before any Stripe request", async () => fixture(async ({ store, calls, post }) => {
  const quote = { expectedTotalCents: 1800, expectedCurrency: "eur" };
  const before = JSON.stringify(await store.load());
  rejected(await post("/api/public/checkout-session", quote));
  for (const { input } of INVALID_INPUTS) rejected(await post("/api/public/checkout-session", { ...quote, readingInput: input }));
  assert.equal(JSON.stringify(await store.load()), before);
  assert.deepEqual(calls, { checkout: 0, paymentReads: 0, writer: 0, email: 0, unexpected: 0 });
}));

test("a personal discount checkout also rejects an invalid hour without consuming its invitation", async () => fixture(async ({ store, calls, post }) => {
  const state = await store.load();
  state.emailInvitations = [{ id: "inv_offline_discount", kind: "discount10", tokenHash: sha(INVITATION_TOKEN), recipientEmail: EMAIL,
    stripePromotionCodeId: "promo_offline_fixture", usedAt: null, revokedAt: null, language: "fr" }];
  const before = JSON.stringify(state);
  rejected(await post("/api/public/checkout-session", { invitationToken: INVITATION_TOKEN, expectedTotalCents: 800,
    expectedCurrency: "eur", readingInput: { ...BIRTH, timeValue: null } }));
  assert.equal(JSON.stringify(await store.load()), before);
  assert.deepEqual(calls, { checkout: 0, paymentReads: 0, writer: 0, email: 0, unexpected: 0 });
}));

test("valid midnight and unknown-hour inputs retain the normal checkout path with simulated Stripe", async () => fixture(async ({ store, calls, post }) => {
  for (const readingInput of [{ ...BIRTH, timeValue: "00:00" }, { ...BIRTH, timePrecision: "unknown", timeValue: null }]) {
    const result = await post("/api/public/checkout-session", { expectedTotalCents: 1800, expectedCurrency: "eur", readingInput });
    assert.equal(result.status, 201);
  }
  assert.equal(calls.checkout, 2);
  assert.equal(calls.writer, 0);
  assert.equal(calls.email, 0);
  assert.equal(calls.unexpected, 0);
  assert.equal((await store.load()).publicReadings.length, 0);
  assert.equal((await store.load()).outbox.length, 0);
}));

test("a verified simulated payment still cannot create a dossier from an invalid birth hour", async () => fixture(async ({ store, calls, post }) => {
  rejected(await post("/api/public/readings", { ...BIRTH, timeValue: null, paymentSessionId: "cs_test_offline_paid", deliveryEmail: EMAIL }));
  assert.equal((await store.load()).publicReadings.length, 0);
  assert.equal((await store.load()).outbox.length, 0);
  assert.equal(calls.checkout, 0);
  assert.equal(calls.writer, 0);
  assert.equal(calls.email, 0);
  assert.equal(calls.unexpected, 0);
}));

test("unknown hour remains a legitimate offered reading and consumes its code only once", async () => fixture(async ({ store, calls, post }) => {
  const [code] = createAccessCodes(await store.load(), { count: 1 });
  const body = { ...BIRTH, timePrecision: "unknown", timeValue: null, accessCode: code.code, deliveryEmail: EMAIL };
  assert.equal((await post("/api/public/readings", body)).status, 202);
  assert.equal(countUsableAccessCodes(await store.load()), 0);
  assert.equal((await post("/api/public/readings", body)).status, 409);
  const state = await store.load();
  assert.equal(state.publicReadings.length, 1);
  assert.equal(state.publicReadings[0].input.timePrecision, "unknown");
  assert.equal(state.publicReadings[0].input.timeValue, null);
  assert.equal(state.outbox.length, 0);
  assert.deepEqual(calls, { checkout: 0, paymentReads: 0, writer: 0, email: 0, unexpected: 0 });
}));

test("retrying an old invalid dossier is rejected without a new attempt or failure notification", async () => fixture(async ({ store, calls, post }) => {
  const { delivery } = await createPaidDelivery(store, { email: EMAIL, freeAccess: true, input: { ...BIRTH, timeValue: null } });
  await markDeliveryFailed(store, delivery.id, "Missing required field: timeValue", "generation_failed");
  const before = JSON.stringify(await store.load());
  rejected(await post(`/api/public/deliveries/${delivery.token}/regenerate`, {}));
  assert.equal(JSON.stringify(await store.load()), before, "rejected retries must preserve status, attempts, error and outbox");
  assert.deepEqual(calls, { checkout: 0, paymentReads: 0, writer: 0, email: 0, unexpected: 0 });
}));

test("retrieving an already-ready paid dossier needs no new birth input, checkout, generation or notification", async () => fixture(async ({ store, calls, post }) => {
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_test_offline_paid", email: EMAIL,
    amountCents: 1800, currency: "eur", input: BIRTH });
  await markDeliveryReady(store, delivery.id, { html: "<p>Already completed fictional reading</p>", markdown: "Already completed fictional reading" });
  const before = JSON.stringify(await store.load());
  const response = await post("/api/public/readings", { paymentSessionId: "cs_test_offline_paid", deliveryEmail: EMAIL });
  assert.equal(response.status, 200);
  assert.equal(response.data.status, "delivered");
  assert.equal(response.data.delivery.reference, delivery.reference);
  const retry = await post(`/api/public/deliveries/${delivery.token}/regenerate`, {});
  assert.equal(retry.status, 200);
  assert.equal(retry.data.delivery.reference, delivery.reference);
  assert.equal(JSON.stringify(await store.load()), before);
  assert.deepEqual(calls, { checkout: 0, paymentReads: 0, writer: 0, email: 0, unexpected: 0 });
}));
