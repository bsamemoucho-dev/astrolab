import { createHash } from "node:crypto";

import { analyzeWesternNatalPrototype } from "../analysis/westernNatalPrototype.mjs";
import { calculateAngles, altitude, zodiacPlacement } from "./angles.mjs";
import {
  ASTRONOMY_ENGINE_VERSION,
  ASTROLAB_MODEL_VERSION,
  SEVEN_TRADITIONAL_BODIES,
  SIGN_NAMES,
  TRADITIONAL_RULERS,
  WESTERN_NATAL_METHOD_VERSION
} from "./constants.mjs";
import { calculateBodyPositions } from "./ephemeris.mjs";
import { normalizeSignedDegrees, round } from "./math.mjs";
import { julianDay, localDateTimeToUtc, parseDate, parseTime, validateCoordinates } from "./time.mjs";
import { uncertainIntervalAnalysis } from "./signWindows.mjs";

const WHOLE_SIGN_DECISION_STATUS = "validated_product_decision_without_rule_version";
const INACTIVE_RULE_STATUS = "structure_only_rule_version_not_created";

export { calculateAngles, zodiacPlacement };

const ASPECT_CANDIDATES = [
  { type: "conjunction", exactAngle: 0 },
  { type: "sextile", exactAngle: 60 },
  { type: "square", exactAngle: 90 },
  { type: "trine", exactAngle: 120 },
  { type: "opposition", exactAngle: 180 }
];

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function hashPayload(value) {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function requireString(value, field) {
  const text = String(value ?? "").trim();
  if (!text) {
    const error = new Error(`Missing required field: ${field}`);
    error.status = 400;
    throw error;
  }
  return text;
}

function nullableString(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function parseResolvedPlace(input) {
  const resolvedPlace = input.resolvedPlace ?? null;
  if (resolvedPlace) {
    const normalized = resolvedPlace.normalizedForCalculation ?? resolvedPlace;
    return {
      placeName: nullableString(resolvedPlace.selectedName ?? resolvedPlace.name ?? normalized.placeName),
      country: nullableString(resolvedPlace.country),
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      timeZone: normalized.timeZone ?? resolvedPlace.timeZone,
      resolvedPlace
    };
  }
  return {
    placeName: nullableString(input.placeName ?? input.birthPlace),
    country: nullableString(input.country),
    latitude: input.latitude,
    longitude: input.longitude,
    timeZone: input.timeZone,
    resolvedPlace: null
  };
}

function normalizeTime(input) {
  let timePrecision = input.timePrecision ?? (input.timeValue ? "exact" : "unknown");
  // Legacy UI value "very_approximate" is handled as approximate time.
  if (timePrecision === "very_approximate") {
    timePrecision = "approximate";
  }
  if (timePrecision === "exact" || timePrecision === "approximate") {
    const timeValue = requireString(input.timeValue, "timeValue");
    parseTime(timeValue);
    return {
      timePrecision,
      timeValue,
      timeStart: null,
      timeEnd: null,
      calculationMode: timePrecision === "exact" ? "exact_time" : "approximate_time"
    };
  }
  if (timePrecision === "interval") {
    const timeStart = requireString(input.timeStart, "timeStart");
    const timeEnd = requireString(input.timeEnd, "timeEnd");
    parseTime(timeStart);
    parseTime(timeEnd);
    return {
      timePrecision,
      timeValue: null,
      timeStart,
      timeEnd,
      calculationMode: "time_interval"
    };
  }
  if (timePrecision === "unknown") {
    return {
      timePrecision,
      timeValue: null,
      timeStart: null,
      timeEnd: null,
      calculationMode: "date_only_time_unknown"
    };
  }
  const error = new Error("Invalid time precision");
  error.status = 400;
  throw error;
}

function normalizeInput(input) {
  const birthDate = requireString(input.birthDate, "birthDate");
  parseDate(birthDate);
  const time = normalizeTime(input);
  const place = parseResolvedPlace(input);
  const timeZone = requireString(place.timeZone, "timeZone");
  const coordinates = validateCoordinates(place.latitude, place.longitude);

  return {
    personId: nullableString(input.personId),
    birthDate,
    ...time,
    placeName: place.placeName,
    country: place.country,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    timeZone,
    resolvedPlace: place.resolvedPlace,
    coordinateSource: nullableString(input.coordinateSource) ?? place.resolvedPlace?.resolutionSource ?? "user_provided",
    coordinateConfidence: nullableString(input.coordinateConfidence) ?? place.resolvedPlace?.confidence ?? "unverified",
    calendar: "gregorian",
    zodiac: "tropical",
    houseSystem: "whole_sign",
    coordinateSystem: "geocentric_apparent_ecliptic_longitude",
    methodScope: "western_natal_v1_hellenistic_first_school"
  };
}

function markApproximateAngleUncertainty(angles, normalizedInput) {
  if (normalizedInput.timePrecision !== "approximate") {
    return angles;
  }
  return {
    ...angles,
    uncertaintyStatus: "depends_on_approximate_birth_time",
    referenceTimeUsed: normalizedInput.timeValue,
    uncertaintyWindow: null,
    warning: "Angles were calculated from the supplied reference time, but no uncertainty margin is known."
  };
}

function calculateWholeSignHouses(ascendant, normalizedInput) {
  return Array.from({ length: 12 }, (_, index) => {
    const signIndex = (ascendant.signIndex + index) % 12;
    const sign = SIGN_NAMES[signIndex];
    return {
      houseNumber: index + 1,
      signIndex,
      sign,
      ruler: TRADITIONAL_RULERS[sign],
      cuspLongitude: signIndex * 30,
      system: "whole_sign",
      decisionStatus: WHOLE_SIGN_DECISION_STATUS,
      ruleVersionId: null,
      uncertaintyStatus: normalizedInput.timePrecision === "approximate" ? "depends_on_approximate_birth_time" : "time_exact_or_not_time_dependent",
      referenceTimeUsed: normalizedInput.timePrecision === "approximate" ? normalizedInput.timeValue : null
    };
  });
}

function calculateSect(sunLongitude, jd, latitude, longitude) {
  const sunAltitude = altitude(sunLongitude, jd, latitude, longitude);
  const chartSect = sunAltitude > 0 ? "diurnal" : "nocturnal";
  return {
    chartSect,
    sunAltitude: round(sunAltitude, 6),
    luminaryOfSect: chartSect === "diurnal" ? "sun" : "moon",
    classificationStatus: INACTIVE_RULE_STATUS,
    ruleVersionId: null,
    mercurySectStatus: "not_resolved_variant_requires_methodological_decision"
  };
}

function notCalculatedAngles(reason) {
  return {
    status: reason,
    ascendant: null,
    descendant: null,
    midheaven: null,
    imumCoeli: null,
    localSiderealTime: null,
    obliquity: null
  };
}

function notCalculatedHouses(reason) {
  return {
    status: reason,
    system: "whole_sign",
    houses: [],
    ruleVersionId: null
  };
}

function notCalculatedSect(reason) {
  return {
    chartSect: "unknown",
    sunAltitude: null,
    luminaryOfSect: null,
    classificationStatus: reason,
    ruleVersionId: null,
    mercurySectStatus: "not_resolved_variant_requires_methodological_decision"
  };
}

function angularDistance(a, b) {
  const distance = Math.abs(normalizeSignedDegrees(a - b));
  return round(Math.min(distance, 360 - distance), 6);
}

function calculateAspectInfrastructure(positions) {
  const pairs = [];
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const first = positions[i];
      const second = positions[j];
      const distance = angularDistance(first.longitude, second.longitude);
      pairs.push({
        bodyA: first.body,
        bodyB: second.body,
        angularDistance: distance,
        candidates: ASPECT_CANDIDATES.map((aspect) => ({
          ...aspect,
          exactness: round(Math.abs(distance - aspect.exactAngle), 6)
        })).sort((a, b) => a.exactness - b.exactness),
        active: false,
        orbUsed: null,
        ruleVersionId: null,
        status: "aspect_geometry_only_orb_rule_not_validated"
      });
    }
  }
  return pairs;
}

function inactiveConditions(positions) {
  return positions.map((position) => ({
    body: position.body,
    sign: position.sign,
    domicile: { status: INACTIVE_RULE_STATUS, ruleVersionId: null },
    exaltation: { status: INACTIVE_RULE_STATUS, ruleVersionId: null },
    triplicity: { status: INACTIVE_RULE_STATUS, ruleVersionId: null },
    bounds: { status: INACTIVE_RULE_STATUS, ruleVersionId: null },
    face: { status: INACTIVE_RULE_STATUS, ruleVersionId: null },
    sectCondition: { status: INACTIVE_RULE_STATUS, ruleVersionId: null },
    angularityCadence: { status: INACTIVE_RULE_STATUS, ruleVersionId: null },
    visibility: { status: INACTIVE_RULE_STATUS, ruleVersionId: null },
    retrogradation: {
      value: position.apparentMotion.retrograde,
      status: "astronomical_motion_only_no_interpretive_rule",
      ruleVersionId: null
    },
    speed: {
      dailyMotion: position.apparentMotion.dailyLongitudeDelta,
      status: "astronomical_motion_only_no_interpretive_rule",
      ruleVersionId: null
    }
  }));
}

function inactiveLots() {
  return [
    {
      lot: "fortune",
      variants: ["day_formula", "night_formula"],
      value: null,
      status: "not_calculated_formula_variant_not_validated",
      ruleVersionId: null
    },
    {
      lot: "spirit",
      variants: ["day_formula", "night_formula"],
      value: null,
      status: "not_calculated_formula_variant_not_validated",
      ruleVersionId: null
    }
  ];
}

function timeWindow(normalizedInput) {
  const date = parseDate(normalizedInput.birthDate);
  if (normalizedInput.calculationMode === "exact_time" || normalizedInput.calculationMode === "approximate_time") {
    const result = localDateTimeToUtc({
      date,
      time: parseTime(normalizedInput.timeValue),
      timeZone: normalizedInput.timeZone
    });
    return {
      mode: normalizedInput.calculationMode,
      representativeUtcInstant: result.utcInstant,
      startUtcInstant: result.utcInstant,
      endUtcInstant: result.utcInstant,
      timezoneOffsetMinutes: result.timezoneOffsetMinutes
    };
  }
  if (normalizedInput.calculationMode === "time_interval") {
    const start = localDateTimeToUtc({
      date,
      time: parseTime(normalizedInput.timeStart),
      timeZone: normalizedInput.timeZone
    });
    const end = localDateTimeToUtc({
      date,
      time: parseTime(normalizedInput.timeEnd),
      timeZone: normalizedInput.timeZone
    });
    return {
      mode: "time_interval",
      representativeUtcInstant: null,
      startUtcInstant: start.utcInstant,
      endUtcInstant: end.utcInstant,
      timezoneOffsetMinutes: {
        start: start.timezoneOffsetMinutes,
        end: end.timezoneOffsetMinutes
      }
    };
  }
  const start = localDateTimeToUtc({
    date,
    time: { hour: 0, minute: 0, second: 0 },
    timeZone: normalizedInput.timeZone
  });
  const end = localDateTimeToUtc({
    date,
    time: { hour: 23, minute: 59, second: 59 },
    timeZone: normalizedInput.timeZone
  });
  return {
    mode: "date_only_time_unknown",
    representativeUtcInstant: null,
    startUtcInstant: start.utcInstant,
    endUtcInstant: end.utcInstant,
    timezoneOffsetMinutes: {
      start: start.timezoneOffsetMinutes,
      end: end.timezoneOffsetMinutes
    }
  };
}

function calculateTimedPositions(jd, status) {
  return calculateBodyPositions(SEVEN_TRADITIONAL_BODIES, jd).map((position) => ({
    ...position,
    ...zodiacPlacement(position.longitude),
    temporalStatus: status
  }));
}

function calculateWindowPositions(startJd, endJd, status) {
  const startPositions = calculateTimedPositions(startJd, "window_start");
  const endPositions = calculateTimedPositions(endJd, "window_end");
  return startPositions.map((start) => {
    const end = endPositions.find((position) => position.body === start.body);
    const sameSign = start.sign === end.sign;
    return {
      body: start.body,
      longitude: null,
      latitude: null,
      distance: null,
      sign: sameSign ? start.sign : null,
      signIndex: sameSign ? start.signIndex : null,
      degreeInSign: null,
      ruler: sameSign ? start.ruler : null,
      longitudeRange: {
        start: start.longitude,
        end: end.longitude
      },
      signRange: {
        start: start.sign,
        end: end.sign
      },
      apparentMotion: {
        dailyLongitudeDelta: null,
        retrograde: null,
        status: "not_collapsed_from_uncertain_time_window"
      },
      temporalStatus: sameSign ? `${status}_stable_sign` : `${status}_sign_changes_or_unresolved`,
      engineVersion: start.engineVersion,
      ephemerisVersion: start.ephemerisVersion
    };
  });
}

function timeEvidence(normalizedInput) {
  if (normalizedInput.timePrecision === "exact") {
    return {
      precision: "exact",
      suppliedTime: normalizedInput.timeValue,
      referenceTimeUsedForTimedCalculations: normalizedInput.timeValue,
      uncertaintyWindow: null,
      status: "exact_time_supplied"
    };
  }
  if (normalizedInput.timePrecision === "approximate") {
    return {
      precision: "approximate",
      suppliedTime: normalizedInput.timeValue,
      referenceTimeUsedForTimedCalculations: normalizedInput.timeValue,
      uncertaintyWindow: null,
      status: "approximate_time_used_as_reference_not_exact",
      sensitiveOutputs: ["ascendant", "descendant", "midheaven", "imumCoeli", "houses", "sect"],
      warning: "No uncertainty margin was supplied; angles and houses depend on the unknown margin around the reference time."
    };
  }
  if (normalizedInput.timePrecision === "interval") {
    return {
      precision: "interval",
      suppliedTime: null,
      interval: {
        start: normalizedInput.timeStart,
        end: normalizedInput.timeEnd
      },
      referenceTimeUsedForTimedCalculations: null,
      status: "interval_preserved_no_single_exact_time_invented"
    };
  }
  return {
    precision: "unknown",
    suppliedTime: null,
    referenceTimeUsedForTimedCalculations: null,
    uncertaintyWindow: null,
    status: "time_unknown_no_time_invented"
  };
}

function buildDeterministicPayload(normalizedInput, window, positions, angles, houses, sect, aspects, conditions, lots, warnings) {
  return {
    schema: "astrolab.western_natal.structured_result",
    schemaVersion: ASTROLAB_MODEL_VERSION,
    methodId: "western-natal",
    methodVersion: WESTERN_NATAL_METHOD_VERSION,
    status: "calculated_development_not_production",
    productionEligible: false,
    normalizedInput,
    time: {
      localDate: normalizedInput.birthDate,
      localTime: normalizedInput.timeValue,
      timeStart: normalizedInput.timeStart,
      timeEnd: normalizedInput.timeEnd,
      timeZone: normalizedInput.timeZone,
      utc: window.representativeUtcInstant?.toISOString() ?? null,
      utcRange: {
        start: window.startUtcInstant.toISOString(),
        end: window.endUtcInstant.toISOString()
      },
      julianDay: window.representativeUtcInstant ? round(julianDay(window.representativeUtcInstant), 8) : null,
      julianDayRange: {
        start: round(julianDay(window.startUtcInstant), 8),
        end: round(julianDay(window.endUtcInstant), 8)
      },
      timezoneOffsetMinutes: window.timezoneOffsetMinutes
    },
    parameters: {
      zodiac: "tropical",
      houseSystem: "whole_sign",
      astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
      ephemerisStatus: "astronomy_engine_2_1_19_validated_against_jpl_horizons_reference_fixtures",
      internetUsedAtRuntime: false,
      ruleVersionsCreated: false
    },
    astronomicalCalculation: {
      bodies: positions,
      angles
    },
    structuralAstrology: {
      signs: positions.map((position) => ({
        body: position.body,
        sign: position.sign,
        signIndex: position.signIndex,
        degreeInSign: position.degreeInSign,
        ruler: position.ruler
      })),
      houses,
      sect,
      aspectInfrastructure: aspects,
      planetaryConditions: conditions,
      lots
    },
    traditionalInterpretation: {
      status: "not_generated",
      reason: "No RuleVersion is active for interpretation."
    },
    uncertainty: {
      timePrecision: normalizedInput.timePrecision,
      calculationMode: normalizedInput.calculationMode,
      timeEvidence: timeEvidence(normalizedInput),
      coordinateConfidence: normalizedInput.coordinateConfidence,
      indeterminable: [
        ...(normalizedInput.calculationMode === "date_only_time_unknown" ? ["ascendant", "descendant", "midheaven", "imumCoeli", "houses", "sect"] : []),
        ...(normalizedInput.calculationMode === "time_interval" ? ["exact_angles", "exact_houses", "exact_sect"] : []),
        ...(normalizedInput.calculationMode === "approximate_time" ? ["exact_angles_without_uncertainty_margin", "exact_houses_without_uncertainty_margin"] : [])
      ],
      warnings
    }
  };
}

export function calculateWesternNatalChart(input, options = {}) {
  const normalizedInput = normalizeInput(input);
  const window = timeWindow(normalizedInput);
  const hasRepresentativeTime = Boolean(window.representativeUtcInstant);
  const positions = hasRepresentativeTime
    ? calculateTimedPositions(julianDay(window.representativeUtcInstant), normalizedInput.calculationMode)
    : calculateWindowPositions(julianDay(window.startUtcInstant), julianDay(window.endUtcInstant), normalizedInput.calculationMode);
  const angles = hasRepresentativeTime
    ? markApproximateAngleUncertainty(
        calculateAngles({
          jd: julianDay(window.representativeUtcInstant),
          latitude: normalizedInput.latitude,
          longitude: normalizedInput.longitude
        }),
        normalizedInput
      )
    : notCalculatedAngles(normalizedInput.calculationMode === "time_interval" ? "not_calculated_time_interval" : "not_calculated_time_unknown");
  const houses = hasRepresentativeTime
    ? calculateWholeSignHouses(angles.ascendant, normalizedInput)
    : notCalculatedHouses(normalizedInput.calculationMode === "time_interval" ? "not_calculated_time_interval" : "not_calculated_time_unknown");
  const sun = positions.find((position) => position.body === "Sun");
  const sect = hasRepresentativeTime
    ? calculateSect(sun.longitude, julianDay(window.representativeUtcInstant), normalizedInput.latitude, normalizedInput.longitude)
    : notCalculatedSect(normalizedInput.calculationMode === "time_interval" ? "not_calculated_time_interval" : "not_calculated_time_unknown");
  const aspects = hasRepresentativeTime ? calculateAspectInfrastructure(positions) : [];
  const conditions = inactiveConditions(positions);
  const lots = inactiveLots();
  const intervalAnalysis =
    normalizedInput.calculationMode === "time_interval"
      ? uncertainIntervalAnalysis({
          birthDate: normalizedInput.birthDate,
          timeZone: normalizedInput.timeZone,
          latitude: normalizedInput.latitude,
          longitude: normalizedInput.longitude,
          timeStart: normalizedInput.timeStart,
          timeEnd: normalizedInput.timeEnd
        })
      : null;
  const intervalStabilityNote = intervalAnalysis
    ? `Interval sign-boundary resolution: ${intervalAnalysis.summary.stableTargets.length} stable target(s), ${intervalAnalysis.summary.sensitiveTargets.length} sensitive target(s).`
    : "";
  const warnings = [
    "Astronomical engine is astronomy-engine@2.1.19 validated against stored JPL Horizons reference fixtures for the current V1 test set.",
    "No interpretive RuleVersion is active.",
    "Aspect orbs, dignities, lots and condition rules are represented as inactive structures.",
    ...(normalizedInput.timePrecision === "unknown" ? ["Birth time is unknown; angles, houses and sect are not calculated."] : []),
    ...(normalizedInput.timePrecision === "approximate" ? ["Birth time is approximate; calculated timed values must not be treated as exact."] : []),
    ...(normalizedInput.timePrecision === "interval" ? ["Birth time is an interval; stable-vs-variable analysis is represented but not collapsed to an exact chart.", intervalStabilityNote] : [])
  ];
  const payload = buildDeterministicPayload(normalizedInput, window, positions, angles, houses, sect, aspects, conditions, lots, warnings);
  if (intervalAnalysis) {
    payload.uncertainty.intervalAnalysis = intervalAnalysis;
  }
  payload.analysisPrototype = analyzeWesternNatalPrototype(payload);
  const inputDataHash = hashPayload(normalizedInput);
  const resultHash = hashPayload(payload);
  const calculatedAt = options.calculatedAt ?? new Date().toISOString();

  return {
    calculationRun: {
      id: options.runId ?? `calc_${resultHash.slice(0, 16)}`,
      personId: normalizedInput.personId,
      methodId: "western-natal",
      methodVersion: WESTERN_NATAL_METHOD_VERSION,
      status: "succeeded_development",
      calculatedAt,
      inputDataHash,
      resultHash,
      engine: {
        name: "astronomy-engine",
        version: ASTRONOMY_ENGINE_VERSION,
        internetUsedAtRuntime: false
      }
    },
    calculationArtifacts: [
      {
        id: options.normalizedInputArtifactId ?? `artifact_input_${inputDataHash.slice(0, 16)}`,
        type: "normalized_input",
        format: "application/json",
        hash: inputDataHash,
        payload: normalizedInput
      },
      {
        id: options.resultArtifactId ?? `artifact_result_${resultHash.slice(0, 16)}`,
        type: "structured_result",
        format: "application/json",
        hash: resultHash,
        payload
      }
    ],
    result: payload
  };
}
