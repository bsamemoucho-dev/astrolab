import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readPromotionInventory } from "../src/payments/promotionInventory.mjs";
import { STRIPE_PROMOTION_API_VERSION } from "../src/payments/stripePromotionCodes.mjs";

const BATCH = "11111111-1111-4111-8111-111111111111";
const COUPON = `lstr_d10_${BATCH.replaceAll("-", "")}`;
const ENV = { STRIPE_SECRET_KEY: "sk_test_FAKE123", STRIPE_PUBLISHABLE_KEY: "pk_test_FAKE123" };
const sha = value => createHash("sha256").update(value).digest("hex");
function promotion(index) {
  return { id: `promo_fixture${index}`, object: "promotion_code", active: true,
    code: `ZX${String(index).padStart(4, "0")}`, livemode: false,
    max_redemptions: 1, times_redeemed: 0, customer: null, expires_at: null,
    metadata: { purpose: "lastro_reading_discount", batch_id: BATCH },
    restrictions: { first_time_transaction: false, minimum_amount: null, minimum_amount_currency: null },
    coupon: { id: COUPON, object: "coupon", valid: true, livemode: false, amount_off: 1000,
      currency: "eur", duration: "once", percent_off: null, max_redemptions: 50, times_redeemed: 0,
      redeem_by: null, metadata: { purpose: "lastro_reading_discount", batch_id: BATCH } } };
}
async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), "lastro-promotion-stock-test-"));
  const promotions = Array.from({ length: 50 }, (_, index) => promotion(index));
  const state = { schema: "lastro.private_stripe_discount_batch@1.0.0", batchId: BATCH,
    couponId: COUPON, phase: "active", slots: promotions.map((entry, index) => ({
      slot: String(index + 1).padStart(3, "0"), id: entry.id, codeHash: sha(entry.code.toLowerCase()), active: true })) };
  const path = join(directory, `${BATCH}.json`);
  await writeFile(path, JSON.stringify(state), { mode: 0o600 });
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, "https://api.stripe.com/v1/promotion_codes");
    assert.equal(parsed.searchParams.get("coupon"), COUPON); assert.equal(parsed.searchParams.get("limit"), "100");
    assert.equal(init.method, "GET"); assert.equal(init.body, undefined);
    assert.equal(init.headers["Stripe-Version"], STRIPE_PROMOTION_API_VERSION);
    return { ok: true, json: async () => ({ object: "list", has_more: false, data: promotions }) };
  };
  try { await run({ directory, path, state, promotions, fetchImpl }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test("exact existing fifty-code inventory is read-only, omits clear codes and accepts omitted applies_to", async () => {
  await fixture(async ({ directory, path, state, fetchImpl }) => {
    const before = await readFile(path, "utf8");
    const result = await readPromotionInventory({ stateDir: directory, env: ENV, fetchImpl });
    assert.equal(result.length, 50); assert.equal(new Set(result.map(row => row.id)).size, 50);
    assert.deepEqual(result[0], { id: state.slots[0].id, batchId: BATCH });
    assert.ok(result.every(row => Object.keys(row).length === 2));
    assert.equal(await readFile(path, "utf8"), before);
    assert.equal(JSON.stringify(result).includes("ZX0000"), false); assert.equal(JSON.stringify(result).includes("codeHash"), false);
  });
});

test("used, disabled, unknown-use and incompatible coupons are excluded without replenishment", async () => {
  await fixture(async ({ directory, promotions, fetchImpl }) => {
    promotions[0].times_redeemed = 1; promotions[1].active = false;
    delete promotions[2].times_redeemed; promotions[3].coupon.amount_off = 500;
    const result = await readPromotionInventory({ stateDir: directory, env: ENV, fetchImpl });
    assert.equal(result.length, 46); assert.ok(result.every(row => ![0, 1, 2, 3].some(index => row.id === `promo_fixture${index}`)));
  });
});

test("deactivated operator files never query Stripe and remain unchanged", async () => {
  await fixture(async ({ directory, path, state }) => {
    state.phase = "deactivated"; await writeFile(path, JSON.stringify(state));
    const before = await readFile(path, "utf8");
    const result = await readPromotionInventory({ stateDir: directory, env: ENV,
      fetchImpl: async () => assert.fail("inactive batch must not be queried") });
    assert.deepEqual(result, []); assert.equal(await readFile(path, "utf8"), before);
  });
});

test("malformed active registry files fail closed before any provider lookup", async () => {
  const invalid = [state => { state.schema = "unexpected"; }, state => { state.batchId = "22222222-2222-4222-8222-222222222222"; },
    state => { state.slots.pop(); }, state => { state.slots[1].id = state.slots[0].id; },
    state => { state.slots[0].codeHash = "invalid"; }, state => { state.couponId = "unrelated"; }];
  for (const mutate of invalid) await fixture(async ({ directory, path, state }) => {
    mutate(state); await writeFile(path, JSON.stringify(state));
    await assert.rejects(() => readPromotionInventory({ stateDir: directory, env: ENV,
      fetchImpl: async () => assert.fail("invalid registry") }), { code: "INVITATION_STOCK_UNAVAILABLE", status: 503 });
  });
});

test("native coupon identity is derived from its registry batch and matches each returned promotion", async () => {
  await fixture(async ({ directory, path, state }) => {
    state.couponId = "lstr_d10_22222222222242228222222222222222";
    await writeFile(path, JSON.stringify(state));
    let calls = 0;
    await assert.rejects(() => readPromotionInventory({ stateDir: directory, env: ENV,
      fetchImpl: async () => { calls++; throw new Error("must fail before lookup"); } }), { code: "INVITATION_STOCK_UNAVAILABLE" });
    assert.equal(calls, 0);
  });
  await fixture(async ({ directory, promotions, fetchImpl }) => {
    promotions[0].coupon.id = "coupon_unrelated";
    await assert.rejects(() => readPromotionInventory({ stateDir: directory, env: ENV, fetchImpl }), { code: "INVITATION_STOCK_UNAVAILABLE" });
  });
});

test("provider pagination, incomplete sets, altered codes and foreign metadata cannot be silently accepted", async () => {
  const mutateCases = [data => { data.has_more = true; }, data => { data.data.pop(); },
    data => { data.data[1] = structuredClone(data.data[0]); }, data => { data.data[0].code = "OTHER1"; },
    data => { data.data[0].metadata.batch_id = "22222222-2222-4222-8222-222222222222"; }];
  for (const mutate of mutateCases) await fixture(async ({ directory, promotions }) => {
    const data = { object: "list", has_more: false, data: promotions }; mutate(data);
    await assert.rejects(() => readPromotionInventory({ stateDir: directory, env: ENV,
      fetchImpl: async () => ({ ok: true, json: async () => data }) }), { code: "INVITATION_STOCK_UNAVAILABLE", status: 503 });
  });
});

test("registry symlinks, malformed JSON and missing configuration fail without leaking provider data", async () => {
  await fixture(async ({ directory, path, fetchImpl }) => {
    await assert.rejects(() => readPromotionInventory({ stateDir: directory, env: {}, fetchImpl }), { code: "INVITATION_STOCK_UNAVAILABLE" });
    await writeFile(path, "not-json-private-data");
    await assert.rejects(() => readPromotionInventory({ stateDir: directory, env: ENV, fetchImpl }), error => {
      assert.equal(error.code, "INVITATION_STOCK_UNAVAILABLE"); assert.ok(!error.message.includes("private-data")); return true;
    });
    await rm(path); await symlink(join(directory, "unrelated.payload"), path);
    await assert.rejects(() => readPromotionInventory({ stateDir: directory, env: ENV, fetchImpl }), { code: "INVITATION_STOCK_UNAVAILABLE" });
  });
});

test("unknown provider transport and HTTP failures produce a sanitized 503 with no mutation", async () => {
  for (const fetchImpl of [async () => { throw new Error("secret-key recipient@example.invalid PRIVATECODE"); },
    async () => ({ ok: false, status: 500, json: async () => ({ secret: "do-not-expose" }) }),
    async () => ({ ok: true, json: async () => { throw new Error("private-json"); } })]) {
    await fixture(async ({ directory, path }) => {
      const before = await readFile(path, "utf8");
      await assert.rejects(() => readPromotionInventory({ stateDir: directory, env: ENV, fetchImpl }), error => {
        assert.equal(error.status, 503); assert.equal(error.code, "INVITATION_STOCK_UNAVAILABLE");
        assert.equal(error.cause, undefined); assert.ok(!/secret|PRIVATECODE|private-json|recipient@example/.test(error.message)); return true;
      });
      assert.equal(await readFile(path, "utf8"), before);
    });
  }
});
