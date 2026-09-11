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
  grandesLignes: [
    "Dégage cinq à six grandes lignes réellement distinctes du thème : chacune doit dire quelque chose que les autres ne disent pas.",
    "Ne réexplique pas les placements déjà traités dans le coup d'œil : ici, tu expliques pourquoi ils composent une ligne de force.",
    "Tu peux nommer un archétype uniquement lorsqu'il apporte une synthèse utile (plusieurs éléments qui convergent). Jamais de liste d'archétypes, jamais d'archétype décoratif.",
    "Si aucun archétype ne s'impose, n'en parle pas : la section reste une synthèse des lignes de force."
  ],
  relations: [
    "Pars de Vénus, et de la maison VII uniquement si elle est utilisable : sinon, reste sur Vénus et les aspects robustes.",
    "Décris une manière d'entrer en relation (ce que tu recherches, ce qui te rassure, ce qui te met en retrait), jamais une rencontre à venir.",
    "Aucune affirmation sur un couple réel : parle de tendances relationnelles, pas de la personne avec qui l'on vit.",
    "Si la matière manque (peu d'indicateurs exploitables), dis-le simplement et reste court."
  ],
  action: [
    "Pars de Mars : comment tu initiés, tu tiens, tu défends, tu t'arrêtes.",
    "Relie la manière d'agir aux éléments déjà établis plutôt que de la décrire isolément.",
    "Parle de l'énergie et de la colère sans jugement moral et sans conseil directif.",
    "Pas d'affirmation sur un métier, un projet ou une décision à venir."
  ],
  forcesTensions: [
    "Appuie-toi uniquement sur les convergences réellement calculées : plusieurs corps dans un même signe ou un même élément.",
    "Les aspects ne sont pas activés : n'en parle pas, ne les suppose pas, ne les invente pas.",
    "Nomme ce qui soutient (une force qui revient) et ce qui met en tension (deux exigences qui tirent en sens opposés).",
    "Reste descriptif et non prescriptif : pas de conseil, pas d'injonction, pas de pronostic."
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
    id: "grandes-lignes",
    rank: 5,
    title: "Vos grandes lignes",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresSocle: true,
    directives: DIRECTIVES.grandesLignes
  },
  {
    id: "relations",
    rank: 4,
    title: "Vos relations",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresSocle: true,
    directives: DIRECTIVES.relations
  },
  {
    id: "action",
    rank: 5,
    title: "Votre manière d'agir",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresSocle: true,
    directives: DIRECTIVES.action
  },
  {
    id: "forces-tensions",
    rank: 6,
    title: "Vos forces et vos tensions",
    kind: "symbolic",
    badge: BADGES.symbolic,
    writer: "llm",
    requiresSocle: true,
    requiresConvergence: true,
    directives: DIRECTIVES.forcesTensions
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
