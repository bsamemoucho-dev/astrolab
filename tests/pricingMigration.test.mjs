import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { createPaidDelivery } from "../src/models/publicDeliveryService.mjs";
import {
  checkoutSessionProblem, DEFAULT_PRICE_CENTS, LASTRO_PRICING_VERSION,
  LEGACY_PRICING_VERSION, READING_PURPOSE
} from "../src/payments/pricing.mjs";

const snapshot = (extra = {}) => ({
  purpose: READING_PURPOSE, pricing: LASTRO_PRICING_VERSION,
  pricing_base_cents: "1800", pricing_total_cents: "1800",
  pricing_discount_cents: "0", pricing_currency: "eur", ...extra
});
const paid = (extra = {}) => ({
  id: "cs_test_price_migration", payment_status: "paid", amount_total: 1800,
  currency: "eur", metadata: snapshot(), ...extra
});
const legacy = (amount = 500, metadata = {}) => paid({
  amount_total: amount, metadata: { purpose: READING_PURPOSE, pricing: LEGACY_PRICING_VERSION, ...metadata }
});
const delivery = (extra = {}) => ({
  paymentSessionId: "cs_test_price_migration", freeAccess: false,
  amountCents: 500, currency: "eur", status: "failed", ...extra
});

test("the new default is 18 EUR under an explicit new pricing version", () => {
  assert.equal(DEFAULT_PRICE_CENTS, 1800);
  assert.equal(LASTRO_PRICING_VERSION, "lastro-pricing@1.1.0");
  assert.equal(LEGACY_PRICING_VERSION, "lastro-pricing@1.0.0");
  assert.equal(checkoutSessionProblem(paid(), {}), null);
});

test("a coherent server snapshot remains valid after a later price increase", () => {
  assert.equal(checkoutSessionProblem(paid(), { ASTROLAB_PRICE_CENTS: "2500" }), null);
  const discounted = paid({ amount_total: 100, metadata: snapshot({ pricing_total_cents: "100", pricing_discount_cents: "1700" }) });
  assert.equal(checkoutSessionProblem(discounted, {}), null, "a previously paid private price survives removal of its code");
});

for (const field of ["pricing_base_cents", "pricing_total_cents", "pricing_discount_cents", "pricing_currency"]) {
  test(`a partial new snapshot missing ${field} cannot fall back to a current or historical price`, () => {
    const metadata = snapshot(); delete metadata[field];
    assert.equal(checkoutSessionProblem(paid({ metadata }), {}), "price_snapshot_invalid");
    assert.equal(checkoutSessionProblem(paid({ metadata }), {}, { existingDelivery: delivery({ amountCents: 1800 }) }), "price_snapshot_invalid");
  });
}

for (const value of [1800, "", "01800", "1.8e3", "1800.1", "-1800", "NaN", "999999999999999999999"]) {
  test(`malformed snapshot amount ${JSON.stringify(value)} is rejected without rounding`, () => {
    assert.equal(checkoutSessionProblem(paid({ metadata: snapshot({ pricing_total_cents: value }) }), {}), "price_snapshot_invalid");
  });
}

test("snapshot discount, bounds, product, currency and actual Stripe total must all agree", () => {
  for (const extra of [
    { pricing_base_cents: "1700" }, { pricing_discount_cents: "1" },
    { pricing_base_cents: "49", pricing_total_cents: "49" },
    { pricing_base_cents: "100000000", pricing_total_cents: "100000000" },
    { pricing_currency: "EUR" }, { pricing_currency: "" }
  ]) assert.equal(checkoutSessionProblem(paid({ metadata: snapshot(extra) }), {}), "price_snapshot_invalid");
  assert.equal(checkoutSessionProblem(paid({ amount_total: 1799 }), {}), "amount_mismatch");
  assert.equal(checkoutSessionProblem(paid({ metadata: snapshot({ pricing_currency: "usd" }) }), {}), "currency_mismatch");
  assert.equal(checkoutSessionProblem(paid({ currency: "usd" }), {}), "currency_mismatch");
  assert.equal(checkoutSessionProblem(paid({ currency: undefined }), {}), "currency_mismatch");
  assert.equal(checkoutSessionProblem(paid({ metadata: snapshot({ purpose: "another_product" }) }), {}), "foreign_session");
  const missingPurpose = snapshot(); delete missingPurpose.purpose;
  assert.equal(checkoutSessionProblem(paid({ metadata: missingPurpose }), {}), "foreign_session");
  for (const amount_total of ["1800", [1800], {}, 1800.1, null]) {
    assert.equal(checkoutSessionProblem(paid({ amount_total }), {}), "amount_mismatch");
  }
  assert.equal(checkoutSessionProblem(paid({ currency: ["eur"] }), {}), "currency_mismatch");
});

test("unknown pricing versions and misplaced snapshot fields remain blocking", () => {
  assert.equal(checkoutSessionProblem(paid({ metadata: snapshot({ pricing: "lastro-pricing@9.0.0" }) }), {}), "pricing_version_mismatch");
  assert.equal(checkoutSessionProblem(legacy(500, { pricing_total_cents: "500" }), {}), "price_snapshot_invalid");
  assert.equal(checkoutSessionProblem(paid({ metadata: { purpose: READING_PURPOSE, pricing_total_cents: "1800" } }), {}), "price_snapshot_invalid");
  assert.equal(checkoutSessionProblem(paid({ metadata: { pricing: null } }), {}), "pricing_version_mismatch");
  assert.equal(checkoutSessionProblem(paid({ metadata: "legacy" }), {}), "price_snapshot_invalid");
});

test("the previous 5 EUR catalogue requires its exact version and product marker", () => {
  assert.equal(checkoutSessionProblem(legacy(), {}), null);
  assert.equal(checkoutSessionProblem(legacy(), { ASTROLAB_PRICE_CENTS: "3500" }), null);
  assert.equal(checkoutSessionProblem(paid({ amount_total: 500, metadata: undefined }), {}), "amount_mismatch");
  assert.equal(checkoutSessionProblem(paid({ amount_total: 500, metadata: { purpose: READING_PURPOSE } }), {}), "amount_mismatch");
  assert.equal(checkoutSessionProblem(legacy(500, { purpose: undefined }), {}), "foreign_session");
  assert.equal(checkoutSessionProblem(legacy(500, { purpose: "another_product" }), {}), "foreign_session");
  assert.equal(checkoutSessionProblem(legacy(1800), {}), "amount_mismatch");
});

test("historical private codes use their historical 5 EUR base rather than the new catalogue", () => {
  const env = { ASTROLAB_PRICE_CENTS: "1800", ASTROLAB_PROMO_CODES: "EXAMPLE=100,DISCOUNT=-1000" };
  assert.equal(checkoutSessionProblem(legacy(100), env), null);
  assert.equal(checkoutSessionProblem(legacy(50), env), null);
  assert.equal(checkoutSessionProblem(legacy(800), env), "amount_mismatch");
  assert.equal(checkoutSessionProblem(legacy(100), {}), "amount_mismatch");
});

test("an existing paid order proves its old amount through its exact server association", () => {
  const session = paid({ amount_total: 500, metadata: undefined });
  assert.equal(checkoutSessionProblem(session, {}, { existingDelivery: delivery() }), null);
  assert.equal(checkoutSessionProblem(paid({ amount_total: 100, metadata: undefined }), {}, { existingDelivery: delivery({ amountCents: 100 }) }), null);
  assert.equal(checkoutSessionProblem(paid(), {}, { existingDelivery: delivery({ amountCents: 1800 }) }), null);
});

for (const extra of [
  { paymentSessionId: "cs_test_other" }, { amountCents: 501 }, { amountCents: "500" },
  { amountCents: null }, { freeAccess: true }, { freeAccess: undefined }, { currency: "usd" }, { currency: null }
]) {
  test(`a mismatched stored order cannot authorize an old payment (${Object.keys(extra)[0]}=${JSON.stringify(Object.values(extra)[0])})`, () => {
    assert.equal(checkoutSessionProblem(paid({ amount_total: 500, metadata: undefined }), {}, { existingDelivery: delivery(extra) }), "delivery_mismatch");
  });
}

test("stored order proof cannot bypass foreign currency/product, an unknown version or an invalid snapshot", () => {
  const order = delivery();
  assert.equal(checkoutSessionProblem(legacy(500, { purpose: "another_product" }), {}, { existingDelivery: order }), "foreign_session");
  assert.equal(checkoutSessionProblem(paid({ amount_total: 500, currency: "usd", metadata: undefined }), {}, { existingDelivery: delivery({ currency: "usd" }) }), "currency_mismatch");
  assert.equal(checkoutSessionProblem(legacy(500, { pricing: "unknown" }), {}, { existingDelivery: order }), "pricing_version_mismatch");
  assert.equal(checkoutSessionProblem(paid({ amount_total: 500, metadata: snapshot({ pricing_total_cents: "500" }) }), {}, { existingDelivery: order }), "price_snapshot_invalid");
});

test("unversioned sessions retain the current strict total and private-code rules", () => {
  assert.equal(checkoutSessionProblem(paid({ metadata: undefined }), {}), null);
  assert.equal(checkoutSessionProblem(paid({ amount_total: 100, metadata: undefined }), {}), "amount_mismatch");
  assert.equal(checkoutSessionProblem(paid({ amount_total: 100, metadata: undefined }), { ASTROLAB_PROMO_CODES: "EXAMPLE=100" }), null);
});

const PUBLIC_INPUT = {
  firstName: "Fictional", deliveryEmail: "customer@example.test", birthDate: "1990-01-15",
  timePrecision: "exact", timeValue: "16:30", language: "fr",
  resolvedPlace: { selectedName: "Paris, France", country: "France", normalizedForCalculation: {
    latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris"
  } }
};
async function withReadingRoute(session, { stored = false, requestExtra = {} } = {}, check) {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_CURRENCY", "ASTROLAB_PRICE_CENTS", "ASTROLAB_PROMO_CODE", "ASTROLAB_PROMO_DISCOUNT_CENTS", "ASTROLAB_PROMO_CODES", "PUBLIC_BASE_URL"];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_test_abc123456789", PUBLIC_BASE_URL: "https://example.test" });
  const store = new JsonStore(null);
  let existing;
  if (stored) {
    existing = (await createPaidDelivery(store, {
      paymentSessionId: session.id, amountCents: session.amount_total, currency: session.currency,
      email: PUBLIC_INPUT.deliveryEmail, freeAccess: false, input: PUBLIC_INPUT
    })).delivery;
    await store.transact(state => {
      const row = state.publicReadings.find(item => item.id === existing.id);
      row.status = "failed"; row.error = "Simulated interruption";
    });
  }
  const before = JSON.stringify(await store.load());
  const { server } = createApp({ store, backgroundReadingJobs: false, outboxMaintenance: false, pdfRenderer: null });
  const originalFetch = globalThis.fetch;
  let stripeReads = 0;
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    globalThis.fetch = async (url, init) => {
      const target = String(url);
      if (target.startsWith("https://api.stripe.com/v1/checkout/sessions/")) {
        stripeReads++; return { ok: true, status: 200, json: async () => session };
      }
      assert.ok(target.startsWith(base), "no model, mail or external payment call is permitted by this test");
      return originalFetch(url, init);
    };
    const send = async (extra = {}) => {
      const response = await fetch(`${base}/api/public/readings`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...PUBLIC_INPUT, paymentSessionId: session.id, ...requestExtra, ...extra })
      });
      return { status: response.status, body: await response.json() };
    };
    await check({ result: await send(), send, store, before, existing, stripeReads: () => stripeReads });
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise(resolve => server.close(resolve));
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
}

test("an existing failed 5 EUR order can be recovered without a second order or automatic generation", async () => {
  await withReadingRoute(paid({ amount_total: 500, metadata: undefined }), { stored: true }, async ({ result, store, before, stripeReads }) => {
    assert.equal(result.status, 202, JSON.stringify(result.body));
    assert.equal(result.body.status, "failed", "validation does not restart the failed dossier");
    assert.equal(JSON.stringify(await store.load()), before);
    assert.equal(stripeReads(), 1);
  });
});

test("a public caller cannot forge a stored order to authorize an unmarked 5 EUR payment", async () => {
  await withReadingRoute(paid({ amount_total: 500, metadata: undefined }), { requestExtra: { existingDelivery: delivery() } }, async ({ result, store }) => {
    assert.equal(result.status, 402);
    assert.equal(result.body.code, "amount_mismatch");
    assert.equal((await store.load()).publicReadings.length, 0);
  });
});

test("an explicitly marked historical session can still create its single paid order", async () => {
  await withReadingRoute(legacy(), {}, async ({ result, send, store }) => {
    assert.equal(result.status, 202, JSON.stringify(result.body));
    assert.equal(result.body.status, "queued");
    const again = await send();
    assert.equal(again.status, 202);
    const rows = (await store.load()).publicReadings;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amountCents, 500);
  });
});

test("the new 18 EUR snapshot creates one order and repeated requests never duplicate it", async () => {
  await withReadingRoute(paid(), {}, async ({ result, send, store }) => {
    assert.equal(result.status, 202, JSON.stringify(result.body));
    assert.equal((await send()).status, 202);
    const state = await store.load();
    assert.equal(state.publicReadings.length, 1);
    assert.equal(state.publicReadings[0].amountCents, 1800);
    assert.equal(state.outbox.length, 0);
  });
});
