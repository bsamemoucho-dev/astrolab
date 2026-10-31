import assert from "node:assert/strict";
import test from "node:test";
import { JsonStore, createEmptyState } from "../src/db/jsonStore.mjs";
import { hashInvitationToken } from "../src/models/emailInvitationService.mjs";
import { createInvitationCheckout, resolveEmailInvitation } from "../src/models/invitationCheckoutService.mjs";
import { LASTRO_PRICING_VERSION, READING_PURPOSE } from "../src/payments/pricing.mjs";

const TOKEN = "A".repeat(43), EMAIL = "reader@example.invalid", ID = "inv_fixture";
const EXPECTED = { expectedTotalCents: 800, expectedCurrency: "eur" };
const quote = () => ({ version: LASTRO_PRICING_VERSION, baseCents: 1800, discountCents: 1000,
  totalCents: 800, currency: "eur", valid: true, reason: "applied", promoCode: null,
  appliedIsPublic: false, stripePromotionCodeId: "promo_fixture" });
function fixture() {
  const state = createEmptyState();
  state.emailInvitations = [{ id: ID, recipientEmail: EMAIL, kind: "discount10", language: "fr",
    tokenHash: hashInvitationToken(TOKEN), stripePromotionCodeId: "promo_fixture", usedAt: null,
    deliveryId: null, deliveryReference: null }];
  return new JsonStore(null, state);
}
function session(overrides = {}) {
  return { id: "cs_test_invitation", client_secret: "test-client-secret", amount_total: 800, currency: "eur",
    status: "open", payment_status: "unpaid", customer_email: EMAIL,
    metadata: { purpose: READING_PURPOSE, pricing: LASTRO_PRICING_VERSION,
      pricing_base_cents: "1800", pricing_total_cents: "800", pricing_discount_cents: "1000",
      pricing_currency: "eur", invitation_id: ID }, ...overrides };
}
const created = (id = "cs_test_invitation") => ({ sessionId: id, clientSecret: "test-client-secret", amountCents: 800, currency: "eur" });
async function attach(store, extra = {}) {
  const state = await store.load(); state.emailInvitations[0].checkout = { sessionId: "cs_test_invitation", attempt: 0, ...extra };
  state.emailInvitations[0].checkoutSessionId = state.emailInvitations[0].checkout.sessionId;
  return state;
}

test("paid invitation resolves after the one-use promotion has been redeemed without another provider quote", async () => {
  const store = fixture(); const state = await attach(store); const before = structuredClone(state);
  let retrieves = 0;
  const result = await resolveEmailInvitation(store, TOKEN, { baseUrl: "https://www.lastro.fr",
    retrieveSession: async () => { retrieves++; return session({ status: "complete", payment_status: "paid" }); },
    resolvePromotion: async () => assert.fail("redeemed promotion must not be revalidated as unused") });
  assert.equal(retrieves, 1); assert.equal(result.invitation.paymentConfirmed, true);
  assert.equal(result.invitation.checkoutSessionId, "cs_test_invitation"); assert.equal(result.invitation.quote.totalCents, 800);
  assert.deepEqual(await store.load(), before); assert.ok(!JSON.stringify(result).includes(TOKEN));
});

test("concurrent open-checkout requests prepare one Stripe session and share its stable key", async () => {
  const store = fixture(); const calls = []; let retrieves = 0;
  const options = { ...EXPECTED, resolvePromotion: async () => quote(),
    createSession: async args => { calls.push(args); await Promise.resolve(); return created(); },
    retrieveSession: async () => { retrieves++; return session(); } };
  const results = await Promise.all([createInvitationCheckout(store, TOKEN, options), createInvitationCheckout(store, TOKEN, options)]);
  assert.equal(calls.length, 1); assert.equal(retrieves, 1);
  assert.equal(results[0].sessionId, results[1].sessionId); assert.equal(calls[0].idempotencyKey, `lastro-invitation:${ID}:0`);
  assert.equal(calls[0].customerEmail, EMAIL); assert.equal(calls[0].amountCents, 800); assert.equal(calls[0].baseAmountCents, 1800);
  assert.equal(calls[0].metadata.invitation_id, ID);
});

test("provider response loss retries the same idempotency key instead of creating another logical checkout", async () => {
  const store = fixture(); const keys = []; const provider = new Map(); let lost = true;
  const options = { ...EXPECTED, resolvePromotion: async () => quote(), createSession: async args => {
    keys.push(args.idempotencyKey); if (!provider.has(args.idempotencyKey)) provider.set(args.idempotencyKey, created());
    if (lost) { lost = false; throw new Error("transport uncertain"); } return provider.get(args.idempotencyKey);
  } };
  await assert.rejects(() => createInvitationCheckout(store, TOKEN, options), /transport uncertain/);
  assert.equal((await store.load()).emailInvitations[0].checkout, undefined);
  const result = await createInvitationCheckout(store, TOKEN, options);
  assert.equal(result.sessionId, "cs_test_invitation"); assert.equal(provider.size, 1);
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
});

test("failed local persistence retries the exact same provider key and keeps no partial checkout state", async () => {
  const store = fixture(); const keys = []; const provider = new Map();
  const options = { ...EXPECTED, resolvePromotion: async () => quote(), createSession: async args => {
    keys.push(args.idempotencyKey); if (!provider.has(args.idempotencyKey)) provider.set(args.idempotencyKey, created());
    return provider.get(args.idempotencyKey);
  } };
  const save = store.save.bind(store); let failSave = true;
  store.save = async () => { if (failSave) { failSave = false; throw new Error("disk unavailable"); } return save(); };
  await assert.rejects(() => createInvitationCheckout(store, TOKEN, options), /disk unavailable/);
  assert.equal((await store.load()).emailInvitations[0].checkout, undefined);
  await createInvitationCheckout(store, TOKEN, options);
  assert.equal(provider.size, 1); assert.equal(keys[0], keys[1]);
});

test("only an expired unpaid checkout advances to one new stable attempt", async () => {
  const store = fixture(); await attach(store); const calls = [];
  const options = { ...EXPECTED, resolvePromotion: async () => quote(),
    retrieveSession: async id => id === "cs_test_invitation" ? session({ status: "expired" }) : session({ id }),
    createSession: async args => { calls.push(args); return created("cs_test_replacement"); } };
  const first = await createInvitationCheckout(store, TOKEN, options);
  const second = await createInvitationCheckout(store, TOKEN, options);
  assert.equal(first.sessionId, "cs_test_replacement"); assert.equal(second.sessionId, first.sessionId);
  assert.equal(calls.length, 1); assert.equal(calls[0].idempotencyKey, `lastro-invitation:${ID}:1`);
  assert.equal((await store.load()).emailInvitations[0].checkout.attempt, 1);
});

test("foreign session identifiers, metadata, amounts and currencies cannot prepare a replacement checkout", async () => {
  const invalid = [session({ id: "cs_test_foreign" }),
    session({ amount_total: 1800 }), session({ currency: "usd" }),
    session({ metadata: { ...session().metadata, invitation_id: "inv_foreign" } }),
    session({ metadata: { ...session().metadata, purpose: "another_product" } }),
    session({ metadata: { ...session().metadata, pricing_total_cents: "700" } })];
  for (const value of invalid) {
    const store = fixture(); await attach(store); const before = structuredClone(await store.load());
    const options = { ...EXPECTED, retrieveSession: async () => value,
      resolvePromotion: async () => assert.fail("invalid existing session"), createSession: async () => assert.fail("no replacement") };
    await assert.rejects(() => createInvitationCheckout(store, TOKEN, options), { code: "INVITATION_CHECKOUT_MISMATCH" });
    assert.deepEqual(await store.load(), before);
    await assert.rejects(() => resolveEmailInvitation(store, TOKEN, { baseUrl: "https://www.lastro.fr", retrieveSession: options.retrieveSession }));
  }
});

test("an expired session marked paid never opens another checkout and retains its confirmed entitlement", async () => {
  const store = fixture(); await attach(store);
  const retrieveSession = async () => session({ status: "expired", payment_status: "paid" });
  await assert.rejects(() => createInvitationCheckout(store, TOKEN, { ...EXPECTED, retrieveSession,
    resolvePromotion: async () => assert.fail("no new quote"), createSession: async () => assert.fail("no new payment") }), { code: "INVITATION_CHECKOUT_MISMATCH" });
  const result = await resolveEmailInvitation(store, TOKEN, { baseUrl: "https://www.lastro.fr", retrieveSession,
    resolvePromotion: async () => assert.fail("payment already confirmed") });
  assert.equal(result.invitation.paymentConfirmed, true); assert.equal(result.invitation.quote.totalCents, 800);
});

test("payer email may differ from the invitation recipient without changing the delivered recipient", async () => {
  const store = fixture(); await attach(store);
  const retrieveSession = async () => session({ status: "complete", payment_status: "paid",
    customer_email: "payer@example.invalid", customer_details: { email: "payer@example.invalid" } });
  const replay = await createInvitationCheckout(store, TOKEN, { ...EXPECTED, retrieveSession,
    resolvePromotion: async () => assert.fail("already prepared"), createSession: async () => assert.fail("no new payment") });
  const resolved = await resolveEmailInvitation(store, TOKEN, { baseUrl: "https://www.lastro.fr", retrieveSession,
    resolvePromotion: async () => assert.fail("redeemed promotion need not remain unused") });
  assert.equal(replay.sessionId, "cs_test_invitation"); assert.equal(resolved.invitation.paymentConfirmed, true);
  assert.equal(resolved.invitation.recipientEmail, EMAIL); assert.equal((await store.load()).emailInvitations[0].recipientEmail, EMAIL);
});

test("stale displayed prices, invalid promotions and malformed provider replies fail without changing the invitation", async () => {
  for (const expected of [{ expectedTotalCents: 1800, expectedCurrency: "eur" }, { expectedTotalCents: 800, expectedCurrency: "usd" }]) {
    const store = fixture(); await assert.rejects(() => createInvitationCheckout(store, TOKEN, expected), { code: "PRICING_CHANGED" });
  }
  for (const mutation of [{ valid: false }, { totalCents: 700 }, { stripePromotionCodeId: "promo_other" }, { currency: "usd" }]) {
    const store = fixture(); const before = structuredClone(await store.load());
    await assert.rejects(() => createInvitationCheckout(store, TOKEN, { ...EXPECTED,
      resolvePromotion: async () => ({ ...quote(), ...mutation }), createSession: async () => assert.fail("no checkout") }), { code: "INVITATION_DISCOUNT_UNAVAILABLE" });
    assert.deepEqual(await store.load(), before);
  }
  const store = fixture(); const before = structuredClone(await store.load());
  await assert.rejects(() => createInvitationCheckout(store, TOKEN, { ...EXPECTED,
    resolvePromotion: async () => quote(), createSession: async () => created("wrong-id") }), { code: "INVITATION_CHECKOUT_MISMATCH" });
  assert.deepEqual(await store.load(), before);
});

test("unavailable redemption resolves explicitly without manufacturing a full-price fallback", async () => {
  const store = fixture(); const before = structuredClone(await store.load());
  const result = await resolveEmailInvitation(store, TOKEN, { baseUrl: "https://www.lastro.fr",
    resolvePromotion: async () => { throw Object.assign(new Error("unavailable"), { code: "INVITATION_DISCOUNT_UNAVAILABLE" }); } });
  assert.equal(result.invitation.status, "unavailable"); assert.equal(result.invitation.quote, null);
  assert.deepEqual(await store.load(), before);
});
