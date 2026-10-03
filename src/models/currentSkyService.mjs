import { ASTRONOMY_ENGINE_VERSION } from "../astro/constants.mjs";
import { hashPayload } from "../astro/westernNatal.mjs";
import {
  aspectOrbAt,
  enumerateCelestialEvents,
  effectiveOrbLimit,
  positionAt,
  TRANSIT_CONTACT_ENGINE_VERSION,
  WESTERN_TRANSITS_ORB_RULE_VERSION,
  WESTERN_TRANSITS_RANKING_RULE_VERSION
} from "../astro/westernTransits.mjs";
import { normalizeSignedDegrees, round } from "../astro/math.mjs";
import { timezoneDatabaseVersion } from "../astro/time.mjs";

export const CURRENT_SKY_STATUS = Object.freeze(["CURRENT", "UPCOMING", "RECENT"]);
export const CURRENT_SKY_RELEVANCE = Object.freeze(["VERY_PERSONAL", "WATCH", "GENERAL_CONTEXT"]);
export const CURRENT_SKY_DEFAULT_HORIZON_DAYS = 42;
export const CURRENT_SKY_MAX_HORIZON_DAYS = 90;
const RECENT_DAYS = 3;
const EVENT_LOOKBACK_DAYS = 180;
const EVENT_LOOKAHEAD_PADDING_DAYS = 14;
const HOUSE_SYSTEM = "WHOLE_SIGN";
const PERSONAL_TRANSIT_BODIES = Object.freeze(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);
const PERSONAL_TRANSIT_ASPECTS = Object.freeze([
  { aspectType: "conjunction", exactAngle: 0 },
  { aspectType: "sextile", exactAngle: 60 },
  { aspectType: "square", exactAngle: 90 },
  { aspectType: "trine", exactAngle: 120 },
  { aspectType: "opposition", exactAngle: 180 }
]);
const UNKNOWN_TIME_MAX_LONGITUDE_SPAN = Object.freeze({
  Sun: 1.25,
  Moon: 1.0,
  Mercury: 2.5,
  Venus: 1.4,
  Mars: 0.9,
  Jupiter: 0.35,
  Saturn: 0.25
});

const NATAL_POINT_KIND_BY_BODY = Object.freeze({
  Sun: "luminary",
  Moon: "luminary",
  Mercury: "personal_planet",
  Venus: "personal_planet",
  Mars: "personal_planet",
  Jupiter: "social_slow_planet",
  Saturn: "social_slow_planet"
});

const PLANET_STEP_HOURS = Object.freeze({
  Moon: 1,
  Sun: 6,
  Mercury: 6,
  Venus: 6,
  Mars: 12,
  Jupiter: 24,
  Saturn: 24,
  Uranus: 24,
  Neptune: 24,
  Pluto: 24
});

const PLANET_MAX_WINDOW_DAYS = Object.freeze({
  Moon: 3,
  Sun: 21,
  Mercury: 45,
  Venus: 45,
  Mars: 90,
  Jupiter: 180,
  Saturn: 180,
  Uranus: 180,
  Neptune: 180,
  Pluto: 180
});
const CURRENT_SKY_CACHE_MAX_ENTRIES = 128;
const LONGITUDE_CACHE_MAX_ENTRIES = 20000;
const currentSkyResponseCache = new Map();
const sharedLongitudeCache = new Map();

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function rememberBounded(map, key, value, maxEntries) {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  if (map.size > maxEntries) {
    const oldestKey = map.keys().next().value;
    map.delete(oldestKey);
  }
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function requireDate(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${field} must be a valid date`);
    error.status = 400;
    throw error;
  }
  return date;
}

function horizonDays(value) {
  const parsed = Number(value ?? CURRENT_SKY_DEFAULT_HORIZON_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return CURRENT_SKY_DEFAULT_HORIZON_DAYS;
  }
  return Math.min(Math.round(parsed), CURRENT_SKY_MAX_HORIZON_DAYS);
}

function uppercaseReliability(value) {
  const normalized = String(value ?? "unknown").toLowerCase();
  if (normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  if (normalized === "low") return "LOW";
  if (normalized === "insufficient") return "INSUFFICIENT";
  return "UNKNOWN";
}

function relevanceEnum(classification) {
  if (classification === "very_personal") return "VERY_PERSONAL";
  if (classification === "observe") return "WATCH";
  return "GENERAL_CONTEXT";
}

export function classifyCurrentSkyStatus({ nowUtc, startsAt, endsAt, horizonDays: horizon = CURRENT_SKY_DEFAULT_HORIZON_DAYS, recentDays = RECENT_DAYS }) {
  const now = requireDate(nowUtc, "nowUtc");
  const start = requireDate(startsAt, "startsAt");
  const end = requireDate(endsAt, "endsAt");
  if (start <= now && now <= end) {
    return "CURRENT";
  }
  const horizonEnd = addDays(now, horizon);
  if (start > now && start <= horizonEnd) {
    return "UPCOMING";
  }
  const recentStart = addDays(now, -recentDays);
  if (end < now && end >= recentStart) {
    return "RECENT";
  }
  return null;
}

function latestNatalArtifact(state, userId, personId) {
  const runs = (state.calculationRuns ?? [])
    .filter((run) => run.ownerUserId === userId && run.methodId === "western-natal" && (!personId || run.personId === personId))
    .sort((a, b) => String(b.calculatedAt ?? "").localeCompare(String(a.calculatedAt ?? "")));
  for (const run of runs) {
    const artifact = (state.calculationArtifacts ?? []).find(
      (entry) =>
        entry.ownerUserId === userId &&
        entry.calculationRunId === run.id &&
        entry.type === "structured_result" &&
        entry.payload?.schema === "astrolab.western_natal.structured_result"
    );
    if (artifact) {
      return { run, artifact };
    }
  }
  return null;
}

function findPerson(state, userId, personId) {
  const person = personId
    ? state.persons.find((entry) => entry.ownerUserId === userId && entry.id === personId)
    : state.persons.find((entry) => entry.ownerUserId === userId && entry.isPrimary);
  if (!person) {
    const error = new Error("Person not found");
    error.status = 404;
    throw error;
  }
  return person;
}

function houseForLongitude(houses, longitude) {
  if (!Array.isArray(houses) || !Number.isFinite(longitude)) {
    return null;
  }
  const signIndex = Math.floor(longitude / 30);
  const house = houses.find((entry) => entry.signIndex === signIndex);
  return house?.houseNumber ?? null;
}

function longitudeSpan(range) {
  if (!range || !Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    return null;
  }
  return Math.abs((((range.end - range.start + 540) % 360) - 180));
}

function midpointLongitude(range) {
  const signedDelta = ((range.end - range.start + 540) % 360) - 180;
  return (range.start + signedDelta / 2 + 360) % 360;
}

function stableUnknownTimeBodyPoint(body) {
  const span = longitudeSpan(body.longitudeRange);
  const limit = UNKNOWN_TIME_MAX_LONGITUDE_SPAN[body.body];
  if (!Number.isFinite(span) || !Number.isFinite(limit) || span > limit) {
    return null;
  }
  return {
    longitude: round(midpointLongitude(body.longitudeRange), 6),
    longitudeUncertaintyDegrees: round(span / 2, 6)
  };
}

function houseReliabilityForNatal(natal) {
  const precision = natal.uncertainty?.timePrecision;
  if (precision === "unknown" || precision === "interval") {
    return "unknown_time";
  }
  const stable = natal.structuralAstrology?.houseUncertainty?.housesDecidableWithinMargin;
  if (precision === "approximate") {
    return stable ? "stable" : "unstable_time_margin";
  }
  return "stable";
}

function timeMarginStabilityForNatal(natal) {
  const precision = natal.uncertainty?.timePrecision;
  if (precision !== "approximate") {
    return "not_applicable";
  }
  return natal.structuralAstrology?.houseUncertainty?.housesDecidableWithinMargin ? "stable" : "sensitive";
}

function natalPointsFromChart(natal) {
  const personId = natal.normalizedInput?.personId;
  const houses = Array.isArray(natal.structuralAstrology?.houses) ? natal.structuralAstrology.houses : natal.structuralAstrology?.houses?.houses ?? [];
  const houseReliability = houseReliabilityForNatal(natal);
  const timeMarginStability = timeMarginStabilityForNatal(natal);
  const points = [];
  for (const body of natal.astronomicalCalculation?.bodies ?? []) {
    if (!NATAL_POINT_KIND_BY_BODY[body.body]) {
      continue;
    }
    const stableWindowPoint = !Number.isFinite(body.longitude) ? stableUnknownTimeBodyPoint(body) : null;
    const longitude = Number.isFinite(body.longitude) ? body.longitude : stableWindowPoint?.longitude;
    if (!Number.isFinite(longitude)) {
      continue;
    }
    const natalHouse = houseReliability === "stable" ? houseForLongitude(houses, longitude) : null;
    points.push({
      personId,
      point: body.body,
      kind: NATAL_POINT_KIND_BY_BODY[body.body],
      longitude,
      natalHouse,
      houseReliability: natalHouse ? houseReliability : "not_time_dependent",
      timeMarginStability: stableWindowPoint ? "stable_date_window" : timeMarginStability,
      longitudeUncertaintyDegrees: stableWindowPoint?.longitudeUncertaintyDegrees ?? null,
      dateWindowBased: Boolean(stableWindowPoint)
    });
  }
  const angles = natal.astronomicalCalculation?.angles ?? {};
  for (const key of ["ascendant", "descendant", "midheaven", "imumCoeli"]) {
    const angle = angles[key];
    if (!angle || !Number.isFinite(angle.longitude) || houseReliability !== "stable") {
      continue;
    }
    points.push({
      personId,
      point: key === "ascendant" ? "ASC" : key === "descendant" ? "DSC" : key === "midheaven" ? "MC" : "IC",
      kind: "angle",
      longitude: angle.longitude,
      natalHouse: houseForLongitude(houses, angle.longitude),
      houseReliability,
      timeMarginStability
    });
  }
  return points;
}

function orbAtContact(contact, date, natalPoint) {
  return aspectOrbAt({
    transitBody: contact.transitBody,
    natalLongitude: natalPoint.longitude,
    exactAngle: contact.exactAngle,
    date
  });
}

function contactOrbAtDate(contact, natalPoint, date) {
  return aspectOrbAt({
    transitBody: contact.transitBody,
    natalLongitude: natalPoint.longitude,
    exactAngle: contact.exactAngle,
    date
  });
}

function cachedLongitude(cache, transitBody, date) {
  const key = `${transitBody}:${date.getTime()}`;
  if (!cache.has(key)) {
    if (sharedLongitudeCache.has(key)) {
      cache.set(key, sharedLongitudeCache.get(key));
    } else {
      const longitude = positionAt(transitBody, date).longitude;
      rememberBounded(sharedLongitudeCache, key, longitude, LONGITUDE_CACHE_MAX_ENTRIES);
      cache.set(key, longitude);
    }
  }
  return cache.get(key);
}

function signedTargetDifference({ transitBody, targetLongitude, date, longitudeCache }) {
  return normalizeSignedDegrees(cachedLongitude(longitudeCache, transitBody, date) - targetLongitude);
}

function bisectTargetCrossing({ transitBody, targetLongitude, start, end, longitudeCache }) {
  let left = start.getTime();
  let right = end.getTime();
  let leftValue = signedTargetDifference({ transitBody, targetLongitude, date: new Date(left), longitudeCache });
  for (let index = 0; index < 50; index += 1) {
    const mid = Math.round((left + right) / 2);
    const midValue = signedTargetDifference({ transitBody, targetLongitude, date: new Date(mid), longitudeCache });
    if (Math.sign(leftValue) === Math.sign(midValue)) {
      left = mid;
      leftValue = midValue;
    } else {
      right = mid;
    }
  }
  return new Date(Math.round((left + right) / 2));
}

function aspectTargetLongitudes(natalLongitude, exactAngle) {
  if (exactAngle === 0 || exactAngle === 180) {
    return [round((natalLongitude + exactAngle + 360) % 360, 6)];
  }
  return [
    round((natalLongitude + exactAngle + 360) % 360, 6),
    round((natalLongitude - exactAngle + 360) % 360, 6)
  ];
}

function directReliabilityForNatalPoint(natalPoint) {
  if (natalPoint.kind === "angle" && natalPoint.houseReliability !== "stable") {
    return "insufficient";
  }
  if (natalPoint.timeMarginStability === "sensitive") {
    return "low";
  }
  if (natalPoint.dateWindowBased) {
    return "medium";
  }
  return "high";
}

function personalTransitTitle({ transitBody, aspectType, natalPoint }) {
  return `${transitBody} ${aspectType} natal ${natalPoint}`;
}

function makePersonalContact({ transitBody, natalPoint, aspectType, exactAngle, exactAt, calculatedAt }) {
  const orbLimit = effectiveOrbLimit({
    natalPointKind: natalPoint.kind,
    aspectType,
    transitBody
  });
  if (!orbLimit) {
    return null;
  }
  const orb = aspectOrbAt({
    transitBody,
    natalLongitude: natalPoint.longitude,
    exactAngle,
    date: exactAt
  });
  if (orb > orbLimit.effectiveOrbLimit) {
    return null;
  }
  const exactIso = exactAt.toISOString();
  return {
    id: `contact.personal.${transitBody}.${natalPoint.point}.${aspectType}.${exactIso}`,
    schema: "astrolab.western_transits.transit_contact",
    celestialEventId: null,
    personId: natalPoint.personId,
    transitBody,
    natalPoint: natalPoint.point,
    natalPointKind: natalPoint.kind,
    aspectType,
    candidateAspectType: aspectType,
    exactAngle,
    orb,
    orbPointNatal: orbLimit.orbPointNatal,
    transitBodyCap: orbLimit.transitBodyCap,
    effectiveOrbLimit: orbLimit.effectiveOrbLimit,
    retained: true,
    discardedReason: null,
    exactAt: exactIso,
    eventClusterId: null,
    natalHouse: natalPoint.natalHouse ?? null,
    houseReliability: natalPoint.houseReliability ?? "not_time_dependent",
    timeMarginStability: natalPoint.timeMarginStability ?? "not_applicable",
    reliability: directReliabilityForNatalPoint(natalPoint),
    ruleVersion: WESTERN_TRANSITS_ORB_RULE_VERSION,
    methodVersion: TRANSIT_CONTACT_ENGINE_VERSION,
    astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
    calculatedAt
  };
}

function discoverPersonalTransitContacts({ natalPoints, start, end, calculatedAt }) {
  const contacts = [];
  const seen = new Set();
  const longitudeCache = new Map();
  for (const natalPoint of natalPoints) {
    for (const transitBody of PERSONAL_TRANSIT_BODIES) {
      const stepMs = (PLANET_STEP_HOURS[transitBody] ?? 12) * 3600000;
      for (const aspect of PERSONAL_TRANSIT_ASPECTS) {
        for (const targetLongitude of aspectTargetLongitudes(natalPoint.longitude, aspect.exactAngle)) {
          let cursor = start;
          let previous = signedTargetDifference({ transitBody, targetLongitude, date: cursor, longitudeCache });
          while (cursor < end) {
            const next = new Date(Math.min(cursor.getTime() + stepMs, end.getTime()));
            const current = signedTargetDifference({ transitBody, targetLongitude, date: next, longitudeCache });
            const crossed = previous === 0 || current === 0 || Math.sign(previous) !== Math.sign(current);
            if (crossed && Math.abs(previous - current) < 60) {
              const exactAt = bisectTargetCrossing({ transitBody, targetLongitude, start: cursor, end: next, longitudeCache });
              const contact = makePersonalContact({
                transitBody,
                natalPoint,
                aspectType: aspect.aspectType,
                exactAngle: aspect.exactAngle,
                exactAt,
                calculatedAt
              });
              if (contact) {
                const key = `${contact.transitBody}:${contact.natalPoint}:${contact.aspectType}:${Math.round(exactAt.getTime() / 60000)}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  contacts.push(contact);
                }
              }
            }
            cursor = next;
            previous = current;
          }
        }
      }
    }
  }
  return contacts.sort((a, b) => a.exactAt.localeCompare(b.exactAt));
}

function findClosestContactInstant({ contact, natalPoint, startsAt, endsAt }) {
  const stepMs = (PLANET_STEP_HOURS[contact.transitBody] ?? 12) * 3600000;
  const startMs = startsAt.getTime();
  const endMs = endsAt.getTime();
  const middle = new Date(Math.round((startMs + endMs) / 2));
  let best = {
    date: middle,
    orb: contactOrbAtDate(contact, natalPoint, middle)
  };
  for (let time = startMs; time <= endMs; time += stepMs) {
    const date = new Date(time);
    const orb = contactOrbAtDate(contact, natalPoint, date);
    const betterOrb = orb < best.orb - 0.000001;
    const sameOrbCloserToWindowMiddle = Math.abs(orb - best.orb) <= 0.000001 && Math.abs(time - middle.getTime()) < Math.abs(best.date.getTime() - middle.getTime());
    if (betterOrb || sameOrbCloserToWindowMiddle) {
      best = { date, orb };
    }
  }
  let left = new Date(Math.max(startMs, best.date.getTime() - stepMs));
  let right = new Date(Math.min(endMs, best.date.getTime() + stepMs));
  const phi = (Math.sqrt(5) - 1) / 2;
  let x1 = new Date(right.getTime() - phi * (right.getTime() - left.getTime()));
  let x2 = new Date(left.getTime() + phi * (right.getTime() - left.getTime()));
  let f1 = contactOrbAtDate(contact, natalPoint, x1);
  let f2 = contactOrbAtDate(contact, natalPoint, x2);
  for (let index = 0; index < 80; index += 1) {
    if (f1 > f2) {
      left = x1;
      x1 = x2;
      f1 = f2;
      x2 = new Date(left.getTime() + phi * (right.getTime() - left.getTime()));
      f2 = contactOrbAtDate(contact, natalPoint, x2);
    } else {
      right = x2;
      x2 = x1;
      f2 = f1;
      x1 = new Date(right.getTime() - phi * (right.getTime() - left.getTime()));
      f1 = contactOrbAtDate(contact, natalPoint, x1);
    }
  }
  const exact = new Date(Math.round((left.getTime() + right.getTime()) / 2));
  return {
    exactAt: exact,
    minimumOrb: contactOrbAtDate(contact, natalPoint, exact)
  };
}

function findOrbBoundary({ contact, natalPoint, anchor, direction }) {
  const limit = contact.effectiveOrbLimit;
  const stepMs = (PLANET_STEP_HOURS[contact.transitBody] ?? 12) * 3600000;
  const maxMs = (PLANET_MAX_WINDOW_DAYS[contact.transitBody] ?? 90) * 86400000;
  let inside = anchor;
  let outside = anchor;
  while (Math.abs(outside.getTime() - anchor.getTime()) <= maxMs) {
    outside = new Date(outside.getTime() + direction * stepMs);
    if (orbAtContact(contact, outside, natalPoint) > limit) {
      break;
    }
    inside = outside;
  }
  if (orbAtContact(contact, outside, natalPoint) <= limit) {
    return outside;
  }
  let low = direction < 0 ? outside : inside;
  let high = direction < 0 ? inside : outside;
  for (let index = 0; index < 42; index += 1) {
    const mid = new Date(Math.round((low.getTime() + high.getTime()) / 2));
    if (orbAtContact(contact, mid, natalPoint) <= limit) {
      if (direction < 0) {
        high = mid;
      } else {
        low = mid;
      }
    } else if (direction < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return direction < 0 ? high : low;
}

function phaseAt({ contact, natalPoint, now }) {
  const stepMs = (PLANET_STEP_HOURS[contact.transitBody] ?? 12) * 3600000;
  const before = new Date(now.getTime() - stepMs);
  const after = new Date(now.getTime() + stepMs);
  const beforeOrb = orbAtContact(contact, before, natalPoint);
  const afterOrb = orbAtContact(contact, after, natalPoint);
  const motion = Math.abs(positionAt(contact.transitBody, after).apparentMotion?.dailyLongitudeDelta ?? 0);
  if (motion <= 0.002 && Math.abs(afterOrb - beforeOrb) <= 0.01) {
    return "STATIONARY";
  }
  if (afterOrb < beforeOrb) {
    return "APPLYING";
  }
  if (afterOrb > beforeOrb) {
    return "SEPARATING";
  }
  return "INDETERMINATE";
}

function contactWindow({ contact, natalPoint, now }) {
  const contactAnchor = requireDate(contact.exactAt ?? now, "contact exactAt");
  const startsAt = findOrbBoundary({ contact, natalPoint, anchor: contactAnchor, direction: -1 });
  const endsAt = findOrbBoundary({ contact, natalPoint, anchor: contactAnchor, direction: 1 });
  const exact = findClosestContactInstant({ contact, natalPoint, startsAt, endsAt });
  const exactAt = exact.minimumOrb <= contact.effectiveOrbLimit ? exact.exactAt : contactAnchor;
  return {
    startsAt: startsAt.toISOString(),
    exactAt: exactAt.toISOString(),
    endsAt: endsAt.toISOString(),
    phase: phaseAt({ contact, natalPoint, now })
  };
}

function eventSummary(event) {
  return {
    id: event.id,
    eventType: event.eventType,
    title: event.title,
    peakUtc: event.peakUtc ?? event.startUtc,
    primaryBody: event.primaryBody ?? null,
    secondaryBody: event.secondaryBody ?? null,
    bodies: event.bodies ?? []
  };
}

export function relatedEventsForContact({ contact, timing, events }) {
  const startsAt = requireDate(timing.startsAt, "timing.startsAt");
  const endsAt = requireDate(timing.endsAt, "timing.endsAt");
  // A global event is contextual only when its peak falls inside the personal
  // contact's actual orb window and the event involves the same transiting body.
  // Temporal proximity alone is intentionally insufficient.
  return events.filter((event) => {
    const peak = requireDate(event.peakUtc ?? event.startUtc, "event.peakUtc");
    return peak >= startsAt && peak <= endsAt && (event.bodies ?? []).includes(contact.transitBody);
  });
}

function currentSkyCacheKey({ userId, personId, natalChartHash, now, configuredHorizonDays }) {
  return hashPayload({
    userId,
    personId,
    natalChartHash,
    nowUtc: now.toISOString(),
    horizonDays: configuredHorizonDays,
    astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
    methodVersion: TRANSIT_CONTACT_ENGINE_VERSION,
    rankingRuleVersion: WESTERN_TRANSITS_RANKING_RULE_VERSION,
    orbRuleVersion: WESTERN_TRANSITS_ORB_RULE_VERSION,
    timezoneDatabaseVersion: timezoneDatabaseVersion()
  });
}

function resultIdFor({ personId, contactId, status }) {
  return `current_sky.${hashPayload({ personId, contactId, status }).slice(0, 20)}`;
}

function directRelevance(contact) {
  if (contact.reliability === "insufficient") {
    return "GENERAL_CONTEXT";
  }
  if (contact.transitBody === "Moon" && contact.orb > contact.effectiveOrbLimit * 0.25) {
    return "WATCH";
  }
  return contact.orb <= contact.effectiveOrbLimit * 0.5 ? "VERY_PERSONAL" : "WATCH";
}

function resultFromContact({ personId, contact, natalPoint, timing, status, natalChartHash, calculationRunId, relatedEvents }) {
  const relevance = directRelevance(contact);
  const durationApproxDays = round((new Date(timing.endsAt).getTime() - new Date(timing.startsAt).getTime()) / 86400000, 2);
  const houseSystem = contact.natalHouse ? HOUSE_SYSTEM : null;
  return {
    resultId: resultIdFor({ personId, contactId: contact.id, status }),
    schema: "astrolab.personal_current_sky.result",
    status,
    relevance,
    personalTransit: {
      id: `personal_transit.${contact.id}`,
      title: personalTransitTitle(contact),
      transitBody: contact.transitBody,
      natalPoint: contact.natalPoint,
      aspectType: contact.aspectType,
      exactAt: timing.exactAt
    },
    celestialEvent: null,
    relatedCelestialEventIds: relatedEvents.map((event) => event.id),
    relatedCelestialEvents: relatedEvents.map(eventSummary),
    contact: {
      transitBody: contact.transitBody,
      natalPoint: contact.natalPoint,
      natalPointKind: contact.natalPointKind,
      aspectType: contact.aspectType,
      orb: contact.orb,
      effectiveOrbLimit: contact.effectiveOrbLimit,
      reliability: uppercaseReliability(natalPoint.dateWindowBased && contact.reliability === "high" ? "medium" : contact.reliability),
      natalHouse: contact.natalHouse ?? null,
      houseSystem,
      houseReliability: contact.houseReliability,
      timeMarginStability: contact.timeMarginStability,
      longitudeUncertaintyDegrees: natalPoint.longitudeUncertaintyDegrees ?? null
    },
    timing,
    durationApproxDays,
    evidence: {
      relatedCelestialEventIds: relatedEvents.map((event) => event.id),
      transitContactId: contact.id,
      natalChartHash,
      calculationRunId,
      ruleVersion: WESTERN_TRANSITS_RANKING_RULE_VERSION,
      orbRuleVersion: WESTERN_TRANSITS_ORB_RULE_VERSION,
      methodVersion: TRANSIT_CONTACT_ENGINE_VERSION,
      astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
      ...(houseSystem ? { houseSystem } : {})
    },
    versions: {
      astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
      methodVersion: TRANSIT_CONTACT_ENGINE_VERSION,
      ruleVersion: WESTERN_TRANSITS_RANKING_RULE_VERSION,
      orbRuleVersion: WESTERN_TRANSITS_ORB_RULE_VERSION,
      ...(houseSystem ? { houseSystem } : {})
    }
  };
}

function sortResults(first, second) {
  const order = { CURRENT: 0, UPCOMING: 1, RECENT: 2 };
  const byStatus = (order[first.status] ?? 99) - (order[second.status] ?? 99);
  if (byStatus) return byStatus;
  return String(first.timing.exactAt ?? first.timing.startsAt).localeCompare(String(second.timing.exactAt ?? second.timing.startsAt));
}

function emptyCurrentSkyResponse({ personId, now, configuredHorizonDays, start, end }) {
  return {
    schema: "astrolab.personal_current_sky",
    personId,
    generatedAt: new Date().toISOString(),
    window: {
      nowUtc: now.toISOString(),
      recentSinceUtc: addDays(now, -RECENT_DAYS).toISOString(),
      horizonDays: configuredHorizonDays,
      fromUtc: start.toISOString(),
      toUtc: end.toISOString()
    },
    current: [],
    upcoming: [],
    recent: [],
    versions: {
      astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
      methodVersion: TRANSIT_CONTACT_ENGINE_VERSION,
      ruleVersion: WESTERN_TRANSITS_RANKING_RULE_VERSION,
      orbRuleVersion: WESTERN_TRANSITS_ORB_RULE_VERSION,
      timezoneDatabaseVersion: timezoneDatabaseVersion()
    }
  };
}

export async function getPersonalCurrentSky(store, userId, input = {}) {
  const now = requireDate(input.nowUtc ?? new Date(), "nowUtc");
  const configuredHorizonDays = horizonDays(input.horizonDays);
  return store.transact((state) => {
    const person = findPerson(state, userId, input.personId);
    const natalEntry = latestNatalArtifact(state, userId, person.id);
    if (!natalEntry) {
      const error = new Error("Western natal chart must be calculated before current sky can be generated.");
      error.status = 409;
      throw error;
    }
    const natal = natalEntry.artifact.payload;
    const natalPoints = natalPointsFromChart(natal);
    const start = addDays(now, -EVENT_LOOKBACK_DAYS);
    const end = addDays(now, configuredHorizonDays + EVENT_LOOKAHEAD_PADDING_DAYS);
    const cacheKey = currentSkyCacheKey({
      userId,
      personId: person.id,
      natalChartHash: natalEntry.artifact.hash,
      now,
      configuredHorizonDays
    });
    if (currentSkyResponseCache.has(cacheKey)) {
      return cloneJson(currentSkyResponseCache.get(cacheKey));
    }
    if (natalPoints.length === 0) {
      const empty = emptyCurrentSkyResponse({ personId: person.id, now, configuredHorizonDays, start, end });
      rememberBounded(currentSkyResponseCache, cacheKey, empty, CURRENT_SKY_CACHE_MAX_ENTRIES);
      return cloneJson(empty);
    }
    const rawEvents = enumerateCelestialEvents({ startUtc: start.toISOString(), endUtc: end.toISOString() });
    const relatedEvents = rawEvents.map((event) => event);
    const results = [];
    const directContacts = discoverPersonalTransitContacts({ natalPoints, start, end, calculatedAt: new Date(0).toISOString() });
    for (const contact of directContacts.filter((entry) => entry.retained && entry.reliability !== "insufficient")) {
      const natalPoint = natalPoints.find((point) => point.point === contact.natalPoint);
      if (!natalPoint) continue;
      const timing = contactWindow({ contact, natalPoint, now });
      const status = classifyCurrentSkyStatus({
        nowUtc: now,
        startsAt: timing.startsAt,
        endsAt: timing.endsAt,
        horizonDays: configuredHorizonDays
      });
      if (!status) {
        continue;
      }
      const contactRelatedEvents = relatedEventsForContact({ contact, timing, events: relatedEvents });
      results.push(
        resultFromContact({
          personId: person.id,
          contact,
          natalPoint,
          timing,
          status,
          natalChartHash: natalEntry.artifact.hash,
          calculationRunId: natalEntry.run.id,
          relatedEvents: contactRelatedEvents
        })
      );
    }
    const sorted = results.sort(sortResults).slice(0, 48);
    const response = {
      schema: "astrolab.personal_current_sky",
      personId: person.id,
      generatedAt: new Date().toISOString(),
      window: {
        nowUtc: now.toISOString(),
        recentSinceUtc: addDays(now, -RECENT_DAYS).toISOString(),
        horizonDays: configuredHorizonDays,
        fromUtc: start.toISOString(),
        toUtc: end.toISOString()
      },
      current: sorted.filter((result) => result.status === "CURRENT"),
      upcoming: sorted.filter((result) => result.status === "UPCOMING"),
      recent: sorted.filter((result) => result.status === "RECENT"),
      versions: {
        astronomyEngineVersion: ASTRONOMY_ENGINE_VERSION,
        methodVersion: TRANSIT_CONTACT_ENGINE_VERSION,
        ruleVersion: WESTERN_TRANSITS_RANKING_RULE_VERSION,
        orbRuleVersion: WESTERN_TRANSITS_ORB_RULE_VERSION,
        timezoneDatabaseVersion: timezoneDatabaseVersion()
      }
    };
    rememberBounded(currentSkyResponseCache, cacheKey, response, CURRENT_SKY_CACHE_MAX_ENTRIES);
    return cloneJson(response);
  });
}
