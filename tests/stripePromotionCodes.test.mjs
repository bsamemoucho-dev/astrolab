import test from "node:test";
import assert from "node:assert/strict";
import { resolvePromotionQuote, STRIPE_PROMOTION_API_VERSION } from "../src/payments/stripePromotionCodes.mjs";
import { createEmbeddedCheckoutSession, lastStripeFailure } from "../src/payments/stripe.mjs";

// Fictional test-only code and Stripe objects, never provisioned in Stripe.
const CODE = "ABCDEF123456";
const SHORT_CODE = "ZX7Q2K";
const BATCH = "11111111-1111-4111-8111-111111111111";
const ENV = { STRIPE_SECRET_KEY: "sk_test_FAKE123", STRIPE_PUBLISHABLE_KEY: "pk_test_FAKE123" };
function promotion(code = CODE) {
  return {
    id: "promo_fake123", object: "promotion_code", active: true, code,
    metadata: { purpose: "lastro_reading_discount", batch_id: BATCH },
    customer: null, expires_at: null, livemode: false, max_redemptions: 1, times_redeemed: 0,
    restrictions: { first_time_transaction: false, minimum_amount: null, minimum_amount_currency: null },
    coupon: {
      id: "coupon_fake123", object: "coupon", amount_off: 1000, currency: "eur", duration: "once",
      percent_off: null, livemode: false, max_redemptions: 50, times_redeemed: 0, valid: true,
      redeem_by: null, applies_to: null, currency_options: { eur: { amount_off: 1000 } },
      metadata: { purpose: "lastro_reading_discount", batch_id: BATCH }
    }
  };
}
const list = (data) => ({ object: "list", has_more: false, data });
const success = (data) => ({ ok: true, status: 200, async json() { return data; } });
const lookup = (entry, options = {}) => resolvePromotionQuote({ promoCode: CODE, env: ENV, fetchImpl: async () => success(list([entry])), ...options });

function environment(overrides) {
  const before = { ...process.env };
  for (const key of ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_CURRENCY"]) delete process.env[key];
  Object.assign(process.env, overrides);
  return () => { for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env, before); };
}

function nativeSession(overrides = {}) {
  return { id: "cs_test_fake123", client_secret: "cs_test_fake123_secret_fake", amount_total: 800,
    amount_subtotal: 1800, total_details: { amount_discount: 1000 }, currency: "eur", ...overrides };
}

const nativeArgs = { amountCents: 800, baseAmountCents: 1800, stripePromotionCodeId: "promo_fake123" };

test("native quote uses pinned read-only case-insensitive lookup and exact 18 minus 10 EUR", async () => {
  let calls = 0;
  const quote = await resolvePromotionQuote({ promoCode: " aBcD-Ef 123456 ", env: ENV, fetchImpl: async (url, init) => {
    calls++;
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, "https://api.stripe.com/v1/promotion_codes");
    assert.equal(parsed.searchParams.get("code"), CODE.toLowerCase());
    assert.equal(parsed.searchParams.get("active"), "true");
    assert.equal(parsed.searchParams.get("limit"), "2");
    assert.deepEqual(parsed.searchParams.getAll("expand[]"), ["data.coupon.applies_to", "data.coupon.currency_options"]);
    assert.equal(init.method, "GET");
    assert.equal(init.headers["Stripe-Version"], STRIPE_PROMOTION_API_VERSION);
    assert.equal(init.headers.Authorization, "Bearer sk_test_FAKE123");
    assert.equal(init.body, undefined);
    return success(list([promotion()]));
  }});
  assert.equal(calls, 1);
  assert.equal(quote.valid, true);
  assert.equal(quote.baseCents, 1800);
  assert.equal(quote.discountCents, 1000);
  assert.equal(quote.totalCents, 800);
  assert.equal(quote.stripePromotionCodeId, "promo_fake123");
  assert.equal(quote.appliedIsPublic, false);
});

test("legacy environment offers and non-native inputs never query Stripe", async () => {
  const fetchImpl = async () => assert.fail("no native lookup");
  for (const promoCode of ["", "ABCDE", "unknown", "ABCDEFGHIJK", "ABCDEFGHIJKLM", "ABCDEF1234567890", "bad<script>!"])
    await resolvePromotionQuote({ promoCode, env: ENV, fetchImpl });
  const quote = await resolvePromotionQuote({ promoCode: CODE, env: { ...ENV, ASTROLAB_PROMO_CODES: `${CODE}=100` }, fetchImpl });
  assert.equal(quote.totalCents, 100);
  assert.equal(quote.stripePromotionCodeId, undefined);
  const publicQuote = await resolvePromotionQuote({ promoCode: CODE, env: { ...ENV, ASTROLAB_PROMO_CODE: CODE, ASTROLAB_PROMO_DISCOUNT_CENTS: "200" }, fetchImpl });
  assert.equal(publicQuote.totalCents, 1600);
  assert.equal(publicQuote.appliedIsPublic, true);
});

test("six-character native reduction is read-only and keeps the exact one-use 18 minus 10 EUR policy", async () => {
  let calls = 0;
  const quote = await resolvePromotionQuote({ promoCode: " zX-7q 2K ", env: ENV, fetchImpl: async (url, init) => {
    calls++;
    assert.equal(new URL(url).searchParams.get("code"), SHORT_CODE.toLowerCase());
    assert.equal(init.method, "GET");
    assert.equal(init.body, undefined);
    assert.equal(init.headers["Stripe-Version"], STRIPE_PROMOTION_API_VERSION);
    return success(list([promotion(SHORT_CODE)]));
  }});
  assert.equal(calls, 1);
  assert.equal(quote.valid, true);
  assert.equal(quote.baseCents, 1800);
  assert.equal(quote.discountCents, 1000);
  assert.equal(quote.totalCents, 800);
  assert.equal(quote.stripePromotionCodeId, "promo_fake123");
});

test("a short gift or an unknown code does not become a native reduction merely by its length", async () => {
  for (const entries of [[], [{ ...promotion(SHORT_CODE), metadata: { purpose: "gift", batch_id: BATCH } }]]) {
    const quote = await resolvePromotionQuote({ promoCode: SHORT_CODE, env: ENV, fetchImpl: async () => success(list(entries)) });
    assert.equal(quote.valid, false);
    assert.equal(quote.reason, "unknown");
    assert.equal(quote.stripePromotionCodeId, undefined);
  }
});

const invalidCases = {
  inactive: (p) => { p.active = false; },
  redeemed: (p) => { p.times_redeemed = 1; },
  "multiple uses": (p) => { p.max_redemptions = 2; },
  "missing quota": (p) => { p.max_redemptions = null; },
  "wrong code": (p) => { p.code = "OTHER1234567"; },
  "malformed id": (p) => { p.id = "promo_bad?secret"; },
  "wrong mode": (p) => { p.livemode = true; },
  "wrong coupon mode": (p) => { p.coupon.livemode = true; },
  "customer restriction": (p) => { p.customer = "cus_fake"; },
  "account restriction": (p) => { p.customer_account = "acct_fake"; },
  expiry: (p) => { p.expires_at = 1999999999; },
  "first order only": (p) => { p.restrictions.first_time_transaction = true; },
  "minimum spend": (p) => { p.restrictions.minimum_amount = 1900; },
  "minimum currency": (p) => { p.restrictions.minimum_amount_currency = "usd"; },
  "currency restriction": (p) => { p.restrictions.currency_options = { eur: { minimum_amount: 1 } }; },
  "missing restrictions": (p) => { delete p.restrictions; },
  "wrong promo purpose": (p) => { p.metadata.purpose = "other"; },
  "wrong batch": (p) => { p.coupon.metadata.batch_id = "22222222-2222-4222-8222-222222222222"; },
  "missing batch": (p) => { delete p.metadata.batch_id; },
  "wrong purpose": (p) => { p.coupon.metadata.purpose = "other"; },
  "wrong amount": (p) => { p.coupon.amount_off = 1100; },
  "wrong currency": (p) => { p.coupon.currency = "usd"; },
  "percent discount": (p) => { p.coupon.percent_off = 100; },
  "wrong duration": (p) => { p.coupon.duration = "forever"; },
  "coupon expired": (p) => { p.coupon.valid = false; },
  "coupon deadline": (p) => { p.coupon.redeem_by = 1999999999; },
  "unbounded coupon": (p) => { p.coupon.max_redemptions = null; },
  "too many coupon uses": (p) => { p.coupon.max_redemptions = 51; },
  "coupon exhausted": (p) => { p.coupon.times_redeemed = 50; },
  "missing coupon counter": (p) => { delete p.coupon.times_redeemed; },
  "product restriction": (p) => { p.coupon.applies_to = { products: ["prod_fake"] }; },
  "coupon currencies": (p) => { p.coupon.currency_options = { eur: { amount_off: 1100 } }; },
  "unexpanded coupon": (p) => { p.coupon = "coupon_fake123"; }
};
for (const code of [CODE, SHORT_CODE])
for (const [name, mutate] of Object.entries(invalidCases)) test(`reject native ${code.length}-character code: ${name}`, async () => {
  const entry = promotion(code); mutate(entry);
  const quote = await lookup(entry, { promoCode: code });
  assert.equal(quote.valid, false);
  assert.equal(quote.reason, "unknown");
  assert.equal(quote.stripePromotionCodeId, undefined);
});

test("unknown, ambiguous and paginated results are not accepted", async () => {
  for (const data of [list([]), list([promotion(), promotion()]), { ...list([promotion()]), has_more: true }]) {
    const quote = await resolvePromotionQuote({ promoCode: CODE, env: ENV, fetchImpl: async () => success(data) });
    assert.equal(quote.valid, false);
  }
});

test("native batch cannot silently change its price/currency", async () => {
  for (const env of [{ ...ENV, ASTROLAB_PRICE_CENTS: "1900" }, { ...ENV, STRIPE_CURRENCY: "usd" }]) {
    const quote = await resolvePromotionQuote({ promoCode: CODE, env, fetchImpl: async () => assert.fail("unusable batch") });
    assert.equal(quote.valid, false);
  }
});

test("provider failures are explicit and contain no request code, key, provider message or cause", async () => {
  const secret = `${CODE} sk_test_FAKE123 private provider detail`;
  const providers = [
    async () => { throw new Error(secret); },
    async () => ({ ok: false, status: 401, json: async () => ({ error: { message: secret } }) }),
    async () => ({ ok: true, json: async () => { throw new Error(secret); } }),
    async () => success(null), async () => success({ data: [] }), async () => success({ ...list([]), has_more: "false" })
  ];
  for (const fetchImpl of providers) await assert.rejects(resolvePromotionQuote({ promoCode: CODE, env: ENV, fetchImpl }), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.code, "PROMOTION_PROVIDER_UNAVAILABLE");
    assert.equal(error.cause, undefined);
    for (const text of [CODE, "FAKE123", "private provider detail"]) assert.equal(JSON.stringify(error).includes(text) || error.message.includes(text), false);
    return true;
  });
  await assert.rejects(resolvePromotionQuote({ promoCode: CODE, env: {}, fetchImpl: async () => assert.fail("missing config") }), { code: "PROMOTION_PROVIDER_UNAVAILABLE" });
});

test("native quote is checked afresh after a redemption, without stale cache", async () => {
  const entry = promotion();
  const fetchImpl = async () => success(list([entry]));
  assert.equal((await lookup(entry, { fetchImpl })).valid, true);
  entry.times_redeemed = 1;
  assert.equal((await lookup(entry, { fetchImpl })).valid, false);
});

test("native Checkout applies 10 EUR exactly once to 18 EUR and preserves server snapshot", async () => {
  const restore = environment(ENV); const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.stripe.com/v1/checkout/sessions");
      assert.equal(init.headers["Stripe-Version"], undefined);
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("line_items[0][price_data][unit_amount]"), "1800");
      assert.equal(body.get("discounts[0][promotion_code]"), "promo_fake123");
      assert.equal(body.get("allow_promotion_codes"), "false");
      assert.equal(body.get("line_items[0][price_data][product_data][name]"), "Lecture symbolique personnalisée (Lastro)");
      assert.equal(body.get("metadata[pricing_total_cents]"), "800");
      assert.equal(body.get("metadata[pricing_discount_cents]"), "1000");
      assert.equal(body.get("metadata[pricing_base_cents]"), "1800");
      assert.equal(init.body.includes(CODE), false);
      return success(nativeSession());
    };
    const result = await createEmbeddedCheckoutSession({ ...nativeArgs, label: "18 moins10 : 8", metadata: {
      purpose: "lastro_lecture", pricing: "lastro-pricing@1.1.0", pricing_base_cents: 1800,
      pricing_total_cents: 800, pricing_discount_cents: 1000, pricing_currency: "eur"
    }});
    assert.equal(result.amountCents, 800);
    assert.equal(result.currency, "eur");
  } finally { globalThis.fetch = previousFetch; restore(); }
});

test("legacy Checkout retains direct price, label and no native discount or API pin", async () => {
  const restore = environment(ENV); const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("line_items[0][price_data][unit_amount]"), "100");
      assert.equal(body.get("discounts[0][promotion_code]"), null);
      assert.equal(body.get("line_items[0][price_data][product_data][name]"), "private label");
      assert.equal(init.headers["Stripe-Version"], undefined);
      return success({ id: "cs_test_legacy", client_secret: "legacy_secret", amount_total: 100, currency: "eur" });
    };
    assert.equal((await createEmbeddedCheckoutSession({ amountCents: 100, label: "private label" })).amountCents, 100);
  } finally { globalThis.fetch = previousFetch; restore(); }
});

test("invalid native arguments are refused before any Checkout call", async () => {
  const restore = environment(ENV); const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => assert.fail("invalid native request");
    for (const override of [{ stripePromotionCodeId: "" }, { stripePromotionCodeId: "promo_x?secret" },
      { stripePromotionCodeId: {} }, { baseAmountCents: 800 }, { baseAmountCents: 1900 },
      { amountCents: 799 }, { amountCents: 800.1 }, { baseAmountCents: null }])
      await assert.rejects(createEmbeddedCheckoutSession({ ...nativeArgs, ...override }), { code: "PROMOTION_CHECKOUT_INVALID" });
  } finally { globalThis.fetch = previousFetch; restore(); }
});

test("Stripe rejection after a concurrent redemption never falls back to full price or exposes provider text", async () => {
  const restore = environment(ENV); const previousFetch = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return { ok: false, status: 400, json: async () => ({ error: {
      type: "invalid_request_error", param: "discounts[0][promotion_code]", message: `Redeemed secret ${CODE}`
    } }) }; };
    await assert.rejects(createEmbeddedCheckoutSession(nativeArgs), (error) => {
      assert.equal(error.code, "PROMOTION_CHECKOUT_FAILED");
      assert.equal(error.message.includes(CODE), false);
      assert.equal(error.publicMessage.includes(CODE), false);
      return true;
    });
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(lastStripeFailure()).includes(CODE), false);
  } finally { globalThis.fetch = previousFetch; restore(); }
});

test("native network failures do not retain sensitive request URL in nested cause/diagnostic", async () => {
  const restore = environment(ENV); const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error(`request ${CODE} failed`); };
    await assert.rejects(createEmbeddedCheckoutSession(nativeArgs), (error) => {
      assert.equal(error.cause, undefined);
      assert.equal(JSON.stringify(error).includes(CODE), false);
      return true;
    });
    assert.equal(JSON.stringify(lastStripeFailure()).includes(CODE), false);
  } finally { globalThis.fetch = previousFetch; restore(); }
});

test("native UI compatibility retry keeps the same base and promotion", async () => {
  const restore = environment(ENV); const previousFetch = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      calls++; const body = new URLSearchParams(init.body);
      assert.equal(body.get("discounts[0][promotion_code]"), "promo_fake123");
      assert.equal(body.get("line_items[0][price_data][unit_amount]"), "1800");
      if (calls === 1) return { ok: false, status: 400, json: async () => ({ error: { param: "ui_mode", message: "unsupported embedded_page" } }) };
      return success(nativeSession());
    };
    assert.equal((await createEmbeddedCheckoutSession(nativeArgs)).amountCents, 800);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = previousFetch; restore(); }
});

test("unexpected native Stripe total/discount/currency is blocking and no secret is returned", async () => {
  const restore = environment(ENV); const previousFetch = globalThis.fetch;
  try {
    for (const patch of [{ amount_total: 1800 }, { amount_total: 0 }, { amount_total: null },
      { amount_subtotal: 800 }, { total_details: { amount_discount: 0 } }, { currency: "usd" },
      { id: null }, { client_secret: null }]) {
      globalThis.fetch = async () => success(nativeSession(patch));
      await assert.rejects(createEmbeddedCheckoutSession(nativeArgs), { code: "PROMOTION_CHECKOUT_TOTAL_MISMATCH" });
    }
  } finally { globalThis.fetch = previousFetch; restore(); }
});


test("native lookup shares existing key cleanup, restricted-key support and mode mismatch protection", async () => {
  let calls = 0;
  const env = { STRIPE_SECRET_KEY: " rk_test_FAKE\n123 ", STRIPE_PUBLISHABLE_KEY: "pk_test_FAKE123" };
  const fetchImpl = async (_url, init) => {
    calls++;
    assert.equal(init.headers.Authorization, "Bearer rk_test_FAKE123");
    return success(list([promotion()]));
  };
  assert.equal((await lookup(promotion(), { env, fetchImpl })).valid, true);
  await assert.rejects(lookup(promotion(), { env: { ...env, STRIPE_PUBLISHABLE_KEY: "pk_live_FAKE123" }, fetchImpl }), { code: "PROMOTION_PROVIDER_UNAVAILABLE" });
  assert.equal(calls, 1);
});

test("malformed successful native Checkout response is explicitly blocked", async () => {
  const restore = environment(ENV); const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => success(null);
    await assert.rejects(createEmbeddedCheckoutSession(nativeArgs), { code: "PROMOTION_CHECKOUT_TOTAL_MISMATCH" });
  } finally { globalThis.fetch = previousFetch; restore(); }
});


test("expanded default empty product restrictions and EUR currency option remain eligible", async () => {
  const entry = promotion(); entry.coupon.applies_to = { products: [] };
  assert.equal((await lookup(entry)).valid, true);
  entry.coupon.currency_options = null;
  assert.equal((await lookup(entry)).valid, true);
});

test("the pinned Stripe API may omit its optional unrestricted applies_to field", async () => {
  const entry = promotion(); delete entry.coupon.applies_to;
  const quote = await lookup(entry);
  assert.equal(quote.valid, true);
  assert.equal(quote.baseCents, 1800);
  assert.equal(quote.discountCents, 1000);
  assert.equal(quote.totalCents, 800);
  assert.equal(quote.currency, "eur");
  assert.equal(quote.stripePromotionCodeId, entry.id);
});

test("a malformed present product restriction is never treated as unrestricted", async () => {
  for (const value of [{}, [], "all", false, { products: null }, { products: [], unexpected: true }]) {
    const entry = promotion(); entry.coupon.applies_to = value;
    const quote = await lookup(entry);
    assert.equal(quote.valid, false, JSON.stringify(value));
    assert.equal(quote.reason, "unknown");
    assert.equal(quote.stripePromotionCodeId, undefined);
  }
});
