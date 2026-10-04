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
      text: "Cette section relie uniquement les preuves et règles autorisées pour proposer une lecture symbolique sobre, sans ajouter de fait extérieur."
    }))
  };
}

test("createFullPublicReading assembles a validated full dossier without using legacy free-text sections", async () => {
  const reading = await createFullPublicReading(INPUT, {
    currentSky: currentSkyFixture(),
    nowUtc: "2026-10-03T12:00:00.000Z",
    structuredWriterFn: injectedStructuredWriter
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
  assert.equal(reading.dossier.sectionCount, 17);
  assert.equal(reading.observability.llmCalls, 0);
});
