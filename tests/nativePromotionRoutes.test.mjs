import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { checkoutSessionProblem } from "../src/payments/pricing.mjs";
import { hashAccessCode } from "../src/models/accessCodeService.mjs";

// Fictional provider objects only. No key or code in this file is provisioned.
const CODE = "FAKECODE1200";
const BATCH = "11111111-1111-4111-8111-111111111111";
const PROMO = "promo_fake_route";
function promotion(code = CODE) {
  return {
    object: "promotion_code", id: PROMO, code, active: true, livemode: false,
    max_redemptions: 1, times_redeemed: 0, customer: null, expires_at: null,
    metadata: { purpose: "lastro_reading_discount", batch_id: BATCH },
    restrictions: { first_time_transaction: false },
    coupon: {
      object: "coupon", id: "coupon_fake_route", valid: true, livemode: false,
      amount_off: 1000, currency: "eur", duration: "once", percent_off: null,
      max_redemptions: 50, times_redeemed: 0, redeem_by: null, applies_to: null,
      metadata: { purpose: "lastro_reading_discount", batch_id: BATCH }
    }
  };
}
function session() {
  return { id: "cs_test_fake_route", client_secret: "cs_test_fake_route_secret_fake",
    amount_subtotal: 1800, amount_total: 800, total_details: { amount_discount: 1000 }, currency: "eur" };
}
async function fixture(run, provider) {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_CURRENCY", "ASTROLAB_PRICE_CENTS",
    "ASTROLAB_PROMO_CODE", "ASTROLAB_PROMO_CODES", "ASTROLAB_PROMO_DISCOUNT_CENTS", "ASTROLAB_LLM_API_KEY", "ASTROLAB_LLM_BASE_URL"];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_FAKEroute123", STRIPE_PUBLISHABLE_KEY: "pk_test_FAKEroute123",
    ASTROLAB_LLM_API_KEY: "fake-test-key", ASTROLAB_LLM_BASE_URL: "https://writer.invalid/v1" });
  const original = globalThis.fetch;
  const calls = [];
  let current = promotion();
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).startsWith("https://api.stripe.com/")) return original(url, init);
    const request = { url: String(url), method: init.method ?? "GET", body: Object.fromEntries(new URLSearchParams(init.body)), headers: init.headers };
    calls.push(request);
    const custom = provider ? await provider(request, calls) : null;
    if (custom) return { ok: custom.ok !== false, status: custom.status ?? 200, json: async () => custom.payload };
    return { ok: true, status: 200, json: async () => request.method === "GET"
      ? { object: "list", data: current ? [current] : [], has_more: false } : session() };
  };
  const { server, store } = createApp({ store: new JsonStore(null), outboxMaintenance: false, backgroundReadingJobs: false, complementEnabled: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body, headers = {}) => {
    const response = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    return { status: response.status, headers: response.headers, payload: await response.json() };
  };
  try { await run({ post, store, calls, setPromotion: value => { current = value; } }); }
  finally {
    await new Promise(resolve => server.close(resolve));
    globalThis.fetch = original;
    for (const key of keys) saved[key] === undefined ? delete process.env[key] : process.env[key] = saved[key];
  }
}

test("public native quote is 18 minus 10 EUR and exposes no private code, provider ID or customer state", async () => {
  await fixture(async ({ post, store, calls }) => {
    const before = JSON.stringify(await store.load());
    const result = await post("/api/public/price-quote", { promoCode: CODE });
    assert.equal(result.status, 200);
    assert.equal(result.payload.quote.valid, true);
    assert.equal(result.payload.quote.baseCents, 1800);
    assert.equal(result.payload.quote.discountCents, 1000);
    assert.equal(result.payload.quote.totalCents, 800);
    assert.equal(result.payload.quote.currency, "eur");
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(JSON.stringify(result.payload), /FAKECODE1200|promo_fake_route|sk_test|coupon_fake_route/i);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].headers["Stripe-Version"], "2024-06-20");
    assert.equal(JSON.stringify(await store.load()), before);
  });
});

test("native checkout binds its server snapshot to 8 EUR and applies the verified promotion to an 18 EUR line", async () => {
  await fixture(async ({ post, calls }) => {
    const result = await post("/api/public/checkout-session", { promoCode: CODE, expectedTotalCents: 800, expectedCurrency: "eur",
      amountCents: 1, stripePromotionCodeId: "promo_attacker", baseAmountCents: 1, metadata: { pricing_total_cents: "1" } });
    assert.equal(result.status, 201);
    const created = calls.find(call => call.method === "POST");
    assert.ok(created);
    assert.equal(created.body["line_items[0][price_data][unit_amount]"], "1800");
    assert.equal(created.body["discounts[0][promotion_code]"], PROMO);
    assert.equal(created.body["metadata[pricing_base_cents]"], "1800");
    assert.equal(created.body["metadata[pricing_total_cents]"], "800");
    assert.equal(created.body["metadata[pricing_discount_cents]"], "1000");
    assert.equal(created.body["metadata[pricing_currency]"], "eur");
    assert.equal(created.body.allow_promotion_codes, "false");
    assert.doesNotMatch(JSON.stringify(created.body), /FAKECODE1200|promo_attacker/i);
    // A completed payment keeps its immutable snapshot after redemption.
    const metadata = Object.fromEntries(Object.entries(created.body).filter(([key]) => key.startsWith("metadata[")).map(([key, value]) => [key.slice(9, -1), value]));
    assert.equal(checkoutSessionProblem({ ...session(), metadata }), null);
    assert.equal(checkoutSessionProblem({ ...session(), metadata, amount_total: 1800 }), "amount_mismatch");
  });
});

test("a stale or malformed displayed quote cannot create a Checkout session", async () => {
  await fixture(async ({ post, calls }) => {
    let result = await post("/api/public/checkout-session", { promoCode: CODE, expectedTotalCents: 1800, expectedCurrency: "eur" });
    assert.equal(result.status, 409);
    assert.equal(result.payload.code, "PRICING_CHANGED");
    assert.equal(result.payload.quote.totalCents, 800);
    assert.doesNotMatch(JSON.stringify(result.payload), /promo_fake_route|FAKECODE1200/i);
    result = await post("/api/public/checkout-session", { promoCode: CODE, expectedTotalCents: "800", expectedCurrency: "eur" });
    assert.equal(result.status, 400);
    result = await post("/api/public/checkout-session", { promoCode: CODE, expectedTotalCents: 800, expectedCurrency: "usd" });
    assert.equal(result.status, 409);
    assert.equal(calls.some(call => call.method === "POST"), false);
  });
});

test("a code consumed between quote and checkout blocks payment without falling back to 18 EUR", async () => {
  await fixture(async ({ post, setPromotion, calls }) => {
    assert.equal((await post("/api/public/price-quote", { promoCode: CODE })).payload.quote.totalCents, 800);
    const redeemed = promotion(); redeemed.times_redeemed = 1; redeemed.active = false; setPromotion(redeemed);
    const result = await post("/api/public/checkout-session", { promoCode: CODE, expectedTotalCents: 800, expectedCurrency: "eur" });
    assert.equal(result.status, 400);
    assert.equal(result.payload.code, "unknown_promo_code");
    assert.equal(calls.some(call => call.method === "POST"), false);
  });
});

test("Stripe rejection after revalidation remains blocking and masks provider text", async () => {
  await fixture(async ({ post, calls }) => {
    const result = await post("/api/public/checkout-session", { promoCode: CODE });
    assert.ok(result.status >= 400);
    assert.equal(calls.filter(call => call.method === "POST").length, 1);
    assert.doesNotMatch(JSON.stringify(result.payload), /FAKECODE1200|private-provider-text|sk_test/i);
  }, request => request.method === "POST" ? { ok: false, status: 400, payload: { error: { type: "invalid_request_error", param: "discounts[0][promotion_code]", code: "promotion_code_expired", message: `private-provider-text ${CODE}` } } } : null);
});

test("provider unavailability never opens a full-price payment or leaks its message", async () => {
  const logged = [];
  const originalError = console.error;
  console.error = (...parts) => logged.push(parts.join(" "));
  try { await fixture(async ({ post, calls }) => {
    const result = await post("/api/public/checkout-session?private=" + CODE, { promoCode: CODE });
    assert.equal(result.status, 503);
    assert.equal(result.payload.code, "PROMOTION_PROVIDER_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(result.payload), /FAKECODE1200|private-provider-text|sk_test/i);
    assert.equal(calls.some(call => call.method === "POST"), false);
    const normal = await post("/api/public/price-quote", {});
    assert.equal(normal.status, 200);
    assert.equal(normal.payload.quote.totalCents, 1800);
  }, () => { throw new Error(`private-provider-text ${CODE}`); });
    assert.doesNotMatch(logged.join("\n"), /FAKECODE1200|private-provider-text|sk_test|\?private=/i);
  } finally { console.error = originalError; }
});

test("non-string promotion inputs are rejected without any provider call", async () => {
  await fixture(async ({ post, calls }) => {
    for (const promoCode of [{ code: CODE }, [CODE], 123456789012, true, "X".repeat(201)]) {
      const result = await post("/api/public/price-quote", { promoCode });
      assert.equal(result.status, 400);
    }
    assert.equal(calls.length, 0);
  });
});

for (const code of [CODE, "ZX7Q2K"])
test(`native ${code.length}-character lookup quotas cover both endpoints and aliases without blocking the normal price`, async () => {
  await fixture(async ({ post, calls, setPromotion }) => {
    setPromotion(null);
    for (let i = 0; i < 30; i++) {
      const alias = i % 2 ? code.toLowerCase().slice(0, 3) + "- " + code.toLowerCase().slice(3) : code;
      assert.equal((await post("/api/public/price-quote", { promoCode: alias })).status, 200);
    }
    const blocked = await post("/api/public/checkout-session", { promoCode: code });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.equal(calls.length, 30);
    assert.equal((await post("/api/public/price-quote", {})).payload.quote.totalCents, 1800);
    assert.equal(calls.length, 30);
  });
});

test("six-character reductions retain the private 8 EUR quote, verified native Checkout and stale-price guard", async () => {
  await fixture(async ({ post, setPromotion, calls, store }) => {
    const code = "ZX7Q2K";
    setPromotion(promotion(code));
    const before = JSON.stringify(await store.load());
    const quote = await post("/api/public/price-quote", { promoCode: "zx-7q 2k" });
    assert.equal(quote.status, 200);
    assert.equal(quote.payload.quote.valid, true);
    assert.equal(quote.payload.quote.totalCents, 800);
    assert.equal(quote.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(JSON.stringify(quote.payload), /ZX7Q2K|promo_fake_route|coupon_fake_route/i);
    const stale = await post("/api/public/checkout-session", { promoCode: code, expectedTotalCents: 1800, expectedCurrency: "eur" });
    assert.equal(stale.status, 409);
    assert.equal(stale.payload.code, "PRICING_CHANGED");
    assert.equal(calls.filter(call => call.method === "POST").length, 0);
    const checkout = await post("/api/public/checkout-session", { promoCode: code, expectedTotalCents: 800, expectedCurrency: "eur" });
    assert.equal(checkout.status, 201);
    const created = calls.find(call => call.method === "POST");
    assert.equal(created.body["line_items[0][price_data][unit_amount]"], "1800");
    assert.equal(created.body["discounts[0][promotion_code]"], PROMO);
    assert.equal(created.body["metadata[pricing_total_cents]"], "800");
    assert.equal(created.body["metadata[pricing_discount_cents]"], "1000");
    assert.equal(JSON.stringify(await store.load()), before);
  });
});

test("a registered short free invitation is never silently reinterpreted as a reduction", async () => {
  await fixture(async ({ post, setPromotion, store, calls }) => {
    const code = "ZX7Q2K";
    await store.transact(state => state.accessCodes.push({ id: "code_existing_gift", hash: hashAccessCode(code), usedAt: null, revokedAt: null, expiresAt: null }));
    setPromotion(null);
    const before = JSON.stringify(await store.load());
    const quote = await post("/api/public/price-quote", { promoCode: code });
    assert.equal(quote.status, 200);
    assert.equal(quote.payload.quote.valid, false);
    const checkout = await post("/api/public/checkout-session", { promoCode: code });
    assert.equal(checkout.status, 400);
    assert.equal(checkout.payload.code, "unknown_promo_code");
    assert.equal(calls.filter(call => call.method === "POST").length, 0);
    assert.equal(JSON.stringify(await store.load()), before);
  });
});

test("short native lookup service quota also bounds changing client addresses before contacting Stripe", async () => {
  await fixture(async ({ post, setPromotion, calls }) => {
    setPromotion(null);
    for (let index = 0; index < 300; index++) {
      const result = await post("/api/public/price-quote", { promoCode: "ZX7Q2K" }, { "x-forwarded-for": "192.0.2." + (Math.floor(index / 25) + 1) });
      assert.equal(result.status, 200);
    }
    const blocked = await post("/api/public/checkout-session", { promoCode: "ZX7Q2K" }, { "x-forwarded-for": "192.0.2.99" });
    assert.equal(blocked.status, 429);
    assert.equal(calls.length, 300);
    assert.equal(calls.some(call => call.method === "POST"), false);
  });
});
