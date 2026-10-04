import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence, evidenceById } from "../src/deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan, sectionPlanById } from "../src/deliverables/fullDossierPlan.mjs";
import { interpretationRuleById } from "../src/deliverables/interpretationRules.mjs";
import { generatePilotSections, writeStructuredSectionWithLlm } from "../src/deliverables/structuredSectionWriter.mjs";
import { validateStructuredSection, validateStructuredSections } from "../src/deliverables/factualClaimsValidator.mjs";

const fixtureInput = {
  personId: "person_phase2",
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
    personId: "person_phase2",
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

function phase2Fixture({ currentSky = currentSkyFixture(), input = fixtureInput } = {}) {
  const calculation = calculateWesternNatalChart(input, {
    calculatedAt: "2026-10-03T00:00:00.000Z",
    runId: "calc_phase2"
  });
  const dossierEvidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    currentSky,
    generatedAt: "2026-10-03T12:00:00.000Z"
  });
  const fullDossierPlan = buildFullDossierPlan(dossierEvidence);
  return { dossierEvidence, fullDossierPlan };
}

test("FullDossierPlan defines sections, ownership and authorized rules from DossierEvidence only", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const identity = sectionPlanById(fullDossierPlan, "identity");
  const emotional = sectionPlanById(fullDossierPlan, "emotional_world");
  const current = sectionPlanById(fullDossierPlan, "current_sky");

  assert.equal(fullDossierPlan.version, "full-dossier-plan@0.1.0");
  assert.ok(fullDossierPlan.sections.length >= 17);
  assert.ok(identity.primaryEvidenceRefs.includes("natal.sun.sign"));
  assert.ok(emotional.primaryEvidenceRefs.includes("natal.moon.sign"));
  assert.ok(emotional.primaryEvidenceRefs.includes("aspect.moon.mercury.square"));
  assert.ok(current.primaryEvidenceRefs.includes("transits.snapshot"));
  assert.ok(current.primaryEvidenceRefs.some((ref) => ref.startsWith("transit.jupiter.sun.square.")));
  assert.ok(identity.allowedInterpretationRuleRefs.includes("western.body.sun.sign.capricorn@1"));
  assert.ok(emotional.allowedInterpretationRuleRefs.includes("western.aspect.moon_mercury.square@1"));
  assert.equal(evidenceById(dossierEvidence).has("aspect.moon.mercury.square"), true);
  assert.ok(identity.evidencePackets.some((packet) => packet.packetId === "identity.natal_sun_sign"));
  assert.ok(emotional.evidencePackets.some((packet) => packet.packetId === "emotional_world.aspect_moon_mercury_square"));
});

test("interpretation library exposes versioned themes instead of free doctrine", () => {
  const rule = interpretationRuleById("western.aspect.moon_mercury.square@1");
  assert.equal(rule.evidenceType, "NATAL_ASPECT");
  assert.deepEqual(rule.match, { bodies: ["Moon", "Mercury"], aspectType: "square" });
  assert.ok(rule.themes.includes("tension entre ressenti et formulation"));
  assert.ok(rule.forbidden.includes("diagnostic psychologique"));
});

test("pilot writer produces four valid structured sections with evidenceRefs and interpretationRuleRefs", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const pilot = generatePilotSections({ dossierEvidence, fullDossierPlan });
  assert.equal(pilot.llmCalls, 0);
  assert.deepEqual(
    pilot.sections.map((section) => section.sectionId),
    ["general_synthesis", "identity", "emotional_world", "current_sky"]
  );
  for (const section of pilot.sections) {
    assert.ok(section.blocks.length > 0);
    for (const block of section.blocks) {
      assert.ok(block.text);
      assert.ok(block.evidenceRefs.length > 0);
      assert.ok(block.interpretationRuleRefs.length > 0);
    }
  }
  const result = validateStructuredSections({ dossierEvidence, fullDossierPlan, sections: pilot.sections });
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test("packetRef inconnu is rejected", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "emotional_world");
  const section = {
    sectionId: "emotional_world",
    blocks: [
      {
        blockId: "unknown-packet",
        text: "Le carré entre votre Lune et Mercure décrit une tension entre ressenti et formulation.",
        packetRefs: ["emotional_world.packet_inconnu"]
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "unknown_packet_ref"));
});

test("a text-only wrong aspect is rejected even with the right packet", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "emotional_world");
  const section = {
    sectionId: "emotional_world",
    blocks: [
      {
        blockId: "bad-aspect",
        text: "L'opposition entre votre Lune et Mercure structure votre monde intérieur.",
        packetRefs: ["emotional_world.aspect_moon_mercury_square"]
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});

test("a good aspect text is accepted with the matching packet", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "emotional_world");
  const section = {
    sectionId: "emotional_world",
    blocks: [
      {
        blockId: "good-aspect",
        text: "Le carré entre votre Lune et Mercure décrit une tension entre ressenti et formulation.",
        packetRefs: ["emotional_world.aspect_moon_mercury_square"]
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test("an invented house in text is rejected", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "identity");
  const section = {
    sectionId: "identity",
    blocks: [
      {
        blockId: "bad-house",
        text: "Votre Soleil en maison VIII donne le centre du chapitre.",
        evidenceRefs: ["natal.sun.sign"],
        interpretationRuleRefs: ["western.body.sun.sign.capricorn@1"],
        claims: []
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});

test("an interpretation rule not authorized by the section is rejected", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "identity");
  const section = {
    sectionId: "identity",
    blocks: [
      {
        blockId: "bad-rule",
        text: "Votre Soleil en Capricorne est commenté avec une règle lunaire.",
        evidenceRefs: ["natal.sun.sign"],
        interpretationRuleRefs: ["western.body.moon.sign.libra@1"],
        claims: [{ claimId: "identity.sun", type: "NATAL_BODY_SIGN", body: "Sun", sign: "Capricorn", evidenceRefs: ["natal.sun.sign"] }]
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "interpretation_rule_not_allowed"));
  assert.ok(result.issues.some((issue) => issue.code === "interpretation_rule_without_matching_evidence"));
});

test("packet contract ignores arbitrary LLM claims and rule/evidence associations", async () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "identity");
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: async () => ({
        sectionId: "identity",
        blocks: [
          {
            blockId: "identity-packet",
            text: "Votre Soleil en Capricorne donne un axe d'identité construit dans le temps.",
            packetRefs: ["identity.natal_sun_sign"],
            evidenceRefs: ["natal.moon.sign"],
            interpretationRuleRefs: ["western.body.moon.sign.libra@1"],
            claims: [{ claimId: "bad", type: "CLAIM_TYPE_INVENTED", evidenceRefs: ["natal.moon.sign"] }]
          }
        ]
      })
    }
  });

  assert.equal(written.validation.ok, true, JSON.stringify(written.validation.issues, null, 2));
  assert.deepEqual(written.section.blocks[0].packetRefs, ["identity.natal_sun_sign"]);
  assert.equal("claims" in written.section.blocks[0], false);
  assert.equal("evidenceRefs" in written.section.blocks[0], false);
  assert.equal("interpretationRuleRefs" in written.section.blocks[0], false);
});

test("primary reuse of an already interpreted evidence is detected", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "general_synthesis");
  assert.ok(sectionPlan.alreadyInterpretedEvidenceRefs.includes("natal.sun.sign"));
  const section = {
    sectionId: "general_synthesis",
    blocks: [
      {
        blockId: "reuse-primary",
        text: "Votre Soleil en Capricorne est interprété ici comme s'il appartenait principalement à la synthèse.",
        evidenceRefs: ["natal.sun.sign"],
        interpretationRuleRefs: ["western.body.sun.sign.capricorn@1"],
        interpretationDepth: "primary",
        claims: [{ claimId: "reuse.sun", type: "NATAL_BODY_SIGN", body: "Sun", sign: "Capricorn", evidenceRefs: ["natal.sun.sign"] }]
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "evidence_reuse_as_primary"));
});

test("LLM structured writer sends precise validation issues to correction attempts", async () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "general_synthesis");
  const warnings = [];
  const calls = [];

  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      logger: { warn: (...args) => warnings.push(args) },
      structuredWriterFn: async (payload) => {
        calls.push(payload);
        if (calls.length === 1) {
          return {
            sectionId: "general_synthesis",
            blocks: [
              {
                blockId: "bad_distribution",
                text: "La distribution des éléments indique cinq corps en terre.",
                packetRefs: ["general_synthesis.packet_inconnu"]
              }
            ]
          };
        }
        assert.ok(payload.correctionIssues.length >= 1);
        assert.ok(payload.correctionIssues.some((issue) => issue.code === "unknown_packet_ref"));
        assert.equal(payload.correctionIssues[0].blockId, "bad_distribution");
        assert.ok(payload.correctionIssues[0].block.textFragment.includes("distribution des éléments"));
        assert.ok(payload.correctionIssues[0].expectedHint.includes("packetRefs"));
        assert.ok(payload.correctionIssues[0].authorizedPackets.some((packet) => packet.packetId === "general_synthesis.distribution_element_earth"));
        return {
          sectionId: "general_synthesis",
          blocks: [
            {
              blockId: "good_distribution",
              text: "La distribution des éléments indique cinq corps en terre.",
              packetRefs: ["general_synthesis.distribution_element_earth"]
            }
          ]
        };
      }
    }
  });

  assert.equal(written.validation.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][1].sectionId, "general_synthesis");
  assert.equal(warnings[0][1].attempt, 1);
  assert.ok(warnings[0][1].validationErrorCodes.some((code) => code === "unknown_packet_ref"));
});

test("general_synthesis can reference owned evidence without blocking owner chapters", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const synthesis = {
    sectionId: "general_synthesis",
    blocks: [
      {
        blockId: "synthesis-reference",
        text: "Votre Soleil en Capricorne fait partie des dynamiques centrales du thème.",
        packetRefs: ["general_synthesis.natal_sun_sign"]
      }
    ]
  };
  const identity = {
    sectionId: "identity",
    blocks: [
      {
        blockId: "identity-owner",
        text: "Votre Soleil en Capricorne donne un axe d'identité construit dans le temps.",
        packetRefs: ["identity.natal_sun_sign"]
      }
    ]
  };
  const emotional = {
    sectionId: "emotional_world",
    blocks: [
      {
        blockId: "emotional-owner",
        text: "Le carré entre votre Lune et Mercure décrit une tension entre ressenti et formulation.",
        packetRefs: ["emotional_world.aspect_moon_mercury_square"]
      }
    ]
  };
  const result = validateStructuredSections({ dossierEvidence, fullDossierPlan, sections: [synthesis, identity, emotional] });
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test("houses section records unavailability when birth time does not allow houses", () => {
  const { fullDossierPlan } = phase2Fixture({
    currentSky: null,
    input: { ...fixtureInput, timePrecision: "unknown", timeValue: "" }
  });
  const houses = sectionPlanById(fullDossierPlan, "houses");
  assert.ok(houses.preconditions.some((entry) => entry.reason === "houses_unavailable_for_birth_time"));
  assert.equal(houses.primaryEvidenceRefs.some((ref) => ref.endsWith(".house")), false);
});

test("a transit outside the snapshot is rejected", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "current_sky");
  const section = {
    sectionId: "current_sky",
    blocks: [
      {
        blockId: "invented-transit",
        text: "Saturne forme un sextile à votre Lune dans ce ciel actuel.",
        evidenceRefs: ["transits.snapshot"],
        interpretationRuleRefs: ["western.current_sky.snapshot@1"],
        claims: []
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});
