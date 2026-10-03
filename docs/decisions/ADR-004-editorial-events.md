# ADR-004: EditorialEvent Separates SEO From CelestialEvent

- Date: 2026-10-03
- Version: `western-transits@1.0.0-draft`
- Status: accepted
- Reference: `docs/methods/western-transits.md`

## Context

Lastro needs useful public `/ciel/` pages without becoming an automatic low-quality article generator.

## Decision

`CelestialEvent` is factual sky data. `EditorialEvent` is the editorial workflow object that decides whether a fact can become an indexable page.

## Alternatives Rejected

- Creating a SEO page for every detected aspect.
- Letting a generated fact become indexable by default.
- Mixing editorial priority with personal transit relevance.

## Consequences

`/ciel/` and monthly pages can show deterministic calendars. Individual event pages require explicit editorial selection, canonical metadata, and sitemap inclusion policy.
