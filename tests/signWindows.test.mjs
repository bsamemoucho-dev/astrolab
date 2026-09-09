import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { ascendantSignWindows, uncertainIntervalAnalysis } from "../src/astro/signWindows.mjs";
import { SIGN_NAMES } from "../src/astro/constants.mjs";

const courbevoie = Object.freeze({
  birthDate: "1986-01-02",
  timeZone: "Europe/Paris",
  latitude: 48.89672,
  longitude: 2.25666
});

const sevres = Object.freeze({
  birthDate: "1989-01-18",
  timeZone: "Europe/Paris",
  latitude: 48.8239,
  longitude: 2.2117
});

function localToSeconds(local) {
  const match = String(local).match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`invalid local time ${local}`);
  }
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function shiftLocal(local, deltaSeconds) {
  let seconds = localToSeconds(local) + deltaSeconds;
  if (seconds < 0 || seconds >= 86400) {
    throw new Error(`shifted time out of civil day: ${local} ${deltaSeconds}`);
  }
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor((seconds % 3600) / 60);
  const second = seconds % 60;
  return [hour, minute, second].map((part) => String(part).padStart(2, "0")).join(":");
}

test("ascendant day windows cover the civil day with ordered forward sign spans", () => {
  const result = ascendantSignWindows(courbevoie);

  assert.equal(result.status, "calculated");
  assert.equal(result.schema, "astrolab.western_natal.ascendant_sign_windows");
  assert.equal(result.windows.length, 13);

  const signs = result.windows.map((window) => window.sign);
  assert.equal(signs[0], signs[12]);
  const unique = [...new Set(signs)];
  assert.equal(unique.length, 12);

  // consecutive windows are adjacent forward zodiac signs (the midnight sign is split in two)
  for (let index = 0; index < result.windows.length - 1; index += 1) {
    const current = result.windows[index];
    const next = result.windows[index + 1];
    assert.equal(next.startLocal, current.endLocal);
    assert.equal(next.startUtcMs, current.endUtcMs);
    assert.ok(next.endUtcMs > current.endUtcMs);
    const from = SIGN_NAMES.indexOf(current.sign);
    const to = SIGN_NAMES.indexOf(next.sign);
    assert.equal((to - from + 12) % 12, 1);
  }

  assert.equal(result.windows[0].startLocal, "00:00:00");
  assert.equal(result.windows[12].endLocal, "24:00:00");
  assert.equal(result.windows[12].endUtcMs - result.windows[0].startUtcMs, 86400000);
});

test("known ascendant at 16:42 falls inside the Cancer window (Courbevoie 1986-01-02)", () => {
  const result = ascendantSignWindows(courbevoie);
  const cancer = result.windows.find((window) => window.sign === "Cancer");

  assert.ok(cancer);
  assert.ok(localToSeconds(cancer.startLocal) <= localToSeconds("16:42:00"));
  assert.ok(localToSeconds("16:42:00") < localToSeconds(cancer.endLocal));
});

test("Sèvres 1989-01-18: Gemini plage horaire matches the documented guardrail example", () => {
  const result = ascendantSignWindows(sevres);
  const gemini = result.windows.find((window) => window.sign === "Gemini");
  const sagittarius = result.windows.find((window) => window.sign === "Sagittarius");

  assert.ok(gemini);
  assert.ok(
    localToSeconds("13:11:00") <= localToSeconds(gemini.startLocal) &&
      localToSeconds(gemini.startLocal) <= localToSeconds("13:13:00"),
    `Gemini start ${gemini.startLocal} should be near 13:11`
  );
  assert.ok(
    localToSeconds("14:59:00") <= localToSeconds(gemini.endLocal) &&
      localToSeconds(gemini.endLocal) <= localToSeconds("15:01:00"),
    `Gemini end ${gemini.endLocal} should be near 15:00`
  );

  assert.ok(sagittarius);
  assert.ok(
    localToSeconds(sagittarius.startLocal) <= localToSeconds("05:55:00") &&
      localToSeconds("05:55:00") < localToSeconds(sagittarius.endLocal),
    "05:55 must fall inside the Sagittarius window, not Gemini"
  );

  // guardrail semantics: a claimed Gemini Ascendant cannot be produced at 05:55
  assert.ok(localToSeconds(gemini.startLocal) > localToSeconds("05:55:00"));
});

test("ascendant day windows are deterministic", () => {
  const first = ascendantSignWindows(sevres);
  const second = ascendantSignWindows(sevres);
  assert.deepEqual(first, second);
});

test("interval analysis classifies stable and sensitive targets without inventing an exact chart", () => {
  const analysis = uncertainIntervalAnalysis({ ...courbevoie, timeStart: "03:00:00", timeEnd: "05:00:00" });

  assert.equal(analysis.schema, "astrolab.western_natal.interval_stability_analysis");
  assert.equal(analysis.status, "calculated");
  assert.equal(analysis.interval.durationSeconds, 7200);
  assert.equal(analysis.targets.length, 9);

  const targetNames = analysis.targets.map((target) => target.target);
  assert.deepEqual(targetNames, ["Ascendant", "Midheaven", "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);

  const stable = analysis.targets.filter((target) => target.status === "stable");
  const sensitive = analysis.targets.filter((target) => target.status === "sensitive");
  assert.equal(stable.length + sensitive.length, 9);

  for (const target of stable) {
    assert.equal(target.signAtStart, target.signAtEnd);
  }
  for (const target of sensitive) {
    assert.ok(target.crossingTimes.length >= 1);
    assert.ok(target.windows.length >= 2);
    assert.equal(target.windows[0].sign, target.signAtStart);
    assert.equal(target.windows[target.windows.length - 1].sign, target.signAtEnd);
  }

  assert.deepEqual(analysis.summary.stableTargets, stable.map((target) => target.target));
  assert.deepEqual(analysis.summary.sensitiveTargets, sensitive.map((target) => target.target));
});

test("high latitude returns indeterminate instead of invented windows or stability", () => {
  const dayWindows = ascendantSignWindows({
    birthDate: "2024-06-21",
    timeZone: "Arctic/Longyearbyen",
    latitude: 85,
    longitude: 15
  });
  assert.equal(dayWindows.status, "indeterminate_latitude_behavior");
  assert.equal(dayWindows.windows.length, 0);

  const interval = uncertainIntervalAnalysis({
    birthDate: "2024-06-21",
    timeZone: "Arctic/Longyearbyen",
    latitude: 85,
    longitude: 15,
    timeStart: "06:00:00",
    timeEnd: "12:00:00"
  });
  const ascendant = interval.targets.find((target) => target.target === "Ascendant");
  assert.equal(ascendant.status, "indeterminate");
  assert.ok(interval.summary.indeterminateTargets.includes("Ascendant"));
});

test("interval analysis crossing instants agree with the day ascendant windows", () => {
  const day = ascendantSignWindows(courbevoie);
  const boundary = day.windows[5]; // window opened by the mid-day crossing
  const crossingLocal = boundary.startLocal;

  const intervalStart = shiftLocal(crossingLocal, -600);
  const intervalEnd = shiftLocal(crossingLocal, 600);
  const analysis = uncertainIntervalAnalysis({ ...courbevoie, timeStart: intervalStart, timeEnd: intervalEnd });
  const ascendant = analysis.targets.find((target) => target.target === "Ascendant");

  assert.equal(ascendant.status, "sensitive");
  assert.equal(ascendant.signAtStart, day.windows[4].sign);
  assert.equal(ascendant.signAtEnd, boundary.sign);
  assert.equal(ascendant.crossingTimes[0].local, crossingLocal);
});

test("interval analysis is deterministic", () => {
  const first = uncertainIntervalAnalysis({ ...sevres, timeStart: "08:00:00", timeEnd: "12:00:00" });
  const second = uncertainIntervalAnalysis({ ...sevres, timeStart: "08:00:00", timeEnd: "12:00:00" });
  assert.deepEqual(first, second);
});

test("interval analysis rejects invalid or empty intervals", () => {
  assert.throws(() => uncertainIntervalAnalysis({ ...courbevoie, timeStart: "12:00", timeEnd: "10:00" }), /timeEnd must be later/);
  assert.throws(() => uncertainIntervalAnalysis({ ...courbevoie, timeStart: "10:00", timeEnd: "10:00" }), /timeEnd must be later/);
  assert.throws(() => ascendantSignWindows({ ...courbevoie, timeZone: "Invalid/Zone" }), /Invalid or unsupported timeZone/);
  assert.throws(() => ascendantSignWindows({ ...courbevoie, latitude: 91 }), /latitude/);
});

test("chart result embeds interval stability analysis only in interval time mode", () => {
  const base = {
    personId: "person_test",
    birthDate: "1986-01-02",
    birthPlace: "Courbevoie, France",
    latitude: 48.89672,
    longitude: 2.25666,
    timeZone: "Europe/Paris",
    coordinateSource: "test_fixture",
    coordinateConfidence: "verified_fixture"
  };

  const exact = calculateWesternNatalChart({ ...base, timePrecision: "exact", timeValue: "16:42" });
  const unknown = calculateWesternNatalChart({ ...base, timePrecision: "unknown", timeValue: "" });
  const approximate = calculateWesternNatalChart({ ...base, timePrecision: "approximate", timeValue: "12:30" });
  const interval = calculateWesternNatalChart({
    ...base,
    timePrecision: "interval",
    timeValue: "",
    timeStart: "08:00",
    timeEnd: "10:00"
  });

  for (const result of [exact.result, unknown.result, approximate.result]) {
    assert.equal(result.uncertainty.intervalAnalysis, undefined);
  }

  const analysis = interval.result.uncertainty.intervalAnalysis;
  assert.ok(analysis);
  assert.equal(analysis.schema, "astrolab.western_natal.interval_stability_analysis");
  assert.equal(analysis.interval.durationSeconds, 7200);
  assert.equal(analysis.targets.length, 9);

  const uncertaintyItem = interval.result.analysisPrototype.uncertainties.find(
    (entry) => entry.topic === "interval_time_output_stability"
  );
  assert.ok(uncertaintyItem);
  assert.equal(uncertaintyItem.status, analysis.summary.sensitiveTargets.length > 0 ? "sensitive" : "stable");
  assert.deepEqual(uncertaintyItem.affectedOutputs, analysis.summary.sensitiveTargets);

  // interval mode still refuses to invent an exact chart
  assert.equal(interval.result.astronomicalCalculation.angles.ascendant, null);
  assert.equal(interval.result.structuralAstrology.houses.houses.length, 0);
});

test("interval chart runs remain reproducible", () => {
  const base = {
    personId: "person_repro",
    birthDate: "1986-01-02",
    birthPlace: "Courbevoie, France",
    latitude: 48.89672,
    longitude: 2.25666,
    timeZone: "Europe/Paris",
    coordinateSource: "test_fixture",
    coordinateConfidence: "verified_fixture",
    timePrecision: "interval",
    timeValue: "",
    timeStart: "08:00",
    timeEnd: "10:00"
  };
  const first = calculateWesternNatalChart(base);
  const second = calculateWesternNatalChart(base);
  assert.equal(first.calculationRun.resultHash, second.calculationRun.resultHash);
});
