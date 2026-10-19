// Figures géométriques calculées — le socle du croisement entre configurations.
//
// Pourquoi ce module : une « relation » entre deux aspects peut être une pure
// facilité littéraire. Ici, une figure n'existe que si la géométrie calculée la
// fournit : une opposition, et un troisième corps qui forme un aspect à chacune
// de ses deux extrémités. Rien n'est interpolé, rien n'est supposé.
//
// La géométrie PROUVE la structure. Elle ne dit pas ce qu'elle signifie : c'est
// le rôle des conventions de composition (`editorialComposition.mjs`), qui
// restent explicitement étiquetées comme conventions Lastro.
//
// Convention de vocabulaire :
//   - `apex_on_opposition` : A oppose B, C aspecte A et C aspecte B.
//       mode `harmonic`  : les deux aspects de C sont des soutiens (trigone/sextile)
//       mode `hard`      : les deux sont des tensions (carré) — c'est le T-carré
//       mode `mixed`     : un soutien d'un côté, une tension de l'autre
//   - `grand_trine` : trois corps en trigone deux à deux.

export const FIGURES_VERSION = "lastro-figures@1.0.1";

// Vocabulaire français : la figure est lue par un rédacteur et, plus tard, par
// le client. « Sun oppose Moon » n'a rien à faire dans un dossier français.
export const CORPS_FR = Object.freeze({
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
});

export const ASPECT_FR = Object.freeze({
  conjunction: "conjonction",
  opposition: "opposition",
  square: "carré",
  trine: "trigone",
  sextile: "sextile"
});

// Nom sans article, pour les énumérations (« Membres : Soleil–Lune opposition »).
export const CORPS_NOM_FR = Object.freeze({
  Sun: "Soleil",
  Moon: "Lune",
  Mercury: "Mercure",
  Venus: "Vénus",
  Mars: "Mars",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  ASC: "Ascendant",
  DSC: "Descendant",
  MC: "Milieu du Ciel",
  IC: "Fond du Ciel"
});

export function corpsFr(body) {
  return CORPS_FR[body] ?? String(body ?? "");
}

export function corpsNomFr(body) {
  return CORPS_NOM_FR[body] ?? String(body ?? "");
}

export function aspectFr(aspectType) {
  return ASPECT_FR[String(aspectType ?? "").toLowerCase()] ?? String(aspectType ?? "");
}

// « le Soleil oppose la Lune », « Jupiter est en trigone au Soleil »
function phraseAspect(bodyA, bodyB, aspectType) {
  const a = corpsFr(bodyA);
  const b = corpsFr(bodyB);
  const type = aspectFr(aspectType);
  if (aspectType === "opposition") return `${a} oppose ${b}`;
  if (aspectType === "conjunction") return `${a} est en conjonction avec ${b}`;
  return `${a} est en ${type} avec ${b}`;
}

export const FIGURE_CONVENTIONS = Object.freeze({
  apexOnOpposition: {
    ruleId: "lastro.figure.apex_on_opposition@1",
    kind: "GEOMETRIC_STRUCTURE",
    description:
      "Trois configurations dont deux relient un même corps (l'apex) aux deux extrémités d'une opposition calculée. La figure autorise à lire les trois aspects ensemble et à ordonner la lecture du plus serré au plus large. Elle n'ajoute aucun sens traditionnel : ce que la figure apporte, c'est la licence de croiser, pas une interprétation."
  },
  grandTrine: {
    ruleId: "lastro.figure.grand_trine@1",
    kind: "GEOMETRIC_STRUCTURE",
    description:
      "Trois corps en trigone deux à deux. Autorise la même licence de croisement, avec l'obligation de traiter les trois aspects comme un seul motif."
  }
});

const TENSION = new Set(["conjunction", "square", "opposition"]);
const SUPPORT = new Set(["trine", "sextile"]);

export function aspectCategory(aspectType) {
  const type = String(aspectType ?? "").toLowerCase();
  if (TENSION.has(type)) return "tension";
  if (SUPPORT.has(type)) return "support";
  return null;
}

export function aspectIdentifier(bodyA, bodyB, aspectType) {
  const slug = (value) => String(value ?? "").toLowerCase();
  return `aspect.${slug(bodyA)}.${slug(bodyB)}.${slug(aspectType)}`;
}

function clePaire(a, b) {
  return [String(a), String(b)].sort().join("|");
}

function aspectsDuTheme(dossierEvidence) {
  const items = [];
  for (const item of dossierEvidence?.evidence ?? []) {
    if (item?.type !== "NATAL_ASPECT") continue;
    const value = item.value ?? {};
    if (!value.bodyA || !value.bodyB || !value.aspectType) continue;
    items.push({
      aspectId: item.evidenceId ?? aspectIdentifier(value.bodyA, value.bodyB, value.aspectType),
      bodyA: value.bodyA,
      bodyB: value.bodyB,
      aspectType: String(value.aspectType).toLowerCase(),
      orb: typeof value.orb === "number" ? value.orb : null,
      orbLimit: typeof value.orbLimit === "number" ? value.orbLimit : null,
      category: aspectCategory(value.aspectType)
    });
  }
  return items;
}

function indexAspects(aspects) {
  const parPaire = new Map();
  for (const aspect of aspects) {
    parPaire.set(clePaire(aspect.bodyA, aspect.bodyB), aspect);
  }
  return parPaire;
}

function corpsDuTheme(aspects) {
  const corps = new Set();
  for (const aspect of aspects) {
    corps.add(aspect.bodyA);
    corps.add(aspect.bodyB);
  }
  return [...corps];
}

function modeApex(typeA, typeB) {
  const catA = aspectCategory(typeA);
  const catB = aspectCategory(typeB);
  if (catA === "support" && catB === "support") return "harmonic";
  if (catA === "tension" && catB === "tension") return "hard";
  return "mixed";
}

function figureApex(opposition, apex, versA, versB) {
  const membres = [opposition, versA, versB];
  const serre = [...membres].sort((gauche, droite) => (gauche.orb ?? 99) - (droite.orb ?? 99))[0];
  return {
    figureId: `figure.apex.${[opposition.bodyA, opposition.bodyB, apex].map((v) => String(v).toLowerCase()).sort().join(".")}`,
    type: "apex_on_opposition",
    conventionId: FIGURE_CONVENTIONS.apexOnOpposition.ruleId,
    bodies: {
      opposition: [opposition.bodyA, opposition.bodyB],
      apex
    },
    mode: modeApex(versA.aspectType, versB.aspectType),
    members: membres.map((aspect) => ({
      aspectId: aspect.aspectId,
      bodyA: aspect.bodyA,
      bodyB: aspect.bodyB,
      aspectType: aspect.aspectType,
      category: aspect.category,
      orb: aspect.orb,
      orbLimit: aspect.orbLimit
    })),
    apexAspects: { toA: versA.aspectType, toB: versB.aspectType },
    tightestMemberId: serre.aspectId,
    // La preuve observable de la figure, en clair : c'est elle que l'annexe cite.
    proof: `${phraseAspect(opposition.bodyA, opposition.bodyB, "opposition")} ; ${corpsFr(apex)} est en ${aspectFr(versA.aspectType)} avec ${corpsFr(opposition.bodyA)} et en ${aspectFr(versB.aspectType)} avec ${corpsFr(opposition.bodyB)}`
  };
}

function figureTrigone(a, b, c) {
  const membres = [a, b, c];
  const serre = [...membres].sort((gauche, droite) => (gauche.orb ?? 99) - (droite.orb ?? 99))[0];
  const corps = [...new Set(membres.flatMap((aspect) => [aspect.bodyA, aspect.bodyB]))].sort();
  return {
    figureId: `figure.trine.${corps.map((v) => String(v).toLowerCase()).join(".")}`,
    type: "grand_trine",
    conventionId: FIGURE_CONVENTIONS.grandTrine.ruleId,
    bodies: { triangle: corps },
    mode: "harmonic",
    members: membres.map((aspect) => ({
      aspectId: aspect.aspectId,
      bodyA: aspect.bodyA,
      bodyB: aspect.bodyB,
      aspectType: aspect.aspectType,
      category: aspect.category,
      orb: aspect.orb,
      orbLimit: aspect.orbLimit
    })),
    tightestMemberId: serre.aspectId,
    proof: `${corps.map((body) => corpsFr(body)).join(", ")} sont en trigone deux à deux`
  };
}

// Détection déterministe. Aucun seuil d'orbe propre : on ne retient que les
// aspects déjà retenus par la convention `lastro-aspects@1.0.0`.
export function detectFigures({ dossierEvidence } = {}) {
  const aspects = aspectsDuTheme(dossierEvidence);
  const parPaire = indexAspects(aspects);
  const figures = [];
  const vus = new Set();

  const oppositions = aspects.filter((aspect) => aspect.aspectType === "opposition");
  const corps = corpsDuTheme(aspects);

  for (const opposition of oppositions) {
    for (const apex of corps) {
      if (apex === opposition.bodyA || apex === opposition.bodyB) continue;
      const versA = parPaire.get(clePaire(apex, opposition.bodyA));
      const versB = parPaire.get(clePaire(apex, opposition.bodyB));
      if (!versA || !versB) continue;
      if (!["trine", "sextile", "square"].includes(versA.aspectType)) continue;
      if (!["trine", "sextile", "square"].includes(versB.aspectType)) continue;
      const figure = figureApex(opposition, apex, versA, versB);
      if (vus.has(figure.figureId)) continue;
      vus.add(figure.figureId);
      figures.push(figure);
    }
  }

  // Grand trigone : trois trigones deux à deux.
  const trigones = aspects.filter((aspect) => aspect.aspectType === "trine");
  for (let i = 0; i < trigones.length; i += 1) {
    for (let j = i + 1; j < trigones.length; j += 1) {
      for (let k = j + 1; k < trigones.length; k += 1) {
        const triplet = [trigones[i], trigones[j], trigones[k]];
        const corpsTriangle = new Set(triplet.flatMap((aspect) => [aspect.bodyA, aspect.bodyB]));
        if (corpsTriangle.size !== 3) continue;
        const figure = figureTrigone(...triplet);
        if (vus.has(figure.figureId)) continue;
        vus.add(figure.figureId);
        figures.push(figure);
      }
    }
  }

  return {
    version: FIGURES_VERSION,
    figures,
    examinedAspects: aspects.length,
    conventions: FIGURE_CONVENTIONS
  };
}

// Deux configurations appartiennent-elles à une même figure calculée ?
export function figureMembership(figures = []) {
  const parFigure = new Map();
  for (const figure of figures) {
    for (const membre of figure.members) {
      const existant = parFigure.get(membre.aspectId) ?? [];
      existant.push(figure.figureId);
      parFigure.set(membre.aspectId, existant);
    }
  }
  return parFigure;
}

// Corps partagés par deux configurations (l'autre licence de croisement).
export function sharedBodies(first, second) {
  const corps = (aspect) => new Set([aspect.bodyA, aspect.bodyB]);
  const a = corps(first);
  const b = corps(second);
  return [...a].filter((body) => b.has(body));
}
