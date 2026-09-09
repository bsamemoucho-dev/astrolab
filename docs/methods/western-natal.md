# Method Sheet: Western Natal

## Identity

- `methodId`: `western-natal`
- `tradition`: Western astrology
- `family`: astrology
- `school`: Hellenistic
- `method`: natal chart analysis
- `type`: `natal`
- `initialScope`: one natal chart for one person
- `status`: `DOCUMENTATION_IN_PROGRESS`
- `productionEligible`: false
- `currentVersion`: `0.1.0-draft`
- `targetFirstProductionVersion`: `1.0.0`

## Product Decision

Western Natal is the first method selected for AstroLab.

Validated architecture decisions:

- Western architecture is multi-school;
- the first school is Hellenistic;
- the first method is Western Natal;
- initial scope is natal astrology only;
- V1 zodiac is tropical;
- V1 house system is Whole Sign;
- initial Hellenistic corpora are Vettius Valens, Dorotheus of Sidon, and Ptolemy;
- Valens, Dorotheus, and Ptolemy must remain separate documentation corpora;
- no rule from one corpus may be mixed silently with another.

Initial exclusions:

- no transits;
- no synastry;
- no profections;
- no solar returns;
- no directions;
- no progressions;
- no horary;
- no electional astrology;
- no AI-generated final interpretation.

The expected level is deep structured natal analysis, not a simple list of placements and generic meanings.

## Method Boundary

The method must preserve separate layers:

1. input data;
2. astronomical calculation;
3. astrological calculation;
4. structured traditional interpretation;
5. uncertainty and limits;
6. later transversal exploitation.

The module must not generate a user-facing AI narrative directly.

## Required Input Data

### Birth Date

Required fields:

- supplied date;
- normalized date;
- calendar used;
- date precision;
- source;
- confidence level;
- contradiction status.

Open decisions:

- whether V1 accepts non-Gregorian input directly or only normalized Gregorian dates;
- how approximate dates are represented for Western Natal V1.

### Birth Time

Required fields:

- supplied time;
- normalized local time;
- precision: `exact`, `approximate`, `interval`, `very_approximate`, `unknown`;
- source;
- confidence level;
- contradiction status.

Rules to validate:

- exact time can enable ascendant, houses, angles, and time-sensitive lunar position;
- unknown time must not be replaced by noon silently;
- interval time must produce stability/sensitivity assessment.

Open decisions:

- threshold for `approximate` versus `very_approximate`;
- whether a fallback chart without houses is allowed in production when time is unknown.

### Birth Place

Required fields:

- supplied place name;
- normalized city or locality;
- country;
- latitude;
- longitude;
- geocoding source;
- geocoding dataset version;
- confidence level.

Open decisions:

- approved geocoding dataset/provider;
- treatment of ambiguous or historical place names.

### Historical Timezone

Required fields:

- timezone identifier;
- UTC offset at birth instant;
- daylight saving rule, if applicable;
- timezone dataset version;
- source or dataset reference;
- confidence level.

Open decisions:

- approved timezone database;
- policy when historical timezone cannot be resolved.

### Calendar

Required fields:

- input calendar;
- normalized calculation calendar;
- calendar conversion version;
- date conversion parameters.

Open decisions:

- whether pre-modern dates are accepted in V1;
- proleptic Gregorian versus Julian conversion policy.

## Astronomical Parameters

Required fields:

- astronomical engine;
- engine version;
- ephemeris or dataset version;
- time scale handling;
- coordinate frame;
- zodiac reference;
- nutation/precession model, if used;
- topocentric/geocentric policy;
- calculation precision;
- fallback behavior.

Open decisions:

- astronomical engine/library;
- controlled ephemeris dataset;
- geocentric versus topocentric positions for supported bodies;
- apparent versus true positions;
- supported date range for V1.

## Astrological Conventions

The following conventions are product decisions for V1. They are not yet production `RuleVersion` records until sources, formulas, parameters, and reference tests are validated.

### Zodiac

V1 decision: tropical zodiac.

Required before production:

- source-backed definition;
- exact astronomical reference;
- rule version;
- reference tests;
- effect on every placement.

### Coordinate System

Possibilities to document:

- ecliptic longitude;
- celestial latitude, if retained;
- right ascension/declination, if needed for specific rules.

Current status: ecliptic longitude expected, exact calculation frame still requires astronomical-engine decision.

### Houses

V1 decision: Whole Sign.

The selected house system must record:

- rule definition;
- parameters;
- source;
- version;
- edge-case behavior;
- unsupported latitude behavior.

Whole Sign is selected as the V1 house architecture, but the exact operational rule still needs a `RuleVersion` and reference tests.

### Ascendant and Angles

Required structured outputs:

- ascendant;
- descendant;
- midheaven;
- imum coeli;
- angular precision;
- dependence on birth time and location.

Open decisions:

- exact calculation convention for MC/IC and house cusps;
- behavior when birth time is approximate or unknown.

### Planetary and Point List

Candidate categories:

- luminaries;
- classical planets;
- modern planets;
- lunar nodes;
- lots/parts;
- other points.

Current status: decision required.

No body, point, lot, or asteroid is production-active until explicitly selected and sourced.

### Signs

Required structured outputs:

- sign for each selected body or point;
- degree within sign;
- absolute longitude;
- calculation convention;
- source rule version.

### Aspects

Required structured outputs:

- aspect type;
- applying/separating status, if selected;
- orb;
- exactness;
- participating bodies;
- source rule version.

Open decisions:

- aspect set;
- orb rules;
- whether orb varies by body, aspect, school, or chart context;
- whether sign-based aspects are included.

## Calculation Rules

Rules must be represented as `RuleVersion` records before implementation.

Required rule groups:

- input normalization;
- time conversion;
- place normalization;
- astronomical position calculation;
- zodiac conversion;
- sign placement;
- house cusp calculation;
- house placement;
- angle calculation;
- aspect detection;
- dignity or condition calculations, if selected;
- interpretation eligibility;
- uncertainty and stability rules.

Current status: no calculation rule is validated for production.

## Interpretation Rules

Interpretation must be structured and source-linked.

Required outputs:

- interpretation unit id;
- layer: `traditionalInterpretation`;
- target: body, sign, house, aspect, angle, configuration, or condition;
- rule version;
- source ids;
- confidence/documentation level;
- limits;
- uncertainty impact.

Open decisions:

- exact extraction rules for Valens;
- exact extraction rules for Dorotheus;
- exact extraction rules for Ptolemy;
- whether any shared Hellenistic concept layer is allowed before corpus-level rules are validated;
- whether traditional dignity/condition rules are included in V1;
- how deep analysis is structured without collapsing into generic prose.

No interpretation rule is production-active until it has a source, version, and reference tests.

## Variants and Schools

Western Natal must not merge incompatible schools.

Variants to document before production choice:

- Hellenistic;
- medieval;
- Renaissance;
- modern traditional;
- modern psychological;
- other contemporary schools.

Current V1 decision:

- Western Natal V1 starts with the Hellenistic school boundary.

Remaining decision required:

- define how Hellenistic sub-corpora are represented without creating a false average rule.

## Hellenistic Corpus Protocol

Initial corpus sheets:

- [Vettius Valens](../corpora/hellenistic/valens.md)
- [Dorotheus of Sidon](../corpora/hellenistic/dorotheus.md)
- [Ptolemy](../corpora/hellenistic/ptolemy.md)

Corpus rules:

- Valens, Dorotheus, and Ptolemy remain separate corpora;
- a repeated claim is not automatically more true;
- a primary or near-primary source is not automatically true;
- dependent repetitions must be represented as a transmission chain;
- minority claims must not be discarded because they are minority claims;
- contradictions are retained as structured facts;
- absence of documentation is not refutation;
- suspected bias or intent cannot be represented as fact without evidence;
- every hypothesis must include counterexample and refutation tests.

Initial source status:

- Valens: `UNVERIFIED` pending edition/translation decision.
- Dorotheus: `TRANSMISSION_UNCERTAIN` pending edition/translation decision.
- Ptolemy: `UNVERIFIED` pending edition/translation decision.

## Structured Result Shape

Western Natal should produce data usable by the transversal engine.

Required top-level result sections:

- `chartContext`;
- `inputDataUsed`;
- `calculationParameters`;
- `astronomicalPositions`;
- `astrologicalPlacements`;
- `housesAndAngles`;
- `aspects`;
- `interpretationUnits`;
- `concepts`;
- `uncertainty`;
- `dataQuality`;
- `methodDependencies`;
- `limits`;
- `sources`;
- `reproducibilityFingerprint`.

### `chartContext`

Required fields:

- `personId`;
- `birthDate`;
- `birthTime`;
- `birthPlace`;
- `calendar`;
- `timezone`;
- `latitude`;
- `longitude`;
- `inputConfidence`;

### `astronomicalPositions`

Required fields per body/point:

- `id`;
- `body`;
- `longitude`;
- `latitude`, if available;
- `speed`, if available;
- `retrograde`, if selected;
- `calculationFrame`;
- `datasetVersion`;
- `precision`;

### `astrologicalPlacements`

Required fields per placement:

- `bodyOrPoint`;
- `sign`;
- `degreeInSign`;
- `absoluteLongitude`;
- `house`, if houses are available;
- `ruleVersionIds`;

### `housesAndAngles`

Required fields:

- `houseSystem`;
- `cusps`;
- `ascendant`;
- `midheaven`;
- `angles`;
- `unsupportedReason`, if houses cannot be calculated reliably.

### `aspects`

Required fields per aspect:

- `from`;
- `to`;
- `aspectType`;
- `orb`;
- `exactness`;
- `applyingOrSeparating`, if selected;
- `ruleVersionIds`;

### `interpretationUnits`

Required fields per unit:

- `id`;
- `targetType`;
- `targetIds`;
- `claim`;
- `traditionLayer`;
- `sourceIds`;
- `ruleVersionIds`;
- `documentationLevel`;
- `documentaryStatus`;
- `corpusId`;
- `transmissionChainId`;
- `contradictionIds`;
- `certaintyLevel`;
- `limits`;

### `concepts`

Required fields per concept:

- `id`;
- `name`;
- `definition`;
- `domain`;
- `temporality`;
- `polarity`, if applicable;
- `context`;
- `intensity`, if applicable;
- `originMethodId`;
- `sourceIds`;

## Uncertainty Handling

The method must explicitly classify:

- missing time;
- approximate time;
- interval time;
- ambiguous place;
- uncertain timezone;
- uncertain calendar conversion;
- contradictory sources;
- unsupported house calculation;
- unstable ascendant or house placements;
- unstable Moon or fast-moving point placement, if affected;
- unstable aspects near orb boundaries.

Required stability classes:

- `stable`;
- `relatively_stable`;
- `sensitive`;
- `indeterminate`.

Current implementation (development, not production): for interval birth times, the calculator resolves sign-boundary crossings of the Ascendant, the Midheaven and the seven traditional bodies inside the interval (`uncertainty.intervalAnalysis`). Each target is classified `stable` (no sign boundary crossed), `sensitive` (at least one crossing, with crossing instants and sign windows) or `indeterminate` (non-monotonic day-level angle behavior near polar latitudes). `relatively_stable` is not assigned until validated thresholds exist. The `ascendantSignWindows` capability returns the local-time spans of each Ascendant sign over the whole civil day, which is the factual tool for checking a claimed Ascendant sign against the birth time. Approximate birth time still reports no uncertainty margin.

For interval birth times, the method should eventually run compatible hypotheses and compare whether outputs change.

## Dependencies

Required dependency records:

- astronomical engine;
- ephemeris/reference dataset;
- timezone dataset;
- geocoding dataset;
- calendar conversion rules;
- zodiac convention;
- house system;
- aspect rules;
- interpretation corpus;
- corpus transmission chains;
- inter-corpus claim dependencies or contradictions;
- conceptual mapping layer, if used later.

The transversal engine must know that multiple Western Natal variants may not be independent if they share rules, datasets, or interpretive sources.

## Sources

No Western Natal methodological source has been validated as a production rule in this repository yet.

Initial Hellenistic corpora selected for documentation:

- Vettius Valens;
- Dorotheus of Sidon;
- Ptolemy.

These corpus selections define research scope. They do not activate calculation or interpretation rules.

Required before production:

- source for astronomical calculation convention;
- source for zodiac convention;
- source for house system;
- source for aspect rules;
- source for interpretation rules;
- source for any dignity, condition, or synthesis rule;
- source for reference test expected outputs;
- source for timezone and geocoding datasets.

Internal project documents used for architecture only:

- `ASTROLAB_Architecture_Connaissance_Versionnement_Reproductibilite.md`
- `ASTROLAB_Documentation_Methodologique_Astrologies (1).md`

These documents justify architecture and scope. They do not by themselves validate Western Natal calculation or interpretation rules.

## Documentation Level

Current level: insufficient for production.

Reason:

- method selected;
- required structures identified;
- no production rule versions;
- no validated corpus-specific rule versions;
- no reference dataset chosen;
- no expected numeric test results approved;
- no edition/translation choices approved.

Target level for production: all active rules linked to `KnowledgeSource`, `RuleVersion`, `ReferenceDataset`, and passing reference tests.

## Reference Test Plan

### Required Test Case Metadata

Each test case must include:

- `id`;
- `purpose`;
- `inputData`;
- `inputDataHash`;
- `methodVersionId`;
- `ruleVersionIds`;
- `referenceDatasetIds`;
- `expectedResult`;
- `expectedResultHash`;
- `sourceIds`;
- `tolerance`;
- `status`;

### Required Western Natal Test Groups

1. Exact modern birth data.
   - Purpose: baseline chart calculation.
   - Expected results: positions, signs, ascendant, houses, aspects.
   - Status: needs validated fixture.

2. Unknown birth time.
   - Purpose: verify no invented time.
   - Expected results: no ascendant/houses, explicit unavailable or partial result.
   - Status: needs policy decision.

3. Approximate birth time.
   - Purpose: classify sensitivity.
   - Expected results: stable/sensitive flags for ascendant, houses, Moon, and aspects.
   - Status: needs uncertainty thresholds.

4. Interval birth time.
   - Purpose: run compatible hypotheses.
   - Expected results: stability comparison across interval.
   - Status: sign-boundary resolution implemented in development (`uncertainty.intervalAnalysis`: stable/sensitive from crossing facts; indeterminate for non-monotonic polar behavior); `relatively_stable` assignment still needs validated uncertainty thresholds; reference fixture still needed.

5. Historical timezone.
   - Purpose: verify date-specific timezone handling.
   - Expected results: UTC instant and chart positions from historical offset.
   - Status: needs timezone dataset.

6. Calendar boundary.
   - Purpose: verify conversion and date handling.
   - Expected results: normalized date and calculation input.
   - Status: needs calendar policy.

7. Ambiguous location.
   - Purpose: avoid silent geocoding.
   - Expected results: unavailable or needs disambiguation.
   - Status: needs geocoding policy.

8. High-latitude or unsupported house case.
   - Purpose: verify house-system edge handling.
   - Expected results: explicit unsupported reason or documented fallback.
   - Status: depends on house system.

9. Aspect boundary.
   - Purpose: verify orb inclusions/exclusions.
   - Expected results: aspect appears or does not appear according to rule version.
   - Status: needs aspect/orb rules.

10. Regression fixture for `western-natal@1.0.0`.
    - Purpose: ensure old analysis reproducibility.
    - Expected results: exact structured output hash.
    - Status: created only after production validation.

## Expected Results

No numeric expected result is approved yet.

Expected result categories for future fixtures:

- normalized input;
- UTC instant;
- geocoded place;
- timezone resolution;
- planetary/body positions;
- sign placements;
- ascendant;
- house cusps;
- angle positions;
- house placements;
- aspects;
- interpretation units;
- uncertainty classification;
- reproducibility fingerprint;
- result hash.

## Limits

Western Natal must disclose limits when:

- birth time is missing or uncertain;
- place cannot be normalized;
- historical timezone is uncertain;
- selected house system is unsupported for the latitude;
- a rule belongs to an unvalidated school;
- interpretation sources are insufficient;
- a result changes materially under uncertainty testing;
- a calculation depends on an unavailable reference dataset.

The method must never present:

- medical diagnosis;
- psychological certainty;
- guaranteed event prediction;
- legal advice;
- financial advice;
- scientific proof of personality or destiny.

## Decisions Required Before Implementation

The following decisions require explicit product/methodology approval:

1. Editions and translations for Valens, Dorotheus, and Ptolemy.
2. Exact extraction protocol for claims from each corpus.
3. Supported bodies and points.
4. Aspect set.
5. Orb rules.
6. Dignity/condition rules, if any.
7. Rules for comparing Valens, Dorotheus, and Ptolemy without merging them.
8. Astronomical engine and ephemeris/reference dataset.
9. Geocoding dataset/provider.
10. Historical timezone dataset.
11. Calendar conversion policy.
12. Policy for unknown, approximate, and interval birth time.
13. Minimum documentary status for production activation.
14. First reference fixtures and expected outputs.
