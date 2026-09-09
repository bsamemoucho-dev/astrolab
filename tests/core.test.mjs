import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTransversalFinding,
  classifyBirthTimePrecision,
  normalizeMethodModule,
  validateAiNarrativeDraft,
  validateAnalysisLayer,
  validateMethodResult
} from "../src/core/validation.mjs";
import { setSessionCookie } from "../src/http/httpUtils.mjs";
import { buildInitialTransversalFindings } from "../src/models/transversalEngine.mjs";

test("non-validated or undocumented method modules are not production eligible", () => {
  assert.equal(
    normalizeMethodModule({
      methodId: "western.placeholder",
      status: "not_implemented",
      sources: []
    }).productionEligible,
    false
  );

  const undocumented = normalizeMethodModule({
    methodId: "western.empty",
    status: "validated_v1",
    sources: []
  });

  assert.equal(undocumented.status, "documentation_insufficient");
  assert.equal(undocumented.productionEligible, false);
});

test("analysis layers keep tradition, calculation, transversal inference, hypothesis, and unknown separate", () => {
  for (const layer of [
    "tradition_claim",
    "calculation_result",
    "shared_cross_method_result",
    "transversal_inference",
    "experimental_hypothesis",
    "unknown"
  ]) {
    assert.equal(validateAnalysisLayer(layer), true);
  }

  assert.throws(() => validateAnalysisLayer("generic_ai_text"), /Unknown analysis layer/);
});

test("birth time uncertainty supports exact, interval, and unknown states", () => {
  assert.equal(classifyBirthTimePrecision({ timeValue: "14:37" }), "exact");
  assert.equal(classifyBirthTimePrecision({ timeStart: "14:00", timeEnd: "16:00" }), "interval");
  assert.equal(classifyBirthTimePrecision({}), "unknown");
});

test("successful method results must include structured output and uncertainty stability", () => {
  assert.equal(
    validateMethodResult({
      methodId: "method.a",
      methodVersion: "1.0.0",
      personId: "person_1",
      status: "succeeded",
      rawResult: { value: "structured" },
      uncertainty: { stability: "stable" }
    }),
    true
  );

  assert.throws(
    () =>
      validateMethodResult({
        methodId: "method.a",
        methodVersion: "1.0.0",
        personId: "person_1",
        status: "succeeded",
        rawResult: "text only",
        uncertainty: { stability: "stable" }
      }),
    /structured rawResult/
  );
});

test("transversal findings reject naive vote-count logic", () => {
  assert.throws(
    () =>
      buildTransversalFinding({
        type: "convergence",
        contributingResultIds: ["a", "b", "c"],
        stability: "stable",
        usesVoteCount: true
      }),
    /must not use method counts as votes/
  );
});

test("transversal findings require at least two structured contributors", () => {
  assert.throws(
    () =>
      buildTransversalFinding({
        type: "convergence",
        contributingResultIds: ["a"],
        stability: "stable"
      }),
    /at least two contributing results/
  );
});

test("initial transversal engine stays indeterminate without two successful method results", () => {
  const store = {
    id: (prefix) => `${prefix}_test`
  };
  const findings = buildInitialTransversalFindings(store, "analysis_version_1", [
    {
      id: "method_result_1",
      status: "not_implemented"
    },
    {
      id: "method_result_2",
      status: "documentation_insufficient"
    }
  ]);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "indeterminate");
  assert.equal(findings[0].dependencyAssessment, "not_evaluated");
  assert.equal(findings[0].stability, "indeterminate");
});

test("initial transversal engine does not infer relation type from result count", () => {
  const store = {
    id: (prefix) => `${prefix}_test`
  };
  const findings = buildInitialTransversalFindings(store, "analysis_version_1", [
    {
      id: "method_result_1",
      status: "succeeded"
    },
    {
      id: "method_result_2",
      status: "succeeded"
    },
    {
      id: "method_result_3",
      status: "succeeded"
    }
  ]);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "indeterminate");
  assert.deepEqual(findings[0].contributingResultIds, ["method_result_1", "method_result_2", "method_result_3"]);
  assert.match(findings[0].limits[0], /No validated cross-method comparison rule/);
});

test("AI narrative drafts are rejected when unsupported claims are detected", () => {
  assert.deepEqual(
    validateAiNarrativeDraft({
      draft: "Cette méthode fait ressortir une période sensible.",
      structuredFindingIds: ["finding_1"],
      unsupportedClaims: []
    }),
    {
      accepted: true,
      reason: null,
      unsupportedClaims: []
    }
  );

  assert.equal(
    validateAiNarrativeDraft({
      draft: "Votre destin est certain.",
      structuredFindingIds: ["finding_1"],
      unsupportedClaims: ["certainty_without_support"]
    }).accepted,
    false
  );
});

test("session cookies gain Secure flag in production", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.match(setSessionCookie("token"), /; Secure$/);
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
});
