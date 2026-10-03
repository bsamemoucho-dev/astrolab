export const WESTERN_TRANSITS_FIXTURES = Object.freeze([
  {
    id: "new_moon_exact",
    instantUtc: "2026-11-09T07:02:42.392Z",
    input: { targetLongitude: 0, startUtc: "2026-11-08T00:00:00Z", limitDays: 5 },
    expected: { eventType: "new_moon", bodies: ["Sun", "Moon"] },
    tolerance: { timeSeconds: 90, longitudeDegrees: 0.02 },
    provenance: "NASA SKYCAL 2026 lists the November 2026 new moon at 2026-11-09 07:02 UTC; frozen with astronomy-engine@2.1.19 SearchMoonPhase.",
    methodologicalReason: "Locks exact lunar phase detection and event normalization."
  },
  {
    id: "full_moon_exact_unique_event",
    instantUtc: "2026-11-24T14:54:04.191Z",
    input: { targetLongitude: 180, startUtc: "2026-11-23T00:00:00Z", limitDays: 5 },
    expected: { eventType: "full_moon", bodies: ["Sun", "Moon"], aspectType: "opposition" },
    tolerance: { timeSeconds: 90, longitudeDegrees: 0.02 },
    provenance: "NASA SKYCAL 2026 lists the November 2026 full moon at about 2026-11-24 14:53 UTC; frozen with astronomy-engine@2.1.19 SearchMoonPhase.",
    methodologicalReason: "A full moon is one CelestialEvent even though it contains a Sun/Moon opposition."
  },
  {
    id: "natal_contact_exact_zero",
    instantUtc: "2026-11-24T14:54:04.191Z",
    input: { transitBody: "Moon", natalPoint: "Venus", longitude: 62.628 },
    expected: { orb: 0, retained: true, classification: "very_personal" },
    tolerance: { orbDegrees: 0.000001 },
    provenance: "Synthetic natal longitude set equal to the calculated fixture transit longitude.",
    methodologicalReason: "Exact transit-natal contact must be retained with maximum exactness before interpretation."
  },
  {
    id: "natal_contact_inside_effective_orb",
    instantUtc: "2026-11-24T14:54:04.191Z",
    input: { orbPointNatal: 1.5, transitBodyCap: 1.2, orb: 1.199 },
    expected: { effectiveOrbLimit: 1.2, retained: true },
    tolerance: { orbDegrees: 0.000001 },
    provenance: "Boundary fixture for the Lastro versioned orb convention.",
    methodologicalReason: "Tests the cap from the transiting body, not display rounding."
  },
  {
    id: "natal_contact_outside_effective_orb",
    instantUtc: "2026-11-24T14:54:04.191Z",
    input: { orbPointNatal: 1.5, transitBodyCap: 1.2, orb: 1.201 },
    expected: { effectiveOrbLimit: 1.2, retained: false },
    tolerance: { orbDegrees: 0.000001 },
    provenance: "Boundary fixture for the Lastro versioned orb convention.",
    methodologicalReason: "A contact outside the effective cap is rejected even if the natal point raw orb is wider."
  },
  {
    id: "unknown_birth_time",
    instantUtc: "2026-11-24T14:54:04.191Z",
    input: { timePrecision: "unknown" },
    expected: { planetsAvailable: true, anglesAvailable: false },
    tolerance: null,
    provenance: "Built from the existing Lastro birth-time uncertainty contract.",
    methodologicalReason: "No angle or house contact may be invented when birth time is unknown."
  },
  {
    id: "approximate_birth_time_angle_unstable",
    instantUtc: "2026-11-24T14:54:04.191Z",
    input: { timePrecision: "approximate", timeMarginMinutes: 30 },
    expected: { timeMarginStability: "sensitive", reliability: "insufficient" },
    tolerance: null,
    provenance: "Built from the existing Lastro timeMarginMinutes uncertainty contract.",
    methodologicalReason: "An unstable angle can be represented, but cannot alone raise personal relevance."
  },
  {
    id: "station_retrograde_direct_pair",
    instantUtc: "2027-01-10T10:00:00Z/2027-04-01T11:00:00Z",
    input: { body: "Mars", startUtc: "2027-01-01T00:00:00Z", endUtc: "2027-04-10T00:00:00Z" },
    expected: { stationTypes: ["retrograde_station", "direct_station"] },
    tolerance: { timeHours: 30 },
    provenance: "Mars 2027 station dates cross-checked against published 2027 retrograde tables; exact instants frozen by astronomy-engine@2.1.19 daily-motion bisection.",
    methodologicalReason: "Stations are changes in apparent motion, not narrative choices."
  },
  {
    id: "three_pass_retrograde_cycle",
    instantUtc: "2026-11-26T00:00:00Z/2027-05-15T00:00:00Z",
    input: { body: "Mars", targetLongitude: 150, cycleId: "mars-150deg-2026-2027" },
    expected: { passes: 3, motionStates: ["direct", "retrograde", "direct"] },
    tolerance: { longitudeDegrees: 0.001 },
    provenance: "Real Mars 2026-2027 retrograde loop over 150 tropical longitude, frozen by astronomy-engine@2.1.19.",
    methodologicalReason: "Repeated passes share a cycleId but remain distinct contacts."
  },
  {
    id: "full_moon_mirror_contact_deduplication",
    instantUtc: "2026-11-24T14:54:04.191Z",
    input: { eventType: "full_moon", natalPoint: "Venus" },
    expected: { rawContacts: 2, eventRelevanceContacts: 1 },
    tolerance: null,
    provenance: "Synthetic natal point placed on the lunar side of the verified full moon fixture.",
    methodologicalReason: "Sun/Moon mirror contacts remain factual but must not double event relevance."
  },
  {
    id: "relationship_context_no_synastry_activation",
    instantUtc: "2026-11-24T14:54:04.191Z",
    input: { personA: "exact_contact", personB: "no_contact", context: ["love", "work"] },
    expected: { relationshipTransitActivation: null },
    tolerance: null,
    provenance: "Architectural fixture derived from the accepted relationship boundary.",
    methodologicalReason: "A transit can concern one person individually without activating the relationship."
  }
]);
