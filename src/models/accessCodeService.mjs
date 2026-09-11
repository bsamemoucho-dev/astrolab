// Codes à usage unique : une lecture offerte, consommée à la première utilisation.
//
// Pourquoi un module à part : la règle « un code = une lecture » ne tient que si
// la VÉRIFICATION et la CONSOMMATION ont lieu dans la même transaction. Deux
// requêtes simultanées portant le même code passeraient toutes les deux un
// contrôle fait à côté, et produiraient deux lectures gratuites. Ce module ne
// prend donc que l'état (`state`) et s'appelle depuis l'intérieur d'une
// transaction — voir `createPaidDelivery`.
//
// Seule l'EMPREINTE du code est enregistrée, jamais le code lui-même : un
// stockage qui fuite ne distribue pas de lectures gratuites. Les codes font
// 16 caractères sur un alphabet de 32 (80 bits), donc l'empreinte n'a pas besoin
// d'être salée — il n'y a rien à deviner par force brute.

import { createHash, randomInt, randomUUID } from "node:crypto";

import { normalizePromoCode } from "../payments/pricing.mjs";

// Alphabet sans I, O, 0 ni 1 : ces caractères se confondent à la lecture comme au
// téléphone, et un code recopié de travers est un client bloqué.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const ACCESS_CODE_LENGTH = 16;

// La comparaison se fait sur la forme normalisée (sans espaces, tirets ni casse) :
// « abcd-efgh » et « ABCDEFGH » sont le même code, comme pour les codes promo.
export function hashAccessCode(code) {
  return createHash("sha256").update(normalizePromoCode(code)).digest("hex");
}

export function newAccessCode() {
  let code = "";
  for (let index = 0; index < ACCESS_CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
}

// Présentation par groupes de quatre, pour la recopie. La saisie n'a pas à
// respecter ces tirets : `normalizePromoCode` les retire.
export function formatAccessCode(code) {
  return String(code ?? "")
    .replace(/\s/g, "")
    .toUpperCase()
    .replace(/(.{4})(?=.)/g, "$1-");
}

// Contrôle SANS effet de bord : sert à décider du message d'erreur, jamais à
// autoriser une lecture. Seule `consumeAccessCode` fait autorité.
export function checkAccessCode(state, code, now = Date.now()) {
  const empreinte = hashAccessCode(code);
  const entree = (state.accessCodes ?? []).find((candidat) => candidat.hash === empreinte);
  if (!entree) {
    return { ok: false, reason: "inconnu" };
  }
  if (entree.usedAt) {
    return { ok: false, reason: "utilise", entry: entree };
  }
  if (entree.revokedAt) {
    // Un code révoqué ne se distingue pas d'un code inconnu de l'extérieur : la
    // personne à qui on l'a retiré n'a pas à apprendre qu'il a existé.
    return { ok: false, reason: "inconnu", entry: entree };
  }
  if (entree.expiresAt && Date.parse(entree.expiresAt) <= now) {
    return { ok: false, reason: "expire", entry: entree };
  }
  return { ok: true, entry: entree };
}

export function isUsableAccessCode(state, code, now = Date.now()) {
  return checkAccessCode(state, code, now).ok;
}

// Message et statut d'un refus. Partagé par le contrôle sans effet de bord (qui
// décide du message affiché) et par la consommation (qui fait autorité) : deux
// tables de messages finiraient par diverger, et le client verrait « invalide »
// là où le serveur pense « déjà utilisé ».
export function accessCodeError(reason) {
  const messages = {
    inconnu: "Ce code n'est pas valide.",
    utilise: "Ce code a déjà été utilisé.",
    expire: "Ce code a expiré."
  };
  const error = new Error(messages[reason] ?? messages.inconnu);
  // 409 pour un code déjà consommé : la demande est correcte, c'est l'état qui
  // s'y oppose — la distinction aide le client à comprendre qu'il ne s'est pas
  // trompé de code.
  error.status = reason === "utilise" ? 409 : 403;
  error.code = `access_code_${reason}`;
  return error;
}

// Consomme le code, ou refuse. À appeler DANS la transaction qui crée la
// livraison : l'entrée renvoyée doit être marquée utilisée dans la foulée
// (`markAccessCodeUsed`), sinon le code resterait utilisable.
export function consumeAccessCode(state, code, now = Date.now()) {
  const controle = checkAccessCode(state, code, now);
  if (!controle.ok) {
    throw accessCodeError(controle.reason);
  }
  return controle.entry;
}

export function markAccessCodeUsed(entry, { reference = null, now = Date.now() } = {}) {
  if (!entry) {
    return;
  }
  entry.usedAt = new Date(now).toISOString();
  entry.deliveryReference = reference;
}

// Crée `count` codes et renvoie les codes EN CLAIR. C'est la seule occasion de
// les voir : seul leur hachage est conservé.
export function createAccessCodes(state, { count = 1, label = null, expiresAt = null, now = Date.now() } = {}) {
  if (!Array.isArray(state.accessCodes)) {
    state.accessCodes = [];
  }
  const crees = [];
  for (let index = 0; index < count; index += 1) {
    let code = null;
    let empreinte = null;
    // Une collision est improbable, mais un doublon silencieux donnerait deux
    // codes pour une seule lecture : on retire jusqu'à obtenir une empreinte
    // inédite.
    do {
      code = newAccessCode();
      empreinte = hashAccessCode(code);
    } while (state.accessCodes.some((entree) => entree.hash === empreinte));

    const entree = {
      id: `code_${randomUUID()}`,
      hash: empreinte,
      label: label ? String(label).slice(0, 120) : null,
      createdAt: new Date(now).toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      usedAt: null,
      deliveryReference: null
    };
    state.accessCodes.push(entree);
    crees.push({ id: entree.id, code: formatAccessCode(code) });
  }
  return crees;
}

export function countUsableAccessCodes(state, now = Date.now()) {
  return (state.accessCodes ?? []).filter(
    (entree) =>
      !entree.usedAt &&
      // Un code révoqué n'est pas disponible — l'oublier ici le comptait encore,
      // et laissait le champ « J'ai un code » affiché sur le site sans raison.
      !entree.revokedAt &&
      (!entree.expiresAt || Date.parse(entree.expiresAt) > now)
  ).length;
}

// Vue d'exploitation : jamais le code, seulement son état.
export function listAccessCodes(state, now = Date.now()) {
  return (state.accessCodes ?? []).map((entree) => ({
    id: entree.id,
    label: entree.label,
    createdAt: entree.createdAt,
    expiresAt: entree.expiresAt,
    usedAt: entree.usedAt ?? null,
    deliveryReference: entree.deliveryReference ?? null,
    state: entree.revokedAt
      ? "révoqué"
      : entree.usedAt
        ? "utilisé"
        : entree.expiresAt && Date.parse(entree.expiresAt) <= now
          ? "expiré"
          : "disponible"
  }));
}

export function revokeAccessCode(state, identifiant, now = Date.now()) {
  const entree = (state.accessCodes ?? []).find(
    (candidat) => candidat.id === identifiant || candidat.hash === hashAccessCode(identifiant)
  );
  // Un code déjà utilisé n'est pas « révoqué » : la lecture qu'il a ouverte
  // existe, la retirer du registre ne la retirerait pas au client.
  if (!entree || entree.usedAt || entree.revokedAt) {
    return false;
  }
  entree.revokedAt = new Date(now).toISOString();
  return true;
}
