import assert from "node:assert/strict";
import test from "node:test";

import { SEVEN_TRADITIONAL_BODIES, SIGN_NAMES } from "../src/astro/constants.mjs";
import { parseDate, parseTime } from "../src/astro/time.mjs";
import { resolvePlace } from "../src/geo/placeResolver.mjs";
import { calculateWesternNatalChart, zodiacPlacement } from "../src/astro/westernNatal.mjs";

function circularDifference(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

const parisInput = {
  personId: "person_test",
  birthDate: "1990-01-15",
  timeValue: "12:30",
  timePrecision: "exact",
  birthPlace: "Paris",
  country: "France",
  latitude: 48.8566,
  longitude: 2.3522,
  timeZone: "Europe/Paris",
  coordinateSource: "test_fixture",
  coordinateConfidence: "verified_fixture"
};

test("date, time and zodiac helpers reject invalid values and map signs", () => {
  assert.deepEqual(parseDate("2026-08-31"), { year: 2026, month: 8, day: 31 });
  assert.deepEqual(parseTime("20:25:01"), { hour: 20, minute: 25, second: 1 });
  assert.equal(zodiacPlacement(0).sign, "Aries");
  assert.equal(zodiacPlacement(359.99).sign, "Pisces");
  assert.throws(() => parseDate("2026-02-31"), /valid calendar date/);
  assert.throws(() => parseTime("25:00"), /valid clock time/);
});

test("place resolver returns reproducible normalized location data and rejects invalid or ambiguous places", () => {
  const paris = resolvePlace({ query: "Paris, France", birthDate: "1990-01-15" });
  assert.equal(paris.selectedName, "Paris, France");
  assert.equal(paris.normalizedForCalculation.latitude, 48.8566);
  assert.equal(paris.normalizedForCalculation.longitude, 2.3522);
  assert.equal(paris.normalizedForCalculation.timeZone, "Europe/Paris");
  assert.equal(paris.timezoneRule.birthDate, "1990-01-15");
  assert.match(paris.resolutionSource, /local-gazetteer/);

  assert.throws(() => resolvePlace({ query: "Not A Real Place" }), /could not be resolved/);
  assert.throws(() => resolvePlace({ query: "Springfield" }), /ambiguous/);
});

test("western natal calculation creates deterministic structured development result", () => {
  const first = calculateWesternNatalChart(parisInput, { calculatedAt: "2026-09-01T00:00:00.000Z" });
  const second = calculateWesternNatalChart(parisInput, { calculatedAt: "2026-09-02T00:00:00.000Z" });

  assert.equal(first.result.methodId, "western-natal");
  assert.equal(first.result.productionEligible, false);
  assert.equal(first.result.parameters.internetUsedAtRuntime, false);
  assert.equal(first.result.parameters.ruleVersionsCreated, false);
  assert.equal(first.calculationRun.inputDataHash, second.calculationRun.inputDataHash);
  assert.equal(first.calculationRun.resultHash, second.calculationRun.resultHash);
  assert.notEqual(first.calculationRun.calculatedAt, second.calculationRun.calculatedAt);
});

test("western natal result includes seven traditional bodies, signs, angles and whole sign houses", () => {
  const { result } = calculateWesternNatalChart(parisInput, { calculatedAt: "2026-09-01T00:00:00.000Z" });
  const bodies = result.astronomicalCalculation.bodies;
  const angles = result.astronomicalCalculation.angles;
  const houses = result.structuralAstrology.houses;

  assert.deepEqual(bodies.map((entry) => entry.body), SEVEN_TRADITIONAL_BODIES);
  for (const body of bodies) {
    assert.ok(body.longitude >= 0 && body.longitude < 360);
    assert.ok(SIGN_NAMES.includes(body.sign));
    assert.ok(body.degreeInSign >= 0 && body.degreeInSign < 30);
    assert.equal(typeof body.apparentMotion.retrograde, "boolean");
  }

  assert.ok(SIGN_NAMES.includes(angles.ascendant.sign));
  assert.ok(circularDifference((angles.ascendant.longitude + 180) % 360, angles.descendant.longitude) < 0.001);
  assert.equal(houses.length, 12);
  assert.equal(houses[0].sign, angles.ascendant.sign);
  assert.equal(houses[0].system, "whole_sign");
  assert.equal(houses[0].ruleVersionId, null);
});

test("aspects and interpretive conditions remain inactive without RuleVersion", () => {
  const { result } = calculateWesternNatalChart(parisInput, { calculatedAt: "2026-09-01T00:00:00.000Z" });
  const aspects = result.structuralAstrology.aspectInfrastructure;
  const conditions = result.structuralAstrology.planetaryConditions;
  const lots = result.structuralAstrology.lots;

  assert.equal(aspects.length, 21);
  assert.ok(aspects.every((aspect) => aspect.active === false));
  assert.ok(aspects.every((aspect) => aspect.ruleVersionId === null));
  assert.ok(conditions.every((condition) => condition.domicile.ruleVersionId === null));
  assert.ok(lots.every((lot) => lot.value === null));
  assert.equal(result.traditionalInterpretation.status, "not_generated");
});

test("western natal calculation handles approximate, interval and unknown time without inventing exact angles", () => {
  const approximate = calculateWesternNatalChart({ ...parisInput, timePrecision: "approximate" });
  assert.equal(approximate.result.uncertainty.timePrecision, "approximate");
  assert.equal(approximate.result.uncertainty.calculationMode, "approximate_time");
  assert.equal(approximate.result.uncertainty.timeEvidence.precision, "approximate");
  assert.equal(approximate.result.uncertainty.timeEvidence.suppliedTime, "12:30");
  assert.equal(approximate.result.uncertainty.timeEvidence.referenceTimeUsedForTimedCalculations, "12:30");
  assert.equal(approximate.result.uncertainty.timeEvidence.uncertaintyWindow, null);
  assert.equal(approximate.result.astronomicalCalculation.angles.uncertaintyStatus, "depends_on_approximate_birth_time");
  assert.equal(approximate.result.astronomicalCalculation.angles.referenceTimeUsed, "12:30");
  assert.ok(approximate.result.structuralAstrology.houses.every((house) => house.uncertaintyStatus === "depends_on_approximate_birth_time"));
  assert.ok(approximate.result.uncertainty.indeterminable.includes("exact_angles_without_uncertainty_margin"));
  assert.ok(approximate.result.astronomicalCalculation.angles.ascendant);

  const unknown = calculateWesternNatalChart({ ...parisInput, timePrecision: "unknown", timeValue: "" });
  assert.equal(unknown.result.uncertainty.timePrecision, "unknown");
  assert.equal(unknown.result.uncertainty.timeEvidence.precision, "unknown");
  assert.equal(unknown.result.uncertainty.timeEvidence.suppliedTime, null);
  assert.equal(unknown.result.uncertainty.timeEvidence.referenceTimeUsedForTimedCalculations, null);
  assert.equal(unknown.result.time.utc, null);
  assert.equal(unknown.result.astronomicalCalculation.angles.ascendant, null);
  assert.equal(unknown.result.structuralAstrology.houses.status, "not_calculated_time_unknown");
  assert.ok(unknown.result.uncertainty.indeterminable.includes("ascendant"));
  assert.equal(unknown.result.astronomicalCalculation.bodies.length, 7);

  const interval = calculateWesternNatalChart({ ...parisInput, timePrecision: "interval", timeValue: "", timeStart: "08:00", timeEnd: "10:00" });
  assert.equal(interval.result.uncertainty.calculationMode, "time_interval");
  assert.equal(interval.result.uncertainty.timeEvidence.precision, "interval");
  assert.deepEqual(interval.result.uncertainty.timeEvidence.interval, { start: "08:00", end: "10:00" });
  assert.equal(interval.result.uncertainty.timeEvidence.referenceTimeUsedForTimedCalculations, null);
  assert.equal(interval.result.time.utc, null);
  assert.equal(interval.result.astronomicalCalculation.angles.ascendant, null);
  assert.equal(interval.result.astronomicalCalculation.bodies.length, 7);
});

test("time precision evidence preserves exact time without downgrading or duplicating uncertainty", () => {
  const exact = calculateWesternNatalChart(parisInput);
  assert.equal(exact.result.uncertainty.timeEvidence.precision, "exact");
  assert.equal(exact.result.uncertainty.timeEvidence.suppliedTime, "12:30");
  assert.equal(exact.result.uncertainty.timeEvidence.referenceTimeUsedForTimedCalculations, "12:30");
  assert.equal(exact.result.uncertainty.timeEvidence.uncertaintyWindow, null);
  assert.equal(exact.result.astronomicalCalculation.angles.uncertaintyStatus, undefined);
  assert.ok(exact.result.structuralAstrology.houses.every((house) => house.uncertaintyStatus === "time_exact_or_not_time_dependent"));
});

test("western natal calculation requires coordinates and timezone", () => {
  assert.throws(() => calculateWesternNatalChart({ ...parisInput, latitude: "" }), /latitude/);
  assert.throws(() => calculateWesternNatalChart({ ...parisInput, timeZone: "Invalid/Zone" }), /Invalid or unsupported timeZone/);
});
