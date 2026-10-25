import assert from "node:assert/strict";
import test from "node:test";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { validateStructuredSection } from "../src/deliverables/factualClaimsValidator.mjs";
import { interpretationRuleById, ruleMatchesEvidence, rulesForEvidence, INTERPRETATION_LIBRARY_VERSION } from "../src/deliverables/interpretationRules.mjs";

// Synthetic proof fixtures; no customer's identity or birth coordinates.
const stable = { stableAcrossApplicableWindow: true };
const cases = [
  { id: "western.angle.ascendant.sign.cancer@1", type: "ANGLE_SIGN", value: { angle: "ascendant", sign: "Cancer" }, text: "Votre Ascendant est en Cancer.", bad: "Votre Ascendant est en Lion." },
  { id: "western.body.moon.house.3@1", type: "NATAL_BODY_HOUSE", value: { body: "Moon", house: 3, houseSystem: "WHOLE_SIGN" }, text: "La Lune est en maison 3.", bad: "La Lune est en maison 8." },
  { id: "western.body.mercury.house.6@1", type: "NATAL_BODY_HOUSE", value: { body: "Mercury", house: 6, houseSystem: "WHOLE_SIGN" }, text: "Mercure est en maison 6.", bad: "Mercure est en maison 8." },
  { id: "western.body.saturn.house.6@1", type: "NATAL_BODY_HOUSE", value: { body: "Saturn", house: 6, houseSystem: "WHOLE_SIGN" }, text: "Saturne est en maison 6.", bad: "Saturne est en maison 8." },
  { id: "western.body.jupiter.house.8@1", type: "NATAL_BODY_HOUSE", value: { body: "Jupiter", house: 8, houseSystem: "WHOLE_SIGN" }, text: "Jupiter est en maison 8.", bad: "Jupiter est en maison 6." }
];
const evidenceFor = (item, extra = {}) => ({ evidenceId: `test.${item.id}`, type: item.type, value: { ...item.value }, certainty: { ...stable }, ...extra });

function closedPlan(item, proof) {
  const claim = item.type === "ANGLE_SIGN"
    ? { type: "ANGLE_SIGN", angle: item.value.angle, sign: item.value.sign }
    : { type: "NATAL_BODY_HOUSE", ...item.value };
  return {
    sectionId: "test_context", primaryEvidenceRefs: [proof.evidenceId], secondaryEvidenceRefs: [], forbiddenEvidenceRefs: [], alreadyInterpretedEvidenceRefs: [],
    allowedInterpretationRuleRefs: [item.id],
    evidencePackets: [{ packetId: "test.packet", evidenceRefs: [proof.evidenceId], interpretationRuleRefs: [item.id], interpretationDepth: "primary", claims: [{ claimId: "test.claim", ...claim, evidenceRefs: [proof.evidenceId] }] }],
    blockPlans: [{ blockId: "test.block", packetRefs: ["test.packet"] }]
  };
}

for (const item of cases) {
  test(`targeted natal context: ${item.id} is explicit, stable and narrowly matched`, () => {
    const rule = interpretationRuleById(item.id);
    const proof = evidenceFor(item);
    assert.ok(rule);
    assert.equal(rule.nature, "LASTRO_RULE");
    assert.equal(rule.conventionId, "lastro.natal.angle-house-context@1");
    assert.equal(rule.requiresStableEvidence, true);
    assert.equal(ruleMatchesEvidence(rule, proof), true);
    assert.ok(rulesForEvidence(proof).some((entry) => entry.ruleId === item.id));
    assert.ok(rule.semantics.concepts.length >= 3);
    assert.ok(rule.semantics.relation.length > 0);
    assert.ok(rule.forbidden.includes("prédiction"));
    assert.ok(rule.forbidden.includes("diagnostic psychologique"));
    const saved = structuredClone(proof);
    const sectionPlan = closedPlan(item, proof);
    const dossierEvidence = { referenceTimeZone: "Europe/Paris", evidence: [proof] };
    const validate = (text) => validateStructuredSection({ dossierEvidence, sectionPlan, section: { sectionId: sectionPlan.sectionId, blocks: [{ blockId: "test.block", text }] } });
    assert.equal(validate(item.text).ok, true, JSON.stringify(validate(item.text).issues));
    assert.ok(validate(item.bad).issues.some((issue) => issue.code === "undeclared_text_fact"), JSON.stringify(validate(item.bad).issues));
    assert.deepEqual(proof, saved);
  });
  for (const certainty of [undefined, {}, { stableAcrossApplicableWindow: null }, { stableAcrossApplicableWindow: false }]) {
    test(`targeted natal context: ${item.id} gets no licence without affirmative stability (${JSON.stringify(certainty)})`, () => {
      const proof = evidenceFor(item, { certainty });
      assert.equal(ruleMatchesEvidence(interpretationRuleById(item.id), proof), false);
      assert.equal(rulesForEvidence(proof).some((rule) => rule.ruleId === item.id), false);
    });
  }
}

test("targeted natal context: no generic angle/sign or house matrix is introduced", () => {
  for (const value of [{ angle: "ascendant", sign: "Leo" }, { angle: "descendant", sign: "Cancer" }, { angle: "midheaven", sign: "Cancer" }]) {
    assert.equal(ruleMatchesEvidence(interpretationRuleById(cases[0].id), { type: "ANGLE_SIGN", value, certainty: stable }), false);
  }
  for (const item of cases.slice(1)) {
    for (const value of [{ ...item.value, body: "Venus" }, { ...item.value, house: 2 }, { ...item.value, houseSystem: "PLACIDUS" }, { ...item.value, houseSystem: undefined }]) {
      assert.equal(ruleMatchesEvidence(interpretationRuleById(item.id), { type: item.type, value, certainty: stable }), false, JSON.stringify(value));
    }
  }
  assert.equal(rulesForEvidence({ type: "NATAL_BODY_HOUSE", value: { body: "Mercury", house: 3, houseSystem: "WHOLE_SIGN" }, certainty: stable }).length, 0);
});

test("targeted natal context: the exact new rule set is documented under library 0.5", () => {
  assert.equal(INTERPRETATION_LIBRARY_VERSION, "lastro-interpretation-library@0.5.0");
  for (const item of cases) {
    const sources = interpretationRuleById(item.id).sourceRefs;
    assert.ok(sources.includes("docs/doctrine/natal-angle-house-context-v1.md"));
    assert.ok(sources.some((ref) => ref.startsWith("public/guides/")));
  }
});

test("targeted natal context: unknown birth time supplies neither angle nor house licences", () => {
  const calculation = calculateWesternNatalChart({ birthDate: "1990-01-15", timePrecision: "unknown", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", placeName: "Paris", country: "France" });
  const dossierEvidence = buildDossierEvidence({ natalResult: calculation.result, generatedAt: "2026-10-25T12:00:00.000Z" });
  assert.equal(dossierEvidence.evidence.some((proof) => proof.type === "ANGLE_SIGN" || proof.type === "NATAL_BODY_HOUSE"), false);
  assert.equal(dossierEvidence.evidence.flatMap((proof) => rulesForEvidence(proof)).some((rule) => cases.some((item) => item.id === rule.ruleId)), false);
});
