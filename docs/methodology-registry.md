# AstroLab Methodology Registry

This registry tracks methods that AstroLab may document, test, and eventually activate. It is not a list of active production engines.

Production activation requires:

- an internal method sheet;
- versioned rules;
- versioned reference datasets;
- source traceability;
- reference tests;
- documented dependencies;
- explicit validation decision.

No method in this registry may use Internet access at runtime for production calculation or interpretation.

## Status Legend

- `RESEARCH_BACKLOG`: identified but not yet documented.
- `DOCUMENTATION_IN_PROGRESS`: method sheet being prepared.
- `LABORATORY`: documented enough for experiments only.
- `APPROVED_FOR_V1_DEVELOPMENT`: approved for product/method development, but not implemented, not validated, and not production eligible.
- `CANDIDATE_FOR_PRODUCTION`: ready for validation tests.
- `VALIDATED_FOR_PRODUCTION`: approved for production.
- `EXCLUDED_FROM_AUTOMATED_NATAL`: not eligible for automatic natal calculation.
- `DEPRECATED`: retained for old analyses only.

## V1 Scope Decision

Initial product scope:

- first tradition family: Western astrology;
- architecture: Western multi-school, with explicit school separation;
- first school: Hellenistic;
- first method: Western Natal;
- initial production analysis type: natal;
- V1 zodiac convention: tropical;
- V1 house system: Whole Sign;
- initial Hellenistic corpora: Vettius Valens, Dorotheus of Sidon, Ptolemy;
- the three initial corpora must remain separate;
- no other traditions;
- no AI-generated interpretation text for unvalidated methods.

Current roadmap clarification:

- the current production method remains the natal/public-reading pipeline;
- relational product work separates individual relational readings from two-person synastry;
- `individual_relational` is a future one-person vertical: "Moi en relation";
- `western-synastry` is now approved for V1 development as a future two-person relational method;
- approval for development does not mean implemented, validated, or production eligible;
- current relationship architecture reference: [Relationship Analysis Architecture V2](relationship-analysis-architecture-v2.md).
- `individual_relational.communication` is the first V1 axis under validation; its structured writer uses `gpt-4.1-mini` only for that axis after two controlled synthetic-fixture checks.

## Registry

| Method ID | Tradition Family | School | Method | Type | V1 Priority | Current Status | Production Eligible | Sheet |
|---|---|---|---|---|---:|---|---|---|
| `western-natal` | Western astrology | Hellenistic | Natal chart analysis | `natal` | 1 | `DOCUMENTATION_IN_PROGRESS` | No | [Western Natal](methods/western-natal.md) |
| `individual-relational` | Western astrology | To validate | Individual relational reading | `relational_individual` | 2 | `APPROVED_FOR_V1_DEVELOPMENT` | No | [Architecture V2](relationship-analysis-architecture-v2.md) |
| `western-synastry` | Western astrology | To validate | Synastry | `relational` | 3 | `APPROVED_FOR_V1_DEVELOPMENT` | No | [Architecture V2](relationship-analysis-architecture-v2.md) |
| `western-transits` | Western astrology | To validate | Transits | `temporal` | Later | `DOCUMENTATION_IN_PROGRESS` | No | [Western Transits](methods/western-transits.md) |
| `jyotisha-natal` | Jyotisha | To validate | Natal analysis | `natal` | Later | `RESEARCH_BACKLOG` | No | Not created |
| `jyotisha-dashas` | Jyotisha | To validate | Dashas | `temporal` | Later | `RESEARCH_BACKLOG` | No | Not created |
| `chinese-bazi` | Chinese calendrical/destiny systems | To validate | BaZi / Four Pillars | `natal` | Later | `RESEARCH_BACKLOG` | No | Not created |
| `maya-tzolkin` | Maya calendrical systems | Not applicable | Tzolk'in position | `calendar` | Later | `RESEARCH_BACKLOG` | No | Not created |
| `maya-haab` | Maya calendrical systems | Not applicable | Haab position | `calendar` | Later | `RESEARCH_BACKLOG` | No | Not created |
| `maya-calendar-round` | Maya calendrical systems | Not applicable | Calendar Round | `calendar` | Later | `RESEARCH_BACKLOG` | No | Not created |
| `maya-long-count` | Maya calendrical systems | Not applicable | Long Count | `calendar` | Later | `RESEARCH_BACKLOG` | No | Not created |
| `chinese-ziwei` | Chinese destiny systems | To validate | Zi Wei Dou Shu | `natal` | Later/lab | `RESEARCH_BACKLOG` | No | Not created |
| `babylonian-reconstruction` | Mesopotamian/Babylonian | Historical reconstruction | Documented reconstruction | `historical_reconstruction` | Later/lab | `RESEARCH_BACKLOG` | No | Not created |
| `persian-islamic-historical` | Persian/Islamic historical astrology | To validate | Historical methods | `historical_reconstruction` | Later/lab | `RESEARCH_BACKLOG` | No | Not created |
| `egyptian-historical` | Egyptian astral/calendar systems | Historical/cultural | Cultural or historical reconstruction | `historical_reconstruction` | Later | `RESEARCH_BACKLOG` | No | Not created |
| `onmyodo-cultural` | Japanese Onmyodo | Cultural/historical | Cultural documentation | `cultural` | V2 | `RESEARCH_BACKLOG` | No | Not created |
| `central-mexican-calendars` | Central Mexican calendrical systems | To validate | Tonalpohualli and related calendars | `calendar` | Later/lab | `RESEARCH_BACKLOG` | No | Not created |
| `ifa-cultural` | Yoruba Ifa | Divinatory/practitioner-led | Cultural documentation only | `divinatory` | Excluded from natal automation | `EXCLUDED_FROM_AUTOMATED_NATAL` | No | Not created |
| `tibetan-research` | Tibetan calendrical/astrological/divinatory systems | To validate | Research placeholder | `research` | Later | `RESEARCH_BACKLOG` | No | Not created |

## Production Gate

A method becomes `VALIDATED_FOR_PRODUCTION` only when:

- its sheet is complete;
- every active rule has a `RuleVersion`;
- every source has a `KnowledgeSource`;
- every external dataset is represented as a `ReferenceDataset`;
- dependencies are represented as `MethodDependency`;
- reference tests pass;
- uncertainty behavior is documented;
- a `KnowledgeChange` records the validation decision.

## Current Decision Queue

The next decisions for `western-natal` remain:

- exact rule extraction protocol per corpus;
- editions and translations to use for each corpus;
- aspect set and orb rules;
- point and body list;
- astronomical engine and ephemeris dataset;
- timezone and geocoding datasets;
- how Valens, Dorotheus, and Ptolemy claims are compared without merging them;
- minimum documentary status needed before a claim can become a `RuleVersion`;
- reference test fixtures and expected outputs.

Additional decisions for `individual-relational`:

- exact structure of "Moi en relation";
- exact structure of "Moi en amour";
- source facts and Lastro interpretation grid;
- public navigation and naming;
- mapping to the existing `scope` field or a future structure.

Additional decisions for `western-synastry` before implementation or validation:

- exact synastry orb values;
- official synastry `methodVersion`;
- treatment of time uncertainty in cross-chart facts;
- evidence shape for A↔B aspects;
- validation extension for crossed claims;
- product guardrails for the Amour lens;
- data minimization and third-party data policy before public production;
- whether and when angles, houses, and overlays can enter after external validation.

## Relational Scope Notes

The relational roadmap separates:

- `individual_relational`: one-person reading, "Moi en relation";
- `western-synastry`: two-person reading, "Nous";
- `temporal_relational`: future two-person + current-sky reading, deferred.

`relationshipType` answers "Who is this person to me?". A future `analysisLens`
concept answers "What do I want to explore?". `analysisLens` is not currently a
persisted model field.

Relationship context and analysis lens may influence editorial selection,
ordering, vocabulary, and interpretation. They must never change astronomical
positions, calculated aspects, or orbs.

## Hellenistic Corpus Separation

Initial Hellenistic corpus sheets:

- [Vettius Valens](corpora/hellenistic/valens.md)
- [Dorotheus of Sidon](corpora/hellenistic/dorotheus.md)
- [Ptolemy](corpora/hellenistic/ptolemy.md)

Rules:

- a claim repeated by multiple dependent witnesses is not automatically stronger;
- a claim in a primary or near-primary source is not automatically true;
- minority or isolated claims can remain important when well documented;
- contradictions must remain visible;
- Valens, Dorotheus, and Ptolemy must not be averaged into a generic Hellenistic rule.
