import assert from "node:assert/strict";
import test from "node:test";
import { resolvePromotionQuoteById, STRIPE_PROMOTION_API_VERSION } from "../src/payments/stripePromotionCodes.mjs";
import { createEmbeddedCheckoutSession } from "../src/payments/stripe.mjs";
import { publicQuote } from "../src/payments/pricing.mjs";

const ENV = { STRIPE_SECRET_KEY: "sk_test_FAKE123", STRIPE_PUBLISHABLE_KEY: "pk_test_FAKE123", ASTROLAB_PRICE_CENTS: "1800" };
const BATCH = "11111111-1111-4111-8111-111111111111";
function promotion() {
  return { id: "promo_fixture", object: "promotion_code", code: "ABC234", active: true, livemode: false,
    max_redemptions: 1, times_redeemed: 0, expires_at: null, customer: null,
    metadata: { purpose: "lastro_reading_discount", batch_id: BATCH },
    restrictions: { first_time_transaction: false, minimum_amount: null, minimum_amount_currency: null },
    coupon: { id: "coupon_fixture", object: "coupon", valid: true, livemode: false, duration: "once",
      currency: "eur", amount_off: 1000, percent_off: null, max_redemptions: 50, times_redeemed: 0,
      metadata: { purpose: "lastro_reading_discount", batch_id: BATCH } } };
}
const ok = data => ({ ok: true, json: async () => data });
const lookup = entry => resolvePromotionQuoteById({ promotionCodeId: "promo_fixture", env: ENV, fetchImpl: async () => ok(entry) });

test("server-only promotion-ID lookup preserves policy and actual optional applies_to omission", async () => {
  let calls = 0;
  const quote = await resolvePromotionQuoteById({ promotionCodeId: "promo_fixture", env: ENV, fetchImpl: async (url, init) => {
    calls++; assert.equal(url, "https://api.stripe.com/v1/promotion_codes/promo_fixture");
    assert.equal(init.method, "GET"); assert.equal(init.headers["Stripe-Version"], STRIPE_PROMOTION_API_VERSION);
    assert.equal(init.body, undefined); return ok(promotion());
  } });
  assert.equal(calls, 1); assert.equal(quote.totalCents, 800); assert.equal(quote.baseCents, 1800); assert.equal(quote.discountCents, 1000);
  assert.equal(quote.stripePromotionCodeId, "promo_fixture");
  const publicResult = JSON.stringify(publicQuote(quote));
  assert.ok(!publicResult.includes("promo_fixture")); assert.ok(!publicResult.includes("ABC234")); assert.ok(!publicResult.includes("abc234"));
});

test("server promotion-ID lookup still rejects foreign IDs, used grants and all non-matching coupon terms", async () => {
  const invalid = [p => { p.id = "promo_other"; }, p => { p.times_redeemed = 1; }, p => { p.active = false; },
    p => { p.max_redemptions = 2; }, p => { p.metadata.purpose = "gift"; }, p => { p.customer = "cus_other"; },
    p => { p.coupon.amount_off = 1800; }, p => { p.coupon.currency = "usd"; }, p => { p.coupon.percent_off = 10; },
    p => { p.coupon.applies_to = { products: ["prod_restricted"] }; }, p => { p.coupon.applies_to = "invalid"; },
    p => { p.coupon.metadata.batch_id = "22222222-2222-4222-8222-222222222222"; },
    p => { p.restrictions.first_time_transaction = true; }, p => { p.livemode = true; }];
  for (const mutate of invalid) {
    const entry = promotion(); mutate(entry);
    await assert.rejects(() => lookup(entry), { code: "INVITATION_DISCOUNT_UNAVAILABLE" });
  }
});

test("promotion-ID validation and provider failures never leak keys, codes or exception details", async () => {
  await assert.rejects(() => resolvePromotionQuoteById({ promotionCodeId: "promo_bad?secret", env: ENV,
    fetchImpl: async () => assert.fail("bad ID must not reach provider") }), { code: "INVITATION_DISCOUNT_UNAVAILABLE" });
  for (const fetchImpl of [async () => { throw new Error("private-key ABC234 reader@example.invalid"); },
    async () => ({ ok: false, status: 500 }), async () => ({ ok: true, json: async () => { throw new Error("private-body"); } })]) {
    await assert.rejects(() => resolvePromotionQuoteById({ promotionCodeId: "promo_fixture", env: ENV, fetchImpl }), error => {
      assert.equal(error.code, "PROMOTION_PROVIDER_UNAVAILABLE"); assert.equal(error.status, 503);
      assert.equal(error.cause, undefined); assert.ok(!/private|ABC234|reader@example/.test(error.message)); return true;
    });
  }
});

async function environment(run) {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_CURRENCY", "ASTROLAB_PRICE_CENTS"];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key]; Object.assign(process.env, ENV);
  try { await run(); }
  finally { for (const key of keys) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
}
function session() { return { id: "cs_test_invitation", client_secret: "test-client-secret", amount_subtotal: 1800,
  amount_total: 800, total_details: { amount_discount: 1000 }, currency: "eur" }; }
const args = { amountCents: 800, baseAmountCents: 1800, stripePromotionCodeId: "promo_fixture", customerEmail: "recipient@example.invalid",
  idempotencyKey: "lastro-invitation:inv_fixture:0" };

test("Stripe checkout uses the server recipient, full line price and stable per-variant idempotency keys", async () => {
  await environment(async () => {
    const original = globalThis.fetch; const calls = [];
    globalThis.fetch = async (_url, init) => {
      const body = new URLSearchParams(init.body); calls.push({ body: Object.fromEntries(body), key: init.headers["Idempotency-Key"] });
      if (body.get("ui_mode") === "embedded_page") return { ok: false, status: 400,
        json: async () => ({ error: { param: "ui_mode", message: "unsupported" } }) };
      return ok(session());
    };
    try {
      const first = await createEmbeddedCheckoutSession(args); const second = await createEmbeddedCheckoutSession(args);
      assert.equal(first.sessionId, second.sessionId); assert.equal(calls.length, 4);
      assert.equal(calls[0].body.customer_email, args.customerEmail);
      assert.equal(calls[0].body["line_items[0][price_data][unit_amount]"], "1800");
      assert.equal(calls[0].body["discounts[0][promotion_code]"], "promo_fixture");
      assert.equal(calls[0].key, args.idempotencyKey + ":0"); assert.equal(calls[1].key, args.idempotencyKey + ":1");
      assert.deepEqual(calls.slice(0, 2), calls.slice(2));
    } finally { globalThis.fetch = original; }
  });
});

test("invalid checkout recipient and idempotency values never reach Stripe", async () => {
  await environment(async () => {
    const original = globalThis.fetch; globalThis.fetch = async () => assert.fail("invalid input must not reach Stripe");
    try {
      for (const extra of [{ customerEmail: "not-an-email" }, { customerEmail: "recipient@example.invalid\nBcc:x@example.invalid" },
        { idempotencyKey: "invalid\r\nvalue" }, { idempotencyKey: "x".repeat(181) }]) {
        await assert.rejects(() => createEmbeddedCheckoutSession({ ...args, ...extra }));
      }
    } finally { globalThis.fetch = original; }
  });
});
