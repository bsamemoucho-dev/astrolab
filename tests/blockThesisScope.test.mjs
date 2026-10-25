import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { validateStructuredSection } from "../src/deliverables/factualClaimsValidator.mjs";
import {
  buildStructuredUserPrompt,
  scopedSectionPlanForBlock,
  writeStructuredSectionWithLlm
} from "../src/deliverables/structuredSectionWriter.mjs";

// Fictional chart: a section owns the complete figure while its primary and
// recall blocks each receive only part of that figure. No client input or API.
function fixture(birthDate = "1979-03-14") {
  const calculation = calculateWesternNatalChart({
    personId: "block_scope_fixture",
    coordinateSource: "test_fixture",
    coordinateConfidence: "verified_fixture",
    birthDate,
    timePrecision: "exact",
    timeValue: "12:00",
    latitude: 48.8566,
    longitude: 2.3522,
    timeZone: "Europe/Paris"
  }, { calculatedAt: "2026-10-18T00:00:00.000Z", runId: "block_scope_fixture" });
  const evidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
  return { evidence, plan: buildFullDossierPlan(evidence, { aspectChapterMode: "reference" }) };
}

const sectionById = (plan, id) => plan.sections.find((section) => section.sectionId === id);
const scopedRefs = (scoped) => new Set(scoped.evidencePackets.flatMap((packet) => packet.evidenceRefs));
const promptThesis = (scoped) => JSON.parse(buildStructuredUserPrompt({ sectionPlan: scoped })).editorial?.thesis ?? null;

function validateText(evidence, scoped, text) {
  return validateStructuredSection({
    dossierEvidence: evidence,
    sectionPlan: scoped,
    section: {
      sectionId: scoped.sectionId,
      blocks: [{ blockId: scoped.blockPlans[0].blockId, text }]
    }
  });
}

test("a chapter-level thesis never leaks into its partial primary or recall block", () => {
  const { plan } = fixture();
  const section = sectionById(plan, "supporting_resources");
  assert.ok(section.editorialThesis, "the section itself declares all figure facts");
  assert.deepEqual(section.blockPlans.map((block) => block.blockId), ["block1", "brief_recall"]);
  const before = JSON.stringify(section);
  for (const block of section.blockPlans) {
    const scoped = scopedSectionPlanForBlock(section, block);
    const refs = scopedRefs(scoped);
    assert.ok(section.editorialThesis.evidenceRefs.some((ref) => !refs.has(ref)), "regression fixture must remain partially scoped");
    assert.equal(scoped.editorialThesis, null);
    assert.equal(promptThesis(scoped), null);
    assert.deepEqual(scoped.evidencePackets.map((packet) => packet.packetId), block.packetRefs);
  }
  assert.equal(JSON.stringify(section), before, "scoping must not mutate chapter permissions or thesis");
});

for (const id of ["general_synthesis", "conclusion"]) {
  test(`${id}: a complete licensed composition keeps its factual thesis`, () => {
    const { evidence, plan } = fixture();
    const section = sectionById(plan, id);
    assert.equal(section.blockPlans.length, 1);
    const scoped = scopedSectionPlanForBlock(section, section.blockPlans[0]);
    assert.ok(section.editorialThesis.evidenceRefs.every((ref) => scopedRefs(scoped).has(ref)));
    assert.equal(scoped.editorialThesis, section.editorialThesis);
    assert.equal(promptThesis(scoped), section.editorialThesis.statement);
    const result = validateText(evidence, scoped, section.editorialThesis.statement);
    assert.equal(result.ok, true, JSON.stringify(result.issues));
  });
}

test("block filtering preserves the blocking refusal of a true but out-of-scope fact", () => {
  const { evidence, plan } = fixture();
  const section = sectionById(plan, "supporting_resources");
  const scoped = scopedSectionPlanForBlock(section, section.blockPlans[0]);
  assert.ok(evidence.evidence.some((item) => item.evidenceId === "aspect.sun.moon.opposition"));
  assert.equal(scopedRefs(scoped).has("aspect.sun.moon.opposition"), false);
  const result = validateText(evidence, scoped, "Le Soleil forme une opposition avec la Lune.");
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});

test("production block writer receives only scoped thesis context without extra calls", async () => {
  const { evidence, plan } = fixture();
  const section = sectionById(plan, "supporting_resources");
  const seen = [];
  const result = await writeStructuredSectionWithLlm({
    dossierEvidence: evidence,
    sectionPlan: section,
    options: { structuredWriterFn: async ({ sectionPlan }) => {
      seen.push({ blockId: sectionPlan.blockPlans[0].blockId, thesis: promptThesis(sectionPlan) });
      return {
        sectionId: sectionPlan.sectionId,
        blocks: [{ blockId: sectionPlan.blockPlans[0].blockId, text: "Ce repère ouvre une lecture symbolique sans certitude sur votre histoire." }]
      };
    } }
  });
  assert.equal(result.validation.ok, true);
  assert.equal(seen.length, section.blockPlans.length, "no repair or external reviewer should be necessary");
  assert.ok(seen.every(({ thesis }) => thesis === null));
});

for (const birthDate of ["1979-03-14", "1980-01-10", "1990-01-01"]) {
  test(`closed factual thesis scope holds for every block of fictional chart ${birthDate}`, () => {
    const { plan } = fixture(birthDate);
    for (const section of plan.sections) {
      for (const block of section.blockPlans) {
        const scoped = scopedSectionPlanForBlock(section, block);
        if (!scoped.editorialThesis) continue;
        assert.ok(scoped.editorialThesis.evidenceRefs.every((ref) => scopedRefs(scoped).has(ref)), `${section.sectionId}/${block.blockId}`);
      }
    }
  });
}

function simpleAspectValidation(text, values) {
  const evidence = values.map(([bodyA, bodyB, aspectType], index) => ({ evidenceId: `aspect.fixture.${index}`, type: "NATAL_ASPECT", value: { bodyA, bodyB, aspectType } }));
  const refs = evidence.map((item) => item.evidenceId);
  const sectionPlan = { sectionId: "fixture", primaryEvidenceRefs: refs, secondaryEvidenceRefs: [], allowedInterpretationRuleRefs: [], evidencePackets: [{ packetId: "fixture", evidenceRefs: refs, interpretationRuleRefs: [], claims: [], interpretationDepth: "primary" }], blockPlans: [{ blockId: "fixture", packetRefs: ["fixture"] }] };
  return validateText({ evidence }, sectionPlan, text);
}

const aspectWords = [["conjunction", "conjonction"], ["opposition", "opposition"], ["square", "carré"], ["trine", "trigone"], ["sextile", "sextile"]];
for (const [index, [type, word]] of aspectWords.entries()) {
  const [secondType, secondWord] = aspectWords[(index + 1) % aspectWords.length];
  const [thirdType, thirdWord] = aspectWords[(index + 2) % aspectWords.length];
  test(`${type}: three coordinated aspects keep their explicit subject, including March and Mars`, () => {
    const text = `Le 9 mars 2027, Jupiter est en ${word} avec le Soleil, en ${secondWord} avec la Lune et en ${thirdWord} avec Mars.`;
    const proofs = [["Jupiter", "Sun", type], ["Jupiter", "Moon", secondType], ["Jupiter", "Mars", thirdType]];
    assert.equal(simpleAspectValidation(text, proofs).ok, true);
    // The last real planetary fact must still be detected, not merely ignored.
    const partial = simpleAspectValidation(text, proofs.slice(0, 2));
    assert.equal(partial.ok, false);
    assert.ok(partial.issues.some((issue) => issue.code === "undeclared_text_fact" && issue.fact?.aspectType === thirdType && [issue.fact.bodyA, issue.fact.bodyB].includes("Mars")));
  });
}

test("repeated and reversed explicit subjects are distinct from coordinated implicit subjects", () => {
  for (const text of [
    "Jupiter est en trigone avec le Soleil et en sextile avec la Lune.",
    "Le Soleil forme un trigone avec Jupiter et la Lune forme un sextile avec Jupiter.",
    "Jupiter est en sextile avec la Lune, puis en trigone avec le Soleil."
  ]) {
    const proofs = [["Sun", "Jupiter", "trine"], ["Moon", "Jupiter", "sextile"]];
    assert.equal(simpleAspectValidation(text, proofs).ok, true, text);
    assert.equal(simpleAspectValidation(text, proofs.slice(0, 1)).ok, false, text);
  }
});

test("an explicit relative clause can change the subject after an aspect object", () => {
  const text = "Jupiter est en trigone avec le Soleil, qui est en sextile avec la Lune.";
  assert.equal(simpleAspectValidation(text, [["Jupiter", "Sun", "trine"], ["Sun", "Moon", "sextile"]]).ok, true);
  assert.equal(simpleAspectValidation(text, [["Jupiter", "Sun", "trine"], ["Jupiter", "Moon", "sextile"]]).ok, false);
});

test("an unresolved subject never becomes the previous object across a sentence", () => {
  const text = "Un trigone avec le Soleil ouvre une piste. Un sextile avec la Lune ouvre une autre piste.";
  assert.equal(simpleAspectValidation(text, []).ok, true, "no pair is asserted when neither aspect has a named subject");
});

function mixedPacketValidation({ primaryIsReused = false, allReference = false, suppliedPrimaryRefs = ["house"] } = {}) {
  const evidence = [
    { evidenceId: "transit", type: "PERSONAL_TRANSIT", value: { transitBody: "Jupiter", natalPoint: "Moon", aspectType: "trine" } },
    { evidenceId: "house", type: "NATAL_BODY_HOUSE", value: { body: "Moon", house: 7, houseSystem: "WHOLE_SIGN" } }
  ];
  const sectionPlan = {
    sectionId: "fixture", primaryEvidenceRefs: ["transit"], secondaryEvidenceRefs: ["house"],
    alreadyInterpretedEvidenceRefs: primaryIsReused ? ["house", "transit"] : ["house"],
    allowedInterpretationRuleRefs: [],
    evidencePackets: [
      { packetId: "transit", evidenceRefs: ["transit"], interpretationRuleRefs: [], claims: [], interpretationDepth: allReference ? "reference" : "primary" },
      { packetId: "house", evidenceRefs: ["house"], interpretationRuleRefs: [], claims: [], interpretationDepth: "reference", sourceRole: "transit_natal_house_context" }
    ],
    blockPlans: [{ blockId: "fixture", packetRefs: ["transit", "house"] }]
  };
  return validateStructuredSection({ dossierEvidence: { evidence }, sectionPlan, section: { sectionId: "fixture", blocks: [{ blockId: "fixture", text: "Ce repère reste symbolique.", primaryEvidenceRefs: suppliedPrimaryRefs }] } });
}

test("a factual reference packet never demotes an independent primary transit proof", () => {
  assert.equal(mixedPacketValidation().ok, true, "house remains a permitted reference, not a primary reinterpretation");
  const reused = mixedPacketValidation({ primaryIsReused: true, suppliedPrimaryRefs: [] });
  assert.equal(reused.ok, false);
  assert.ok(reused.issues.some((issue) => issue.code === "evidence_reuse_as_primary" && issue.evidenceRef === "transit"));
});

test("pure reference packets stay references despite model-supplied primary metadata", () => {
  const result = mixedPacketValidation({ primaryIsReused: true, allReference: true, suppliedPrimaryRefs: ["transit", "house"] });
  assert.equal(result.ok, true);
});

test("model-supplied primary proof metadata cannot override the legacy no-packet path", () => {
  const result = validateStructuredSection({
    dossierEvidence: { evidence: [{ evidenceId: "house", type: "NATAL_BODY_HOUSE", value: { body: "Moon", house: 7 } }] },
    sectionPlan: { sectionId: "fixture", primaryEvidenceRefs: ["house"], alreadyInterpretedEvidenceRefs: ["house"], allowedInterpretationRuleRefs: [], blockPlans: [] },
    section: { sectionId: "fixture", blocks: [{ blockId: "fixture", text: "Un repère symbolique.", evidenceRefs: ["house"], interpretationDepth: "primary", primaryEvidenceRefs: [] }] }
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "evidence_reuse_as_primary"));
});

test("partial blocks cannot recover the out-of-scope figure through relations or idea labels", () => {
  const { plan } = fixture();
  const section = sectionById(plan, "supporting_resources");
  assert.ok(section.allowedRelations.some((relation) => relation.articulation.includes("oppose")), "fixture must contain a factual relation articulation");
  assert.ok(section.editorialPlan.mayRecall.some((idea) => idea.label === "Sun Pisces"));
  const scoped = scopedSectionPlanForBlock(section, section.blockPlans[0]);
  const payload = JSON.parse(buildStructuredUserPrompt({ sectionPlan: scoped }));
  assert.equal(payload.editorial.thesis, null);
  assert.deepEqual(payload.editorial.relationsAllowed, []);
  assert.ok(!payload.editorial.mayRecall.some((idea) => idea.label === "Sun Pisces"));
  assert.equal(payload.editorial.mission, section.editorialPlan.mission);
  assert.equal(payload.editorial.owns.length, section.editorialPlan.owns.length, "ownership survives while unsupported labels are withheld");
  assert.ok(payload.editorial.owns.some((idea) => idea.label === "Sun–Jupiter trine"));
});

test("figure hypotheses and their isolation context do not leak into a separate recall block", () => {
  const { plan } = fixture();
  const section = sectionById(plan, "internal_tensions");
  assert.ok(section.readingHypotheses.length > 0);
  const partial = { ...section, blockPlans: [{ blockId: "partial", packetRefs: [section.evidencePackets[0].packetId] }] };
  const scoped = scopedSectionPlanForBlock(partial, partial.blockPlans[0]);
  assert.deepEqual(scoped.readingHypotheses, []);
  assert.deepEqual(scoped.editorialPlan.isolation, []);
  assert.deepEqual(JSON.parse(buildStructuredUserPrompt({ sectionPlan: scoped })).editorial.hypotheses, []);
  const completeBlock = section.blockPlans.find((block) => block.blockId === "figure_exploration");
  assert.ok(completeBlock);
  const complete = scopedSectionPlanForBlock(section, completeBlock);
  assert.equal(complete.readingHypotheses.length, section.readingHypotheses.length);
});

test("conclusion recaps remain available only to a complete composition context", () => {
  const { plan } = fixture();
  const section = { ...sectionById(plan, "conclusion"), validatedChapterRecaps: [{ sectionId: "relationships", text: "Un apport concret déjà validé." }] };
  const complete = scopedSectionPlanForBlock(section, section.blockPlans[0]);
  assert.deepEqual(complete.validatedChapterRecaps, section.validatedChapterRecaps);
  const partialBlock = { blockId: "partial", packetRefs: [section.evidencePackets[0].packetId] };
  const partial = scopedSectionPlanForBlock(section, partialBlock);
  assert.deepEqual(partial.validatedChapterRecaps, []);
});
