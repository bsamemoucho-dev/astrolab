// Livraison des lectures publiques payées.
//
// Le parcours public était sans stockage : si la rédaction échouait, si le
// client fermait la page ou rechargeait au mauvais moment, la lecture était
// perdue alors que le paiement avait bien été encaissé. Ce service conserve
// donc chaque lecture payée le temps nécessaire pour la retrouver.
//
// Deux identifiants distincts :
//   - `token`     : 32 caractères aléatoires (160 bits), secret, dans le lien ;
//   - `reference` : lisible (L-2026-7QK4M2-PX8T), pour le support et le client.
//
// Le token n'est renvoyé qu'à la création : il n'apparaît dans aucune réponse
// de lecture, et une lecture ne s'ouvre qu'avec lui.

import { randomBytes, randomUUID } from "node:crypto";

import { consumeAccessCode, markAccessCodeUsed } from "./accessCodeService.mjs";

// Alphabet de 32 caractères (ni I, ni O, ni 0, ni 1 : illisibles au téléphone).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const RETENTION_DAYS = 30;
export const GENERATION_LEASE_MS = 15 * 60 * 1000;
export const PUBLIC_GENERATION_RECOVERY_VERSION = "public-generation-recovery@1";
export const MAX_AUTOMATIC_GENERATION_RECOVERIES = 1;
export const DELIVERY_EMAIL_TYPES = ["public_reading_link", "public_reading_failure", "admin_alert"];

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function randomCode(length) {
  const bytes = randomBytes(length);
  let code = "";
  for (let index = 0; index < length; index += 1) {
    // 256 est un multiple de 32 : le modulo reste uniforme.
    code += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return code;
}

export function newToken() {
  return randomCode(32);
}

export function newReference(year = new Date().getFullYear()) {
  return `L-${year}-${randomCode(6)}-${randomCode(4)}`;
}

function expiresAt(createdAt, days = RETENTION_DAYS) {
  return new Date(new Date(createdAt).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function emptyProgress() {
  return {
    completedSections: 0,
    totalSections: null,
    currentSection: null
  };
}

function normalizeProgress(progress = {}) {
  return {
    completedSections: Number.isFinite(Number(progress.completedSections)) ? Number(progress.completedSections) : 0,
    totalSections: Number.isFinite(Number(progress.totalSections)) ? Number(progress.totalSections) : null,
    currentSection: progress.currentSection ? String(progress.currentSection) : null
  };
}

function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function validateDeliveryEmail(value) {
  const email = normalizeEmail(value);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Votre adresse e-mail est requise pour recevoir votre lecture.");
    error.status = 400;
    error.code = "invalid_delivery_email";
    throw error;
  }
  return email;
}

export function maskEmail(value) {
  const email = normalizeEmail(value);
  if (!email) {
    return null;
  }
  const [local, domain] = email.split("@");
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(1, Math.min(local.length - 1, 3)))}@${domain}`;
}

// Ce que la rédaction transmet au stockage : de quoi relivrer le document et
// expliquer comment il a été produit, sans dupliquer les sections.
function storedReading(reading) {
  return {
    html: reading.html ?? null,
    markdown: reading.markdown ?? null,
    writerMode: reading.writerMode ?? null,
    language: reading.language ?? null,
    aiReview: reading.aiReview ?? null,
    verification: reading.verification ?? null,
    storedAt: nowIso()
  };
}

export function publicDelivery(delivery) {
  return {
    id: delivery.id,
    reference: delivery.reference,
    status: delivery.status,
    progress: delivery.progress ? normalizeProgress(delivery.progress) : null,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
    expiresAt: delivery.expiresAt,
    email: maskEmail(delivery.email),
    amountCents: delivery.amountCents ?? null,
    currency: delivery.currency ?? null,
    language: delivery.language ?? null,
    reading: delivery.status === "ready" ? delivery.reading : null,
    error: delivery.status === "failed" ? "La génération n'a pas pu être terminée. Vous pouvez réessayer." : null
  };
}

// Supprime les lectures arrivées à échéance. Appelé à chaque écriture : pas de
// tâche planifiée à maintenir, et jamais de donnée gardée au-delà de la durée
// annoncée.
function purgeExpired(state, now = Date.now()) {
  const limit = nowIso(now);
  const before = state.publicReadings.length;
  state.publicReadings = state.publicReadings.filter((delivery) => delivery.expiresAt > limit);
  return before - state.publicReadings.length;
}

export async function purgeExpiredDeliveries(store, now = Date.now()) {
  return store.transact((state) => purgeExpired(state, now));
}

// Idempotent par paiement : un même paiement ne peut produire qu'une commande,
// même si le navigateur renvoie la demande plusieurs fois.
//
// `accessCode` (code à usage unique) est vérifié ET consommé ici, dans la même
// transaction que la création. C'est la seule façon de tenir « un code = une
// lecture » : un contrôle fait avant, hors transaction, laisserait deux requêtes
// simultanées passer toutes les deux.
export async function createPaidDelivery(
  store,
  { paymentSessionId, email, amountCents, currency, language, input, freeAccess = false, accessCode = null, sharedFreeAccessQuota = false, sharedFreeAccessQuotaKey = null } = {},
  now = Date.now()
) {
  return store.transact((state) => {
    const session = String(paymentSessionId ?? "").trim();
    const existing = session
      ? state.publicReadings.find((delivery) => delivery.paymentSessionId === session)
      : null;
    if (existing) {
      return { created: false, delivery: existing };
    }
    const entreeCode = accessCode ? consumeAccessCode(state, accessCode, now) : null;
    const createdAt = nowIso(now);
    const delivery = {
      id: store.id("reading"),
      reference: newReference(new Date(now).getFullYear()),
      token: newToken(),
      paymentSessionId: session || null,
      email: email === null || email === undefined ? null : validateDeliveryEmail(email),
      amountCents: Number.isFinite(amountCents) ? amountCents : null,
      currency: currency ?? null,
      language: language ?? null,
      freeAccess: Boolean(freeAccess),
      sharedFreeAccessQuota: Boolean(sharedFreeAccessQuota),
      sharedFreeAccessQuotaKey: sharedFreeAccessQuotaKey ? String(sharedFreeAccessQuotaKey).slice(0, 120) : null,
      // Traçabilité : on saura quelle source a ouvert cette lecture gratuite.
      accessCodeId: entreeCode?.id ?? null,
      status: "queued",
      input: input ?? null,
      reading: null,
      error: null,
      errorCode: null,
      progress: emptyProgress(),
      generation: {
        recoveryVersion: PUBLIC_GENERATION_RECOVERY_VERSION,
        automaticRecoveries: 0,
        attempt: 0,
        leaseId: null,
        leaseUntil: null,
        startedAt: null,
        finishedAt: null
      },
      createdAt,
      updatedAt: createdAt,
      expiresAt: expiresAt(createdAt)
    };
    state.publicReadings.push(delivery);
    markAccessCodeUsed(entreeCode, { reference: delivery.reference, now });
    purgeExpired(state, now);
    return { created: true, delivery };
  });
}

export async function markDeliveryGenerating(store, id) {
  return store.transact((state) => {
    const delivery = state.publicReadings.find((entry) => entry.id === id);
    if (!delivery || ["ready", "failed"].includes(delivery.status) || delivery.generation?.leaseId) {
      return null;
    }
    delivery.status = "generating";
    delivery.progress = delivery.progress ? normalizeProgress(delivery.progress) : emptyProgress();
    delivery.updatedAt = nowIso();
    return publicDelivery(delivery);
  });
}

export async function markDeliveryQueued(store, id, { now = Date.now() } = {}) {
  return store.transact((state) => {
    const delivery = state.publicReadings.find((entry) => entry.id === id);
    // This is an explicit retry action, not a polling or recovery scan. It may
    // restart a failed/abandoned attempt, but never revokes an active lease.
    if (!delivery || !["queued", "failed", "generating"].includes(delivery.status) || hasActiveLease(delivery, now)) {
      return null;
    }
    delivery.status = "queued";
    delivery.error = null;
    delivery.errorCode = null;
    delivery.progress = emptyProgress();
    delivery.generation = {
      ...(delivery.generation ?? {}),
      recoveryVersion: PUBLIC_GENERATION_RECOVERY_VERSION,
      automaticRecoveries: 0,
      recoveryStatus: "eligible",
      recoveryReason: null,
      leaseId: null,
      leaseUntil: null,
      finishedAt: null
    };
    delivery.updatedAt = nowIso();
    return publicDelivery(delivery);
  });
}

export async function getDeliveryById(store, id, now = Date.now()) {
  const state = await store.load();
  const value = String(id ?? "").trim();
  if (!value) {
    return null;
  }
  // A status lookup is read-only, including when other records have expired.
  // Expired data is removed by the existing write transactions, not by polling.
  const limit = nowIso(now);
  return state.publicReadings.find((entry) => entry.id === value && entry.expiresAt > limit) ?? null;
}

function hasActiveLease(delivery, now = Date.now()) {
  const until = delivery?.generation?.leaseUntil ? new Date(delivery.generation.leaseUntil).getTime() : 0;
  return delivery?.status === "generating" && until > now;
}

function automaticRecoveryBlocked(delivery) {
  if (delivery.status !== "generating") return false;
  if (Number(delivery.generation?.automaticRecoveries ?? 0) < MAX_AUTOMATIC_GENERATION_RECOVERIES) return false;
  delivery.generation = {
    ...(delivery.generation ?? {}),
    recoveryStatus: "manual_review_required",
    recoveryReason: "automatic_recovery_limit_reached"
  };
  return true;
}

function reserveGenerationAttempt(delivery, { leaseMs, now, leaseId }) {
  const recovering = delivery.status === "generating";
  const startedAt = nowIso(now);
  delivery.status = "generating";
  delivery.error = null;
  delivery.errorCode = null;
  delivery.progress = delivery.progress ? normalizeProgress(delivery.progress) : emptyProgress();
  delivery.generation = {
    ...(delivery.generation ?? {}),
    recoveryVersion: PUBLIC_GENERATION_RECOVERY_VERSION,
    automaticRecoveries: Number(delivery.generation?.automaticRecoveries ?? 0) + (recovering ? 1 : 0),
    recoveryStatus: "eligible",
    recoveryReason: null,
    attempt: Number(delivery.generation?.attempt ?? 0) + 1,
    leaseId,
    leaseUntil: nowIso(now + leaseMs),
    startedAt,
    finishedAt: null
  };
  delivery.updatedAt = startedAt;
  return structuredClone(delivery);
}

export async function claimDeliveryGeneration(store, id, { leaseMs = GENERATION_LEASE_MS, now = Date.now(), leaseId = randomUUID() } = {}) {
  if (!leaseId || typeof leaseId !== "string") return null;
  return store.transact((state) => {
    const delivery = state.publicReadings.find((entry) => entry.id === id);
    if (!delivery || !["queued", "generating"].includes(delivery.status) || hasActiveLease(delivery, now) || automaticRecoveryBlocked(delivery)) {
      return null;
    }
    const claimed = reserveGenerationAttempt(delivery, { leaseMs, now, leaseId });
    purgeExpired(state, now);
    return claimed;
  });
}

export async function claimNextDeliveryGeneration(store, { leaseMs = GENERATION_LEASE_MS, now = Date.now(), leaseId = randomUUID(), recoveryEligibleOnly = false, excludeIds = [] } = {}) {
  if (!leaseId || typeof leaseId !== "string") return null;
  return store.transact((state) => {
    // Recovery scans do not introduce a new automatic data-purge policy.
    // Expired records are ineligible; existing write paths retain their purge.
    const limit = nowIso(now);
    const excluded = new Set(excludeIds);
    const delivery = state.publicReadings.find((entry) => {
      if (!(entry.expiresAt > limit) || excluded.has(entry.id)) return false;
      // Adding a recovery scan must not turn an old abandoned dossier into new
      // paid API work. New orders and explicit retries opt in to this version.
      if (recoveryEligibleOnly && entry.generation?.recoveryVersion !== PUBLIC_GENERATION_RECOVERY_VERSION) return false;
      if (!["queued", "generating"].includes(entry.status) || hasActiveLease(entry, now)) return false;
      return !automaticRecoveryBlocked(entry);
    });
    return delivery ? reserveGenerationAttempt(delivery, { leaseMs, now, leaseId }) : null;
  });
}

export async function markDeliveryProgress(store, id, progress, { leaseId = null, leaseMs = GENERATION_LEASE_MS, now = Date.now() } = {}) {
  return store.transact((state) => {
    const delivery = state.publicReadings.find((entry) => entry.id === id);
    if (!delivery || delivery.status !== "generating" || !leaseId || delivery.generation?.leaseId !== leaseId) {
      return null;
    }
    delivery.progress = normalizeProgress({
      ...(delivery.progress ?? {}),
      ...(progress ?? {})
    });
    delivery.generation = {
      ...(delivery.generation ?? {}),
      leaseUntil: nowIso(now + leaseMs)
    };
    delivery.updatedAt = nowIso(now);
    return publicDelivery(delivery);
  });
}

// Synchronous producers may finish an unleased queued/generating record. Once
// a job has a lease, every completion must present that exact owner token. No
// caller (including a stale worker) can overwrite a terminal ready/failed state.
function mayFinishGeneration(delivery, leaseId) {
  if (!delivery || !["queued", "generating"].includes(delivery.status)) return false;
  const owner = delivery.generation?.leaseId;
  if (owner) return delivery.status === "generating" && Boolean(leaseId) && owner === leaseId;
  return !leaseId;
}

export async function markDeliveryReady(store, id, reading, { leaseId = null } = {}) {
  return store.transact((state) => {
    const delivery = state.publicReadings.find((entry) => entry.id === id);
    if (!mayFinishGeneration(delivery, leaseId)) {
      return null;
    }
    delivery.status = "ready";
    delivery.reading = storedReading(reading);
    delivery.error = null;
    delivery.errorCode = null;
    delivery.progress = normalizeProgress({
      ...(delivery.progress ?? {}),
      completedSections: reading?.dossier?.generatedSectionCount ?? delivery.progress?.completedSections ?? 0,
      totalSections: reading?.dossier?.generatedSectionCount ?? delivery.progress?.totalSections ?? null,
      currentSection: null
    });
    delivery.generation = {
      ...(delivery.generation ?? {}),
      leaseId: null,
      leaseUntil: null,
      finishedAt: nowIso()
    };
    delivery.updatedAt = nowIso();
    return publicDelivery(delivery);
  });
}

export async function markDeliveryFailed(store, id, message, code = "generation_failed", { leaseId = null } = {}) {
  return store.transact((state) => {
    const delivery = state.publicReadings.find((entry) => entry.id === id);
    if (!mayFinishGeneration(delivery, leaseId)) {
      return null;
    }
    delivery.status = "failed";
    delivery.error = String(message ?? "La rédaction a échoué.").slice(0, 300);
    delivery.errorCode = String(code ?? "generation_failed").slice(0, 80);
    delivery.generation = {
      ...(delivery.generation ?? {}),
      leaseId: null,
      leaseUntil: null,
      finishedAt: nowIso()
    };
    delivery.updatedAt = nowIso();
    return publicDelivery(delivery);
  });
}

export async function getDeliveryByToken(store, token, now = Date.now()) {
  const state = await store.load();
  const value = String(token ?? "").trim().toUpperCase();
  if (!value) {
    return null;
  }
  purgeExpired(state, now);
  const delivery = state.publicReadings.find((entry) => entry.token === value);
  return delivery ?? null;
}

// Retrouve la livraison d'un paiement : c'est ce qui évite de faire payer deux
// fois et ce qui permet de reprendre une rédaction interrompue.
export async function findDeliveryByPaymentSession(store, paymentSessionId, now = Date.now()) {
  const state = await store.load();
  const session = String(paymentSessionId ?? "").trim();
  if (!session) {
    return null;
  }
  purgeExpired(state, now);
  return state.publicReadings.find((entry) => entry.paymentSessionId === session) ?? null;
}

export async function findDeliveryByReference(store, reference, now = Date.now()) {  const state = await store.load();
  const value = String(reference ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!value) {
    return null;
  }
  purgeExpired(state, now);
  return state.publicReadings.find((entry) => entry.reference === value) ?? null;
}

export async function deleteDeliveryByToken(store, token) {
  return store.transact((state) => {
    const value = String(token ?? "").trim().toUpperCase();
    const before = state.publicReadings.length;
    state.publicReadings = state.publicReadings.filter((entry) => entry.token !== value);
    return before !== state.publicReadings.length;
  });
}

export function deliveryReadyEmail({ link, reference }) {
  const safeLink = String(link ?? "");
  const safeReference = String(reference ?? "");
  return {
    subject: "Votre lecture Lastro est prête",
    body: `Votre lecture est disponible ici : ${safeLink}\n\nNuméro de commande : ${safeReference}\nCe lien est personnel ; il reste valable ${RETENTION_DAYS} jours.`,
    html:
      "<p>Bonjour,</p>" +
      "<p>Votre lecture Lastro est prête.</p>" +
      `<p><a href="${escapeHtml(safeLink)}" style="display:inline-block;padding:12px 18px;background:#151515;color:#ffffff;text-decoration:none;border-radius:6px;">Ouvrir ma lecture</a></p>` +
      `<p>Si le bouton ne fonctionne pas, copiez ce lien :<br><a href="${escapeHtml(safeLink)}">${escapeHtml(safeLink)}</a></p>` +
      `<p>Numéro de commande : ${escapeHtml(safeReference)}</p>` +
      "<p>À bientôt,<br>Lastro</p>"
  };
}

export function deliveryFailureEmail() {
  return {
    subject: "Un problème est survenu avec votre lecture Lastro",
    body:
      "Bonjour,\n\n" +
      "Un problème est survenu pendant la préparation de votre lecture.\n\n" +
      "Votre demande a bien été enregistrée. Si nécessaire, nous vous contacterons à cette adresse.\n\n" +
      "À bientôt,\n" +
      "Lastro",
    html:
      "<p>Bonjour,</p>" +
      "<p>Un problème est survenu pendant la préparation de votre lecture.</p>" +
      "<p>Votre demande a bien été enregistrée. Si nécessaire, nous vous contacterons à cette adresse.</p>" +
      "<p>À bientôt,<br>Lastro</p>"
  };
}

// Met le lien de récupération dans la file d'envoi d'e-mails. Tant qu'aucun
// fournisseur n'est configuré, le message reste dans la file (visible côté
// exploitation) au lieu d'être perdu.
export async function queueDeliveryEmail(store, delivery, { link, purpose = "ready" }) {
  if (!delivery?.email) {
    return false;
  }
  const deliveryId = delivery.id ?? null;
  const emailKey = deliveryId ? `public_reading_link:${deliveryId}:${purpose}` : null;
  return store.transact((state) => {
    if (emailKey && purpose === "ready") {
      const existing = state.outbox.find((mail) => mail.emailKey === emailKey);
      if (existing) {
        return false;
      }
    }
    const template = deliveryReadyEmail({ link, reference: delivery.reference });
    state.outbox.push({
      id: store.id("mail"),
      to: delivery.email,
      type: "public_reading_link",
      status: "pending",
      attempts: 0,
      subject: template.subject,
      body: template.body,
      html: template.html,
      link,
      reference: delivery.reference,
      deliveryId,
      emailKey,
      purpose,
      createdAt: nowIso()
    });
    return true;
  });
}

export async function queueDeliveryFailureEmail(store, delivery) {
  if (!delivery?.email) {
    return false;
  }
  const deliveryId = delivery.id ?? null;
  const emailKey = deliveryId ? `public_reading_failure:${deliveryId}` : null;
  return store.transact((state) => {
    if (emailKey && state.outbox.some((mail) => mail.emailKey === emailKey)) {
      return false;
    }
    const template = deliveryFailureEmail();
    state.outbox.push({
      id: store.id("mail"),
      to: delivery.email,
      type: "public_reading_failure",
      status: "pending",
      attempts: 0,
      subject: template.subject,
      body: template.body,
      html: template.html,
      deliveryId,
      emailKey,
      purpose: "generation_failed",
      reference: delivery.reference,
      createdAt: nowIso()
    });
    return true;
  });
}

export function adminAlertEmail() {
  return normalizeEmail(process.env.ADMIN_ALERT_EMAIL);
}

function alertActions({ failureType }) {
  if (failureType === "generation_failed") {
    return [
      "ACTION REQUISE",
      "- vérifier l’erreur",
      "- relancer la génération si approprié",
      "- contacter le client si nécessaire",
      "- envisager un remboursement si la lecture ne peut pas être produite"
    ];
  }
  if (String(failureType ?? "").startsWith("email_public_reading_link_failed")) {
    return [
      "ACTION REQUISE",
      "- dossier disponible",
      "- renvoyer manuellement l’e-mail ou transmettre le lien au client"
    ];
  }
  if (failureType === "email_sending_stale") {
    return [
      "ACTION REQUISE",
      "- vérifier le statut fournisseur avant tout renvoi",
      "- ne pas renvoyer automatiquement si le statut de livraison est inconnu",
      "- contacter le client si nécessaire"
    ];
  }
  return [
    "ACTION REQUISE",
    "- vérifier l’incident",
    "- décider de la suite manuelle appropriée"
  ];
}

function alertBody({ delivery, failureType, status, attempts = null, error = null, link = null, mail = null }) {
  return [
    "Alerte Lastro : intervention requise",
    "Cette alerte doit arriver dans une boîte réellement consultée.",
    "",
    ...alertActions({ failureType }),
    "",
    `readingId: ${delivery?.id ?? mail?.deliveryId ?? "inconnu"}`,
    `référence: ${delivery?.reference ?? mail?.reference ?? "inconnue"}`,
    `clientEmail: ${delivery?.email ?? mail?.to ?? "inconnu"}`,
    `type: ${failureType}`,
    `statut: ${status}`,
    `attempts: ${attempts ?? mail?.attempts ?? 0}`,
    `erreur: ${error ?? mail?.error ?? delivery?.error ?? "non renseignée"}`,
    `lien: ${link ?? "non disponible"}`,
    mail?.id ? `mailId: ${mail.id}` : null,
    mail?.providerMessageId ? `providerMessageId: ${mail.providerMessageId}` : null,
    mail?.sendingStartedAt ? `sendingStartedAt: ${mail.sendingStartedAt}` : null
  ].filter(Boolean).join("\n");
}

export function adminAlertEmailContent(input) {
  return {
    subject: `[Lastro] Intervention requise — ${input.failureType}`,
    body: alertBody(input),
    html: `<pre style="font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;">${escapeHtml(alertBody(input))}</pre>`
  };
}

export async function queueAdminAlert(store, { delivery = null, failureType, status, attempts = null, error = null, link = null, mail = null }) {
  const to = adminAlertEmail();
  if (!to) {
    console.warn(`[Lastro][ADMIN_ALERT_FAILED] ADMIN_ALERT_EMAIL absent — ${failureType} — ${delivery?.reference ?? mail?.reference ?? "sans référence"}`);
    return false;
  }
  const sourceId = mail?.id ?? delivery?.id ?? "unknown";
  const emailKey = `admin_alert:${failureType}:${sourceId}:${status}`;
  return store.transact((state) => {
    if (state.outbox.some((entry) => entry.emailKey === emailKey)) {
      return false;
    }
    const template = adminAlertEmailContent({ delivery, failureType, status, attempts, error, link, mail });
    state.outbox.push({
      id: store.id("mail"),
      to,
      type: "admin_alert",
      status: "pending",
      attempts: 0,
      subject: template.subject,
      body: template.body,
      html: template.html,
      deliveryId: delivery?.id ?? mail?.deliveryId ?? null,
      emailKey,
      purpose: failureType,
      reference: delivery?.reference ?? mail?.reference ?? null,
      createdAt: nowIso()
    });
    return true;
  });
}

export function deliveryLink(token, baseUrl) {
  const base = String(baseUrl ?? "").replace(/\/+$/, "");
  return `${base}/r/${token}`;
}
