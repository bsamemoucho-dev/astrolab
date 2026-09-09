import * as Astronomy from "astronomy-engine";

import { ASTRONOMY_ENGINE_VERSION, EPHEMERIS_VERSION } from "./constants.mjs";
import { normalizeSignedDegrees, round } from "./math.mjs";

const BODY_MAP = Object.freeze({
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn
});

function dateFromJulianDay(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

function astronomyBody(body) {
  const mapped = BODY_MAP[body];
  if (!mapped) {
    const error = new Error(`Unsupported astronomical body: ${body}`);
    error.status = 400;
    throw error;
  }
  return mapped;
}

export function rawBodyPosition(body, jd) {
  const date = dateFromJulianDay(jd);
  if (body === "Sun") {
    const position = Astronomy.SunPosition(date);
    return {
      longitude: position.elon,
      latitude: position.elat,
      distance: position.vec.Length()
    };
  }
  if (body === "Moon") {
    const position = Astronomy.EclipticGeoMoon(date);
    return {
      longitude: position.lon,
      latitude: position.lat,
      distance: position.dist
    };
  }

  const vector = Astronomy.GeoVector(astronomyBody(body), date, true);
  const position = Astronomy.Ecliptic(vector);
  return {
    longitude: position.elon,
    latitude: position.elat,
    distance: position.vec.Length()
  };
}

export function bodyPosition(body, jd) {
  const current = rawBodyPosition(body, jd);
  const before = rawBodyPosition(body, jd - 0.5);
  const after = rawBodyPosition(body, jd + 0.5);
  const dailyMotion = normalizeSignedDegrees(after.longitude - before.longitude);
  return {
    body,
    longitude: round(current.longitude),
    latitude: round(current.latitude),
    distance: round(current.distance),
    apparentMotion: {
      dailyLongitudeDelta: round(dailyMotion),
      retrograde: body === "Sun" || body === "Moon" ? false : dailyMotion < 0,
      status: "calculated_by_astronomy_engine"
    },
    coordinateSystem: "geocentric_apparent_true_ecliptic_of_date",
    engineVersion: ASTRONOMY_ENGINE_VERSION,
    ephemerisVersion: EPHEMERIS_VERSION
  };
}

export function calculateBodyPositions(bodies, jd) {
  return bodies.map((body) => bodyPosition(body, jd));
}
