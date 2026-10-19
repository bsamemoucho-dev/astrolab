// Plan éditorial unique — la vision du dossier AVANT la première phrase.
//
// Un seul objet, qui sert à la fois de plan et de mémoire (exigence du
// commanditaire : pas deux mécanismes parallèles). Il contient :
//
//   - la thèse du dossier (la figure qui l'organise, ou à défaut l'aspect le
//     plus serré) ;
//   - les idées (une par configuration, une par figure, une par croisement),
//     chacune avec un PROPRIÉTAIRE unique ;
//   - la mission de chaque chapitre ;
//   - ce qui est déjà traité (rappel en une clause, jamais redéveloppé) ;
//   - ce qui est réservé à un chapitre ultérieur (à ne pas développer).
//
// Tout est déterministe : deux exécutions sur les mêmes preuves produisent le
// même plan, octet pour octet. Aucune mémoire conversationnelle, aucun appel IA.

import { composeEditorialMaterial } from "./editorialComposition.mjs";
import { semanticsCoverage } from "./interpretationRules.mjs";
import { buildReadingHypotheses } from "./readingHypotheses.mjs";

export const EDITORIAL_PLAN_VERSION = "lastro-editorial-plan@1.1.0";

// Missions par chapitre — version courte, injectée telle quelle dans le prompt.
const MISSIONS = {
  general_synthesis:
    "Annonce la figure qui organise le thème et les deux ou trois idées que le dossier va développer. Tu les nommes, tu ne les développes pas : chaque idée a son chapitre.",
  internal_tensions:
    "Montre une tension sans la refermer. Décris ce que chaque opposition met en jeu, puis, si une figure calculée relie ses extrémités à un troisième corps, dis ce que ce troisième terme change dans la lecture. Tu ne redéveloppes pas les ressources traitées ailleurs : tu peux les nommer en une clause.",
  supporting_resources:
    "Montre ce qui rend la tension tenable, pas des dons isolés. Un appui ne peut être relié à une tension que si une relation calculée le permet ; sinon, développe sa portée propre sans inventer de lien. Tu peux rappeler en une clause les tensions auxquelles ces appuis répondent, sans les redécrire.",
  major_aspects:
    "Tu ne décris aucun aspect : tout a été dit dans les chapitres de catégorie. Tu formules ce que la carte des aspects montre d'ensemble et qui n'a pas encore été écrit. Si tu n'as rien de nouveau à dire, dis-le en une phrase.",
  conclusion:
    "Rappelle brièvement les grandes dynamiques déjà établies, sans réinterpréter chaque fait ni affirmer de lien non calculé. Dis ce qui reste ouvert, pas ce qui est résolu.",
  // Mission du chapitre qui porte une figure : exposer des lectures, pas un verdict.
  exploration:
    "Tu explores UNE figure calculée, pas des aspects séparés. Trois mouvements, sans les titrer : " +
    "(1) ce que cette structure a de particulier — sans réciter les positions, elles sont dans l'annexe ; " +
    "(2) deux lectures possibles de cette même figure, chacune développée et menée jusqu'à ce qu'elle change quelque chose pour le lecteur, avec en une phrase le fait qui les distingue ; " +
    "(3) une question ou une ouverture qui laisse au lecteur quelque chose à penser. " +
    "Ne tranche pas entre les deux lectures. " +
    "N'explique pas l'atelier : ni « hypothèse », ni « mesure », ni « convention », ni « on ne peut pas en déduire ». Les preuves et les limites sont publiées dans l'annexe ; ton texte les applique, il ne les raconte pas.",
  identity:
    "Décris la direction personnelle à partir du Soleil et de l'axe, sans nommer les aspects déjà traités dans les chapitres de tensions.",
  emotional_world:
    "Décris le monde émotionnel à partir de la Lune, sans redévelopper les aspects déjà traités ailleurs.",
  communication: "Décris la circulation mentale et l'expression à partir de Mercure.",
  affectivity: "Décris la manière d'accorder de la valeur et de s'attacher, à partir de Vénus.",
  action: "Décris la manière d'agir et de défendre à partir de Mars.",
  relationships: "Décris la manière d'entrer en relation, sans inventer de relation réelle.",
  work_realization: "Décris la construction et la tenue dans le temps à partir de Saturne.",
  security_resources: "Décris l'ancrage et les ressources concrètes.",
  creativity: "Décris les modes d'expression créative à partir des faits disponibles.",
  houses: "Décris les domaines de vie à partir des maisons exploitables."
};

function missionPour(sectionId) {
  return MISSIONS[sectionId] ?? "Traite ta section à partir des seuls faits transmis.";
}

function rangDe(sectionId, sections) {
  const index = sections.findIndex((section) => section.sectionId === sectionId);
  return index === -1 ? 99 : index;
}

// Chapitre propriétaire d'une configuration : sa catégorie (tensions / soutiens),
// à défaut le chapitre du corps qui la porte.
function chapitreDeConfiguration(configuration, { ownerByEvidenceRef, sections }) {
  const parCategorie = configuration.category === "tension" ? "internal_tensions" : "supporting_resources";
  if (sections.some((section) => section.sectionId === parCategorie)) return parCategorie;
  const parCorps = ownerByEvidenceRef?.[configuration.evidenceRef] ?? null;
  if (parCorps && sections.some((section) => section.sectionId === parCorps)) return parCorps;
  return sections[0]?.sectionId ?? null;
}

function labelConfiguration(configuration) {
  return `${configuration.bodyA}–${configuration.bodyB} ${configuration.aspectType}`;
}

export function buildEditorialPlan({
  dossierEvidence,
  rulesForEvidence,
  sections = [],
  ownerByEvidenceRef = {},
  aspectChapterMode = "narrative"
} = {}) {
  const material = composeEditorialMaterial({ dossierEvidence, rulesForEvidence });
  const { figures, configurations, relations, rejected } = material;
  const reading = buildReadingHypotheses({ figures, configurations });
  const isolation = material.isolation ?? { byFigure: [] };
  const idsDisponibles = new Set(sections.map((section) => section.sectionId));
  const gaps = [];

  const figurePrincipale = figures[0] ?? null;

  // --- Thèse ---------------------------------------------------------------
  let thesis;
  if (figurePrincipale) {
    thesis = {
      id: `idea.thesis.${figurePrincipale.figureId}`,
      statement:
        `Le thème est organisé par une figure calculée : ${figurePrincipale.proof}. ` +
        `C'est elle qui donne au dossier son fil conducteur.`,
      evidenceRefs: figurePrincipale.members.map((membre) => membre.aspectId),
      figureId: figurePrincipale.figureId,
      owner: idsDisponibles.has("general_synthesis") ? "general_synthesis" : sections[0]?.sectionId
    };
  } else {
    thesis = {
      id: "idea.thesis.tightest_aspect",
      statement: "Aucune figure ne relie plusieurs aspects : la thèse se construit sur l'aspect le plus serré.",
      evidenceRefs: [],
      figureId: null,
      owner: idsDisponibles.has("general_synthesis") ? "general_synthesis" : sections[0]?.sectionId
    };
    gaps.push({
      code: "no_calculated_figure",
      message: "Aucune figure calculée dans ce thème : pas de croisement entre configurations, chaque aspect reste isolé."
    });
  }

  // --- Idées ---------------------------------------------------------------
  const ideas = [
    {
      ideaId: thesis.id,
      kind: "thesis",
      label: "thèse du dossier",
      evidenceRefs: thesis.evidenceRefs,
      relationRefs: [],
      owner: thesis.owner
    }
  ];

  for (const item of dossierEvidence.evidence ?? []) {
    if (!["NATAL_BODY_SIGN", "NATAL_BODY_HOUSE"].includes(item.type)) continue;
    const owner = ownerByEvidenceRef?.[item.evidenceId];
    if (!owner) continue;
    ideas.push({ ideaId: `idea.placement.${item.evidenceId}`, kind: "placement", label: `${item.value.body} ${item.value.sign ?? `maison ${item.value.house}`}`, evidenceRefs: [item.evidenceId], relationRefs: [], owner });
  }

  const ideaParConfig = new Map();
  for (const configuration of configurations) {
    const owner = chapitreDeConfiguration(configuration, { ownerByEvidenceRef, sections });
    const idea = {
      ideaId: `idea.config.${configuration.evidenceRef.split(".").slice(1).join(".")}`,
      kind: "configuration",
      label: labelConfiguration(configuration),
      motif: configuration.motif,
      evidenceRefs: [configuration.evidenceRef],
      relationRefs: [],
      owner,
      configId: configuration.configId
    };
    ideas.push(idea);
    ideaParConfig.set(configuration.evidenceRef, idea);
  }

  // Idée de figure : le troisième terme. Propriétaire = chapitre de l'opposition.
  const ideaParFigure = new Map();
  for (const figure of figures) {
    const opposition = figure.members.find((membre) => membre.aspectType === "opposition");
    const ownerCandidat = opposition ? ideaParConfig.get(opposition.aspectId)?.owner ?? null : null;
    const owner = ownerCandidat && idsDisponibles.has(ownerCandidat) ? ownerCandidat : thesis.owner;
    const idea = {
      ideaId: `idea.figure.${figure.figureId}`,
      kind: "figure",
      label: `figure ${figure.type} (${figure.bodies.apex ?? figure.bodies.triangle?.join("–")})`,
      evidenceRefs: figure.members.map((membre) => membre.aspectId),
      relationRefs: [],
      owner,
      figureId: figure.figureId
    };
    ideas.push(idea);
    ideaParFigure.set(figure.figureId, idea);
  }

  // Les relations de figure ne créent pas une idée de plus : elles servent
  // l'idée de figure. Les relations de corps partagé, elles, portent leur idée.
  for (const relation of relations) {
    if (relation.kind === "shared_body") {
      const premiere = relation.evidenceRefs[0];
      const seconde = relation.evidenceRefs[1];
      const ownerA = ideaParConfig.get(premiere)?.owner ?? thesis.owner;
      const ownerB = ideaParConfig.get(seconde)?.owner ?? thesis.owner;
      const owner = rangDe(ownerA, sections) <= rangDe(ownerB, sections) ? ownerA : ownerB;
      ideas.push({
        ideaId: `idea.relation.${relation.relationId.replace(/^relation\./, "")}`,
        kind: "relation",
        label: `croisement par ${relation.sharedBodies.join(" et ")}`,
        evidenceRefs: relation.evidenceRefs,
        relationRefs: [relation.relationId],
        owner,
        relationId: relation.relationId
      });
    } else if (relation.kind === "figure_third_term") {
      const idea = ideaParFigure.get(relation.figureId);
      if (idea) idea.relationRefs.push(relation.relationId);
    }
  }

  // --- Chapitres -----------------------------------------------------------
  const chapters = sections.map((section) => {
    const sectionId = section.sectionId;
    const rang = rangDe(sectionId, sections);
    const owns = ideas.filter((idea) => idea.owner === sectionId);
    const mayRecall = ideas.filter((idea) => idea.owner !== sectionId && rangDe(idea.owner, sections) < rang);
    const reserved = ideas.filter((idea) => idea.owner !== sectionId && rangDe(idea.owner, sections) > rang);
    const relationsDuChapitre = relations.filter((relation) =>
      relation.memberConfigs.some((configId) =>
        owns.some((idea) => idea.configId === configId)
      ) || owns.some((idea) => idea.kind === "figure" && idea.figureId === relation.figureId)
    );
    // Les hypothèses de lecture appartiennent au chapitre qui possède la figure :
    // c'est là qu'on explore plusieurs lectures d'UNE même structure, et nulle
    // part ailleurs.
    const hypothesesDuChapitre = reading.hypotheses.filter((hypothese) =>
      owns.some((idea) => idea.kind === "figure" && idea.figureId === hypothese.figureId)
    );
    const isolationDuChapitre = [...new Set(hypothesesDuChapitre.map((hypothese) => hypothese.figureId))]
      .map((figureId) => isolation.byFigure.find((entree) => entree.figureId === figureId))
      .filter(Boolean);
    return {
      sectionId,
      mission: hypothesesDuChapitre.length > 0 ? MISSIONS.exploration : missionPour(sectionId),
      hypotheses: hypothesesDuChapitre,
      isolation: isolationDuChapitre,
      owns: owns.map((idea) => idea.ideaId),
      mayRecall: mayRecall.map((idea) => idea.ideaId),
      reserved: reserved.map((idea) => idea.ideaId),
      relations: relationsDuChapitre.map((relation) => relation.relationId)
    };
  });

  // --- Lacunes --------------------------------------------------------------
  if (figurePrincipale) {
    const membresStructures = configurations.filter((configuration) =>
      figurePrincipale.members.some((membre) => membre.aspectId === configuration.evidenceRef) && configuration.structured
    );
    if (membresStructures.length < figurePrincipale.members.length) {
      gaps.push({
        code: "figure_member_without_semantics",
        message:
          "Au moins une configuration de la figure n'a pas de sémantique structurée : la figure est détectée, mais son interprétation ne peut pas s'appuyer sur ses concepts."
      });
    }
  }
  for (const relation of relations) {
    if (!relation.articulation) {
      gaps.push({ code: "relation_without_articulation", message: `La relation ${relation.relationId} n'a pas d'articulation calculée.` });
    }
  }
  if (aspectChapterMode === "reference" && configurations.some((configuration) => ideaParConfig.get(configuration.evidenceRef)?.owner === "major_aspects")) {
    gaps.push({
      code: "major_aspects_set_to_reference",
      message: "« Aspects majeurs » est en mode référence : ses configurations sont réparties dans les chapitres de catégorie."
    });
  }

  return {
    version: EDITORIAL_PLAN_VERSION,
    aspectChapterMode,
    // Migration progressive : le rédacteur reçoit des concepts pour les règles
    // qui en ont, et les anciennes phrases pour les autres. Ce compteur dit où
    // l'on en est, sans prétendre que la migration est faite.
    semantics: semanticsCoverage(),
    thesis,
    ideas,
    chapters,
    figures,
    configurations,
    relations,
    rejected,
    hypotheses: reading.hypotheses,
    isolation: isolation.byFigure,
    singleReadingFigures: reading.singleReadingFigures,
    gaps,
    // Mémoire : ce que chaque chapitre peut rappeler sans le redévelopper.
    ownership: Object.fromEntries(ideas.map((idea) => [idea.ideaId, idea.owner]))
  };
}

// Références à ajouter en secondaire pour qu'un chapitre ait le DROIT de nommer
// les configurations qu'il croise (sinon le validateur refuserait la mention).
export function crossReferenceAdditions({ editorialPlan, sections = [] }) {
  const parId = new Map(sections.map((section) => [section.sectionId, section]));
  const additions = new Map();
  const ajouter = (sectionId, refs) => {
    if (!parId.has(sectionId)) return;
    const ensemble = additions.get(sectionId) ?? new Set();
    for (const ref of refs) ensemble.add(ref);
    additions.set(sectionId, ensemble);
  };
  for (const chapter of editorialPlan.chapters ?? []) {
    // 1. Les idées que le chapitre POSSÈDE : il doit pouvoir nommer leurs preuves
    //    (annoncer la thèse, par exemple, c'est nommer les membres de la figure).
    for (const idea of editorialPlan.ideas ?? []) {
      if (!chapter.owns.includes(idea.ideaId)) continue;
      ajouter(chapter.sectionId, idea.evidenceRefs ?? []);
    }
    const relations = (editorialPlan.relations ?? []).filter((relation) =>
      chapter.relations.includes(relation.relationId)
    );
    for (const relation of relations) {
      // Le chapitre qui possède une idée de figure peut citer TOUS les membres ;
      // celui qui possède un croisement par corps cite les deux configurations.
      const refs = relation.kind === "figure_third_term"
        ? relation.figureMembers.map((membre) => membre.aspectId)
        : relation.evidenceRefs;
      ajouter(chapter.sectionId, refs);
    }
  }
  return additions;
}
