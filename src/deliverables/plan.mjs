// Dossier plan: the client deliverable structure (11 sections), aligned with the
// "master prompt" product spec. Each section declares what kind of content it is,
// which calculated facts may feed it, and the writing directives it must follow.
//
// Layer discipline: "calculated" sections are machine-rendered from verified facts.
// "symbolic"/"letter" sections are writer output (LLM when configured, template
// otherwise) and always carry a provenance badge. Nothing here creates facts.

export const FRAME_DIRECTIVES = Object.freeze([
  "Tu produis une cartographie intérieure narrative, non une prédiction.",
  "Jamais de dates ni d'événements concrets annoncés (rencontre, rupture, travail, etc.).",
  "Jamais de diagnostic médical, psychologique ou juridique.",
  "Aucune affirmation définitive sur la personne (« tu es comme ça ») ; préfère « voici ce que tu as porté / ce que tu peux poser ».",
  "Langage de postures, cycles et climats intérieurs ; ton non anxiogène, non déterministe, non culpabilisant.",
  "Libre arbitre toujours respecté.",
  "Aucun fait astronomique inventé : utilise uniquement les faits calculés fournis.",
  "Si un fait calculé manque (heure inconnue, Ascendant non calculé), travaille en tendances symboliques explicites, sans affirmation technique.",
  "Explique brièvement chaque terme astrologique la première fois que tu l'utilises ; évite tout jargon non expliqué.",
  // Anti-répétition (chantier 2) : un placement expliqué une fois, puis on avance.
  "Chaque placement (planète, signe, aspect, maison) est expliqué UNE SEULE FOIS, dans la section où il sert le mieux. Les sections suivantes ne le réexpliquent pas : elles apportent un angle nouveau (le passé, la relation, l'action, l'intégration).",
  "Les passages déjà rédigés te sont fournis dans « alreadyWritten » : appuie-toi dessus sans les redévelopper, et ne réutilise pas les mêmes formulations.",
  // Ouverture éditoriale (chantier 3) : une première page qui donne envie.
  "Dans la section d'introduction uniquement, ouvre par un court paragraphe « Votre ciel en un coup d'œil » : trois à cinq traits marquants, distincts et concrets, sans jargon.",
  // Transgénérationnel (chantier 3) : jamais d'histoire familiale inventée.
  "Pour tout passage transgénérationnel : parle uniquement de correspondances symboliques entre des thèmes, jamais d'un héritage, d'un rôle, d'un secret ou d'un événement familial que les données fournies ne contiennent pas. Si aucune donnée familiale n'est fournie, ce passage n'existe pas."
]);

const BADGES = Object.freeze({
  calculated: { code: "calculated", label: "Données vérifiées (calcul)", level: "certain" },
  symbolic: { code: "symbolic", label: "Lecture symbolique", level: "symbolic" },
  letter: { code: "symbolic", label: "Lettre symbolique", level: "symbolic" },
  unavailable: { code: "unavailable", label: "Module non disponible dans cette version", level: "absent" }
});

const DIRECTIVES = {
  position: [
    "Présente la position de naissance comme un socle vérifié.",
    "Explique l'axe de vie comme une tension et un apprentissage, jamais comme une fatalité.",
    "Ne répète pas mécaniquement les chiffres : relie-les à des dynamiques humaines."
  ],
  psycho: [
    "Décris des fonctionnements intérieurs (manière de ressentir, de se protéger, de tenir).",
    "Présente les tensions comme des dynamiques, jamais comme des traits figés.",
    "Respecte strictement les faits calculés fournis (Soleil, Lune, Ascendant, maisons, aspects géométriques)."
  ],
  transgenerational: [
    "Parle d'héritages conscients et inconscients, de loyautés invisibles, de rôles transmis.",
    "Ne prétends jamais connaître des événements familiaux réels : travaille en climat symbolique.",
    "Si les données parents ne sont pas fournies, dis-le clairement et reste général."
  ],
  archetypes: [
    "Nomme des archétypes actifs (gardien, enfant, bâtisseur, guérisseur...) et leur fonction protectrice.",
    "Montre les déséquilibres possibles et un axe d'intégration.",
    "Relie chaque archétype aux faits calculés quand c'est naturel, sans le forcer."
  ],
  past: [
    "Évoque la construction intérieure, les responsabilités précoces possibles, les renoncements silencieux.",
    "Utilise un langage projectif et respectueux (« il est possible que… », « cela a pu créer… »).",
    "N'invente aucun événement biographique."
  ],
  letterSoul: [
    "Écris une lettre à la deuxième personne, douce, posée, intime.",
    "Reconnais ce qui a été porté, invite à une posture plus juste.",
    "Aucune accusation, aucune certitude psychologique."
  ],
  letterMirror: [
    "Écris une lettre symbolique en miroir (au monde / aux figures parentales / aux liens).",
    "Mets en lumière ce qui a été attendu ; libère sans accuser.",
    "Ton respectueux et ouvert."
  ],
  integration: [
    "Propose ce qui peut être déposé, transformé, laissé à l'autre ou à la vie.",
    "Conseils concrets mais jamais prescriptifs."
  ],
  conclusion: [
    "Rappelle le libre arbitre et la nature non prédictive de la lecture.",
    "Phrase de fermeture douce et ouverte."
  ]
};

export const DOSSIER_SECTIONS = Object.freeze([
  {
    id: "introduction",
    rank: 1,
    title: "Introduction — cadre de la lecture",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    directives: [
      ...DIRECTIVES.position,
      "Présente le cadre : cartographie intérieure, non prédictive, respectueuse.",
      "Accueille la personne, sécurise, clarifie ce que la lecture est et n'est pas."
    ]
  },
  {
    id: "position-naissance-axe",
    rank: 2,
    title: "Position de naissance & axe de vie",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresSocle: true,
    directives: [
      ...DIRECTIVES.position,
      "Les faits (Soleil, Lune, Ascendant, maisons, axe) sont calculés et vérifiés : ne les contredis jamais.",
      "Quand un fait est absent (ex. heure inconnue), reste en tendances symboliques."
    ]
  },
  {
    id: "structure-psychologique",
    rank: 3,
    title: "Structure psychologique & émotionnelle",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresSocle: true,
    directives: DIRECTIVES.psycho
  },
  {
    id: "transgenerationnel",
    rank: 4,
    title: "Lecture transgénérationnelle",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresParents: true,
    directives: DIRECTIVES.transgenerational
  },
  {
    id: "archetypes-dominants",
    rank: 5,
    title: "Archétypes dominants",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresSocle: true,
    directives: DIRECTIVES.archetypes
  },
  {
    id: "lecture-passe",
    rank: 6,
    title: "Lecture approfondie du passé",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresSocle: true,
    directives: DIRECTIVES.past
  },
  {
    id: "lettre-ame",
    rank: 7,
    title: "Lettre d'âme",
    kind: "letter",
    badge: BADGES.letter,
    writer: "llm",
    requiresSocle: true,
    directives: DIRECTIVES.letterSoul
  },
  {
    id: "lettre-miroir",
    rank: 8,
    title: "Lettre miroir",
    kind: "letter",
    badge: BADGES.letter,
    writer: "llm",
    requiresSocle: true,
    directives: DIRECTIVES.letterMirror
  },
  {
    id: "periodes-cycles",
    rank: 9,
    title: "Périodes & Cycles",
    kind: "unavailable",
    badge: BADGES.unavailable,
    writer: "none",
    note: "Module de trajectoire (fenêtres larges, postures intérieures) en construction : il nécessite le module calculé des transits/progressions, non encore promu hors recherche."
  },
  {
    id: "cles-integration",
    rank: 10,
    title: "Clés d'intégration",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresSocle: true,
    directives: DIRECTIVES.integration
  },
]);

export function dossierSectionById(id) {
  return DOSSIER_SECTIONS.find((section) => section.id === id) ?? null;
}

export function dossierSectionTitles() {
  return DOSSIER_SECTIONS.map((section) => ({ id: section.id, rank: section.rank, title: section.title }));
}
