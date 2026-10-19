// Hypothèses de lecture : plusieurs façons de lire UNE MÊME figure calculée.
//
// Pourquoi ce module : le moteur produisait une seule articulation par figure
// (« Jupiter relie les deux extrémités de l'opposition »). Un rédacteur n'a
// alors rien à explorer : il explique. Or une lecture profonde ne consiste pas à
// ajouter des liens astrologiques, mais à reconnaître que le MÊME lien calculé
// supporte plusieurs lectures, et à dire ce qui les distingue.
//
// Deux règles non négociables :
//
//   1. Une hypothèse n'est jamais une liaison nouvelle. Elle ne concerne que les
//      configurations de LA figure : elle n'autorise aucune compensation vers
//      une configuration non reliée (Mars–Saturne n'est pas « compensé par
//      Jupiter » si aucune figure ne les relie).
//   2. Une hypothèse n'est produite que si la géométrie fournit un DISCRIMINANT
//      mesuré — mode de l'apex (harmonique / dur) et asymétrie des orbes. Sans
//      discriminant, le moteur ne fabrique pas une seconde lecture : il n'en a
//      qu'une, et il le dit.
//
// Chaque hypothèse est donc : une lecture formulée, sa licence calculée, son
// discriminant, ses limites. Le rédacteur reçoit de quoi exposer un désaccord
// entre lectures, pas une conclusion.

export const READING_HYPOTHESES_VERSION = "lastro-reading-hypotheses@1.0.0";

// Seuil documenté : en dessous de 2° d'écart entre les deux liens de l'apex, les
// deux pôles sont également soutenus et l'hypothèse d'asymétrie n'est pas
// licenciée.
export const ASYMMETRY_THRESHOLD_DEGREES = 2;

export const HYPOTHESIS_CONVENTIONS = Object.freeze({
  dialogue: {
    ruleId: "lastro.hypothesis.apex_dialogue@1",
    kind: "READING_HYPOTHESIS",
    description:
      "L'apex d'une opposition, quand il est en relation harmonique avec les deux pôles, peut être lu comme un passage : ce qu'il symbolise est disponible des deux côtés. Lecture proposée, jamais démontrée."
  },
  amplification: {
    ruleId: "lastro.hypothesis.apex_amplification@1",
    kind: "READING_HYPOTHESIS",
    description:
      "La même figure peut être lue autrement : l'apex n'est pas sur l'axe de l'opposition, il n'arbitre donc pas. Il donne de l'ampleur aux deux exigences sans les réconcilier, et l'asymétrie des orbes indique de quel côté l'appui penche. Lecture proposée, jamais démontrée."
  },
  pressure: {
    ruleId: "lastro.hypothesis.apex_pressure@1",
    kind: "READING_HYPOTHESIS",
    description:
      "Quand l'apex est en tension avec les deux pôles (T-carré), la figure peut être lue comme une pression qui oblige à trancher. Lecture proposée, jamais démontrée."
  },
  rigidification: {
    ruleId: "lastro.hypothesis.apex_rigidification@1",
    kind: "READING_HYPOTHESIS",
    description:
      "La même pression peut aussi être lue comme un durcissement : le pôle le plus proche de l'apex se raidit au lieu de s'ajuster. Lecture proposée, jamais démontrée."
  },
  circulation: {
    ruleId: "lastro.hypothesis.trine_circulation@1",
    kind: "READING_HYPOTHESIS",
    description:
      "Un grand trigone se lit comme une circulation facile entre trois fonctions. Aucune tension n'y figure : la figure ne dit rien des conflits. Lecture proposée, jamais démontrée."
  }
});

const CORPS = {
  Sun: "le Soleil",
  Moon: "la Lune",
  Mercury: "Mercure",
  Venus: "Vénus",
  Mars: "Mars",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  ASC: "l'Ascendant",
  DSC: "le Descendant",
  MC: "le Milieu du Ciel",
  IC: "le Fond du Ciel"
};

const ASPECTS = {
  conjunction: "conjonction",
  opposition: "opposition",
  square: "carré",
  trine: "trigone",
  sextile: "sextile"
};

const corps = (body) => CORPS[body] ?? String(body ?? "");
const aspect = (type) => ASPECTS[String(type ?? "").toLowerCase()] ?? String(type ?? "");

function lien(membre) {
  return `${corps(membre.bodyA)} ${aspect(membre.aspectType)} ${corps(membre.bodyB)}`;
}

// Concepts d'une configuration (règle sémantique), avec repli sur les thèmes.
function conceptsDe(configuration) {
  if (configuration?.concepts?.length) return configuration.concepts;
  return [];
}

function trouverConfiguration(configurations, aspectId) {
  return configurations.find((configuration) => configuration.evidenceRef === aspectId) ?? null;
}

function hypothesesApex(figure, configurations) {
  const opposition = figure.members.find((membre) => membre.aspectType === "opposition");
  if (!opposition) return [];
  const poleA = opposition.bodyA;
  const poleB = opposition.bodyB;
  const apex = figure.bodies.apex;
  const versA = figure.members.find(
    (membre) => membre !== opposition && [membre.bodyA, membre.bodyB].includes(poleA)
  );
  const versB = figure.members.find(
    (membre) => membre !== opposition && [membre.bodyA, membre.bodyB].includes(poleB)
  );
  if (!versA || !versB) return [];

  const configOpposition = trouverConfiguration(configurations, opposition.aspectId) ?? {};
  const conceptsOpposition = conceptsDe(configOpposition);
  const [premierConcept, secondConcept] = conceptsOpposition;

  const orbeA = versA.orb ?? null;
  const orbeB = versB.orb ?? null;
  const cotes = [
    { pole: poleA, membre: versA, orbe: orbeA },
    { pole: poleB, membre: versB, orbe: orbeB }
  ];
  const trie = [...cotes].filter((cote) => typeof cote.orbe === "number").sort((g, d) => g.orbe - d.orbe);
  const proche = trie[0] ?? null;
  const loin = trie[trie.length - 1] ?? null;
  const ecart = proche && loin ? Math.round((loin.orbe - proche.orbe) * 100) / 100 : null;
  const asymetrie = ecart !== null && ecart >= ASYMMETRY_THRESHOLD_DEGREES;

  const licence = {
    figureId: figure.figureId,
    conventionId: figure.conventionId,
    proof: figure.proof,
    computedFacts: [
      `${corps(apex)} est ${aspect(versA.aspectType)} avec ${corps(poleA)} (orbe ${orbeA}°)`,
      `${corps(apex)} est ${aspect(versB.aspectType)} avec ${corps(poleB)} (orbe ${orbeB}°)`,
      `${corps(poleA)} oppose ${corps(poleB)} (orbe ${opposition.orb}°)`
    ]
  };

  const limitesCommunes = [
    `ne dit rien des configurations hors de cette figure : ${figure.bodies.apex ? "aucune compensation ne peut être étendue à un aspect non relié" : ""}`.trim(),
    "hypothèse de lecture symbolique, pas une démonstration",
    "n'autorise aucune liaison nouvelle entre configurations"
  ];

  const hypotheses = [];
  if (figure.mode === "harmonic") {
    hypotheses.push({
      hypothesisId: `hyp.${figure.figureId}.dialogue@1`,
      figureId: figure.figureId,
      kind: "dialogue",
      conventionId: HYPOTHESIS_CONVENTIONS.dialogue.ruleId,
      title: "Une médiation possible",
      statement:
        `${corps(apex)} touche les deux extrémités de l'opposition : ce qu'il symbolise peut être lu comme un passage entre ` +
        `${corps(poleA)} et ${corps(poleB)}, sans que l'un des deux pôles ait à céder.`,
      licence,
      discriminator: "les deux liens de l'apex sont des soutiens (trigone/sextile)",
      questions: premierConcept && secondConcept
        ? [`Lorsque ${premierConcept} et ${secondConcept} ne vont pas dans le même sens, lequel guide vos décisions ?`]
        : [],
      limits: [...limitesCommunes]
    });
    if (asymetrie) {
      hypotheses.push({
        hypothesisId: `hyp.${figure.figureId}.amplification@1`,
        figureId: figure.figureId,
        kind: "amplification",
        conventionId: HYPOTHESIS_CONVENTIONS.amplification.ruleId,
        title: "Une ouverture qui ne réconcilie pas",
        statement:
          `${corps(apex)} n'est pas sur l'axe de l'opposition : il n'arbitre donc pas. On peut le lire autrement — ` +
          `il donne de l'ampleur aux deux exigences sans résoudre leur désaccord, et l'appui penche du côté de ${corps(proche.pole)} ` +
          `(orbe ${proche.orbe}° contre ${loin.orbe}°).`,
        licence: {
          ...licence,
          computedFacts: [
            ...licence.computedFacts,
            `asymétrie mesurée : ${proche.orbe}° (${corps(proche.pole)}) contre ${loin.orbe}° (${corps(loin.pole)}), soit ${ecart}° d'écart`
          ]
        },
        discriminator: `l'écart d'orbe (${ecart}°) désigne le côté le mieux soutenu`,
        questions: [
          `Ce qui vous rassure est-il aussi ce qui vous met en mouvement ?`,
          `Quand l'écart se creuse, est-ce du côté de ${corps(proche.pole)} que vous cherchez vos ressources ?`
        ],
        limits: [...limitesCommunes]
      });
    }
  } else {
    // Mode dur (T-carré) : deux lectures de la même pression.
    hypotheses.push({
      hypothesisId: `hyp.${figure.figureId}.pressure@1`,
      figureId: figure.figureId,
      kind: "pressure",
      conventionId: HYPOTHESIS_CONVENTIONS.pressure.ruleId,
      title: "Une pression qui oblige à trancher",
      statement:
        `${corps(apex)} est en tension avec les deux extrémités de l'opposition : la figure peut être lue comme une pression ` +
        `qui ne laisse pas le choix de rester dans l'écart.`,
      licence,
      discriminator: "les deux liens de l'apex sont des tensions (carré)",
      questions: premierConcept && secondConcept
        ? [`Quand ${premierConcept} et ${secondConcept} s'opposent, lequel cède en premier ?`]
        : [],
      limits: [...limitesCommunes]
    });
    hypotheses.push({
      hypothesisId: `hyp.${figure.figureId}.rigidification@1`,
      figureId: figure.figureId,
      kind: "rigidification",
      conventionId: HYPOTHESIS_CONVENTIONS.rigidification.ruleId,
      title: "Un durcissement possible",
      statement:
        `La même pression peut se lire à l'envers : au lieu d'obliger à trancher, elle raidit le pôle le plus proche de ${corps(apex)}` +
        `${proche ? ` — ${corps(proche.pole)} (orbe ${proche.orbe}°)` : ""}.`,
      licence,
      discriminator: proche ? `le pôle le plus proche de l'apex est ${corps(proche.pole)}` : "aucune mesure d'asymétrie",
      questions: [`Ce que vous défendez le plus fermement est-il ce qui vous coûte le plus ?`],
      limits: [...limitesCommunes]
    });
  }

  return hypotheses;
}

function hypothesesTrine(figure) {
  return [
    {
      hypothesisId: `hyp.${figure.figureId}.circulation@1`,
      figureId: figure.figureId,
      kind: "circulation",
      conventionId: HYPOTHESIS_CONVENTIONS.circulation.ruleId,
      title: "Une circulation facile",
      statement: `${figure.proof} : trois fonctions se répondent sans tension calculée entre elles.`,
      licence: {
        figureId: figure.figureId,
        conventionId: figure.conventionId,
        proof: figure.proof,
        computedFacts: figure.members.map((membre) => lien(membre))
      },
      discriminator: "aucune tension dans la figure",
      questions: [],
      limits: [
        "la figure ne comporte aucune tension : elle ne dit rien des conflits du thème",
        "hypothèse de lecture symbolique, pas une démonstration"
      ]
    }
  ];
}

export function buildReadingHypotheses({ figures = [], configurations = [] } = {}) {
  const hypotheses = [];
  for (const figure of figures) {
    if (figure.type === "apex_on_opposition") hypotheses.push(...hypothesesApex(figure, configurations));
    else if (figure.type === "grand_trine") hypotheses.push(...hypothesesTrine(figure));
  }
  return {
    version: READING_HYPOTHESES_VERSION,
    hypotheses,
    // Une figure sans discriminant ne produit qu'une lecture : le moteur ne
    // fabrique pas un désaccord qui n'existe pas.
    singleReadingFigures: figures
      .filter((figure) => hypotheses.filter((hypothese) => hypothese.figureId === figure.figureId).length <= 1)
      .map((figure) => figure.figureId)
  };
}

// La longueur suit la matière : une hypothèse = un développement, pas un quota.
//
// Calibrage du 21/10/2026, après deux interruptions mesurées :
//   - 200 mots visés / 320 plafonnés → coupé à 840 tokens ;
//   - 300 / 480 → coupé à 1 160 tokens (314 mots écrits, sans la conclusion).
// Deux causes : le modèle écrit ~1,4 × le repère annoncé, et l'échappement JSON
// (`\n`, `\"`) ajoute ~15 % de tokens au texte.
//
// Le repère reste une indication éditoriale ; le PLAFOND devient un vrai
// plafond de sécurité (700 mots pour deux hypothèses → 1 600 tokens de sortie),
// pour qu'une réponse ne puisse plus être coupée en pleine lecture.
export function lengthForHypotheses(count) {
  const hypotheses = Math.max(0, Number(count) || 0);
  if (hypotheses === 0) return { targetWords: 0, maxWords: 0 };
  return {
    targetWords: 100 + 110 * hypotheses,
    maxWords: 300 + 200 * hypotheses
  };
}
