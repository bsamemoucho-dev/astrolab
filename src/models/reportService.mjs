import { validateAiNarrativeDraft } from "../core/validation.mjs";

const REPORT_ENGINE_VERSION = "0.1.0";

function now() {
  return new Date().toISOString();
}

function requireAnalysisState(state, userId, analysisId) {
  const analysis = state.analyses.find((entry) => entry.id === analysisId && entry.ownerUserId === userId);
  if (!analysis) {
    const error = new Error("Analysis not found");
    error.status = 404;
    throw error;
  }

  const versions = state.analysisVersions.filter((entry) => entry.analysisId === analysis.id);
  const latestVersion = versions.at(-1);
  if (!latestVersion) {
    const error = new Error("Analysis has no version");
    error.status = 409;
    throw error;
  }

  const methodResults = state.methodResults.filter((entry) => entry.analysisVersionId === latestVersion.id);
  const transversalFindings = state.transversalFindings.filter((entry) => entry.analysisVersionId === latestVersion.id);
  return { analysis, version: latestVersion, methodResults, transversalFindings };
}

function buildSections({ analysis, version, methodResults, transversalFindings }) {
  const successfulResults = methodResults.filter((result) => result.status === "succeeded");
  const unavailableResults = methodResults.filter((result) => result.status !== "succeeded");
  const indeterminateFindings = transversalFindings.filter((finding) => finding.type === "indeterminate");

  return [
    {
      id: "context",
      title: "Contexte",
      layer: "calculation_result",
      body: `Analyse ${analysis.scope} créée à partir du snapshot ${version.id}.`,
      sourceIds: [],
      findingIds: []
    },
    {
      id: "method-status",
      title: "Méthodes",
      layer: "calculation_result",
      body: `${successfulResults.length} méthode(s) réussie(s), ${unavailableResults.length} méthode(s) indisponible(s).`,
      sourceIds: [],
      findingIds: []
    },
    {
      id: "transversal-status",
      title: "Synthèse transversale",
      layer: "transversal_inference",
      body:
        indeterminateFindings.length > 0
          ? "La synthèse reste indéterminée car les résultats structurés disponibles ne suffisent pas."
          : "Une synthèse transversale structurée est disponible.",
      sourceIds: [],
      findingIds: transversalFindings.map((finding) => finding.id)
    }
  ];
}

function validateSections(sections) {
  for (const section of sections) {
    if (section.layer === "transversal_inference") {
      validateAiNarrativeDraft({
        draft: section.body,
        structuredFindingIds: section.findingIds,
        unsupportedClaims: []
      });
    }
  }
}

export async function listReports(store, userId, analysisId) {
  const state = await store.load();
  const analysis = state.analyses.find((entry) => entry.id === analysisId && entry.ownerUserId === userId);
  if (!analysis) {
    const error = new Error("Analysis not found");
    error.status = 404;
    throw error;
  }

  return state.reports
    .filter((entry) => entry.analysisId === analysisId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createReport(store, userId, analysisId) {
  return store.transact((state) => {
    const analysisState = requireAnalysisState(state, userId, analysisId);
    const sections = buildSections(analysisState);
    validateSections(sections);

    const hasSuccessfulResults = analysisState.methodResults.some((result) => result.status === "succeeded");
    const hasDeterminateFinding = analysisState.transversalFindings.some((finding) => finding.type !== "indeterminate");
    const report = {
      id: store.id("report"),
      ownerUserId: userId,
      analysisId,
      analysisVersionId: analysisState.version.id,
      reportEngineVersion: REPORT_ENGINE_VERSION,
      status: hasSuccessfulResults && hasDeterminateFinding ? "draft" : "blocked",
      sections,
      guardrails: {
        aiGenerated: false,
        unsupportedClaims: [],
        validatedAt: now()
      },
      limits: hasSuccessfulResults && hasDeterminateFinding ? [] : ["Report remains blocked until structured method results and determinate transversal findings exist."],
      createdAt: now()
    };

    state.reports.push(report);
    state.auditLogs.push({
      id: store.id("audit"),
      actorUserId: userId,
      ownerUserId: userId,
      action: "report.created",
      subjectType: "Report",
      subjectId: report.id,
      before: null,
      after: { report },
      createdAt: now()
    });
    return report;
  });
}
