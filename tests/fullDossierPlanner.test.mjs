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

function blockIdForPacket(sectionPlan, packetId) {
  return sectionPlan.blockPlans.find((blockPlan) => blockPlan.packetRefs.includes(packetId))?.blockId;
}

function planForPacket(sectionPlan, packetId) {
  return {
    ...sectionPlan,
    evidencePackets: sectionPlan.evidencePackets.filter((packet) => packet.packetId === packetId),
    blockPlans: sectionPlan.blockPlans.filter((blockPlan) => blockPlan.packetRefs.includes(packetId))
  };
}

function planForPackets(sectionPlan, packetIds) {
  const allowed = new Set(packetIds);
  return {
    ...sectionPlan,
    evidencePackets: sectionPlan.evidencePackets.filter((packet) => allowed.has(packet.packetId)),
    blockPlans: [{ blockId: "block1", packetRefs: packetIds }]
  };
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
  assert.deepEqual(identity.blockPlans[0], { blockId: "block1", packetRefs: ["identity.natal_sun_sign"] });
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
  const planWithoutBlockPlans = {
    ...fullDossierPlan,
    sections: fullDossierPlan.sections.map((section) => ({ ...section, blockPlans: [] }))
  };
  const result = validateStructuredSections({ dossierEvidence, fullDossierPlan: planWithoutBlockPlans, sections: pilot.sections });
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test("an invented blockId is rejected", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "emotional_world");
  const section = {
    sectionId: "emotional_world",
    blocks: [
      {
        blockId: "block999",
        text: "Le carré entre votre Lune et Mercure décrit une tension entre ressenti et formulation.",
        packetRefs: ["emotional_world.aspect_moon_mercury_square"]
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "unknown_block_id"));
});

test("a text-only wrong aspect is rejected even with the right packet", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const fullSectionPlan = sectionPlanById(fullDossierPlan, "emotional_world");
  const sectionPlan = planForPacket(fullSectionPlan, "emotional_world.aspect_moon_mercury_square");
  const section = {
    sectionId: "emotional_world",
    blocks: [
      {
        blockId: blockIdForPacket(fullSectionPlan, "emotional_world.aspect_moon_mercury_square"),
        text: "L'opposition entre votre Lune et Mercure structure votre monde intérieur."
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});

test("a good aspect text is accepted with the matching packet", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const fullSectionPlan = sectionPlanById(fullDossierPlan, "emotional_world");
  const sectionPlan = planForPacket(fullSectionPlan, "emotional_world.aspect_moon_mercury_square");
  const section = {
    sectionId: "emotional_world",
    blocks: [
      {
        blockId: blockIdForPacket(fullSectionPlan, "emotional_world.aspect_moon_mercury_square"),
        text: "Le carré entre votre Lune et Mercure décrit une tension entre ressenti et formulation."
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test("Venus sign text is accepted when the BlockPlan carries the Venus packet", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = planForPacket(sectionPlanById(fullDossierPlan, "affectivity"), "affectivity.natal_venus_sign");
  const section = {
    sectionId: "affectivity",
    blocks: [{ blockId: "block1", text: "Vénus en Verseau colore l'affectivité par une recherche d'indépendance." }]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test("Venus sign text is rejected when the BlockPlan carries another packet", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "communication");
  const section = {
    sectionId: "communication",
    blocks: [{ blockId: "block1", text: "Vénus en Verseau colore l'affectivité par une recherche d'indépendance." }]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});

test("a planned block without text is rejected explicitly", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "identity");
  const section = { sectionId: "identity", blocks: [{ blockId: "block1", text: "" }] };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "missing_block_text"));
});

test("an invented house in text is rejected", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "identity");
  const section = {
    sectionId: "identity",
    blocks: [
      {
        blockId: "block1",
        text: "Votre Soleil en maison VIII donne le centre du chapitre."
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});

test("targeted correction keeps the same server-owned packets", async () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = planForPacket(sectionPlanById(fullDossierPlan, "affectivity"), "affectivity.natal_venus_sign");
  const calls = [];
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      logger: { warn: () => {} },
      structuredWriterFn: async (payload) => {
        calls.push(payload);
        if (calls.length === 1) {
          return { sectionId: "affectivity", blocks: [{ blockId: "block1", text: "Vénus en Sagittaire colore l'affectivité." }] };
        }
        const blockPlan = payload.correctionIssues[0].authorizedBlockPlans.find((entry) => entry.blockId === "block1");
        assert.deepEqual(blockPlan.packets.map((packet) => packet.packetId), ["affectivity.natal_venus_sign"]);
        return { sectionId: "affectivity", blocks: [{ blockId: "block1", text: "Vénus en Verseau colore l'affectivité sans inventer d'autre placement." }] };
      }
    }
  });
  assert.equal(calls.length, 2);
  assert.equal(written.validation.ok, true, JSON.stringify(written.validation.issues, null, 2));
});

test("current_sky writer payload is closed to the current block packets", async () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "current_sky");
  const payloads = [];
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: async (payload) => {
        payloads.push(payload);
        const serialized = JSON.stringify(payload);
        assert.equal(serialized.includes("Venus"), false);
        assert.equal(serialized.includes("Vénus"), false);
        assert.equal(serialized.includes("natal.venus"), false);
        assert.equal("dossierEvidence" in payload, false);
        assert.equal("previousSections" in payload, false);
        return {
          sectionId: "current_sky",
          blocks: [
            {
              blockId: payload.sectionPlan.blockPlans[0].blockId,
              text: "Jupiter forme un carré à votre Soleil, exact le 2026-10-12T06:00:00.000Z."
            }
          ]
        };
      }
    }
  });
  assert.equal(payloads.length, 1);
  assert.equal(written.validation.ok, true, JSON.stringify(written.validation.issues, null, 2));
  assert.deepEqual(written.section.blocks.map((block) => block.blockId), ["current_sky.intro", "current_sky.transit_01"]);
});

test("a natal context packet explicitly added to current_sky can be used", async () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const currentPlan = sectionPlanById(fullDossierPlan, "current_sky");
  const identityPlan = sectionPlanById(fullDossierPlan, "identity");
  const transitPacket = currentPlan.evidencePackets.find((packet) => packet.evidenceRefs.some((ref) => ref.startsWith("transit.")));
  const sunPacket = identityPlan.evidencePackets.find((packet) => packet.packetId === "identity.natal_sun_sign");
  const sectionPlan = {
    ...currentPlan,
    primaryEvidenceRefs: [...currentPlan.primaryEvidenceRefs, "natal.sun.sign"],
    allowedInterpretationRuleRefs: [...new Set([...currentPlan.allowedInterpretationRuleRefs, ...sunPacket.interpretationRuleRefs])],
    evidencePackets: [
      currentPlan.evidencePackets.find((packet) => packet.evidenceRefs.includes("transits.snapshot")),
      transitPacket,
      sunPacket
    ],
    blockPlans: [
      currentPlan.blockPlans.find((blockPlan) => blockPlan.deterministic),
      {
        blockId: "current_sky.transit_01",
        packetRefs: [transitPacket.packetId, sunPacket.packetId]
      }
    ]
  };
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: async (payload) => ({
        sectionId: "current_sky",
        blocks: [
          {
            blockId: payload.sectionPlan.blockPlans[0].blockId,
            text: "Jupiter forme un carré à votre Soleil, dans un thème où le Soleil est en Capricorne."
          }
        ]
      })
    }
  });
  assert.equal(written.validation.ok, true, JSON.stringify(written.validation.issues, null, 2));
});

test("a natal placement not added to the BlockPlan remains inaccessible", async () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "current_sky");
  await assert.rejects(
    () => writeStructuredSectionWithLlm({
      dossierEvidence,
      sectionPlan,
      options: {
        logger: { warn: () => {} },
        structuredWriterFn: async (payload) => ({
          sectionId: "current_sky",
          blocks: [
            {
              blockId: payload.sectionPlan.blockPlans[0].blockId,
              text: "Jupiter forme un carré à votre Soleil, tandis que Vénus en Verseau colore aussi ce passage."
            }
          ]
        })
      }
    }),
    (error) => {
      assert.equal(error.code, "structured_block_validation_failed");
      assert.ok(error.validation.issues.some((issue) => issue.code === "undeclared_text_fact"));
      return true;
    }
  );
});

test("current_sky works with unknown birth time without house or angle context", async () => {
  const currentSky = currentSkyFixture();
  delete currentSky.current[0].contact.natalHouse;
  delete currentSky.current[0].contact.houseSystem;
  const { dossierEvidence, fullDossierPlan } = phase2Fixture({
    currentSky,
    input: { ...fixtureInput, birthDate: "1984-10-17", timePrecision: "unknown", timeValue: "" }
  });
  const sectionPlan = sectionPlanById(fullDossierPlan, "current_sky");
  const payloads = [];
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: async (payload) => {
        payloads.push(payload);
        const serialized = JSON.stringify(payload);
        assert.equal(serialized.includes("natalHouse"), false);
        assert.equal(serialized.includes("houseSystem"), false);
        assert.equal(serialized.includes("ANGLE_SIGN"), false);
        return {
          sectionId: "current_sky",
          blocks: [
            {
              blockId: payload.sectionPlan.blockPlans[0].blockId,
              text: "Jupiter forme un carré à votre Soleil, exact le 2026-10-12T06:00:00.000Z."
            }
          ]
        };
      }
    }
  });
  assert.equal(payloads.length, 1);
  assert.equal(written.validation.ok, true, JSON.stringify(written.validation.issues, null, 2));
});

test("targeted correction for current_sky does not widen evidence", async () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "current_sky");
  const packetSets = [];
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      logger: { warn: () => {} },
      structuredWriterFn: async (payload) => {
        packetSets.push(payload.sectionPlan.evidencePackets.map((packet) => packet.packetId));
        if (packetSets.length === 1) {
          return {
            sectionId: "current_sky",
            blocks: [
              {
                blockId: payload.sectionPlan.blockPlans[0].blockId,
                text: "Jupiter forme un carré à votre Soleil, avec Vénus en Verseau en arrière-plan."
              }
            ]
          };
        }
        assert.deepEqual(packetSets[0], packetSets[1]);
        assert.equal(JSON.stringify(payload.sectionPlan).includes("natal.venus"), false);
        return {
          sectionId: "current_sky",
          blocks: [
            {
              blockId: payload.sectionPlan.blockPlans[0].blockId,
              text: "Jupiter forme un carré à votre Soleil, exact le 2026-10-12T06:00:00.000Z."
            }
          ]
        };
      }
    }
  });
  assert.equal(packetSets.length, 2);
  assert.equal(written.validation.ok, true, JSON.stringify(written.validation.issues, null, 2));
});

test("real failed affectivity case now passes because packetRefs are server-owned", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture({
    currentSky: null,
    input: {
      ...fixtureInput,
      birthDate: "1984-10-17",
      timePrecision: "unknown",
      timeValue: ""
    }
  });
  const sectionPlan = sectionPlanById(fullDossierPlan, "affectivity");
  const section = {
    sectionId: "affectivity",
    blocks: [{ blockId: "block1", text: "Vénus en Scorpion colore l'affectivité par une intensité relationnelle à manier avec nuance." }]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test("an interpretation rule not authorized by the section is rejected", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = sectionPlanById(fullDossierPlan, "identity");
  const badPlan = {
    ...sectionPlan,
    blockPlans: [{ blockId: "block1", packetRefs: ["identity.natal_sun_sign"] }],
    evidencePackets: [{ ...sectionPlan.evidencePackets[0], interpretationRuleRefs: ["western.body.moon.sign.libra@1"] }]
  };
  const section = { sectionId: "identity", blocks: [{ blockId: "block1", text: "Votre Soleil en Capricorne est commenté avec une règle lunaire." }] };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan: badPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "interpretation_rule_without_matching_evidence"));
});

test("LLM cannot introduce claim types or arbitrary packet associations", async () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const sectionPlan = planForPacket(sectionPlanById(fullDossierPlan, "identity"), "identity.natal_sun_sign");
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: async () => ({
        sectionId: "identity",
        blocks: [
          {
            blockId: "block1",
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
  assert.equal(written.section.blocks[0].blockId, "block1");
  assert.equal("packetRefs" in written.section.blocks[0], false);
  assert.equal("claims" in written.section.blocks[0], false);
  assert.equal("evidenceRefs" in written.section.blocks[0], false);
  assert.equal("interpretationRuleRefs" in written.section.blocks[0], false);
});

test("primary reuse of an already interpreted evidence is detected", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const basePlan = planForPackets(sectionPlanById(fullDossierPlan, "general_synthesis"), ["general_synthesis.natal_sun_sign"]);
  const sectionPlan = {
    ...basePlan,
    evidencePackets: basePlan.evidencePackets.map((packet) =>
      packet.evidenceRefs.includes("natal.sun.sign") ? { ...packet, interpretationDepth: "primary" } : packet
    )
  };
  assert.ok(sectionPlan.alreadyInterpretedEvidenceRefs.includes("natal.sun.sign"));
  const section = {
    sectionId: "general_synthesis",
    blocks: [
      {
        blockId: "block1",
        text: "Votre Soleil en Capricorne est interprété ici comme s'il appartenait principalement à la synthèse."
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
                blockId: "block1",
                text: "Votre Soleil en Bélier fait partie des dynamiques centrales du thème."
              }
            ]
          };
        }
        assert.ok(payload.correctionIssues.length >= 1);
        assert.ok(payload.correctionIssues.some((issue) => issue.code === "undeclared_text_fact"));
        assert.equal(payload.correctionIssues[0].blockId, "block1");
        assert.ok(payload.correctionIssues[0].block.textFragment.includes("Soleil en Bélier"));
        assert.ok(payload.correctionIssues[0].authorizedBlockPlans.some((blockPlan) => blockPlan.blockId === "block1"));
        return {
          sectionId: "general_synthesis",
          blocks: [
            {
              blockId: "block1",
              text: "Votre Soleil en Capricorne fait partie des dynamiques centrales du thème."
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
  assert.ok(warnings[0][1].validationErrorCodes.some((code) => code === "undeclared_text_fact"));
});

test("general_synthesis can reference owned evidence without blocking owner chapters", () => {
  const { dossierEvidence, fullDossierPlan } = phase2Fixture();
  const scopedPlan = {
    ...fullDossierPlan,
    sections: fullDossierPlan.sections.map((section) => {
      if (section.sectionId === "general_synthesis") return planForPackets(section, ["general_synthesis.natal_sun_sign"]);
      if (section.sectionId === "identity") return planForPacket(section, "identity.natal_sun_sign");
      if (section.sectionId === "emotional_world") {
        return {
          ...section,
          evidencePackets: section.evidencePackets.filter((packet) =>
            ["emotional_world.natal_moon_sign", "emotional_world.aspect_moon_mercury_square"].includes(packet.packetId)
          ),
          blockPlans: section.blockPlans.filter((blockPlan) =>
            blockPlan.packetRefs.some((packetRef) => ["emotional_world.natal_moon_sign", "emotional_world.aspect_moon_mercury_square"].includes(packetRef))
          )
        };
      }
      return section;
    })
  };
  const synthesis = {
    sectionId: "general_synthesis",
    blocks: [
      {
        blockId: "block1",
        text: "Votre Soleil en Capricorne fait partie des dynamiques centrales du thème."
      }
    ]
  };
  const identity = {
    sectionId: "identity",
    blocks: [
      {
        blockId: "block1",
        text: "Votre Soleil en Capricorne donne un axe d'identité construit dans le temps."
      }
    ]
  };
  const emotional = {
    sectionId: "emotional_world",
    blocks: [
      {
        blockId: blockIdForPacket(sectionPlanById(fullDossierPlan, "emotional_world"), "emotional_world.natal_moon_sign"),
        text: "Votre Lune en Balance introduit le chapitre émotionnel."
      },
      {
        blockId: blockIdForPacket(sectionPlanById(fullDossierPlan, "emotional_world"), "emotional_world.aspect_moon_mercury_square"),
        text: "Le carré entre votre Lune et Mercure décrit une tension entre ressenti et formulation."
      }
    ]
  };
  const result = validateStructuredSections({ dossierEvidence, fullDossierPlan: scopedPlan, sections: [synthesis, identity, emotional] });
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
        blockId: "block1",
        text: "Saturne forme un sextile à votre Lune dans ce ciel actuel."
      }
    ]
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});
