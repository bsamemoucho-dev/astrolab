import { ASTRONOMY_ENGINE_VERSION } from "../astro/constants.mjs";
import { uncertainIntervalAnalysis } from "../astro/signWindows.mjs";
import { hashPayload } from "../astro/westernNatal.mjs";
import { timezoneDatabaseVersion } from "../astro/time.mjs";
import { ELEMENT_BY_SIGN, MODALITY_BY_SIGN, LASTRO_DISTRIBUTION_RULE_VERSION } from "./chart.mjs";

export const DOSSIER_EVIDENCE_SCHEMA = "astrolab.dossier_evidence";
export const DOSSIER_EVIDENCE_VERSION = "dossier-evidence@0.1.0";

const HOUSE_SYSTEM = "WHOLE_SIGN";
const BODY_ORDER = Object.freeze(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);
const ANGLE_KEYS = Object.freeze(["ascendant", "descendant", "midheaven", "imumCoeli"]);

function key(value) {
  return String(value ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function provenance({ natalResult = null, natalRun = null, currentSky = null, source = "western-natal", ruleVersion = null, reliability = "HIGH", generatedAt }) {
  return {
    engine: source === "current-sky" ? "westernTransits/currentSkyService" : "westernNatal",
    astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
    method: source === "current-sky" ? "western-transits" : "western-natal",
    methodVersion: source === "current-sky" ? currentSky?.versions?.methodVersion ?? null : natalResult?.methodVersion ?? null,
    ruleVersion,
    calculatedAt: source === "current-sky" ? currentSky?.generatedAt ?? generatedAt : natalResult?.calculatedAt ?? natalRun?.calculatedAt ?? generatedAt,
    reliability,
    calculationRunId: natalRun?.id ?? null,
    resultHash: natalRun?.resultHash ?? null,
    timezoneDatabaseVersion: timezoneDatabaseVersion()
  };
}

function houseForBody(body, houses) {
  if (!Number.isFinite(body?.signIndex) || !Array.isArray(houses)) return null;
  return houses.find((house) => house.signIndex === body.signIndex)?.houseNumber ?? null;
}

function aspectId(bodyA, bodyB, aspectType) {
  const ordered = [bodyA, bodyB].sort((a, b) => {
    const ia = BODY_ORDER.indexOf(a);
    const ib = BODY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return `aspect.${key(ordered[0])}.${key(ordered[1])}.${key(aspectType)}`;
}

function add(evidence, item) {
  evidence.push(item);
  return item;
}

function intervalTargetForBody(natalResult, bodyName, daySignStability = null) {
  if (daySignStability) {
    return daySignStability.get(bodyName) ?? daySignStability.get(key(bodyName)) ?? null;
  }
  const targets = natalResult.uncertainty?.intervalAnalysis?.targets;
  if (!Array.isArray(targets)) return null;
  return targets.find((target) => key(target.target) === key(bodyName)) ?? null;
}

function unknownCivilDaySignStability(natalResult, birth) {
  if ((natalResult.uncertainty?.timePrecision ?? birth.timePrecision ?? null) !== "unknown") return null;
  try {
    const analysis = uncertainIntervalAnalysis({
      birthDate: birth.birthDate,
      timeZone: birth.timeZone,
      latitude: birth.latitude,
      longitude: birth.longitude,
      timeStart: "00:00:00",
      timeEnd: "23:59:59"
    });
    return new Map(analysis.targets.map((target) => [key(target.target), target]));
  } catch {
    return new Map();
  }
}

function bodySignCertainty({ body, natalResult, birth, daySignStability = null }) {
  const timePrecision = natalResult.uncertainty?.timePrecision ?? birth.timePrecision ?? null;
  if (timePrecision === "exact") {
    return {
      stableAcrossApplicableWindow: true,
      timePrecision,
      basis: "exact_time"
    };
  }
  if (timePrecision === "approximate") {
    return {
      stableAcrossApplicableWindow: body.marginWindow?.signStable === true,
      timePrecision,
      basis: "declared_time_margin",
      marginMinutes: body.marginWindow?.marginMinutes ?? birth.timeMarginMinutes ?? null
    };
  }
  if (timePrecision === "interval") {
    const target = intervalTargetForBody(natalResult, body.body);
    return {
      stableAcrossApplicableWindow: target ? target.status === "stable" : false,
      timePrecision,
      basis: "declared_time_interval"
    };
  }
  if (timePrecision === "unknown") {
    const target = intervalTargetForBody(natalResult, body.body, daySignStability);
    return {
      stableAcrossApplicableWindow: target ? target.status === "stable" : false,
      timePrecision,
      basis: "local_civil_day_sign_boundary_analysis"
    };
  }
  return {
    stableAcrossApplicableWindow: null,
    timePrecision,
    basis: "unknown_time_policy"
  };
}

function aspectCertainty({ aspect, natalResult, birth }) {
  const timePrecision = natalResult.uncertainty?.timePrecision ?? birth.timePrecision ?? null;
  const marginStable = aspect.marginStability?.stable;
  const stableAcrossApplicableWindow = timePrecision === "exact"
    ? true
    : marginStable === true;
  return {
    stableAcrossApplicableWindow,
    timePrecision,
    basis: marginStable === undefined ? "engine_retained_aspect" : "aspect_margin_stability",
    normalizedExactness: Number.isFinite(Number(aspect.orbUsed)) && Number(aspect.orbUsed) > 0
      ? round(Math.abs(Number(aspect.exactness)) / Number(aspect.orbUsed))
      : null
  };
}

function buildNatalEvidence({ evidence, natalResult, natalRun, generatedAt }) {
  const birth = natalResult.normalizedInput ?? {};
  const houses = Array.isArray(natalResult.structuralAstrology?.houses) ? natalResult.structuralAstrology.houses : [];
  const houseUsable = houses.length > 0 && natalResult.structuralAstrology?.houseUncertainty?.housesDecidableWithinMargin !== false;
  const base = (ruleVersion = null, reliability = "HIGH") => provenance({ natalResult, natalRun, ruleVersion, reliability, generatedAt });
  const daySignStability = unknownCivilDaySignStability(natalResult, birth);

  add(evidence, {
    evidenceId: "birth.identity",
    type: "BIRTH_CONTEXT",
    value: {
      birthDate: birth.birthDate ?? null,
      timePrecision: birth.timePrecision ?? null,
      timeValue: birth.timeValue ?? null,
      timeZone: birth.timeZone ?? null,
      placeName: birth.placeName ?? null,
      latitude: birth.latitude ?? null,
      longitude: birth.longitude ?? null
    },
    provenance: base("lastro-time-margin@1.0.0")
  });

  for (const body of natalResult.astronomicalCalculation?.bodies ?? []) {
    const bodyKey = key(body.body);
    const reliability = body.sign ? "HIGH" : "INSUFFICIENT";
    if (body.sign) {
      add(evidence, {
        evidenceId: `natal.${bodyKey}.sign`,
        type: "NATAL_BODY_SIGN",
        value: { body: body.body, sign: body.sign, degreeInSign: round(body.degreeInSign), longitude: round(body.longitude) },
        certainty: bodySignCertainty({ body, natalResult, birth, daySignStability }),
        provenance: base(null, reliability)
      });
    }
    if (body.apparentMotion && typeof body.apparentMotion.retrograde === "boolean") {
      add(evidence, {
        evidenceId: `natal.${bodyKey}.retrograde`,
        type: "NATAL_BODY_RETROGRADE",
        value: { body: body.body, retrograde: Boolean(body.apparentMotion.retrograde) },
        provenance: base(null, reliability)
      });
    }
    const house = houseUsable ? houseForBody(body, houses) : null;
    if (house) {
      add(evidence, {
        evidenceId: `natal.${bodyKey}.house`,
        type: "NATAL_BODY_HOUSE",
        value: { body: body.body, house, houseSystem: HOUSE_SYSTEM },
        provenance: base("ADR-007-house-system", "HIGH")
      });
    }
  }

  const angles = natalResult.astronomicalCalculation?.angles ?? {};
  for (const angleKey of ANGLE_KEYS) {
    const angle = angles[angleKey];
    if (!angle?.sign) continue;
    add(evidence, {
      evidenceId: `angle.${key(angleKey)}.sign`,
      type: "ANGLE_SIGN",
      value: { angle: angleKey, sign: angle.sign, degreeInSign: round(angle.degreeInSign), longitude: round(angle.longitude) },
      provenance: base("ADR-007-house-system", "HIGH")
    });
  }

  const aspects = natalResult.structuralAstrology?.aspects ?? null;
  for (const item of aspects?.items ?? []) {
    if (!item.retained) continue;
    add(evidence, {
      evidenceId: aspectId(item.bodyA, item.bodyB, item.type),
      type: "NATAL_ASPECT",
      value: {
        bodyA: item.bodyA,
        bodyB: item.bodyB,
        aspectType: item.type,
        orb: round(item.exactness),
        orbLimit: round(item.orbUsed),
        exactness: round(item.exactness),
        ruleVersion: item.ruleVersionId ?? aspects.ruleVersionId ?? null
      },
      certainty: aspectCertainty({ aspect: item, natalResult, birth }),
      provenance: base(item.ruleVersionId ?? aspects.ruleVersionId ?? null, item.marginStability?.stable === false ? "LOW" : "HIGH")
    });
  }

  const distribution = { element: {}, modality: {}, classified: 0 };
  for (const body of natalResult.astronomicalCalculation?.bodies ?? []) {
    if (!body.sign) continue;
    const element = ELEMENT_BY_SIGN[body.sign];
    const modality = MODALITY_BY_SIGN[body.sign];
    if (!element || !modality) continue;
    distribution.classified += 1;
    distribution.element[element] = (distribution.element[element] ?? 0) + 1;
    distribution.modality[modality] = (distribution.modality[modality] ?? 0) + 1;
  }
  for (const [element, count] of Object.entries(distribution.element)) {
    add(evidence, {
      evidenceId: `distribution.element.${key(element)}`,
      type: "DISTRIBUTION_ELEMENT_COUNT",
      value: { element, count, classifiedBodies: distribution.classified },
      provenance: base(LASTRO_DISTRIBUTION_RULE_VERSION, "HIGH")
    });
  }
  for (const [modality, count] of Object.entries(distribution.modality)) {
    add(evidence, {
      evidenceId: `distribution.modality.${key(modality)}`,
      type: "DISTRIBUTION_MODALITY_COUNT",
      value: { modality, count, classifiedBodies: distribution.classified },
      provenance: base(LASTRO_DISTRIBUTION_RULE_VERSION, "HIGH")
    });
  }

  add(evidence, {
    evidenceId: "uncertainty.birth_time",
    type: "UNCERTAINTY",
    value: {
      timePrecision: natalResult.uncertainty?.timePrecision ?? birth.timePrecision ?? null,
      indeterminable: natalResult.uncertainty?.indeterminable ?? [],
      warnings: natalResult.uncertainty?.warnings ?? []
    },
    provenance: base("lastro-time-margin@1.0.0")
  });
}

function transitSignature(result) {
  return hashPayload({
    resultId: result.resultId,
    transitBody: result.contact?.transitBody,
    natalPoint: result.contact?.natalPoint,
    aspectType: result.contact?.aspectType,
    exactAt: result.timing?.exactAt
  }).slice(0, 16);
}

function buildTransitEvidence({ evidence, currentSky, generatedAt }) {
  if (!currentSky) return;
  const all = [...(currentSky.current ?? []), ...(currentSky.upcoming ?? []), ...(currentSky.recent ?? [])];
  add(evidence, {
    evidenceId: "transits.snapshot",
    type: "TRANSIT_SNAPSHOT",
    value: {
      generatedAt: currentSky.generatedAt ?? generatedAt,
      nowUtc: currentSky.window?.nowUtc ?? null,
      horizonDays: currentSky.window?.horizonDays ?? null,
      fromUtc: currentSky.window?.fromUtc ?? null,
      toUtc: currentSky.window?.toUtc ?? null
    },
    provenance: provenance({ currentSky, source: "current-sky", ruleVersion: currentSky.versions?.ruleVersion ?? null, generatedAt })
  });
  for (const result of all) {
    const contact = result.contact ?? {};
    const timing = result.timing ?? {};
    const signature = transitSignature(result);
    const evidenceId = `transit.${key(contact.transitBody)}.${key(contact.natalPoint)}.${key(contact.aspectType)}.${signature}`;
    add(evidence, {
      evidenceId,
      type: "PERSONAL_TRANSIT",
      value: {
        resultId: result.resultId,
        status: result.status,
        relevance: result.relevance,
        transitBody: contact.transitBody,
        natalPoint: contact.natalPoint,
        aspectType: contact.aspectType,
        orb: round(contact.orb),
        effectiveOrbLimit: round(contact.effectiveOrbLimit),
        exactAt: iso(timing.exactAt),
        startsAt: iso(timing.startsAt),
        endsAt: iso(timing.endsAt),
        phase: timing.phase ?? null,
        reliability: contact.reliability ?? null,
        natalHouse: contact.natalHouse ?? null,
        houseSystem: contact.houseSystem ?? null
      },
      provenance: provenance({
        currentSky,
        source: "current-sky",
        ruleVersion: result.evidence?.orbRuleVersion ?? currentSky.versions?.orbRuleVersion ?? null,
        reliability: contact.reliability ?? "UNKNOWN",
        generatedAt
      })
    });
  }
}

export function buildDossierEvidence({ natalResult, natalRun = null, currentSky = null, parentContext = null, generatedAt = new Date().toISOString() } = {}) {
  if (!natalResult) {
    const error = new Error("natalResult is required to build DossierEvidence");
    error.status = 400;
    throw error;
  }
  const evidence = [];
  buildNatalEvidence({ evidence, natalResult, natalRun, generatedAt });
  buildTransitEvidence({ evidence, currentSky, generatedAt });
  if (parentContext && Array.isArray(parentContext.parents) && parentContext.parents.length > 0) {
    add(evidence, {
      evidenceId: "parent.context",
      type: "PARENT_CONTEXT",
      value: { parents: parentContext.parents },
      provenance: {
        engine: "user_input",
        method: "parent-context",
        methodVersion: null,
        ruleVersion: null,
        calculatedAt: generatedAt,
        reliability: "USER_PROVIDED"
      }
    });
  }
  return {
    schema: DOSSIER_EVIDENCE_SCHEMA,
    version: DOSSIER_EVIDENCE_VERSION,
    generatedAt,
    snapshot: {
      currentSky: currentSky
        ? {
            generatedAt: currentSky.generatedAt ?? generatedAt,
            nowUtc: currentSky.window?.nowUtc ?? null,
            horizonDays: currentSky.window?.horizonDays ?? null
          }
        : null
    },
    evidence
  };
}

export function evidenceById(dossierEvidence) {
  return new Map((dossierEvidence?.evidence ?? []).map((item) => [item.evidenceId, item]));
}

export function futureDossierConceptsMissingMethodRules() {
  return [
    "harmonic_or_dissonant_aspect_categories",
    "stabilising_or_destabilising_factors",
    "relationship_or_professional_factor_categories",
    "sign_or_element_to_life_domain_associations",
    "dominant_arches_or_jungian_archetypes",
    "letter_soul_method",
    "crossed_letter_method",
    "passage_letter_method",
    "transgenerational_interpretation_rules",
    "jyotisha_or_bazi_or_maya_or_celtic_insertions"
  ];
}
