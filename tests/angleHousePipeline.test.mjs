import assert from "node:assert/strict";
import test from "node:test";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { buildStructuredUserPrompt, scopedSectionPlanForBlock, writeStructuredSectionWithLlm } from "../src/deliverables/structuredSectionWriter.mjs";
import { interpretationRuleById, rulesForEvidence } from "../src/deliverables/interpretationRules.mjs";

// Fictional regression themes: the same public Paris location and 1990 date as
// existing tests, with hours chosen to exercise actual calculated placements.
const INPUT = Object.freeze({ birthDate: "1990-01-15", timePrecision: "exact", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", placeName: "Paris", country: "France" });
const GENERATED = "2026-10-25T12:00:00.000Z";
function fixture(timeValue, extra = {}) {
  const calculation = calculateWesternNatalChart({ ...INPUT, timeValue, ...extra }, { calculatedAt: GENERATED });
  const originalCalculation = structuredClone(calculation.result);
  const evidence = buildDossierEvidence({ natalResult: calculation.result, generatedAt: GENERATED });
  const savedEvidence = structuredClone(evidence);
  const plan = buildFullDossierPlan(evidence, { aspectChapterMode: "reference" });
  assert.deepEqual(calculation.result, originalCalculation, "evidence/planning must not alter a numerical position or astronomical instant");
  assert.deepEqual(evidence, savedEvidence, "planning must not mutate source facts or their stability");
  return { calculation, evidence, plan };
}
const targeted = [
  ["16:30", "identity", "angle.ascendant.sign", "western.angle.ascendant.sign.cancer@1", "Votre Ascendant est en Cancer."],
  ["16:30", "emotional_world", "natal.moon.house", "western.body.moon.house.3@1", "La Lune est en maison 3."],
  ["18:30", "communication", "natal.mercury.house", "western.body.mercury.house.6@1", "Mercure est en maison 6."],
  ["18:30", "work_realization", "natal.saturn.house", "western.body.saturn.house.6@1", "Saturne est en maison 6."],
  ["05:30", "supporting_resources", "natal.jupiter.house", "western.body.jupiter.house.8@1", "Jupiter est en maison 8."]
];

for (const [hour, sectionId, proofId, ruleId, text] of targeted) {
  test(`angle/house pipeline: ${ruleId} reaches its actual calculated closed block and semantics`, async () => {
    const f = fixture(hour);
    const proof = f.evidence.evidence.find((item) => item.evidenceId === proofId);
    assert.ok(proof);
    assert.equal(proof.certainty.stableAcrossApplicableWindow, true);
    assert.ok(rulesForEvidence(proof).some((rule) => rule.ruleId === ruleId));
    const section = f.plan.sections.find((entry) => entry.sectionId === sectionId);
    assert.ok(section.primaryEvidenceRefs.includes(proofId), `${proofId} must not be lost by an aspect-only cap`);
    assert.ok(section.allowedInterpretationRuleRefs.includes(ruleId));
    const packet = section.evidencePackets.find((entry) => entry.evidenceRefs.includes(proofId) && entry.interpretationRuleRefs.includes(ruleId));
    assert.ok(packet);
    const block = section.blockPlans.find((entry) => entry.packetRefs.includes(packet.packetId));
    assert.ok(block);
    const scoped = scopedSectionPlanForBlock(section, block);
    assert.ok(scoped.allowedInterpretationRuleRefs.includes(ruleId));
    const prompt = JSON.parse(buildStructuredUserPrompt({ sectionPlan: scoped }));
    const expectedFocus = {
      "western.angle.ascendant.sign.cancer@1": "Développe l’apport de l’Ascendant en Cancer comme fonction distincte",
      "western.body.moon.house.3@1": "Explique ce que la maison 3 ajoute à la lecture de la Lune",
      "western.body.mercury.house.6@1": "Explique l’apport de Mercure en maison 6 dans l’organisation des tâches quotidiennes",
      "western.body.saturn.house.6@1": "Développe l’apport de Saturne en maison 6 au cadre, aux responsabilités et aux limites du travail quotidien",
      "western.body.jupiter.house.8@1": "Explique l’apport de Jupiter en maison 8 à la mise en commun et aux transformations"
    }[ruleId];
    assert.ok(block.narrativeRole.includes(expectedFocus), "the licensed domain must have an explicit editorial instruction");
    assert.equal(prompt.sectionPlan.blockPlans.find((entry) => entry.blockId === block.blockId).narrativeRole, block.narrativeRole, "the actual closed writer prompt must retain that instruction");
    const material = prompt.sectionPlan.blockPlans.flatMap((entry) => entry.packets).find((entry) => entry.evidenceRefs.includes(proofId));
    assert.ok(material);
    assert.equal(material.canInterpret, true);
    assert.deepEqual(material.semantics, interpretationRuleById(ruleId).semantics);
    const savedCalculation = structuredClone(f.calculation.result), savedEvidence = structuredClone(f.evidence);
    let simulatedCalls = 0;
    const written = await writeStructuredSectionWithLlm({ dossierEvidence: f.evidence, sectionPlan: scoped, options: {
      structuredWriterFn: ({ sectionPlan }) => { simulatedCalls++; return { sectionId: sectionPlan.sectionId, blocks: sectionPlan.blockPlans.map((entry) => ({ blockId: entry.blockId, text })) }; }
    } });
    assert.equal(simulatedCalls, 1);
    assert.equal(written.validation.ok, true);
    assert.ok(written.section.blocks.some((entry) => entry.evidenceRefs.includes(proofId) && entry.interpretationRuleRefs.includes(ruleId)));
    assert.deepEqual(f.calculation.result, savedCalculation);
    assert.deepEqual(f.evidence, savedEvidence);
  });
}

test("angle/house pipeline: a calculated but undecidable approximate Ascendant cannot acquire the Cancer licence", () => {
  const f = fixture("15:30", { timePrecision: "approximate", timeMarginMinutes: 30 });
  const sourceWindow = f.calculation.result.astronomicalCalculation.angles.uncertaintyWindow.ascendant;
  assert.equal(sourceWindow.signStable, false);
  assert.deepEqual(sourceWindow.signsInWindow, ["Gemini", "Cancer"]);
  const proof = f.evidence.evidence.find((item) => item.evidenceId === "angle.ascendant.sign");
  assert.equal(proof.value.sign, "Cancer", "the nominal calculated value must not be altered to hide uncertainty");
  assert.equal(proof.certainty.stableAcrossApplicableWindow, false);
  assert.equal(rulesForEvidence(proof).some((entry) => entry.ruleId === "western.angle.ascendant.sign.cancer@1"), false);
  assert.equal(f.plan.sections.some((section) => section.allowedInterpretationRuleRefs.includes("western.angle.ascendant.sign.cancer@1")), false);
  assert.equal(f.evidence.evidence.some((item) => item.type === "NATAL_BODY_HOUSE"), false);
});

test("angle/house pipeline: stable signs inside an explicit approximate margin retain only their supported licences", () => {
  const f = fixture("16:30", { timePrecision: "approximate", timeMarginMinutes: 15 });
  for (const [proofId, ruleId] of [["angle.ascendant.sign", "western.angle.ascendant.sign.cancer@1"], ["natal.moon.house", "western.body.moon.house.3@1"]]) {
    const proof = f.evidence.evidence.find((item) => item.evidenceId === proofId);
    assert.ok(proof);
    assert.equal(proof.certainty.timePrecision, "approximate");
    assert.equal(proof.certainty.stableAcrossApplicableWindow, true);
    assert.ok(rulesForEvidence(proof).some((entry) => entry.ruleId === ruleId));
  }
});

test("angle/house pipeline: unknown birth time cannot invent an angle, house or new interpretation licence", () => {
  const f = fixture(undefined, { timePrecision: "unknown" });
  assert.equal(f.evidence.evidence.some((item) => item.type === "ANGLE_SIGN" || item.type === "NATAL_BODY_HOUSE"), false);
  assert.equal(f.plan.sections.flatMap((section) => section.allowedInterpretationRuleRefs).some((id) => targeted.some((target) => target[3] === id)), false);
});

test("angle/house pipeline: missing/invalid stability or house system never licenses a real house proof", () => {
  const f = fixture("05:30");
  const real = f.evidence.evidence.find((item) => item.evidenceId === "natal.jupiter.house");
  assert.equal(real.value.house, 8);
  for (const variation of ["missing_certainty", "unknown_certainty", "unstable", "missing_system", "other_system"]) {
    const adversarial = structuredClone(real);
    if (variation === "missing_certainty") delete adversarial.certainty;
    if (variation === "unknown_certainty") adversarial.certainty.stableAcrossApplicableWindow = null;
    if (variation === "unstable") adversarial.certainty.stableAcrossApplicableWindow = false;
    if (variation === "missing_system") delete adversarial.value.houseSystem;
    if (variation === "other_system") adversarial.value.houseSystem = "PLACIDUS";
    assert.equal(rulesForEvidence(adversarial).some((rule) => rule.ruleId === "western.body.jupiter.house.8@1"), false, variation);
  }
  assert.equal(real.certainty.stableAcrossApplicableWindow, true);
  assert.equal(real.value.houseSystem, "WHOLE_SIGN");
});
