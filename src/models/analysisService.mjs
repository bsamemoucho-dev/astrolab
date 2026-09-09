import { normalizeMethodModule, validateMethodResult } from "../core/validation.mjs";
import { buildInitialTransversalFindings } from "./transversalEngine.mjs";

const APP_VERSION = "0.1.0";
const ENGINE_VERSION = "0.1.0";

function now() {
  return new Date().toISOString();
}

function publicAnalysis(analysis, versions, methodResults, transversalFindings) {
  return {
    ...analysis,
    versions,
    methodResults,
    transversalFindings
  };
}

function dossierSnapshot(state, ownerUserId) {
  return structuredClone({
    people: state.persons.filter((entry) => entry.ownerUserId === ownerUserId),
    birthData: state.birthData.filter((entry) => entry.ownerUserId === ownerUserId),
    relationships: state.relationships.filter((entry) => entry.ownerUserId === ownerUserId),
    dataPoints: state.dataPoints.filter((entry) => entry.ownerUserId === ownerUserId),
    dataSources: state.dataSources.filter((entry) => entry.ownerUserId === ownerUserId)
  });
}

function methodUnavailableResult(store, analysisVersionId, method, primaryPersonId) {
  const normalized = normalizeMethodModule(method);
  const status = normalized.status === "not_implemented" ? "not_implemented" : "documentation_insufficient";
  const result = {
    id: store.id("method_result"),
    analysisVersionId,
    methodId: normalized.id,
    methodVersion: normalized.version,
    personId: primaryPersonId,
    dataUsed: [],
    parameters: {},
    rawResult: {},
    concepts: [],
    traditionalInterpretations: [],
    dataQuality: {
      status: "not_evaluated"
    },
    uncertainty: {
      stability: "indeterminate",
      reasons: ["method_unavailable"]
    },
    sources: normalized.sources ?? [],
    status,
    error: {
      code: status,
      message: normalized.notes ?? "Method is not available for production analysis."
    },
    createdAt: now()
  };

  validateMethodResult(result);
  return result;
}

function appendAudit(state, store, actorUserId, action, subjectType, subjectId, before, after) {
  state.auditLogs.push({
    id: store.id("audit"),
    actorUserId,
    ownerUserId: actorUserId,
    action,
    subjectType,
    subjectId,
    before,
    after,
    createdAt: now()
  });
}

export async function listAnalyses(store, userId) {
  const state = await store.load();
  return state.analyses
    .filter((entry) => entry.ownerUserId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((analysis) => {
      const versions = state.analysisVersions.filter((entry) => entry.analysisId === analysis.id);
      return publicAnalysis(analysis, versions, [], []);
    });
}

export async function getAnalysis(store, userId, analysisId) {
  const state = await store.load();
  const analysis = state.analyses.find((entry) => entry.id === analysisId && entry.ownerUserId === userId);
  if (!analysis) {
    const error = new Error("Analysis not found");
    error.status = 404;
    throw error;
  }

  const versions = state.analysisVersions.filter((entry) => entry.analysisId === analysis.id);
  const versionIds = new Set(versions.map((entry) => entry.id));
  const methodResults = state.methodResults.filter((entry) => versionIds.has(entry.analysisVersionId));
  const transversalFindings = state.transversalFindings.filter((entry) => versionIds.has(entry.analysisVersionId));
  return publicAnalysis(analysis, versions, methodResults, transversalFindings);
}

export async function createAnalysis(store, userId, input = {}) {
  return store.transact((state) => {
    const primary = state.persons.find((entry) => entry.ownerUserId === userId && entry.isPrimary);
    if (!primary) {
      const error = new Error("Primary profile is required before creating an analysis");
      error.status = 400;
      throw error;
    }

    const analysis = {
      id: store.id("analysis"),
      ownerUserId: userId,
      primaryPersonId: primary.id,
      scope: input.scope ?? "personal_profile",
      status: "partially_succeeded",
      createdAt: now(),
      updatedAt: now()
    };
    state.analyses.push(analysis);

    const version = {
      id: store.id("analysis_version"),
      analysisId: analysis.id,
      appVersion: APP_VERSION,
      engineVersion: ENGINE_VERSION,
      dataSnapshot: dossierSnapshot(state, userId),
      methodVersionIds: state.methods.map((method) => `${method.id}@${method.version}`),
      createdAt: now()
    };
    state.analysisVersions.push(version);

    const methodResults = state.methods.map((method) => methodUnavailableResult(store, version.id, method, primary.id));
    state.methodResults.push(...methodResults);

    const transversalFindings = buildInitialTransversalFindings(store, version.id, methodResults);
    state.transversalFindings.push(...transversalFindings);

    appendAudit(state, store, userId, "analysis.created", "Analysis", analysis.id, null, { analysis, version });
    return publicAnalysis(analysis, [version], methodResults, transversalFindings);
  });
}
