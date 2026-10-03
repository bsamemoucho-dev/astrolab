import assert from "node:assert/strict";
import test from "node:test";

import { WESTERN_TRANSITS_FIXTURES } from "./fixtures/westernTransitsFixtures.mjs";
import {
  buildRetrogradeCycle,
  buildPersonTransitResult,
  buildRelationshipTransitContext,
  calculateTransitContacts,
  createEditorialEvent,
  createMoonPhaseEvent,
  createSyntheticEvent,
  decorateEventForEdition,
  enumerateCelestialEvents,
  effectiveOrbLimit,
  findSignIngresses,
  findMotionStations,
  findRetrogradeCyclePasses,
  localDisplayParts,
  TRANSIT_CONTACT_ENGINE_VERSION,
  TRANSIT_CONTACT_PHASES,
  WESTERN_TRANSITS_ORB_RULE_VERSION
} from "../src/astro/westernTransits.mjs";

function fixture(id) {
  const entry = WESTERN_TRANSITS_FIXTURES.find((item) => item.id === id);
  assert.ok(entry, `fixture ${id} must exist`);
  return entry;
}

function secondsBetween(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 1000;
}

function syntheticContactEvent({ transitBody = "Mars", longitude = 100 } = {}) {
  return createSyntheticEvent({
    id: `fixture.${transitBody}.${longitude}`,
    startUtc: "2026-11-24T14:54:04.191Z",
    bodies: [transitBody],
    bodyPositions: {
      [transitBody]: { body: transitBody, longitude }
    }
  });
}

test("les 11 fixtures western-transits sont documentées et stables", () => {
  assert.equal(WESTERN_TRANSITS_FIXTURES.length, 11);
  for (const entry of WESTERN_TRANSITS_FIXTURES) {
    assert.ok(entry.id);
    assert.ok(entry.instantUtc);
    assert.ok(entry.input);
    assert.ok(entry.expected);
    assert.ok("tolerance" in entry);
    assert.ok(entry.provenance);
    assert.ok(entry.methodologicalReason);
  }
});

test("fixture 1 : Nouvelle Lune exacte", () => {
  const fx = fixture("new_moon_exact");
  const event = createMoonPhaseEvent({
    id: fx.id,
    eventType: "new_moon",
    targetLongitude: fx.input.targetLongitude,
    startUtc: fx.input.startUtc,
    limitDays: fx.input.limitDays,
    reference: fx.provenance
  });

  assert.equal(event.eventType, fx.expected.eventType);
  assert.deepEqual(event.bodies, fx.expected.bodies);
  assert.ok(secondsBetween(event.peakUtc, fx.instantUtc) <= fx.tolerance.timeSeconds);
  assert.equal(event.eventCluster.mirrorDeduplication, true);
  assert.equal(event.source.functionNames[0], "SearchMoonPhase");
});

test("fixture 2 : Pleine Lune exacte avec événement unique", () => {
  const fx = fixture("full_moon_exact_unique_event");
  const event = createMoonPhaseEvent({
    id: fx.id,
    eventType: "full_moon",
    targetLongitude: fx.input.targetLongitude,
    startUtc: fx.input.startUtc,
    limitDays: fx.input.limitDays,
    reference: fx.provenance
  });

  assert.equal(event.eventType, "full_moon");
  assert.equal(event.aspectType, "opposition");
  assert.equal(event.eventCluster.id, `${fx.id}.lunation`);
  assert.ok(secondsBetween(event.peakUtc, fx.instantUtc) <= fx.tolerance.timeSeconds);
  assert.equal(Object.keys(event.bodyPositions).length, 2);
});

test("fixture 3 : contact transit-natal exact à 0°", () => {
  const fx = fixture("natal_contact_exact_zero");
  const event = syntheticContactEvent({ transitBody: "Mars", longitude: fx.input.longitude });
  const rawContacts = calculateTransitContacts(event, [
    {
      personId: "A",
      point: fx.input.natalPoint,
      kind: "personal_planet",
      longitude: fx.input.longitude,
      houseReliability: "not_time_dependent"
    }
  ]);
  const contact = rawContacts[0];
  assert.equal(contact.orb, fx.expected.orb);
  assert.equal(contact.retained, true);
  assert.equal(contact.ruleVersion, WESTERN_TRANSITS_ORB_RULE_VERSION);

  const result = buildPersonTransitResult({ personId: "A", celestialEvent: event, rawContacts });
  assert.equal(result.classification, fx.expected.classification);
  assert.equal(result.eventRelevance.contacts.length, 1);
});

test("fixtures 4 et 5 : frontières de l'orbe effectif sans arrondi d'affichage", () => {
  const inside = fixture("natal_contact_inside_effective_orb");
  const outside = fixture("natal_contact_outside_effective_orb");
  const limits = effectiveOrbLimit({
    natalPointKind: "personal_planet",
    aspectType: "conjunction",
    transitBody: "Mars"
  });
  assert.equal(limits.orbPointNatal, inside.input.orbPointNatal);
  assert.equal(limits.transitBodyCap, inside.input.transitBodyCap);
  assert.equal(limits.effectiveOrbLimit, inside.expected.effectiveOrbLimit);

  const insideEvent = syntheticContactEvent({ transitBody: "Mars", longitude: 100 });
  const [insideContact] = calculateTransitContacts(insideEvent, [
    { personId: "A", point: "Venus", kind: "personal_planet", longitude: 100 + inside.input.orb }
  ]);
  assert.equal(insideContact.orb, inside.input.orb);
  assert.equal(insideContact.retained, inside.expected.retained);

  const outsideEvent = syntheticContactEvent({ transitBody: "Mars", longitude: 100 });
  const [outsideContact] = calculateTransitContacts(outsideEvent, [
    { personId: "A", point: "Venus", kind: "personal_planet", longitude: 100 + outside.input.orb }
  ]);
  assert.equal(outsideContact.orb, outside.input.orb);
  assert.equal(outsideContact.retained, outside.expected.retained);
  assert.equal(outsideContact.discardedReason, "outside_effective_orb");
});

test("fixture 6 : heure inconnue, planètes disponibles mais angles indisponibles", () => {
  const fx = fixture("unknown_birth_time");
  const event = syntheticContactEvent({ transitBody: "Moon", longitude: 210 });
  const contacts = calculateTransitContacts(event, [
    { personId: "A", point: "Sun", kind: "luminary", longitude: 210, houseReliability: "not_time_dependent" },
    { personId: "A", point: "ASC", kind: "angle", longitude: 210, houseReliability: "unknown_time" }
  ]);

  assert.equal(fx.expected.planetsAvailable, true);
  assert.equal(fx.expected.anglesAvailable, false);
  assert.ok(contacts.some((contact) => contact.natalPoint === "Sun"));
  assert.ok(!contacts.some((contact) => contact.natalPoint === "ASC"));
});

test("fixture 7 : heure approximative avec angle ou maison instable", () => {
  const fx = fixture("approximate_birth_time_angle_unstable");
  const event = syntheticContactEvent({ transitBody: "Moon", longitude: 45 });
  const [contact] = calculateTransitContacts(event, [
    {
      personId: "A",
      point: "ASC",
      kind: "angle",
      longitude: 45,
      houseReliability: "unstable_time_margin",
      timeMarginStability: "sensitive"
    }
  ]);

  assert.equal(contact.retained, true);
  assert.equal(contact.timeMarginStability, fx.expected.timeMarginStability);
  assert.equal(contact.reliability, fx.expected.reliability);
  const result = buildPersonTransitResult({ personId: "A", celestialEvent: event, rawContacts: [contact] });
  assert.equal(result.classification, "general_context");
});

test("fixture 8 : station rétrograde puis station directe", () => {
  const fx = fixture("station_retrograde_direct_pair");
  const stations = findMotionStations(fx.input);
  assert.deepEqual(stations.map((station) => station.eventType), fx.expected.stationTypes);

  assert.ok(secondsBetween(stations[0].peakUtc, "2027-01-10T10:00:00Z") <= fx.tolerance.timeHours * 3600);
  assert.ok(secondsBetween(stations[1].peakUtc, "2027-04-01T11:00:00Z") <= fx.tolerance.timeHours * 3600);
  assert.ok(stations.every((station) => station.source.functionNames.includes("bisection_daily_motion")));
});

test("fixture 9 : trois passages du même transit partagent un cycleId", () => {
  const fx = fixture("three_pass_retrograde_cycle");
  const passes = findRetrogradeCyclePasses({
    body: fx.input.body,
    natalPoint: "Saturn",
    targetLongitude: fx.input.targetLongitude,
    startUtc: "2026-11-01T00:00:00Z",
    endUtc: "2027-07-01T00:00:00Z",
    cycleId: fx.input.cycleId
  });

  assert.equal(passes.length, fx.expected.passes);
  assert.deepEqual(passes.map((pass) => pass.motionState), fx.expected.motionStates);
  assert.ok(passes.every((pass) => pass.cycleId === fx.input.cycleId));
  assert.deepEqual(passes.map((pass) => pass.passNumber), [1, 2, 3]);
  assert.ok(passes.every((pass) => pass.totalPassesKnown === 3));
});

test("fixture 10 : Pleine Lune avec contacts miroir dédupliqués par eventCluster", () => {
  const fx = fixture("full_moon_mirror_contact_deduplication");
  const event = createMoonPhaseEvent({
    id: fx.id,
    eventType: "full_moon",
    targetLongitude: 180,
    startUtc: "2026-11-23T00:00:00Z",
    limitDays: 5
  });
  const moonLongitude = event.bodyPositions.Moon.longitude;
  const rawContacts = calculateTransitContacts(event, [
    {
      personId: "A",
      point: fx.input.natalPoint,
      kind: "personal_planet",
      longitude: moonLongitude,
      houseReliability: "not_time_dependent"
    }
  ]).filter((contact) => contact.retained);

  assert.equal(rawContacts.length, fx.expected.rawContacts);
  const result = buildPersonTransitResult({ personId: "A", celestialEvent: event, rawContacts });
  assert.equal(result.rawContacts.length, fx.expected.rawContacts);
  assert.equal(result.eventRelevance.contacts.length, fx.expected.eventRelevanceContacts);
  assert.equal(result.eventRelevance.deduplicatedContactIds.length, 1);
});

test("fixture 11 : A touché, B non touché, aucune activation relationnelle", () => {
  const fx = fixture("relationship_context_no_synastry_activation");
  const event = syntheticContactEvent({ transitBody: "Venus", longitude: 88 });
  const rawContacts = calculateTransitContacts(event, [
    { personId: "A", point: "Venus", kind: "personal_planet", longitude: 88 },
    { personId: "B", point: "Venus", kind: "personal_planet", longitude: 130 }
  ]);

  const personAResult = buildPersonTransitResult({ personId: "A", celestialEvent: event, rawContacts, context: "love" });
  const personBResult = buildPersonTransitResult({ personId: "B", celestialEvent: event, rawContacts, context: "love" });
  const relationship = buildRelationshipTransitContext({ relationshipId: "rel_1", personAResult, personBResult });

  assert.notEqual(personAResult.classification, "general_context");
  assert.equal(personBResult.classification, "general_context");
  assert.equal(relationship.relationshipTransitActivation, fx.expected.relationshipTransitActivation);
  assert.equal(relationship.summary, "person_a_individually_concerned");
});

test("les planètes lentes existent dans le moteur d'événements célestes, pas dans le calcul natal", () => {
  const ingresses = findSignIngresses({
    body: "Neptune",
    startUtc: "2026-01-01T00:00:00Z",
    endUtc: "2027-01-01T00:00:00Z"
  });

  assert.ok(ingresses.length >= 1);
  assert.equal(ingresses[0].eventType, "sign_ingress");
  assert.deepEqual(ingresses[0].bodies, ["Neptune"]);
  assert.match(ingresses[0].id, /^ingress\.neptune\./);
});

test("une Lune ordinaire ne dépasse pas À observer, mais une lunaison peut rester très personnelle", () => {
  const ordinaryMoon = syntheticContactEvent({ transitBody: "Moon", longitude: 210 });
  const [ordinaryContact] = calculateTransitContacts(ordinaryMoon, [
    { personId: "A", point: "Sun", kind: "luminary", longitude: 210, houseReliability: "not_time_dependent" }
  ]);
  const ordinaryResult = buildPersonTransitResult({ personId: "A", celestialEvent: ordinaryMoon, rawContacts: [ordinaryContact] });
  assert.equal(ordinaryResult.classification, "observe");

  const lunation = createMoonPhaseEvent({
    id: "fixture.new-moon-personal-cap-exception",
    eventType: "new_moon",
    targetLongitude: 0,
    startUtc: "2026-11-08T00:00:00Z",
    limitDays: 5
  });
  const [lunationContact] = calculateTransitContacts(lunation, [
    {
      personId: "A",
      point: "Sun",
      kind: "luminary",
      longitude: lunation.bodyPositions.Moon.longitude,
      houseReliability: "not_time_dependent"
    }
  ]);
  const lunationResult = buildPersonTransitResult({ personId: "A", celestialEvent: lunation, rawContacts: [lunationContact] });
  assert.equal(lunationResult.classification, "very_personal");
});

test("les lunaisons dédupliquent la pertinence sans supprimer les contacts factuels", () => {
  const event = createMoonPhaseEvent({
    id: "fixture.new-moon-cluster",
    eventType: "new_moon",
    targetLongitude: 0,
    startUtc: "2026-11-08T00:00:00Z",
    limitDays: 5
  });
  const rawContacts = calculateTransitContacts(event, [
    {
      personId: "A",
      point: "Moon",
      kind: "luminary",
      longitude: event.bodyPositions.Moon.longitude,
      houseReliability: "not_time_dependent"
    }
  ]);
  const retained = rawContacts.filter((contact) => contact.retained);
  const result = buildPersonTransitResult({ personId: "A", celestialEvent: event, rawContacts });

  assert.equal(retained.length, 2);
  assert.equal(result.rawContacts.filter((contact) => contact.retained).length, 2);
  assert.equal(result.eventRelevance.contacts.length, 1);
  assert.equal(result.eventRelevance.deduplicatedContactIds.length, 1);
});

test("les stations exposent la précision V1 et les cycles rétrogrades formalisent les bornes", () => {
  const stations = findMotionStations({
    body: "Mars",
    startUtc: "2026-11-01T00:00:00Z",
    endUtc: "2027-07-01T00:00:00Z"
  });
  assert.ok(stations.every((station) => station.precision.method === "daily_motion_sign_change_bisection"));
  assert.ok(stations.every((station) => station.precision.iterations === 50));
  assert.ok(stations.every((station) => station.precision.editorialDisplay === "minute"));

  const cycle = buildRetrogradeCycle({
    body: "Mars",
    targetLongitude: 150,
    startUtc: "2026-11-01T00:00:00Z",
    endUtc: "2027-07-01T00:00:00Z",
    cycleId: "mars-150deg-2026-2027"
  });
  assert.equal(cycle.preShadowStartUtc, cycle.passes[0].exactUtc);
  assert.equal(cycle.postShadowEndUtc, cycle.passes.at(-1).exactUtc);
  assert.equal(cycle.retrogradeStationUtc, stations[0].peakUtc);
  assert.equal(cycle.directStationUtc, stations[1].peakUtc);
  assert.deepEqual(cycle.passes.map((pass) => pass.passNumber), [1, 2, 3]);
  assert.deepEqual(cycle.passes.map((pass) => pass.motionState), ["direct", "retrograde", "direct"]);
});

test("l'UTC reste canonique, l'édition France ne change ni identifiant ni date source", () => {
  const event = createSyntheticEvent({
    id: "fixture.utc-canonical",
    startUtc: "2026-10-31T23:30:00Z",
    bodies: ["Mars"],
    bodyPositions: { Mars: { body: "Mars", longitude: 12 } }
  });
  const france = decorateEventForEdition(event, "Europe/Paris");
  const utcParts = localDisplayParts(event.peakUtc, "UTC");

  assert.equal(event.peakUtc, "2026-10-31T23:30:00.000Z");
  assert.equal(france.localDate, "2026-11-01");
  assert.equal(utcParts.localDate, "2026-10-31");
  assert.equal(france.id, event.id);
});

test("EditorialEvent reste séparé et non indexable par défaut", () => {
  const event = createSyntheticEvent({
    id: "fixture.editorial-separation",
    eventType: "planetary_aspect",
    startUtc: "2026-10-15T08:21:22.425Z",
    bodies: ["Sun", "Jupiter"],
    bodyPositions: {
      Sun: { body: "Sun", longitude: 202 },
      Jupiter: { body: "Jupiter", longitude: 142 }
    }
  });
  const editorial = createEditorialEvent(event);

  assert.equal(editorial.celestialEventId, event.id);
  assert.equal(editorial.editorialPriority, "B");
  assert.equal(editorial.editorialStatus, "DETECTED");
  assert.equal(editorial.indexable, false);
  assert.ok(!("eventRelevance" in editorial));
});

test("octobre 2026 produit un calendrier céleste factuel et chronologique", () => {
  const events = enumerateCelestialEvents({
    startUtc: "2026-10-01T00:00:00Z",
    endUtc: "2026-11-01T00:00:00Z"
  });
  assert.equal(events.length, 16);
  assert.deepEqual(events.map((event) => event.peakUtc), [...events.map((event) => event.peakUtc)].sort());
  assert.ok(events.some((event) => event.eventType === "new_moon"));
  assert.ok(events.some((event) => event.eventType === "full_moon"));
  assert.ok(events.some((event) => event.eventType === "retrograde_station"));
  assert.ok(events.some((event) => event.eventType === "direct_station"));
  assert.ok(events.some((event) => event.eventType === "sign_ingress"));
  assert.ok(events.some((event) => event.eventType === "planetary_aspect" && event.bodies.includes("Pluto")));
});

test("TransitContact expose une phase factuelle sans en déduire l'intensité", () => {
  const event = createMoonPhaseEvent({
    id: "fixture.phase.full-moon",
    eventType: "full_moon",
    targetLongitude: 180,
    startUtc: "2026-11-23T00:00:00Z",
    limitDays: 5
  });
  const [contact] = calculateTransitContacts(event, [
    {
      personId: "A",
      point: "Moon",
      kind: "luminary",
      longitude: event.bodyPositions.Moon.longitude,
      houseReliability: "not_time_dependent"
    }
  ]);

  assert.ok(TRANSIT_CONTACT_PHASES.includes(contact.phase));
  assert.deepEqual(TRANSIT_CONTACT_PHASES, ["APPLYING", "SEPARATING", "STATIONARY", "INDETERMINATE"]);
  assert.notEqual(contact.phase, "EXACT");
  assert.equal(contact.exactAt, event.peakUtc);
  assert.equal(contact.methodVersion, TRANSIT_CONTACT_ENGINE_VERSION);
  assert.ok(contact.astronomyEngineVersion);
  assert.ok(contact.calculatedAt);
  assert.ok(!("intensity" in contact));
});

test("la phase d'un contact près d'une station peut être STATIONARY", () => {
  const [station] = findMotionStations({
    body: "Mars",
    startUtc: "2027-01-01T00:00:00Z",
    endUtc: "2027-01-20T00:00:00Z"
  });
  const [contact] = calculateTransitContacts(station, [
    {
      personId: "A",
      point: "Saturn",
      kind: "social_slow_planet",
      longitude: station.longitude + 0.5,
      houseReliability: "not_time_dependent"
    }
  ]);

  assert.equal(station.eventType, "retrograde_station");
  assert.equal(contact.retained, true);
  assert.equal(contact.phase, "STATIONARY");
  assert.equal(contact.exactAt, null);
});
