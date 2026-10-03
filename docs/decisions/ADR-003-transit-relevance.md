# ADR-003: Transit Relevance Is Not Interpretation

- Date: 2026-10-03
- Version: `western-transits-ranking@1.0.0-draft`
- Status: accepted
- Reference: `docs/methods/western-transits.md`

## Context

The engine must distinguish factual contacts from user-facing interpretation. A transit can be exact without justifying a deterministic prediction.

## Decision

Classify personal relevance only as `very_personal`, `observe`, or `general_context`. Do not use "collective" as a personal score. Do not encode love/work meaning in the generic relevance engine.

## Alternatives Rejected

- Producing a numeric strength score.
- Treating editorial importance as personal importance.
- Encoding "applying = more intense" in calculation.

## Consequences

`TransitContact` can carry factual phase information, but interpretation layers decide later whether and how that matters. Love and work require their own future RuleVersions.
