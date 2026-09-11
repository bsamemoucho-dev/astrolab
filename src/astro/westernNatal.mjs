import { createHash } from "node:crypto";

import { analyzeWesternNatalPrototype } from "../analysis/westernNatalPrototype.mjs";
import { calculateAngles, altitude, zodiacPlacement } from "./angles.mjs";
import {
  ASTRONOMY_ENGINE_VERSION,
  ASTROLAB_MODEL_VERSION,
  SEVEN_TRADITIONAL_BODIES,
  SIGN_NAMES,
  TRADITIONAL_RULERS,
  UNCERTAINTY_MARGIN_DEFAULT_MINUTES,
  UNCERTAINTY_MARGIN_MAX_MINUTES,
  LASTRO_TIME_MARGIN_RULE_VERSION,
  WESTERN_NATAL_METHOD_VERSION
} from "./constants.mjs";
import { calculateBodyPositions } from "./ephemeris.mjs";
import { evaluateLastroAspects } from "./rules/lastroAspects.mjs";
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

// Marge autour de l'heure approximative. Deux sources possibles, toujours
// distinguées dans le résultat :
//   - "supplied"  : le client a choisi la marge (15/30/60 min) ;
//   - "default"   : il n'a rien précisé, la convention Lastro applique ±30 min.
// Une marge n'est jamais inventée pour une heure exacte, et une valeur absurde
// est refusée plutôt que silencieusement corrigée.
function normalizeTimeMargin(input, timePrecision) {
  if (timePrecision !== "approximate") {
    return { timeMarginMinutes: null, timeMarginSource: null };
  }
  const raw = input.timeMarginMinutes ?? input.uncertaintyMarginMinutes ?? null;
  const text = raw === null || raw === undefined ? "" : String(raw).trim();
  if (!text) {
    return { timeMarginMinutes: UNCERTAINTY_MARGIN_DEFAULT_MINUTES, timeMarginSource: "default" };
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > UNCERTAINTY_MARGIN_MAX_MINUTES) {
    const error = new Error(
      `Invalid time margin: expected a whole number of minutes between 1 and ${UNCERTAINTY_MARGIN_MAX_MINUTES}`
    );
    error.status = 400;
    throw error;
  }
  return { timeMarginMinutes: value, timeMarginSource: "supplied" };
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
      ...normalizeTimeMargin(input, timePrecision),
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
      timeMarginMinutes: null,
      timeMarginSource: null,
      calculationMode: "time_interval"
    };
  }
  if (timePrecision === "unknown") {
    return {
      timePrecision,
      timeValue: null,
      timeStart: null,
      timeEnd: null,
      timeMarginMinutes: null,
      timeMarginSource: null,
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

function anglesAt(normalizedInput, instant) {
  return calculateAngles({
    jd: julianDay(instant),
    latitude: normalizedInput.latitude,
    longitude: normalizedInput.longitude
  });
}

function describeAngleWindow(angleAtStart, angleAtEnd) {
  if (!angleAtStart || !angleAtEnd) {
    return null;
  }
  const signStable = angleAtStart.sign === angleAtEnd.sign;
  return {
    longitudeAtWindowStart: angleAtStart.longitude,
    longitudeAtWindowEnd: angleAtEnd.longitude,
    degreeAtWindowStart: angleAtStart.degreeInSign,
    degreeAtWindowEnd: angleAtEnd.degreeInSign,
    signAtWindowStart: angleAtStart.sign,
    signAtWindowEnd: angleAtEnd.sign,
    signStable,
    signsInWindow: signStable ? [angleAtStart.sign] : [angleAtStart.sign, angleAtEnd.sign]
  };
}

// Une heure approximative n'a plus de valeur unique : l'angle est calculé aux
// deux bornes de la marge déclarée. Si le signe franchit une frontière dans
// cette fenêtre, il n'est PAS décidable et le document doit le dire au lieu
// d'annoncer un Ascendant.
function markApproximateAngleUncertainty(angles, normalizedInput, window) {
  if (normalizedInput.timePrecision !== "approximate") {
    return angles;
  }
  const marginMinutes = normalizedInput.timeMarginMinutes;
  const start = anglesAt(normalizedInput, window.startUtcInstant);
  const end = anglesAt(normalizedInput, window.endUtcInstant);
  return {
    ...angles,
    uncertaintyStatus: "depends_on_approximate_birth_time_within_declared_margin",
    referenceTimeUsed: normalizedInput.timeValue,
    uncertaintyMargin: {
      marginMinutes,
      marginSource: normalizedInput.timeMarginSource
    },
    uncertaintyWindow: {
      marginMinutes,
      marginSource: normalizedInput.timeMarginSource,
      ascendant: describeAngleWindow(start.ascendant, end.ascendant),
      midheaven: describeAngleWindow(start.midheaven, end.midheaven)
    },
    warning: `Angles were calculated from the reference time within the declared ±${marginMinutes} min window; anything outside that window is not covered.`
  };
}

function calculateWholeSignHouses(ascendant, normalizedInput, angles) {
  const marginMinutes = normalizedInput.timePrecision === "approximate" ? normalizedInput.timeMarginMinutes : null;
  const ascendantWindow = angles?.uncertaintyWindow?.ascendant ?? null;
  // Maisons Whole Sign : elles suivent le signe de l'Ascendant. Si ce signe
  // n'est pas décidable dans la marge, les maisons ne le sont pas non plus.
  const signStable = marginMinutes ? Boolean(ascendantWindow?.signStable) : true;
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
      uncertaintyStatus: marginMinutes
        ? "depends_on_approximate_birth_time_within_declared_margin"
        : "time_exact_or_not_time_dependent",
      referenceTimeUsed: marginMinutes ? normalizedInput.timeValue : null,
      ...(marginMinutes ? { marginMinutes, decidableWithinMargin: signStable } : {})
    };
  });
}

function calculateSect(sunLongitude, jd, latitude, longitude, normalizedInput, window) {
  const sunAltitude = altitude(sunLongitude, jd, latitude, longitude);
  const chartSect = sunAltitude > 0 ? "diurnal" : "nocturnal";
  const base = {
    sunAltitude: round(sunAltitude, 6),
    classificationStatus: INACTIVE_RULE_STATUS,
    ruleVersionId: null,
    mercurySectStatus: "not_resolved_variant_requires_methodological_decision"
  };
  if (normalizedInput.timePrecision !== "approximate") {
    return {
      chartSect,
      ...base,
      luminaryOfSect: chartSect === "diurnal" ? "sun" : "moon"
    };
  }
  // La secte dépend de la hauteur du Soleil : elle peut basculer dans la marge
  // (naissance proche du lever ou du coucher). Dans ce cas elle reste inconnue.
  const sectAt = (instant) => {
    const sun = calculateBodyPositions(["Sun"], julianDay(instant))[0];
    return altitude(sun.longitude, julianDay(instant), latitude, longitude) > 0 ? "diurnal" : "nocturnal";
  };
  const sectAtWindowStart = sectAt(window.startUtcInstant);
  const sectAtWindowEnd = sectAt(window.endUtcInstant);
  const stable = sectAtWindowStart === sectAtWindowEnd;
  return {
    chartSect: stable ? chartSect : "unknown",
    ...base,
    luminaryOfSect: stable ? (chartSect === "diurnal" ? "sun" : "moon") : null,
    classificationStatus: stable ? INACTIVE_RULE_STATUS : "sect_not_stable_within_declared_margin",
    marginWindow: {
      marginMinutes: normalizedInput.timeMarginMinutes,
      sectAtWindowStart,
      sectAtWindowEnd,
      stable
    }
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
        // Couche géométrique seule : c'est `structuralAstrology.aspects` qui
        // porte la décision (orbe retenu, version de convention).
        active: false,
        orbUsed: null,
        ruleVersionId: null,
        status: "aspect_geometry_only_orb_rule_not_applied_here"
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
  if (normalizedInput.calculationMode === "exact_time") {
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
      marginMinutes: null,
      timezoneOffsetMinutes: result.timezoneOffsetMinutes
    };
  }
  if (normalizedInput.calculationMode === "approximate_time") {
    const result = localDateTimeToUtc({
      date,
      time: parseTime(normalizedInput.timeValue),
      timeZone: normalizedInput.timeZone
    });
    // Bornes réelles de la fenêtre d'incertitude, exprimées en UTC.
    const marginMs = normalizedInput.timeMarginMinutes * 60 * 1000;
    return {
      mode: normalizedInput.calculationMode,
      representativeUtcInstant: result.utcInstant,
      startUtcInstant: new Date(result.utcInstant.getTime() - marginMs),
      endUtcInstant: new Date(result.utcInstant.getTime() + marginMs),
      marginMinutes: normalizedInput.timeMarginMinutes,
      marginSource: normalizedInput.timeMarginSource,
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

// Une heure approximative garde un instant de référence, mais chaque corps est
// aussi calculé aux deux bornes de la marge : une planète rapide (la Lune en
// particulier) peut changer de signe en trente minutes, et le document ne doit
// pas l'affirmer dans ce cas.
function decorateBodyMarginWindow(positions, normalizedInput, window) {
  if (normalizedInput.timePrecision !== "approximate") {
    return positions;
  }
  const marginMinutes = normalizedInput.timeMarginMinutes;
  const startPositions = calculateTimedPositions(julianDay(window.startUtcInstant), "margin_window_start");
  const endPositions = calculateTimedPositions(julianDay(window.endUtcInstant), "margin_window_end");
  return positions.map((position) => {
    const start = startPositions.find((entry) => entry.body === position.body);
    const end = endPositions.find((entry) => entry.body === position.body);
    if (!start || !end) {
      return position;
    }
    const signStable = start.sign === end.sign;
    return {
      ...position,
      marginWindow: {
        marginMinutes,
        marginSource: normalizedInput.timeMarginSource,
        signAtWindowStart: start.sign,
        signAtWindowEnd: end.sign,
        degreeAtWindowStart: start.degreeInSign,
        degreeAtWindowEnd: end.degreeInSign,
        longitudeAtWindowStart: start.longitude,
        longitudeAtWindowEnd: end.longitude,
        signsInWindow: signStable ? [start.sign] : [start.sign, end.sign],
        signStable
      }
    };
  });
}

function timeEvidence(normalizedInput, window) {
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
    const marginMinutes = normalizedInput.timeMarginMinutes;
    return {
      precision: "approximate",
      suppliedTime: normalizedInput.timeValue,
      referenceTimeUsedForTimedCalculations: normalizedInput.timeValue,
      uncertaintyWindow: {
        marginMinutes,
        marginSource: normalizedInput.timeMarginSource,
        startUtc: window.startUtcInstant.toISOString(),
        endUtc: window.endUtcInstant.toISOString()
      },
      status: "approximate_time_with_declared_margin",
      marginMinutes,
      marginSource: normalizedInput.timeMarginSource,
      sensitiveOutputs: ["ascendant", "descendant", "midheaven", "imumCoeli", "houses", "sect"],
      warning: `No exact time was supplied. Angles, houses and sect were calculated from the reference time inside a declared ±${marginMinutes} min window; they must not be presented as exact, and signs that change inside that window are not decidable.`
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

function buildDeterministicPayload(normalizedInput, window, positions, angles, houses, sect, aspects, aspectConvention, conditions, lots, margin, warnings) {
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
      ...(margin ? { marginMinutes: margin.marginMinutes, marginSource: margin.marginSource } : {}),
      timezoneOffsetMinutes: window.timezoneOffsetMinutes
    },
    parameters: {
      zodiac: "tropical",
      houseSystem: "whole_sign",
      astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
      ephemerisStatus: "astronomy_engine_2_1_19_validated_against_jpl_horizons_reference_fixtures",
      internetUsedAtRuntime: false,
      ruleVersionsCreated: [LASTRO_TIME_MARGIN_RULE_VERSION, aspectConvention.ruleVersionId],
      interpretiveRuleVersionsCreated: false
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
      ...(margin
        ? {
            houseUncertainty: {
              marginMinutes: margin.marginMinutes,
              marginSource: margin.marginSource,
              ascendantSignStableWithinMargin: margin.ascendantSignStable,
              housesDecidableWithinMargin: margin.ascendantSignStable
            }
          }
        : {}),
      aspectInfrastructure: aspects,
      aspects: aspectConvention,
      planetaryConditions: conditions,
      lots
    },
    traditionalInterpretation: {
      status: "not_generated",
      reason: "No interpretive RuleVersion is active.",
      // Une convention de STRUCTURE est active (orbes) : elle ne dit pas ce que
      // les aspects signifient, elle dit lesquels existent.
      structuralConventionsActive: [aspectConvention.ruleVersionId]
    },
    uncertainty: {
      timePrecision: normalizedInput.timePrecision,
      calculationMode: normalizedInput.calculationMode,
      timeEvidence: timeEvidence(normalizedInput, window),
      coordinateConfidence: normalizedInput.coordinateConfidence,
      ...(margin
        ? {
            margin: {
              marginMinutes: margin.marginMinutes,
              marginSource: margin.marginSource,
              ascendantSignStableWithinMargin: margin.ascendantSignStable,
              midheavenSignStableWithinMargin: margin.midheavenSignStable,
              sectStableWithinMargin: margin.sectStable,
              bodySignsStableWithinMargin: margin.unstableBodySigns.length === 0,
              bodySignsNotStableWithinMargin: margin.unstableBodySigns
            }
          }
        : {}),
      indeterminable: [
        ...(normalizedInput.calculationMode === "date_only_time_unknown" ? ["ascendant", "descendant", "midheaven", "imumCoeli", "houses", "sect"] : []),
        ...(normalizedInput.calculationMode === "time_interval" ? ["exact_angles", "exact_houses", "exact_sect"] : []),
        ...(normalizedInput.calculationMode === "approximate_time"
          ? [
              "exact_angle_longitudes_within_declared_margin",
              ...(margin?.ascendantSignStable ? [] : ["ascendant_sign_within_declared_margin", "houses_within_declared_margin"]),
              ...(margin?.midheavenSignStable ? [] : ["midheaven_sign_within_declared_margin"]),
              ...(margin?.sectStable ? [] : ["sect_within_declared_margin"]),
              ...(margin && margin.unstableBodySigns.length > 0 ? ["body_signs_within_declared_margin"] : [])
            ]
          : [])
      ],
      warnings
    }
  };
}

export function calculateWesternNatalChart(input, options = {}) {
  const normalizedInput = normalizeInput(input);
  const window = timeWindow(normalizedInput);
  const hasRepresentativeTime = Boolean(window.representativeUtcInstant);
  const representativePositions = hasRepresentativeTime
    ? calculateTimedPositions(julianDay(window.representativeUtcInstant), normalizedInput.calculationMode)
    : calculateWindowPositions(julianDay(window.startUtcInstant), julianDay(window.endUtcInstant), normalizedInput.calculationMode);
  const positions = decorateBodyMarginWindow(representativePositions, normalizedInput, window);
  const angles = hasRepresentativeTime
    ? markApproximateAngleUncertainty(
        anglesAt(normalizedInput, window.representativeUtcInstant),
        normalizedInput,
        window
      )
    : notCalculatedAngles(normalizedInput.calculationMode === "time_interval" ? "not_calculated_time_interval" : "not_calculated_time_unknown");
  const houses = hasRepresentativeTime
    ? calculateWholeSignHouses(angles.ascendant, normalizedInput, angles)
    : notCalculatedHouses(normalizedInput.calculationMode === "time_interval" ? "not_calculated_time_interval" : "not_calculated_time_unknown");
  const sun = positions.find((position) => position.body === "Sun");
  const sect = hasRepresentativeTime
    ? calculateSect(sun.longitude, julianDay(window.representativeUtcInstant), normalizedInput.latitude, normalizedInput.longitude, normalizedInput, window)
    : notCalculatedSect(normalizedInput.calculationMode === "time_interval" ? "not_calculated_time_interval" : "not_calculated_time_unknown");
  // Résumé de la marge : ce qui est décidable et ce qui ne l'est pas. Le socle,
  // l'annexe et le détecteur de langage s'appuient dessus ; rien d'autre.
  const margin =
    hasRepresentativeTime && normalizedInput.timePrecision === "approximate"
      ? {
          marginMinutes: normalizedInput.timeMarginMinutes,
          marginSource: normalizedInput.timeMarginSource,
          ascendantSignStable: Boolean(angles.uncertaintyWindow?.ascendant?.signStable),
          midheavenSignStable: Boolean(angles.uncertaintyWindow?.midheaven?.signStable),
          sectStable: Boolean(sect.marginWindow?.stable),
          unstableBodySigns: positions.filter((position) => position.marginWindow && !position.marginWindow.signStable).map((position) => position.body)
        }
      : null;
  // Sans instant représentatif (heure inconnue ou intervalle), les longitudes
  // ne sont pas calculées : la convention d'aspects ne s'applique à rien.
  const aspectConvention = evaluateLastroAspects(hasRepresentativeTime ? positions : [], {
    marginMinutes: normalizedInput.timeMarginMinutes
  });
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
    `Structural aspect orbs are active under the documented, versioned Lastro convention ${aspectConvention.ruleVersionId} (${aspectConvention.orbTable
      .map((entry) => `${entry.type} ${entry.orbDegrees}°/${entry.orbDegreesWithLuminary}°`)
      .join(", ")}).`,
    "Dignities, lots and planetary condition rules remain inactive structures.",
    ...(normalizedInput.timePrecision === "unknown" ? ["Birth time is unknown; angles, houses and sect are not calculated."] : []),
    ...(normalizedInput.timePrecision === "approximate"
      ? [
          `Birth time is approximate: a ±${normalizedInput.timeMarginMinutes} min margin (${normalizedInput.timeMarginSource === "default" ? "Lastro default, not supplied by the client" : "supplied by the client"}) bounds the angle, house and sect calculations.`,
          "Timed values must never be presented as exact: a sign that changes inside the declared margin is not decidable."
        ]
      : []),
    ...(normalizedInput.timePrecision === "interval" ? ["Birth time is an interval; stable-vs-variable analysis is represented but not collapsed to an exact chart.", intervalStabilityNote] : [])
  ];
  const payload = buildDeterministicPayload(normalizedInput, window, positions, angles, houses, sect, aspects, aspectConvention, conditions, lots, margin, warnings);
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
