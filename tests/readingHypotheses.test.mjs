// Hypothèses de lecture : plusieurs lectures d'UNE MÊME figure, licenciées par
// la géométrie, jamais étendues à une configuration non reliée.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { validateStructuredSection } from "../src/deliverables/factualClaimsValidator.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { buildReadingHypotheses, lengthForHypotheses } from "../src/deliverables/readingHypotheses.mjs";
import { composeEditorialMaterial } from "../src/deliverables/editorialComposition.mjs";
import { rulesForEvidence } from "../src/deliverables/interpretationRules.mjs";
import { buildStructuredSystemPrompt, buildStructuredUserPrompt, scopedSectionPlanForBlock } from "../src/deliverables/structuredSectionWriter.mjs";

const THEMES = {
  demonstration: { birthDate: "1979-03-14", timePrecision: "approximate", timeValue: "09:00", timeMarginMinutes: 30, latitude: 45.764, longitude: 4.8357, timeZone: "Europe/Paris", birthPlace: "Lyon, France", placeName: "Lyon, France" },
  tCarre: { birthDate: "1975-09-08", timePrecision: "exact", timeValue: "10:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", birthPlace: "Paris, France", placeName: "Paris, France" },
  grandTrine: { birthDate: "1974-03-11", timePrecision: "exact", timeValue: "10:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", birthPlace: "Paris, France", placeName: "Paris, France" },
  sansFigure: { birthDate: "1970-06-21", timePrecision: "exact", timeValue: "10:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", birthPlace: "Paris, France", placeName: "Paris, France" }
};

function dossier(theme) {
  const calculation = calculateWesternNatalChart(
    { personId: "hypotheses", coordinateSource: "test_fixture", coordinateConfidence: "verified_fixture", ...theme },
    { calculatedAt: "2026-10-18T00:00:00.000Z", runId: "calc_hypotheses" }
  );
  return buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
}

function hypothesesPour(theme) {
  const dossierEvidence = dossier(theme);
  const material = composeEditorialMaterial({ dossierEvidence, rulesForEvidence });
  return buildReadingHypotheses({ figures: material.figures, configurations: material.configurations });
}

test("la figure de démonstration donne deux lectures concurrentes, licenciées", () => {
  const { hypotheses } = hypothesesPour(THEMES.demonstration);
  assert.equal(hypotheses.length, 2);
  const [dialogue, amplification] = hypotheses;
  assert.equal(dialogue.kind, "dialogue");
  assert.equal(amplification.kind, "amplification");
  // Chaque lecture cite les faits calculés qui la fondent, avec leurs orbes.
  for (const hypothese of hypotheses) {
    assert.ok(hypothese.licence.computedFacts.length >= 3);
    assert.ok(hypothese.licence.computedFacts.some((fait) => /orbe/.test(fait)));
    assert.ok(hypothese.discriminator.length > 10, "une lecture sans discriminant ne serait qu'une variante de style");
    assert.ok(hypothese.questions.length >= 1, "une lecture doit laisser une question au lecteur");
    assert.ok(hypothese.limits.some((limite) => /hypothèse de lecture/i.test(limite)));
  }
  // Le discriminant de la seconde lecture est une MESURE, pas une nuance.
  assert.match(amplification.discriminator, /écart d'orbe/);
  assert.ok(amplification.licence.computedFacts.some((fait) => /asymétrie mesurée/.test(fait)));
});

test("sans asymétrie mesurée, le moteur ne fabrique pas une seconde lecture", () => {
  const figure = {
    figureId: "figure.apex.test",
    type: "apex_on_opposition",
    conventionId: "lastro.figure.apex_on_opposition@1",
    mode: "harmonic",
    bodies: { opposition: ["Sun", "Moon"], apex: "Jupiter" },
    members: [
      { aspectId: "aspect.sun.moon.opposition", bodyA: "Sun", bodyB: "Moon", aspectType: "opposition", category: "tension", orb: 5, orbLimit: 10 },
      { aspectId: "aspect.sun.jupiter.trine", bodyA: "Sun", bodyB: "Jupiter", aspectType: "trine", category: "support", orb: 4, orbLimit: 8 },
      { aspectId: "aspect.moon.jupiter.sextile", bodyA: "Moon", bodyB: "Jupiter", aspectType: "sextile", category: "support", orb: 4.5, orbLimit: 6 }
    ],
    apexAspects: { toA: "trine", toB: "sextile" },
    tightestMemberId: "aspect.sun.jupiter.trine",
    proof: "le Soleil oppose la Lune ; Jupiter est en trigone avec le Soleil et en sextile avec la Lune"
  };
  const { hypotheses, singleReadingFigures } = buildReadingHypotheses({ figures: [figure], configurations: [] });
  assert.equal(hypotheses.length, 1, "sans écart d'orbe suffisant, une seule lecture");
  assert.equal(hypotheses[0].kind, "dialogue");
  assert.deepEqual(singleReadingFigures, ["figure.apex.test"]);
});

test("un T-carré produit deux lectures de la même pression", () => {
  const { hypotheses } = hypothesesPour(THEMES.tCarre);
  const dures = hypotheses.filter((hypothese) => ["pressure", "rigidification"].includes(hypothese.kind));
  assert.equal(dures.length, 2);
  assert.match(dures[0].discriminator, /tensions/);
});

test("un grand trigone ne produit qu'une lecture, et dit ce qu'elle ne dit pas", () => {
  const { hypotheses } = hypothesesPour(THEMES.grandTrine);
  const circulation = hypotheses.find((hypothese) => hypothese.kind === "circulation");
  assert.ok(circulation, "la figure doit être lue");
  assert.ok(circulation.limits.some((limite) => /aucune tension/i.test(limite)));
});

test("sans figure, aucune hypothèse n'est inventée", () => {
  const { hypotheses } = hypothesesPour(THEMES.sansFigure);
  assert.deepEqual(hypotheses, []);
});

test("les hypothèses n'appartiennent qu'au chapitre qui possède la figure", () => {
  const plan = buildFullDossierPlan(dossier(THEMES.demonstration), { aspectChapterMode: "reference" });
  const tensions = plan.sections.find((section) => section.sectionId === "internal_tensions");
  const ressources = plan.sections.find((section) => section.sectionId === "supporting_resources");
  const synthese = plan.sections.find((section) => section.sectionId === "general_synthesis");
  assert.equal(tensions.readingHypotheses.length, 2);
  assert.equal(ressources.readingHypotheses.length, 0);
  assert.equal(synthese.readingHypotheses.length, 0);
});

test("la longueur suit la matière : deux hypothèses, pas un quota de chapitre", () => {
  const plan = buildFullDossierPlan(dossier(THEMES.demonstration), { aspectChapterMode: "reference" });
  const tensions = plan.sections.find((section) => section.sectionId === "internal_tensions");
  assert.equal(tensions.targetWords, 200);
  assert.equal(tensions.maxWords, 320);
  assert.equal(tensions.targetWords, lengthForHypotheses(2).targetWords);
  // Le budget d'un chapitre sans hypothèse ne bouge pas.
  const ressources = plan.sections.find((section) => section.sectionId === "supporting_resources");
  assert.equal(ressources.targetWords, 340);
});

test("le chapitre n'ouvre plus sur la récitation des positions", () => {
  const plan = buildFullDossierPlan(dossier(THEMES.demonstration), { aspectChapterMode: "reference" });
  const tensions = plan.sections.find((section) => section.sectionId === "internal_tensions");
  for (const blockPlan of tensions.blockPlans) {
    assert.equal(blockPlan.deterministicPrefix, undefined, "aucun préfixe factuel dans un chapitre d'exploration");
  }
});

test("le prompt porte les deux lectures, leurs licences et l'interdit d'extension", () => {
  const plan = buildFullDossierPlan(dossier(THEMES.demonstration), { aspectChapterMode: "reference" });
  const section = plan.sections.find((entree) => entree.sectionId === "internal_tensions");
  const scoped = scopedSectionPlanForBlock(section, section.blockPlans[0]);
  const payload = JSON.parse(buildStructuredUserPrompt({ sectionPlan: scoped }));
  assert.equal(payload.editorial.hypotheses.length, 2);
  for (const hypothese of payload.editorial.hypotheses) {
    assert.ok(hypothese.computedFacts.length >= 3);
    assert.ok(hypothese.discriminator);
  }
  const systeme = buildStructuredSystemPrompt(scoped, { blockCount: section.blockPlans.length, blockPlan: section.blockPlans[0] });
  assert.match(systeme, /expose au moins deux lectures possibles/i);
  assert.match(systeme, /Interdit explicite/i);
  assert.match(systeme, /n'annonce pas les positions planétaires/i);
});

test("l'interdit est appliqué : une compensation non reliée reste refusée", () => {
  const dossierEvidence = dossier(THEMES.demonstration);
  const plan = buildFullDossierPlan(dossierEvidence, { aspectChapterMode: "reference" });
  const sectionPlan = plan.sections.find((section) => section.sectionId === "internal_tensions");
  const blocks = sectionPlan.blockPlans.map((blockPlan, index) => ({
    blockId: blockPlan.blockId,
    text:
      index === 0
        ? "Mars forme une opposition avec Saturne, et Jupiter forme un trigone avec le Soleil : ces deux aspects se compensent."
        : "Cette partie reste brève."
  }));
  const resultat = validateStructuredSection({
    dossierEvidence,
    sectionPlan,
    section: { sectionId: "internal_tensions", contractVersion: "structured-section-writer@0.1.0", blocks }
  });
  const issue = resultat.issues.find((entree) => entree.code === "crossed_claim_not_licensed");
  assert.ok(issue, "aucune compensation Jupiter → Mars–Saturne ne doit passer");
  assert.deepEqual(issue.facts.sort(), ["aspect.mars.saturn.opposition", "aspect.sun.jupiter.trine"]);
});
