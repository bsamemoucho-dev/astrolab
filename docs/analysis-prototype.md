# Western Natal V1 analysis prototype

Status: development structure only. No `RuleVersion` is created or activated by this layer.

This layer consumes the already validated `western-natal` calculation artifact and organizes it for later methodological interpretation. It does not change astronomical positions, angles, houses, geocoding, time uncertainty handling, or the validated V1 conventions.

## Layers

1. Calculated facts: positions, signs, Whole Sign house placements when timed houses exist, angles when time precision allows them.
2. Important factors: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Ascendant and Midheaven when available.
3. Relations between factors: placements and planet-to-planet geometric angular distances.
4. Documented interpretation: unavailable until a documented, sourced and validated `RuleVersion` exists.
5. Synthesis: limited to calculated facts and structural relations; no final interpretive text is generated.

## Guardrails

- `FAIT` is represented by `calculatedFacts`.
- `REGLE` is represented by `detectionRule` or factor importance rule metadata.
- `INTERPRETATION` remains `not_interpreted_no_rule_version`.
- `SYNTHESE` remains `limited_to_established_calculated_facts`.
- Source counting is not used as a truth score.
- Geometric aspect candidates are not active aspects without an interpretive `RuleVersion`.
- Factor importance remains `importance non determinee selon la methode actuelle` until a validated methodological rule exists.

## Time uncertainty

When birth time is unknown or represented by an interval, the analysis preserves partial results and excludes timed factors that are not calculated. It does not invent an Ascendant, Midheaven, houses, sect or exact time.

When birth time is approximate, timed values may be computed from the supplied reference time, but they remain marked as sensitive to unbounded uncertainty.

When birth time is an interval, the analysis reports an `interval_time_output_stability` uncertainty item fed by the sign-boundary resolution stored in `uncertainty.intervalAnalysis`: each timed target (Ascendant, Midheaven and the seven traditional bodies) is `stable` when no sign boundary is crossed inside the interval or `sensitive` when crossings exist, and sensitive targets carry their crossing instants and sign windows. This stays at the calculated-fact layer: it classifies whether placements change, not what the change means. `ascendantSignWindows` provides the same crossing engine as a day-level calculated fact for checking a claimed Ascendant sign against a reported birth time.

## Missing rule families

The following remain deliberately inactive:

- factor dominance or hierarchy;
- interpretive meaning of signs, houses and planets;
- rulers and derived interpretive chains;
- aspect validity, orbs and interpretation;
- dignities, conditions and lots;
- final synthesis rules.
