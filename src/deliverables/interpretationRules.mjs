export const INTERPRETATION_LIBRARY_VERSION = "lastro-interpretation-library@0.1.0";

export const LASTRO_INTERPRETATION_CONVENTIONS = Object.freeze({
  aspectTensionV1: {
    ruleId: "lastro.category.aspect_tension@1",
    description: "Convention éditoriale Lastro V1 : conjunction, square and opposition may mark a tension to articulate. This is not a scientific fact.",
    aspectTypes: ["conjunction", "square", "opposition"]
  },
  aspectSupportV1: {
    ruleId: "lastro.category.aspect_support@1",
    description: "Convention éditoriale Lastro V1 : trine and sextile may mark an easier circulation. This is not a scientific fact.",
    aspectTypes: ["trine", "sextile"]
  },
  chapterSelectionV1: {
    ruleId: "lastro.category.chapter_selection@1",
    description: "Convention éditoriale Lastro V1 for assigning evidence ownership to chapters. It does not create new astrology facts."
  }
});

const COMMON_FORBIDDEN = Object.freeze([
  "diagnostic psychologique",
  "événement biographique inventé",
  "prédiction",
  "fatalisme",
  "certitude sur un tiers"
]);

export const INTERPRETATION_RULES = Object.freeze([
  {
    ruleId: "western.body.sun.sign.capricorn@1",
    evidenceType: "NATAL_BODY_SIGN",
    match: { body: "Sun", sign: "Capricorn" },
    themes: [
      "construction progressive de l'identité",
      "besoin de donner une forme durable à l'élan personnel",
      "rapport sérieux au temps et aux responsabilités choisies"
    ],
    forbidden: COMMON_FORBIDDEN
  },
  {
    ruleId: "western.body.moon.sign.libra@1",
    evidenceType: "NATAL_BODY_SIGN",
    match: { body: "Moon", sign: "Libra" },
    themes: [
      "recherche d'équilibre dans le monde émotionnel",
      "sensibilité aux atmosphères relationnelles",
      "besoin d'harmoniser ressenti personnel et présence de l'autre"
    ],
    forbidden: COMMON_FORBIDDEN
  },
  {
    ruleId: "western.aspect.moon_mercury.square@1",
    evidenceType: "NATAL_ASPECT",
    match: { bodies: ["Moon", "Mercury"], aspectType: "square" },
    categories: [LASTRO_INTERPRETATION_CONVENTIONS.aspectTensionV1.ruleId],
    themes: [
      "tension entre ressenti et formulation",
      "besoin d'articuler émotion et pensée sans les confondre",
      "écart possible entre ce qui est senti et ce qui est dit"
    ],
    forbidden: COMMON_FORBIDDEN
  },
  {
    ruleId: "western.transit.jupiter_sun.square@1",
    evidenceType: "PERSONAL_TRANSIT",
    match: { transitBody: "Jupiter", natalPoint: "Sun", aspectType: "square" },
    categories: [LASTRO_INTERPRETATION_CONVENTIONS.aspectTensionV1.ruleId],
    themes: [
      "expansion à ajuster à l'identité réelle",
      "élan de croissance à cadrer",
      "questionnement sur la juste mesure des ambitions"
    ],
    forbidden: COMMON_FORBIDDEN
  },
  {
    ruleId: "western.current_sky.snapshot@1",
    evidenceType: "TRANSIT_SNAPSHOT",
    match: {},
    themes: [
      "instantané daté du ciel personnel",
      "lecture conservable mais non dynamique",
      "horizon temporel explicitement borné"
    ],
    forbidden: COMMON_FORBIDDEN
  }
]);

function norm(value) {
  return String(value ?? "").toLowerCase();
}

function sameBodies(left = [], right = []) {
  return left.map(norm).sort().join("|") === right.map(norm).sort().join("|");
}

export function interpretationRuleById(ruleId) {
  return INTERPRETATION_RULES.find((rule) => rule.ruleId === ruleId) ?? null;
}

export function ruleMatchesEvidence(rule, evidence) {
  if (!rule || !evidence || rule.evidenceType !== evidence.type) return false;
  const match = rule.match ?? {};
  const value = evidence.value ?? {};
  if (match.body && norm(match.body) !== norm(value.body)) return false;
  if (match.sign && norm(match.sign) !== norm(value.sign)) return false;
  if (match.aspectType && norm(match.aspectType) !== norm(value.aspectType)) return false;
  if (match.bodies && !sameBodies(match.bodies, [value.bodyA, value.bodyB])) return false;
  if (match.transitBody && norm(match.transitBody) !== norm(value.transitBody)) return false;
  if (match.natalPoint && norm(match.natalPoint) !== norm(value.natalPoint)) return false;
  return true;
}

export function rulesForEvidence(evidence) {
  return INTERPRETATION_RULES.filter((rule) => ruleMatchesEvidence(rule, evidence));
}

export function allInterpretationRuleIds() {
  return INTERPRETATION_RULES.map((rule) => rule.ruleId);
}
