import { buildTransversalFinding } from "../core/validation.mjs";

function now() {
  return new Date().toISOString();
}

export function buildInitialTransversalFindings(store, analysisVersionId, methodResults) {
  const successfulResults = methodResults.filter((result) => result.status === "succeeded");

  if (successfulResults.length < 2) {
    return [
      {
        id: store.id("finding"),
        analysisVersionId,
        ...buildTransversalFinding({
          type: "indeterminate",
          contributingResultIds: methodResults.map((result) => result.id),
          dependencyAssessment: "not_evaluated",
          stability: "indeterminate",
          limits: ["At least two successful structured method results are required before transversal comparison."],
          status: "laboratory"
        }),
        createdAt: now()
      }
    ];
  }

  return [
    {
      id: store.id("finding"),
      analysisVersionId,
      ...buildTransversalFinding({
        type: "indeterminate",
        contributingResultIds: successfulResults.map((result) => result.id),
        dependencyAssessment: "independence_unknown",
        stability: "indeterminate",
        limits: ["No validated cross-method comparison rule is active yet."],
        status: "laboratory"
      }),
      createdAt: now()
    }
  ];
}
