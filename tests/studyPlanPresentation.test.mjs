import assert from "node:assert/strict";
import test from "node:test";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { rulesForEvidence } from "../src/deliverables/interpretationRules.mjs";
import { scopedSectionPlanForBlock, writeStructuredSectionWithLlm } from "../src/deliverables/structuredSectionWriter.mjs";

// Deliberately synthetic evidence, without a customer's birth data or identity.
const NOW = "2026-10-25T12:00:00.000Z";
const natal = [
  { evidenceId: "natal.sun.sign", type: "NATAL_BODY_SIGN", value: { body: "Sun", sign: "Capricorn", degreeInSign: 10, longitude: 280 } },
  { evidenceId: "natal.jupiter.sign", type: "NATAL_BODY_SIGN", value: { body: "Jupiter", sign: "Aquarius", degreeInSign: 15, longitude: 315 } },
  { evidenceId: "natal.jupiter.house", type: "NATAL_BODY_HOUSE", value: { body: "Jupiter", house: 8, houseSystem: "WHOLE_SIGN" } }
];
function contact(evidenceId, extra = {}) {
  return { evidenceId, type: "PERSONAL_TRANSIT", value: {
    status: "CURRENT", transitBody: "Neptune", natalPoint: "ASC", aspectType: "square", orb: .25, effectiveOrbLimit: 1.2,
    startsAt: "2026-09-07T00:00:00.000Z", exactAt: "2026-10-14T03:00:00.000Z", endsAt: "2027-03-09T00:00:00.000Z",
    phase: "SEPARATING", reliability: "HIGH", ...extra
  }, provenance: { reliability: "HIGH", methodVersion: "test", ruleVersion: "test" } };
}
function dossier(contacts = [], now = NOW) {
  return { schema: "astrolab.dossier_evidence", referenceTimeZone: "Europe/Paris", evidence: [
    ...structuredClone(natal),
    { evidenceId: "transits.snapshot", type: "TRANSIT_SNAPSHOT", value: { nowUtc: now, horizonDays: 42 } },
    ...contacts
  ] };
}
const productionPlan = (evidence) => buildFullDossierPlan(evidence, { aspectChapterMode: "reference" });
const sectionById = (plan, id) => plan.sections.find((section) => section.sectionId === id);
const packetRefs = (section) => section.evidencePackets.flatMap((packet) => packet.evidenceRefs);

test("the production plan excludes ended recent contacts and preserves both proofs of an equivalent angle square", () => {
  const current = contact("transit.neptune.asc.square");
  const opposite = contact("transit.neptune.dsc.square", { natalPoint: "DSC" });
  const recent = contact("transit.moon.mercury.recent", { status: "RECENT", transitBody: "Moon", natalPoint: "Mercury", startsAt: "2026-10-23T02:00:00.000Z", exactAt: "2026-10-23T05:00:00.000Z", endsAt: "2026-10-23T09:00:00.000Z" });
  const evidence = dossier([opposite, recent, current]);
  const original = structuredClone(evidence);
  const plan = productionPlan(evidence);
  const refs = packetRefs(sectionById(plan, "current_sky"));
  assert.ok(refs.includes(current.evidenceId));
  assert.ok(!refs.includes(opposite.evidenceId));
  assert.ok(plan.sections.every((section) => !packetRefs(section).includes(recent.evidenceId)));
  assert.deepEqual(plan.transitSelectionDiagnostics.current.axisPairs, [{ axis: "ascendant_descendant", retainedEvidenceRef: current.evidenceId, suppressedEvidenceRef: opposite.evidenceId }]);
  assert.ok(plan.transitSelectionDiagnostics.current.diagnostics.some((item) => item.code === "transit_not_current"));
  assert.equal(evidence.evidence.filter((item) => item.type === "PERSONAL_TRANSIT").length, 3);
  assert.deepEqual(evidence, original);
});

test("ongoing and later occurrences of one transit remain in their actual periods and the horizon is enforced", () => {
  const ongoing = contact("transit.mercury.jupiter.current", { transitBody: "Mercury", natalPoint: "Jupiter", startsAt: "2026-10-24T00:00:00.000Z", exactAt: "2026-10-25T13:00:00.000Z", endsAt: "2026-10-26T00:00:00.000Z" });
  const later = contact("transit.mercury.jupiter.upcoming", { ...ongoing.value, status: "UPCOMING", startsAt: "2026-11-01T00:00:00.000Z", exactAt: "2026-11-02T00:00:00.000Z", endsAt: "2026-11-03T00:00:00.000Z" });
  const outside = contact("transit.after.horizon", { status: "UPCOMING", startsAt: "2026-12-06T12:00:00.001Z", exactAt: "2026-12-07T12:00:00.000Z", endsAt: "2026-12-08T12:00:00.000Z" });
  const plan = productionPlan(dossier([ongoing, later, outside]));
  assert.ok(packetRefs(sectionById(plan, "current_sky")).includes(ongoing.evidenceId));
  assert.ok(packetRefs(sectionById(plan, "next_weeks")).includes(later.evidenceId));
  assert.ok(plan.sections.every((section) => !packetRefs(section).includes(outside.evidenceId)));
  assert.equal(plan.ownerByEvidenceRef[ongoing.evidenceId], "current_sky");
  assert.equal(plan.ownerByEvidenceRef[later.evidenceId], "next_weeks");
});

test("a calculated slow transit without an interpretation rule remains an explicit factual reference", () => {
  const slow = contact("transit.uranus.saturn.opposition", { transitBody: "Uranus", natalPoint: "Saturn", aspectType: "opposition", startsAt: "2026-07-14T00:00:00.000Z", exactAt: "2026-08-12T00:00:00.000Z", endsAt: "2026-11-10T00:00:00.000Z" });
  assert.deepEqual(rulesForEvidence(slow), []);
  const plan = productionPlan(dossier([slow]));
  const section = sectionById(plan, "current_sky");
  const packet = section.evidencePackets.find((item) => item.evidenceRefs.includes(slow.evidenceId));
  assert.ok(packet);
  assert.deepEqual(packet.interpretationRuleRefs, []);
  assert.ok(section.uninterpretedEvidenceRefs.includes(slow.evidenceId));
  assert.ok(section.primaryEvidenceRefs.includes(slow.evidenceId));
});

test("Jupiter's authorized sign is owned and usable without manufacturing a house-eight interpretation or orphan recap", () => {
  const evidence = dossier();
  const original = structuredClone(evidence);
  const plan = productionPlan(evidence);
  const resources = sectionById(plan, "supporting_resources");
  assert.ok(resources.primaryEvidenceRefs.includes("natal.jupiter.sign"));
  const packet = resources.evidencePackets.find((item) => item.evidenceRefs.includes("natal.jupiter.sign"));
  assert.ok(packet.interpretationRuleRefs.length > 0);
  assert.ok(packet.interpretationRuleRefs.every((rule) => rule.includes("jupiter.sign.aquarius")));
  assert.deepEqual(rulesForEvidence(evidence.evidence.find((item) => item.evidenceId === "natal.jupiter.house")), []);
  assert.ok(plan.sections.every((section) => section.blockPlans.every((block) => block.blockId !== "brief_recall")));
  assert.deepEqual(evidence, original);
});

for (const [name, now, startsAt, exactAt, endsAt, expected] of [
  ["November", NOW, "2026-10-31T23:10:00.000Z", "2026-11-01T09:00:00.000Z", "2026-11-01T18:00:00.000Z", "le 1er novembre 2026"],
  ["March", "2027-02-20T12:00:00.000Z", "2027-02-28T23:10:00.000Z", "2027-03-01T09:00:00.000Z", "2027-03-01T18:00:00.000Z", "le 1er mars 2027"]
]) {
  test(`a one-day ${name} prefix validates in Europe/Paris without repeating its exact date`, async () => {
    const proof = contact(`transit.mercury.jupiter.${name}`, { transitBody: "Mercury", natalPoint: "Jupiter", status: "UPCOMING", startsAt, exactAt, endsAt });
    const evidence = dossier([proof], now);
    const original = structuredClone(evidence);
    const section = sectionById(productionPlan(evidence), "next_weeks");
    const block = section.blockPlans.find((entry) => entry.packetRefs.some((ref) => section.evidencePackets.find((packet) => packet.packetId === ref)?.evidenceRefs.includes(proof.evidenceId)));
    assert.ok(block);
    assert.ok(block.deterministicPrefix.includes(expected));
    assert.doesNotMatch(block.deterministicPrefix, /L'aspect .*exact/);
    const scoped = scopedSectionPlanForBlock(section, block);
    let calls = 0;
    const result = await writeStructuredSectionWithLlm({ dossierEvidence: evidence, sectionPlan: scoped, options: {
      logger: { warn() {} }, structuredWriterFn: ({ sectionPlan }) => {
        calls += 1;
        return { sectionId: sectionPlan.sectionId, blocks: [{ blockId: block.blockId, text: "La formulation peut symboliquement rencontrer la question de l’ampleur donnée aux idées." }] };
      }
    } });
    assert.equal(calls, 1);
    assert.equal(result.validation.ok, true);
    assert.ok(result.section.blocks[0].text.startsWith(block.deterministicPrefix));
    assert.deepEqual(evidence, original);
  });
}


test("every retained occurrence keeps a validated date role and a false server date blocks before a model call", async () => {
  const occurrence = (day) => contact(`transit.mercury.jupiter.day_${day}`, {
    status: "UPCOMING", transitBody: "Mercury", natalPoint: "Jupiter",
    startsAt: `2026-11-0${day}T00:00:00.000Z`, exactAt: `2026-11-0${day}T12:00:00.000Z`, endsAt: `2026-11-0${day}T18:00:00.000Z`
  });
  const evidence = dossier([occurrence(1), occurrence(3)]);
  const section = sectionById(productionPlan(evidence), "next_weeks");
  const block = section.blockPlans.find((entry) => entry.packetRefs.length === 2);
  assert.ok(block);
  assert.match(block.deterministicPrefix, /exact 1er novembre 2026/);
  assert.match(block.deterministicPrefix, /exact 3 novembre 2026/);
  const falseBlock = { ...block, deterministicPrefix: block.deterministicPrefix.replaceAll("3 novembre", "4 novembre") };
  const scoped = scopedSectionPlanForBlock(section, falseBlock);
  let calls = 0;
  await assert.rejects(writeStructuredSectionWithLlm({ dossierEvidence: evidence, sectionPlan: scoped, options: {
    logger: { warn() {} }, structuredWriterFn: () => { calls += 1; throw new Error("the model must not receive an invalid server prefix"); }
  } }), (error) => error.code === "SERVER_PREFIX_VALIDATION_FAILED");
  assert.equal(calls, 0);
});

for (const [label, falsify] of [
  ["a wrong window day with the original exact day intact", (prefix) => prefix.replace("le 3 novembre", "le 4 novembre")],
  ["an exact day borrowed from the other occurrence", (prefix) => prefix.replace("exact 1er novembre", "exact 3 novembre")]
]) {
  test(`a grouped prefix rejects ${label} before any model call`, async () => {
    const occurrence = (day) => contact(`transit.mercury.jupiter.day_${day}`, {
      status: "UPCOMING", transitBody: "Mercury", natalPoint: "Jupiter",
      startsAt: `2026-11-0${day}T00:00:00.000Z`, exactAt: `2026-11-0${day}T12:00:00.000Z`, endsAt: `2026-11-0${day}T18:00:00.000Z`
    });
    const evidence = dossier([occurrence(1), occurrence(3)]);
    const original = structuredClone(evidence);
    const section = sectionById(productionPlan(evidence), "next_weeks");
    const block = section.blockPlans.find((entry) => entry.packetRefs.length === 2);
    const falseBlock = { ...block, deterministicPrefix: falsify(block.deterministicPrefix) };
    assert.notEqual(falseBlock.deterministicPrefix, block.deterministicPrefix);
    const scoped = scopedSectionPlanForBlock(section, falseBlock);
    let calls = 0;
    await assert.rejects(writeStructuredSectionWithLlm({ dossierEvidence: evidence, sectionPlan: scoped, options: {
      logger: { warn() {} }, structuredWriterFn: () => { calls += 1; throw new Error("invalid prefix must block before the model"); }
    } }), (error) => error.code === "SERVER_PREFIX_VALIDATION_FAILED" && error.validation.issues.some((issue) => issue.code === "transit_text_date_mismatch"));
    assert.equal(calls, 0);
    assert.deepEqual(evidence, original);
  });
}

test("a genuine grouped prefix retains all windows and exact days and validates in one simulated call", async () => {
  const occurrence = (day) => contact(`transit.mercury.jupiter.day_${day}`, {
    status: "UPCOMING", transitBody: "Mercury", natalPoint: "Jupiter",
    startsAt: `2026-11-0${day}T00:00:00.000Z`, exactAt: `2026-11-0${day}T12:00:00.000Z`, endsAt: `2026-11-0${day}T18:00:00.000Z`
  });
  const evidence = dossier([occurrence(1), occurrence(3)]);
  const original = structuredClone(evidence);
  const section = sectionById(productionPlan(evidence), "next_weeks");
  const block = section.blockPlans.find((entry) => entry.packetRefs.length === 2);
  const scoped = scopedSectionPlanForBlock(section, block);
  let calls = 0;
  const result = await writeStructuredSectionWithLlm({ dossierEvidence: evidence, sectionPlan: scoped, options: {
    logger: { warn() {} }, structuredWriterFn: ({ sectionPlan }) => {
      calls += 1;
      return { sectionId: sectionPlan.sectionId, blocks: [{ blockId: block.blockId, text: "La formulation peut symboliquement rencontrer la question de l’ampleur donnée aux idées." }] };
    }
  } });
  assert.equal(calls, 1);
  assert.equal(result.validation.ok, true);
  assert.ok(result.section.blocks[0].text.startsWith(block.deterministicPrefix));
  assert.deepEqual(evidence, original);
});
