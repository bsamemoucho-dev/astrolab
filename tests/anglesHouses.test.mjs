import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";

function circularDifference(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function assertAngleClose(actual, expected, tolerance, label) {
  assert.ok(circularDifference(actual, expected) <= tolerance, `${label} expected ${expected}, got ${actual}`);
}

function assertOpposed(a, b, label) {
  assertAngleClose((a + 180) % 360, b, 0.000001, label);
}

function chart(input) {
  return calculateWesternNatalChart({
    timePrecision: "exact",
    coordinateSource: "test_fixture",
    coordinateConfidence: "verified_fixture",
    ...input
  }).result;
}

test("Courbevoie reference chart assigns ASC and DSC to the correct horizons", () => {
  const result = chart({
    birthDate: "1986-01-02",
    timeValue: "16:42",
    birthPlace: "Courbevoie, France",
    latitude: 48.89672,
    longitude: 2.25666,
    timeZone: "Europe/Paris"
  });
  const angles = result.astronomicalCalculation.angles;

  assertAngleClose(angles.ascendant.longitude, 98.383664, 0.001, "ASC");
  assert.equal(angles.ascendant.sign, "Cancer");
  assertAngleClose(angles.descendant.longitude, 278.383664, 0.001, "DSC");
  assert.equal(angles.descendant.sign, "Capricorn");
  assertOpposed(angles.ascendant.longitude, angles.descendant.longitude, "ASC/DSC opposition");
});

test("Courbevoie ARMC to Midheaven conversion matches independent reference", () => {
  const result = chart({
    birthDate: "1986-01-02",
    timeValue: "16:42",
    birthPlace: "Courbevoie, France",
    latitude: 48.89672,
    longitude: 2.25666,
    timeZone: "Europe/Paris"
  });
  const angles = result.astronomicalCalculation.angles;

  assert.equal(result.time.utc, "1986-01-02T15:42:00.000Z");
  assert.equal(result.normalizedInput.latitude, 48.89672);
  assert.equal(result.normalizedInput.longitude, 2.25666);
  assertAngleClose(angles.ascendant.longitude, 98.3841, 0.001, "ASC remains stable");
  assertAngleClose(angles.midheaven.longitude, 338.0811, 0.005, "MC");
  assert.equal(angles.midheaven.sign, "Pisces");
  assertAngleClose(angles.imumCoeli.longitude, 158.0811, 0.005, "IC");
  assert.equal(angles.imumCoeli.sign, "Virgo");
  assertOpposed(angles.midheaven.longitude, angles.imumCoeli.longitude, "MC/IC opposition");
});

test("Courbevoie Whole Sign houses start from the corrected Ascendant sign", () => {
  const result = chart({
    birthDate: "1986-01-02",
    timeValue: "16:42",
    birthPlace: "Courbevoie, France",
    latitude: 48.89672,
    longitude: 2.25666,
    timeZone: "Europe/Paris"
  });

  assert.deepEqual(
    result.structuralAstrology.houses.map((house) => house.sign),
    ["Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini"]
  );
});

test("angles remain coherent across multiple dates and locations", () => {
  const fixtures = [
    {
      birthDate: "2000-01-01",
      timeValue: "12:00",
      birthPlace: "London, United Kingdom",
      latitude: 51.5072,
      longitude: -0.1276,
      timeZone: "Europe/London"
    },
    {
      birthDate: "2024-03-20",
      timeValue: "04:06",
      birthPlace: "Paris, France",
      latitude: 48.8566,
      longitude: 2.3522,
      timeZone: "Europe/Paris"
    },
    {
      birthDate: "1995-07-14",
      timeValue: "22:10",
      birthPlace: "New York, United States",
      latitude: 40.7128,
      longitude: -74.006,
      timeZone: "America/New_York"
    }
  ];

  for (const fixture of fixtures) {
    const result = chart(fixture);
    const angles = result.astronomicalCalculation.angles;
    assertOpposed(angles.ascendant.longitude, angles.descendant.longitude, `${fixture.birthPlace} ASC/DSC`);
    assertOpposed(angles.midheaven.longitude, angles.imumCoeli.longitude, `${fixture.birthPlace} MC/IC`);
    assert.equal(result.structuralAstrology.houses[0].sign, angles.ascendant.sign);
    assert.equal(result.structuralAstrology.houses.length, 12);
  }
});
