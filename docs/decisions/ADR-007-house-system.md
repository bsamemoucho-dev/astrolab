# ADR-007: Whole Sign Houses for Natal and Transit Context

- Date: 2026-10-03
- Version: `western-natal@0.1.0-draft`, `western-transits@1.0.0-draft`
- Status: accepted
- Reference: `docs/methods/western-natal.md`, `docs/methods/western-transits.md`

## Context

Western Natal V1 already calculates houses with the Whole Sign system. Personal transits will later attach house context to natal points and transit contacts, so they must not introduce a second domification method.

## Decision

Lastro uses `Whole Sign Houses` for the current Western natal engine, future personalized transits, and future relationship analysis. The calculated metadata must expose `houseSystem: "WHOLE_SIGN"` whenever house data or house availability is relevant.

Operational rule:

- house I is the whole zodiac sign containing the Ascendant;
- each following sign corresponds to the following house;
- house cusps are sign boundaries at `0°` of each sign;
- house placement is available only when the Ascendant sign is exploitable.

Consistency rule:

- the same house system must be used everywhere in Lastro to avoid contradictory results between natal, transits, and future relationship analysis;
- no component may silently switch to Placidus, Equal House, Koch, or another system.

Unknown birth time:

- Ascendant, angles, houses, and sect are not calculated;
- no transit may invent a house placement.

Approximate birth time:

- the Ascendant sign is checked inside the declared time margin;
- if the Ascendant sign changes inside that margin, Whole Sign houses are not decidable;
- if the Ascendant sign stays stable, house context may be retained with uncertainty metadata.
- if house context is unstable inside `timeMarginMinutes`, mark the house as `UNCERTAIN` or `UNAVAILABLE` according to the data available; never present it as a stable fact.

## Alternatives Rejected

- Switching transits to Placidus, Koch, Equal House, or another system for convenience.
- Switching silently between house systems depending on product surface.
- Calculating a fallback house system when the birth time is unknown.
- Treating houses as stable when the Ascendant sign changes inside the declared margin.

## Consequences

Natal and transit features remain methodologically consistent. Transit house context can only be shown when the natal house system is available and reliable enough for the person's recorded time precision.

Any future change to the house system requires a new methodological decision and version. It must not retroactively rewrite older results without traceability of the method and version used at calculation time.
