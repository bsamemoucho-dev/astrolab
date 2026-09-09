export function normalizeDegrees(value) {
  const result = value % 360;
  return result < 0 ? result + 360 : result;
}

export function normalizeSignedDegrees(value) {
  const normalized = normalizeDegrees(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

export function degToRad(value) {
  return (value * Math.PI) / 180;
}

export function radToDeg(value) {
  return (value * 180) / Math.PI;
}

export function sinDeg(value) {
  return Math.sin(degToRad(value));
}

export function cosDeg(value) {
  return Math.cos(degToRad(value));
}

export function tanDeg(value) {
  return Math.tan(degToRad(value));
}

export function atan2Deg(y, x) {
  return radToDeg(Math.atan2(y, x));
}

export function asinDeg(value) {
  return radToDeg(Math.asin(value));
}

export function round(value, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

