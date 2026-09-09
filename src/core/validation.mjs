import {
  ANALYSIS_LAYERS,
  METHOD_RESULT_STATUSES,
  METHOD_STATUSES,
  RESULT_RELATION_TYPES,
  STABILITY_CLASSES,
  TIME_PRECISIONS
} from "./domain.mjs";

const setOf = (values) => new Set(values);

const ANALYSIS_LAYER_SET = setOf(ANALYSIS_LAYERS);
const METHOD_STATUS_SET = setOf(METHOD_STATUSES);
const METHOD_RESULT_STATUS_SET = setOf(METHOD_RESULT_STATUSES);
const RESULT_RELATION_TYPE_SET = setOf(RESULT_RELATION_TYPES);
const STABILITY_CLASS_SET = setOf(STABILITY_CLASSES);
const TIME_PRECISION_SET = setOf(TIME_PRECISIONS);

export function assertKnownValue(kind, value, allowed) {
  if (!allowed.has(value)) {
    throw new Error(`Unknown ${kind}: ${value}`);
  }
}

export function normalizeMethodModule(module) {
  assertKnownValue("method status", module.status, METHOD_STATUS_SET);

  if (module.status !== "validated_v1") {
    return {
      ...module,
      productionEligible: false
    };
  }

  if (!Array.isArray(module.sources) || module.sources.length === 0) {
    return {
      ...module,
      status: "documentation_insufficient",
      productionEligible: false
    };
  }

  return {
    ...module,
    productionEligible: true
  };
}

export function validateMethodResult(result) {
  assertKnownValue("method result status", result.status, METHOD_RESULT_STATUS_SET);

  if (!result.methodId || !result.methodVersion || !result.personId) {
    throw new Error("Method result must include methodId, methodVersion, and personId");
  }

  if (result.status === "succeeded") {
    if (!result.rawResult || typeof result.rawResult !== "object") {
      throw new Error("Successful method result must include structured rawResult");
    }

    if (!result.uncertainty || !STABILITY_CLASS_SET.has(result.uncertainty.stability)) {
      throw new Error("Successful method result must include uncertainty.stability");
    }
  }

  return true;
}

export function validateAnalysisLayer(layer) {
  assertKnownValue("analysis layer", layer, ANALYSIS_LAYER_SET);
  return true;
}

export function classifyBirthTimePrecision({ timeValue, timeStart, timeEnd }) {
  if (!timeValue && !timeStart && !timeEnd) {
    return "unknown";
  }

  if (timeStart && timeEnd) {
    return timeStart === timeEnd ? "exact" : "interval";
  }

  if (timeValue) {
    return "exact";
  }

  return "approximate";
}

export function validateBirthTimePrecision(precision) {
  assertKnownValue("time precision", precision, TIME_PRECISION_SET);
  return true;
}

export function buildTransversalFinding(input) {
  assertKnownValue("result relation type", input.type, RESULT_RELATION_TYPE_SET);
  assertKnownValue("stability", input.stability, STABILITY_CLASS_SET);

  if (!Array.isArray(input.contributingResultIds) || input.contributingResultIds.length < 2) {
    throw new Error("Transversal finding needs at least two contributing results");
  }

  if (input.usesVoteCount === true) {
    throw new Error("Transversal findings must not use method counts as votes");
  }

  return {
    type: input.type,
    dimensions: input.dimensions ?? [],
    contributingResultIds: input.contributingResultIds,
    evidence: input.evidence ?? [],
    dependencyAssessment: input.dependencyAssessment ?? "independence_unknown",
    stability: input.stability,
    limits: input.limits ?? [],
    status: input.status ?? "production"
  };
}

export function validateAiNarrativeDraft({ draft, structuredFindingIds, unsupportedClaims }) {
  if (!draft || typeof draft !== "string") {
    throw new Error("AI narrative draft must be text");
  }

  if (!Array.isArray(structuredFindingIds) || structuredFindingIds.length === 0) {
    throw new Error("AI narrative must be linked to structured findings");
  }

  if (Array.isArray(unsupportedClaims) && unsupportedClaims.length > 0) {
    return {
      accepted: false,
      reason: "unsupported_claims",
      unsupportedClaims
    };
  }

  return {
    accepted: true,
    reason: null,
    unsupportedClaims: []
  };
}

