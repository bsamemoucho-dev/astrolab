# ADR-002: Western Transit Orbs V1

- Date: 2026-10-03
- Version: `western-transits-orbs@1.0.0-draft`
- Status: accepted
- Reference: `docs/methods/western-transits.md`

## Context

Transit contacts need narrower temporal thresholds than natal aspect structure. The natal orb convention must not be copied blindly.

## Decision

Use a Lastro-specific, versioned orb table keyed by natal point category, capped by transiting body. The effective limit is `min(orbPointNatal, transitBodyCap)`.

## Alternatives Rejected

- Reusing natal orbs automatically.
- Allowing broad slow-planet contacts to stay active for too long.
- Treating the table as a scientific fact rather than a product convention.

## Consequences

Every retained or rejected contact records `orbPointNatal`, `transitBodyCap`, `effectiveOrbLimit`, and `ruleVersion`. These orbs are a versioned Lastro methodological convention, not a scientific truth.
