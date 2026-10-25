import assert from "node:assert/strict";
import test from "node:test";
import { licensedContextNarrativeRole } from "../src/deliverables/licensedContextFocus.mjs";

const cases = [
  ["western.angle.ascendant.sign.cancer@1", "ANGLE_SIGN", { angle: "ascendant", sign: "Cancer" }, "Ascendant en Cancer"],
  ["western.body.moon.house.3@1", "NATAL_BODY_HOUSE", { body: "Moon", house: 3, houseSystem: "WHOLE_SIGN" }, "maison 3"],
  ["western.body.mercury.house.6@1", "NATAL_BODY_HOUSE", { body: "Mercury", house: 6, houseSystem: "WHOLE_SIGN" }, "Mercure en maison 6"],
  ["western.body.saturn.house.6@1", "NATAL_BODY_HOUSE", { body: "Saturn", house: 6, houseSystem: "WHOLE_SIGN" }, "Saturne en maison 6"],
  ["western.body.jupiter.house.8@1", "NATAL_BODY_HOUSE", { body: "Jupiter", house: 8, houseSystem: "WHOLE_SIGN" }, "Jupiter en maison 8"]
];
function fixture([ruleId, type, value] = cases[0]) {
  const proof = { evidenceId: "test.proof", type, value: { ...value }, certainty: { stableAcrossApplicableWindow: true } };
  return { blockPlan: { blockId: "test.block", packetRefs: ["test.packet"], narrativeRole: "Mission existante à conserver.", maxQuestions: 0, maxWords: 300 }, evidencePackets: [{ packetId: "test.packet", evidenceRefs: [proof.evidenceId], interpretationRuleRefs: [ruleId], interpretationDepth: "primary" }], byId: new Map([[proof.evidenceId, proof]]) };
}

for (const item of cases) test(`licensed context focus: ${item[0]} adds only its own primary proof`, () => {
  const f = fixture(item), saved = structuredClone(f);
  const role = licensedContextNarrativeRole(f);
  assert.ok(role.startsWith(f.blockPlan.narrativeRole + "\n"));
  assert.ok(role.includes(item[3]));
  assert.doesNotMatch(role, /Soleil|Vénus|Mars/);
  assert.deepEqual(f, saved, "no evidence, rule, length limit or block is changed");
});

for (const variation of ["other_block", "missing_packet", "reference", "composition_reference", "unknown_rule", "other_rule", "missing_proof", "wrong_proof", "missing_stability", "unstable", "deterministic", "calculated_reference"]) {
  test(`licensed context focus: ${variation} cannot promote context into a primary reading`, () => {
    const f = fixture(cases[1]);
    if (variation === "other_block") f.blockPlan.packetRefs = ["another.packet"];
    if (variation === "missing_packet") f.evidencePackets = [];
    if (variation === "reference") f.evidencePackets[0].interpretationDepth = "reference";
    if (variation === "composition_reference") { f.evidencePackets[0].interpretationDepth = "reference";f.evidencePackets[0].sourceRole = "licensed_composition_context"; }
    if (variation === "unknown_rule") f.evidencePackets[0].interpretationRuleRefs = ["unreviewed.rule@1"];
    if (variation === "other_rule") f.evidencePackets[0].interpretationRuleRefs = [cases[2][0]];
    if (variation === "missing_proof") f.byId.clear();
    if (variation === "wrong_proof") f.byId.get("test.proof").value.body = "Mercury";
    if (variation === "missing_stability") delete f.byId.get("test.proof").certainty;
    if (variation === "unstable") f.byId.get("test.proof").certainty.stableAcrossApplicableWindow = false;
    if (variation === "deterministic") f.blockPlan.deterministic = true;
    if (variation === "calculated_reference") f.blockPlan.calculatedReference = true;
    const saved = structuredClone(f);
    assert.equal(licensedContextNarrativeRole(f), f.blockPlan.narrativeRole);
    assert.deepEqual(f, saved);
  });
}

test("licensed context focus: it may guide a block without an existing role, but invents nothing when context is absent", () => {
  const f = fixture();delete f.blockPlan.narrativeRole;
  assert.match(licensedContextNarrativeRole(f), /Ascendant en Cancer/);
  assert.doesNotMatch(licensedContextNarrativeRole(f), /Soleil/);
  assert.equal(licensedContextNarrativeRole(), null);
  assert.equal(licensedContextNarrativeRole({ blockPlan: { narrativeRole: "Rôle intact." } }), "Rôle intact.");
});

test("licensed context focus: repeated packets do not repeat the same reading instruction", () => {
  const f = fixture();
  f.evidencePackets.push({ ...f.evidencePackets[0], packetId: "repeat.packet" });
  f.blockPlan.packetRefs.push("repeat.packet", "test.packet");
  const role = licensedContextNarrativeRole(f);
  assert.equal((role.match(/Ascendant en Cancer/g) ?? []).length, 1);
});

test("licensed context focus: two matching primary contexts remain in their common block only", () => {
  const f = fixture(cases[2]);
  const other = fixture(cases[3]);
  const proof = { ...other.byId.get("test.proof"), evidenceId: "saturn.proof" };
  f.byId.set(proof.evidenceId, proof);
  f.evidencePackets.push({ ...other.evidencePackets[0], packetId: "saturn.packet", evidenceRefs: [proof.evidenceId] });
  f.blockPlan.packetRefs.push("saturn.packet");
  const combined = licensedContextNarrativeRole(f);
  assert.match(combined, /Mercure en maison 6/);assert.match(combined, /Saturne en maison 6/);
  assert.doesNotMatch(combined, /Jupiter|maison 8|maison 3|Ascendant/);
  const split = licensedContextNarrativeRole({ ...f, blockPlan: { ...f.blockPlan, packetRefs: ["test.packet"] } });
  assert.match(split, /Mercure en maison 6/);assert.doesNotMatch(split, /Saturne/);
});
