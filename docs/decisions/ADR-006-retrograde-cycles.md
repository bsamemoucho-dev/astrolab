# ADR-006: Retrograde Cycles and Passes

- Date: 2026-10-03
- Version: `western-transits@1.0.0-draft`
- Status: accepted
- Reference: `docs/methods/western-transits.md`

## Context

A retrograde cycle may touch the same natal point multiple times. These contacts must share identity without being collapsed into one date.

## Decision

Use `cycleId` for the cycle and distinct pass records with date, motion state, pass number, minimum orb, and exact instant when calculable. Cycle metadata also records station dates and shadow boundaries when known.

## Alternatives Rejected

- Assuming every cycle has exactly three passes.
- Treating repeated passes as unrelated events.
- Collapsing all passes into one undated contact.

## Consequences

The factual engine can explain repetition without implying interpretation. Any later narrative about recurrence must consume this metadata through a documented RuleVersion.
