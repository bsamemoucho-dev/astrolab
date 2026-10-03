# ADR-005: Lunar Event Contact Deduplication

- Date: 2026-10-03
- Version: `western-transits@1.0.0-draft`
- Status: accepted
- Reference: `docs/methods/western-transits.md`

## Context

Lunations can create mirrored contacts: for example Moon conjunct a natal point and Sun opposite the same point during one full moon.

## Decision

Keep raw contacts factually intact, but deduplicate mirrored contacts inside `eventRelevance` using `eventCluster`.

## Alternatives Rejected

- Deleting a true astronomical contact.
- Double-counting a single lunation in relevance.
- Treating new moon/full moon as two independent personal events.

## Consequences

`rawContacts` remains explainable. `eventRelevance` carries the ranking-safe view and records deduplicated contact ids.
