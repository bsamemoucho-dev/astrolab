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
  assert.match(reading.html, /Contrôle automatique des faits et des règles documentées effectué/);
  assert.match(reading.html, /ne garantit ni la justesse des interprétations symboliques ni leur qualité éditoriale/);
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
  assert.match(reading.html, /Votre manière d&#39;exprimer votre affection|Votre manière d'exprimer votre affection/);
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
  assert.match(reading.html, /Votre manière d&#39;exprimer votre affection|Votre manière d'exprimer votre affection/);
});

test("Affection can be generated from the Venus sign fallback inside the client dossier", async () => {
  const reading = await createFixtureReading(inputForBirthDate("1950-01-01", { timeValue: "00:00" }));
  const affection = reading.relationship.sections.find((section) => section.sectionId === "relational_affection");

  assert.ok(affection);
  assert.deepEqual([...new Set(affection.blocks.flatMap((block) => block.interpretationRuleRefs))], [
    "western.relational.affection.venus.sign.aquarius@1"
  ]);
  assert.match(reading.html, /Votre manière d&#39;exprimer votre affection|Votre manière d'exprimer votre affection/);
});

test("Affection is omitted cleanly when no certain affection material is available", async () => {
  const reading = await createFixtureReading(inputForBirthDate("1950-04-06", {
    timePrecision: "unknown",
    timeValue: null
  }));

  assert.equal(reading.sections.some((section) => section.id === "relational_affection"), false);
  assert.equal(reading.relationship.sections.some((section) => section.sectionId === "relational_affection"), false);
  assert.ok(reading.relationship.skippedSections.some((section) => section.sectionId === "relational_affection"));
  assert.doesNotMatch(reading.html, /Votre manière d&#39;exprimer votre affection|Votre manière d'exprimer votre affection/);
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


test("client facts are distinct, owned, actually used and omit detailed annex measures", async () => {
  const reading = await createFixtureReading();
  assert.match(reading.html, /class="studied-configurations"/);
  assert.match(reading.markdown, /\*\*Configurations étudiées\*\*/);
  assert.doesNotMatch(reading.html, /effectué sur \d+ chapitre/);
  assert.doesNotMatch(reading.markdown, /effectué sur \d+ chapitre/);
  const source = reading.sections;
  for (const panel of reading.html.matchAll(/<aside class="studied-configurations">([^]*?)<\/aside>/g)) {
    assert.ok((panel[1].match(/<li>/g) ?? []).length <= 3);
    assert.doesNotMatch(panel[1], /orbe|°|packet|preuve/i);
  }
  assert.ok(source.length > 0);
  assert.match(reading.html, /ne garantit ni la justesse des interprétations symboliques ni leur qualité éditoriale/);
});


test("public pipeline actually runs lexical repetition diagnostics without a paid review", async () => {
  const reading = await createFixtureReading();
  const diagnostics = reading.observability.editorialDiagnostics;
  assert.ok(diagnostics.version);
  assert.equal(diagnostics.scope, "lexical_repetition_only");
  assert.equal(diagnostics.blocksDelivery, false);
  // Deliberately repetitive injected prose makes the wiring observable.
  assert.ok(diagnostics.repetitions.length > 0);
  assert.equal(reading.observability.llmCalls, 0);
  assert.equal(reading.aiReview.humanReviewed, false);
  assert.equal(reading.aiReview.passes, 0);
  assert.equal(reading.aiReview.semanticLlmReview, false);
  assert.equal(reading.aiReview.factualValidation, true);
});

test("validated relational text appears under its natal chapter, before Conclusion, while source sections stay separate", async () => {
  const reading = await createFixtureReading(INPUT);
  const communication = reading.html.indexOf("<h2>Communication</h2>");
  const affectivity = reading.html.indexOf("<h2>Affectivité</h2>");
  const affection = reading.html.search(/<h3>Votre manière d(?:'|&#39;)exprimer votre affection<\/h3>/);
  const relationalCommunication = reading.html.indexOf("<h3>Communication relationnelle</h3>");
  const conclusion = reading.html.indexOf("<h2>Conclusion</h2>");
  assert.ok(communication >= 0 && relationalCommunication > communication);
  assert.ok(affectivity >= 0 && affection > affectivity);
  assert.ok(relationalCommunication < conclusion && affection < conclusion);
  assert.doesNotMatch(reading.html, /<h2>Communication relationnelle<\/h2>|<h2>Votre manière d(?:'|&#39;)exprimer votre affection<\/h2>/);
  assert.match(reading.markdown, /### Votre manière d'exprimer votre affection/);
  assert.ok(reading.sections.some((section) => section.id === "relational_affection"));
  const source = reading.relationship.sections.find((section) => section.sectionId === "relational_affection");
  assert.ok(source && source.blocks.length > 0);
  for (const block of source.blocks) {
    assert.ok(block.evidenceRefs.length > 0);
    assert.ok(block.interpretationRuleRefs.length > 0);
    assert.ok(reading.markdown.includes(block.text), "all validated relational prose stays verbatim");
  }
});

test("public dossier presents bare uninterpreted transit references without dropping validated prose or source sections", async () => {
  const currentSky = currentSkyFixture();
  currentSky.current.push({
    ...currentSky.current[0],
    resultId: "current_sky.fixture_uranus_saturn_opposition",
    contact: { ...currentSky.current[0].contact, transitBody: "Uranus", natalPoint: "Saturn", aspectType: "opposition", natalHouse: null, houseSystem: null }
  });
  const reading = await createFixtureReading(INPUT, {
    currentSky,
    structuredWriterFn: ({ sectionPlan }) => ({
      sectionId: sectionPlan.sectionId,
      blocks: sectionPlan.blockPlans.map((blockPlan) => ({
        blockId: blockPlan.blockId,
        text: sectionPlan.allowedInterpretationRuleRefs.length > 0
          ? `Lecture validée ${sectionPlan.sectionId} ${blockPlan.blockId}.`
          : ""
      }))
    })
  });
  assert.equal(reading.verification.status, "structured_validated");
  assert.match(reading.html, /<aside class="calculated-references"><h3>Autres repères calculés<\/h3>/);
  assert.match(reading.html, /<li>Uranus forme une opposition à votre Saturne/);
  assert.match(reading.html, /Repères présentés sans lecture symbolique\./);
  assert.doesNotMatch(reading.html, /<p>Uranus forme une opposition à votre Saturne/);
  assert.equal((reading.markdown.match(/Uranus forme une opposition à votre Saturne/g) ?? []).length, 1);
  assert.match(reading.markdown, /^### Autres repères calculés$/m);
  assert.match(reading.markdown, /^- Uranus forme une opposition à votre Saturne/m);
  assert.match(reading.markdown, /Repères présentés sans lecture symbolique\./);
  assert.ok(reading.sections.some((section) => section.id === "current_sky" && section.blocks >= 3));
  assert.match(reading.markdown, /Lecture validée current_sky/);
});

test("deterministic-only future angle transits count toward progress without invoking the writer", async () => {
  const sky = currentSkyFixture();
  const base = sky.current[0];
  sky.current = [];
  sky.upcoming = [{
    ...base,
    resultId: "next_weeks.fixture_neptune_asc_square",
    status: "UPCOMING",
    contact: { ...base.contact, transitBody: "Neptune", natalPoint: "ASC", aspectType: "square", natalHouse: null, houseSystem: null },
    timing: { ...base.timing, startsAt: "2026-10-10T00:00:00.000Z", exactAt: "2026-10-12T06:00:00.000Z", endsAt: "2026-10-24T00:00:00.000Z" }
  }];
  const progress = [];const writerSections = [];
  const reading = await createFixtureReading(INPUT, {
    currentSky: sky,
    onProgress: (event) => progress.push(event),
    structuredWriterFn: (context) => {
      writerSections.push(context.sectionPlan.sectionId);
      return injectedStructuredWriter(context);
    }
  });
  assert.equal(reading.verification.status, "structured_validated");
  assert.ok(reading.sections.some((section) => section.id === "next_weeks" && section.blocks > 0));
  assert.ok(progress.some((event) => event.currentSection === "next_weeks"));
  assert.equal(writerSections.includes("next_weeks"), false, "calculated-only future contacts never call the LLM transport");
  assert.equal(progress.at(-1).completedSections, reading.dossier.generatedSectionCount);
  assert.equal(progress.at(-1).totalSections, reading.dossier.generatedSectionCount);
  assert.match(reading.markdown, /- Neptune forme un carré à votre Ascendant/);
  assert.match(reading.markdown, /Repères présentés sans lecture symbolique\./);
  assert.equal(reading.observability.llmCalls, 0);
});
