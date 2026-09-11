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

import { randomBytes } from "node:crypto";

import { consumeAccessCode, markAccessCodeUsed } from "./accessCodeService.mjs";

// Alphabet de 32 caractères (ni I, ni O, ni 0, ni 1 : illisibles au téléphone).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const RETENTION_DAYS = 30;

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

function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : null;
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
    reference: delivery.reference,
    status: delivery.status,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
    expiresAt: delivery.expiresAt,
    email: maskEmail(delivery.email),
    amountCents: delivery.amountCents ?? null,
    currency: delivery.currency ?? null,
    language: delivery.language ?? null,
    reading: delivery.status === "ready" ? delivery.reading : null,
    error: delivery.status === "failed" ? delivery.error : null
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
export async function createPaidDelivery(store, { paymentSessionId, email, amountCents, currency, language, input, freeAccess = false, accessCode = null } = {}, now = Date.now()) {
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
      email: normalizeEmail(email),
      amountCents: Number.isFinite(amountCents) ? amountCents : null,
      currency: currency ?? null,
      language: language ?? null,
      freeAccess: Boolean(freeAccess),
      // Traçabilité : on saura quelle source a ouvert cette lecture gratuite.
      accessCodeId: entreeCode?.id ?? null,
      status: "paid",
      input: input ?? null,
      reading: null,
      error: null,
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
    if (!delivery) {
      return null;
    }
    delivery.status = "generating";
    delivery.updatedAt = nowIso();
    return publicDelivery(delivery);
  });
}

export async function markDeliveryReady(store, id, reading) {
  return store.transact((state) => {
    const delivery = state.publicReadings.find((entry) => entry.id === id);
    if (!delivery) {
      return null;
    }
    delivery.status = "ready";
    delivery.reading = storedReading(reading);
    delivery.error = null;
    delivery.updatedAt = nowIso();
    return publicDelivery(delivery);
  });
}

export async function markDeliveryFailed(store, id, message) {
  return store.transact((state) => {
    const delivery = state.publicReadings.find((entry) => entry.id === id);
    if (!delivery) {
      return null;
    }
    delivery.status = "failed";
    delivery.error = String(message ?? "La rédaction a échoué.").slice(0, 300);
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

// Met le lien de récupération dans la file d'envoi d'e-mails. Tant qu'aucun
// fournisseur n'est configuré, le message reste dans la file (visible côté
// exploitation) au lieu d'être perdu.
export async function queueDeliveryEmail(store, delivery, { link }) {
  return store.transact((state) => {
    state.outbox.push({
      id: store.id("mail"),
      to: delivery.email,
      type: "public_reading_link",
      subject: "Votre lecture Lastro est prête",
      body: `Votre lecture est disponible ici : ${link}\n\nNuméro de commande : ${delivery.reference}\nCe lien est personnel ; il reste valable ${RETENTION_DAYS} jours.`,
      link,
      reference: delivery.reference,
      createdAt: nowIso()
    });
    return true;
  });
}

export function deliveryLink(token, baseUrl) {
  const base = String(baseUrl ?? "").replace(/\/+$/, "");
  return `${base}/r/${token}`;
}
