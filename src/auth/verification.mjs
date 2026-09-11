// Code de vérification d'adresse : durée de vie, tentatives, renvoi.
//
// Pourquoi ces trois choses ensemble : un code à six chiffres n'a de valeur que
// s'il est borné dans le temps et en nombre d'essais, et si l'utilisateur peut en
// obtenir un autre quand il ne l'a pas reçu. Sans le renvoi, brider les tentatives
// enfermerait le client ; sans les tentatives, le renvoi ne protégerait rien.
//
//   - un code vit 24 h ;
//   - cinq essais faux l'invalident (il faut en demander un autre) : 900 000
//     combinaisons ne se devinent pas en cinq coups, alors qu'elles se devinaient
//     sans limite ;
//   - trois renvois par adresse et par heure, cinquante par heure pour tout le
//     service : un bouton « renvoyer » sans limite est un outil pour inonder la
//     boîte de quelqu'un d'autre.
//
// La limitation vit en mémoire du processus : un redémarrage la remet à zéro.
// C'est suffisant ici (elle borne un abus, elle ne facture rien) et documenté.

import { normalizeEmail } from "./security.mjs";
import { verificationEmail } from "../notifications/mailer.mjs";

export const CODE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_VERIFICATION_ATTEMPTS = 5;
export const MAX_RESENDS_PER_ADDRESS_PER_HOUR = 3;
export const MAX_RESENDS_PER_HOUR = 50;
export const RESEND_WINDOW_MS = 60 * 60 * 1000;

// Réponse UNIQUE à tous les échecs. Distinguer « code faux » de « code expiré »
// ou « compte sans code en attente » dirait à un inconnu si l'adresse possède un
// compte chez nous : un point d'entrée ne doit pas servir d'annuaire. Le motif
// précis reste dans les journaux du serveur, pour le support.
export const VERIFICATION_REJECTED_CODE = "verification_code_rejected";

export function verificationFailure(reason) {
  return {
    code: VERIFICATION_REJECTED_CODE,
    reason,
    message: "Code de vérification refusé (invalide, expiré ou trop d'essais). Demandez un nouveau code."
  };
}

// Vérifie un code sans rien modifier : l'appelant décide de ce qu'il enregistre.
export function verificationCheck(user, code, { now = Date.now() } = {}) {
  if (!user || !user.verificationCode) {
    return { ok: false, reason: "missing" };
  }
  const creation = Date.parse(user.verificationCodeCreatedAt ?? "");
  if (Number.isFinite(creation) && now - creation > CODE_TTL_MS) {
    return { ok: false, reason: "expired" };
  }
  if ((user.verificationAttempts ?? 0) >= MAX_VERIFICATION_ATTEMPTS) {
    // Le code a déjà été invalidé par la limite d'essais : on ne le compare même
    // plus, pour qu'un bon code ne repasse pas après coup.
    return { ok: false, reason: "too_many" };
  }
  if (String(code ?? "").trim() !== String(user.verificationCode)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Renvoi du code
// ---------------------------------------------------------------------------

const renvois = new Map();
let renvoisGlobaux = [];

function purge(now) {
  renvoisGlobaux = renvoisGlobaux.filter((instant) => now - instant < RESEND_WINDOW_MS);
  for (const [adresse, instants] of renvois) {
    const recents = instants.filter((instant) => now - instant < RESEND_WINDOW_MS);
    if (recents.length === 0) {
      renvois.delete(adresse);
    } else {
      renvois.set(adresse, recents);
    }
  }
}

export function resendRateLimited(email, { now = Date.now() } = {}) {
  purge(now);
  const adresse = normalizeEmail(email);
  const pourAdresse = renvois.get(adresse)?.length ?? 0;
  return pourAdresse >= MAX_RESENDS_PER_ADDRESS_PER_HOUR || renvoisGlobaux.length >= MAX_RESENDS_PER_HOUR;
}

export function registerResend(email, { now = Date.now() } = {}) {
  purge(now);
  const adresse = normalizeEmail(email);
  renvois.set(adresse, [...(renvois.get(adresse) ?? []), now]);
  renvoisGlobaux = [...renvoisGlobaux, now];
}

// Remet à zéro la limitation : utilisée par les tests, et après un redémarrage
// elle l'est de toute façon.
export function resetResendLimits() {
  renvois.clear();
  renvoisGlobaux = [];
}

// Émet un nouveau code pour un compte non vérifié.
//
// Renvoie `{ sent: false }` aussi bien pour une adresse inconnue que pour un
// compte déjà vérifié : la réponse HTTP ne doit pas dire qui possède un compte.
export async function resendVerification(store, { email, language } = {}) {
  const adresse = normalizeEmail(email);
  if (!adresse) {
    return { sent: false };
  }
  return store.transact((state) => {
    const user = state.users.find((entry) => entry.email === adresse && !entry.deletedAt);
    if (!user || user.emailVerifiedAt) {
      return { sent: false };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.verificationCode = code;
    user.verificationCodeCreatedAt = new Date().toISOString();
    // Un nouveau code remet le compteur à zéro : l'ancien est mort, le nouveau
    // a droit à ses cinq essais.
    user.verificationAttempts = 0;
    const courriel = verificationEmail(language, code);
    state.outbox.push({
      id: store.id("mail"),
      to: adresse,
      type: "email_verification",
      subject: courriel.subject,
      body: courriel.body,
      createdAt: new Date().toISOString()
    });
    return { sent: true, code };
  });
}
