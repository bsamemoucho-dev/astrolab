// Plan éditorial unique : thèse, idées, propriétaires, missions, mémoire.
//
// C'est le même objet qui sert de plan ET de mémoire : chaque idée a un
// propriétaire unique, les autres chapitres ne peuvent que la rappeler.

import assert from "node:assert/strict";
import test from "node:test";

import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { detectFigures } from "../src/deliverables/figures.mjs";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";

const THEMES = {
  demonstration: { birthDate: "1979-03-14", timePrecision: "approximate", timeValue: "09:00", timeMarginMinutes: 30, latitude: 45.764, longitude: 4.8357, timeZone: "Europe/Paris", birthPlace: "Lyon, France", placeName: "Lyon, France", country: "FR" },
  tCarre: { birthDate: "1975-09-08", timePrecision: "exact", timeValue: "10:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", birthPlace: "Paris, France", placeName: "Paris, France", country: "FR" },
  sansFigure: { birthDate: "1970-06-21", timePrecision: "exact", timeValue: "10:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", birthPlace: "Paris, France", placeName: "Paris, France", country: "FR" }
};

function dossierPour(theme) {
  const calculation = calculateWesternNatalChart(
    { personId: "fixture", coordinateSource: "test_fixture", coordinateConfidence: "verified_fixture", ...theme },
    { calculatedAt: "2026-10-18T00:00:00.000Z", runId: "calc_fixture" }
  );
  return buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
}

function planPour(theme, options = {}) {
  return buildFullDossierPlan(dossierPour(theme), options);
}

function chapitre(plan, sectionId) {
  return plan.editorialPlan.chapters.find((entree) => entree.sectionId === sectionId);
}

test("la thèse vient de la figure calculée et appartient à la synthèse", () => {
  const plan = planPour(THEMES.demonstration);
  const { thesis, figures } = plan.editorialPlan;
  assert.equal(figures.length, 1);
  assert.equal(thesis.owner, "general_synthesis");
  assert.match(thesis.statement, /figure calculée/);
  assert.deepEqual(thesis.evidenceRefs.sort(), figures[0].members.map((membre) => membre.aspectId).sort());
});

test("chaque idée a un propriétaire unique qui existe dans le plan", () => {
  const plan = planPour(THEMES.demonstration);
  const sections = new Set(plan.sections.map((section) => section.sectionId));
  const proprietaires = new Map();
  for (const idea of plan.editorialPlan.ideas) {
    assert.ok(sections.has(idea.owner), `propriétaire inconnu pour ${idea.ideaId} : ${idea.owner}`);
    assert.equal(proprietaires.get(idea.ideaId), undefined, `idée en double : ${idea.ideaId}`);
    proprietaires.set(idea.ideaId, idea.owner);
  }
  // Chaque paquet de chaque chapitre référence une idée qu'il possède ou qu'il
  // peut rappeler — aucune idée orpheline ne doit subsister.
  const idsConnus = new Set(plan.editorialPlan.ideas.map((idea) => idea.ideaId));
  for (const chapitrePlan of plan.editorialPlan.chapters) {
    for (const ideaId of [...chapitrePlan.owns, ...chapitrePlan.mayRecall, ...chapitrePlan.reserved]) {
      assert.ok(idsConnus.has(ideaId), `idée non déclarée ${ideaId}`);
    }
  }
});

test("les configurations sont développées par les chapitres de catégorie", () => {
  const plan = planPour(THEMES.demonstration);
  const parConfig = plan.editorialPlan.ideas.filter((idea) => idea.kind === "configuration");
  assert.equal(parConfig.length, 5);
  const tensions = parConfig.filter((idea) => idea.label.includes("opposition"));
  for (const idea of tensions) assert.equal(idea.owner, "internal_tensions", `${idea.label} doit être portée par les tensions`);
  const soutiens = parConfig.filter((idea) => !idea.label.includes("opposition"));
  for (const idea of soutiens) assert.equal(idea.owner, "supporting_resources");
  // « Aspects majeurs » ne possède plus aucune configuration : il ne peut donc
  // plus les redécrire.
  const majeurs = chapitre(plan, "major_aspects");
  assert.equal(majeurs.owns.length, 0);
});

test("les missions des chapitres d'aspects sont distinctes et spécifiques", () => {
  const plan = planPour(THEMES.demonstration);
  const missions = ["general_synthesis", "internal_tensions", "supporting_resources", "major_aspects", "conclusion"].map(
    (sectionId) => chapitre(plan, sectionId).mission
  );
  assert.equal(new Set(missions).size, missions.length, "deux chapitres ne doivent pas partager la même mission");
  for (const mission of missions) assert.ok(mission.length > 40, "une mission ne peut pas être un slogan");
});

test("la mémoire inter-chapitres est cohérente avec l'ordre de lecture", () => {
  const plan = planPour(THEMES.demonstration);
  const ordre = plan.sections.map((section) => section.sectionId);
  for (const chapitrePlan of plan.editorialPlan.chapters) {
    const proprietaire = new Map(plan.editorialPlan.ideas.map((idea) => [idea.ideaId, idea.owner]));
    for (const ideaId of chapitrePlan.mayRecall) {
      assert.ok(
        ordre.indexOf(proprietaire.get(ideaId)) < ordre.indexOf(chapitrePlan.sectionId),
        `${chapitrePlan.sectionId} ne peut pas rappeler une idée qui vient après lui (${ideaId})`
      );
    }
    for (const ideaId of chapitrePlan.reserved) {
      assert.ok(
        ordre.indexOf(proprietaire.get(ideaId)) > ordre.indexOf(chapitrePlan.sectionId),
        `${chapitrePlan.sectionId} réserve une idée qui est déjà passée (${ideaId})`
      );
    }
    // Une idée ne peut pas être à la fois possédée et rappelée/réservée.
    for (const ideaId of [...chapitrePlan.mayRecall, ...chapitrePlan.reserved]) {
      assert.ok(!chapitrePlan.owns.includes(ideaId));
    }
  }
});

test("le chapitre des tensions peut nommer les trois membres de la figure", () => {
  const plan = planPour(THEMES.demonstration);
  const section = plan.sections.find((entry) => entry.sectionId === "internal_tensions");
  const refs = new Set([...section.primaryEvidenceRefs, ...section.secondaryEvidenceRefs]);
  assert.equal(refs.size, 4, "deux oppositions (développées) + les deux appuis de Jupiter (cités)");
  assert.ok(refs.has("aspect.sun.moon.opposition"));
  assert.ok(refs.has("aspect.sun.jupiter.trine"));
  assert.ok(refs.has("aspect.moon.jupiter.sextile"));
  // Et il ne peut PAS citer Mercure–Vénus : ce croisement n'est pas autorisé.
  assert.equal(refs.has("aspect.mercury.venus.sextile"), false);
  assert.ok(section.allowedRelations.length > 0, "le chapitre reçoit ses croisements autorisés");
});

test("le chapitre des ressources peut nommer la tension qu'il nuance", () => {
  const plan = planPour(THEMES.demonstration);
  const section = plan.sections.find((entry) => entry.sectionId === "supporting_resources");
  const refs = new Set([...section.primaryEvidenceRefs, ...section.secondaryEvidenceRefs]);
  assert.ok(refs.has("aspect.sun.moon.opposition"));
  assert.ok(chapitre(plan, "supporting_resources").mayRecall.length > 0);
});

test("le mode « référence » retire le chapitre de la narration sans le supprimer du plan", () => {
  const narratif = planPour(THEMES.demonstration, { aspectChapterMode: "narrative" });
  const reference = planPour(THEMES.demonstration, { aspectChapterMode: "reference" });
  const absent = planPour(THEMES.demonstration, { aspectChapterMode: "absent" });

  const blocsDe = (plan, sectionId) => (plan.sections.find((s) => s.sectionId === sectionId)?.blockPlans ?? []).length;
  assert.ok(blocsDe(narratif, "major_aspects") > 0);
  assert.equal(blocsDe(reference, "major_aspects"), 0, "en mode référence, aucun appel LLM pour ce chapitre");
  assert.equal(reference.sections.some((s) => s.sectionId === "major_aspects"), true, "le chapitre reste dans le plan");
  assert.equal(absent.sections.some((s) => s.sectionId === "major_aspects"), false, "en mode absent, le chapitre disparaît");

  // Reference mode retains facts in the annex and context packets, without a
  // separate paid call whose sole output would be a detached factual reminder.
  assert.equal(blocsDe(narratif, "major_aspects"), 2);
  assert.ok(reference.sections.flatMap((section) => section.blockPlans).every((block) => block.blockId !== "brief_recall"));
});

test("un thème sans figure n'invente ni thèse ni croisement, et le dit", () => {
  const plan = planPour(THEMES.sansFigure);
  assert.equal(plan.editorialPlan.figures.length, 0);
  assert.equal(plan.editorialPlan.relations.length, 0);
  assert.equal(plan.editorialPlan.thesis.figureId, null);
  assert.match(plan.editorialPlan.thesis.statement, /Aucune figure/);
  assert.ok(plan.editorialPlan.gaps.some((gap) => gap.code === "no_calculated_figure"));
});

test("un T-carré est détecté ; sans règle sur ses aspects, il refuse de l'interpréter", () => {
  const plan = planPour(THEMES.tCarre);
  const dur = plan.editorialPlan.figures.find((figure) => figure.mode === "hard");
  assert.ok(dur, "le thème de 1975 doit produire une figure dure");
  // Les huit aspects de ce thème n'ont aucune règle interprétative : la figure
  // est donc détectée mais aucun croisement ne peut être produit. Le moteur le
  // dit au lieu d'inventer une lecture.
  assert.equal(plan.editorialPlan.configurations.length, 0);
  assert.equal(plan.editorialPlan.relations.length, 0);
  assert.ok(
    plan.editorialPlan.gaps.some((gap) => gap.code === "figure_member_without_semantics"),
    "la lacune de règles doit être signalée"
  );
});

test("le plan éditorial est déterministe", () => {
  const premier = planPour(THEMES.demonstration).editorialPlan;
  const second = planPour(THEMES.demonstration).editorialPlan;
  assert.equal(JSON.stringify(premier), JSON.stringify(second));
});

test("chaque section reçoit sa mission et ses listes d'idées, dans le plan comme dans le prompt", () => {
  const plan = planPour(THEMES.demonstration);
  for (const section of plan.sections) {
    assert.ok(section.editorialPlan, `${section.sectionId} doit avoir un contrat éditorial`);
    assert.ok(section.editorialPlan.mission.length > 20);
    for (const entree of [...section.editorialPlan.owns, ...section.editorialPlan.mayRecall, ...section.editorialPlan.reserved]) {
      assert.ok(entree.label && entree.ideaId, "une idée doit être lisible par le rédacteur");
    }
  }
  // La thèse est une phrase factuelle : elle n'est jointe qu'aux sections qui
  // peuvent citer ses preuves. Sinon le rédacteur était invité à écrire un fait
  // que son bloc ne déclare pas (undeclared_text_fact), sans pouvoir le corriger.
  const avecThese = plan.sections.filter((section) => section.editorialThesis?.statement);
  assert.ok(avecThese.length > 0, "au moins le propriétaire de la thèse la reçoit");
  assert.ok(plan.sections.some((section) => section.ownsThesis));
  for (const section of avecThese) {
    const declarees = new Set(section.evidencePackets.flatMap((packet) => packet.evidenceRefs ?? []));
    assert.ok(
      plan.editorialPlan.thesis.evidenceRefs.every((ref) => declarees.has(ref)),
      `${section.sectionId} reçoit une thèse dont il ne peut pas citer tous les faits`
    );
  }
});
