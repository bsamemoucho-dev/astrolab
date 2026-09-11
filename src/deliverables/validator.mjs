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

// Placeholders non remplis. Rien ne doit jamais partir avec « [Votre prénom ou
// un mot symbolique] » dans une lettre présentée comme personnelle : cela
// trahit une machine, et c'est immédiatement visible pour un client payant.
const PLACEHOLDER_PATTERNS = [
  /\[[^\]\n]{1,80}\]/,
  /\{\{?[^}\n]{1,80}\}?\}/,
  /<[^>\n]{1,80}>/,
  /\b(?:Votre|Ton|Ta|Vos|Tes)\s+(?:prénom|nom|ville|date|heure)\b/i,
  /\b(?:insérer|insérez|ajouter|ajoutez|compléter|complétez)\b[^.!?\n]{0,40}\b(?:ici|prénom|nom)\b/i
];

// Invention biographique. La consigne « n'invente aucun événement » ne suffisait
// pas : le modèle ne mettait pas de dates, mais reconstruisait une vie
// (« responsabilités précoces », « renoncements silencieux », « sacrifices »).
// Ce qu'on interdit ici, c'est de déduire une histoire à partir de placements.
const BIOGRAPHICAL_PATTERNS = [
  /responsabilit[és]+\s+(pr[ée]coces?|d[èe]s\s+(le\s+plus\s+jeune|jeune|[ée]ge))/i,
  /renoncements?\b/i,
  /sacrifices?\s+(personnels?|familiaux?|silencieux)/i,
  /pression\s+de\s+r[ée]ussir/i,
  /\bon\s+(t'|vous\s+)?a\s+demand[ée]/i,
  /\b(tu|vous)\s+as\s+d[ûu]|\b(tu|vous)\s+avez\s+d[ûu]/i,
  /loyaut[és]+\s+familial/i,
  /secrets?\s+de\s+famille/i,
  /d[èe]s\s+ton\s+plus\s+jeune\s+[âa]ge/i
];

export function findBiographicalInvention(text) {
  const found = [];
  for (const sentence of String(text ?? "").split(/(?<=[.!?])\s+/)) {
    if (!sentence.trim()) {
      continue;
    }
    if (BIOGRAPHICAL_PATTERNS.some((pattern) => pattern.test(sentence))) {
      found.push({ sentence: sentence.trim() });
    }
  }
  return found;
}

export function findUnfilledPlaceholders(text) {
  const found = [];
  for (const sentence of String(text ?? "").split(/(?<=[.!?])\s+/)) {
    if (!sentence.trim()) {
      continue;
    }
    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(sentence))) {
      found.push({ sentence: sentence.trim() });
    }
  }
  return found;
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

// Plafond de langage quand l'heure de naissance est approximative.
//
// Le moteur borne désormais les angles, les maisons et la secte par une marge
// déclarée (±30 min par défaut) : dès que la marge n'est pas nulle, un signe
// d'angle n'est plus un fait mais une probabilité, et si la frontière tombe dans
// la marge il n'est pas décidable du tout. Une consigne ne suffit pas : ce
// détecteur mesure ce qui est réellement écrit.
const ANGLE_WORDS = [
  ["ascendant", "ascendant"],
  ["milieu du ciel", "midheaven"],
  ["mc", "midheaven"]
];

const HEDGE_PATTERNS = [
  /probablement/i,
  /sans\s+doute/i,
  /vraisemblablement/i,
  /apparemment/i,
  /peut-être/i,
  /peut\s+être/i,
  /possible/i,
  /hypothèse/i,
  /hypothese/i,
  /semble|semblerait|sembleraient/i,
  /fronti[èe]re/i,
  /ne\s+peut\s+pas\s+[êe]tre\s+(tranch|d[ée]termin)/i,
  /ne\s+peuvent\s+pas\s+[êe]tre\s+(tranch|d[ée]termin)/i,
  /marge/i,
  /incertitude/i,
  /approximative/i,
  /vers\s+\d/i,
  /autour\s+de\s+\d/i,
  /environ/i,
  /plage/i,
  /plut[ôo]t/i,
  /tendance/i,
  /selon/i,
  /borne|born[ée]e?/i
];

function hasHedge(sentence) {
  return HEDGE_PATTERNS.some((pattern) => pattern.test(sentence));
}

function signsInSentenceFr(sentence) {
  const signs = new Set();
  for (const [fr, en] of SIGN_WORDS) {
    if (new RegExp(`\\b${fr}\\b`, "i").test(sentence)) {
      signs.add(en);
    }
  }
  return signs;
}

export function findUnhedgedTimedAssertions(text, socle) {
  const cap = socle?.timeLanguageCap ?? null;
  if (!cap) {
    return [];
  }
  const found = [];
  for (const sentence of String(text ?? "").split(/(?<=[.!?])\s+/)) {
    const trimmed = sentence.trim();
    if (!trimmed) {
      continue;
    }
    const signs = signsInSentenceFr(trimmed);
    const mentionedAngles = [...new Set(ANGLE_WORDS.filter(([word]) => new RegExp(`\\b${word}\\b`, "i").test(trimmed)).map(([, key]) => key))];
    const hedged = hasHedge(trimmed);

    // 1. Degré précis sur un angle : interdit tant que la marge n'est pas nulle.
    if (mentionedAngles.length > 0 && /\b\d{1,2}\s*(?:°|degr[ée])/.test(trimmed)) {
      found.push({
        sentence: trimmed,
        code: "exact_angle_degree_with_uncertainty_margin",
        angle: mentionedAngles[0]
      });
      continue;
    }

    // 2. Signe d'angle affirmé (chaque angle a sa propre fenêtre de marge).
    if (mentionedAngles.length > 0 && signs.size > 0) {
      let flagged = false;
      for (const angle of mentionedAngles) {
        const stable =
          angle === "ascendant" ? cap.ascendantSignStableWithinMargin : cap.midheavenSignStableWithinMargin;
        const windowSigns =
          (angle === "ascendant" ? cap.ascendantSignsInWindow : cap.midheavenSignsInWindow) ?? [];
        // Une formulation de frontière nomme les deux signes possibles : c'est
        // la seule manière acceptable de parler d'un signe non décidable.
        const namesWholeWindow = windowSigns.length > 1 && windowSigns.every((sign) => signs.has(sign));
        if (stable === false && !namesWholeWindow) {
          found.push({ sentence: trimmed, code: "undecidable_angle_sign_asserted", angle, signsInWindow: windowSigns });
          flagged = true;
          break;
        }
        if (stable !== false && !hedged) {
          found.push({ sentence: trimmed, code: "unhedged_angle_sign_assertion", angle });
          flagged = true;
          break;
        }
        if (stable === false && namesWholeWindow && !hedged) {
          found.push({ sentence: trimmed, code: "unhedged_angle_sign_assertion", angle });
          flagged = true;
          break;
        }
      }
      if (flagged) {
        continue;
      }
    }

    // 3. Maison numérotée alors que les maisons ne sont pas décidables.
    if (cap.housesDecidableWithinMargin === false) {
      const houseMatch = trimmed.match(/\b(?:maison|houses?)\s*(?:n[°o]\s*)?(\d{1,2})\b/i) ?? trimmed.match(/\ben\s+maison\s+(\d{1,2})\b/i);
      if (houseMatch) {
        found.push({ sentence: trimmed, code: "undecidable_house_asserted", house: Number(houseMatch[1]) });
        continue;
      }
    }

    // 4. Corps dont le signe change dans la marge.
    const unstableBodies = cap.bodySignsNotStableWithinMargin ?? [];
    if (unstableBodies.length > 0 && signs.size > 0) {
      const named = unstableBodies.filter((body) => {
        const fr = BODY_NAMES.find(([, en]) => en === body)?.[0];
        return fr ? new RegExp(`\\b${fr}\\b`, "i").test(trimmed) : false;
      });
      if (named.length > 0) {
        found.push({ sentence: trimmed, code: "undecidable_body_sign_asserted", bodies: named });
      }
    }
  }
  return found;
}

export function validateSectionText({ sectionId, text, socle }) {
  const issues = [];
  if (!text || !text.trim()) {
    return { ok: false, issues: [{ severity: "error", code: "empty_section", message: "Section vide." }] };
  }

  // Plafond de langage de l'heure approximative, mesuré sur le texte réel.
  for (const violation of findUnhedgedTimedAssertions(text, socle)) {
    issues.push({
      severity: "error",
      code: violation.code,
      message:
        violation.code === "undecidable_angle_sign_asserted"
          ? `Le texte affirme un signe d'${violation.angle} alors qu'il change dans la marge d'incertitude (${(violation.signsInWindow ?? []).join(" / ")}).`
          : violation.code === "exact_angle_degree_with_uncertainty_margin"
            ? `Le texte donne un degré précis pour ${violation.angle} alors que l'heure de naissance est approximative.`
            : violation.code === "undecidable_house_asserted"
              ? `Le texte affirme la maison ${violation.house} alors que les maisons ne sont pas décidables dans la marge d'incertitude.`
              : violation.code === "undecidable_body_sign_asserted"
                ? `Le texte affirme un signe pour un corps qui change de signe dans la marge : ${(violation.bodies ?? []).join(", ")}.`
                : `Affirmation non nuancée alors que l'heure de naissance est approximative : « ${violation.sentence} ».`,
      sentence: violation.sentence
    });
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
        severity: "warning",        code: "deterministic_certainty",
        message: "Formulation déterministe possible (« tu es … ») : reformuler en dynamique respectueuse du libre arbitre."
      });
      break;
    }
  }

  const seen = new Set();
  for (const match of text.matchAll(FACT_PATTERN)) {    const rawKind = match[1].toLowerCase();
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
