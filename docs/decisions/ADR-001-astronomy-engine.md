# ADR-001: Astronomy Engine for Western Transits V1

- Date: 2026-10-03
- Version: `western-transits@1.0.0-draft`
- Status: accepted
- Reference: `docs/methods/western-transits.md`

## Context

Lastro needs deterministic sky events before adding personal transit contacts. The existing codebase already uses `astronomy-engine@2.1.19` for natal astronomical positions and has stored JPL comparison fixtures.

## Decision

Use Astronomy Engine as the internal calculation source for Western Transits V1 when its primitives are sufficient: lunar phases, stations via apparent-motion search, sign ingress, and planetary aspects.

## Alternatives Rejected

- Migrating immediately to Swiss Ephemeris.
- Calling remote IMCCE/NASA/JPL services during production calculations.
- Hand-implementing calculations that the library already provides or supports.

## Consequences

Calculations stay local, reproducible, and testable without network access. IMCCE/NASA/JPL/Astrodienst can be used as frozen reference data, documentation, and audit sources, but not as runtime dependencies.
