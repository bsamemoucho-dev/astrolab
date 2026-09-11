// Machine validation of client dossier text against the guardrail contract:
// nothing invented, no event predictions, no medical/diagnostic claims, no
// excessive deterministic certainty, and no contradiction with verified facts.
//
// LANGUE : chaque contrôle s'applique dans la langue DU DOCUMENT. Les noms de
// planètes, de signes et d'aspects ne sont pas écrits ici : ils sont dérivés des
// tables i18n, seule source de vérité pour ce que le lecteur voit. Écrire ces
// règles en français seulement laissait passer une contradiction factuelle dans
// huit langues sur neuf — et refusait une phrase anglaise correcte, où le mot
// juste est « trine ».
//
// DEUX RÉGIMES : une règle de sécurité factuelle est FATALE (l'affirmation est
// fausse : on réécrit puis on retire la phrase). Une règle de langue ou de style
// ne l'est pas (on réécrit, on n'ampute jamais).

import { docStrings } from "./i18n.mjs";
import {
  canonicalKeysIn,
  degreeWords,
  prefixRegex,
  fillInWords,
  hasHedgeIn,
  identityFieldWords,
  localizedAspectIndex,
  localizedBodyIndex,
  localizedSignIndex,
  normalizeForMatch,
  possessiveWords,
  wordRegex
} from "./detectorVocabulary.mjs";

export { wordRegex };

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

// Invention biographique : motifs français uniquement à ce jour (voir la note de
// couverture en fin de fichier).
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

// Vouvoiement constant : règle de langue française (le tutoiement est le défaut
// visé en français ; dans les autres langues, la forme d'adresse attendue est
// décrite par le guide de style, pas par un détecteur).
const TU_PATTERN = wordRegex("tu|ton|ta|tes|toi|te|t'");

// Vocabulaire imposé : en français, on écrit « trigone », jamais « trine ». Le
// contrôle est limité au français : en anglais, « trine » EST le mot juste.
const FORBIDDEN_VOCABULARY_BY_LANGUAGE = {
  fr: [/\btrine\b/i]
};

// ---------------------------------------------------------------------------
// Contexte linguistique du document.
// ---------------------------------------------------------------------------
const STRINGS_CACHE = new Map();

function stringsFor(language) {
  const code = String(language ?? "fr").slice(0, 2).toLowerCase();
  if (!STRINGS_CACHE.has(code)) {
    STRINGS_CACHE.set(code, docStrings(code));
  }
  return STRINGS_CACHE.get(code);
}

function languageOf(socle) {
  return stringsFor(socle?.language ?? "fr").lang ?? "fr";
}

function splitSentences(text) {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

// Clé canonique d'un corps : `body` si présent, sinon dérivée de l'identifiant
// « body.Sun ». Les deux formes circulent (socles stockés avant la correction).
function canonicalBodyKey(fact) {
  if (fact?.body) {
    return fact.body;
  }
  const id = String(fact?.id ?? "");
  return id.startsWith("body.") ? id.slice(5) : id;
}

function localizedName(canonical, strings) {
  return strings?.signs?.[canonical] ?? canonical;
}

// ---------------------------------------------------------------------------
// Contradiction planète ↔ signe, et angle ↔ signe, au niveau de la phrase.
//
// Règle : si une phrase nomme des planètes ET un signe, et qu'aucune des planètes
// nommées n'est dans ce signe, c'est une contradiction. Si au moins une
// correspond, on ne conclut rien (énumération ambiguë).
// Pour un angle (Ascendant, Milieu du Ciel) : une seule valeur est attendue ;
// s'il n'a pas pu être calculé, l'affirmer est une invention.
// ---------------------------------------------------------------------------
export function findSignContradictions(text, socle) {
  const strings = stringsFor(languageOf(socle));
  const bodyIndex = localizedBodyIndex(strings);
  const signIndex = localizedSignIndex(strings);
  const bodies = Array.isArray(socle?.bodies) ? socle.bodies : [];
  const bodiesBySign = new Map();
  for (const body of bodies) {
    if (!body?.sign) {
      continue;
    }
    const key = normalizeForMatch(body.sign);
    bodiesBySign.set(key, [...(bodiesBySign.get(key) ?? []), canonicalBodyKey(body)]);
  }

  const angles = [
    { key: "ascendant", label: strings?.labels?.asc ?? "Ascendant", expected: socle?.ascendant?.sign ?? null },
    { key: "midheaven", label: strings?.labels?.mc ?? "Midheaven", expected: socle?.midheaven?.sign ?? null }
  ];

  const contradictions = [];
  for (const sentence of splitSentences(text)) {
    const mentionedBodies = canonicalKeysIn(sentence, bodyIndex);
    // Les noms de signes se déclinent (« im Löwen », « Væren ») : préfixe.
    const mentionedSigns = canonicalKeysIn(sentence, signIndex, { allowInflection: true });
    if (mentionedSigns.length === 0) {
      continue;
    }

    // Angles : contrôle à valeur unique.
    for (const angle of angles) {
      if (!prefixRegex(angle.label).test(sentence) && !wordRegex(angle.label).test(sentence)) {
        continue;
      }
      if (!angle.expected) {
        contradictions.push({
          code: "invented_unavailable_fact",
          sentence,
          angle: angle.key,
          signs: mentionedSigns,
          message: `Le texte nomme ${angle.label} alors qu'aucun calcul d'angle n'est disponible pour cette précision d'heure.`
        });
        continue;
      }
      // Les deux côtés sont des clés canoniques : ne pas normaliser d'un seul côté.
      if (!mentionedSigns.includes(angle.expected)) {
        contradictions.push({
          code: "contradiction_with_socle",
          sentence,
          angle: angle.key,
          expectedSign: angle.expected,
          signs: mentionedSigns,
          message: `Le texte situe ${angle.label} ailleurs que dans le signe calculé (${localizedName(angle.expected, strings)}).`
        });
      }
    }

    // Planètes : contradiction seulement si AUCUNE des planètes citées n'est
    // dans l'un des signes cités.
    if (mentionedBodies.length === 0) {
      continue;
    }
    const matches = mentionedSigns.some((sign) =>
      (bodiesBySign.get(normalizeForMatch(sign)) ?? []).some((body) => mentionedBodies.includes(body))
    );
    if (matches) {
      continue;
    }
    // Un corps dont le signe n'est pas établi (heure inconnue, intervalle) n'est
    // pas en « contradiction » : le texte affirme un fait qui n'a pas été
    // calculé. Le dire change ce que l'exploitant comprend du journal.
    const unestablished = new Set(socle?.signsNotEstablished ?? []);
    const affirmedUnestablished = mentionedBodies.filter((body) => unestablished.has(body));
    if (affirmedUnestablished.length > 0) {
      contradictions.push({
        code: "asserted_unestablished_sign",
        sentence,
        bodies: affirmedUnestablished,
        signs: mentionedSigns,
        message: `Le texte situe ${affirmedUnestablished.join(", ")} dans un signe précis alors que ce signe n'a pas pu être calculé (la position balaie plusieurs signes sur la période de naissance).`
      });
      continue;
    }
    contradictions.push({
      code: "contradiction_with_socle",
      sentence,
      bodies: mentionedBodies,
      signs: mentionedSigns,
      message: `Le texte associe ${mentionedBodies.join(", ")} à ${mentionedSigns
        .map((sign) => localizedName(sign, strings))
        .join(", ")} alors que le calcul vérifié ne le confirme pas.`
    });
  }
  return contradictions;
}

// ---------------------------------------------------------------------------
// Placeholders non remplis. Les marques structurelles ([…], {{…}}, <…>) sont
// universelles ; les formulations « votre prénom » sont cherchées dans la langue
// du document.
// ---------------------------------------------------------------------------
const UNIVERSAL_PLACEHOLDER_PATTERNS = [
  /\[[^\]\n]{1,80}\]/,
  /\{\{?[^}\n]{1,80}\}?\}/,
  /<[^>\n]{1,80}>/
];

export function findUnfilledPlaceholders(text, socle = null) {
  const language = languageOf(socle);
  const possessives = possessiveWords(language);
  const fields = identityFieldWords(language);
  const fillIns = fillInWords(language);
  const localized = [
    // « votre prénom » et, dans les langues a possessif postpose (« fornavnet
    // ditt » en norvegien et en danois), « prenom votre ».
    new RegExp(`(?:${possessives.join("|")})\\s+(?:${fields.join("|")})`, "iu"),
    new RegExp(`(?:${fields.join("|")})\\s+(?:${possessives.join("|")})`, "iu"),
    new RegExp(`(?:${fillIns.join("|")})[^.!?\\n]{0,40}(?:${fields.join("|")})`, "iu")
  ];
  const found = [];
  for (const sentence of splitSentences(text)) {
    if (UNIVERSAL_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(sentence))) {
      found.push({ sentence, code: "unfilled_placeholder" });
      continue;
    }
    if (localized.some((pattern) => pattern.test(sentence))) {
      found.push({ sentence, code: "unfilled_placeholder" });
    }
  }
  return found;
}

export function findBiographicalInvention(text) {
  const found = [];
  for (const sentence of splitSentences(text)) {
    if (BIOGRAPHICAL_PATTERNS.some((pattern) => pattern.test(sentence))) {
      found.push({ sentence, code: "biographical_invention" });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Plafond de langage quand l'heure de naissance est approximative.
//
// Le moteur borne les angles, les maisons et la secte par une marge déclarée :
// dès que la marge n'est pas nulle, un signe d'angle n'est plus un fait mais une
// probabilité, et si la frontière tombe dans la marge il n'est pas décidable du
// tout. Une consigne ne suffit pas : ce détecteur mesure ce qui est écrit.
// ---------------------------------------------------------------------------
export function findUnhedgedTimedAssertions(text, socle) {
  const cap = socle?.timeLanguageCap ?? null;
  if (!cap) {
    return [];
  }
  const language = languageOf(socle);
  const strings = stringsFor(language);
  const signIndex = localizedSignIndex(strings);
  // Préfixe : le document norvégien écrit « Ascendanten », l'allemand « im Löwen ».
  const angleWords = [
    { key: "ascendant", label: strings?.labels?.asc ?? "Ascendant" },
    { key: "midheaven", label: strings?.labels?.mc ?? "Midheaven" }
  ].map((angle) => ({ ...angle, regex: prefixRegex(angle.label) }));
  const houseWord = strings?.labels?.house ?? "house";
  const houseRegex = new RegExp(`(?:${houseWord})\\s*(?:n[°o]\\s*)?(\\d{1,2})`, "iu");
  const degrees = degreeWords(language).join("|");
  const degreeRegex = new RegExp(`\\d{1,2}\\s*(?:°|${degrees})`, "iu");
  const bodyIndex = localizedBodyIndex(strings);

  const found = [];
  for (const sentence of splitSentences(text)) {
    const mentionedSigns = canonicalKeysIn(sentence, signIndex, { allowInflection: true });
    const mentionedAngles = angleWords.filter((angle) => angle.regex.test(sentence)).map((angle) => angle.key);
    const hedged = hasHedgeIn(sentence, language);

    // 1. Degré précis sur un angle : interdit tant que la marge n'est pas nulle.
    if (mentionedAngles.length > 0 && degreeRegex.test(sentence)) {
      found.push({ sentence, code: "exact_angle_degree_with_uncertainty_margin", angle: mentionedAngles[0] });
      continue;
    }

    // 2. Signe d'angle affirmé (chaque angle a sa propre fenêtre de marge).
    if (mentionedAngles.length > 0 && mentionedSigns.length > 0) {
      let flagged = false;
      for (const angle of mentionedAngles) {
        const stable =
          angle === "ascendant" ? cap.ascendantSignStableWithinMargin : cap.midheavenSignStableWithinMargin;
        const windowSigns =
          (angle === "ascendant" ? cap.ascendantSignsInWindow : cap.midheavenSignsInWindow) ?? [];
        // Une formulation de frontière nomme les deux signes possibles : c'est
        // la seule manière acceptable de parler d'un signe non décidable.
        const namesWholeWindow = windowSigns.length > 1 && windowSigns.every((sign) => mentionedSigns.includes(sign));
        if (stable === false && !namesWholeWindow) {
          found.push({ sentence, code: "undecidable_angle_sign_asserted", angle, signsInWindow: windowSigns });
          flagged = true;
          break;
        }
        if (stable === false && namesWholeWindow && !hedged) {
          found.push({ sentence, code: "unhedged_angle_sign_assertion", angle });
          flagged = true;
          break;
        }
        if (stable !== false && !hedged) {
          found.push({ sentence, code: "unhedged_angle_sign_assertion", angle });
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
      const houseMatch = sentence.match(houseRegex) ?? sentence.match(/\b(?:maison|houses?)\s*(\d{1,2})\b/i);
      if (houseMatch) {
        found.push({ sentence, code: "undecidable_house_asserted", house: Number(houseMatch[1]) });
        continue;
      }
    }

    // 4. Corps dont le signe change dans la marge.
    const unstableBodies = cap.bodySignsNotStableWithinMargin ?? [];
    if (unstableBodies.length > 0 && mentionedSigns.length > 0) {
      const named = mentionedBodiesIn(sentence, bodyIndex, unstableBodies);
      if (named.length > 0) {
        found.push({ sentence, code: "undecidable_body_sign_asserted", bodies: named });
      }
    }
  }
  return found;
}

function mentionedBodiesIn(sentence, bodyIndex, canonicalBodies) {
  const mentioned = canonicalKeysIn(sentence, bodyIndex);
  return mentioned.filter((body) => canonicalBodies.includes(body));
}

// ---------------------------------------------------------------------------
// Vocabulaire et tutoiement (français).
// ---------------------------------------------------------------------------
export function findForbiddenVocabulary(text, language = "fr") {
  const patterns = FORBIDDEN_VOCABULARY_BY_LANGUAGE[String(language ?? "fr").slice(0, 2).toLowerCase()] ?? [];
  if (patterns.length === 0) {
    return [];
  }
  const found = [];
  for (const sentence of splitSentences(text)) {
    if (patterns.some((pattern) => pattern.test(sentence))) {
      found.push({ sentence, code: "forbidden_vocabulary" });
    }
  }
  return found;
}

// Sections où le tutoiement est VOULU : la partie transgénérationnelle et la
// lettre aux figures parentales s'adressent directement à la personne.
export const TUTOIEMENT_SECTIONS = Object.freeze(["transgenerationnel", "lettre-miroir"]);

export function findTutoiement(text, language = "fr", sectionId = null) {
  if (String(language ?? "fr").slice(0, 2).toLowerCase() !== "fr") {
    return [];
  }
  if (sectionId && TUTOIEMENT_SECTIONS.includes(sectionId)) {
    return [];
  }
  const found = [];
  for (const sentence of splitSentences(text)) {
    if (TU_PATTERN.test(sentence)) {
      found.push({ sentence, code: "tutoiement" });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Antécédent orphelin (« Cette position… » sans placement nommé). Motifs
// français à ce jour : la règle éditoriale française est celle qui a été
// observée défaillante.
// ---------------------------------------------------------------------------
const DEMONSTRATIVE_OPENERS = [
  /^(?:cette|cet|ce|ces)\s+(position|maison|place|placement|configuration|figure|structure|dynamique|énergie|energie|tension|planète|planete|thème|theme|axe|aspect|influence)\b/i,
  /^(?:il|elle)\s+(s'agit|correspond|renvoie|traduit)\b/i
];

export function findOrphanAntecedents(text, socle = null) {
  const strings = stringsFor(languageOf(socle));
  const bodyIndex = localizedBodyIndex(strings);
  const houseWord = strings?.labels?.house ?? "maison";
  const angleWords = [strings?.labels?.asc, strings?.labels?.mc].filter(Boolean);
  const found = [];
  let namedSoFar = false;
  for (const sentence of splitSentences(text)) {
    const namesPlacement =
      canonicalKeysIn(sentence, bodyIndex).length > 0 ||
      new RegExp(`(?:${houseWord})\\s*(?:n[°o]\\s*)?\\d{1,2}`, "iu").test(sentence) ||
      angleWords.some((label) => prefixRegex(label).test(sentence));
    if (namesPlacement) {
      namedSoFar = true;
      continue;
    }
    const orphan = DEMONSTRATIVE_OPENERS.find((pattern) => pattern.test(sentence));
    if (orphan && !namedSoFar) {
      found.push({ sentence, code: "orphan_antecedent", referent: sentence.split(/\s+/).slice(0, 2).join(" ").toLowerCase() });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Anti-répétition entre sections : un même placement ne doit pas être expliqué
// deux fois. On compare la SIGNATURE du placement (corps concernés, aspect,
// maison), pas la formulation — et dans la langue du document.
// ---------------------------------------------------------------------------
function signatureFromSentence(sentence, strings) {
  const signatures = [];
  const bodyIndex = localizedBodyIndex(strings);
  const aspectIndex = localizedAspectIndex(strings);
  const bodies = canonicalKeysIn(sentence, bodyIndex);
  const aspect = canonicalKeysIn(sentence, aspectIndex)[0] ?? null;
  if (bodies.length === 2 && aspect) {
    signatures.push(`aspect:${[...bodies].sort().join("-")}:${aspect}`);
  }
  const houseWord = strings?.labels?.house ?? "maison";
  const house = sentence.match(new RegExp(`(?:${houseWord})\\s*(?:n[°o]\\s*)?(\\d{1,2})`, "iu"))
    ?? sentence.match(/\bmaison\s*(\d{1,2})\b/i);
  if (house && bodies.length === 1) {
    signatures.push(`house:${bodies[0]}:${Number(house[1])}`);
  }
  return signatures;
}

export function findRepeatedPlacements(text, previousSections = [], socle = null) {
  const strings = stringsFor(languageOf(socle));
  const alreadyExplained = new Set();
  for (const section of Array.isArray(previousSections) ? previousSections : []) {
    for (const signature of signatureFromSentence(String(section?.excerpt ?? section?.text ?? ""), strings)) {
      alreadyExplained.add(signature);
    }
  }
  if (alreadyExplained.size === 0) {
    return [];
  }
  const found = [];
  const seenHere = new Set();
  for (const sentence of splitSentences(text)) {
    for (const signature of signatureFromSentence(sentence, strings)) {
      if (alreadyExplained.has(signature) && !seenHere.has(signature)) {
        seenHere.add(signature);
        found.push({ sentence, code: "repeated_placement", signature });
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Contrôle complet d'une section.
// ---------------------------------------------------------------------------
export function validateSectionText({ sectionId, text, socle }) {
  const issues = [];
  if (!text || !text.trim()) {
    return { ok: false, issues: [{ severity: "error", code: "empty_section", message: "Section vide." }] };
  }
  const language = languageOf(socle);

  // Plafond de langage de l'heure approximative, mesuré sur le texte réel.
  for (const violation of findUnhedgedTimedAssertions(text, socle)) {
    issues.push({
      severity: violation.code === "unhedged_angle_sign_assertion" ? "warning" : "error",
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

  // Vocabulaire imposé : « trigone », jamais « trine » (en français seulement).
  for (const violation of findForbiddenVocabulary(text, language)) {
    issues.push({
      severity: "error",
      code: "forbidden_vocabulary",
      message: `Vocabulaire interdit : ${violation.sentence}`,
      sentence: violation.sentence
    });
  }

  // Contradictions et faits non calculés, dans la langue du document.
  for (const contradiction of findSignContradictions(text, socle)) {
    issues.push({
      severity: "error",
      code: contradiction.code,
      message: contradiction.message,
      sentence: contradiction.sentence
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
        severity: "warning",
        code: "deterministic_certainty",
        message: "Formulation déterministe possible (« tu es … ») : reformuler en dynamique respectueuse du libre arbitre."
      });
      break;
    }
  }

  return { ok: issues.every((issue) => issue.severity !== "error"), issues };
}

// ---------------------------------------------------------------------------
// Couverture mesurée des détecteurs (à garder à jour avec ce fichier).
//
//   toutes langues : plafond de langage de la marge, contradiction planète ↔
//                    signe et angle ↔ signe, placeholders (marques structurelles
//                    et formulations localisées) ;
//   français       : prédiction d'événement, affirmation médicale, formulation
//                    déterministe, invention biographique, tutoiement,
//                    vocabulaire imposé, antécédent orphelin.
//
// Étendre une règle à une langue, c'est ajouter son vocabulaire dans
// detectorVocabulary.mjs et un test dans tests/languageCoverage.test.mjs.
// ---------------------------------------------------------------------------
export const DETECTOR_COVERAGE = Object.freeze({
  allLanguages: Object.freeze([
    "time_margin_language_cap",
    "planet_and_angle_sign_contradiction",
    "unfilled_placeholder",
    "repeated_placement"
  ]),
  frenchOnly: Object.freeze([
    "event_prediction",
    "medical_claim",
    "deterministic_certainty",
    "biographical_invention",
    "tutoiement",
    "forbidden_vocabulary",
    "orphan_antecedent"
  ])
});
