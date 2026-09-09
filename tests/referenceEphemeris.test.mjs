import assert from "node:assert/strict";
import test from "node:test";

import { SEVEN_TRADITIONAL_BODIES, SIGN_NAMES } from "../src/astro/constants.mjs";
import { calculateBodyPositions } from "../src/astro/ephemeris.mjs";
import { julianDay, localDateTimeToUtc, parseDate, parseTime } from "../src/astro/time.mjs";
import { zodiacPlacement } from "../src/astro/westernNatal.mjs";

const JPL_HORIZONS_FIXTURES = [
  {
    source: "NASA/JPL Horizons API, observer ephemeris, CENTER=500@399, QUANTITIES=31 ObsEcLon/ObsEcLat, generated 2026-09-01",
    utc: "1986-01-02T00:00:00.000Z",
    positions: {
      Sun: { longitude: 281.285218, latitude: 0.0001295 },
      Moon: { longitude: 168.3443081, latitude: 3.7959428 },
      Mercury: { longitude: 264.3252764, latitude: 0.1548219 },
      Venus: { longitude: 277.0628884, latitude: -0.3703749 },
      Mars: { longitude: 221.1816368, latitude: 1.0238593 },
      Jupiter: { longitude: 318.468245, latitude: -0.8022763 },
      Saturn: { longitude: 245.2641825, latitude: 1.8073724 }
    }
  },
  {
    source: "NASA/JPL Horizons API, observer ephemeris, CENTER=500@399, QUANTITIES=31 ObsEcLon/ObsEcLat, generated 2026-09-01",
    utc: "2000-01-01T12:00:00.000Z",
    positions: {
      Sun: { longitude: 280.3689092, latitude: 0.0002381 },
      Moon: { longitude: 223.323786, latitude: 5.1707422 },
      Mercury: { longitude: 271.8892699, latitude: -0.994819 },
      Venus: { longitude: 241.5657794, latitude: 2.0663548 },
      Mars: { longitude: 327.9632921, latitude: -1.0677752 },
      Jupiter: { longitude: 25.2530685, latitude: -1.2621868 },
      Saturn: { longitude: 40.3956366, latitude: -2.4448533 }
    }
  },
  {
    source: "NASA/JPL Horizons API, observer ephemeris, CENTER=500@399, QUANTITIES=31 ObsEcLon/ObsEcLat, generated 2026-09-01",
    utc: "2024-03-20T03:06:00.000Z",
    positions: {
      Sun: { longitude: 359.9997093, latitude: 0.0001109 },
      Moon: { longitude: 123.8151802, latitude: 5.0063811 },
      Mercury: { longitude: 17.4409072, latitude: 1.4774826 },
      Venus: { longitude: 340.1712838, latitude: -1.289975 },
      Mars: { longitude: 327.7733973, latitude: -1.1734256 },
      Jupiter: { longitude: 44.8856241, latitude: -0.8526435 },
      Saturn: { longitude: 342.2254263, latitude: -1.6453503 }
    }
  }
];

function circularDifference(a, b) {
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return diff;
}

test("astronomy engine matches stored JPL Horizons apparent geocentric ecliptic fixtures", () => {
  for (const fixture of JPL_HORIZONS_FIXTURES) {
    const jd = julianDay(new Date(fixture.utc));
    const calculated = calculateBodyPositions(SEVEN_TRADITIONAL_BODIES, jd);
    for (const position of calculated) {
      const expected = fixture.positions[position.body];
      assert.ok(expected, `missing fixture for ${position.body}`);
      assert.ok(
        circularDifference(position.longitude, expected.longitude) <= 0.01,
        `${fixture.utc} ${position.body} longitude expected ${expected.longitude}, got ${position.longitude}`
      );
      assert.ok(
        Math.abs(position.latitude - expected.latitude) <= 0.02,
        `${fixture.utc} ${position.body} latitude expected ${expected.latitude}, got ${position.latitude}`
      );
      assert.equal(position.coordinateSystem, "geocentric_apparent_true_ecliptic_of_date");
    }
  }
});

test("local civil time conversion feeds UTC and astronomical position pipeline correctly", () => {
  const converted = localDateTimeToUtc({
    date: parseDate("1986-01-02"),
    time: parseTime("01:00"),
    timeZone: "Europe/Paris"
  });
  assert.equal(converted.utcInstant.toISOString(), "1986-01-02T00:00:00.000Z");
  assert.equal(converted.timezoneOffsetMinutes, 60);

  const sun = calculateBodyPositions(["Sun"], julianDay(converted.utcInstant))[0];
  assert.ok(circularDifference(sun.longitude, 281.285218) <= 0.01);
  assert.equal(zodiacPlacement(sun.longitude).sign, "Capricorn");
});

test("tropical longitude to sign conversion is exact at boundaries and for reference dates", () => {
  assert.deepEqual(
    [0, 29.999999, 30, 281.285218, 359.9997093].map((longitude) => zodiacPlacement(longitude).sign),
    ["Aries", "Aries", "Taurus", "Capricorn", "Pisces"]
  );
  assert.equal(SIGN_NAMES.length, 12);
});
