import { RELATIONAL_AFFECTION_RULES, RELATIONAL_AFFECTION_SCOPE } from "./relationalAffectionRules.mjs";

export const INTERPRETATION_LIBRARY_VERSION = "lastro-interpretation-library@0.3.0";
export const RELATIONAL_COMMUNICATION_SCOPE = "individual_relational.communication";
export { RELATIONAL_AFFECTION_SCOPE };

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

const BODY_THEMES = Object.freeze({
  Sun: ["identité consciente", "direction personnelle", "manière de se tenir dans son axe"],
  Moon: ["monde émotionnel", "besoin de sécurité intérieure", "réactivité sensible"],
  Mercury: ["pensée et langage", "manière de relier les idées", "circulation mentale"],
  Venus: ["affectivité", "goût du lien", "manière d'accorder valeur et désir"],
  Mars: ["élan d'action", "affirmation", "manière d'engager l'énergie"],
  Jupiter: ["élargissement", "confiance", "rapport aux possibilités"],
  Saturn: ["structure", "responsabilité", "rapport aux limites"]
});

const SIGN_THEMES = Object.freeze({
  Aries: ["initiative", "franchise d'impulsion", "mouvement de départ"],
  Taurus: ["stabilité", "ancrage concret", "rythme patient"],
  Gemini: ["curiosité", "mobilité mentale", "besoin d'échanger"],
  Cancer: ["protection", "mémoire affective", "attention au climat intime"],
  Leo: ["expression", "rayonnement personnel", "besoin de créer depuis le coeur"],
  Virgo: ["discernement", "ajustement précis", "sens du détail utile"],
  Libra: ["équilibre", "sens du dialogue", "recherche d'accord"],
  Scorpio: ["intensité", "lucidité dans les zones sensibles", "transformation intérieure"],
  Sagittarius: ["ouverture", "quête de sens", "élan vers l'horizon"],
  Capricorn: ["construction", "tenue dans le temps", "responsabilité choisie"],
  Aquarius: ["indépendance", "vision collective", "écart créateur"],
  Pisces: ["réceptivité", "imaginaire", "porosité sensible"]
});

const ASPECT_KIND_THEMES = Object.freeze({
  conjunction: ["mise en contact direct", "accentuation du point natal touché"],
  opposition: ["mise en tension par polarité", "besoin d'ajuster deux pôles"],
  square: ["tension dynamique", "nécessité d'un ajustement actif"],
  trine: ["circulation plus fluide", "ressource disponible sans forcer"],
  sextile: ["opportunité de coopération", "soutien à activer consciemment"]
});

function ruleSlug(value) {
  return String(value ?? "").toLowerCase();
}

function titleWord(value) {
  return String(value ?? "").replace(/_/g, " ");
}

function natalBodySignRule(body, sign) {
  return {
    ruleId: `western.body.${ruleSlug(body)}.sign.${ruleSlug(sign)}@1`,
    evidenceType: "NATAL_BODY_SIGN",
    match: { body, sign },
    themes: [
      `${BODY_THEMES[body]?.[0] ?? titleWord(body)} teinté par ${SIGN_THEMES[sign]?.[0] ?? titleWord(sign)}`,
      `${BODY_THEMES[body]?.[1] ?? "fonction natale"} avec ${SIGN_THEMES[sign]?.[1] ?? "une coloration de signe"}`,
      `${BODY_THEMES[body]?.[2] ?? "dynamique personnelle"} à lire par ${SIGN_THEMES[sign]?.[2] ?? "ce signe"}`
    ],
    forbidden: COMMON_FORBIDDEN
  };
}

function personalTransitRule(transitBody, natalPoint, aspectType) {
  return {
    ruleId: `western.transit.${ruleSlug(transitBody)}_${ruleSlug(natalPoint)}.${ruleSlug(aspectType)}@1`,
    evidenceType: "PERSONAL_TRANSIT",
    match: { transitBody, natalPoint, aspectType },
    categories: ["conjunction", "square", "opposition"].includes(aspectType)
      ? [LASTRO_INTERPRETATION_CONVENTIONS.aspectTensionV1.ruleId]
      : [LASTRO_INTERPRETATION_CONVENTIONS.aspectSupportV1.ruleId],
    themes: [
      `${titleWord(transitBody)} active ${titleWord(natalPoint)} par ${titleWord(aspectType)}`,
      ASPECT_KIND_THEMES[aspectType]?.[0] ?? "contact astrologique daté",
      ASPECT_KIND_THEMES[aspectType]?.[1] ?? "lecture limitée à la fenêtre d'orbe"
    ],
    forbidden: COMMON_FORBIDDEN
  };
}

function natalAspectRule(bodyA, bodyB, aspectType, { themes, resourceThemes = [], attentionThemes = [], forbidden = [], editorialWeight = "primary", scope = null }) {
  return {
    ruleId: `western.natal.${ruleSlug(bodyA)}_${ruleSlug(bodyB)}.${ruleSlug(aspectType)}@1`,
    evidenceType: "NATAL_ASPECT",
    match: { bodies: [bodyA, bodyB], aspectType },
    categories: ["conjunction", "square", "opposition"].includes(aspectType)
      ? [LASTRO_INTERPRETATION_CONVENTIONS.aspectTensionV1.ruleId]
      : [LASTRO_INTERPRETATION_CONVENTIONS.aspectSupportV1.ruleId],
    scope: scope ? [scope] : null,
    themes,
    relationalCommunication: {
      function: null,
      editorialWeight,
      spontaneousThemes: themes,
      resourceThemes,
      attentionThemes
    },
    forbidden: [...COMMON_FORBIDDEN, ...forbidden]
  };
}

const GENERATED_NATAL_SIGN_RULES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].flatMap((body) =>
  Object.keys(SIGN_THEMES).map((sign) => natalBodySignRule(body, sign))
);

// Règles d'aspect natal — expérimentation ciblée du 18/10/2026.
//
// Périmètre volontairement minuscule : UNIQUEMENT les cinq aspects réellement
// présents dans le thème de référence (Moon–Jupiter sextile, Mars–Saturne
// opposition, Mercury–Vénus sextile, Soleil–Lune opposition, Soleil–Jupiter
// trigone). Aucune règle générique « tous les aspects de toutes les paires » :
// une règle sans preuve ne sert à rien, et une matrice de 105 règles écrites
// d'un coup ne serait pas relue.
//
// Convention explicite (voir docs/doctrine/natal-aspect-rules-v1.md) :
//   - la catégorie (tension / soutien) est une convention éditoriale Lastro,
//     versionnée dans LASTRO_INTERPRETATION_CONVENTIONS — pas un fait scientifique ;
//   - chaque thème décrit une dynamique intérieure possible, jamais un trait de
//     caractère établi, un événement, un diagnostic ou une prédiction ;
//   - aucune règle n'affirme ce que la géométrie du thème ne dit pas : l'orbe et
//     son serrage restent la mesure de la solidité de l'aspect, et le texte doit
//     rester sobre quand l'aspect est proche de la limite de son orbe.
//
// `scope` est volontairement absent : ces règles valent pour l'axe natal
// uniquement. Les axes relationnels exigent un `scope` explicite
// (individualRelationalPlan filtre sur `scope.includes(...)`), donc elles ne
// peuvent pas contaminer les chapitres relationnels.
const NATAL_ASPECT_CONVENTION_RULES = [
  {
    // Le plus serré des soutiens du thème : la confiance comme appui du ressenti.
    ruleId: "western.natal.aspect.moon_jupiter.sextile@1",
    evidenceType: "NATAL_ASPECT",
    match: { bodies: ["Moon", "Jupiter"], aspectType: "sextile" },
    categories: [LASTRO_INTERPRETATION_CONVENTIONS.aspectSupportV1.ruleId],
    themes: [
      "ouverture émotionnelle qui s'appuie sur la confiance plutôt que sur le contrôle",
      "besoin de sécurité intérieure rejoint par un élan de générosité",
      "ressource : accueillir plus large que ce qui est strictement nécessaire"
    ],
    forbidden: COMMON_FORBIDDEN
  },
  {
    // L'aspect le plus serré du thème, et le seul carré/opposition majeur.
    ruleId: "western.natal.aspect.mars_saturn.opposition@1",
    evidenceType: "NATAL_ASPECT",
    match: { bodies: ["Mars", "Saturn"], aspectType: "opposition" },
    categories: [LASTRO_INTERPRETATION_CONVENTIONS.aspectTensionV1.ruleId],
    themes: [
      "tension entre l'élan d'agir et la limite rencontrée",
      "l'effort peut se heurter à un cadre intérieur exigeant",
      "endurance possible dans l'effort long, au prix d'un rapport tendu à l'immédiateté"
    ],
    forbidden: COMMON_FORBIDDEN
  },
  {
    // Soutien proche de la limite de son orbe : la formulation reste sobre.
    ruleId: "western.natal.aspect.mercury_venus.sextile@1",
    evidenceType: "NATAL_ASPECT",
    match: { bodies: ["Mercury", "Venus"], aspectType: "sextile" },
    categories: [LASTRO_INTERPRETATION_CONVENTIONS.aspectSupportV1.ruleId],
    themes: [
      "facilité mobilisable pour dire ce qui a de la valeur",
      "goût du lien qui passe volontiers par la parole et l'échange",
      "attention : cette facilité reste à activer, elle ne se déclenche pas seule"
    ],
    forbidden: COMMON_FORBIDDEN
  },
  {
    // Opposition entre les deux luminaires : les deux exigences, pas un verdict.
    ruleId: "western.natal.aspect.sun_moon.opposition@1",
    evidenceType: "NATAL_ASPECT",
    match: { bodies: ["Sun", "Moon"], aspectType: "opposition" },
    categories: [LASTRO_INTERPRETATION_CONVENTIONS.aspectTensionV1.ruleId],
    themes: [
      "deux exigences intérieures qui tirent en sens opposé : direction consciente et besoin affectif",
      "nécessité d'ajuster ce qui se montre et ce qui se ressent",
      "l'identité se construit dans cet écart plutôt que dans un seul des deux pôles"
    ],
    forbidden: COMMON_FORBIDDEN
  },
  {
    // Soutien le plus large en orbe des aspects retenus : appui, pas promesse.
    ruleId: "western.natal.aspect.sun_jupiter.trine@1",
    evidenceType: "NATAL_ASPECT",
    match: { bodies: ["Sun", "Jupiter"], aspectType: "trine" },
    categories: [LASTRO_INTERPRETATION_CONVENTIONS.aspectSupportV1.ruleId],
    themes: [
      "confiance disponible pour élargir son horizon",
      "élan de croissance qui soutient la direction personnelle",
      "la facilité de cet appui peut dispenser de vérifier la juste mesure"
    ],
    forbidden: COMMON_FORBIDDEN
  }
];

const GENERATED_PERSONAL_TRANSIT_RULES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].flatMap((transitBody) =>
  ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].flatMap((natalPoint) =>
    Object.keys(ASPECT_KIND_THEMES).map((aspectType) => personalTransitRule(transitBody, natalPoint, aspectType))
  )
);

const RELATIONAL_COMMUNICATION_NATAL_ASPECT_RULES = [
  natalAspectRule("Mercury", "Mars", "conjunction", {
    scope: RELATIONAL_COMMUNICATION_SCOPE,
    themes: ["pensée, parole et réaction tendent à partir ensemble"],
    resourceThemes: ["capacité à formuler rapidement une position et à la défendre"],
    attentionThemes: ["le rythme de réponse peut être rapide et le ton plus tranché"],
    forbidden: ["agressivité", "colère", "violence verbale", "coupe forcément la parole"]
  }),
  natalAspectRule("Mercury", "Mars", "trine", {
    scope: RELATIONAL_COMMUNICATION_SCOPE,
    themes: ["circulation fluide entre idée, parole et prise de position"],
    resourceThemes: ["argumenter, réagir et transformer facilement une idée en échange concret"],
    attentionThemes: ["le rythme peut être plus rapide que celui d'un interlocuteur ayant besoin de davantage de temps"]
  }),
  natalAspectRule("Mercury", "Mars", "sextile", {
    scope: RELATIONAL_COMMUNICATION_SCOPE,
    themes: ["facilité mobilisable pour passer de la discussion à la proposition ou à l'action"],
    resourceThemes: ["capacité à formuler une initiative ou une solution lorsque la situation le demande"],
    attentionThemes: []
  }),
  natalAspectRule("Mercury", "Mars", "square", {
    scope: RELATIONAL_COMMUNICATION_SCOPE,
    themes: ["friction entre formulation et impulsion d'affirmation"],
    resourceThemes: ["énergie pour confronter les idées et clarifier un désaccord"],
    attentionThemes: ["sous tension, le rythme ou le ton de l'échange peut se durcir"],
    forbidden: ["personne agressive", "disputes certaines", "mots qui dépassent forcément la pensée", "toujours sur la défensive"]
  }),
  natalAspectRule("Mercury", "Mars", "opposition", {
    scope: RELATIONAL_COMMUNICATION_SCOPE,
    themes: ["polarité entre raisonnement et affirmation de positions"],
    resourceThemes: ["la contradiction peut aider à préciser ce qui est réellement défendu"],
    attentionThemes: ["l'échange peut parfois devenir un face-à-face de positions"]
  }),
  natalAspectRule("Mercury", "Venus", "conjunction", {
    scope: RELATIONAL_COMMUNICATION_SCOPE,
    themes: ["parole et recherche d'harmonie relationnelle sont fortement associées"],
    resourceThemes: ["attention portée au ton, tact, capacité à rendre un message plus recevable"],
    attentionThemes: ["tendance à adoucir un désaccord ou à privilégier une formulation agréable"],
    forbidden: ["besoin viscéral de validation", "langage de l'amour obligatoire", "charme irrésistible", "séduction certaine par la parole"]
  }),
  natalAspectRule("Mercury", "Venus", "sextile", {
    scope: RELATIONAL_COMMUNICATION_SCOPE,
    themes: ["facilité disponible pour ajuster la manière de dire au contexte relationnel"],
    resourceThemes: ["diplomatie, négociation, recherche d'une formulation acceptable pour l'autre"],
    attentionThemes: []
  }),
  natalAspectRule("Sun", "Mercury", "conjunction", {
    scope: RELATIONAL_COMMUNICATION_SCOPE,
    themes: ["pensée, parole et position personnelle sont étroitement associées"],
    resourceThemes: ["cohérence entre ce qui est pensé et ce qui est exprimé"],
    attentionThemes: ["dans un désaccord, une critique d'une idée peut parfois être reçue plus personnellement"],
    editorialWeight: "secondary"
  })
].map((rule) => ({
  ...rule,
  provenance: "LASTRO_RULE",
  subtype: "RELATIONAL_INTERPRETATION",
  version: INTERPRETATION_LIBRARY_VERSION
}));

const BASE_INTERPRETATION_RULES = [
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
];

export const INTERPRETATION_RULES = Object.freeze(
  [
    ...BASE_INTERPRETATION_RULES,
    ...GENERATED_NATAL_SIGN_RULES,
    ...GENERATED_PERSONAL_TRANSIT_RULES,
    ...NATAL_ASPECT_CONVENTION_RULES,
    ...RELATIONAL_COMMUNICATION_NATAL_ASPECT_RULES,
    ...RELATIONAL_AFFECTION_RULES
  ].filter(
    (rule, index, rules) => rules.findIndex((candidate) => candidate.ruleId === rule.ruleId) === index
  )
);

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

function ruleInScope(rule, scope) {
  const scopes = Array.isArray(rule?.scope) ? rule.scope : [];
  if (scopes.length === 0) return true;
  return Boolean(scope) && scopes.includes(scope);
}

export function rulesForEvidence(evidence, { scope = null } = {}) {
  return INTERPRETATION_RULES.filter((rule) => ruleInScope(rule, scope) && ruleMatchesEvidence(rule, evidence));
}

export function allInterpretationRuleIds() {
  return INTERPRETATION_RULES.map((rule) => rule.ruleId);
}
