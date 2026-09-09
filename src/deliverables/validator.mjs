// Machine validation of client dossier text against the guardrail contract:
// nothing invented, no event predictions, no medical/diagnostic claims, no
// excessive deterministic certainty, and no contradiction with verified facts.

import { enSignFromFr, frSign } from "./french.mjs";

const PREDICTIVE_PATTERNS = [
  /(tu|vous)\s+(vas|allez|va)\s+(rencontrer|tomber amoureu|te marier|vous marier|changer de travail|quitter|divorcer|perdre|gagner de l'argent|avoir un enfant|déménager|acheter|vendre|partir vivre)/i,
  /(va|vont)\s+(se passer|arriver|changer)\s+.*(dans|en)\s+\d+/i,
  /\b(le|en)\s+\d{1,2}\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+20\d\d\b/i
];

const MEDICAL_PATTERNS = [
  /diagnostic/i,
  /dépression clinique|depression clinique/i,
  /trouble\s+(de\s+la\s+)?personnalité/i,
  /trouble\s+(anxieux|bipolaire|dépressif|depressif)/i,
  /maladie\s+mentale/i
];

const DETERMINISTIC_PATTERNS = [
  /tu\s+es\s+(fait|comme ça|comme ca|un\s+\w+|une\s+\w+)/i,
  /ta\s+personnalité\s+est/i,
  /tu\s+es\s+quelqu'un\s+qui/i
];

const FACT_PATTERN = /\b(soleil|lune|ascendant|milieu\s+du\s+ciel)\s+(?:en|:)?\s*([A-Za-zÀ-ÿéèêëïîôûùç']+)/gi;

function expectedSign(socle, kind) {
  if (kind === "soleil") {
    return socle?.bodies?.find((body) => body.body === "Sun")?.sign ?? null;
  }
  if (kind === "lune") {
    return socle?.bodies?.find((body) => body.body === "Moon")?.sign ?? null;
  }
  if (kind === "ascendant") {
    return socle?.ascendant?.sign ?? null;
  }
  if (kind === "milieu du ciel") {
    return socle?.midheaven?.sign ?? null;
  }
  return null;
}

export function validateSectionText({ sectionId, text, socle }) {
  const issues = [];
  if (!text || !text.trim()) {
    return { ok: false, issues: [{ severity: "error", code: "empty_section", message: "Section vide." }] };
  }

  for (const pattern of PREDICTIVE_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({ severity: "error", code: "event_prediction", message: "Prédiction d'événement détectée (interdite)." });
      break;
    }
  }

  for (const pattern of MEDICAL_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({ severity: "error", code: "medical_or_diagnostic", message: "Affirmation médicale ou diagnostique détectée (interdite)." });
      break;
    }
  }

  for (const pattern of DETERMINISTIC_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        severity: "warning",
        code: "deterministic_certainty",
        message: "Formulation déterministe possible (« tu es … ») : reformuler en dynamique respectueuse du libre arbitre."
      });
      break;
    }
  }

  const seen = new Set();
  for (const match of text.matchAll(FACT_PATTERN)) {
    const rawKind = match[1].toLowerCase();
    const candidateFr = match[2].trim().replace(/'/g, "");
    const signEn = enSignFromFr(candidateFr);
    if (!signEn) {
      continue; // not a zodiac word; ignore false positives
    }
    const kindKey = rawKind === "milieu du ciel" ? "milieu du ciel" : rawKind === "soleil" ? "soleil" : rawKind === "lune" ? "lune" : rawKind;
    const seenKey = `${kindKey}:${signEn}`;
    if (seen.has(seenKey)) {
      continue;
    }
    seen.add(seenKey);
    const expected = expectedSign(socle, kindKey);
    if (expected === null) {
      if (kindKey === "ascendant" || kindKey === "milieu du ciel") {
        issues.push({
          severity: "error",
          code: "invented_unavailable_fact",
          message: `Le texte affirme « ${rawKind} ${candidateFr} » alors qu'aucun ${rawKind} n'a pu être calculé (temps inconnu).`
        });
      }
      continue;
    }
    if (expected !== signEn) {
      issues.push({
        severity: "error",
        code: "contradiction_with_socle",
        message: `Le texte dit « ${rawKind} ${candidateFr} » alors que le calcul vérifié donne ${rawKind} en ${frSign(expected).fr}.`
      });
    }
  }

  return { ok: issues.every((issue) => issue.severity !== "error"), issues };
}
