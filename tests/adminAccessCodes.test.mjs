import assert from "node:assert/strict";
import test from "node:test";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { hashAccessCode, checkAccessCode, createAccessCodes, revokeAccessCode } from "../src/models/accessCodeService.mjs";
import { createPaidDelivery } from "../src/models/publicDeliveryService.mjs";
import { importAdminAccessCodeBatch, readAdminAccessCodeBatch } from "../src/models/adminAccessCodes.mjs";

const BATCH = "00000000-0000-4000-8000-000000000001";
const OTHER_BATCH = "00000000-0000-4000-8000-000000000002";
const ADMIN = { id: "admin_test", primaryRole: "admin", deletedAt: null };
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function code(index) {
  let value = index, tail = "";
  for (let i = 0; i < 4; i++) { tail = ALPHABET[value % 32] + tail; value = Math.floor(value / 32); }
  return "ZX" + tail;
}
function input({ count = 20, batchId = BATCH, offset = 0 } = {}) {
  return { batchId, label: "Lot fictif de test", codeLength: 6, codes: Array.from({ length: count }, (_, i) => hashAccessCode(code(offset + i))) };
}
function store() {
  const db = new JsonStore(null);
  db.state.users.push({ ...ADMIN });
  return db;
}
const fails = (status, code) => (error) => { assert.equal(error.status, status); if (code) assert.equal(error.code, code); return true; };

test("admin import creates twenty six-character single-use entries and returns no secrets", async () => {
  const db = store(), request = input();
  const result = await importAdminAccessCodeBatch(db, ADMIN, request);
  assert.equal(result.batchId, BATCH);
  assert.equal(result.createdCount, 20);
  assert.equal(result.totalCount, 20);
  assert.equal(result.usageLimit, 1);
  assert.equal(result.codeLength, 6);
  assert.equal(new Set(result.ids).size, 20);
  assert.deepEqual(result.states, { available: 20, used: 0, revoked: 0, expired: 0 });
  for (let i = 0; i < 20; i++) {
    assert.equal(checkAccessCode(db.state, code(i)).ok, true);
    assert.ok(!JSON.stringify(db.state).includes(code(i)));
    assert.ok(!JSON.stringify(result).includes(request.codes[i]));
  }
  assert.ok(db.state.accessCodes.every((entry) => entry.batchId === BATCH && entry.codeLength === 6 && entry.usageLimit === 1 && entry.expiresAt === null));
  assert.equal(db.state.auditLogs.length, 1);
  const audit = JSON.stringify(db.state.auditLogs);
  assert.ok(request.codes.every((hash) => !audit.includes(hash)));
  assert.deepEqual(db.state.auditLogs[0].after, { count: 20, codeLength: 6, usageLimit: 1 });
  const verified = await readAdminAccessCodeBatch(db, ADMIN, BATCH);
  assert.deepEqual(verified.ids, result.ids);
  assert.deepEqual(verified.states, result.states);
  assert.equal(verified.createdCount, 0);
  assert.ok(request.codes.every((hash) => !JSON.stringify(verified).includes(hash)));
});

test("a replay, reordered hashes and canonical hash casing never recreate or reset codes", async () => {
  const db = store(), request = input();
  const first = await importAdminAccessCodeBatch(db, ADMIN, request);
  const before = JSON.stringify(db.state);
  const second = await importAdminAccessCodeBatch(db, ADMIN, { ...request, codes: [...request.codes].reverse().map((hash) => hash.toUpperCase()) });
  assert.equal(second.createdCount, 0);
  assert.deepEqual(second.ids, first.ids);
  assert.equal(JSON.stringify(db.state), before);
});

test("concurrent same-batch imports create exactly one batch and one audit record", async () => {
  const db = store(), request = input();
  const results = await Promise.all(Array.from({ length: 6 }, () => importAdminAccessCodeBatch(db, ADMIN, request)));
  assert.deepEqual(results.map((entry) => entry.createdCount).sort((a, b) => a - b), [0, 0, 0, 0, 0, 20]);
  assert.equal(db.state.accessCodes.length, 20);
  assert.equal(db.state.auditLogs.length, 1);
  for (const result of results) assert.deepEqual(result.ids, results[0].ids);
});

test("concurrent conflicting uses of one batch identifier cannot overwrite the winner", async () => {
  const db = store();
  const results = await Promise.allSettled([
    importAdminAccessCodeBatch(db, ADMIN, input()),
    importAdminAccessCodeBatch(db, ADMIN, input({ offset: 30 }))
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "ACCESS_CODE_BATCH_CONFLICT");
  assert.equal(db.state.accessCodes.length, 20);
  assert.equal(db.state.auditLogs.length, 1);
});

test("short imported codes retain the existing atomic single-consumption behaviour", async () => {
  const db = store(), request = input();
  await importAdminAccessCodeBatch(db, ADMIN, request);
  const options = { freeAccess: true, accessCode: code(0), email: null, amountCents: 0, currency: "eur", language: "fr" };
  const results = await Promise.allSettled([createPaidDelivery(db, options), createPaidDelivery(db, options)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "access_code_utilise");
  assert.equal(db.state.publicReadings.length, 1);
  assert.equal(db.state.outbox.length, 0);
  const entry = db.state.accessCodes.find((value) => value.hash === hashAccessCode(code(0)));
  const usedAt = entry.usedAt, reference = entry.deliveryReference;
  assert.ok(usedAt && reference);
  const replay = await importAdminAccessCodeBatch(db, ADMIN, request);
  assert.equal(replay.createdCount, 0);
  assert.equal(entry.usedAt, usedAt);
  assert.equal(entry.deliveryReference, reference);
  assert.deepEqual((await readAdminAccessCodeBatch(db, ADMIN, BATCH)).states, { available: 19, used: 1, revoked: 0, expired: 0 });
});

test("a replay does not undo a revocation", async () => {
  const db = store(), request = input();
  await importAdminAccessCodeBatch(db, ADMIN, request);
  await db.transact((state) => revokeAccessCode(state, code(0)));
  const before = JSON.stringify(db.state);
  await importAdminAccessCodeBatch(db, ADMIN, request);
  assert.equal(JSON.stringify(db.state), before);
  assert.deepEqual((await readAdminAccessCodeBatch(db, ADMIN, BATCH)).states, { available: 19, used: 0, revoked: 1, expired: 0 });
});

for (const [name, change] of [
  ["different hashes", (value) => { value.codes[0] = hashAccessCode(code(50)); }],
  ["different count", (value) => { value.codes.pop(); }],
  ["different label", (value) => { value.label = "Other label"; }]
]) {
  test(`same batch with ${name} fails without changing any state`, async () => {
    const db = store(), request = input();
    await importAdminAccessCodeBatch(db, ADMIN, request);
    const changed = structuredClone(request); change(changed);
    const before = JSON.stringify(db.state);
    await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, changed), fails(409, "ACCESS_CODE_BATCH_CONFLICT"));
    assert.equal(JSON.stringify(db.state), before);
  });
}

test("a collision with another batch or a legacy code rolls back the entire import", async () => {
  const db = store();
  await importAdminAccessCodeBatch(db, ADMIN, input());
  const request = input({ batchId: OTHER_BATCH, offset: 50 });
  request.codes[1] = hashAccessCode(code(0));
  const before = JSON.stringify(db.state);
  await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, request), fails(409, "ACCESS_CODE_HASH_CONFLICT"));
  assert.equal(JSON.stringify(db.state), before);
  const legacy = createAccessCodes(db.state, { count: 1 })[0];
  const legacyBefore = JSON.stringify(db.state);
  await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, { ...request, codes: [hashAccessCode(legacy.code)] }), fails(409, "ACCESS_CODE_HASH_CONFLICT"));
  assert.equal(JSON.stringify(db.state), legacyBefore);
  assert.equal(legacy.code.replaceAll("-", "").length, 16);
});

test("saving failure restores codes and audit, and the transaction queue remains usable", async () => {
  const db = store(), originalSave = db.save.bind(db), before = JSON.stringify(db.state);
  db.save = async () => { throw new Error("SIMULATED_SAVE_FAILURE"); };
  await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, input()), /SIMULATED_SAVE_FAILURE/);
  assert.equal(JSON.stringify(db.state), before);
  db.save = originalSave;
  assert.equal((await importAdminAccessCodeBatch(db, ADMIN, input())).createdCount, 20);
});

for (const [name, invalid] of [
  ["missing", undefined], ["null", null], ["array", []], ["missing batch", {}],
  ["non-UUID", { ...input(), batchId: "not-a-uuid" }],
  ["too long label", { ...input(), label: "x".repeat(121) }],
  ["control label", { ...input(), label: "line\nbreak" }],
  ["empty batch", { ...input(), codes: [] }],
  ["too many codes", input({ count: 101 })],
  ["plaintext instead of hash", { ...input(), codes: ["ZXAAAA"] }],
  ["wrong hash length", { ...input(), codes: ["a".repeat(63)] }],
  ["duplicate hash", { ...input(), codes: [hashAccessCode(code(0)), hashAccessCode(code(0)).toUpperCase()] }],
  ["wrong declared length", { ...input(), codeLength: 16 }],
  ["usage override", { ...input(), usageLimit: 2 }],
  ["state injection", { ...input(), usedAt: null }],
  ["expiry injection", { ...input(), expiresAt: "2030-01-01" }]
]) {
  test(`invalid import (${name}) fails before any mutation`, async () => {
    const db = store(), before = JSON.stringify(db.state);
    await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, invalid), fails(400, "INVALID_ACCESS_CODE_BATCH"));
    assert.equal(JSON.stringify(db.state), before);
  });
}

test("input accessors and sparse arrays are rejected without executing a getter", async () => {
  const db = store();
  const request = input();
  Object.defineProperty(request, "label", { get() { assert.fail("getter executed"); }, enumerable: true });
  await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, request), fails(400));
  await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, { ...input(), codes: Array(2) }), fails(400));
});

test("validated input is copied before a queued transaction can run", async () => {
  const db = store();
  let unlock;
  db.queue = new Promise((resolve) => { unlock = resolve; });
  const request = input(), original = [...request.codes];
  const pending = importAdminAccessCodeBatch(db, ADMIN, request);
  request.codes[0] = hashAccessCode(code(50)); request.label = "Changed after submission";
  unlock();
  await pending;
  assert.deepEqual(db.state.accessCodes.map((entry) => entry.hash).sort(), original.sort());
  assert.equal(db.state.accessCodes[0].label, "Lot fictif de test");
});

for (const [name, user, status] of [
  ["unauthenticated", null, 401],
  ["no id", { primaryRole: "admin" }, 401],
  ["ordinary user", { id: "admin_test", primaryRole: "user" }, 403],
  ["deleted caller", { ...ADMIN, deletedAt: "2026-01-01T00:00:00Z" }, 403]
]) {
  test(`import and verification refuse ${name}`, async () => {
    const db = store(), before = JSON.stringify(db.state);
    await assert.rejects(importAdminAccessCodeBatch(db, user, input()), fails(status));
    await assert.rejects(readAdminAccessCodeBatch(db, user, BATCH), fails(status));
    assert.equal(JSON.stringify(db.state), before);
  });
}

test("a stale admin object cannot bypass a persisted demotion or deletion", async () => {
  for (const change of [user => { user.primaryRole = "user"; }, user => { user.deletedAt = "2026-01-01T00:00:00Z"; }]) {
    const db = store(); change(db.state.users[0]);
    await assert.rejects(importAdminAccessCodeBatch(db, { ...ADMIN }, input()), fails(403));
    await assert.rejects(readAdminAccessCodeBatch(db, { ...ADMIN }, BATCH), fails(403));
    assert.equal(db.state.accessCodes.length, 0);
  }
});

test("verification is read-only, unknown batch is 404, and returned data cannot mutate the registry", async () => {
  const db = store();
  await assert.rejects(readAdminAccessCodeBatch(db, ADMIN, BATCH), fails(404, "ACCESS_CODE_BATCH_NOT_FOUND"));
  await importAdminAccessCodeBatch(db, ADMIN, input());
  const before = JSON.stringify(db.state);
  const result = await readAdminAccessCodeBatch(db, ADMIN, BATCH);
  result.ids[0] = "changed"; result.states.available = 0;
  assert.equal(JSON.stringify(db.state), before);
  const again = await readAdminAccessCodeBatch(db, ADMIN, BATCH);
  assert.equal(again.states.available, 20);
  assert.ok(!again.ids.includes("changed"));
});

test("one and one hundred imported hashes are supported, and codeLength may be omitted", async () => {
  for (const count of [1, 100]) {
    const db = store(), request = input({ count }); delete request.codeLength;
    const result = await importAdminAccessCodeBatch(db, ADMIN, request);
    assert.equal(result.createdCount, count); assert.equal(result.codeLength, 6);
  }
});

test("twelve-character invitations retain their length, privacy and single atomic consumption on replay", async () => {
  const db = store();
  const clearCodes = Array.from({ length: 50 }, (_, index) => "FICTIF" + code(index));
  const request = { batchId: BATCH, label: "Invitations longues fictives", codeLength: 12, codes: clearCodes.map(hashAccessCode) };
  const created = await importAdminAccessCodeBatch(db, ADMIN, request);
  assert.equal(created.createdCount, 50);
  assert.equal(created.codeLength, 12);
  assert.equal(created.usageLimit, 1);
  assert.equal(created.states.available, 50);
  assert.equal(db.state.auditLogs[0].after.codeLength, 12);
  assert.ok(db.state.accessCodes.every(entry => entry.codeLength === 12));
  assert.ok(clearCodes.every(code => !JSON.stringify(db.state).includes(code)));
  assert.ok(request.codes.every(hash => !JSON.stringify(created).includes(hash)));
  const options = { freeAccess: true, accessCode: clearCodes[0], email: null, amountCents: 0, currency: "eur", language: "fr" };
  const uses = await Promise.allSettled([createPaidDelivery(db, options), createPaidDelivery(db, options)]);
  assert.equal(uses.filter(use => use.status === "fulfilled").length, 1);
  assert.equal(uses.find(use => use.status === "rejected").reason.code, "access_code_utilise");
  await db.transact(state => revokeAccessCode(state, clearCodes[1]));
  const before = JSON.stringify(db.state);
  const replay = await importAdminAccessCodeBatch(db, ADMIN, { ...request, codes: [...request.codes].reverse() });
  assert.equal(replay.createdCount, 0);
  assert.equal(replay.codeLength, 12);
  assert.equal(JSON.stringify(db.state), before);
  const summary = await readAdminAccessCodeBatch(db, ADMIN, BATCH);
  assert.equal(summary.codeLength, 12);
  assert.deepEqual(summary.states, { available: 48, used: 1, revoked: 1, expired: 0 });
  assert.equal(db.state.publicReadings.length, 1);
  assert.equal(db.state.outbox.length, 0);
});

test("a replay cannot relabel either batch length or merge long and short batches", async () => {
  for (const length of [6, 12]) {
    const db = store(), request = { ...input(), codeLength: length };
    await importAdminAccessCodeBatch(db, ADMIN, request);
    const before = JSON.stringify(db.state);
    await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, { ...request, codeLength: length === 6 ? 12 : 6 }), fails(409, "ACCESS_CODE_BATCH_CONFLICT"));
    assert.equal(JSON.stringify(db.state), before);
    assert.equal((await readAdminAccessCodeBatch(db, ADMIN, BATCH)).codeLength, length);
  }
  const db = store();
  await importAdminAccessCodeBatch(db, ADMIN, input());
  await importAdminAccessCodeBatch(db, ADMIN, { ...input({ batchId: OTHER_BATCH, offset: 30 }), codeLength: 12 });
  assert.equal((await readAdminAccessCodeBatch(db, ADMIN, BATCH)).codeLength, 6);
  assert.equal((await readAdminAccessCodeBatch(db, ADMIN, OTHER_BATCH)).codeLength, 12);
});

test("long invitations keep administrator permissions and all unsupported length declarations fail without mutation", async () => {
  const db = store(), request = { ...input(), codeLength: 12 };
  const before = JSON.stringify(db.state);
  for (const user of [null, { id: "ordinary", primaryRole: "user" }])
    await assert.rejects(importAdminAccessCodeBatch(db, user, request), fails(user ? 403 : 401));
  for (const codeLength of [null, "12", 0, 5, 7, 11, 13, 16, {}, [12]])
    await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, { ...request, codeLength }), fails(400, "INVALID_ACCESS_CODE_BATCH"));
  assert.equal(JSON.stringify(db.state), before);
});

test("verification rejects a corrupt mixed-length batch without changing stored usage", async () => {
  const db = store();
  await importAdminAccessCodeBatch(db, ADMIN, { ...input(), codeLength: 12 });
  db.state.accessCodes[0].codeLength = 6;
  const before = JSON.stringify(db.state);
  await assert.rejects(readAdminAccessCodeBatch(db, ADMIN, BATCH), fails(500, "ACCESS_CODE_REGISTRY_INVALID"));
  assert.equal(JSON.stringify(db.state), before);
});

function longReplacement() {
  return { batchId: OTHER_BATCH, label: "Remplacement fictif", codeLength: 12, supersedesBatchId: BATCH,
    codes: Array.from({ length: 50 }, (_, index) => hashAccessCode("FICTIF" + code(index))) };
}

test("replacing the unused short batch atomically preserves and revokes its twenty entries while adding fifty long invitations", async () => {
  const db = store();
  await importAdminAccessCodeBatch(db, ADMIN, input());
  const original = structuredClone(db.state.accessCodes);
  const replacement = longReplacement();
  const result = await importAdminAccessCodeBatch(db, ADMIN, replacement);
  assert.equal(result.codeLength, 12);
  assert.equal(result.createdCount, 50);
  assert.equal(result.states.available, 50);
  assert.equal(db.state.accessCodes.length, 70);
  const newEntries = db.state.accessCodes.filter(entry => entry.batchId === OTHER_BATCH);
  for (const previous of original) {
    const entry = db.state.accessCodes.find(entry => entry.id === previous.id);
    assert.deepEqual(entry, { ...previous, revokedAt: newEntries[0].createdAt, supersededByBatchId: OTHER_BATCH });
    assert.equal(checkAccessCode(db.state, code(original.indexOf(previous))).reason, "inconnu");
  }
  assert.ok(newEntries.every(entry => entry.supersedesBatchId === BATCH && entry.codeLength === 12));
  assert.deepEqual(db.state.auditLogs[1].after, { count: 50, codeLength: 12, usageLimit: 1, supersedesBatchId: BATCH, revokedCount: 20 });
  assert.deepEqual((await readAdminAccessCodeBatch(db, ADMIN, BATCH)).states, { available: 0, used: 0, revoked: 20, expired: 0 });
  const before = JSON.stringify(db.state);
  const replay = await importAdminAccessCodeBatch(db, ADMIN, replacement);
  assert.equal(replay.createdCount, 0);
  assert.equal(JSON.stringify(db.state), before);
  assert.equal(db.state.publicReadings.length, 0);
  assert.equal(db.state.outbox.length, 0);
});

for (const [name, change] of [
  ["used entry", state => { state.accessCodes[0].usedAt = "2026-01-01T00:00:00Z"; }],
  ["delivery reference", state => { state.accessCodes[0].deliveryReference = "L-FAKE-EXISTING"; }],
  ["linked reading", state => { state.publicReadings.push({ id: "fake_reading", accessCodeId: state.accessCodes[0].id }); }],
  ["revoked entry", state => { state.accessCodes[0].revokedAt = "2026-01-01T00:00:00Z"; }],
  ["expired entry", state => { state.accessCodes[0].expiresAt = "2020-01-01T00:00:00Z"; }],
  ["invalid expiry", state => { state.accessCodes[0].expiresAt = "invalid"; }],
  ["changed quota", state => { state.accessCodes[0].usageLimit = 2; }],
  ["changed length", state => { state.accessCodes[0].codeLength = 12; }],
  ["wrong count", state => { state.accessCodes.pop(); }],
  ["missing previous batch", state => { state.accessCodes = []; }]
]) test(`supersession refuses ${name} without revoking or adding any code`, async () => {
  const db = store();
  await importAdminAccessCodeBatch(db, ADMIN, input());
  change(db.state);
  const before = JSON.stringify(db.state);
  await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, longReplacement()), fails(409, "ACCESS_CODE_SUPERSESSION_CONFLICT"));
  assert.equal(JSON.stringify(db.state), before);
});

test("replacement replay binds its origin, does not reset new usage and detects tampering with old revocations", async () => {
  const db = store();
  await importAdminAccessCodeBatch(db, ADMIN, input());
  const replacement = longReplacement();
  await importAdminAccessCodeBatch(db, ADMIN, replacement);
  await createPaidDelivery(db, { freeAccess: true, accessCode: "FICTIF" + code(0), email: null, amountCents: 0, currency: "eur" });
  const before = JSON.stringify(db.state);
  const replay = await importAdminAccessCodeBatch(db, ADMIN, replacement);
  assert.equal(replay.createdCount, 0);
  assert.equal(replay.states.used, 1);
  assert.equal(JSON.stringify(db.state), before);
  const withoutOrigin = { ...replacement }; delete withoutOrigin.supersedesBatchId;
  await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, withoutOrigin), fails(409, "ACCESS_CODE_BATCH_CONFLICT"));
  assert.equal(JSON.stringify(db.state), before);
  db.state.accessCodes.find(entry => entry.batchId === BATCH).revokedAt = null;
  const tampered = JSON.stringify(db.state);
  await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, replacement), fails(409, "ACCESS_CODE_SUPERSESSION_CONFLICT"));
  assert.equal(JSON.stringify(db.state), tampered);
});

test("replacement rolls back revocations and creation together if persistence fails", async () => {
  const db = store();
  await importAdminAccessCodeBatch(db, ADMIN, input());
  const before = JSON.stringify(db.state), save = db.save.bind(db);
  db.save = async () => { throw new Error("SIMULATED_REPLACEMENT_SAVE_FAILURE"); };
  await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, longReplacement()), /SIMULATED_REPLACEMENT_SAVE_FAILURE/);
  assert.equal(JSON.stringify(db.state), before);
  db.save = save;
  assert.equal((await importAdminAccessCodeBatch(db, ADMIN, longReplacement())).createdCount, 50);
});

test("replacement input remains narrow and cannot target itself, another length or partial long batch", async () => {
  const db = store(), request = longReplacement(), before = JSON.stringify(db.state);
  for (const override of [{ supersedesBatchId: OTHER_BATCH }, { supersedesBatchId: null }, { supersedesBatchId: "bad" },
    { codeLength: 6 }, { codes: request.codes.slice(1) }])
    await assert.rejects(importAdminAccessCodeBatch(db, ADMIN, { ...request, ...override }), fails(400, "INVALID_ACCESS_CODE_BATCH"));
  assert.equal(JSON.stringify(db.state), before);
});

test("concurrent old-code consumption and replacement grant only the transaction that wins first", async () => {
  for (const replacementFirst of [false, true]) {
    const db = store();
    await importAdminAccessCodeBatch(db, ADMIN, input());
    const consume = () => createPaidDelivery(db, { freeAccess: true, accessCode: code(0), email: null, amountCents: 0, currency: "eur" });
    const replace = () => importAdminAccessCodeBatch(db, ADMIN, longReplacement());
    const calls = replacementFirst ? [replace, consume] : [consume, replace];
    const outcomes = await Promise.allSettled(calls.map(call => call()));
    assert.equal(outcomes[0].status, "fulfilled");
    assert.equal(outcomes[1].status, "rejected");
    assert.equal(outcomes[1].reason.code, replacementFirst ? "access_code_inconnu" : "ACCESS_CODE_SUPERSESSION_CONFLICT");
    assert.equal(db.state.publicReadings.length, replacementFirst ? 0 : 1);
    assert.equal(db.state.accessCodes.length, replacementFirst ? 70 : 20);
    assert.equal(db.state.accessCodes.filter(entry => entry.batchId === BATCH && entry.revokedAt).length, replacementFirst ? 20 : 0);
  }
});
