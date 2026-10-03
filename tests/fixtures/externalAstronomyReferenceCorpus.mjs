export const EXTERNAL_ASTRONOMY_REFERENCE_CORPUS = Object.freeze({
  corpusId: "external-astronomy-reference-corpus@0.1.0",
  retrievedAt: "2026-10-03",
  runtimeNetworkAllowed: false,
  notes:
    "Frozen comparison corpus. Positions are primary JPL Horizons observer ephemeris references already used by Lastro. Lunar phases and stations are included as curated external-reference records for the next validation expansion.",
  positionReferences: Object.freeze([
    {
      source: "NASA/JPL Horizons API, observer ephemeris, CENTER=500@399, QUANTITIES=31 ObsEcLon/ObsEcLat",
      retrievedAt: "2026-09-01",
      tolerance: { longitudeDegrees: 0.01, latitudeDegrees: 0.02 },
      utc: "1986-01-02T00:00:00.000Z",
      positions: {
        Sun: { longitude: 281.285218, latitude: 0.0001295 },
        Moon: { longitude: 168.3443081, latitude: 3.7959428 },
        Mercury: { longitude: 264.3252764, latitude: 0.1548219 },
        Venus: { longitude: 277.0628884, latitude: -0.3703749 },
        Mars: { longitude: 221.1816368, latitude: 1.0238593 },
        Jupiter: { longitude: 318.468245, latitude: -0.8022763 },
        Saturn: { longitude: 245.2641825, latitude: 1.8073724 }
      }
    },
    {
      source: "NASA/JPL Horizons API, observer ephemeris, CENTER=500@399, QUANTITIES=31 ObsEcLon/ObsEcLat",
      retrievedAt: "2026-09-01",
      tolerance: { longitudeDegrees: 0.01, latitudeDegrees: 0.02 },
      utc: "2000-01-01T12:00:00.000Z",
      positions: {
        Sun: { longitude: 280.3689092, latitude: 0.0002381 },
        Moon: { longitude: 223.323786, latitude: 5.1707422 },
        Mercury: { longitude: 271.8892699, latitude: -0.994819 },
        Venus: { longitude: 241.5657794, latitude: 2.0663548 },
        Mars: { longitude: 327.9632921, latitude: -1.0677752 },
        Jupiter: { longitude: 25.2530685, latitude: -1.2621868 },
        Saturn: { longitude: 40.3956366, latitude: -2.4448533 }
      }
    },
    {
      source: "NASA/JPL Horizons API, observer ephemeris, CENTER=500@399, QUANTITIES=31 ObsEcLon/ObsEcLat",
      retrievedAt: "2026-09-01",
      tolerance: { longitudeDegrees: 0.01, latitudeDegrees: 0.02 },
      utc: "2024-03-20T03:06:00.000Z",
      positions: {
        Sun: { longitude: 359.9997093, latitude: 0.0001109 },
        Moon: { longitude: 123.8151802, latitude: 5.0063811 },
        Mercury: { longitude: 17.4409072, latitude: 1.4774826 },
        Venus: { longitude: 340.1712838, latitude: -1.289975 },
        Mars: { longitude: 327.7733973, latitude: -1.1734256 },
        Jupiter: { longitude: 44.8856241, latitude: -0.8526435 },
        Saturn: { longitude: 342.2254263, latitude: -1.6453503 }
      }
    }
  ]),
  phaseReferences: Object.freeze([
    {
      source: "NASA SKYCAL 2026 lunar phase table, UTC",
      retrievedAt: "2026-10-03",
      phase: "new_moon",
      utc: "2026-11-09T07:02:00.000Z",
      tolerance: { minutes: 20 }
    },
    {
      source: "NASA SKYCAL 2026 lunar phase table, UTC",
      retrievedAt: "2026-10-03",
      phase: "full_moon",
      utc: "2026-11-24T14:53:00.000Z",
      tolerance: { minutes: 20 }
    },
    {
      source: "NASA SKYCAL 2026 lunar phase table, UTC",
      retrievedAt: "2026-10-03",
      phase: "new_moon",
      utc: "2026-10-10T15:50:00.000Z",
      tolerance: { minutes: 20 }
    },
    {
      source: "NASA SKYCAL 2026 lunar phase table, UTC",
      retrievedAt: "2026-10-03",
      phase: "full_moon",
      utc: "2026-10-26T04:12:00.000Z",
      tolerance: { minutes: 20 }
    },
    {
      source: "NASA SKYCAL 2026 lunar phase table, UTC",
      retrievedAt: "2026-10-03",
      phase: "new_moon",
      utc: "2026-12-09T00:52:00.000Z",
      tolerance: { minutes: 20 }
    },
    {
      source: "NASA SKYCAL 2026 lunar phase table, UTC",
      retrievedAt: "2026-10-03",
      phase: "full_moon",
      utc: "2026-12-24T01:29:00.000Z",
      tolerance: { minutes: 20 }
    },
    {
      source: "NASA SKYCAL 2027 lunar phase table, UTC",
      retrievedAt: "2026-10-03",
      phase: "new_moon",
      utc: "2027-01-07T20:25:00.000Z",
      tolerance: { minutes: 30 }
    },
    {
      source: "NASA SKYCAL 2027 lunar phase table, UTC",
      retrievedAt: "2026-10-03",
      phase: "full_moon",
      utc: "2027-01-22T12:17:00.000Z",
      tolerance: { minutes: 30 }
    }
  ]),
  stationReferences: Object.freeze([
    {
      source: "Astrodienst Swiss Ephemeris online ephemeris, geocentric apparent tropical station listing",
      retrievedAt: "2026-10-03",
      body: "Mars",
      stationType: "retrograde_station",
      utc: "2027-01-10T10:00:00.000Z",
      tolerance: { hours: 6 }
    },
    {
      source: "Astrodienst Swiss Ephemeris online ephemeris, geocentric apparent tropical station listing",
      retrievedAt: "2026-10-03",
      body: "Mars",
      stationType: "direct_station",
      utc: "2027-04-01T11:00:00.000Z",
      tolerance: { hours: 6 }
    },
    {
      source: "Astrodienst Swiss Ephemeris online ephemeris, geocentric apparent tropical station listing",
      retrievedAt: "2026-10-03",
      body: "Venus",
      stationType: "retrograde_station",
      utc: "2026-10-03T07:00:00.000Z",
      tolerance: { hours: 6 }
    },
    {
      source: "Astrodienst Swiss Ephemeris online ephemeris, geocentric apparent tropical station listing",
      retrievedAt: "2026-10-03",
      body: "Pluto",
      stationType: "direct_station",
      utc: "2026-10-16T02:00:00.000Z",
      tolerance: { hours: 6 }
    },
    {
      source: "Astrodienst Swiss Ephemeris online ephemeris, geocentric apparent tropical station listing",
      retrievedAt: "2026-10-03",
      body: "Mercury",
      stationType: "retrograde_station",
      utc: "2026-10-24T07:00:00.000Z",
      tolerance: { hours: 6 }
    }
  ])
});
