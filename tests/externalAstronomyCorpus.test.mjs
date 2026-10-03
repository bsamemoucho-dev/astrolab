import assert from "node:assert/strict";
import test from "node:test";

import { SEVEN_TRADITIONAL_BODIES } from "../src/astro/constants.mjs";
import { calculateBodyPositions } from "../src/astro/ephemeris.mjs";
import { julianDay } from "../src/astro/time.mjs";
import { createMoonPhaseEvent, findMotionStations } from "../src/astro/westernTransits.mjs";
import { EXTERNAL_ASTRONOMY_REFERENCE_CORPUS } from "./fixtures/externalAstronomyReferenceCorpus.mjs";

function circularDifference(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

test("le corpus externe figé est structuré, sourcé et sans dépendance réseau", () => {
  const corpus = EXTERNAL_ASTRONOMY_REFERENCE_CORPUS;
  assert.equal(corpus.runtimeNetworkAllowed, false);
  assert.ok(corpus.retrievedAt);
  assert.ok(corpus.positionReferences.length >= 3);
  assert.ok(corpus.phaseReferences.length >= 4);
  assert.ok(corpus.stationReferences.length >= 2);
  const scalarReferenceCount =
    corpus.positionReferences.reduce((count, reference) => count + Object.keys(reference.positions).length, 0) +
    corpus.phaseReferences.length +
    corpus.stationReferences.length;
  assert.ok(scalarReferenceCount >= 30);

  for (const group of [corpus.positionReferences, corpus.phaseReferences, corpus.stationReferences]) {
    for (const reference of group) {
      assert.ok(reference.source);
      assert.ok(reference.retrievedAt);
      assert.ok(reference.tolerance);
    }
  }
});

test("Astronomy Engine reste dans les tolérances du sous-corpus JPL Horizons", () => {
  for (const reference of EXTERNAL_ASTRONOMY_REFERENCE_CORPUS.positionReferences) {
    const calculated = calculateBodyPositions(SEVEN_TRADITIONAL_BODIES, julianDay(new Date(reference.utc)));
    for (const position of calculated) {
      const expected = reference.positions[position.body];
      assert.ok(expected, `missing external reference for ${position.body}`);
      assert.ok(circularDifference(position.longitude, expected.longitude) <= reference.tolerance.longitudeDegrees);
      assert.ok(Math.abs(position.latitude - expected.latitude) <= reference.tolerance.latitudeDegrees);
    }
  }
});

test("les phases lunaires et stations restent dans les tolérances externes figées", () => {
  for (const reference of EXTERNAL_ASTRONOMY_REFERENCE_CORPUS.phaseReferences) {
    const targetLongitude = reference.phase === "new_moon" ? 0 : 180;
    const startUtc = new Date(new Date(reference.utc).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const event = createMoonPhaseEvent({
      id: `reference.${reference.phase}.${reference.utc}`,
      eventType: reference.phase,
      targetLongitude,
      startUtc,
      limitDays: 8
    });
    const deltaMinutes = Math.abs(new Date(event.peakUtc).getTime() - new Date(reference.utc).getTime()) / 60000;
    assert.ok(deltaMinutes <= reference.tolerance.minutes, `${reference.phase} ${reference.utc} delta ${deltaMinutes} min`);
  }

  for (const reference of EXTERNAL_ASTRONOMY_REFERENCE_CORPUS.stationReferences) {
    const startUtc = new Date(new Date(reference.utc).getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const endUtc = new Date(new Date(reference.utc).getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const station = findMotionStations({ body: reference.body, startUtc, endUtc }).find(
      (event) => event.eventType === reference.stationType
    );
    assert.ok(station, `missing station ${reference.body} ${reference.stationType}`);
    const deltaHours = Math.abs(new Date(station.peakUtc).getTime() - new Date(reference.utc).getTime()) / 3600000;
    assert.ok(deltaHours <= reference.tolerance.hours, `${reference.body} ${reference.stationType} delta ${deltaHours} h`);
  }
});
