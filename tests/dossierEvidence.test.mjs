import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence, evidenceById, futureDossierConceptsMissingMethodRules } from "../src/deliverables/dossierEvidence.mjs";
import { validateDossierClaims, validateGeneratedSection } from "../src/deliverables/factualClaimsValidator.mjs";

const parisSquareInput = {
  personId: "person_square",
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

function natalEvidence(input = parisSquareInput) {
  const calculation = calculateWesternNatalChart(input, {
    calculatedAt: "2026-10-03T00:00:00.000Z",
    runId: "calc_test_square"
  });
  return buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-03T12:00:00.000Z"
  });
}

function sampleCurrentSky() {
  return {
    schema: "astrolab.personal_current_sky",
    personId: "person_square",
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

test("DossierEvidence exposes stable atomic evidence ids and provenance", () => {
  const evidence = natalEvidence();
  const byId = evidenceById(evidence);

  assert.equal(evidence.schema, "astrolab.dossier_evidence");
  assert.ok(byId.has("birth.identity"));
  assert.ok(byId.has("natal.sun.sign"));
  assert.ok(byId.has("natal.moon.house"));
  assert.ok(byId.has("aspect.moon.mercury.square"));
  assert.ok(byId.has("uncertainty.birth_time"));

  const aspect = byId.get("aspect.moon.mercury.square");
  assert.equal(aspect.value.aspectType, "square");
  assert.equal(aspect.provenance.ruleVersion, "lastro-aspects@1.0.0");
  assert.equal(aspect.provenance.calculationRunId, "calc_test_square");
});

test("structured claims allow the real Moon-Mercury square and reject an invented opposition", () => {
  const evidence = natalEvidence();
  const accepted = validateDossierClaims({
    dossierEvidence: evidence,
    claims: [
      {
        claimId: "claim.real-square",
        type: "NATAL_ASPECT",
        bodyA: "Moon",
        bodyB: "Mercury",
        aspectType: "square",
        evidenceRefs: ["aspect.moon.mercury.square"]
      }
    ]
  });
  assert.equal(accepted.ok, true);

  const rejected = validateDossierClaims({
    dossierEvidence: evidence,
    claims: [
      {
        claimId: "claim.fake-opposition",
        type: "NATAL_ASPECT",
        bodyA: "Moon",
        bodyB: "Mercury",
        aspectType: "opposition",
        evidenceRefs: ["aspect.moon.mercury.square"]
      }
    ]
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.code === "aspect_type_mismatch"));
});

test("validator rejects wrong houses, signs, retrogradation and orb claims", () => {
  const evidence = natalEvidence();
  const byId = evidenceById(evidence);
  const moonHouse = byId.get("natal.moon.house").value.house;
  const sunSign = byId.get("natal.sun.sign").value.sign;
  const mercuryRetrograde = byId.get("natal.mercury.retrograde").value.retrograde;
  const aspectOrb = byId.get("aspect.moon.mercury.square").value.orb;

  const result = validateDossierClaims({
    dossierEvidence: evidence,
    claims: [
      {
        claimId: "claim.wrong-house",
        type: "NATAL_BODY_HOUSE",
        body: "Moon",
        house: moonHouse === 8 ? 7 : 8,
        houseSystem: "WHOLE_SIGN",
        evidenceRefs: ["natal.moon.house"]
      },
      {
        claimId: "claim.wrong-sign",
        type: "NATAL_BODY_SIGN",
        body: "Sun",
        sign: sunSign === "Capricorn" ? "Aries" : "Capricorn",
        evidenceRefs: ["natal.sun.sign"]
      },
      {
        claimId: "claim.wrong-retrograde",
        type: "NATAL_BODY_RETROGRADE",
        body: "Mercury",
        retrograde: !mercuryRetrograde,
        evidenceRefs: ["natal.mercury.retrograde"]
      },
      {
        claimId: "claim.wrong-orb",
        type: "NATAL_ASPECT_ORB",
        orb: aspectOrb + 4.5,
        evidenceRefs: ["aspect.moon.mercury.square"]
      }
    ]
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "house_mismatch"));
  assert.ok(result.issues.some((issue) => issue.code === "sign_mismatch"));
  assert.ok(result.issues.some((issue) => issue.code === "retrograde_mismatch"));
  assert.ok(result.issues.some((issue) => issue.code === "orb_mismatch"));
});

test("transit claims validate aspect, exactAt, orb window, phase and house", () => {
  const calculation = calculateWesternNatalChart(parisSquareInput, {
    calculatedAt: "2026-10-03T00:00:00.000Z",
    runId: "calc_test_transit"
  });
  const evidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    currentSky: sampleCurrentSky(),
    generatedAt: "2026-10-03T12:00:00.000Z"
  });
  const transitId = evidence.evidence.find((item) => item.type === "PERSONAL_TRANSIT").evidenceId;

  const accepted = validateDossierClaims({
    dossierEvidence: evidence,
    claims: [
      {
        claimId: "claim.real-transit",
        type: "PERSONAL_TRANSIT",
        transitBody: "Jupiter",
        natalPoint: "Sun",
        aspectType: "square",
        exactAt: "2026-10-12T06:00:00.000Z",
        startsAt: "2026-10-01T00:00:00.000Z",
        endsAt: "2026-10-24T00:00:00.000Z",
        phase: "APPLYING",
        natalHouse: 7,
        evidenceRefs: [transitId]
      }
    ]
  });
  assert.equal(accepted.ok, true);

  const rejected = validateDossierClaims({
    dossierEvidence: evidence,
    claims: [
      {
        claimId: "claim.fake-transit",
        type: "PERSONAL_TRANSIT",
        transitBody: "Jupiter",
        natalPoint: "Sun",
        aspectType: "trine",
        exactAt: "2026-10-13T06:00:00.000Z",
        startsAt: "2026-10-02T00:00:00.000Z",
        endsAt: "2026-10-25T00:00:00.000Z",
        phase: "SEPARATING",
        natalHouse: 8,
        evidenceRefs: [transitId]
      }
    ]
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.code === "transit_aspect_mismatch"));
  assert.ok(rejected.issues.some((issue) => issue.code === "exact_at_mismatch"));
  assert.ok(rejected.issues.some((issue) => issue.code === "orb_window_start_mismatch"));
  assert.ok(rejected.issues.some((issue) => issue.code === "orb_window_end_mismatch"));
  assert.ok(rejected.issues.some((issue) => issue.code === "phase_mismatch"));
  assert.ok(rejected.issues.some((issue) => issue.code === "transit_house_mismatch"));
});

test("unknown birth time does not expose angle or house evidence, and unsupported factual claims fail", () => {
  const evidence = natalEvidence({ ...parisSquareInput, timePrecision: "unknown", timeValue: "" });
  const byId = evidenceById(evidence);
  assert.equal(byId.has("angle.ascendant.sign"), false);
  assert.equal(byId.has("natal.sun.house"), false);

  const result = validateGeneratedSection({
    dossierEvidence: evidence,
    section: {
      text: "Votre Ascendant est en Lion.",
      claims: [
        {
          claimId: "claim.invented-asc",
          type: "ANGLE_SIGN",
          angle: "ascendant",
          sign: "Leo",
          evidenceRefs: ["angle.ascendant.sign"]
        },
        {
          claimId: "claim.absent-house",
          type: "NATAL_BODY_HOUSE",
          body: "Sun",
          house: 7,
          evidenceRefs: ["natal.sun.house"]
        },
        {
          claimId: "claim.no-ref",
          type: "NATAL_BODY_SIGN",
          body: "Sun",
          sign: "Capricorn",
          evidenceRefs: []
        }
      ]
    }
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "unknown_evidence_ref" && issue.evidenceRef === "angle.ascendant.sign"));
  assert.ok(result.issues.some((issue) => issue.code === "unknown_evidence_ref" && issue.evidenceRef === "natal.sun.house"));
  assert.ok(result.issues.some((issue) => issue.code === "missing_evidence_refs"));
});

test("future dossier concepts without method rules are explicitly listed", () => {
  const missing = futureDossierConceptsMissingMethodRules();
  assert.ok(missing.includes("harmonic_or_dissonant_aspect_categories"));
  assert.ok(missing.includes("letter_soul_method"));
  assert.ok(missing.includes("transgenerational_interpretation_rules"));
  assert.ok(missing.includes("jyotisha_or_bazi_or_maya_or_celtic_insertions"));
});
