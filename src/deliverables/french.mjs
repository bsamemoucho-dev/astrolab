// French vocabulary used by the client dossier layer (labelled "symbolic delivery").
// These labels are display conventions, not methodological rules.

export const FR_SIGNS = Object.freeze([
  { en: "Aries", fr: "Bélier", symbol: "♈" },
  { en: "Taurus", fr: "Taureau", symbol: "♉" },
  { en: "Gemini", fr: "Gémeaux", symbol: "♊" },
  { en: "Cancer", fr: "Cancer", symbol: "♋" },
  { en: "Leo", fr: "Lion", symbol: "♌" },
  { en: "Virgo", fr: "Vierge", symbol: "♍" },
  { en: "Libra", fr: "Balance", symbol: "♎" },
  { en: "Scorpio", fr: "Scorpion", symbol: "♏" },
  { en: "Sagittarius", fr: "Sagittaire", symbol: "♐" },
  { en: "Capricorn", fr: "Capricorne", symbol: "♑" },
  { en: "Aquarius", fr: "Verseau", symbol: "♒" },
  { en: "Pisces", fr: "Poissons", symbol: "♓" }
]);

const FR_TO_EN = Object.freeze(Object.fromEntries(FR_SIGNS.map((entry) => [entry.fr, entry.en])));

export const FR_BODIES = Object.freeze({
  Sun: "Soleil",
  Moon: "Lune",
  Mercury: "Mercure",
  Venus: "Vénus",
  Mars: "Mars",
  Jupiter: "Jupiter",
  Saturn: "Saturne"
});

export function frBody(enName) {
  return FR_BODIES[enName] ?? enName;
}

export function frSign(enName) {
  return FR_SIGNS.find((entry) => entry.en === enName) ?? { en: enName, fr: enName };
}

export function enSignFromFr(frName) {
  return FR_TO_EN[frName] ?? null;
}

export function formatDegreeInSign(degreeInSign) {
  const integer = Math.floor(degreeInSign);
  const minutes = Math.round((degreeInSign - integer) * 60);
  const normalizedMinutes = minutes >= 60 ? 59 : minutes;
  return `${integer}°${String(normalizedMinutes).padStart(2, "0")}′`;
}
