// Convention Lastro « lastro-aspects@1.0.0 ».
//
// NATURE : LASTRO_RULE. Ce n'est pas une règle traditionnelle sourcée, et le
// document ne doit jamais le laisser croire. C'est une convention de produit,
// versionnée, écrite noir sur blanc dans l'annexe, et remplaçable par une
// version ultérieure sans toucher au calcul astronomique.
//
// CE QUI EST ACTIVÉ ICI : uniquement la STRUCTURE (quelles relations angulaires
// sont retenues, avec quel orbe). La signification d'un aspect (ce que « carré »
// veut dire pour quelqu'un) reste NON interprétée par le moteur : c'est le
// rédacteur qui en fait une synthèse, avec la provenance LLM_SYNTHESIS. Sans
// cette séparation, activer une convention de structure reviendrait à activer
// une doctrine interprétative, ce qui n'est pas la décision prise.
//
// POURQUOI CES ORBES : valeurs usuelles en astrologie occidentale moderne, avec
// un élargissement pour les luminaires (Soleil et Lune), qui sont les seuls
// corps dont la position compte toujours dans une lecture. Elles sont retenues
// comme convention de produit, pas comme vérité démontrée.
//
// NON RETENU EN 1.0.0 : aspects mineurs (semi-sextile, quincunx, quintile),
// parallèles de déclinaison, orbes dépendant de la maison ou de l'aspect
// appliquant/séparant. Les ajouter exigera une version 1.1.0 documentée.

export const LASTRO_ASPECTS_RULE_VERSION = Object.freeze({
  id: "lastro-aspects",
  version: "1.0.0",
  versionId: "lastro-aspects@1.0.0",
  nature: "LASTRO_RULE",
  documentaryStatus: "LASTRO_CONVENTION_NOT_TRADITIONAL_SOURCE",
  purpose: "retenir les relations angulaires entre corps, avec un orbe écrit et vérifiable",
  notRetained: "aspects mineurs, parallèles de déclinaison, orbes conditionnels",
  disclaimer:
    "Convention interne Lastro, versionnée : elle fixe des orbes, elle n'interprète pas les aspects."
});

// Orbe en degrés, par aspect, et élargissement quand un luminaire est impliqué.
export const ASPECT_ORB_TABLE = Object.freeze({
  conjunction: Object.freeze({ exactAngle: 0, orbDegrees: 8, orbDegreesWithLuminary: 10, aspectClass: "major" }),
  opposition: Object.freeze({ exactAngle: 180, orbDegrees: 8, orbDegreesWithLuminary: 10, aspectClass: "major" }),
  trine: Object.freeze({ exactAngle: 120, orbDegrees: 7, orbDegreesWithLuminary: 8, aspectClass: "major" }),
  square: Object.freeze({ exactAngle: 90, orbDegrees: 6, orbDegreesWithLuminary: 8, aspectClass: "major" }),
  sextile: Object.freeze({ exactAngle: 60, orbDegrees: 4, orbDegreesWithLuminary: 6, aspectClass: "major" })
});

// Ordre d'affichage et de comparaison : du plus large au plus étroit.
export const ASPECT_TYPES_BY_ORB = Object.freeze(["conjunction", "opposition", "trine", "square", "sextile"]);

const LUMINARIES = Object.freeze(["Sun", "Moon"]);

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Distance angulaire la plus courte entre deux longitudes (0° à 180°).
export function angularSeparation(longitudeA, longitudeB) {
  const distance = Math.abs((((longitudeA - longitudeB) % 360) + 540) % 360 - 180);
  return round(distance, 6);
}

export function orbForAspect(aspectType, bodyA, bodyB) {
  const entry = ASPECT_ORB_TABLE[aspectType];
  if (!entry) {
    return null;
  }
  const withLuminary = LUMINARIES.includes(bodyA) || LUMINARIES.includes(bodyB);
  return {
    orbDegrees: withLuminary ? entry.orbDegreesWithLuminary : entry.orbDegrees,
    withLuminary,
    exactAngle: entry.exactAngle,
    aspectClass: entry.aspectClass
  };
}

function bestCandidateFor(distance, bodyA, bodyB) {
  let best = null;
  for (const type of ASPECT_TYPES_BY_ORB) {
    const orb = orbForAspect(type, bodyA, bodyB);
    const gap = round(Math.abs(distance - orb.exactAngle), 6);
    if (!best || gap < best.gap) {
      best = { type, gap, ...orb, distance };
    }
  }
  return best;
}

// Un aspect qui entre dans l'orbe à l'instant de référence mais en sort sur la
// marge n'est pas un aspect retenu : la marge est une donnée, pas une excuse.
function marginStability(bodyA, bodyB, candidate) {
  const startA = bodyA?.marginWindow?.longitudeAtWindowStart;
  const startB = bodyB?.marginWindow?.longitudeAtWindowStart;
  const endA = bodyA?.marginWindow?.longitudeAtWindowEnd;
  const endB = bodyB?.marginWindow?.longitudeAtWindowEnd;
  if (![startA, startB, endA, endB].every((value) => Number.isFinite(value))) {
    return null;
  }
  const gapAtStart = round(Math.abs(angularSeparation(startA, startB) - candidate.exactAngle), 6);
  const gapAtEnd = round(Math.abs(angularSeparation(endA, endB) - candidate.exactAngle), 6);
  return {
    marginMinutes: bodyA?.marginWindow?.marginMinutes ?? bodyB?.marginWindow?.marginMinutes ?? null,
    angularDistanceAtWindowStart: angularSeparation(startA, startB),
    angularDistanceAtWindowEnd: angularSeparation(endA, endB),
    gapAtWindowStart: gapAtStart,
    gapAtWindowEnd: gapAtEnd,
    withinOrbAtWindowStart: gapAtStart <= candidate.orbDegrees,
    withinOrbAtWindowEnd: gapAtEnd <= candidate.orbDegrees,
    stable: gapAtStart <= candidate.orbDegrees && gapAtEnd <= candidate.orbDegrees
  };
}

// Évalue les 21 couples de corps et rend, pour chacun, la décision complète :
// aspect retenu ou non, orbe appliqué, écart, et stabilité sur la marge.
export function evaluateLastroAspects(positions = [], options = {}) {
  const bodies = Array.isArray(positions) ? positions : [];
  const items = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const first = bodies[i];
      const second = bodies[j];
      const distance = angularSeparation(first.longitude, second.longitude);
      const candidate = bestCandidateFor(distance, first.body, second.body);
      const stability = marginStability(first, second, candidate);
      const retained = candidate.gap <= candidate.orbDegrees && (stability?.stable ?? true);
      items.push({
        id: `aspect.${first.body}.${second.body}`,
        bodyA: first.body,
        bodyB: second.body,
        type: retained ? candidate.type : null,
        candidateType: candidate.type,
        exactAngle: candidate.exactAngle,
        aspectClass: candidate.aspectClass,
        angularDistance: distance,
        exactness: candidate.gap,
        orbUsed: candidate.orbDegrees,
        orbWithLuminary: candidate.withLuminary,
        withinOrb: candidate.gap <= candidate.orbDegrees,
        marginStability: stability,
        retained,
        // Un aspect hors orbe à cause de la marge ne sera jamais transmissible.
        discardedReason: retained
          ? null
          : candidate.gap > candidate.orbDegrees
            ? "outside_orb"
            : "not_stable_within_declared_margin",
        provenance: "LASTRO_RULE",
        ruleVersionId: LASTRO_ASPECTS_RULE_VERSION.versionId
      });
    }
  }
  items.sort((a, b) => {
    if (a.retained !== b.retained) {
      return a.retained ? -1 : 1;
    }
    return a.exactness - b.exactness;
  });
  return {
    schema: "astrolab.western_natal.aspects",
    ruleVersionId: LASTRO_ASPECTS_RULE_VERSION.versionId,
    nature: LASTRO_ASPECTS_RULE_VERSION.nature,
    documentaryStatus: LASTRO_ASPECTS_RULE_VERSION.documentaryStatus,
    disclaimer: LASTRO_ASPECTS_RULE_VERSION.disclaimer,
    notRetained: LASTRO_ASPECTS_RULE_VERSION.notRetained,
    orbTable: ASPECT_TYPES_BY_ORB.map((type) => ({
      type,
      exactAngle: ASPECT_ORB_TABLE[type].exactAngle,
      orbDegrees: ASPECT_ORB_TABLE[type].orbDegrees,
      orbDegreesWithLuminary: ASPECT_ORB_TABLE[type].orbDegreesWithLuminary
    })),
    summary: {
      examinedPairs: items.length,
      retained: items.filter((item) => item.retained).length,
      discardedOutsideOrb: items.filter((item) => item.discardedReason === "outside_orb").length,
      discardedNotStableWithinMargin: items.filter((item) => item.discardedReason === "not_stable_within_declared_margin").length
    },
    items
  };
}

export function retainedAspects(aspects) {
  return (aspects?.items ?? []).filter((item) => item.retained);
}
