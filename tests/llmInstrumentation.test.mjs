import assert from "node:assert/strict";
import test from "node:test";

import { createLlmInstrumentationCollector } from "../src/deliverables/llmInstrumentation.mjs";
import { buildIndividualRelationalCommunicationPlan } from "../src/deliverables/individualRelationalPlan.mjs";
import { writeStructuredSectionWithLlm } from "../src/deliverables/structuredSectionWriter.mjs";

function natalSign(body, sign) {
  return {
    evidenceId: `natal.${body.toLowerCase()}.sign`,
    type: "NATAL_BODY_SIGN",
    value: { body, sign, degreeInSign: 10, longitude: 10 },
    provenance: { reliability: "HIGH", methodVersion: "test", ruleVersion: null }
  };
}

function natalAspect(bodyA, bodyB, aspectType, orb = 1) {
  const ordered = [bodyA, bodyB].sort((left, right) => left.localeCompare(right));
  return {
    evidenceId: `aspect.${ordered[0].toLowerCase()}.${ordered[1].toLowerCase()}.${aspectType}`,
    type: "NATAL_ASPECT",
    value: { bodyA, bodyB, aspectType, orb, orbLimit: 8, exactness: orb, ruleVersion: "lastro-aspects@1.0.0" },
    provenance: { reliability: "HIGH", methodVersion: "western-natal@test", ruleVersion: "lastro-aspects@1.0.0" }
  };
}

function dossier(items = []) {
  return {
    schema: "astrolab.dossier_evidence",
    version: "test",
    evidence: [natalSign("Mercury", "Cancer"), natalSign("Moon", "Leo"), ...items]
  };
}

function planForFixture() {
  const dossierEvidence = dossier([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  const plan = buildIndividualRelationalCommunicationPlan(dossierEvidence);
  return { dossierEvidence, sectionPlan: plan.sections[0] };
}

function oneBlockSectionPlan(sectionPlan, blockId = "spontaneous_dynamic") {
  const block = sectionPlan.blockPlans.find((entry) => entry.blockId === blockId);
  return {
    ...sectionPlan,
    blockPlans: [block],
    evidencePackets: sectionPlan.evidencePackets.filter((packet) => block.packetRefs.includes(packet.packetId))
  };
}

function response({ blockId, text, requestId = null, usage = { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } }) {
  return {
    ok: true,
    headers: { get: (name) => (name.toLowerCase() === "x-request-id" ? requestId : null) },
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({
        sectionId: "relational_communication",
        contractVersion: "structured-section-writer@0.1.0",
        blocks: [{ blockId, text }]
      }) } }],
      ...(usage ? { usage } : {})
    })
  };
}

function blockIdFromRequest(_url, options) {
  const body = JSON.parse(options.body);
  const user = JSON.parse(body.messages.find((message) => message.role === "user").content);
  return user.sectionPlan.blockPlans[0].blockId;
}

function fakeConfig(fetchFn) {
  return {
    apiKey: "fake-key",
    baseUrl: "https://llm.test/v1",
    model: "fake-model",
    fetchFn
  };
}

async function withEnv(patch, fn) {
  const old = {};
  for (const key of Object.keys(patch)) {
    old[key] = process.env[key];
    if (patch[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = patch[key];
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("LLM instrumentation counts three successful logical block calls", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const collector = createLlmInstrumentationCollector({ runId: "run-three-success" });
  const fetchFn = async (url, options) => {
    const blockId = blockIdFromRequest(url, options);
    return response({ blockId, text: "Dans la relation, ce bloc reste limité aux thèmes autorisés par le serveur.", requestId: `req-${blockId}` });
  };

  await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: { config: fakeConfig(fetchFn), llmInstrumentation: collector }
  });
  const report = collector.finalize();

  assert.equal(report.logicalCalls, 3);
  assert.equal(report.applicationAttempts, 3);
  assert.equal(report.applicationRetries, 0);
  assert.equal(report.successfulLogicalCalls, 3);
  assert.equal(report.transportAttempts, 3);
  assert.equal(report.transportRetries, 0);
  assert.equal(report.callsBySection.relational_communication.logicalCalls, 3);
  assert.equal(report.callsByBlock.spontaneous_dynamic.logicalCalls, 1);
  assert.equal(report.attemptsByBlock.resource.applicationAttempts, 1);
  assert.equal(report.totalInputTokens, 33);
  assert.equal(report.totalOutputTokens, 21);
  assert.equal(report.totalTokens, 54);
  assert.ok(report.applicationAttemptDetails.every((attempt) => attempt.requestId?.startsWith("req-")));
});

test("LLM instrumentation counts one validation retry without changing logical calls", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const collector = createLlmInstrumentationCollector({ runId: "run-one-retry" });
  const attemptsByBlock = new Map();
  const fetchFn = async (url, options) => {
    const blockId = blockIdFromRequest(url, options);
    const count = (attemptsByBlock.get(blockId) ?? 0) + 1;
    attemptsByBlock.set(blockId, count);
    const invalid = blockId === "resource" && count === 1;
    return response({
      blockId,
      text: invalid ? "Vénus en Lion devient ici le centre de l'analyse." : "Dans la relation, ce bloc reste limité aux thèmes autorisés par le serveur.",
      requestId: `req-${blockId}-${count}`
    });
  };

  await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: { config: fakeConfig(fetchFn), llmInstrumentation: collector, logger: { warn() {} } }
  });
  const report = collector.finalize();

  assert.equal(report.logicalCalls, 3);
  assert.equal(report.applicationAttempts, 4);
  assert.equal(report.applicationRetries, 1);
  assert.equal(report.successfulLogicalCalls, 3);
  assert.equal(report.attemptsByBlock.resource.applicationAttempts, 2);
  assert.equal(report.applicationAttemptDetails.find((attempt) => attempt.blockId === "resource" && attempt.applicationAttempt === 2).retryReason, "validation_correction");
});

test("LLM instrumentation counts a retry caused by the block sentence limit", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const collector = createLlmInstrumentationCollector({ runId: "run-sentence-limit-retry" });
  const attemptsByBlock = new Map();
  const fetchFn = async (url, options) => {
    const blockId = blockIdFromRequest(url, options);
    const count = (attemptsByBlock.get(blockId) ?? 0) + 1;
    attemptsByBlock.set(blockId, count);
    const invalid = blockId === "resource" && count === 1;
    return response({
      blockId,
      text: invalid
        ? "Le ton rend le message recevable. Une idée devient un échange concret. Cette phrase ajoute une synthèse."
        : "Dans la relation, ce bloc reste limité aux thèmes autorisés par le serveur.",
      requestId: `req-${blockId}-${count}`
    });
  };

  await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: { config: fakeConfig(fetchFn), llmInstrumentation: collector, logger: { warn() {} } }
  });
  const report = collector.finalize();

  assert.equal(report.logicalCalls, 3);
  assert.equal(report.applicationAttempts, 4);
  assert.equal(report.applicationRetries, 1);
  assert.equal(report.attemptsByBlock.resource.applicationAttempts, 2);
  assert.equal(report.applicationAttemptDetails.find((attempt) => attempt.blockId === "resource" && attempt.applicationAttempt === 1).errorType, "validation_correction");
});

test("LLM instrumentation preserves a partial report when one logical call fails three attempts", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const scoped = oneBlockSectionPlan(sectionPlan);
  const collector = createLlmInstrumentationCollector({ runId: "run-fail-three" });
  const fetchFn = async (url, options) => response({
    blockId: blockIdFromRequest(url, options),
    text: "Vénus en Lion devient ici le centre de l'analyse."
  });

  await assert.rejects(
    () => writeStructuredSectionWithLlm({
      dossierEvidence,
      sectionPlan: scoped,
      options: { config: fakeConfig(fetchFn), llmInstrumentation: collector, logger: { warn() {} } }
    }),
    /rejected after/
  );
  const report = collector.report();

  assert.equal(report.logicalCalls, 1);
  assert.equal(report.failedLogicalCalls, 1);
  assert.equal(report.applicationAttempts, 3);
  assert.equal(report.failedApplicationAttempts, 3);
  assert.equal(report.applicationRetries, 2);
});

test("LLM instrumentation handles missing usage and request id", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const scoped = oneBlockSectionPlan(sectionPlan);
  const collector = createLlmInstrumentationCollector({ runId: "run-missing-usage" });
  const fetchFn = async (url, options) => response({
    blockId: blockIdFromRequest(url, options),
    text: "Dans la relation, ce bloc reste limité aux thèmes autorisés par le serveur.",
    requestId: null,
    usage: null
  });

  await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan: scoped,
    options: { config: fakeConfig(fetchFn), llmInstrumentation: collector }
  });
  const report = collector.finalize();

  assert.equal(report.totalInputTokens, 0);
  assert.equal(report.totalOutputTokens, 0);
  assert.equal(report.totalTokens, 0);
  assert.equal(report.applicationAttemptDetails[0].requestId, null);
});

test("LLM instrumentation counts timeout attempts", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const scoped = oneBlockSectionPlan(sectionPlan);
  const collector = createLlmInstrumentationCollector({ runId: "run-timeout" });
  const fetchFn = async () => {
    const error = new Error("timeout");
    error.name = "AbortError";
    throw error;
  };

  await assert.rejects(
    () => writeStructuredSectionWithLlm({
      dossierEvidence,
      sectionPlan: scoped,
      options: { config: fakeConfig(fetchFn), llmInstrumentation: collector }
    }),
    /timeout/
  );
  const report = collector.report();

  assert.equal(report.logicalCalls, 1);
  assert.equal(report.applicationAttempts, 1);
  assert.equal(report.applicationAttemptDetails[0].errorType, "timeout");
});

test("LLM instrumentation creates isolated run ids for replays", async () => {
  const first = createLlmInstrumentationCollector();
  const second = createLlmInstrumentationCollector();

  assert.ok(first.runId);
  assert.ok(second.runId);
  assert.notEqual(first.runId, second.runId);
  assert.equal(first.report().logicalCalls, 0);
  assert.equal(second.report().logicalCalls, 0);
});

test("LLM instrumentation disabled leaves structured writer behavior unchanged", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const scoped = oneBlockSectionPlan(sectionPlan);
  let calls = 0;
  const fetchFn = async (url, options) => {
    calls += 1;
    return response({
      blockId: blockIdFromRequest(url, options),
      text: "Dans la relation, ce bloc reste limité aux thèmes autorisés par le serveur."
    });
  };

  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan: scoped,
    options: { config: fakeConfig(fetchFn) }
  });

  assert.equal(calls, 1);
  assert.equal(written.llmCalls, 1);
  assert.equal(written.validation.ok, true);
});

test("LLM instrumentation reports zero calls when key is present without default-base opt-in", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const collector = createLlmInstrumentationCollector({ runId: "run-key-no-opt-in" });
  await withEnv(
    {
      ASTROLAB_LLM_API_KEY: "sk-local-real-looking-key",
      ASTROLAB_LLM_BASE_URL: undefined,
      ASTROLAB_RUN_LLM_TESTS: undefined
    },
    async () => {
      await assert.rejects(
        () => writeStructuredSectionWithLlm({ dossierEvidence, sectionPlan, options: { llmInstrumentation: collector } }),
        /ASTROLAB_LLM_API_KEY/
      );
    }
  );

  const report = collector.report();
  assert.equal(report.logicalCalls, 0);
  assert.equal(report.applicationAttempts, 0);
  assert.equal(report.transportAttempts, 0);
});

test("LLM instrumentation reports zero calls when opt-in is present without key", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const collector = createLlmInstrumentationCollector({ runId: "run-opt-in-no-key" });
  await withEnv(
    {
      ASTROLAB_LLM_API_KEY: undefined,
      ASTROLAB_RUN_LLM_TESTS: "1"
    },
    async () => {
      await assert.rejects(
        () => writeStructuredSectionWithLlm({ dossierEvidence, sectionPlan, options: { llmInstrumentation: collector } }),
        /ASTROLAB_LLM_API_KEY/
      );
    }
  );

  const report = collector.report();
  assert.equal(report.logicalCalls, 0);
  assert.equal(report.applicationAttempts, 0);
  assert.equal(report.transportAttempts, 0);
});

test("LLM instrumentation works with an injected fake client and no real key", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const scoped = oneBlockSectionPlan(sectionPlan);
  const collector = createLlmInstrumentationCollector({ runId: "run-fake-client" });
  await withEnv({ ASTROLAB_LLM_API_KEY: undefined }, async () => {
    await writeStructuredSectionWithLlm({
      dossierEvidence,
      sectionPlan: scoped,
      options: {
        config: fakeConfig(async (url, options) => response({
          blockId: blockIdFromRequest(url, options),
          text: "Dans la relation, ce bloc reste limité aux thèmes autorisés par le serveur."
        })),
        llmInstrumentation: collector
      }
    });
  });

  assert.equal(collector.report().logicalCalls, 1);
});

test("LLM instrumentation report excludes prompts, generated text and secrets", async () => {
  const { dossierEvidence, sectionPlan } = planForFixture();
  const scoped = oneBlockSectionPlan(sectionPlan);
  const collector = createLlmInstrumentationCollector({ runId: "run-no-sensitive-data" });
  const generatedText = "SECRET_GENERATED_TEXT";
  await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan: scoped,
    options: {
      config: fakeConfig(async (url, options) => response({
        blockId: blockIdFromRequest(url, options),
        text: generatedText,
        requestId: "req-safe"
      })),
      llmInstrumentation: collector
    }
  }).catch(() => {});
  const serialized = JSON.stringify(collector.report());

  assert.equal(serialized.includes("fake-key"), false);
  assert.equal(serialized.includes("messages"), false);
  assert.equal(serialized.includes("system"), false);
  assert.equal(serialized.includes("user"), false);
  assert.equal(serialized.includes(generatedText), false);
});
