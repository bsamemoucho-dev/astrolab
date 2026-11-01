import { SIGN_NAMES } from "./constants.mjs";

const OPPOSITE_ANGLE = Object.freeze({ ascendant: "descendant", descendant: "ascendant", midheaven: "imumCoeli", imumCoeli: "midheaven" });
const oppositeSign = (sign) => {
  const index = SIGN_NAMES.indexOf(sign);
  return index < 0 ? null : SIGN_NAMES[(index + 6) % 12];
};
const oppositeLongitude = (longitude) => Number.isFinite(longitude) ? Number(((longitude + 180) % 360).toFixed(6)) : null;

function stableWindow(window) {
  return window?.signStable === true
    && SIGN_NAMES.includes(window.signAtWindowStart)
    && window.signAtWindowStart === window.signAtWindowEnd
    && Array.isArray(window.signsInWindow) && window.signsInWindow.length > 0
    && window.signsInWindow.every((sign) => sign === window.signAtWindowStart);
}

// Older saved calculations carried windows for ASC/MC only. Recover the
// opposite pole's uncertainty from geometry, never from a guessed birth time.
export function angleSignWindow(angles, angleKey) {
  const windows = angles?.uncertaintyWindow;
  const own = windows?.[angleKey];
  const other = windows?.[OPPOSITE_ANGLE[angleKey]];
  if (own) {
    const oppositeConsistent = !other || (stableWindow(other)
      && own.signAtWindowStart === oppositeSign(other.signAtWindowStart)
      && own.signAtWindowEnd === oppositeSign(other.signAtWindowEnd));
    return { ...own, signStable: stableWindow(own) && oppositeConsistent };
  }
  if (!other) return null;
  return {
    ...other,
    signStable: stableWindow(other),
    longitudeAtWindowStart: oppositeLongitude(other.longitudeAtWindowStart),
    longitudeAtWindowEnd: oppositeLongitude(other.longitudeAtWindowEnd),
    signAtWindowStart: oppositeSign(other.signAtWindowStart),
    signAtWindowEnd: oppositeSign(other.signAtWindowEnd),
    signsInWindow: (other.signsInWindow ?? []).map(oppositeSign).filter(Boolean)
  };
}

export function angleSignCertainty(natalResult, angleKey) {
  const timePrecision = natalResult?.uncertainty?.timePrecision ?? natalResult?.normalizedInput?.timePrecision ?? null;
  const angles = natalResult?.astronomicalCalculation?.angles;
  const window = angleSignWindow(angles, angleKey);
  const marginMinutes = Number(angles?.uncertaintyWindow?.marginMinutes ?? natalResult?.uncertainty?.margin?.marginMinutes ?? natalResult?.normalizedInput?.timeMarginMinutes);
  const certifiedMargin = Number.isFinite(marginMinutes) && marginMinutes > 0 && marginMinutes <= 60;
  const nominalSignMatchesWindow = window?.signAtWindowStart === angles?.[angleKey]?.sign;
  return {
    timePrecision,
    stableAcrossApplicableWindow: timePrecision === "exact" || (timePrecision === "approximate" && certifiedMargin && window?.signStable === true && nominalSignMatchesWindow),
    basis: timePrecision === "exact" ? "exact_time" : "declared_angle_window",
    ...(window ? { signsInWindow: [...(window.signsInWindow ?? [])] } : {})
  };
}
