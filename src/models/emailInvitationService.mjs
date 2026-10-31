// E-mail invitations reserve existing single-use grants. Opening a link never
// consumes a grant; only createPaidDelivery may mark it used, in its transaction.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { buildInvitationEmail } from "../notifications/invitationEmail.mjs";

export const INVITATION_EMAIL_TYPE = "reading_invitation";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const LANGUAGES = new Set(["fr", "en", "de", "es", "it", "pt", "no", "da", "nl"]);
const INPUT_KEYS = new Set(["email", "kind", "requestId", "language"]);

function fail(code, status, message) {
  throw Object.assign(new Error(message), { code, status, expected: true });
}

export function normalizeInvitationEmail(value) {
  if (typeof value !== "string") fail("INVITATION_EMAIL_INVALID", 400, "L'adresse e-mail est invalide.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\u0000-\u001f\u007f]/u.test(email)) {
    fail("INVITATION_EMAIL_INVALID", 400, "L'adresse e-mail est invalide.");
  }
  return email;
}

function requireAdmin(state, user) {
  if (!user || typeof user.id !== "string" || !user.id) fail("AUTHENTICATION_REQUIRED", 401, "Connexion requise.");
  const stored = state.users?.find(entry => entry.id === user.id);
  if (user.primaryRole !== "admin" || user.deletedAt || !stored || stored.deletedAt || stored.primaryRole !== "admin") {
    fail("ADMIN_INVITATIONS_FORBIDDEN", 403, "Accès administrateur requis.");
  }
  return stored;
}

function invitations(state) {
  if (state.emailInvitations === undefined) return [];
  if (!Array.isArray(state.emailInvitations)) fail("INVITATION_REGISTRY_INVALID", 503, "Le registre des invitations est indisponible.");
  return state.emailInvitations;
}

function normalizeInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail("INVITATION_INPUT_INVALID", 400, "Invitation invalide.");
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== "string" || !INPUT_KEYS.has(key) || !descriptor || !Object.hasOwn(descriptor, "value")) {
      fail("INVITATION_INPUT_INVALID", 400, "Invitation invalide.");
    }
  }
  const recipientEmail = normalizeInvitationEmail(input.email);
  if (!["free", "discount10"].includes(input.kind) || !UUID.test(input.requestId ?? "")) {
    fail("INVITATION_INPUT_INVALID", 400, "Invitation invalide.");
  }
  const language = input.language ?? "fr";
  if (!LANGUAGES.has(language)) fail("INVITATION_INPUT_INVALID", 400, "Langue de l'invitation invalide.");
  return { recipientEmail, kind: input.kind, language, requestId: input.requestId.toLowerCase() };
}

export function invitationBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { fail("INVITATION_BASE_URL_INVALID", 503, "L'adresse du site est indisponible."); }
  const live = url.protocol === "https:" && ["lastro.fr", "www.lastro.fr"].includes(url.hostname) && !url.port;
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!live && !local) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    fail("INVITATION_BASE_URL_INVALID", 503, "L'adresse du site est indisponible.");
  }
  return url.origin;
}

export function hashInvitationToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function findInvitationByToken(state, token) {
  if (typeof token !== "string" || !TOKEN.test(token)) return null;
  const wanted = Buffer.from(hashInvitationToken(token), "hex");
  return invitations(state).find(entry => typeof entry.tokenHash === "string" && /^[a-f0-9]{64}$/.test(entry.tokenHash)
    && timingSafeEqual(Buffer.from(entry.tokenHash, "hex"), wanted)) ?? null;
}

function validateInvitation(state, entry, { email, kind, now = Date.now(), allowUsed = true } = {}) {
  if (!entry || entry.revokedAt || (entry.expiresAt && (!Number.isFinite(Date.parse(entry.expiresAt)) || Date.parse(entry.expiresAt) <= now))) {
    fail("INVITATION_INVALID", 404, "Cette invitation est invalide ou indisponible.");
  }
  if (kind && entry.kind !== kind) fail("INVITATION_KIND_MISMATCH", 400, "Cet avantage ne correspond pas à cette action.");
  if (email !== undefined && normalizeInvitationEmail(email) !== entry.recipientEmail) {
    fail("INVITATION_EMAIL_MISMATCH", 403, "Utilisez l'adresse e-mail destinataire de cette invitation.");
  }
  if (entry.usedAt && !allowUsed) fail("INVITATION_ALREADY_USED", 409, "Cette invitation a déjà été utilisée.");
  if (entry.kind === "free" && !entry.usedAt) {
    const code = state.accessCodes?.find(candidate => candidate.id === entry.accessCodeId);
    if (!code || code.emailInvitationId !== entry.id || code.usedAt || code.revokedAt
        || (code.expiresAt && (!Number.isFinite(Date.parse(code.expiresAt)) || Date.parse(code.expiresAt) <= now))) {
      fail("INVITATION_UNAVAILABLE", 409, "Cette invitation n'est plus disponible.");
    }
  }
  return entry;
}

export function requireInvitation(state, token, options = {}) {
  return validateInvitation(state, findInvitationByToken(state, token), options);
}

// A clear code already allocated by e-mail cannot be used to deliver somebody
// else's reading. Legacy unallocated codes retain their existing behavior.
export function invitationForAccessCode(state, code, { email, now = Date.now() } = {}) {
  const matches = invitations(state).filter(entry => entry.accessCodeId === code.id);
  if (!code.emailInvitationId && !matches.length) return null;
  if (matches.length !== 1 || code.emailInvitationId !== matches[0].id) {
    fail("INVITATION_REGISTRY_INVALID", 503, "Le registre des invitations est indisponible.");
  }
  return validateInvitation(state, matches[0], { email: email ?? "", kind: "free", now });
}

export function invitationPublicView(state, entry) {
  const delivery = state.publicReadings?.find(row => row.id === entry.deliveryId);
  return {
    id: entry.id, kind: entry.kind, recipientEmail: entry.recipientEmail,
    language: entry.language, status: entry.usedAt ? "used" : "available",
    usedAt: entry.usedAt ?? null, deliveryReference: entry.deliveryReference ?? null,
    readingStatus: delivery?.status ?? null
  };
}

function adminView(state, entry) {
  const delivery = state.publicReadings?.find(row => row.id === entry.deliveryId);
  const mail = state.outbox?.find(row => row.id === entry.mailId);
  const mailStatus = mail?.manualReviewRequired ? "unknown" : mail?.status ?? "pending";
  return {
    ...invitationPublicView(state, entry), createdAt: entry.createdAt,
    mail: { status: mailStatus, attempts: Number(mail?.attempts ?? 0),
      acceptedAt: mail?.sentAt ?? null, manualReviewRequired: Boolean(mail?.manualReviewRequired) },
    usage: { status: entry.usedAt ? "used" : "available", usedAt: entry.usedAt ?? null,
      reference: entry.deliveryReference ?? null, readingStatus: delivery?.status ?? null }
  };
}

function freeInventory(state, now) {
  const assigned = new Set(invitations(state).filter(entry => entry.kind === "free").map(entry => entry.accessCodeId));
  return (state.accessCodes ?? []).filter(code => code.codeLength === 12 && code.usageLimit === 1
    && !code.usedAt && !code.revokedAt && !code.deliveryReference && !code.emailInvitationId && !assigned.has(code.id)
    && (!code.expiresAt || (Number.isFinite(Date.parse(code.expiresAt)) && Date.parse(code.expiresAt) > now)));
}

function discountInventory(state, promotionInventory) {
  if (!Array.isArray(promotionInventory)) return null;
  const assigned = new Set(invitations(state).filter(entry => entry.kind === "discount10").map(entry => entry.stripePromotionCodeId));
  const seen = new Set();
  return promotionInventory.filter(promotion => {
    if (!promotion || !/^promo_[A-Za-z0-9_]+$/.test(promotion.id ?? "") || !UUID.test(promotion.batchId ?? "")
        || assigned.has(promotion.id) || seen.has(promotion.id)) return false;
    seen.add(promotion.id);
    return true;
  });
}

export async function listAdminEmailInvitations(store, user, { promotionInventory = [], now = Date.now() } = {}) {
  await store.load(); await store.queue;
  const state = await store.load(); requireAdmin(state, user);
  const rows = invitations(state);
  const discounts = discountInventory(state, promotionInventory);
  return {
    inventory: { freeAvailable: freeInventory(state, now).length, discountAvailable: discounts?.length ?? null,
      freeAssigned: rows.filter(entry => entry.kind === "free").length,
      discountAssigned: rows.filter(entry => entry.kind === "discount10").length,
      used: rows.filter(entry => entry.usedAt).length },
    invitations: rows.map(entry => adminView(state, entry)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}

export async function createEmailInvitation(store, user, input, { baseUrl, promotionInventory = [], now = Date.now() } = {}) {
  const normalized = normalizeInput(input);
  const origin = invitationBaseUrl(baseUrl);
  return store.transact(async state => {
    const actor = requireAdmin(state, user);
    const rows = invitations(state);
    const previousRequest = rows.find(entry => entry.requestId === normalized.requestId);
    if (previousRequest) {
      if (previousRequest.recipientEmail !== normalized.recipientEmail || previousRequest.kind !== normalized.kind
          || previousRequest.language !== normalized.language) {
        fail("INVITATION_REQUEST_CONFLICT", 409, "Cette demande correspond à une autre invitation.");
      }
      return { created: false, invitation: adminView(state, previousRequest) };
    }
    const previousRecipient = rows.find(entry => entry.recipientEmail === normalized.recipientEmail && entry.kind === normalized.kind && !entry.revokedAt);
    if (previousRecipient) return { created: false, invitation: adminView(state, previousRecipient) };
    if (!Array.isArray(state.accessCodes) || !Array.isArray(state.outbox) || !Array.isArray(state.auditLogs)) {
      fail("INVITATION_REGISTRY_INVALID", 503, "Le registre des invitations est indisponible.");
    }
    let accessCode = null; let promotion = null;
    if (normalized.kind === "free") accessCode = freeInventory(state, now)[0] ?? null;
    else {
      const available = discountInventory(state, promotionInventory);
      if (!available) fail("INVITATION_INVENTORY_UNAVAILABLE", 503, "La vérification des réductions est momentanément indisponible.");
      promotion = available[0] ?? null;
    }
    if (!accessCode && !promotion) fail("INVITATION_OUT_OF_STOCK", 409, "Aucune invitation de ce type n'est disponible.");
    let token;
    do { token = randomBytes(32).toString("base64url"); } while (findInvitationByToken(state, token));
    const id = `inv_${randomUUID()}`; const mailId = `mail_${randomUUID()}`; const createdAt = new Date(now).toISOString();
    const entry = {
      id, ...normalized, tokenHash: hashInvitationToken(token),
      accessCodeId: accessCode?.id ?? null, stripePromotionCodeId: promotion?.id ?? null,
      promotionBatchId: promotion?.batchId ?? null, mailId, createdAt,
      usedAt: null, deliveryId: null, deliveryReference: null, revokedAt: null
    };
    const mail = await buildInvitationEmail({ kind: entry.kind, language: entry.language, url: `${origin}/#invitation=${token}` });
    if (accessCode) accessCode.emailInvitationId = id;
    if (state.emailInvitations === undefined) state.emailInvitations = [];
    state.emailInvitations.push(entry);
    state.outbox.push({ id: mailId, type: INVITATION_EMAIL_TYPE, invitationId: id, to: entry.recipientEmail,
      subject: mail.subject, body: mail.text, html: mail.html, attachments: mail.attachments,
      idempotencyKey: `lastro-invitation-${id}`, status: "pending", attempts: 0,
      createdAt, sentAt: null, nextAttemptAt: null, error: null });
    state.auditLogs.push({ id: `audit_${randomUUID()}`, actorUserId: actor.id, ownerUserId: actor.id,
      action: "email_invitation.created", subjectType: "EmailInvitation", subjectId: id,
      before: null, after: { kind: entry.kind, language: entry.language }, createdAt });
    return { created: true, invitation: adminView(state, entry) };
  });
}
