import assert from "node:assert/strict";
import test from "node:test";
import { buildIndependentReading } from "./build.mjs";
import { calculateWesternNatalChart } from "../../src/astro/westernNatal.mjs";
import { buildSocle } from "../../src/deliverables/socle.mjs";
import { interpretationRuleById, ruleMatchesEvidence } from "../../src/deliverables/interpretationRules.mjs";

// Fictional themes, using the same public Paris coordinates as core tests.
const BIRTH = Object.freeze({ birthDate: "1990-01-15", timePrecision: "exact", timeValue: "16:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", placeName: "Paris", country: "France" });
const GENERATED = "2026-10-27T00:00:00.000Z";
const build = (extra = {}) => buildIndependentReading({ birth: { ...BIRTH }, generatedAt: GENERATED, ...extra });

function checkedEntries(report) {
  const proofs = new Map(report.tropical.evidence.evidence.map((proof) => [proof.evidenceId, proof]));
  for (const entry of report.symbolic.entries) {
    const proof = proofs.get(entry.evidenceId), rule = interpretationRuleById(entry.ruleId);
    assert.ok(proof, entry.evidenceId);
    assert.ok(rule, entry.ruleId);
    assert.equal(proof.provenance.method, "western-natal");
    assert.equal(proof.certainty.stableAcrossApplicableWindow, true);
    assert.equal(ruleMatchesEvidence(rule, proof), true);
    assert.ok(!rule.scope?.length, "scoped relational roles must not leak into general themes");
    assert.deepEqual(entry.themes, rule.themes);
    assert.equal(entry.frame, "western-tropical");
    assert.deepEqual(Object.keys(entry).sort(), ["evidenceId", "frame", "ruleId", "themes"]);
  }
}

test("independent preview preserves the real tropical result, socle, proof references and caller input", () => {
  const args = Object.freeze({ birth: BIRTH, personLabel: "  Thème fictif  ", generatedAt: GENERATED });
  const original = structuredClone(args);
  const report = buildIndependentReading(args);
  const calculation = calculateWesternNatalChart(BIRTH, { calculatedAt: GENERATED });
  assert.equal(report.schema, "lastro.independent_reading@0.1.0");
  assert.equal(report.status, "local_preview");
  assert.equal(report.personLabel, "Thème fictif");
  assert.deepEqual(report.tropical.result, calculation.result);
  assert.deepEqual(report.tropical.socle, buildSocle(calculation.result));
  assert.equal(report.tropical.result.astronomicalCalculation.bodies.length, 7);
  assert.equal(report.tropical.frame.zodiac, "tropical");
  assert.equal(report.tropical.frame.houseSystem, "WHOLE_SIGN");
  assert.equal(report.tropical.frame.utc, "1990-01-15T15:30:00.000Z");
  assert.equal(report.tropical.frame.aspectRuleVersion, "lastro-aspects@1.0.0");
  assert.ok(report.tropical.frame.timezoneDatabaseVersion);
  assert.ok(report.tropical.evidence.evidence.length > report.symbolic.entries.length);
  assert.equal(report.symbolic.status, "catalogue_only");
  assert.ok(report.symbolic.entries.length > 0);
  checkedEntries(report);
  assert.deepEqual(args, original);
});

test("preview themes do not share mutable arrays with the production rule catalogue", () => {
  const report = build();
  const entry = report.symbolic.entries[0], rule = interpretationRuleById(entry.ruleId);
  const original = [...rule.themes];
  entry.themes.push("PRIVATE_MUTATION_TEST");
  assert.deepEqual(rule.themes, original);
  assert.ok(!build().symbolic.entries.some((item) => item.themes.includes("PRIVATE_MUTATION_TEST")));
});

for (const field of ["zodiac", "houseSystem", "frame", "ayanamsha", "tradition", "evidence", "claims", "result", "positions", "rules", "resolvedPlace", "parents", "personId"]) {
  test(`preview rejects caller-supplied ${field} rather than accepting another calculation frame or invented fact`, () => {
    assert.throws(() => build({ birth: { ...BIRTH, [field]: field === "zodiac" ? "sidereal" : {} } }), { code: "UNSUPPORTED_BIRTH_INPUT" });
  });
}
for (const field of ["tropical", "symbolic", "evidence", "rules", "facts", "parents", "writer", "currentSky"]) {
  test(`preview rejects extra reading field ${field}`, () => {
    assert.throws(() => build({ [field]: {} }), { code: "UNSUPPORTED_READING_INPUT" });
  });
}

test("preview rejects non-data accessors and inherited custom inputs before calculation", () => {
  let called = false;
  const birth = { ...BIRTH };
  Object.defineProperty(birth, "zodiac", { get() { called = true; return "sidereal"; } });
  assert.throws(() => build({ birth }), { code: "UNSUPPORTED_BIRTH_INPUT" });
  assert.equal(called, false);
  assert.throws(() => build({ birth: Object.create({ zodiac: "sidereal" }) }), { code: "UNSUPPORTED_BIRTH_INPUT" });
  assert.throws(() => build({ birth: [] }), { code: "UNSUPPORTED_BIRTH_INPUT" });
});

test("preview normalizes scalar input without accepting structured values in birth fields", () => {
  const report = build({ birth: { ...BIRTH, latitude: "48.8566", longitude: "2.3522", placeName: " Paris " } });
  assert.equal(report.birth.latitude, BIRTH.latitude);
  assert.equal(report.birth.placeName, "Paris");
  for (const [field, value] of [["birthDate", { value: BIRTH.birthDate }], ["latitude", []], ["longitude", Infinity], ["timeValue", () => "16:30"]]) {
    assert.throws(() => build({ birth: { ...BIRTH, [field]: value } }), { code: "INVALID_BIRTH_VALUE" });
  }
});

test("unknown time supplies ranges and no angle/house or invented exact UTC licence", () => {
  const { timeValue, ...birth } = BIRTH;
  const report = build({ birth: { ...birth, timePrecision: "unknown" } });
  assert.equal(report.tropical.frame.utc, null);
  assert.ok(report.tropical.frame.utcRange.start);
  assert.equal(report.tropical.result.astronomicalCalculation.angles.ascendant, null);
  assert.equal(report.tropical.evidence.evidence.some((proof) => ["ANGLE_SIGN", "NATAL_BODY_HOUSE"].includes(proof.type)), false);
  assert.equal(report.symbolic.entries.some((entry) => /\.house\.|\.angle\./u.test(entry.ruleId)), false);
  checkedEntries(report);
});

test("an approximate undecidable angle keeps its uncertainty and cannot acquire the targeted Cancer licence", () => {
  const report = build({ birth: { ...BIRTH, timePrecision: "approximate", timeValue: "15:30", timeMarginMinutes: 30 } });
  assert.equal(report.birth.timeMarginMinutes, 30);
  const proof = report.tropical.evidence.evidence.find((item) => item.evidenceId === "angle.ascendant.sign");
  assert.equal(proof.certainty.stableAcrossApplicableWindow, false);
  assert.equal(report.symbolic.entries.some((entry) => entry.ruleId === "western.angle.ascendant.sign.cancer@1"), false);
  assert.equal(report.tropical.evidence.evidence.some((item) => item.type === "NATAL_BODY_HOUSE"), false);
  checkedEntries(report);
});

test("stable approximate contexts retain only the existing narrow licences", () => {
  const report = build({ birth: { ...BIRTH, timePrecision: "approximate", timeMarginMinutes: 15 } });
  assert.equal(report.tropical.result.uncertainty.timePrecision, "approximate");
  assert.ok(report.symbolic.entries.some((entry) => entry.ruleId === "western.angle.ascendant.sign.cancer@1"));
  assert.ok(report.symbolic.entries.some((entry) => entry.ruleId === "western.body.moon.house.3@1"));
  checkedEntries(report);
});

test("declared time interval remains an interval instead of an invented midpoint chart", () => {
  const { timeValue, ...birth } = BIRTH;
  const report = build({ birth: { ...birth, timePrecision: "interval", timeStart: "15:00", timeEnd: "17:00" } });
  assert.equal(report.tropical.result.uncertainty.timePrecision, "interval");
  assert.equal(report.tropical.frame.utc, null);
  assert.notEqual(report.tropical.frame.utcRange.start, report.tropical.frame.utcRange.end);
  assert.equal(report.tropical.result.astronomicalCalculation.angles.ascendant, null);
  checkedEntries(report);
});

test("unimplemented methods and cross-tradition synthesis remain explicitly unavailable", () => {
  const report = build();
  for (const id of ["outer-natal-interpretation", "jyotisha-natal", "jyotisha-nakshatras", "jyotisha-dashas", "chinese-bazi", "western-progressions", "western-cycles", "jungian-archetypes", "transgenerational"]) {
    assert.ok(report.unavailable.some((item) => item.id === id && item.reason && item.title), id);
  }
  assert.deepEqual(report.crossTraditionSynthesis, { status: "not_licensed" });
  assert.equal(report.tropical.result.traditionalInterpretation.status, "not_generated");
  assert.equal(report.tropical.result.structuralAstrology.planetaryConditions.every((item) => item.domicile.ruleVersionId === null), true);
  assert.equal(report.tropical.evidence.evidence.some((proof) => ["PARENT_CONTEXT", "PERSONAL_TRANSIT"].includes(proof.type)), false);
});

test("preview validates its metadata, performs no transport and stays deterministic for the supplied timestamp", () => {
  for (const value of ["not-a-date", {}, ""]) assert.throws(() => build({ generatedAt: value }), { code: "INVALID_PREVIEW_DATE" });
  assert.throws(() => build({ personLabel: {} }), { code: "INVALID_PERSON_LABEL" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("A local preview must never perform a network call"); };
  try {
    assert.deepEqual(build(), build());
  } finally { globalThis.fetch = originalFetch; }
});


test("coordinate provenance stays traceable but cannot certify an exact birth location", () => {
  const birth = { ...BIRTH, coordinateSource: "public_commune_centroid", coordinateConfidence: "commune_centroid_not_birth_address" };
  const original = structuredClone(birth);
  const report = build({ birth });
  assert.equal(report.birth.coordinateSource, birth.coordinateSource);
  assert.equal(report.birth.coordinateConfidence, birth.coordinateConfidence);
  assert.deepEqual(report.birth.coordinateMetadata, { status: "declared", verified: false });
  const expected = calculateWesternNatalChart(birth, { calculatedAt: GENERATED });
  assert.deepEqual(report.tropical.result, expected.result, "metadata handling must not rewrite the core result or calculations");
  assert.equal(report.tropical.evidence.evidence[0].provenance.resultHash, expected.calculationRun.resultHash);
  const differentlyDeclared = build({ birth: { ...BIRTH, coordinateSource: "user_supplied_location", coordinateConfidence: "claimed_exact" } });
  assert.deepEqual(differentlyDeclared.tropical.result.astronomicalCalculation, report.tropical.result.astronomicalCalculation, "equal coordinates give equal astronomical data regardless of provenance labels");
  assert.deepEqual(differentlyDeclared.birth.coordinateMetadata, { status: "declared", verified: false }, "a supplied confidence label cannot certify the location");
  assert.notDeepEqual(differentlyDeclared.birth.coordinateSource, report.birth.coordinateSource);
  assert.deepEqual(birth, original);
});
