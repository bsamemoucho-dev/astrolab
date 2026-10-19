// Composition éditoriale : quelles configurations a-t-on le DROIT de croiser.
//
// Principe (validé par le commanditaire) : la géométrie autorise, les concepts
// articulent. Aucun croisement n'est produit sans l'une de ces deux licences :
//
//   1. deux configurations partagent un corps calculé (Soleil, Lune, Jupiter…) ;
//   2. elles appartiennent à une même figure géométrique détectée
//      (`apex_on_opposition`, `grand_trine`).
//
// Le reste — et c'est le cas le plus fréquent — reçoit une réponse explicite :
// « aucune relation astrologique directe suffisamment étayée ». C'est un
// résultat, pas un échec : un chapitre ne se remplit pas avec des rapprochements
// littéraires.
//
// Chaque relation est déterministe, traçable, et cite ses preuves. L'`articulation`
// ne formule QUE des faits calculés (corps partagé, preuve de la figure, orbes) :
// l'interprétation reste au rédacteur, guidé par sa mission.

import { aspectCategory, aspectFr, corpsFr, corpsNomFr, detectFigures, figureMembership, sharedBodies } from "./figures.mjs";

export const COMPOSITION_VERSION = "lastro-editorial-composition@1.1.0";

export const COMPOSITION_CONVENTIONS = Object.freeze({
  sharedBody: {
    ruleId: "lastro.composition.shared_body@1",
    kind: "EDITORIAL_CONVENTION",
    description:
      "Deux configurations qui touchent le même corps calculé peuvent être lues ensemble : le corps est le point de passage. La convention autorise le croisement et nomme le corps ; elle n'attribue aucune signification nouvelle à ce corps."
  },
  figureThirdTerm: {
    ruleId: "lastro.composition.figure_third_term@1",
    kind: "EDITORIAL_CONVENTION",
    description:
      "Deux configurations membres d'une même figure calculée peuvent être lues ensemble. Quand la figure est un apex sur opposition, la lecture autorisée est celle d'un troisième terme : le corps apex relie les deux extrémités de l'opposition. L'ordre de lecture suit le serrage des orbes."
  },
  noRelation: {
    ruleId: "lastro.composition.no_relation@1",
    kind: "EDITORIAL_CONVENTION",
    description:
      "Sans corps partagé ni figure commune, deux configurations ne peuvent pas être croisées. Le moteur le dit explicitement au lieu de fabriquer une convergence."
  }
});

// Assemblage des configurations : un aspect + la règle qui le couvre.
export function buildConfigurations({ dossierEvidence, rulesForEvidence }) {
  const configurations = [];
  for (const item of dossierEvidence?.evidence ?? []) {
    if (item?.type !== "NATAL_ASPECT") continue;
    const value = item.value ?? {};
    const regles = (rulesForEvidence?.(item) ?? []).filter((rule) => !Array.isArray(rule.scope));
    if (regles.length === 0) continue;
    const regle = regles[0];
    const semantics = regle.semantics ?? null;
    configurations.push({
      configId: `config:${item.evidenceId}`,
      evidenceRef: item.evidenceId,
      ruleRef: regle.ruleId,
      bodyA: value.bodyA,
      bodyB: value.bodyB,
      aspectType: String(value.aspectType ?? "").toLowerCase(),
      category: aspectCategory(value.aspectType, value),
      orb: typeof value.orb === "number" ? value.orb : null,
      orbLimit: typeof value.orbLimit === "number" ? value.orbLimit : null,
      concepts: semantics?.concepts ?? [],
      motif: semantics?.motif ?? null,
      relationFormula: semantics?.relation ?? null,
      nuances: semantics?.nuances ?? [],
      // Compatibilité : les règles anciennes n'ont que des `themes` (phrases).
      themes: regle.themes ?? [],
      structured: Boolean(semantics)
    });
  }
  return configurations;
}

function articulationCorpsPartage(premiere, seconde, corps) {
  const parties = [`Les deux configurations touchent ${corpsFr(corps[0] ?? corps)}.`];
  if (premiere.motif && seconde.motif) {
    parties.push(`L'une parle de ${premiere.motif}, l'autre de ${seconde.motif}.`);
  }
  return parties.join(" ");
}

function articulationFigure(figure) {
  const membres = figure.members
    .map((membre) => `${corpsNomFr(membre.bodyA)}–${corpsNomFr(membre.bodyB)} ${aspectFr(membre.aspectType)} (orbe ${membre.orb}°)`)
    .join(", ");
  const serre = figure.members.find((membre) => membre.aspectId === figure.tightestMemberId);
  return [
    `Les trois configurations forment une figure calculée : ${figure.proof}.`,
    `Membres : ${membres}.`,
    serre ? `Le lien le plus serré est ${corpsNomFr(serre.bodyA)}–${corpsNomFr(serre.bodyB)} (orbe ${serre.orb}°).` : null
  ]
    .filter(Boolean)
    .join(" ");
}

// Cœur du moteur : toutes les paires, avec une réponse explicite pour chacune.
export function composeRelations({ configurations = [], figures = [] }) {
  const parAspect = new Map(configurations.map((config) => [config.evidenceRef, config]));
  const appartenance = figureMembership(figures);
  const relations = [];
  const refus = [];

  for (let i = 0; i < configurations.length; i += 1) {
    for (let j = i + 1; j < configurations.length; j += 1) {
      const premiere = configurations[i];
      const seconde = configurations[j];
      const figuresCommunes = (appartenance.get(premiere.evidenceRef) ?? []).filter((figureId) =>
        (appartenance.get(seconde.evidenceRef) ?? []).includes(figureId)
      );

      if (figuresCommunes.length > 0) {
        const figure = figures.find((candidat) => candidat.figureId === figuresCommunes[0]);
        relations.push({
          relationId: `relation.${figure.figureId}.${premiere.evidenceRef}.${seconde.evidenceRef}`,
          kind: "figure_third_term",
          conventionId: COMPOSITION_CONVENTIONS.figureThirdTerm.ruleId,
          figureId: figure.figureId,
          figureType: figure.type,
          figureMode: figure.mode,
          memberConfigs: [premiere.configId, seconde.configId],
          evidenceRefs: [premiere.evidenceRef, seconde.evidenceRef, ...figure.members.map((membre) => membre.aspectId)],
          figureMembers: figure.members,
          tightestMemberId: figure.tightestMemberId,
          sharedBodies: sharedBodies(premiere, seconde),
          articulation: articulationFigure(figure)
        });
        continue;
      }

      const corps = sharedBodies(
        { bodyA: premiere.bodyA, bodyB: premiere.bodyB },
        { bodyA: seconde.bodyA, bodyB: seconde.bodyB }
      );
      if (corps.length > 0) {
        relations.push({
          relationId: `relation.corps.${corps.join(".")}.${premiere.evidenceRef}.${seconde.evidenceRef}`,
          kind: "shared_body",
          conventionId: COMPOSITION_CONVENTIONS.sharedBody.ruleId,
          sharedBodies: corps,
          memberConfigs: [premiere.configId, seconde.configId],
          evidenceRefs: [premiere.evidenceRef, seconde.evidenceRef],
          articulation: articulationCorpsPartage(premiere, seconde, corps)
        });
        continue;
      }

      refus.push({
        conventionId: COMPOSITION_CONVENTIONS.noRelation.ruleId,
        memberConfigs: [premiere.configId, seconde.configId],
        evidenceRefs: [premiere.evidenceRef, seconde.evidenceRef],
        reason: "aucun corps partagé et aucune figure calculée ne relient ces deux configurations",
        message: "Aucune relation astrologique directe suffisamment étayée pour ce croisement."
      });
    }
  }

  // Ordre déterministe : figures d'abord (structures), puis corps partagés,
  // puis par identifiant — pour que deux exécutions produisent le même plan.
  relations.sort((gauche, droite) => {
    const rang = { figure_third_term: 0, shared_body: 1 };
    return (rang[gauche.kind] - rang[droite.kind]) || gauche.relationId.localeCompare(droite.relationId);
  });

  return { version: COMPOSITION_VERSION, relations, rejected: refus, conventions: COMPOSITION_CONVENTIONS };
}

// Isolation d'une figure : examiner TOUS les aspects retenus du thème, pas
// seulement ceux qui ont une règle. Sans cela, « aucun fait ne relie Mars–Saturne
// à la figure » ne portait que sur les cinq aspects sélectionnés — une phrase
// vraie par omission.
export function analyseIsolation({ dossierEvidence, figures = [] }) {
  const aspects = [];
  for (const item of dossierEvidence?.evidence ?? []) {
    if (item?.type !== "NATAL_ASPECT") continue;
    const value = item.value ?? {};
    if (!value.bodyA || !value.bodyB) continue;
    aspects.push({ ref: item.evidenceId, bodyA: value.bodyA, bodyB: value.bodyB });
  }
  const parFigure = [];
  for (const figure of figures) {
    const membres = new Set(figure.members.map((membre) => membre.aspectId));
    const corpsFigure = new Set(figure.members.flatMap((membre) => [membre.bodyA, membre.bodyB]));
    const liees = [];
    const isolees = [];
    for (const aspect of aspects) {
      if (membres.has(aspect.ref)) continue;
      const partages = [aspect.bodyA, aspect.bodyB].filter((body) => corpsFigure.has(body));
      (partages.length > 0 ? liees : isolees).push({ ref: aspect.ref, bodies: [aspect.bodyA, aspect.bodyB], sharedBodies: partages });
    }
    parFigure.push({
      figureId: figure.figureId,
      examinedAspects: aspects.length,
      figureBodies: [...corpsFigure],
      isolated: isolees,
      linked: liees,
      statement:
        liees.length === 0
          ? `Sur les ${aspects.length} aspects retenus du thème, aucun ne touche un corps de cette figure (${[...corpsFigure].join(", ")}) : les configurations hors figure ne lui sont reliées par aucun aspect calculé.`
          : `Sur les ${aspects.length} aspects retenus, ${liees.length} touchent un corps de cette figure : ${liees.map((entree) => `${entree.ref} (${entree.sharedBodies.join(", ")})`).join(" ; ")}.`
    });
  }
  return { version: "lastro-isolation@1.0.0", byFigure: parFigure };
}

export function linkedConfigurationGroups(configurations, relations) {
  const groups = [], visited = new Set();
  for (const seed of configurations) {
    if (visited.has(seed.configId)) continue;
    const ids = new Set([seed.configId]), pending = [seed.configId];
    while (pending.length) {
      const id = pending.pop(); visited.add(id);
      for (const relation of relations.filter((relation) => relation.memberConfigs.includes(id))) {
        for (const member of relation.memberConfigs) if (!ids.has(member)) { ids.add(member); pending.push(member); }
      }
    }
    if (ids.size < 2) continue;
    const members = configurations.filter((config) => ids.has(config.configId));
    const refs = members.map((config) => config.evidenceRef).sort();
    groups.push({ groupId: `linked.${refs.join("+")}`, evidenceRefs: refs,
      bodies: [...new Set(members.flatMap((config) => [config.bodyA, config.bodyB]))].sort(),
      relationRefs: relations.filter((relation) => relation.memberConfigs.every((id) => ids.has(id))).map((relation) => relation.relationId) });
  }
  return groups.sort((a, b) => b.evidenceRefs.length - a.evidenceRefs.length || a.groupId.localeCompare(b.groupId));
}

// Entrée unique : preuves + règles → figures + configurations + relations.
export function composeEditorialMaterial({ dossierEvidence, rulesForEvidence }) {
  const figures = detectFigures({ dossierEvidence }).figures;
  const configurations = buildConfigurations({ dossierEvidence, rulesForEvidence });
  const { relations, rejected } = composeRelations({ configurations, figures });
  const isolation = analyseIsolation({ dossierEvidence, figures });
  return { figures, configurations, relations, rejected, isolation, linkedGroups: linkedConfigurationGroups(configurations, relations) };
}
