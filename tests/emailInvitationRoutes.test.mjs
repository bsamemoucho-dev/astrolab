import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { LASTRO_PRICING_VERSION, READING_PURPOSE } from "../src/payments/pricing.mjs";

const BATCH = "11111111-1111-4111-8111-111111111111";
const HEADERS = { cookie: "astrolab_session=token-admin", "x-astrolab-admin-action": "send-email-invitation" };
const birth = { firstName: "Exemple fictif", birthDate: "1990-01-15", timePrecision: "exact", timeValue: "12:30", language: "fr",
  birthPlace: { label: "Paris, France", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris" } };
const sha = s => createHash("sha256").update(s).digest("hex");
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const waitFor = async (check) => {
  for (let i = 0; i < 150; i++) { const result = await check(); if (result) return result; await new Promise(r => setTimeout(r, 10)); }
  assert.fail("local asynchronous operation did not finish");
};

async function fixture(run, { writer = true, stockError = false, background = false, providerError = false } = {}) {
  const savedEnv = { ...process.env }, savedFetch = globalThis.fetch;
  for (const key of Object.keys(process.env)) if (/STRIPE|BREVO|ASTROLAB_(LLM|PROMO|PRICE|TEST_CODE)|OPENAI|PUBLIC_BASE_URL/.test(key)) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: "development", PUBLIC_BASE_URL: "https://www.lastro.fr",
    BREVO_API_KEY: "fake", BREVO_SENDER_EMAIL: "sender@example.test", STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_PUBLISHABLE_KEY: "pk_test_fake" });
  if (writer) Object.assign(process.env, { ASTROLAB_LLM_API_KEY: "fake", ASTROLAB_LLM_BASE_URL: "https://writer.example.test/v1" });
  const store = new JsonStore(null), messages = [], sessions = new Map();
  const counters = { checkoutCreates: 0, promotionReads: 0, otherBrevoSends: 0 };
  const promotion = { id: "promo_fixture", object: "promotion_code", code: "ZX7Q2K", active: true, livemode: false,
    max_redemptions: 1, times_redeemed: 0, customer: null, expires_at: null,
    metadata: { purpose: "lastro_reading_discount", batch_id: BATCH },
    restrictions: { first_time_transaction: false, minimum_amount: null, minimum_amount_currency: null },
    coupon: { id: "lstr_d10_" + BATCH.replaceAll("-", ""), object: "coupon", amount_off: 1000, currency: "eur", duration: "once",
      valid: true, livemode: false, max_redemptions: 50, times_redeemed: 0, percent_off: null, redeem_by: null,
      metadata: { purpose: "lastro_reading_discount", batch_id: BATCH } } };
  await store.transact(state => {
    for (const [id, role] of [["admin", "admin"], ["member", "user"]]) {
      state.users.push({ id, email: id + "@example.test", emailVerifiedAt: new Date().toISOString(), primaryRole: role, deletedAt: null, createdAt: new Date().toISOString() });
      state.sessions.push({ id: "session-" + id, userId: id, token: "token-" + id, expiresAt: new Date(Date.now() + 3600000).toISOString() });
    }
    state.accessCodes.push({ id: "free-fixture", hash: sha("freefixture1"), codeLength: 12, usageLimit: 1,
      createdAt: new Date().toISOString(), expiresAt: null, usedAt: null, revokedAt: null, deliveryReference: null, batchId: BATCH });
  });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return savedFetch(input, init);
    if (url.hostname === "api.stripe.com" && url.pathname === "/v1/promotion_codes/promo_fixture") {
      if (providerError) throw Error("simulated provider unavailable");
      counters.promotionReads++; return response(promotion);
    }
    if (url.hostname === "api.stripe.com" && url.pathname === "/v1/promotion_codes") {
      return response({ object: "list", has_more: false, data: promotion.active ? [promotion] : [] });
    }
    if (url.hostname === "api.stripe.com" && url.pathname === "/v1/checkout/sessions" && init.method === "POST") {
      counters.checkoutCreates++;
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("line_items[0][price_data][unit_amount]"), "1800");
      assert.equal(body.get("discounts[0][promotion_code]"), "promo_fixture");
      assert.equal(body.get("customer_email"), "reader@example.test");
      assert.match(init.headers["Idempotency-Key"], /^lastro-invitation:inv_/);
      const metadata = {};
      for (const [key, value] of body) { const m = key.match(/^metadata\[(.+)\]$/); if (m) metadata[m[1]] = value; }
      const session = { id: "cs_test_fixture", client_secret: "cs_test_fixture_secret_fake", amount_total: 800, amount_subtotal: 1800,
        total_details: { amount_discount: 1000 }, currency: "eur", payment_status: "unpaid", status: "open", metadata };
      sessions.set(session.id, session); return response(session);
    }
    if (url.hostname === "api.stripe.com" && url.pathname.startsWith("/v1/checkout/sessions/")) {
      return response(sessions.get(url.pathname.split("/").at(-1)), sessions.has(url.pathname.split("/").at(-1)) ? 200 : 404);
    }
    if (url.hostname === "api.brevo.com") { counters.otherBrevoSends++; return response({ messageId: "<fake-reading@example.test>" }, 201); }
    assert.fail("unexpected external request in offline integration test");
  };
  const app = createApp({ store, outboxMaintenance: false, backgroundReadingJobs: background,
    invitationPromotionInventory: async () => { if (stockError) throw Error("offline fixture"); return promotion.active && promotion.times_redeemed === 0 ? [{ id: promotion.id, batchId: BATCH }] : []; },
    invitationEmailSender: async mail => { messages.push(mail); return { providerMessageId: "<fake-invitation@example.test>" }; },
    ...(writer ? { publicReadingWriter: async () => ({ html: "<!doctype html><p>Lecture de test</p>", markdown: "Lecture de test", writerMode: "test", language: "fr", dossier: { generatedSectionCount: 1 } }) } : {}) });
  await new Promise(resolve => app.server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + app.server.address().port;
  const post = async (path, body, headers = {}) => {
    const res = await savedFetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    return { status: res.status, headers: res.headers, data: await res.json() };
  };
  const invite = async (kind = "free") => {
    const result = await post("/api/admin/email-invitations", { email: "reader@example.test", kind, language: "fr", requestId: randomUUID() }, HEADERS);
    assert.equal(result.status, 202);
    const mail = await waitFor(() => messages.at(-1));
    const token = mail.text.match(/#invitation=([A-Za-z0-9_-]{43})/)[1];
    return { result, token, mail };
  };
  try { await run({ store, base, post, invite, messages, promotion, sessions, counters, savedFetch }); }
  finally {
    await new Promise(resolve => app.server.close(resolve)); globalThis.fetch = savedFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]; Object.assign(process.env, savedEnv);
  }
}

test("invitation admin requires the existing admin role and same-origin explicit action", async () => fixture(async ({ post, base, savedFetch, store }) => {
  const input = { email: "reader@example.test", kind: "free", requestId: randomUUID() };
  assert.equal((await post("/api/admin/email-invitations", input)).status, 401);
  assert.equal((await post("/api/admin/email-invitations", input, { ...HEADERS, cookie: "astrolab_session=token-member" })).status, 403);
  assert.equal((await post("/api/admin/email-invitations", input, { cookie: HEADERS.cookie })).status, 403);
  assert.equal((await post("/api/admin/email-invitations", input, { ...HEADERS, origin: "https://elsewhere.example" })).status, 403);
  assert.equal((await savedFetch(base + "/rouflaquette/invitations")).status, 401);
  const page = await savedFetch(base + "/rouflaquette/invitations", { headers: { cookie: HEADERS.cookie } });
  assert.equal(page.status, 200); assert.match(page.headers.get("cache-control"), /no-store/);
  assert.match(page.headers.get("x-robots-tag"), /noindex/);
  assert.equal((await store.load()).outbox.length, 0);
}));

test("admin sends one QR invitation and opening/reloading never consumes it", async () => fixture(async ({ invite, post, base, savedFetch, store, messages }) => {
  const { token, result } = await invite();
  assert.equal(result.data.invitation.kind, "free");
  assert.ok(!JSON.stringify(result.data).includes(token));
  const duplicate = await post("/api/admin/email-invitations", { email: " READER@example.test ", kind: "free", requestId: randomUUID() }, HEADERS);
  assert.equal(duplicate.status, 200); assert.equal(duplicate.data.created, false);
  for (let i = 0; i < 2; i++) {
    const opened = await post("/api/public/invitations/resolve", { token });
    assert.equal(opened.status, 200); assert.equal(opened.data.invitation.quote.totalCents, 0);
    assert.equal(opened.data.invitation.recipientEmail, "reader@example.test");
    assert.match(opened.headers.get("cache-control"), /no-store/);
  }
  const state = await store.load(); assert.equal(state.publicReadings.length, 0); assert.equal(state.accessCodes[0].usedAt, null);
  assert.equal(messages.length, 1); assert.equal(messages[0].attachments.length, 1);
  const stats = await savedFetch(base + "/api/admin/email-invitations", { headers: { cookie: HEADERS.cookie } }).then(r => r.json());
  assert.equal(stats.invitations.length, 1); assert.equal(stats.inventory.freeAvailable, 0);
  assert.equal(stats.invitations[0].mail.status, "sent"); assert.ok(!JSON.stringify(stats).includes(token));
}));

test("a free link rejects another recipient and malformed birth data, then creates one dossier under concurrency", async () => fixture(async ({ invite, post, store }) => {
  const { token } = await invite();
  const wrong = await post("/api/public/readings", { ...birth, invitationToken: token, deliveryEmail: "other@example.test" });
  assert.equal(wrong.status, 403);
  assert.equal((await post("/api/public/readings", { invitationToken: token, deliveryEmail: "reader@example.test" })).status, 400);
  assert.equal((await store.load()).accessCodes[0].usedAt, null);
  const body = { ...birth, invitationToken: token, deliveryEmail: "reader@example.test" };
  const pair = await Promise.all([post("/api/public/readings", body), post("/api/public/readings", body)]);
  assert.ok(pair.every(r => r.status === 202)); assert.equal(pair[0].data.readingId, pair[1].data.readingId);
  const state = await store.load(); assert.equal(state.publicReadings.length, 1);
  assert.equal(state.publicReadings[0].amountCents, 0); assert.equal(state.publicReadings[0].currency, "eur");
  assert.ok(state.emailInvitations[0].usedAt); assert.ok(state.accessCodes[0].usedAt);
  const used = await post("/api/public/invitations/resolve", { token });
  assert.equal(used.data.invitation.status, "used"); assert.match(used.data.invitation.delivery.link, /^https:\/\/www\.lastro\.fr\/r\//);
}));

test("discount links show 8 EUR, reuse one checkout and recover a paid session after Stripe consumes the promotion", async () => fixture(async ({ invite, post, promotion, sessions, counters, store, base, savedFetch }) => {
  const { token } = await invite("discount10");
  const open = await post("/api/public/invitations/resolve", { token });
  assert.equal(open.data.invitation.quote.totalCents, 800);
  const quote = await post("/api/public/price-quote", { invitationToken: token });
  assert.equal(quote.data.quote.discountCents, 1000);
  const body = { invitationToken: token, expectedTotalCents: 800, expectedCurrency: "eur", language: "fr" };
  assert.equal((await post("/api/public/checkout-session", { ...body, expectedTotalCents: 1800 })).status, 409);
  const pair = await Promise.all([post("/api/public/checkout-session", body), post("/api/public/checkout-session", body)]);
  assert.ok(pair.every(r => r.status === 201)); assert.equal(counters.checkoutCreates, 1);
  assert.equal(pair[0].data.sessionId, pair[1].data.sessionId);
  const session = sessions.get(pair[0].data.sessionId); session.payment_status = "paid"; session.status = "complete";
  session.customer_details = { email: "payer@example.test" }; promotion.times_redeemed = 1;
  const reads = counters.promotionReads;
  const resumed = await post("/api/public/invitations/resolve", { token });
  assert.equal(resumed.data.invitation.paymentConfirmed, true); assert.equal(resumed.data.invitation.quote.totalCents, 800);
  assert.equal(counters.promotionReads, reads);
  const tracking = await savedFetch(base + "/api/admin/email-invitations", { headers: { cookie: HEADERS.cookie } }).then(r => r.json());
  assert.equal(tracking.invitations[0].usage.status, "payment_confirmed");
  assert.equal(tracking.invitations[0].usedAt, null);
  assert.equal((await post("/api/public/checkout-session", body)).data.sessionId, session.id); assert.equal(counters.checkoutCreates, 1);
  const readingBody = { ...birth, invitationToken: token, deliveryEmail: "reader@example.test", paymentSessionId: session.id };
  assert.equal((await post("/api/public/readings", { ...readingBody, invitationToken: undefined })).status, 403);
  const created = await Promise.all([post("/api/public/readings", readingBody), post("/api/public/readings", readingBody)]);
  assert.ok(created.every(r => r.status === 202)); assert.equal(created[0].data.readingId, created[1].data.readingId);
  assert.equal((await store.load()).publicReadings.length, 1); assert.equal((await store.load()).publicReadings[0].amountCents, 800);
}));

test("unavailable promotions, invalid tokens and mixed advantages never fall back to 18 EUR", async () => fixture(async ({ invite, post, promotion, counters, store }) => {
  const { token } = await invite("discount10"); promotion.active = false;
  const resolved = await post("/api/public/invitations/resolve", { token });
  assert.equal(resolved.data.invitation.status, "unavailable"); assert.equal(resolved.data.invitation.quote, null);
  assert.equal((await post("/api/public/price-quote", { invitationToken: token })).status, 409);
  assert.equal((await post("/api/public/checkout-session", { invitationToken: token, expectedTotalCents: 800, expectedCurrency: "eur" })).status, 409);
  assert.equal((await post("/api/public/price-quote", { invitationToken: token, promoCode: "ZX7Q2K" })).status, 400);
  assert.equal((await post("/api/public/invitations/resolve", { token: "A".repeat(43) })).status, 404);
  assert.equal(counters.checkoutCreates, 0); assert.equal((await store.load()).publicReadings.length, 0);
}));

test("invitation resolution is bounded before hash lookups", async () => fixture(async ({ post, store }) => {
  for (let i = 0; i < 30; i++) assert.equal((await post("/api/public/invitations/resolve", { token: "A".repeat(43) })).status, 404);
  const last = await post("/api/public/invitations/resolve", { token: "A".repeat(43) });
  assert.equal(last.status, 429); assert.ok(Number(last.headers.get("retry-after")) > 0);
  assert.equal((await store.load()).publicReadings.length, 0);
}));

test("provider stock failure disables discounts without inventing stock or preventing a free invitation", async () => fixture(async ({ base, savedFetch, post, store }) => {
  const list = await savedFetch(base + "/api/admin/email-invitations", { headers: { cookie: HEADERS.cookie } }).then(r => r.json());
  assert.equal(list.inventory.freeAvailable, 1); assert.equal(list.inventory.discountAvailable, null); assert.ok(list.stockWarning);
  assert.equal((await post("/api/admin/email-invitations", { email: "reader@example.test", kind: "discount10", requestId: randomUUID() }, HEADERS)).status, 503);
  assert.equal((await store.load()).emailInvitations?.length ?? 0, 0);
  assert.equal((await post("/api/admin/email-invitations", { email: "reader@example.test", kind: "free", requestId: randomUUID() }, HEADERS)).status, 202);
}, { stockError: true }));

test("seasonal welcome endpoint uses a real calculation and no provider or LLM", async () => fixture(async ({ base, savedFetch, counters }) => {
  const r = await savedFetch(base + "/api/public/seasonal-sky"), data = await r.json();
  assert.equal(r.status, 200); assert.equal(data.zodiac, "tropical"); assert.equal(data.referenceTimeZone, "Europe/Paris");
  assert.ok(Number.isFinite(data.sun.longitude)); assert.equal(counters.promotionReads, 0); assert.equal(counters.checkoutCreates, 0);
}));

test("an assigned clear gift code still works for its bound recipient and refuses another address", async () => fixture(async ({ invite, post, store }) => {
  await invite();
  const wrong = await post("/api/public/readings", { ...birth, accessCode: "freefixture1", deliveryEmail: "other@example.test" });
  assert.equal(wrong.status, 403); assert.equal((await store.load()).publicReadings.length, 0);
  const right = await post("/api/public/readings", { ...birth, accessCode: "freefixture1", deliveryEmail: "reader@example.test" });
  assert.equal(right.status, 202);
  const state = await store.load(); assert.equal(state.publicReadings.length, 1);
  assert.equal(state.publicReadings[0].amountCents, 0); assert.equal(state.publicReadings[0].currency, "eur");
  assert.ok(state.emailInvitations[0].usedAt); assert.equal(state.emailInvitations[0].deliveryId, state.publicReadings[0].id);
}));

test("a native reduction assigned by e-mail requires its personal link while unassigned codes keep their ordinary quote", async () => fixture(async ({ invite, post, counters }) => {
  assert.equal((await post("/api/public/price-quote", { promoCode: "ZX7Q2K" })).data.quote.totalCents, 800);
  await invite("discount10");
  const result = await post("/api/public/price-quote", { promoCode: "ZX7Q2K" });
  assert.equal(result.status, 403); assert.equal(result.data.code, "INVITATION_LINK_REQUIRED");
  assert.equal(counters.checkoutCreates, 0);
}));

test("provider failures never put an invitation or arbitrary query capability in technical logs", async () => fixture(async ({ invite, post, counters }) => {
  const { token } = await invite("discount10"); const savedError = console.error, savedWarn = console.warn; const logs = [];
  console.error = (...parts) => logs.push(parts.join(" ")); console.warn = (...parts) => logs.push(parts.join(" "));
  try {
    const result = await post("/api/public/invitations/resolve?invitation=PRIVATE_QUERY_CAPABILITY", { token });
    assert.equal(result.status, 503); assert.equal(counters.checkoutCreates, 0);
    assert.ok(!JSON.stringify(logs).includes(token)); assert.ok(!JSON.stringify(logs).includes("PRIVATE_QUERY_CAPABILITY"));
  } finally { console.error = savedError; console.warn = savedWarn; }
}, { providerError: true }));

test("a new free invitation is not consumed when the writer is unavailable", async () => fixture(async ({ invite, post, store }) => {
  const { token } = await invite();
  const result = await post("/api/public/readings", { ...birth, invitationToken: token, deliveryEmail: "reader@example.test" });
  assert.equal(result.status, 503); assert.equal(result.data.code, "writer_unavailable");
  assert.equal((await store.load()).publicReadings.length, 0); assert.equal((await store.load()).accessCodes[0].usedAt, null);
}, { writer: false }));

test("the free invitation reaches a completed dossier with the simulated writer and sends one delivery notice", async () => fixture(async ({ invite, post, store, counters }) => {
  const { token } = await invite();
  const result = await post("/api/public/readings", { ...birth, invitationToken: token, deliveryEmail: "reader@example.test" });
  assert.equal(result.status, 202);
  const state = await waitFor(async () => { const s = await store.load(); return s.publicReadings[0]?.status === "ready" && s; });
  assert.equal(state.publicReadings.length, 1); assert.match(state.publicReadings[0].reading.html, /Lecture de test/);
  await waitFor(() => counters.otherBrevoSends === 1);
  const duplicate = await post("/api/public/readings", { ...birth, invitationToken: token, deliveryEmail: "reader@example.test" });
  assert.equal(duplicate.status, 202); assert.equal((await store.load()).publicReadings.length, 1);
  assert.equal(counters.checkoutCreates, 0); assert.equal(counters.otherBrevoSends, 1);
}, { background: true }));
