import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { JsonStore, createEmptyState } from "../src/db/jsonStore.mjs";
import { hashAccessCode } from "../src/models/accessCodeService.mjs";
import { createPaidDelivery } from "../src/models/publicDeliveryService.mjs";
import {
  createEmailInvitation, findInvitationByToken, invitationPublicView, listAdminEmailInvitations,
  requireInvitation, INVITATION_EMAIL_TYPE
} from "../src/models/emailInvitationService.mjs";

const ADMIN = { id: "owner", primaryRole: "admin" };
const EMAIL = "reader@example.invalid";
const BASE = "https://www.lastro.fr";
const CLEAR = "ABCD2345EFGH";
const NOW = Date.now();
const PROMOTIONS = [{ id: "promo_sample1", batchId: "11111111-1111-4111-8111-111111111111" },
  { id: "promo_sample2", batchId: "11111111-1111-4111-8111-111111111111" }];

function fixture({ freeCount = 2 } = {}) {
  const state = createEmptyState();
  state.users.push(structuredClone(ADMIN));
  state.accessCodes = Array.from({ length: freeCount }, (_, i) => ({
    id: `grant_${i}`, hash: hashAccessCode(i === 0 ? CLEAR : `OTHERGRANT${i}`),
    codeLength: 12, usageLimit: 1, usedAt: null, revokedAt: null, deliveryReference: null,
    expiresAt: null, batchId: "22222222-2222-4222-8222-222222222222"
  }));
  return new JsonStore(null, state);
}

function input(extra = {}) { return { email: EMAIL, kind: "free", requestId: randomUUID(), ...extra }; }
async function invite(store, extra = {}, options = {}) {
  return createEmailInvitation(store, ADMIN, input(extra), { baseUrl: BASE, promotionInventory: PROMOTIONS, now: NOW, ...options });
}
function tokenFrom(state, invitation) {
  return state.outbox.find(mail => mail.invitationId === invitation.id).body.match(/#invitation=([A-Za-z0-9_-]{43})/)[1];
}
async function use(store, token, extra = {}) {
  return createPaidDelivery(store, { invitationToken: token, email: EMAIL, freeAccess: true, amountCents: 0, currency: "eur", ...extra }, NOW);
}

test("admin reservation creates one grant-backed e-mail and exposes no secret in its response", async () => {
  const store = fixture(); const result = await invite(store); const state = await store.load();
  assert.equal(result.created, true); assert.equal(state.emailInvitations.length, 1);
  const invitation = state.emailInvitations[0]; const token = tokenFrom(state, invitation);
  assert.equal(invitation.tokenHash.length, 64); assert.equal(invitation.token, undefined);
  assert.equal(state.accessCodes[0].emailInvitationId, invitation.id);
  assert.equal(state.accessCodes[0].usedAt, null); assert.equal(invitation.usedAt, null);
  assert.equal(state.outbox.length, 1); assert.equal(state.outbox[0].type, INVITATION_EMAIL_TYPE);
  assert.equal(state.outbox[0].attachments[0].name, "invitation-lastro.png");
  assert.equal(state.auditLogs.length, 1);
  const response = JSON.stringify(result);
  assert.ok(!response.includes(token)); assert.ok(!response.includes(invitation.tokenHash));
  assert.ok(!response.includes("#invitation")); assert.ok(!response.includes(CLEAR));
  assert.equal(result.invitation.mail.status, "pending");
});

test("read-only listing does not initialize a missing invitation registry", async () => {
  const store = fixture(); const before = structuredClone(await store.load());
  const result = await listAdminEmailInvitations(store, ADMIN, { promotionInventory: PROMOTIONS });
  assert.deepEqual(await store.load(), before); assert.equal(result.invitations.length, 0);
  assert.deepEqual(result.inventory, { freeAvailable: 2, discountAvailable: 2, freeAssigned: 0, discountAssigned: 0, used: 0 });
});

test("same request and same recipient replay never allocate another grant or e-mail", async () => {
  const store = fixture(); const request = input({ email: " Reader@Example.Invalid " });
  const first = await createEmailInvitation(store, ADMIN, request, { baseUrl: BASE });
  const before = structuredClone(await store.load());
  const second = await createEmailInvitation(store, ADMIN, { ...request, email: EMAIL }, { baseUrl: BASE });
  const third = await invite(store);
  assert.equal(second.created, false); assert.equal(third.created, false);
  assert.equal(first.invitation.id, second.invitation.id); assert.equal(first.invitation.id, third.invitation.id);
  assert.deepEqual(await store.load(), before);
});

test("reusing an idempotency request for another benefit or address is blocked", async () => {
  const store = fixture(); const request = input();
  await createEmailInvitation(store, ADMIN, request, { baseUrl: BASE });
  const before = structuredClone(await store.load());
  for (const change of [{ email: "other@example.invalid" }, { kind: "discount10" }, { language: "en" }]) {
    await assert.rejects(() => createEmailInvitation(store, ADMIN, { ...request, ...change }, { baseUrl: BASE, promotionInventory: PROMOTIONS }), { code: "INVITATION_REQUEST_CONFLICT" });
  }
  assert.deepEqual(await store.load(), before);
});

test("concurrent admin submissions and retries reserve one existing grant", async () => {
  const store = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => invite(store)));
  assert.equal(results.filter(row => row.created).length, 1);
  assert.equal((await store.load()).outbox.length, 1);
  assert.equal((await store.load()).emailInvitations.length, 1);
});

test("different recipients cannot share the last available free or discount grant", async () => {
  for (const kind of ["free", "discount10"]) {
    const store = fixture({ freeCount: 1 });
    const results = await Promise.allSettled([invite(store, { kind }, { promotionInventory: PROMOTIONS.slice(0, 1) }),
      invite(store, { kind, email: "another@example.invalid" }, { promotionInventory: PROMOTIONS.slice(0, 1) })]);
    assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
    assert.equal(results.find(row => row.status === "rejected").reason.code, "INVITATION_OUT_OF_STOCK");
  }
});

test("discount reservation keeps its provider identifier server-only and consumes no credit", async () => {
  const store = fixture(); const result = await invite(store, { kind: "discount10" });
  const state = await store.load();
  assert.equal(state.emailInvitations[0].stripePromotionCodeId, "promo_sample1");
  assert.equal(state.accessCodes.some(row => row.emailInvitationId), false);
  assert.equal(JSON.stringify(result).includes("promo_sample1"), false);
  const list = await listAdminEmailInvitations(store, ADMIN, { promotionInventory: PROMOTIONS });
  assert.equal(list.inventory.discountAvailable, 1); assert.equal(list.inventory.discountAssigned, 1);
  assert.deepEqual(state.orders, []); assert.deepEqual(state.creditLedger, []); assert.deepEqual(state.publicReadings, []);
});

test("unavailable inventory fails explicitly and never creates a fallback grant", async () => {
  for (const options of [{ freeCount: 0 }, { freeCount: 1 }]) {
    const store = fixture(options); const before = structuredClone(await store.load());
    if (!options.freeCount) await assert.rejects(() => invite(store), { code: "INVITATION_OUT_OF_STOCK" });
    await assert.rejects(() => invite(store, { kind: "discount10" }, { promotionInventory: [] }), { code: "INVITATION_OUT_OF_STOCK" });
    await assert.rejects(() => invite(store, { kind: "discount10" }, { promotionInventory: null }), { code: "INVITATION_INVENTORY_UNAVAILABLE" });
    assert.deepEqual(await store.load(), before);
  }
});

test("used, revoked, expired, legacy and already allocated free codes are never selected", async () => {
  const store = fixture({ freeCount: 6 }); const state = await store.load();
  state.accessCodes[0].usedAt = new Date(NOW).toISOString();
  state.accessCodes[1].revokedAt = new Date(NOW).toISOString();
  state.accessCodes[2].expiresAt = new Date(NOW - 1).toISOString();
  state.accessCodes[3].codeLength = 6;
  state.accessCodes[4].emailInvitationId = "previous";
  await invite(store);
  assert.equal(state.emailInvitations[0].accessCodeId, "grant_5");
});

test("permissions are checked against the stored administrator before allocation", async () => {
  for (const actor of [null, { id: "owner", primaryRole: "reader" }, { id: "missing", primaryRole: "admin" }, { ...ADMIN, deletedAt: "now" }]) {
    const store = fixture(); const before = structuredClone(await store.load());
    await assert.rejects(() => createEmailInvitation(store, actor, input(), { baseUrl: BASE }));
    assert.deepEqual(await store.load(), before);
  }
  const store = fixture(); (await store.load()).users[0].primaryRole = "reader";
  await assert.rejects(() => invite(store), { code: "ADMIN_INVITATIONS_FORBIDDEN" });
  await assert.rejects(() => listAdminEmailInvitations(store, ADMIN), { code: "ADMIN_INVITATIONS_FORBIDDEN" });
});

test("invalid input, injected pricing and arbitrary link destinations cannot create an invitation", async () => {
  const store = fixture(); const before = structuredClone(await store.load());
  const badInputs = [input({ email: "not-an-email" }), input({ email: "x@example.invalid\nBcc:bad@example.invalid" }),
    input({ kind: "unlimited" }), input({ requestId: "bad" }), input({ language: "xx" }), input({ amountCents: 0 }),
    Object.assign(Object.create({ polluted: true }), input())];
  for (const bad of badInputs) await assert.rejects(() => createEmailInvitation(store, ADMIN, bad, { baseUrl: BASE }));
  for (const baseUrl of ["https://evil.example/", "http://www.lastro.fr/", "https://www.lastro.fr/path", "https://www.lastro.fr/?recipient=x", "https://user:pw@www.lastro.fr/"]) {
    await assert.rejects(() => invite(store, {}, { baseUrl }), { code: "INVITATION_BASE_URL_INVALID" });
  }
  assert.deepEqual(await store.load(), before);
});

test("token inspection and public view never consume or mutate the invitation", async () => {
  const store = fixture(); const result = await invite(store); const state = await store.load(); const token = tokenFrom(state, result.invitation);
  const before = structuredClone(state); const record = requireInvitation(state, token);
  assert.equal(findInvitationByToken(state, "x".repeat(43)), null);
  assert.equal(findInvitationByToken(state, token.slice(1)), null);
  assert.equal(record.id, result.invitation.id);
  assert.equal(invitationPublicView(state, record).status, "available");
  assert.deepEqual(state, before);
  assert.throws(() => requireInvitation(state, token, { email: "other@example.invalid" }), { code: "INVITATION_EMAIL_MISMATCH" });
});

test("grant reservation and its queued message roll back together on storage failure", async () => {
  const store = fixture(); const before = structuredClone(await store.load());
  store.save = async () => { throw new Error("disk failure"); };
  await assert.rejects(() => invite(store), /disk failure/);
  assert.deepEqual(await store.load(), before);
});

test("free invitation creates exactly one delivery and binds the existing grant atomically", async () => {
  const store = fixture(); const result = await invite(store); const state = await store.load(); const token = tokenFrom(state, result.invitation);
  const attempts = await Promise.all(Array.from({ length: 6 }, () => use(store, token)));
  assert.equal(attempts.filter(row => row.created).length, 1);
  assert.equal(new Set(attempts.map(row => row.delivery.id)).size, 1);
  const after = await store.load(); const row = after.emailInvitations[0];
  assert.equal(after.publicReadings.length, 1); assert.equal(row.deliveryId, after.publicReadings[0].id);
  assert.equal(row.deliveryReference, after.accessCodes[0].deliveryReference);
  assert.equal(after.accessCodes[0].usedAt, row.usedAt);
  assert.equal(after.publicReadings[0].emailInvitationId, row.id);
  assert.equal(after.outbox.length, 1, "creating a reading does not duplicate the invitation e-mail");
});

test("recipient and amount checks cannot be bypassed for free invitations", async () => {
  for (const change of [{ email: "other@example.invalid" }, { email: undefined }, { freeAccess: false },
    { amountCents: 800 }, { currency: "usd" }, { paymentSessionId: "cs_elsewhere" }, { accessCode: "OTHERGRANT1" }]) {
    const store = fixture(); const result = await invite(store); const token = tokenFrom(await store.load(), result.invitation);
    const before = structuredClone(await store.load());
    await assert.rejects(() => use(store, token, change));
    assert.deepEqual(await store.load(), before);
  }
});

test("clear reserved code cannot bypass its recipient binding, while correct recipient still works", async () => {
  const store = fixture(); await invite(store); const before = structuredClone(await store.load());
  await assert.rejects(() => createPaidDelivery(store, { accessCode: CLEAR, email: "other@example.invalid", freeAccess: true, amountCents: 0, currency: "eur" }), { code: "INVITATION_EMAIL_MISMATCH" });
  await assert.rejects(() => createPaidDelivery(store, { accessCode: CLEAR, freeAccess: true, amountCents: 0, currency: "eur" }), { code: "INVITATION_EMAIL_INVALID" });
  assert.deepEqual(await store.load(), before);
  const result = await createPaidDelivery(store, { accessCode: CLEAR, email: EMAIL, freeAccess: true, amountCents: 0, currency: "eur" });
  assert.equal(result.created, true); assert.equal((await store.load()).emailInvitations[0].deliveryId, result.delivery.id);
});

test("concurrent clear-code and link attempts cannot grant two free readings", async () => {
  const store = fixture(); const result = await invite(store); const token = tokenFrom(await store.load(), result.invitation);
  await Promise.allSettled([use(store, token), createPaidDelivery(store, { accessCode: CLEAR, email: EMAIL, freeAccess: true, amountCents: 0, currency: "eur" }, NOW)]);
  assert.equal((await store.load()).publicReadings.length, 1);
});

test("discount invitation is bound to its exact provider-verified session and immutable price", async () => {
  const store = fixture(); const result = await invite(store, { kind: "discount10" }); const state = await store.load();
  const token = tokenFrom(state, result.invitation); state.emailInvitations[0].checkout = { sessionId: "cs_invite" };
  for (const change of [{ paymentSessionId: "cs_other" }, { amountCents: 1800 }, { amountCents: 0 }, { currency: "usd" }, { freeAccess: true }, { email: "other@example.invalid" }]) {
    const before = structuredClone(await store.load());
    await assert.rejects(() => use(store, token, { freeAccess: false, amountCents: 800, paymentSessionId: "cs_invite", ...change }));
    assert.deepEqual(await store.load(), before);
  }
  const created = await use(store, token, { freeAccess: false, amountCents: 800, paymentSessionId: "cs_invite" });
  assert.equal(created.created, true); assert.equal(created.delivery.amountCents, 800);
  assert.equal((await store.load()).accessCodes.some(row => row.usedAt), false);
  const replay = await use(store, token, { freeAccess: false, amountCents: 800, paymentSessionId: "cs_invite" });
  assert.equal(replay.created, false); assert.equal(replay.delivery.id, created.delivery.id);
});

test("used invitation replay keeps failed or ready reading and never replenishes a consumed grant", async () => {
  for (const status of ["failed", "ready", "queued", "generating"]) {
    const store = fixture(); const result = await invite(store); const token = tokenFrom(await store.load(), result.invitation);
    const first = await use(store, token); const state = await store.load();
    state.publicReadings[0].status = status;
    const before = structuredClone(state); const second = await use(store, token);
    assert.equal(second.created, false); assert.equal(second.delivery.id, first.delivery.id);
    assert.equal(second.delivery.status, status); assert.deepEqual(await store.load(), before);
  }
});

test("expired or missing retained delivery never recreates a reading from a used link", async () => {
  for (const missing of [false, true]) {
    const store = fixture(); const result = await invite(store); const token = tokenFrom(await store.load(), result.invitation);
    await use(store, token); const state = await store.load();
    if (missing) state.publicReadings = [];
    else state.publicReadings[0].expiresAt = new Date(NOW - 1).toISOString();
    const before = structuredClone(state);
    await assert.rejects(() => use(store, token), { code: "INVITATION_DELIVERY_EXPIRED" });
    assert.deepEqual(await store.load(), before);
  }
});

test("delivery and invitation consumption both roll back when persistence fails", async () => {
  const store = fixture(); const result = await invite(store); const token = tokenFrom(await store.load(), result.invitation);
  const before = structuredClone(await store.load()); store.save = async () => { throw new Error("disk failed"); };
  await assert.rejects(() => use(store, token), /disk failed/); assert.deepEqual(await store.load(), before);
});

test("server restart retains reservation, queued mail, token hash and the same used delivery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lastro-invitation-test-"));
  try {
    const seed = structuredClone(await fixture().load()); const path = join(directory, "state.json");
    const first = new JsonStore(path, seed); const result = await invite(first);
    const token = tokenFrom(await first.load(), result.invitation);
    const second = new JsonStore(path); const before = structuredClone(await second.load());
    const replay = await invite(second); assert.equal(replay.created, false);
    assert.deepEqual(await second.load(), before);
    const created = await use(second, token);
    const third = new JsonStore(path); const usedReplay = await use(third, token);
    assert.equal(usedReplay.created, false); assert.equal(usedReplay.delivery.id, created.delivery.id);
    assert.equal((await third.load()).publicReadings.length, 1); assert.equal((await third.load()).outbox.length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("admin usage view differentiates provider acceptance, uncertainty and a completed reading", async () => {
  const store = fixture(); const result = await invite(store); const state = await store.load(); const token = tokenFrom(state, result.invitation);
  state.outbox[0].status = "sent"; state.outbox[0].sentAt = new Date(NOW).toISOString();
  let list = await listAdminEmailInvitations(store, ADMIN);
  assert.equal(list.invitations[0].mail.status, "sent"); assert.equal(list.invitations[0].mail.acceptedAt, new Date(NOW).toISOString());
  assert.equal(list.invitations[0].usage.status, "available");
  state.outbox[0].manualReviewRequired = true;
  list = await listAdminEmailInvitations(store, ADMIN); assert.equal(list.invitations[0].mail.status, "unknown");
  await use(store, token); list = await listAdminEmailInvitations(store, ADMIN);
  assert.equal(list.invitations[0].usage.status, "used"); assert.equal(list.inventory.used, 1);
  assert.equal(list.invitations[0].usage.reference, state.publicReadings[0].reference);
  assert.ok(!JSON.stringify(list).includes(token)); assert.ok(!JSON.stringify(list).includes("tokenHash"));
});
