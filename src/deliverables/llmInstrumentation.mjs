import { randomUUID } from "node:crypto";

const NON_OBSERVABLE = "non observable";

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function emptyBucket() {
  return {
    logicalCalls: 0,
    successfulLogicalCalls: 0,
    failedLogicalCalls: 0,
    applicationAttempts: 0
  };
}

function addBucket(map, key, patch) {
  const bucket = map.get(key) ?? emptyBucket();
  for (const [field, value] of Object.entries(patch)) {
    bucket[field] = (bucket[field] ?? 0) + value;
  }
  map.set(key, bucket);
}

function errorTypeFor(error) {
  if (!error) return null;
  if (error.name === "AbortError" || error.code === "ABORT_ERR" || error.code === "ETIMEDOUT") return "timeout";
  if (error.status === 429) return "rate_limit";
  if (Number(error.status) >= 500) return "server_error";
  if (error.code === "structured_parse_error") return "parse_error";
  if (error.code === "structured_validation_error") return "validation_correction";
  return error.code ?? error.name ?? "other";
}

function retryReasonFor(error) {
  const type = errorTypeFor(error);
  if (type === "timeout") return "timeout";
  if (type === "rate_limit") return "rate_limit";
  if (type === "server_error") return "server_error";
  if (type === "parse_error") return "parse_error";
  if (type === "validation_correction") return "validation_correction";
  return "other";
}

export function createLlmInstrumentationCollector({ runId = null, transportObservable = true, clock = null } = {}) {
  const collectorRunId = runId ?? randomUUID();
  const startedAtMs = clock?.nowMs?.() ?? nowMs();
  const startedAt = clock?.nowIso?.() ?? nowIso();
  const logicalCalls = [];
  const applicationAttempts = [];
  const logicalById = new Map();
  let finalizedAtMs = null;
  let logicalSeq = 0;

  function currentMs() {
    return clock?.nowMs?.() ?? nowMs();
  }

  function currentIso() {
    return clock?.nowIso?.() ?? nowIso();
  }

  function startLogicalCall({ sectionId, blockId }) {
    logicalSeq += 1;
    const logicalCallId = `${sectionId ?? "section"}.${blockId ?? "block"}.${logicalSeq}`;
    const entry = {
      runId: collectorRunId,
      sectionId: sectionId ?? null,
      blockId: blockId ?? null,
      logicalCallId,
      startedAt: currentIso(),
      _startedAtMs: currentMs(),
      logicalDurationMs: null,
      status: "failed",
      applicationAttemptCount: 0,
      transportAttemptCount: transportObservable ? 0 : NON_OBSERVABLE
    };
    logicalCalls.push(entry);
    logicalById.set(logicalCallId, entry);
    return logicalCallId;
  }

  function finishLogicalCall({ logicalCallId, status }) {
    const entry = logicalById.get(logicalCallId);
    if (!entry) return;
    entry.status = status === "success" ? "success" : "failed";
    entry.logicalDurationMs = Math.max(0, currentMs() - entry._startedAtMs);
  }

  function recordApplicationAttempt({
    sectionId,
    blockId,
    logicalCallId,
    applicationAttempt,
    isRetry = false,
    retryReason = "initial",
    model = null,
    startedAt,
    durationMs = 0,
    inputTokens = 0,
    outputTokens = 0,
    totalTokens = null,
    requestId = null,
    status = "error",
    errorType = null,
    transportAttempts = transportObservable ? 1 : NON_OBSERVABLE
  }) {
    const logical = logicalById.get(logicalCallId);
    if (logical) {
      logical.applicationAttemptCount += 1;
      if (transportObservable && typeof logical.transportAttemptCount === "number") {
        logical.transportAttemptCount += typeof transportAttempts === "number" ? transportAttempts : 0;
      }
    }
    applicationAttempts.push({
      runId: logical?.runId ?? runId ?? null,
      sectionId: sectionId ?? logical?.sectionId ?? null,
      blockId: blockId ?? logical?.blockId ?? null,
      logicalCallId,
      applicationAttempt,
      isRetry: Boolean(isRetry),
      retryReason,
      model,
      startedAt,
      durationMs: Math.max(0, durationMs ?? 0),
      inputTokens: inputTokens ?? 0,
      outputTokens: outputTokens ?? 0,
      totalTokens: totalTokens ?? null,
      requestId: requestId ?? null,
      status: status === "success" ? "success" : "error",
      errorType: errorType ?? null
    });
  }

  function finalize() {
    finalizedAtMs = finalizedAtMs ?? currentMs();
    return report();
  }

  function report() {
    const callsBySection = new Map();
    const callsByBlock = new Map();
    const attemptsByBlock = new Map();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalAttemptDurationMs = 0;
    for (const call of logicalCalls) {
      addBucket(callsBySection, call.sectionId ?? "unknown", {
        logicalCalls: 1,
        successfulLogicalCalls: call.status === "success" ? 1 : 0,
        failedLogicalCalls: call.status === "success" ? 0 : 1
      });
      addBucket(callsByBlock, call.blockId ?? "unknown", {
        logicalCalls: 1,
        successfulLogicalCalls: call.status === "success" ? 1 : 0,
        failedLogicalCalls: call.status === "success" ? 0 : 1
      });
    }
    for (const attempt of applicationAttempts) {
      addBucket(attemptsByBlock, attempt.blockId ?? "unknown", { applicationAttempts: 1 });
      totalInputTokens += attempt.inputTokens ?? 0;
      totalOutputTokens += attempt.outputTokens ?? 0;
      totalTokens += attempt.totalTokens ?? (attempt.inputTokens ?? 0) + (attempt.outputTokens ?? 0);
      totalAttemptDurationMs += attempt.durationMs ?? 0;
    }
    const transportObservableNow = transportObservable && logicalCalls.every((call) => typeof call.transportAttemptCount === "number");
    const transportAttempts = transportObservableNow
      ? logicalCalls.reduce((sum, call) => sum + call.transportAttemptCount, 0)
      : NON_OBSERVABLE;
    return {
      runId: collectorRunId,
      logicalCalls: logicalCalls.length,
      successfulLogicalCalls: logicalCalls.filter((call) => call.status === "success").length,
      failedLogicalCalls: logicalCalls.filter((call) => call.status !== "success").length,
      applicationAttempts: applicationAttempts.length,
      successfulApplicationAttempts: applicationAttempts.filter((attempt) => attempt.status === "success").length,
      failedApplicationAttempts: applicationAttempts.filter((attempt) => attempt.status !== "success").length,
      applicationRetries: applicationAttempts.filter((attempt) => attempt.isRetry).length,
      transportAttempts,
      transportRetries: transportObservableNow ? Math.max(0, transportAttempts - applicationAttempts.length) : NON_OBSERVABLE,
      callsBySection: Object.fromEntries(callsBySection),
      callsByBlock: Object.fromEntries(callsByBlock),
      attemptsByBlock: Object.fromEntries(attemptsByBlock),
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalAttemptDurationMs,
      wallClockMs: Math.max(0, (finalizedAtMs ?? currentMs()) - startedAtMs),
      startedAt,
      finalizedAt: finalizedAtMs ? new Date(finalizedAtMs).toISOString() : null,
      logicalCallDetails: logicalCalls.map(({ _startedAtMs, ...entry }) => entry),
      applicationAttemptDetails: applicationAttempts
    };
  }

  return {
    get runId() {
      return collectorRunId;
    },
    startLogicalCall,
    finishLogicalCall,
    recordApplicationAttempt,
    finalize,
    report,
    retryReasonFor,
    errorTypeFor
  };
}
