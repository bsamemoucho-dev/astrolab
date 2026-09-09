# Engine Contracts

## Separation of Layers

The product must preserve four separate outputs:

1. `calculation`: what a method computes.
2. `traditionalInterpretation`: what the documented tradition associates with that result.
3. `transversalSynthesis`: what AstroLab compares across method results.
4. `aiNarrative`: user-facing wording generated from approved structured data.

These fields must not be collapsed into one paragraph.

## Method Module Contract

Every method module should expose:

```ts
interface MethodModule {
  methodId: string;
  methodVersion: string;
  status: MethodStatus;
  requiredData: RequiredDataSpec;
  sources: SourceRef[];
  canRun(input: AnalysisInput): ApplicabilityResult;
  calculate(input: AnalysisInput): Promise<MethodResult>;
}
```

If a method is not sufficiently documented, its module should return `not_implemented` or `documentation_insufficient`; it must not fabricate a placeholder calculation.

## Method Result Contract

```ts
interface MethodResult {
  methodId: string;
  methodVersion: string;
  personId: string;
  dataUsed: DataUse[];
  parameters: Record<string, unknown>;
  rawResult: Record<string, unknown>;
  period?: TemporalPeriod;
  concepts: ConceptRef[];
  traditionalInterpretations: InterpretationRef[];
  dataQuality: DataQuality;
  uncertainty: UncertaintyAssessment;
  sources: SourceRef[];
  status: MethodResultStatus;
  error?: MethodError;
}
```

## Transversal Finding Contract

```ts
interface TransversalFinding {
  type: "convergence" | "complementarity" | "divergence" | "indeterminate";
  dimensions: FindingDimension[];
  contributingResultIds: string[];
  evidence: EvidenceItem[];
  dependencyAssessment: DependencyAssessment;
  stability: StabilityClass;
  limits: string[];
  status: "production" | "laboratory" | "experimental";
}
```

The transversal engine must not treat method count as a vote. It must evaluate dependency, comparability, source quality, stability, and specificity.

The current V1 implementation has an initial transversal engine that returns `indeterminate` until at least two successful structured method results and a validated comparison rule are available.

## Western Natal V1 Development Calculator

Status: laboratory only, not production eligible.

The first executable block is `western-natal@0.1.0-draft`. It calculates deterministic structured natal data for:

- tropical zodiac;
- Whole Sign houses;
- seven traditional planets;
- Ascendant, Descendant, Midheaven and IC;
- chart sect as a calculated structural field;
- aspect geometry candidates without active orb rules;
- inactive placeholders for dignities, planetary conditions and lots.

No `RuleVersion` is created or activated by this calculator. It does not generate user interpretation text and it does not merge Valens, Dorotheus and Ptolemy into a common rule.

The astronomy layer uses `astronomy-engine@2.1.19`, locked in `package.json` and `package-lock.json`.

Engine details:

- library: `astronomy-engine`;
- version: `2.1.19`;
- license: MIT;
- runtime dependency mode: local npm package, no Internet during user calculation;
- ephemerides: built-in Astronomy Engine solar system algorithms;
- coordinate system recorded in outputs: `geocentric_apparent_true_ecliptic_of_date`;
- time input: local civil time resolved through IANA time zone data, then UTC `Date`, Julian Day, and Astronomy Engine time handling;
- zodiac conversion: tropical 0-360 degree longitude from the apparent ecliptic of date, mapped to 30-degree signs starting at Aries 0°;
- current validation tolerance against stored JPL Horizons fixtures: <= 0.01° longitude and <= 0.02° latitude for the V1 tested cases.

The previous internal development engine `astrolab-dev-astronomy@0.1.0` / `low-precision-analytic-formulas@0.1.0-dev` is not used for calculation and must not be promoted to production.

The calculator accepts exact, approximate, interval and unknown birth time states. Missing or uncertain time is not treated as a system error.

When the time is unknown, the calculator must not invent an hour. It calculates only date-level structures that can be represented without an exact time window, and explicitly leaves Ascendant, Descendant, Midheaven, IC, houses and sect uncalculated.

When the time is approximate, timed outputs are produced but marked as approximate. When the time is an interval, start and end instants are preserved and the output is prepared for stable-vs-variable analysis without collapsing the interval into a single exact chart.

For interval birth times, the calculator additionally resolves every sign-boundary crossing of the Ascendant, the Midheaven and the seven traditional bodies that falls inside the interval (bracketed on a deterministic UTC grid, refined by bisection to sub-millisecond, reported to the nearest local second). This analysis is attached as `uncertainty.intervalAnalysis` (`astrolab.western_natal.interval_stability_analysis`): each timed target is classified `stable` when no sign boundary is crossed inside the interval, `sensitive` when at least one crossing occurs (with the crossing instants and the sign windows inside the interval), or `indeterminate` when the day-level angle behavior is not monotonic (stall or oscillation near or above polar latitudes). Whole Sign house placements rotate at every Ascendant crossing; no exact chart is invented. The class `relatively_stable` is not assigned until thresholds are validated.

The same crossing engine exposes `ascendantSignWindows` (`astrolab.western_natal.ascendant_sign_windows`): for a given civil date, time zone and place it returns the local-time spans during which the Ascendant occupies each sign over the whole civil day. These are calculated facts with no astrological interpretation, and provide the factual basis for checking a claimed Ascendant against the birth time (a claimed Ascendant sign must contain the reported birth time). Near or above polar circles, where the Ascendant can stall or oscillate at a boundary, the function returns `indeterminate_latitude_behavior` instead of inventing windows.

Each calculation run preserves:

- original user-linked person id;
- normalized birth date, time precision, exact time if available, interval bounds if available, place label, latitude, longitude and IANA time zone;
- resolved place record, including selected name, timezone rule status, resolution source, confidence and normalized calculation data;
- calendar, zodiac, house system and coordinate system;
- coordinate source and coordinate confidence;
- method id and method version;
- astronomy engine and ephemeris version;
- UTC instant and Julian day;
- UTC range and Julian day range when the time is unknown or interval-based;
- input data hash;
- structured result hash;
- calculation timestamp;
- normalized input artifact;
- structured result artifact.

The structured result separates:

- `astronomicalCalculation`: body positions and angles;
- `structuralAstrology`: signs, Whole Sign houses, sect, aspect infrastructure, inactive conditions and inactive lots;
- `traditionalInterpretation`: explicitly `not_generated`;
- `uncertainty`: time precision, coordinate confidence and warnings.

Reference datasets currently present:

- `tests/referenceEphemeris.test.mjs` stores NASA/JPL Horizons observer ephemeris fixtures for Sun, Moon, Mercury, Venus, Mars, Jupiter and Saturn on three UTC dates.
- Fixture source settings: `CENTER=500@399`, observer geocentric; `QUANTITIES=31`, `ObsEcLon` / `ObsEcLat`; apparent observer-centered ecliptic longitude and latitude.

Reference datasets still required before production:

- timezone and historical civil-time fixtures;
- edge cases near sign boundaries;
- high-latitude angle fixtures;
- Whole Sign house fixtures;
- regression hashes for normalized inputs and structured outputs.

## Stability Contract

Uncertain data can produce multiple compatible hypotheses. A result is classified as:

- `stable`: unchanged across compatible hypotheses.
- `relatively_stable`: materially similar across hypotheses.
- `sensitive`: changes materially when uncertain inputs vary.
- `indeterminate`: cannot be classified with available data.

## AI Report Guardrail Contract

Before display, generated text must be checked for:

- invented data;
- invented sources;
- excessive certainty;
- missing uncertainty;
- ignored contradiction;
- confusion between tradition and calculation;
- confusion between hypothesis and conclusion;
- claims unsupported by structured findings.

If validation fails, regenerate or replace with a safer deterministic formulation.

The current V1 report engine only emits deterministic sections and records `aiGenerated: false`. Reports stay `blocked` while method results and transversal findings are unavailable or indeterminate.
