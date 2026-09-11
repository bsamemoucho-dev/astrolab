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

const SIGN_WORDS = [
  ["bélier", "Aries"], ["belier", "Aries"], ["taureau", "Taurus"], ["gémeaux", "Gemini"], ["gemeaux", "Gemini"],
  ["cancer", "Cancer"], ["lion", "Leo"], ["vierge", "Virgo"], ["balance", "Libra"], ["scorpion", "Scorpio"],
  ["sagittaire", "Sagittarius"], ["capricorne", "Capricorn"], ["verseau", "Aquarius"], ["poissons", "Pisces"]
];

// Contradiction planète ↔ signe, au niveau de la phrase.
//
// Le contrôle historique ne couvrait que Soleil, Lune, Ascendant et Milieu du
// Ciel. Une phrase comme « ton Soleil, ta Lune et Mercure en Balance » passait
// donc alors que la Lune était en Cancer — l'erreur qui fait perdre confiance.
//
// Règle retenue : si une phrase nomme des planètes ET un signe, et qu'aucune des
// planètes nommées n'est dans ce signe, c'est une contradiction. Si au moins une
// correspond, on ne conclut rien (énumération ambiguë).
const BODY_NAMES = [
  ["soleil", "Sun"],
  ["lune", "Moon"],
  ["mercure", "Mercury"],
  ["vénus", "Venus"],
  ["venus", "Venus"],
  ["mars", "Mars"],
  ["jupiter", "Jupiter"],
  ["saturne", "Saturn"]
];

function normalizeSignWord(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function findSignContradictions(text, socle) {
  const bodies = Array.isArray(socle?.bodies) ? socle.bodies : [];
  const bodiesBySign = new Map();
  for (const body of bodies) {
    if (!body?.sign) {
      continue;
    }
    const key = normalizeSignWord(body.sign);
    bodiesBySign.set(key, [...(bodiesBySign.get(key) ?? []), body.body]);
  }
  const contradictions = [];
  for (const sentence of String(text ?? "").split(/(?<=[.!?])\s+/)) {
    if (!sentence.trim()) {
      continue;
    }
    const mentioned = BODY_NAMES.filter(([fr]) => new RegExp(`\\b${fr}\\b`, "i").test(sentence)).map(([, en]) => en);
    if (mentioned.length === 0) {
      continue;
    }
    // Signes cités dans la phrase, via la table française déjà utilisée ailleurs.
    const signsInSentence = new Set();
    for (const [fr, en] of SIGN_WORDS) {
      if (new RegExp(`\\b${fr}\\b`, "i").test(sentence)) {
        // La comparaison se fait sur le nom anglais, celui des faits calculés.
        signsInSentence.add(normalizeSignWord(en));
      }
    }
    if (signsInSentence.size === 0) {
      continue;
    }
    const matches = [...signsInSentence].some((sign) => (bodiesBySign.get(sign) ?? []).some((body) => mentioned.includes(body)));
    if (!matches) {
      contradictions.push({ sentence, bodies: mentioned, signs: [...signsInSentence] });
    }
  }
  return contradictions;
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
