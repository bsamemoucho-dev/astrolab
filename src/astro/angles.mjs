import { SIGN_NAMES, TRADITIONAL_RULERS } from "./constants.mjs";
import {
  asinDeg,
  atan2Deg,
  cosDeg,
  normalizeDegrees,
  normalizeSignedDegrees,
  round,
  sinDeg,
  tanDeg
} from "./math.mjs";
import { gmstDegrees } from "./time.mjs";

export const ANGLE_STATUS = "development_calculation_requires_ephemeris_validation";

export function zodiacPlacement(longitude) {
  const normalized = normalizeDegrees(longitude);
  const signIndex = Math.floor(normalized / 30);
  return {
    longitude: round(normalized, 6),
    signIndex,
    sign: SIGN_NAMES[signIndex],
    degreeInSign: round(normalized - signIndex * 30, 6),
    ruler: TRADITIONAL_RULERS[SIGN_NAMES[signIndex]]
  };
}

export function obliquity(jd) {
  const t = (jd - 2451545.0) / 36525;
  return 23.439291111 - 0.013004167 * t;
}

function eclipticToEquatorial(longitude, latitude, epsilon) {
  const rightAscension = normalizeDegrees(
    atan2Deg(
      sinDeg(longitude) * cosDeg(epsilon) - tanDeg(latitude) * sinDeg(epsilon),
      cosDeg(longitude)
    )
  );
  const declination = asinDeg(
    sinDeg(latitude) * cosDeg(epsilon) + cosDeg(latitude) * sinDeg(epsilon) * sinDeg(longitude)
  );
  return { rightAscension, declination };
}

export function altitude(longitude, jd, observerLatitude, observerLongitude) {
  const epsilon = obliquity(jd);
  const localSiderealTime = normalizeDegrees(gmstDegrees(jd) + observerLongitude);
  const { rightAscension, declination } = eclipticToEquatorial(longitude, 0, epsilon);
  const hourAngle = normalizeSignedDegrees(localSiderealTime - rightAscension);
  return asinDeg(
    sinDeg(observerLatitude) * sinDeg(declination) +
      cosDeg(observerLatitude) * cosDeg(declination) * cosDeg(hourAngle)
  );
}

export function calculateAngles({ jd, latitude, longitude }) {
  const epsilon = obliquity(jd);
  const localSiderealTime = normalizeDegrees(gmstDegrees(jd) + longitude);
  const midheaven = normalizeDegrees(
    atan2Deg(sinDeg(localSiderealTime) / cosDeg(epsilon), cosDeg(localSiderealTime))
  );
  const ascendant = normalizeDegrees(
    atan2Deg(
      cosDeg(localSiderealTime),
      -(sinDeg(localSiderealTime) * cosDeg(epsilon) + tanDeg(latitude) * sinDeg(epsilon))
    )
  );

  return {
    ascendant: { ...zodiacPlacement(ascendant), status: ANGLE_STATUS },
    descendant: { ...zodiacPlacement(ascendant + 180), status: ANGLE_STATUS },
    midheaven: { ...zodiacPlacement(midheaven), status: ANGLE_STATUS },
    imumCoeli: { ...zodiacPlacement(midheaven + 180), status: ANGLE_STATUS },
    localSiderealTime: round(localSiderealTime, 6),
    obliquity: round(epsilon, 6)
  };
}
