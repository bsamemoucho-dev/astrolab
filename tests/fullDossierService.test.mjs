import assert from "node:assert/strict";
import test from "node:test";

import { createFullPublicReading } from "../src/models/fullDossierService.mjs";

const INPUT = {
  firstName: "Ariane",
  birthDate: "1980-01-10",
  timePrecision: "exact",
  timeValue: "12:00",
  birthPlace: "Paris",
  country: "France",
  latitude: 48.8566,
  longitude: 2.3522,
  timeZone: "Europe/Paris",
  coordinateSource: "test_fixture",
  coordinateConfidence: "verified_fixture"
};

function currentSkyFixture() {
  return {
    schema: "astrolab.personal_current_sky",
    personId: "public_full_dossier_person",
    generatedAt: "2026-10-03T12:00:00.000Z",
    window: {
      nowUtc: "2026-10-03T12:00:00.000Z",
      horizonDays: 42,
      fromUtc: "2026-04-06T12:00:00.000Z",
      toUtc: "2026-11-28T12:00:00.000Z"
    },
    current: [
      {
        resultId: "current_sky.fixture_jupiter_sun_square",
        status: "CURRENT",
        relevance: "VERY_PERSONAL",
        contact: {
          transitBody: "Jupiter",
          natalPoint: "Sun",
          aspectType: "square",
          orb: 1.2,
          effectiveOrbLimit: 1.5,
          reliability: "HIGH",
          natalHouse: 7,
          houseSystem: "WHOLE_SIGN"
        },
        timing: {
          startsAt: "2026-10-01T00:00:00.000Z",
          exactAt: "2026-10-12T06:00:00.000Z",
          endsAt: "2026-10-24T00:00:00.000Z",
          phase: "APPLYING"
        },
        evidence: {
          ruleVersion: "western-transits-ranking@1.0.0-draft",
          orbRuleVersion: "western-transits-orbs@1.0.0-draft",
          methodVersion: "transit-contact-engine@0.1.0-draft"
        }
      }
    ],
    upcoming: [],
    recent: [],
    versions: {
      methodVersion: "transit-contact-engine@0.1.0-draft",
      ruleVersion: "western-transits-ranking@1.0.0-draft",
      orbRuleVersion: "western-transits-orbs@1.0.0-draft"
    }
  };
}

function injectedStructuredWriter({ sectionPlan }) {
  return {
    sectionId: sectionPlan.sectionId,
    blocks: (sectionPlan.blockPlans ?? []).map((blockPlan) => ({
      blockId: blockPlan.blockId,
      text: `Cette section ${sectionPlan.sectionId} ${blockPlan.blockId} relie uniquement les preuves et règles autorisées pour proposer une lecture symbolique sobre.`
    }))
  };
}

function inputForBirthDate(birthDate, overrides = {}) {
  return {
    ...INPUT,
    firstName: "Fixture",
    birthDate,
    timePrecision: "exact",
    timeValue: "12:00",
    ...overrides
  };
}

async function createFixtureReading(input = INPUT, extraOptions = {}) {
  return createFullPublicReading(input, {
    currentSky: currentSkyFixture(),
    nowUtc: "2026-10-03T12:00:00.000Z",
    structuredWriterFn: injectedStructuredWriter,
    ...extraOptions
  });
}

test("createFullPublicReading assembles a validated full dossier without using legacy free-text sections", async () => {
  const progress = [];
  const reading = await createFixtureReading(INPUT, {
    onProgress: (event) => progress.push(event)
  });

  assert.equal(reading.schema, "astrolab.public_reading");
  assert.equal(reading.dossierSchema, "astrolab.full_dossier");
  assert.equal(reading.writerMode, "llm");
  assert.equal(reading.verification.status, "structured_validated");
  assert.ok(reading.sections.some((section) => section.id === "identity"));
  assert.ok(reading.sections.some((section) => section.id === "current_sky"));
  assert.equal(reading.sections.some((section) => section.id === "lettre-miroir"), false);
  assert.match(reading.html, /Votre ciel actuellement|Synthèse générale|Identité/);
  assert.match(reading.html, /Validation factuelle structurée : \d+ chapitre\(s\) validé\(s\)\. Contrôle automatique des faits et des règles documentées activé\./);
  assert.doesNotMatch(reading.html, /non rédigé\(s\)|faute de règle documentée/);
  assert.match(reading.markdown, /Annexe/);
  assert.doesNotMatch(reading.markdown, /non rédigé\(s\)|faute de règle documentée/);
  assert.equal(reading.dossier.sectionCount, 19);
  assert.equal(reading.relationship.schema, "astrolab.individual_relational_public_v1");
  assert.equal(reading.relationship.generatedSectionCount, 2);
  const ids = reading.sections.map((section) => section.id);
  assert.equal(ids.includes("relational_communication"), true);
  assert.equal(ids.includes("relational_affection"), true);
  assert.equal(ids.indexOf("relational_affection"), ids.indexOf("relational_communication") + 1);
  assert.match(reading.html, /Communication relationnelle/);
  assert.match(reading.html, /Manière d&#39;exprimer son affection|Manière d'exprimer son affection/);
  assert.doesNotMatch(reading.html, /Manière d'entrer en relation|Besoin d'espace|Manière d'aborder les désaccords|Besoins relationnels|Désir, initiative/);
  assert.doesNotMatch(reading.markdown, /Manière d'entrer en relation|Besoin d'espace|Manière d'aborder les désaccords|Besoins relationnels|Désir, initiative/);
  assert.ok(reading.relationship.sections[0].blocks.some((block) => block.claims?.length > 0));
  assert.ok(reading.relationship.sections[0].blocks.some((block) => block.evidenceRefs?.length > 0));
  assert.ok(reading.relationship.sections[0].blocks.some((block) => block.interpretationRuleRefs?.length > 0));
  assert.doesNotMatch(reading.html, /claims|evidenceRefs|interpretationRuleRefs/);
  assert.doesNotMatch(reading.markdown, /claims|evidenceRefs|interpretationRuleRefs/);
  assert.equal(progress.at(-1).completedSections, reading.dossier.generatedSectionCount);
  assert.equal(progress.at(-1).totalSections, reading.dossier.generatedSectionCount);
  assert.equal(reading.observability.llmCalls, 0);
});

test("un warning de longueur Communication ne bloque pas le dossier complet", async () => {
  const callsByBlock = new Map();
  const reading = await createFixtureReading(INPUT, {
    structuredWriterFn: ({ sectionPlan }) => {
      const blockPlan = sectionPlan.blockPlans[0];
      const key = `${sectionPlan.sectionId}.${blockPlan.blockId}`;
      callsByBlock.set(key, (callsByBlock.get(key) ?? 0) + 1);
      const communicationResource =
        sectionPlan.sectionId === "relational_communication" && blockPlan.blockId === "resource";
      return {
        sectionId: sectionPlan.sectionId,
        contractVersion: "structured-section-writer@0.1.0",
        blocks: [{
          blockId: blockPlan.blockId,
          text: communicationResource
            ? "Le ton et le tact rendent le message plus recevable. Une idée peut devenir un échange concret. Le rythme de parole peut aider à clarifier le désaccord. Cette phrase reste un dépassement éditorial."
            : `Cette section ${sectionPlan.sectionId} ${blockPlan.blockId} relie uniquement les preuves et règles autorisées pour proposer une lecture symbolique sobre.`
        }]
      };
    }
  });

  assert.equal(reading.status, "ready_for_human_review");
  assert.equal(reading.verification.status, "structured_validated");
  assert.equal(callsByBlock.get("relational_communication.resource"), 1);
  assert.ok(reading.relationship.sections.some((section) => section.sectionId === "relational_communication"));
  assert.match(reading.html, /Communication relationnelle/);
});

test("Communication relationnelle est omise proprement sans règle scoped autorisée", async () => {
  const reading = await createFixtureReading(inputForBirthDate("1950-01-26"));

  assert.equal(reading.status, "ready_for_human_review");
  assert.equal(reading.verification.status, "structured_validated");
  assert.equal(reading.relationship.sections.some((section) => section.sectionId === "relational_communication"), false);
  assert.ok(reading.relationship.skippedSections.some((section) =>
    section.sectionId === "relational_communication" &&
    section.reason === "no_authorized_interpretation_rules"
  ));
  assert.doesNotMatch(reading.html, /Communication relationnelle/);
  assert.match(reading.html, /Manière d&#39;exprimer son affection|Manière d'exprimer son affection/);
});

test("Affection can be generated from the Venus sign fallback inside the client dossier", async () => {
  const reading = await createFixtureReading(inputForBirthDate("1950-01-01", { timeValue: "00:00" }));
  const affection = reading.relationship.sections.find((section) => section.sectionId === "relational_affection");

  assert.ok(affection);
  assert.deepEqual([...new Set(affection.blocks.flatMap((block) => block.interpretationRuleRefs))], [
    "western.relational.affection.venus.sign.aquarius@1"
  ]);
  assert.match(reading.html, /Manière d&#39;exprimer son affection|Manière d'exprimer son affection/);
});

test("Affection is omitted cleanly when no certain affection material is available", async () => {
  const reading = await createFixtureReading(inputForBirthDate("1950-04-06", {
    timePrecision: "unknown",
    timeValue: null
  }));

  assert.equal(reading.sections.some((section) => section.id === "relational_affection"), false);
  assert.equal(reading.relationship.sections.some((section) => section.sectionId === "relational_affection"), false);
  assert.ok(reading.relationship.skippedSections.some((section) => section.sectionId === "relational_affection"));
  assert.doesNotMatch(reading.html, /Manière d&#39;exprimer son affection|Manière d'exprimer son affection/);
  assert.equal(reading.verification.status, "structured_validated");
});

test("relationship dossier generation remains deterministic and does not call the network without opt-in", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called");
  };
  try {
    const first = await createFixtureReading(INPUT, {
      config: { apiKey: "test-only-key", baseUrl: "https://example.invalid", model: "test-model" }
    });
    const second = await createFixtureReading(INPUT, {
      config: { apiKey: "test-only-key", baseUrl: "https://example.invalid", model: "test-model" }
    });
    assert.deepEqual(first.sections.map((section) => section.id), second.sections.map((section) => section.id));
    assert.deepEqual(first.relationship.sections.map((section) => section.sectionId), second.relationship.sections.map((section) => section.sectionId));
    assert.equal(first.observability.llmCalls, 0);
    assert.equal(second.observability.llmCalls, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
