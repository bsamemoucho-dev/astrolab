# Method Sheet: Western Transits

## Identity

- `methodId`: `western-transits`
- `tradition`: Western astrology
- `family`: astrology
- `school`: modern Western transit practice, product convention to document before activation
- `method`: current sky events and contacts to natal charts
- `type`: `temporal`
- `initialScope`: current and upcoming celestial events, then personal transit contacts
- `status`: `DOCUMENTATION_IN_PROGRESS`
- `productionEligible`: false
- `targetFirstProductionVersion`: `1.0.0`
- `calculationEngine`: `astronomy-engine@2.1.19`
- `runtimeNetwork`: forbidden for production calculation

## Product Decision

Western Transits V1 keeps `astronomy-engine` as the internal calculation engine. The goal is not to create a generic horoscope blog, but a factual event engine with strict separation between:

1. astronomical event data;
2. structural astrological contacts;
3. documented interpretive rules;
4. validated user-facing narrative.

No AI narrative may invent a planet, aspect, degree, house, station, transit, or relationship activation. The writer receives only validated JSON.

Lastro must not become an automatic article farm. The correct model is an event-driven editorial engine:

1. calculate the sky once;
2. store factual `CelestialEvent` records as the source of truth;
3. decide whether an event deserves public content;
4. generate a structured draft only from validated data;
5. validate every factual claim against the JSON;
6. publish or schedule the page;
7. update time-sensitive blocks automatically;
8. reuse the same event across `/ciel/`, homepage blocks, user dashboards, future love/work contexts, newsletter material, and internal links.

One astronomical fact must be calculated once and reused everywhere.

## V1 Event Scope

Included in V1:

- new moon;
- full moon;
- retrograde stations;
- direct stations;
- sign ingress;
- major planetary aspects: conjunction, opposition, square, trine, sextile.

The V1 event engine may use Uranus, Neptune, and Pluto for sky events. This does not extend the natal calculation engine. Natal fixtures and natal chart production remain limited to their currently validated scope until a separate natal-method decision expands them.

Deferred:

- meteor showers;
- comets;
- advanced local visibility pages;
- local city pages except when the local data changes materially.

Eclipses are documented as available in Astronomy Engine and can be used for control or a later V1.x extension, but the first editorial generation batch should not depend on local eclipse visibility.

## Astronomy Engine Capabilities To Reuse

Do not reimplement a calculation when `astronomy-engine@2.1.19` exposes a suitable primitive.

Documented primitives relevant to Western Transits:

- lunar phase angle: `MoonPhase(date)`;
- exact lunar phase search: `SearchMoonPhase(targetLon, dateStart, limitDays)`;
- quarter enumeration: `SearchMoonQuarter(dateStart)` and `NextMoonQuarter(mq)`;
- lunar eclipses: `SearchLunarEclipse(date)`, `NextLunarEclipse(prevEclipseTime)`;
- global solar eclipses: `SearchGlobalSolarEclipse(startTime)`, `NextGlobalSolarEclipse(prevEclipseTime)`;
- local solar eclipses: `SearchLocalSolarEclipse(startTime, observer)`, `NextLocalSolarEclipse(prevEclipseTime, observer)`;
- topocentric equatorial coordinates: `Equator(body, date, observer, ofdate, aberration)`;
- horizontal coordinates: `Horizon(date, observer, ra, dec, refraction)`;
- observer model: `Observer(latitude, longitude, height)`;
- rise/set search: `SearchRiseSet(body, observer, direction, dateStart, limitDays, metersAboveGround)`;
- altitude search: `SearchAltitude(body, observer, direction, dateStart, limitDays, altitude)`;
- relative longitude search for conjunction/opposition style astronomy events: `SearchRelativeLongitude(body, targetRelLon, startDate)`;
- Mercury/Venus solar transits: `SearchTransit(body, startTime)`.

For tropical zodiac longitude of the seven currently supported bodies, Lastro already uses local wrappers around Astronomy Engine geocentric apparent ecliptic positions. V1 should reuse that layer for consistency unless reference fixtures show that a native Astronomy Engine search is more accurate for a specific event.

## Calculation Boundaries

`CelestialEvent` is factual. It may know that Venus is stationary, that the Moon is full, or that Mars enters Leo. It must not decide that an event is "important for a person".

`TransitContact` compares a transit body/point with a natal point using a documented orb table. It must not generate narrative.

`PersonTransitResult` groups contacts for one person and classifies them as:

- `very_personal`;
- `observe`;
- `general_context`.

These labels are not coded until the methodology and fixtures are validated.

Relationship contexts use the same person-level calculations first. A transit touching A and not B can be displayed as "A is more individually concerned in this period" but not as a relationship activation.

True relationship activation requires a future validated `western-synastry` result.

Global `CelestialEvent` records are calculated once for a date window and can be cached. Personal contact calculation is separate, per person, and triggered only when a user or product surface needs it. V1 must not batch every future celestial event against all users.

UTC is the canonical truth for identifiers, storage, comparison, and cache keys. French editorial display uses `Europe/Paris`, but internal IDs must never depend on a local date, title, or slug. A fact at `2026-10-31T23:30:00Z` may display as `2026-11-01` in France while keeping its original UTC instant and ID.

## Data Model Drafts

### CelestialEvent

```ts
interface CelestialEvent {
  id: string;
  schema: "astrolab.western_transits.celestial_event";
  eventType:
    | "new_moon"
    | "full_moon"
    | "retrograde_station"
    | "direct_station"
    | "sign_ingress"
    | "planetary_aspect";
  title: string;
  startUtc: string;
  peakUtc?: string;
  endUtc?: string;
  bodies: string[];
  primaryBody?: string;
  secondaryBody?: string;
  longitude?: number;
  zodiacSign?: string;
  degreeInSign?: number;
  aspectType?: "conjunction" | "opposition" | "square" | "trine" | "sextile";
  exactAngle?: number;
  motionState?: "retrograde_station" | "direct_station";
  eventCluster?: {
    id: string;
    anchor: "sun" | "moon" | "primary_body" | "aspect_pair";
    mirrorDeduplication: boolean;
  };
  source: {
    type: "calculated";
    engine: "astronomy-engine";
    engineVersion: "astronomy-engine@2.1.19";
    functionNames: string[];
    referenceDatasetIds?: string[];
  };
  calculationVersion: "western-transits-calculation@1.0.0-draft";
  ruleVersion: null | string;
  editorialStatus: "not_reviewed" | "selected_for_page" | "not_indexable";
  createdAt: string;
}
```

`eventCluster` is required for lunations and any future event whose two mathematical contacts could mirror the same event. A full moon is both Sun opposite Moon and Moon opposite Sun; if a natal Venus sits on the lunar side, Lastro may find Moon conjunct natal Venus and Sun opposite natal Venus. Both facts can be stored, but ranking must not double-count the same full moon.

### EditorialEvent

```ts
interface EditorialEvent {
  id: string;
  schema: "astrolab.western_transits.editorial_event";
  celestialEventId: string;
  eventType: CelestialEvent["eventType"];
  eventDate: string;
  editorialPriority: "A" | "B" | "C";
  editorialInterest: {
    rarity: "low" | "medium" | "high";
    methodologicalImportance: "low" | "medium" | "high";
    astronomicalInterest: "low" | "medium" | "high";
    temporalRelevance: "upcoming" | "current" | "recent" | "archive";
    explanationPotential: "low" | "medium" | "high";
    similarPageExists: boolean;
    personalizationPotential: "none" | "possible" | "strong";
  };
  articleRequired: boolean;
  publicationDate?: string;
  updateDate?: string;
  status:
    | "DETECTED"
    | "PLANNED"
    | "DRAFT"
    | "VALIDATED"
    | "SCHEDULED"
    | "PUBLISHED"
    | "UPDATED"
    | "ARCHIVED";
  slug?: string;
  contentVersion?: string;
  factVersion: string;
  lastCheckedAt: string;
}
```

`EditorialEvent` is an editorial workflow object, not an astrological strength score. It decides whether an event deserves an indexable page. It must never be displayed as "this event is powerful at 92%".

### TransitContact

```ts
interface TransitContact {
  id: string;
  schema: "astrolab.western_transits.transit_contact";
  celestialEventId: string;
  personId: string;
  transitBody: string;
  natalPoint: string;
  natalPointKind: "luminary" | "personal_planet" | "social_slow_planet" | "angle";
  aspectType: "conjunction" | "opposition" | "square" | "trine" | "sextile";
  exactAngle: number;
  angularDistance: number;
  orb: number;
  orbPointNatal: number;
  transitBodyCap: number;
  effectiveOrbLimit: number;
  phase: "APPLYING" | "SEPARATING" | "STATIONARY" | "INDETERMINATE";
  exactAt: string | null;
  applyingOrSeparating?: "applying" | "separating" | "stationary_unclear";
  retrogradeCycle?: {
    cycleId: string;
    passNumber: number;
    totalPassesKnown: number;
    motionState: "direct" | "retrograde" | "station_retrograde" | "station_direct";
  };
  eventClusterId?: string;
  mirrorOfContactId?: string;
  rankingDeduplicatedBy?: "lunation_mirror" | "same_retrograde_cycle" | null;
  natalHouse?: number;
  houseReliability: "not_time_dependent" | "stable" | "unstable_time_margin" | "unknown_time";
  timeMarginStability: "stable" | "sensitive" | "not_applicable";
  reliability: "high" | "medium" | "low" | "insufficient";
  ruleVersion: "western-transits-orbs@1.0.0-draft";
  methodVersion: string;
  astronomyEngineVersion: string;
  calculatedAt: string;
}
```

`phase` is factual and must be derived from the real evolution of distance to the exact aspect before and after the contact instant. It is not calculated from the sign of one planet's velocity alone. Exactness is represented separately with `exactAt`; `EXACT` is intentionally not a phase. V1 must not encode any interpretation such as "applying is stronger"; that belongs to a future interpretation RuleVersion.

### PersonTransitResult

```ts
interface PersonTransitResult {
  id: string;
  schema: "astrolab.western_transits.person_transit_result";
  personId: string;
  celestialEventId: string;
  contacts: TransitContact[];
  classification: "very_personal" | "observe" | "general_context";
  classificationFactors: {
    closestOrb: number | null;
    natalPointsTouched: string[];
    aspectTypes: string[];
    timeReliability: string;
    houseReliability: string;
    repeatedByRetrogradeCycle: boolean;
    deduplicatedContactIds: string[];
  };
  ruleVersion: "western-transits-ranking@1.0.0-draft";
}
```

### Future Relationship Hook

```ts
interface RelationshipTransitActivation {
  id: string;
  relationshipId: string;
  celestialEventId: string;
  personAResultId: string;
  personBResultId: string;
  synastryResultId: string;
  activatedSynastryAspectId?: string;
  activatedNatalPointA?: string;
  activatedNatalPointB?: string;
  transitBody: string;
  aspectType: string;
  orb: number;
  reliability: "high" | "medium" | "low" | "insufficient";
  ruleVersion: string;
}
```

`PersonTransitResult` must not depend on this future type.

## Context Hooks

Individual context can use `PersonTransitResult` after ranking validation.

`InterpretationRule` must remain separate from `CelestialEvent`, `TransitContact`, and `PersonTransitResult`. The calculation layer can expose context labels such as `individual`, `love`, or `work`, but it must not generate narrative, advice, scores, or dimensions without a documented context-specific RuleVersion.

Love context can present A and B separately before synastry:

- communication;
- emotional security;
- affection;
- desire;
- intimacy;
- autonomy;
- conflict;
- commitment.

Work context can present A and B separately before synastry:

- communication;
- initiative;
- decision;
- organization;
- creativity;
- cooperation;
- leadership;
- pressure;
- adaptability;
- complementarity.

No interpretive text is allowed until documented rules map calculated factors to these dimensions. Love and work must have separate RuleVersions.

Professional/work text must stay self-reflective and planning-oriented. It must not be used for recruitment, selection, firing, performance scoring, salary decisions, or other employment decisions about another person.

## House System Compatibility

The current natal engine uses Whole Sign houses:

- implementation: `src/astro/westernNatal.mjs`, `calculateWholeSignHouses()`;
- result parameter: `parameters.houseSystem = "WHOLE_SIGN"`;
- output field: `structuralAstrology.houseSystem = "WHOLE_SIGN"`;
- compatibility field on house entries: `structuralAstrology.houses[].system = "whole_sign"`;
- documentation: `docs/methods/western-natal.md`, `docs/engine-contracts.md`, `docs/conventions-lastro.md`.

Personal transits must use the same house system when house context is eventually attached. V1 must not switch to Placidus or another domification to simplify transit development.

## Proposed Orb Table

Draft rule version: `western-transits-orbs@1.0.0-draft`.

These are intentionally narrower than natal orbs because a transit is temporal and should identify periods of contact rather than broad chart structure.

This table is keyed by the natal point touched, not by the transiting body.

| Natal point touched | Conjunction / opposition | Square / trine | Sextile |
|---|---:|---:|---:|
| Sun / Moon | 2.0° | 1.5° | 1.0° |
| Mercury / Venus / Mars | 1.5° | 1.2° | 0.8° |
| Jupiter / Saturn | 1.2° | 1.0° | 0.6° |
| Reliable ASC / MC | 1.5° | 1.2° | 0.8° |

V1 also applies a cap based on the transiting body, so slow or repeated contacts do not remain active for too long solely because the natal point allows a wider orb.

| Transiting body category | Maximum cap |
|---|---:|
| Sun / Moon | 1.5° |
| Mercury / Venus / Mars | 1.2° |
| Jupiter / Saturn / Uranus / Neptune / Pluto | 1.0° |

The retained limit is:

```txt
effectiveOrbLimit = min(orbPointNatal, transitBodyCap)
```

This is a conservative Lastro convention, not an empirical scientific standard.

These orbs are a versioned Lastro methodological convention, not a scientific truth.

Reference consequences:

- A full moon at 15° Taurus opposite natal Sun 14° Scorpio has `orb=1°`: natal Sun allows 2.0°, Moon cap is 1.5°, so `effectiveOrbLimit=1.5°`; retained.
- The same full moon opposite natal Sun 13.2° Scorpio has `orb=1.8°`: natal Sun allows 2.0°, Moon cap is 1.5°, so rejected.
- Transit Mars square natal Moon at `orb=1.1°` is retained; at `orb=1.4°` rejected because Mars cap is 1.2° even though natal Moon square allows 1.5°.
- Transit Jupiter trine natal Saturn at `orb=0.9°` is retained; at `orb=1.1°` rejected because Jupiter cap is 1.0°.
- Any contact to ASC at `orb=0.8°` is retained only if the angle is stable inside `timeMarginMinutes`; otherwise the contact is sensitive or insufficient for ranking.

Open validation questions:

- whether station contacts deserve a narrower exactness tier;
- whether exact conjunctions to reliable angles deserve a future exception above the transit cap;
- whether repeat contacts in retrograde cycles can upgrade `observe` to `very_personal` after fixture validation.

## Ranking Methodology Draft

Do not implement until fixtures are validated.

The ranking must remain neutral before context. It must not bake love or work priorities into the astronomical or transit engine. Love and work interpreters may later reweight planets and dimensions using their own documented RuleVersions.

`very_personal` requires a major, very tight contact with a personal natal point or reliable angle:

- contact inside 50 percent of the effective orb to Sun, Moon, Mercury, Venus, Mars, Jupiter/Saturn, or a reliable angle, with the natal point category and context recorded rather than interpreted;
- repeated contact in a retrograde cycle with at least one pass inside 60 percent of orb;
- contact involving the event's primary body and a natal luminary or reliable angle.

`observe` applies when:

- a retained contact exists but is not strong enough for `very_personal`;
- the contact is to Mercury, Jupiter, Saturn, or a personal planet with medium exactness;
- house placement exists but time margin makes it sensitive;
- a retrograde cycle repeats a contact but exactness remains moderate.

An ordinary Moon transit, outside a lunation or eclipse `eventCluster`, cannot rank above `observe`. The exception applies to new moons, full moons, and future eclipse events because the event is a collective sky event rather than a fast isolated Moon contact.

`general_context` applies when:

- no retained personal contact exists;
- only broad sky context exists;
- birth time makes angle/house-dependent claims insufficient.

Ranking inputs:

- orb;
- natal point category;
- aspect type;
- birth time reliability;
- stability inside `timeMarginMinutes`;
- repeated contact during a retrograde cycle;
- mirror-contact deduplication inside `eventCluster`.

Houses can enrich interpretation but must not, by themselves, raise an event to `very_personal` in V1. Example: an exact transit to natal Mercury with a stable house III can be described with a communication/domain nuance. A planet merely crossing house III must not become `very_personal` without a retained contact to a natal point.

For lunations, mirrored contacts inside the same `eventCluster` must be deduplicated for ranking. Example: full moon Moon at 15° Taurus and Sun at 15° Scorpio, natal Venus at 15° Taurus. Moon conjunct natal Venus and Sun opposite natal Venus are both mathematically true, but they are two faces of one full moon event and must not double the score.

The same `eventCluster` rule applies to new moons, full moons, and future eclipses. Raw contacts remain available for explicability; only `eventRelevance` is deduplicated.

For retrograde cycles, multiple passes over the same natal point must share one `cycleId` and distinct pass metadata. Lastro may later narrate "this same contact repeats three times in the cycle", but it must not confuse the passes or treat them as unrelated events.

Retrograde cycle metadata should include:

- `preShadowStartUtc`;
- `retrogradeStationUtc`;
- `directStationUtc`;
- `postShadowEndUtc`;
- station longitudes;
- dynamic pass count from calculation, not a hard-coded assumption that every cycle has three passes.

Station detection in V1 uses daily apparent longitude motion with bisection across sign changes of motion. This is acceptable for the first fixture-backed version, but precision must be exposed as `daily_motion_sign_change_bisection` and editorial copy must not imply sub-minute astronomical authority beyond that method.

## Editorial Automation

The monthly or nightly job should calculate a rolling factual calendar, for example six or twelve months ahead, then create or update `EditorialEvent` records.

Priority model:

- Priority A: almost always reviewed for an article. New moon, full moon, solar/lunar eclipse, Mercury retrograde start/end, Venus retrograde start/end, Mars retrograde, slow-planet sign ingress, solstice, equinox.
- Priority B: article only when editorial interest is high. Major conjunctions, important oppositions/squares, Jupiter/Saturn events, rare configurations.
- Priority C: daily sky context. Minor or frequent aspects appear in `/ciel/` or a monthly calendar but do not receive individual SEO pages.

Workflow states:

- `DETECTED`: factual event found;
- `PLANNED`: selected for potential editorial use;
- `DRAFT`: generated from validated facts;
- `VALIDATED`: factual validator accepted the draft;
- `SCHEDULED`: ready for future publication;
- `PUBLISHED`: page is live;
- `UPDATED`: time-sensitive wording refreshed;
- `ARCHIVED`: historical page remains useful.

A past page must not keep saying "the next full moon will occur..." years later. Historical facts stay fixed. Dynamic blocks such as "next full moon" are recalculated from the current event database.

Automation confidence:

- automatic: deterministic facts and validated templates;
- automatic plus human review: longer astrological articles;
- human mandatory: exceptional events, sensitive editorial pages, new methods, or unusual astronomical phenomena.

## SEO Policy

The engine may generate a factual monthly calendar, but only editorially selected events receive indexable pages.

`/ciel/` and factual monthly pages are allowed as deterministic calendar surfaces. Individual event pages require an `EditorialEvent` with an editorial status that explicitly permits publication. A non-editorial `CelestialEvent` must not become an indexable page by existing in the factual calendar.

Indexable event pages must contain:

- canonical URL;
- factual astronomy block;
- explicit "traditional astrological interpretation" label if interpretation exists;
- no deterministic prediction;
- `datePublished` and `dateModified`;
- Article or BlogPosting schema only after editorial validation;
- sitemap inclusion only when `editorialStatus = selected_for_page`.

Do not use Schema.org `Event` automatically for a full moon or retrograde station.

City pages are allowed only when place changes visibility, timing, altitude, or obscuration.

## Future PersonTransitResult Cache Policy

`PersonTransitResult` should be treated as a reproducible cached result, not a permanent historical record. It may be regenerated from:

- the normalized natal chart/input hash;
- the factual `CelestialEvent`;
- `methodVersion`;
- `ruleVersion`;
- `astronomyEngineVersion`;
- timezone database version when house or local-time context is involved.

Invalidation triggers:

- a modified birth chart, place, time precision, time margin, or corrected coordinates;
- a new transit orb or relevance `RuleVersion`;
- a new transit calculation engine version;
- an astronomy-engine or ephemeris version change;
- a timezone database change affecting UTC conversion or house context.

Do not add user batch generation or purge jobs until `PersonTransitResult` is actually used by "Votre ciel actuellement" or "Mes prochaines semaines".

## Reference Fixtures To Create

1. `new_moon_exact`: exact UTC new moon from a verified fixed reference; `SearchMoonPhase(0, ...)` returns the event, Sun/Moon longitudes, zodiac sign, and degree within tolerance.
2. `full_moon_exact_unique_event`: exact UTC full moon from a verified fixed reference; `SearchMoonPhase(180, ...)` returns one `CelestialEvent`, not two separate events for Sun and Moon.
3. `natal_contact_exact_zero`: a transit exactly on a natal point has `orb=0`, is retained, and receives maximum exactness before context weighting.
4. `natal_contact_inside_effective_orb`: contact just inside `effectiveOrbLimit` is accepted and records both `orbPointNatal` and `transitBodyCap`.
5. `natal_contact_outside_effective_orb`: contact just outside `effectiveOrbLimit` is rejected even when the natal point's raw orb would have allowed it.
6. `unknown_birth_time`: natal planets remain usable, but houses and angles are unavailable; no ASC/MC contact is emitted.
7. `approximate_birth_time_angle_unstable`: `timeMarginMinutes` makes angle/house unstable; angle contact is marked sensitive or insufficient and cannot alone raise ranking.
8. `station_retrograde_direct_pair`: verified UTC station references detect retrograde and direct changes with the same body and correct motion states.
9. `three_pass_retrograde_cycle`: one transit touches the same natal point direct, retrograde, direct; passes share one `cycleId` and have distinct `passNumber` values.
10. `full_moon_mirror_contact_deduplication`: full moon produces Moon conjunct natal point and Sun opposite same natal point; both facts can exist, but ranking has one event relevance and one deduplicated cluster.
11. `relationship_context_no_synastry_activation`: A receives an exact retained contact, B receives none. Love and work contexts may say A is individually concerned, but must not produce `RelationshipTransitActivation`.

Each fixture must store:

- input start/end dates;
- expected event type;
- expected bodies;
- verified UTC reference instant and tolerance;
- expected zodiac sign and degree tolerance;
- source function names;
- reference source identifier;
- result hash once implementation stabilizes.

Astronomical fixture dates must come from verified references and be frozen in UTC. Do not invent dates inside tests.

## External Reference Policy

Astronomy Engine remains the calculation source when sufficient.

IMCCE and NASA may be used for:

- documentation;
- editorial reference;
- independent control fixtures;
- eclipse cross-checking.

IMO is reserved for meteor showers.

No network dependency is allowed in production calculations unless a future method decision explicitly validates it.
