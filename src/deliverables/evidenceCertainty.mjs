// A nominal calculated value is not a licence to affirm an undecidable fact.
// Keep uncertain source values available for diagnostics and annotated annexes;
// this policy concerns unqualified claims and symbolic interpretation only.
const WINDOW_SENSITIVE_TYPES = new Set(["NATAL_BODY_SIGN", "NATAL_BODY_HOUSE", "ANGLE_SIGN", "NATAL_ASPECT"]);
const NO_SINGLE_ANGLE_TIME = new Set(["unknown", "interval"]);
const ANGLE_TRANSIT_POINTS = new Set(["asc", "dsc", "mc", "ic", "ascendant", "descendant", "midheaven", "imumcoeli"]);

export function isEvidenceDeterminateForClaim(evidence, { timePrecision = null } = {}) {
  if (!evidence) return false;
  const certainty = evidence.certainty;
  const angleTransit = evidence.type === "PERSONAL_TRANSIT" && ANGLE_TRANSIT_POINTS.has(String(evidence.value?.natalPoint ?? "").toLowerCase());
  const windowSensitive = WINDOW_SENSITIVE_TYPES.has(evidence.type) || angleTransit;
  if (certainty?.stableAcrossApplicableWindow === false) return false;
  const declaredPrecision = timePrecision == null ? null : String(timePrecision).toLowerCase();
  const proofPrecision = certainty?.timePrecision == null ? null : String(certainty.timePrecision).toLowerCase();
  if (declaredPrecision && proofPrecision && declaredPrecision !== proofPrecision && windowSensitive) return false;
  const precision = declaredPrecision ?? proofPrecision;
  if (evidence.type === "ANGLE_SIGN" || evidence.type === "NATAL_BODY_HOUSE" || angleTransit) {
    if (NO_SINGLE_ANGLE_TIME.has(precision)) return false;
  }
  if (windowSensitive && precision && precision !== "exact") {
    return certainty?.stableAcrossApplicableWindow === true;
  }
  // Existing atomic evidence with no time policy is a nominal fact contract.
  // Production DossierEvidence always supplies its birth-time precision; this
  // compatibility branch cannot override explicit false/unknown certainty.
  return true;
}
