// Administrative import into the running server's own store. The caller keeps
// the clear six-character codes locally; only their SHA-256 fingerprints travel
// here. No separate process writes behind the server's in-memory state.
import { randomUUID } from "node:crypto";

const CODE_LENGTH = 6;
const USAGE_LIMIT = 1;
const KEYS = new Set(["batchId", "label", "codes", "codeLength"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/i;

function error(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

function requireAdmin(user) {
  if (!user || typeof user.id !== "string" || !user.id) {
    throw error("AUTHENTICATION_REQUIRED", 401, "Connexion requise.");
  }
  if (user.primaryRole !== "admin" || user.deletedAt) {
    throw error("ADMIN_ACCESS_CODES_FORBIDDEN", 403, "Accès administrateur requis.");
  }
}

function currentAdmin(state, user) {
  requireAdmin(user);
  const stored = (state.users ?? []).find((entry) => entry.id === user.id);
  if (!stored || stored.deletedAt || stored.primaryRole !== "admin") {
    throw error("ADMIN_ACCESS_CODES_FORBIDDEN", 403, "Accès administrateur requis.");
  }
  return stored;
}

function invalid() {
  throw error("INVALID_ACCESS_CODE_BATCH", 400, "Le lot de codes reçu est invalide.");
}

function batchId(value) {
  if (typeof value !== "string" || !UUID.test(value)) invalid();
  return value.toLowerCase();
}

function normalizedInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) invalid();
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== "string" || !KEYS.has(key) || !descriptor || !Object.hasOwn(descriptor, "value")) invalid();
  }
  const id = batchId(input.batchId);
  if (typeof input.label !== "string" || input.label.length > 120 || /[\u0000-\u001f\u007f]/u.test(input.label)) invalid();
  if (input.codeLength !== undefined && input.codeLength !== CODE_LENGTH) invalid();
  if (!Array.isArray(input.codes) || input.codes.length < 1 || input.codes.length > 100) invalid();
  // Copy before awaiting the store, so a caller cannot mutate an import while
  // it waits for another transaction. Array entries must be plain data too.
  const hashes = [];
  if (Reflect.ownKeys(input.codes).length !== input.codes.length + 1) invalid();
  for (let index = 0; index < input.codes.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input.codes, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value") || typeof descriptor.value !== "string" || !HASH.test(descriptor.value)) invalid();
    hashes.push(descriptor.value.toLowerCase());
  }
  if (new Set(hashes).size !== hashes.length) invalid();
  return { batchId: id, label: input.label.trim() || null, hashes: hashes.sort() };
}

function registry(state) {
  if (!Array.isArray(state.accessCodes)) {
    throw error("ACCESS_CODE_REGISTRY_INVALID", 500, "Le registre des codes est indisponible.");
  }
  return state.accessCodes;
}

function summary(entries, id, createdCount = 0) {
  const states = { available: 0, used: 0, revoked: 0, expired: 0 };
  const now = Date.now();
  for (const entry of entries) {
    if (entry.usedAt) states.used++;
    else if (entry.revokedAt) states.revoked++;
    else if (entry.expiresAt && Date.parse(entry.expiresAt) <= now) states.expired++;
    else states.available++;
  }
  return {
    batchId: id, createdCount, totalCount: entries.length,
    usageLimit: USAGE_LIMIT, codeLength: CODE_LENGTH,
    ids: entries.map((entry) => entry.id).sort(),
    label: entries[0]?.label ?? null, states
  };
}

function matchingBatch(entries, input) {
  if (entries.length !== input.hashes.length) return false;
  if (entries.some((entry) => entry.codeLength !== CODE_LENGTH || entry.usageLimit !== USAGE_LIMIT
      || entry.label !== input.label || entry.expiresAt !== null || typeof entry.hash !== "string")) return false;
  const existing = entries.map((entry) => entry.hash.toLowerCase()).sort();
  return existing.every((hash, index) => hash === input.hashes[index]);
}

export async function importAdminAccessCodeBatch(store, user, input) {
  requireAdmin(user);
  const normalized = normalizedInput(input);
  return store.transact((state) => {
    const actor = currentAdmin(state, user);
    const codes = registry(state);
    const existing = codes.filter((entry) => entry.batchId === normalized.batchId);
    if (existing.length) {
      if (!matchingBatch(existing, normalized)) {
        throw error("ACCESS_CODE_BATCH_CONFLICT", 409, "Cet identifiant de lot correspond à un contenu différent.");
      }
      // A replay proves the same hashes are registered without resetting use,
      // revocation, timestamps or delivery references, or adding an audit row.
      return summary(existing, normalized.batchId);
    }
    const known = new Set(codes.map((entry) => typeof entry.hash === "string" ? entry.hash.toLowerCase() : null));
    if (normalized.hashes.some((hash) => known.has(hash))) {
      throw error("ACCESS_CODE_HASH_CONFLICT", 409, "Une empreinte de ce lot est déjà enregistrée.");
    }
    if (!Array.isArray(state.auditLogs)) {
      throw error("ACCESS_CODE_REGISTRY_INVALID", 500, "Le journal administratif est indisponible.");
    }
    const createdAt = new Date().toISOString();
    const added = normalized.hashes.map((hash) => ({
      id: `code_${randomUUID()}`, hash, label: normalized.label,
      batchId: normalized.batchId, codeLength: CODE_LENGTH, usageLimit: USAGE_LIMIT,
      createdAt, expiresAt: null, usedAt: null, revokedAt: null, deliveryReference: null
    }));
    codes.push(...added);
    state.auditLogs.push({
      id: `audit_${randomUUID()}`, actorUserId: actor.id, ownerUserId: actor.id,
      action: "access_codes.import", subjectType: "AccessCodeBatch", subjectId: normalized.batchId,
      before: null, after: { count: added.length, codeLength: CODE_LENGTH, usageLimit: USAGE_LIMIT }, createdAt
    });
    return summary(added, normalized.batchId, added.length);
  });
}

export async function readAdminAccessCodeBatch(store, user, value) {
  requireAdmin(user);
  const id = batchId(value);
  await store.load();
  // JsonStore's queue settles only after save/rollback. A verification GET must
  // not report a batch which exists only inside an unfinished transaction.
  await store.queue;
  const state = await store.load();
  currentAdmin(state, user);
  const entries = registry(state).filter((entry) => entry.batchId === id);
  if (!entries.length) {
    throw error("ACCESS_CODE_BATCH_NOT_FOUND", 404, "Lot de codes introuvable.");
  }
  if (entries.some((entry) => entry.codeLength !== CODE_LENGTH || entry.usageLimit !== USAGE_LIMIT)) {
    throw error("ACCESS_CODE_REGISTRY_INVALID", 500, "Le registre des codes est indisponible.");
  }
  return summary(entries, id);
}
