// A small factual welcome card, computed with the same tropical ephemeris as
// the natal service. Calendar dates never stand in for a solar ingress.
import { rawBodyPosition } from "./ephemeris.mjs";
import { zodiacPlacement } from "./angles.mjs";
import { julianDay } from "./time.mjs";
import { ASTRONOMY_ENGINE_VERSION, EPHEMERIS_VERSION } from "./constants.mjs";

export const SEASONAL_SKY_SCHEMA = "lastro.seasonal_sky@1.0.0";
export const SEASONAL_SKY_TIME_ZONE = "Europe/Paris";
const SIGN_FR = Object.freeze({
  Aries: "Bélier", Taurus: "Taureau", Gemini: "Gémeaux", Cancer: "Cancer",
  Leo: "Lion", Virgo: "Vierge", Libra: "Balance", Scorpio: "Scorpion",
  Sagittarius: "Sagittaire", Capricorn: "Capricorne", Aquarius: "Verseau", Pisces: "Poissons"
});

export function buildSeasonalSky({ now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new RangeError("A valid reference Date is required.");
  }
  const instant = new Date(now.getTime());
  const longitude = rawBodyPosition("Sun", julianDay(instant)).longitude;
  const placement = zodiacPlacement(longitude);
  const localParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: SEASONAL_SKY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return {
    schema: SEASONAL_SKY_SCHEMA,
    asOfUtc: instant.toISOString(),
    referenceTimeZone: SEASONAL_SKY_TIME_ZONE,
    localDate: `${localParts.year}-${localParts.month}-${localParts.day}`,
    zodiac: "tropical",
    sun: {
      // Keep the computed longitude at full precision. Rounding it before sign
      // selection could change the sign immediately before an exact ingress.
      longitude,
      signId: placement.sign,
      signName: SIGN_FR[placement.sign],
      degreeInSign: longitude - placement.signIndex * 30
    },
    source: { engineVersion: ASTRONOMY_ENGINE_VERSION, ephemerisVersion: EPHEMERIS_VERSION }
  };
}
