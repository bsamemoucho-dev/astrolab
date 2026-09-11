export const ASTROLAB_MODEL_VERSION = "0.2.0";
export const WESTERN_NATAL_METHOD_VERSION = "western-natal@0.1.0-draft";
export const ASTRONOMY_ENGINE_VERSION = "astronomy-engine@2.1.19";
export const EPHEMERIS_VERSION = "astronomy-engine-built-in-ephemeris@2.1.19";

// Marge d'incertitude retenue quand l'heure de naissance est approximative.
// Décision produit : « vers 10h » vaut ±30 min tant que le client ne précise
// rien, et le client peut élargir ou resserrer (15/30/60 min). La marge est
// TOUJOURS écrite dans l'annexe : sans elle, un angle calculé sur un instant de
// référence deviendrait une affirmation exacte, ce qu'il n'est pas.
export const UNCERTAINTY_MARGIN_DEFAULT_MINUTES = 30;
export const UNCERTAINTY_MARGIN_OPTIONS_MINUTES = Object.freeze([15, 30, 60]);
export const UNCERTAINTY_MARGIN_MAX_MINUTES = 720;

export const SIGN_NAMES = Object.freeze([
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces"
]);

export const TRADITIONAL_RULERS = Object.freeze({
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter"
});

export const SEVEN_TRADITIONAL_BODIES = Object.freeze([
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn"
]);
