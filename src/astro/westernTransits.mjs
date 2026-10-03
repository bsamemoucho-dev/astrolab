import * as Astronomy from "astronomy-engine";

import { ASTRONOMY_ENGINE_VERSION } from "./constants.mjs";
import { calculateBodyPositions } from "./ephemeris.mjs";
import { normalizeSignedDegrees, round } from "./math.mjs";
import { julianDay, timezoneDatabaseVersion } from "./time.mjs";
import { zodiacPlacement } from "./westernNatal.mjs";

export const WESTERN_TRANSITS_ORB_RULE_VERSION = "western-transits-orbs@1.0.0-draft";
export const WESTERN_TRANSITS_RANKING_RULE_VERSION = "western-transits-ranking@1.0.0-draft";
export const WESTERN_TRANSITS_CALCULATION_VERSION = "western-transits-calculation@1.0.0-draft";
export const TRANSIT_CONTACT_ENGINE_VERSION = "transit-contact-engine@0.1.0-draft";

export const TRANSIT_CONTACT_PHASES = Object.freeze(["APPLYING", "SEPARATING", "STATIONARY", "INDETERMINATE"]);

const BODY_MAP = Object.freeze({
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto
});

export const CELESTIAL_EVENT_BODIES = Object.freeze(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);
export const PLANETARY_EVENT_BODIES = Object.freeze(["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);
export const MAJOR_ASPECT_BODIES = Object.freeze(["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);

const ASPECTS = Object.freeze({
  conjunction: Object.freeze({ exactAngle: 0, group: "conjunction_opposition" }),
  opposition: Object.freeze({ exactAngle: 180, group: "conjunction_opposition" }),
  square: Object.freeze({ exactAngle: 90, group: "square_trine" }),
  trine: Object.freeze({ exactAngle: 120, group: "square_trine" }),
  sextile: Object.freeze({ exactAngle: 60, group: "sextile" })
});

const ASPECT_ORDER = Object.freeze(["conjunction", "opposition", "trine", "square", "sextile"]);

const NATAL_POINT_ORBS = Object.freeze({
  luminary: Object.freeze({ conjunction_opposition: 2.0, square_trine: 1.5, sextile: 1.0 }),
  personal_planet: Object.freeze({ conjunction_opposition: 1.5, square_trine: 1.2, sextile: 0.8 }),
  social_slow_planet: Object.freeze({ conjunction_opposition: 1.2, square_trine: 1.0, sextile: 0.6 }),
  angle: Object.freeze({ conjunction_opposition: 1.5, square_trine: 1.2, sextile: 0.8 })
});

const TRANSIT_BODY_CAPS = Object.freeze({
  Sun: 1.5,
  Moon: 1.5,
  Mercury: 1.2,
  Venus: 1.2,
  Mars: 1.2,
  Jupiter: 1.0,
  Saturn: 1.0,
  Uranus: 1.0,
  Neptune: 1.0,
  Pluto: 1.0
});

function requireDate(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${field} must be a valid date`);
    error.status = 400;
    throw error;
  }
  return date;
}

function bodyEnum(body) {
  const mapped = BODY_MAP[body];
  if (!mapped) {
    const error = new Error(`Unsupported transit body: ${body}`);
    error.status = 400;
    throw error;
  }
  return mapped;
}

export function positionAt(body, date) {
  if (["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(body)) {
    return calculateBodyPositions([body], julianDay(date))[0];
  }
  const vector = Astronomy.GeoVector(bodyEnum(body), date, true);
  const position = Astronomy.Ecliptic(vector);
  const before = Astronomy.Ecliptic(Astronomy.GeoVector(bodyEnum(body), new Date(date.getTime() - 12 * 60 * 60 * 1000), true));
  const after = Astronomy.Ecliptic(Astronomy.GeoVector(bodyEnum(body), new Date(date.getTime() + 12 * 60 * 60 * 1000), true));
  const dailyMotion = normalizeSignedDegrees(after.elon - before.elon);
  return {
    body,
    longitude: round(position.elon),
    latitude: round(position.elat),
    distance: round(position.vec.Length()),
    apparentMotion: {
      dailyLongitudeDelta: round(dailyMotion),
      retrograde: dailyMotion < 0,
      status: "calculated_by_astronomy_engine"
    },
    coordinateSystem: "geocentric_apparent_true_ecliptic_of_date",
    engineVersion: ASTRONOMY_ENGINE_VERSION,
    ephemerisVersion: "astronomy-engine-built-in-ephemeris@2.1.19"
  };
}

export function angularSeparation(longitudeA, longitudeB) {
  return round(Math.abs(normalizeSignedDegrees(longitudeA - longitudeB)), 6);
}

export function effectiveOrbLimit({ natalPointKind, aspectType, transitBody }) {
  const aspect = ASPECTS[aspectType];
  const natalOrbs = NATAL_POINT_ORBS[natalPointKind];
  const transitCap = TRANSIT_BODY_CAPS[transitBody];
  if (!aspect || !natalOrbs || !Number.isFinite(transitCap)) {
    return null;
  }
  const orbPointNatal = natalOrbs[aspect.group];
  return {
    orbPointNatal,
    transitBodyCap: transitCap,
    effectiveOrbLimit: Math.min(orbPointNatal, transitCap),
    ruleVersion: WESTERN_TRANSITS_ORB_RULE_VERSION
  };
}

function bestAspect(distance) {
  let best = null;
  for (const type of ASPECT_ORDER) {
    const aspect = ASPECTS[type];
    const orb = round(Math.abs(distance - aspect.exactAngle), 6);
    if (!best || orb < best.orb) {
      best = { aspectType: type, exactAngle: aspect.exactAngle, orb };
    }
  }
  return best;
}

export function aspectOrbAt({ transitBody, natalLongitude, exactAngle, date }) {
  const position = positionAt(transitBody, date);
  const distance = angularSeparation(position.longitude, natalLongitude);
  return round(Math.abs(distance - exactAngle), 6);
}

function transitContactPhase({ celestialEvent, transitBody, natalPoint, candidate }) {
  if (celestialEvent.source?.engine === "fixture") {
    return "INDETERMINATE";
  }
  const instant = requireDate(celestialEvent.peakUtc ?? celestialEvent.startUtc, "celestialEvent.peakUtc");
  const before = new Date(instant.getTime() - 6 * 60 * 60 * 1000);
  const after = new Date(instant.getTime() + 6 * 60 * 60 * 1000);
  const beforeOrb = aspectOrbAt({ transitBody, natalLongitude: natalPoint.longitude, exactAngle: candidate.exactAngle, date: before });
  const afterOrb = aspectOrbAt({ transitBody, natalLongitude: natalPoint.longitude, exactAngle: candidate.exactAngle, date: after });
  const currentOrb = candidate.orb;
  const localMotion = Math.abs(dailyMotion(transitBody, instant));
  if (localMotion <= 0.002 && Math.abs(afterOrb - beforeOrb) <= 0.01) {
    return "STATIONARY";
  }
  if (currentOrb <= 0.0005 && beforeOrb > currentOrb && afterOrb > currentOrb) {
    return "INDETERMINATE";
  }
  if (afterOrb < currentOrb && beforeOrb >= currentOrb) {
    return "APPLYING";
  }
  if (afterOrb > currentOrb && beforeOrb <= currentOrb) {
    return "SEPARATING";
  }
  if (afterOrb < beforeOrb) {
    return "APPLYING";
  }
  if (afterOrb > beforeOrb) {
    return "SEPARATING";
  }
  return "INDETERMINATE";
}

function transitContactExactAt(celestialEvent, candidate) {
  if (candidate.orb <= 0.0005) {
    return celestialEvent.peakUtc ?? celestialEvent.startUtc ?? null;
  }
  return null;
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const BODY_LABELS_FR = Object.freeze({
  Sun: "Soleil",
  Moon: "Lune",
  Mercury: "Mercure",
  Venus: "Vénus",
  Mars: "Mars",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Uranus: "Uranus",
  Neptune: "Neptune",
  Pluto: "Pluton"
});

const EVENT_LABELS_FR = Object.freeze({
  new_moon: "Nouvelle Lune",
  full_moon: "Pleine Lune",
  solar_eclipse: "Éclipse solaire",
  lunar_eclipse: "Éclipse lunaire",
  retrograde_station: "station rétrograde",
  direct_station: "station directe",
  sign_ingress: "entrée en signe",
  planetary_aspect: "aspect planétaire"
});

const ASPECT_LABELS_FR = Object.freeze({
  conjunction: "conjonction",
  opposition: "opposition",
  square: "carré",
  trine: "trigone",
  sextile: "sextile"
});

const SIGN_LABELS_FR = Object.freeze({
  Aries: "Bélier",
  Taurus: "Taureau",
  Gemini: "Gémeaux",
  Cancer: "Cancer",
  Leo: "Lion",
  Virgo: "Vierge",
  Libra: "Balance",
  Scorpio: "Scorpion",
  Sagittarius: "Sagittaire",
  Capricorn: "Capricorne",
  Aquarius: "Verseau",
  Pisces: "Poissons"
});

export function localDisplayParts(instantUtc, timeZone = "Europe/Paris") {
  const date = requireDate(instantUtc, "instantUtc");
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    timeZone,
    localDate: `${values.year}-${values.month}-${values.day}`,
    localTime: `${values.hour}:${values.minute}`,
    label: `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`
  };
}

export function decorateEventForEdition(event, timeZone = "Europe/Paris") {
  const display = localDisplayParts(event.peakUtc ?? event.startUtc, timeZone);
  const title = event.titleFr ?? event.title;
  return {
    ...event,
    displayTimezone: timeZone,
    localDate: display.localDate,
    localTime: display.localTime,
    localLabel: display.label,
    editorialTitle: title,
    slug: event.slug ?? `${slugify(title)}-${display.localDate.slice(0, 7)}`
  };
}

function reliabilityFor({ retained, natalPointKind, houseReliability, timeMarginStability }) {
  if (!retained) {
    return "insufficient";
  }
  if (natalPointKind === "angle" && (houseReliability !== "stable" || timeMarginStability === "sensitive")) {
    return "insufficient";
  }
  if (timeMarginStability === "sensitive") {
    return "low";
  }
  if (houseReliability === "stable" || houseReliability === "not_time_dependent") {
    return "high";
  }
  return "medium";
}

export function createMoonPhaseEvent({ id, eventType, targetLongitude, startUtc, limitDays = 8, reference = null }) {
  const start = requireDate(startUtc, "startUtc");
  const time = Astronomy.SearchMoonPhase(targetLongitude, start, limitDays);
  if (!time) {
    const error = new Error("Moon phase not found in requested interval");
    error.status = 404;
    throw error;
  }
  const date = time.date;
  const sun = positionAt("Sun", date);
  const moon = positionAt("Moon", date);
  const primary = eventType === "new_moon" ? moon : moon;
  const placement = zodiacPlacement(primary.longitude);
  return {
    id,
    schema: "astrolab.western_transits.celestial_event",
    eventType,
    title: eventType === "new_moon" ? "New Moon" : "Full Moon",
    titleFr: eventType === "new_moon" ? "Nouvelle Lune" : "Pleine Lune",
    startUtc: date.toISOString(),
    peakUtc: date.toISOString(),
    bodies: ["Sun", "Moon"],
    primaryBody: "Moon",
    secondaryBody: "Sun",
    longitude: placement.longitude,
    zodiacSign: placement.sign,
    degreeInSign: placement.degreeInSign,
    aspectType: eventType === "full_moon" ? "opposition" : "conjunction",
    exactAngle: targetLongitude,
    bodyPositions: {
      Sun: { body: "Sun", longitude: sun.longitude, ...zodiacPlacement(sun.longitude) },
      Moon: { body: "Moon", longitude: moon.longitude, ...zodiacPlacement(moon.longitude) }
    },
    eventCluster: {
      id: `${id}.lunation`,
      anchor: "moon",
      mirrorDeduplication: true
    },
    source: {
      type: "calculated",
      engine: "astronomy-engine",
      engineVersion: ASTRONOMY_ENGINE_VERSION,
      functionNames: ["SearchMoonPhase"],
      referenceDatasetIds: reference ? [reference] : []
    },
    calculationVersion: WESTERN_TRANSITS_CALCULATION_VERSION,
    methodVersion: WESTERN_TRANSITS_CALCULATION_VERSION,
    astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
    timezoneDatabaseVersion: timezoneDatabaseVersion(),
    ruleVersion: null,
    editorialStatus: "not_reviewed",
    calculatedAt: new Date(0).toISOString(),
    createdAt: new Date(0).toISOString()
  };
}

export function createSyntheticEvent({ id, eventType = "planetary_aspect", startUtc, bodies, bodyPositions, eventCluster = null }) {
  const date = requireDate(startUtc, "startUtc");
  return {
    id,
    schema: "astrolab.western_transits.celestial_event",
    eventType,
    title: id,
    titleFr: id,
    startUtc: date.toISOString(),
    peakUtc: date.toISOString(),
    bodies,
    primaryBody: bodies[0],
    bodyPositions,
    eventCluster,
    source: {
      type: "calculated",
      engine: "fixture",
      engineVersion: "fixture",
      functionNames: ["fixture"]
    },
    calculationVersion: WESTERN_TRANSITS_CALCULATION_VERSION,
    methodVersion: WESTERN_TRANSITS_CALCULATION_VERSION,
    astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
    timezoneDatabaseVersion: timezoneDatabaseVersion(),
    ruleVersion: null,
    editorialStatus: "not_reviewed",
    calculatedAt: new Date(0).toISOString(),
    createdAt: new Date(0).toISOString()
  };
}

export function calculateTransitContacts(celestialEvent, natalPoints = []) {
  const contacts = [];
  const bodyPositions = celestialEvent.bodyPositions ?? {};
  for (const [transitBody, transitPosition] of Object.entries(bodyPositions)) {
    for (const natalPoint of natalPoints) {
      if (natalPoint.kind === "angle" && natalPoint.houseReliability === "unknown_time") {
        continue;
      }
      const distance = angularSeparation(transitPosition.longitude, natalPoint.longitude);
      const candidate = bestAspect(distance);
      const orbLimit = effectiveOrbLimit({
        natalPointKind: natalPoint.kind,
        aspectType: candidate.aspectType,
        transitBody
      });
      if (!orbLimit) {
        continue;
      }
      const retained = candidate.orb <= orbLimit.effectiveOrbLimit;
      const timeMarginStability = natalPoint.timeMarginStability ?? "not_applicable";
      const houseReliability =
        natalPoint.houseReliability ?? (natalPoint.kind === "angle" ? "stable" : "not_time_dependent");
      contacts.push({
        id: `contact.${celestialEvent.id}.${transitBody}.${natalPoint.point}`,
        schema: "astrolab.western_transits.transit_contact",
        celestialEventId: celestialEvent.id,
        personId: natalPoint.personId,
        transitBody,
        natalPoint: natalPoint.point,
        natalPointKind: natalPoint.kind,
        aspectType: retained ? candidate.aspectType : null,
        candidateAspectType: candidate.aspectType,
        exactAngle: candidate.exactAngle,
        angularDistance: distance,
        orb: candidate.orb,
        orbPointNatal: orbLimit.orbPointNatal,
        transitBodyCap: orbLimit.transitBodyCap,
        effectiveOrbLimit: orbLimit.effectiveOrbLimit,
        retained,
        discardedReason: retained ? null : "outside_effective_orb",
        phase: retained ? transitContactPhase({ celestialEvent, transitBody, natalPoint, candidate }) : "INDETERMINATE",
        exactAt: retained ? transitContactExactAt(celestialEvent, candidate) : null,
        retrogradeCycle: natalPoint.retrogradeCycle ?? null,
        eventClusterId: celestialEvent.eventCluster?.id ?? null,
        mirrorOfContactId: null,
        rankingDeduplicatedBy: null,
        natalHouse: natalPoint.natalHouse ?? null,
        houseReliability,
        timeMarginStability,
        reliability: reliabilityFor({ retained, natalPointKind: natalPoint.kind, houseReliability, timeMarginStability }),
        ruleVersion: WESTERN_TRANSITS_ORB_RULE_VERSION,
        methodVersion: TRANSIT_CONTACT_ENGINE_VERSION,
        astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
        calculatedAt: celestialEvent.calculatedAt ?? new Date(0).toISOString()
      });
    }
  }
  return contacts.sort((a, b) => a.orb - b.orb);
}

function deduplicatedRelevanceContacts(rawContacts) {
  const retained = rawContacts.filter((contact) => contact.retained);
  const selected = [];
  const seen = new Map();
  for (const contact of retained) {
    const clusterKey = contact.eventClusterId
      ? `${contact.eventClusterId}:${contact.personId}:${contact.natalPoint}`
      : contact.id;
    const existing = seen.get(clusterKey);
    if (!existing || contact.orb < existing.orb) {
      if (existing) {
        existing.rankingDeduplicatedBy = "lunation_mirror";
        existing.mirrorOfContactId = contact.id;
      }
      seen.set(clusterKey, contact);
    } else {
      contact.rankingDeduplicatedBy = "lunation_mirror";
      contact.mirrorOfContactId = existing.id;
    }
  }
  for (const contact of seen.values()) {
    selected.push(contact);
  }
  return selected.sort((a, b) => a.orb - b.orb);
}

export function buildPersonTransitResult({ personId, celestialEvent, rawContacts, context = "individual" }) {
  const personContacts = rawContacts.filter((contact) => contact.personId === personId);
  const relevanceContacts = deduplicatedRelevanceContacts(personContacts);
  const strong = relevanceContacts.some(
    (contact) => contact.reliability !== "insufficient" && contact.orb <= contact.effectiveOrbLimit * 0.5
  );
  const observable = relevanceContacts.some((contact) => contact.reliability !== "insufficient");
  const ordinaryMoonOnly =
    celestialEvent.eventType === "planetary_aspect" &&
    relevanceContacts.length > 0 &&
    relevanceContacts.every((contact) => contact.transitBody === "Moon");
  const classification = ordinaryMoonOnly && observable ? "observe" : strong ? "very_personal" : observable ? "observe" : "general_context";
  return {
    id: `ptr.${celestialEvent.id}.${personId}.${context}`,
    schema: "astrolab.western_transits.person_transit_result",
    personId,
    celestialEventId: celestialEvent.id,
    context,
    rawContacts: personContacts,
    eventRelevance: {
      contacts: relevanceContacts,
      deduplicatedContactIds: personContacts.filter((contact) => contact.rankingDeduplicatedBy).map((contact) => contact.id)
    },
    classification,
    classificationFactors: {
      closestOrb: relevanceContacts[0]?.orb ?? null,
      natalPointsTouched: [...new Set(relevanceContacts.map((contact) => contact.natalPoint))],
      aspectTypes: [...new Set(relevanceContacts.map((contact) => contact.aspectType).filter(Boolean))],
      timeReliability: relevanceContacts.some((contact) => contact.timeMarginStability === "sensitive") ? "sensitive" : "stable_or_not_applicable",
      houseReliability: relevanceContacts.some((contact) => contact.houseReliability === "unstable_time_margin") ? "sensitive" : "stable_or_not_applicable",
      repeatedByRetrogradeCycle: relevanceContacts.some((contact) => contact.retrogradeCycle),
      deduplicatedContactIds: personContacts.filter((contact) => contact.rankingDeduplicatedBy).map((contact) => contact.id)
    },
    ruleVersion: WESTERN_TRANSITS_RANKING_RULE_VERSION,
    methodVersion: TRANSIT_CONTACT_ENGINE_VERSION,
    astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
    calculatedAt: celestialEvent.calculatedAt ?? new Date(0).toISOString()
  };
}

export function buildRelationshipTransitContext({ relationshipId, personAResult, personBResult }) {
  const significantA = personAResult.classification !== "general_context";
  const significantB = personBResult.classification !== "general_context";
  return {
    relationshipId,
    personResults: [personAResult, personBResult],
    relationshipTransitActivation: null,
    summary:
      significantA && !significantB
        ? "person_a_individually_concerned"
        : !significantA && significantB
          ? "person_b_individually_concerned"
          : significantA && significantB
            ? "both_people_individually_concerned_no_synastry_activation"
            : "no_significant_person_contact"
  };
}

function dailyMotion(body, date) {
  const before = positionAt(body, new Date(date.getTime() - 12 * 60 * 60 * 1000));
  const after = positionAt(body, new Date(date.getTime() + 12 * 60 * 60 * 1000));
  return normalizeSignedDegrees(after.longitude - before.longitude);
}

function bisectSignChange(fn, startDate, endDate, iterations = 50) {
  let start = startDate.getTime();
  let end = endDate.getTime();
  let startValue = fn(new Date(start));
  for (let i = 0; i < iterations; i += 1) {
    const mid = Math.round((start + end) / 2);
    const midValue = fn(new Date(mid));
    if (Math.sign(startValue) === Math.sign(midValue)) {
      start = mid;
      startValue = midValue;
    } else {
      end = mid;
    }
  }
  return new Date(Math.round((start + end) / 2));
}

export function findMotionStations({ body, startUtc, endUtc }) {
  const start = requireDate(startUtc, "startUtc");
  const end = requireDate(endUtc, "endUtc");
  const stations = [];
  let cursor = start;
  let previousMotion = dailyMotion(body, cursor);
  while (cursor < end) {
    const next = new Date(Math.min(cursor.getTime() + 24 * 60 * 60 * 1000, end.getTime()));
    const nextMotion = dailyMotion(body, next);
    if (Math.sign(previousMotion) !== 0 && Math.sign(nextMotion) !== 0 && Math.sign(previousMotion) !== Math.sign(nextMotion)) {
      const exact = bisectSignChange((date) => dailyMotion(body, date), cursor, next);
      const before = dailyMotion(body, new Date(exact.getTime() - 60 * 60 * 1000));
      const after = dailyMotion(body, new Date(exact.getTime() + 60 * 60 * 1000));
      const motionState = before > 0 && after < 0 ? "retrograde_station" : "direct_station";
      const position = positionAt(body, exact);
      stations.push({
        id: `station.${body}.${exact.toISOString()}`,
        schema: "astrolab.western_transits.celestial_event",
        eventType: motionState,
        title: `${body} ${motionState}`,
        titleFr: `${BODY_LABELS_FR[body]} ${EVENT_LABELS_FR[motionState]}`,
        startUtc: exact.toISOString(),
        peakUtc: exact.toISOString(),
        bodies: [body],
        primaryBody: body,
        longitude: position.longitude,
        ...zodiacPlacement(position.longitude),
        bodyPositions: {
          [body]: { body, longitude: position.longitude, ...zodiacPlacement(position.longitude) }
        },
        motionState,
        precision: {
          method: "daily_motion_sign_change_bisection",
          iterations: 50,
          editorialDisplay: "minute"
        },
        source: {
          type: "calculated",
          engine: "astronomy-engine",
          engineVersion: ASTRONOMY_ENGINE_VERSION,
          functionNames: ["GeoVector", "Ecliptic", "bisection_daily_motion"]
        },
        calculationVersion: WESTERN_TRANSITS_CALCULATION_VERSION,
        methodVersion: WESTERN_TRANSITS_CALCULATION_VERSION,
        astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
        timezoneDatabaseVersion: timezoneDatabaseVersion(),
        ruleVersion: null,
        editorialStatus: "not_reviewed",
        calculatedAt: new Date(0).toISOString(),
        createdAt: new Date(0).toISOString()
      });
    }
    cursor = next;
    previousMotion = nextMotion;
  }
  return stations;
}

function makeEventId(parts) {
  return parts.map((part) => slugify(part)).filter(Boolean).join(".");
}

function eventBase({ id, eventType, title, titleFr, date, bodies, primaryBody, secondaryBody = null, longitude = null, aspectType = null, exactAngle = null, sourceFunctions = [], eventCluster = null }) {
  const placement = Number.isFinite(longitude) ? zodiacPlacement(longitude) : {};
  return {
    id,
    schema: "astrolab.western_transits.celestial_event",
    eventType,
    title,
    titleFr,
    startUtc: date.toISOString(),
    peakUtc: date.toISOString(),
    bodies,
    primaryBody,
    secondaryBody,
    ...(Number.isFinite(longitude) ? { longitude: placement.longitude, zodiacSign: placement.sign, degreeInSign: placement.degreeInSign } : {}),
    ...(aspectType ? { aspectType } : {}),
    ...(Number.isFinite(exactAngle) ? { exactAngle } : {}),
    ...(eventCluster ? { eventCluster } : {}),
    source: {
      type: "calculated",
      engine: "astronomy-engine",
      engineVersion: ASTRONOMY_ENGINE_VERSION,
      functionNames: sourceFunctions
    },
    calculationVersion: WESTERN_TRANSITS_CALCULATION_VERSION,
    methodVersion: WESTERN_TRANSITS_CALCULATION_VERSION,
    astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
    timezoneDatabaseVersion: timezoneDatabaseVersion(),
    ruleVersion: null,
    editorialStatus: "not_reviewed",
    calculatedAt: new Date(0).toISOString(),
    createdAt: new Date(0).toISOString()
  };
}

function signIndexAt(body, date) {
  return Math.floor(positionAt(body, date).longitude / 30);
}

export function findSignIngresses({ body, startUtc, endUtc }) {
  const start = requireDate(startUtc, "startUtc");
  const end = requireDate(endUtc, "endUtc");
  const ingresses = [];
  let cursor = start;
  let previousSign = signIndexAt(body, cursor);
  while (cursor < end) {
    const next = new Date(Math.min(cursor.getTime() + 24 * 60 * 60 * 1000, end.getTime()));
    const nextSign = signIndexAt(body, next);
    if (previousSign !== nextSign) {
      const exact = bisectSignChange((date) => {
        const longitude = positionAt(body, date).longitude;
        const boundary = nextSign * 30;
        return normalizeSignedDegrees(longitude - boundary);
      }, cursor, next);
      const position = positionAt(body, exact);
      const placement = zodiacPlacement(position.longitude);
      ingresses.push(eventBase({
        id: makeEventId(["ingress", body, placement.sign, exact.toISOString()]),
        eventType: "sign_ingress",
        title: `${body} enters ${placement.sign}`,
        titleFr: `${BODY_LABELS_FR[body]} entre en ${SIGN_LABELS_FR[placement.sign] ?? placement.sign}`,
        date: exact,
        bodies: [body],
        primaryBody: body,
        longitude: position.longitude,
        sourceFunctions: ["GeoVector", "Ecliptic", "sign_boundary_bisection"]
      }));
    }
    cursor = next;
    previousSign = nextSign;
  }
  return ingresses;
}

function pairDistance(bodyA, bodyB, date) {
  return angularSeparation(positionAt(bodyA, date).longitude, positionAt(bodyB, date).longitude);
}

export function findPlanetaryAspects({ bodyA, bodyB, startUtc, endUtc, aspectTypes = ["conjunction", "opposition", "square", "trine", "sextile"] }) {
  const start = requireDate(startUtc, "startUtc");
  const end = requireDate(endUtc, "endUtc");
  const events = [];
  for (const aspectType of aspectTypes) {
    const exactAngle = ASPECTS[aspectType].exactAngle;
    let cursor = start;
    let prevGap = pairDistance(bodyA, bodyB, cursor) - exactAngle;
    while (cursor < end) {
      const next = new Date(Math.min(cursor.getTime() + 12 * 60 * 60 * 1000, end.getTime()));
      const nextGap = pairDistance(bodyA, bodyB, next) - exactAngle;
      if ((prevGap === 0 || nextGap === 0 || Math.sign(prevGap) !== Math.sign(nextGap)) && Math.abs(prevGap - nextGap) < 30) {
        const exact = bisectSignChange((date) => pairDistance(bodyA, bodyB, date) - exactAngle, cursor, next);
        const primary = positionAt(bodyA, exact);
        events.push(eventBase({
          id: makeEventId(["aspect", bodyA, bodyB, aspectType, exact.toISOString()]),
          eventType: "planetary_aspect",
          title: `${bodyA} ${aspectType} ${bodyB}`,
          titleFr: `${BODY_LABELS_FR[bodyA]} ${ASPECT_LABELS_FR[aspectType] ?? aspectType} ${BODY_LABELS_FR[bodyB]}`,
          date: exact,
          bodies: [bodyA, bodyB],
          primaryBody: bodyA,
          secondaryBody: bodyB,
          longitude: primary.longitude,
          aspectType,
          exactAngle,
          sourceFunctions: ["GeoVector", "Ecliptic", "aspect_bisection"]
        }));
      }
      cursor = next;
      prevGap = nextGap;
    }
  }
  return events;
}

export function findMoonPhasesInRange({ startUtc, endUtc }) {
  const start = requireDate(startUtc, "startUtc");
  const end = requireDate(endUtc, "endUtc");
  const phases = [];
  for (const [eventType, target] of [["new_moon", 0], ["full_moon", 180]]) {
    let cursor = start;
    while (cursor < end) {
      const event = createMoonPhaseEvent({
        id: makeEventId([eventType, cursor.toISOString()]),
        eventType,
        targetLongitude: target,
        startUtc: cursor.toISOString(),
        limitDays: 35
      });
      const peak = requireDate(event.peakUtc, "peakUtc");
      if (peak >= end) {
        break;
      }
      if (peak >= start && !phases.some((item) => item.eventType === event.eventType && item.peakUtc === event.peakUtc)) {
        phases.push(event);
      }
      cursor = new Date(peak.getTime() + 24 * 60 * 60 * 1000);
    }
  }
  return phases;
}

export function enumerateCelestialEvents({ startUtc, endUtc }) {
  const start = requireDate(startUtc, "startUtc");
  const end = requireDate(endUtc, "endUtc");
  const events = [...findMoonPhasesInRange({ startUtc, endUtc })];
  for (const body of PLANETARY_EVENT_BODIES) {
    events.push(...findMotionStations({ body, startUtc, endUtc }));
    events.push(...findSignIngresses({ body, startUtc, endUtc }));
  }
  for (let i = 0; i < MAJOR_ASPECT_BODIES.length; i += 1) {
    for (let j = i + 1; j < MAJOR_ASPECT_BODIES.length; j += 1) {
      events.push(...findPlanetaryAspects({ bodyA: MAJOR_ASPECT_BODIES[i], bodyB: MAJOR_ASPECT_BODIES[j], startUtc, endUtc }));
    }
  }
  return events
    .filter((event) => {
      const date = requireDate(event.peakUtc ?? event.startUtc, "eventDate");
      return date >= start && date < end;
    })
    .sort((a, b) => (a.peakUtc ?? a.startUtc).localeCompare(b.peakUtc ?? b.startUtc));
}

export function buildRetrogradeCycle({ body, targetLongitude, startUtc, endUtc, cycleId }) {
  const stations = findMotionStations({ body, startUtc, endUtc });
  const retrograde = stations.find((station) => station.eventType === "retrograde_station");
  const direct = stations.find((station) => station.eventType === "direct_station");
  const passes = findRetrogradeCyclePasses({ body, natalPoint: `${targetLongitude}`, targetLongitude, startUtc, endUtc, cycleId });
  return {
    cycleId,
    body,
    preShadowStartUtc: passes[0]?.exactUtc ?? null,
    retrogradeStationUtc: retrograde?.peakUtc ?? null,
    directStationUtc: direct?.peakUtc ?? null,
    postShadowEndUtc: passes.at(-1)?.exactUtc ?? null,
    longitudes: {
      target: targetLongitude,
      retrogradeStation: retrograde?.longitude ?? null,
      directStation: direct?.longitude ?? null
    },
    passes
  };
}

export function editorialPriorityFor(event) {
  if (["new_moon", "full_moon", "retrograde_station", "direct_station"].includes(event.eventType)) {
    return "A";
  }
  if (event.eventType === "sign_ingress" && ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"].includes(event.primaryBody)) {
    return "A";
  }
  if (event.eventType === "planetary_aspect" && event.bodies.some((body) => ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"].includes(body))) {
    return "B";
  }
  return "C";
}

export function createEditorialEvent(event, overrides = {}) {
  const priority = overrides.editorialPriority ?? editorialPriorityFor(event);
  return {
    celestialEventId: event.id,
    editorialStatus: overrides.editorialStatus ?? (priority === "A" ? "PLANNED" : "DETECTED"),
    editorialPriority: priority,
    slug: overrides.slug ?? decorateEventForEdition(event).slug,
    publishAt: overrides.publishAt ?? null,
    updatedAt: overrides.updatedAt ?? new Date(0).toISOString(),
    indexable: overrides.indexable ?? false
  };
}

export function eventTypeLabelFr(event) {
  if (event.eventType === "planetary_aspect") {
    return "Aspect planétaire";
  }
  if (event.eventType === "sign_ingress") {
    return "Changement de signe";
  }
  return EVENT_LABELS_FR[event.eventType] ?? event.eventType;
}

function longitudeDifference(body, targetLongitude, date) {
  return normalizeSignedDegrees(positionAt(body, date).longitude - targetLongitude);
}

export function findRetrogradeCyclePasses({ body, natalPoint, targetLongitude, startUtc, endUtc, cycleId }) {
  const start = requireDate(startUtc, "startUtc");
  const end = requireDate(endUtc, "endUtc");
  const passes = [];
  let cursor = start;
  let previousDiff = longitudeDifference(body, targetLongitude, cursor);
  while (cursor < end) {
    const next = new Date(Math.min(cursor.getTime() + 24 * 60 * 60 * 1000, end.getTime()));
    const nextDiff = longitudeDifference(body, targetLongitude, next);
    const crossed = previousDiff === 0 || nextDiff === 0 || Math.sign(previousDiff) !== Math.sign(nextDiff);
    if (crossed && Math.abs(previousDiff - nextDiff) < 30) {
      const exact = bisectSignChange((date) => longitudeDifference(body, targetLongitude, date), cursor, next);
      const motion = dailyMotion(body, exact);
      passes.push({
        cycleId,
        passNumber: passes.length + 1,
        totalPassesKnown: null,
        date: exact.toISOString(),
        motionState: motion < 0 ? "retrograde" : "direct",
        natalPoint,
        transitBody: body,
        orbMinimum: 0,
        exactUtc: exact.toISOString()
      });
    }
    cursor = next;
    previousDiff = nextDiff;
  }
  return passes.map((pass) => ({ ...pass, totalPassesKnown: passes.length }));
}
