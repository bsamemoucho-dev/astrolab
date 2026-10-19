// Démonstration hors ligne du moteur éditorial : plans avant/après, croisements
// autorisés ou refusés, diagnostics des textes déjà générés, coût prévu.
//
// Aucun appel réseau, aucune dépense : ce script ne fait que composer des plans
// et mesurer. Il écrit ses résultats dans docs/experiments/2026-10-19-moteur-editorial/.
//
//   node tools/editorial-plan-diff.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { priceForModel } from "../src/deliverables/cost.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { diagnose } from "../src/deliverables/editorialDiagnostics.mjs";
import { blockLengthBudget, maxTokensForBlock } from "../src/deliverables/generationLimits.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { lengthForHypotheses } from "../src/deliverables/readingHypotheses.mjs";
import { aspectFr, corpsNomFr } from "../src/deliverables/figures.mjs";
import {
  buildStructuredSystemPrompt,
  buildStructuredUserPrompt,
  scopedSectionPlanForBlock
} from "../src/deliverables/structuredSectionWriter.mjs";

const SORTIE = "docs/experiments/2026-10-19-moteur-editorial";
const THEME = {
  personId: "experimentation_editeur",
  birthDate: "1979-03-14",
  timePrecision: "approximate",
  timeValue: "09:00",
  timeMarginMinutes: 30,
  birthPlace: "Lyon, France",
  placeName: "Lyon, France",
  country: "FR",
  latitude: 45.764,
  longitude: 4.8357,
  timeZone: "Europe/Paris",
  coordinateSource: "experimentation_fixture",
  coordinateConfidence: "unverified"
};

const CHAPITRES = ["general_synthesis", "internal_tensions", "supporting_resources", "major_aspects", "conclusion"];

function construire() {
  const calculation = calculateWesternNatalChart(THEME, {
    calculatedAt: "2026-10-18T00:00:00.000Z",
    runId: "calc_plan_diff"
  });
  const dossierEvidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
  const legacy = buildFullDossierPlan(dossierEvidence, { editorialEngine: "legacy", aspectChapterMode: "narrative" });
  const compositionReference = buildFullDossierPlan(dossierEvidence, { editorialEngine: "composition", aspectChapterMode: "reference" });
  // « synthesis » n'est pas un mode : sous le moteur de composition, le mode
  // narratif EST la synthèse (le chapitre ne possède aucune configuration).
  const compositionSynthese = buildFullDossierPlan(dossierEvidence, { editorialEngine: "composition", aspectChapterMode: "narrative" });
  return { dossierEvidence, legacy, compositionReference, compositionSynthese };
}

function blocs(plan) {
  return plan.sections.reduce((total, section) => total + (section.blockPlans ?? []).length, 0);
}

function resumeSection(section) {
  const packets = section.evidencePackets ?? [];
  return {
    sectionId: section.sectionId,
    blocs: (section.blockPlans ?? []).length,
    primaires: packets.filter((packet) => packet.interpretationDepth === "primary").length,
    references: packets.filter((packet) => packet.interpretationDepth === "reference").length,
    faits: packets.map((packet) => {
      const claim = packet.claims[0] ?? {};
      let libelle;
      if (claim.type === "NATAL_ASPECT") libelle = `${corpsNomFr(claim.bodyA)}–${corpsNomFr(claim.bodyB)} ${aspectFr(claim.aspectType)}`;
      else if (claim.type === "NATAL_BODY_SIGN") libelle = `${corpsNomFr(claim.body)} en ${claim.sign}`;
      else if (claim.type === "NATAL_BODY_HOUSE") libelle = `${corpsNomFr(claim.body)} en maison ${claim.house}`;
      else if (claim.type === "ANGLE_SIGN") libelle = `${corpsNomFr(claim.angle)} en ${claim.sign}`;
      else if (claim.type === "DISTRIBUTION_COUNT") libelle = `${claim.element ?? claim.modality} (répartition)`;
      else libelle = claim.type ?? "fait";
      return `${libelle} (${packet.interpretationDepth})`;
    }),
    regles: [...new Set(section.allowedInterpretationRuleRefs ?? [])].length,
    relations: (section.allowedRelations ?? []).length,
    mission: section.editorialPlan?.mission ?? null,
    possede: (section.editorialPlan?.owns ?? []).map((idea) => idea.label),
    peutRappeler: (section.editorialPlan?.mayRecall ?? []).map((idea) => idea.label),
    reserve: (section.editorialPlan?.reserved ?? []).map((idea) => idea.label)
  };
}

function rendreAvant(plan) {
  const lignes = [
    "# Plan AVANT — moteur précédent (thèmes-phrases, aucun croisement)",
    "",
    `Plan : \`${plan.version}\` · moteur \`${plan.editorialEngine}\` · aspects \`${plan.aspectChapterMode}\``,
    `Blocs narratifs au total : ${blocs(plan)}`,
    "",
    "| Chapitre | Blocs | Faits (profondeur) | Règles | Relations |",
    "|---|---:|---|---:|---:|"
  ];
  for (const section of plan.sections) {
    if ((section.blockPlans ?? []).length === 0 && !CHAPITRES.includes(section.sectionId)) continue;
    const r = resumeSection(section);
    lignes.push(`| \`${r.sectionId}\` | ${r.blocs} | ${r.faits.join(" ; ") || "—"} | ${r.regles} | ${r.relations} |`);
  }
  lignes.push(
    "",
    "Ce que le rédacteur recevait : les mêmes paquets, avec des **thèmes déjà rédigés** (`themes`) et",
    "aucune notion de propriétaire, de mission ni de croisement. Chaque chapitre travaillait seul.",
    "`major_aspects` décrivait les mêmes aspects que les deux chapitres de catégorie."
  );
  return lignes.join("\n");
}

function rendreApres(plan) {
  const { editorialPlan } = plan;
  const lignes = [
    "# Plan APRÈS — moteur de composition (thèse, idées, relations, mémoire)",
    "",
    `Plan : \`${plan.version}\` · moteur \`${plan.editorialEngine}\` · aspects \`${plan.aspectChapterMode}\``,
    `Blocs narratifs au total : ${blocs(plan)}`,
    "",
    "## Thèse du dossier",
    "",
    `> ${editorialPlan.thesis.statement}`,
    "",
    `Propriétaire : \`${editorialPlan.thesis.owner}\``,
    "",
    "## Figures calculées",
    ""
  ];
  if (editorialPlan.figures.length === 0) lignes.push("_Aucune figure : pas de croisement possible._");
  for (const figure of editorialPlan.figures) {
    lignes.push(
      `- **${figure.type}** (${figure.mode}) — ${figure.proof}`,
      `  - membres : ${figure.members.map((m) => `${corpsNomFr(m.bodyA)}–${corpsNomFr(m.bodyB)} ${aspectFr(m.aspectType)} ${m.orb}°`).join(", ")}`,
      `  - plus serré : ${figure.tightestMemberId}`,
      `  - convention : \`${figure.conventionId}\``
    );
  }

  lignes.push("", "## Croisements autorisés", "");
  if (editorialPlan.relations.length === 0) lignes.push("_Aucun._");
  for (const relation of editorialPlan.relations) {
    lignes.push(`- \`${relation.relationId}\` — ${relation.conventionId}`, `  - ${relation.articulation}`);
  }

  lignes.push("", "## Croisements refusés (réponse explicite)", "");
  for (const refus of editorialPlan.rejected) {
    lignes.push(`- ${refus.memberConfigs.map((id) => id.replace("config:", "")).join(" × ")} → ${refus.message}`);
  }

  lignes.push("", "## Idées et propriétaires (mémoire)", "");
  lignes.push("| Idée | Type | Propriétaire |", "|---|---|---|");
  for (const idea of editorialPlan.ideas) {
    lignes.push(`| ${idea.label} | ${idea.kind} | \`${idea.owner}\` |`);
  }

  lignes.push("", "## Contrat de chaque chapitre", "");
  for (const sectionId of CHAPITRES) {
    const section = plan.sections.find((entry) => entry.sectionId === sectionId);
    if (!section) continue;
    const r = resumeSection(section);
    lignes.push(
      `### \`${sectionId}\` — ${r.blocs} bloc(s), ${r.relations} croisement(s)`,
      "",
      `**Mission** : ${r.mission ?? "—"}`,
      "",
      `- Faits développés : ${r.faits.filter((f) => f.includes("(primary)")).join(" ; ") || "—"}`,
      `- Faits cités : ${r.faits.filter((f) => f.includes("(reference)")).join(" ; ") || "—"}`,
      `- Possède : ${r.possede.join(" ; ") || "—"}`,
      `- Peut rappeler : ${r.peutRappeler.join(" ; ") || "—"}`,
      `- Réservé à plus tard : ${r.reserve.join(" ; ") || "—"}`,
      ""
    );
  }

  if (editorialPlan.gaps.length > 0) {
    lignes.push("## Lacunes signalées par le moteur", "");
    for (const gap of editorialPlan.gaps) lignes.push(`- \`${gap.code}\` — ${gap.message}`);
    lignes.push("");
  }
  return lignes.join("\n");
}

function rendreBrief(plan) {
  const section = plan.sections.find((entree) => entree.sectionId === "internal_tensions");
  const hypotheses = section.readingHypotheses ?? [];
  const lignes = [
    "# Brief d'exploration — ce que le rédacteur reçoit pour la figure",
    "",
    "Tout ce qui suit est **calculé** (aucune rédaction). Le chapitre ne reçoit plus",
    "un objectif de 420 mots ni une phrase factuelle en ouverture : il reçoit une",
    "figure, deux lectures concurrentes et ce qui les distingue.",
    "",
    `- Mission : ${section.editorialPlan.mission}`,
    `- Longueur fixée par la matière : ${lengthForHypotheses(hypotheses.length).targetWords} mots (plafond ${section.maxWords})`,
    `- Préfixe factuel du serveur : ${section.blockPlans[0]?.deterministicPrefix ? "présent" : "**supprimé** (les faits sont dans la licence et l'annexe)"}`,
    "",
    "## Lectures proposées",
    ""
  ];
  for (const [index, hypothese] of hypotheses.entries()) {
    lignes.push(
      `### ${index + 1}. ${hypothese.title} — \`${hypothese.conventionId}\``,
      "",
      hypothese.statement,
      "",
      `- **Ce qui la fonde** : ${hypothese.licence.computedFacts.join(" ; ")}`,
      `- **Ce qui la distingue** : ${hypothese.discriminator}`,
      `- **Questions au lecteur** : ${hypothese.questions.join(" / ") || "—"}`,
      `- **Limites** : ${hypothese.limits.join(" ; ")}`,
      ""
    );
  }
  lignes.push(
    "## Correspondance avec le texte attendu",
    "",
    "| Segment du texte attendu | Ce qui, dans le brief, le rend possible |",
    "|---|---|",
    "| « Votre thème présente une opposition entre le Soleil et la Lune… » | `licence.computedFacts` de la figure + concepts de la règle d'opposition |",
    "| « Mais cette opposition ne se présente pas seule. Jupiter entretient une relation harmonique avec chacun des deux pôles. » | `figure.proof` + `figure.mode = harmonic` (structure calculée) |",
    "| « Une première lecture serait de considérer Jupiter comme un espace de dialogue… » | hypothèse 1 (`dialogue`) |",
    "| « Pourtant, une autre possibilité… sans nécessairement résoudre leur désaccord ? » | hypothèse 2 (`amplification`), licenciée par l'asymétrie mesurée |",
    "| « Deux besoins à faire coexister » | `amplification.statement` + `discriminator` |",
    "| « ce qui vous enthousiasme est-il également ce qui vous rassure ? » | `questions` de l'hypothèse 2, tirées des concepts |",
    "",
    "Le brief ne dicte aucune de ces phrases : il fournit la structure, les deux",
    "lectures, la mesure qui les sépare et les questions. La rédaction reste au",
    "modèle — c'est ce que la prochaine génération devra montrer."
  );
  return lignes.join("\n");
}

function rendreCroisements(plan) {
  const { editorialPlan } = plan;
  const lignes = [
    "# Les cinq croisements demandés, examinés par le moteur",
    "",
    "| Croisement | Licence | Verdict |",
    "|---|---|---|"
  ];
  // Les paires sont comparées sur les NOMS DE CORPS (les configurations sont en
  // anglais), et affichées en français.
  const paires = [
    ["Mars", "Saturn", "Sun", "Moon"],
    ["Mercury", "Venus", "Mars", "Saturn"],
    ["Moon", "Jupiter", "Sun", "Moon"],
    ["Sun", "Jupiter", "Mars", "Saturn"],
    ["Mercury", "Venus", "Moon", "Jupiter"]
  ];
  const libelle = (configuration) =>
    `${corpsNomFr(configuration.bodyA)}–${corpsNomFr(configuration.bodyB)}`;
  const memeConfiguration = (configId, [a, b]) => {
    const configuration = editorialPlan.configurations.find((entry) => entry.configId === configId);
    if (!configuration) return false;
    const corps = [configuration.bodyA, configuration.bodyB].sort().join("|");
    return corps === [a, b].sort().join("|");
  };
  let autorises = 0;
  for (const [a1, b1, a2, b2] of paires) {
    const gauche = `${corpsNomFr(a1)}–${corpsNomFr(b1)}`;
    const droite = `${corpsNomFr(a2)}–${corpsNomFr(b2)}`;
    const trouvee = editorialPlan.relations.find((relation) =>
      relation.memberConfigs.some((id) => memeConfiguration(id, [a1, b1])) &&
      relation.memberConfigs.some((id) => memeConfiguration(id, [a2, b2]))
    );
    if (trouvee) {
      autorises += 1;
      lignes.push(`| ${gauche} × ${droite} | \`${trouvee.conventionId}\` | **autorisé** — ${trouvee.articulation.slice(0, 80)}… |`);
    } else {
      const refus = editorialPlan.rejected.find((entree) =>
        entree.memberConfigs.some((id) => memeConfiguration(id, [a1, b1])) &&
        entree.memberConfigs.some((id) => memeConfiguration(id, [a2, b2]))
      );
      const raison = refus?.reason ?? "aucune figure ni corps partagé";
      lignes.push(`| ${gauche} × ${droite} | \`${refus?.conventionId ?? "—"}\` | **refusé** — ${refus?.message ?? "aucune licence"} (${raison}) |`);
    }
  }
  lignes.push(
    "",
    `Sur les ${paires.length} croisements demandés, **${autorises} ${autorises > 1 ? "sont autorisés" : "est autorisé"}** : exactement ceux dont les deux`,
    "configurations appartiennent à la figure Soleil–Lune–Jupiter. Les autres n'ont ni corps partagé",
    "ni figure commune : le moteur répond « aucune relation astrologique directe suffisamment",
    "étayée » au lieu de fabriquer une convergence.",
    "",
    "Au total, le plan contient **3 relations autorisées** (les trois paires de la figure) et",
    `**${editorialPlan.rejected.length} refus explicites**.`
  );
  return lignes.join("\n");
}

function dossierTexte(chemin, ids) {
  const contenu = readFileSync(chemin, "utf8");
  return contenu.split(/\n---\n/).map((bloc, index) => {
    const lignes = bloc.split("\n").filter((ligne) => ligne.trim() && !ligne.startsWith("#"));
    return { id: ids[index] ?? `section-${index}`, text: lignes.slice(1).join(" ") };
  });
}

function rendreDiagnostics(plan) {
  const sources = (plan.editorialPlan?.configurations ?? []).flatMap((configuration) => [
    configuration.relationFormula,
    ...configuration.themes
  ].filter(Boolean));
  const corpus = {
    "gpt-4o-mini": "docs/experiments/2026-10-18-chapitres-aspects/lecture-complete.md",
    "claude-sonnet-5-5": "docs/experiments/2026-10-19-chapitres-aspects-claude/lecture-complete.md"
  };
  const lignes = [
    "# Diagnostics des textes déjà générés (aucune réécriture, aucun appel)",
    "",
    "Mesures sur les deux dossiers existants. Elles servent de référence AVANT :",
    "longueur, dépendance aux formulations sources, nouveauté, répétitions entre chapitres.",
    "",
    `Sources comparées : ${sources.length} formulations transmises par les règles.`,
    ""
  ];
  for (const [modele, chemin] of Object.entries(corpus)) {
    const sections = dossierTexte(chemin, ["internal_tensions", "supporting_resources", "major_aspects"]);
    const rapport = diagnose({
      sections: sections.map((section) => ({ ...section, sources, ownedLabels: sources }))
    });
    lignes.push(`## ${modele}`, "");
    lignes.push("| Chapitre | Mots | Recopie max (mots) | Nouveauté |", "|---|---:|---:|---:|");
    for (const section of rapport.sections) {
      lignes.push(`| \`${section.id}\` | ${section.words} | ${section.verbatim.maxRun} | ${section.novelty.novelRatio} |`);
    }
    lignes.push("");
    if (rapport.repetitions.length === 0) lignes.push("_Aucune répétition détectée._");
    for (const repetition of rapport.repetitions) {
      lignes.push(
        `- \`${repetition.a}\` × \`${repetition.b}\` : n-grammes ${repetition.ngramRatio}, recouvrement lexical **${repetition.lexicalRatio}**`
      );
    }
    lignes.push("");
  }
  return lignes.join("\n");
}

// Seuls les trois chapitres de l'étude sont comparés : les autres ne changent pas
// et n'ont pas à être repayés.
const CHAPITRES_ETUDE = ["internal_tensions", "supporting_resources", "major_aspects"];

function coutPrevu(plans, modele) {
  const tarif = priceForModel(modele);
  const detail = [];
  let total = 0;
  let appels = 0;
  for (const [nom, plan] of Object.entries(plans)) {
    for (const section of plan.sections) {
      if (!CHAPITRES_ETUDE.includes(section.sectionId)) continue;
      for (const blockPlan of section.blockPlans ?? []) {
        const scoped = scopedSectionPlanForBlock(section, blockPlan);
        const system = buildStructuredSystemPrompt(scoped, { blockCount: section.blockPlans.length, blockPlan });
        const user = buildStructuredUserPrompt({ sectionPlan: scoped });
        const entree = Math.ceil((system.length + user.length) / 3.7);
        const budget = blockLengthBudget({ sectionPlan: section, blockPlan });
        const sortieMax = maxTokensForBlock(budget);
        const sortieCible = Math.ceil(budget.targetWords * 1.6);
        const coutMax = (entree / 1e6) * tarif.in + (sortieMax / 1e6) * tarif.out;
        const coutCible = (entree / 1e6) * tarif.in + (sortieCible / 1e6) * tarif.out;
        total += coutMax;
        appels += 1;
        detail.push({ bras: nom, section: section.sectionId, bloc: blockPlan.blockId, entree, sortieCible, sortieMax, coutMax: Math.round(coutMax * 1e6) / 1e6, coutCible: Math.round(coutCible * 1e6) / 1e6 });
      }
    }
  }
  return { modele, tarif, appels, coutMaxUsd: Math.round(total * 1e6) / 1e6, detail };
}

function main() {
  const { dossierEvidence, legacy, compositionReference, compositionSynthese } = construire();
  mkdirSync(SORTIE, { recursive: true });

  writeFileSync(join(SORTIE, "plan-avant.md"), `${rendreAvant(legacy)}\n`);
  writeFileSync(join(SORTIE, "plan-apres.md"), `${rendreApres(compositionReference)}\n`);
  writeFileSync(join(SORTIE, "croisements.md"), `${rendreCroisements(compositionReference)}\n`);
  writeFileSync(join(SORTIE, "brief-exploration.md"), `${rendreBrief(compositionReference)}\n`);
  writeFileSync(join(SORTIE, "diagnostics-avant.md"), `${rendreDiagnostics(compositionReference)}\n`);
  writeFileSync(
    join(SORTIE, "plans.json"),
    JSON.stringify(
      {
        theme: THEME,
        generatedAt: new Date().toISOString(),
        legacy: { version: legacy.version, engine: legacy.editorialEngine, mode: legacy.aspectChapterMode, blocs: blocs(legacy), sections: legacy.sections.map(resumeSection) },
        compositionReference: { version: compositionReference.version, engine: compositionReference.editorialEngine, mode: compositionReference.aspectChapterMode, blocs: blocs(compositionReference), editorialPlan: compositionReference.editorialPlan, sections: compositionReference.sections.map(resumeSection) },
        compositionSynthese: { version: compositionSynthese.version, engine: compositionSynthese.editorialEngine, mode: compositionSynthese.aspectChapterMode, blocs: blocs(compositionSynthese) }
      },
      null,
      1
    )
  );

  // Coût de la comparaison à l'aveugle : AVANT 2 (legacy) + APRÈS 1 et 2 (synthèse).
  const cout = coutPrevu(
    {
      "AVANT-2 (legacy)": legacy,
      "APRES-1 (composition)": compositionSynthese,
      "APRES-2 (composition)": compositionSynthese
    },
    "claude-sonnet-5-5"
  );
  writeFileSync(join(SORTIE, "cout-comparaison.json"), JSON.stringify(cout, null, 1));

  console.log("Plans écrits dans", SORTIE);
  console.log(`  AVANT (legacy)          : ${blocs(legacy)} blocs narratifs`);
  console.log(`  APRÈS (référence)       : ${blocs(compositionReference)} blocs`);
  console.log(`  APRÈS (synthèse)        : ${blocs(compositionSynthese)} blocs`);
  console.log(`  relations autorisées    : ${compositionReference.editorialPlan.relations.length}`);
  console.log(`  croisements refusés     : ${compositionReference.editorialPlan.rejected.length}`);
  console.log(`  idées / propriétaires   : ${compositionReference.editorialPlan.ideas.length}`);
  console.log(`  hypothèses de lecture   : ${compositionReference.editorialPlan.hypotheses.length}`);
  console.log(`  comparaison à l'aveugle : ${cout.appels} appels, plafond ${cout.coutMaxUsd} USD (${cout.modele})`);
  return { dossierEvidence };
}

main();
