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
- initial analysis type: natal only;
- V1 zodiac convention: tropical;
- V1 house system: Whole Sign;
- initial Hellenistic corpora: Vettius Valens, Dorotheus of Sidon, Ptolemy;
- the three initial corpora must remain separate;
- no transits;
- no synastry;
- no other traditions;
- no AI-generated interpretation text.

## Registry

| Method ID | Tradition Family | School | Method | Type | V1 Priority | Current Status | Production Eligible | Sheet |
|---|---|---|---|---|---:|---|---|---|
| `western-natal` | Western astrology | Hellenistic | Natal chart analysis | `natal` | 1 | `DOCUMENTATION_IN_PROGRESS` | No | [Western Natal](methods/western-natal.md) |
| `western-synastry` | Western astrology | To validate | Synastry | `relational` | Later | `RESEARCH_BACKLOG` | No | Not created |
| `western-transits` | Western astrology | To validate | Transits | `temporal` | Later | `RESEARCH_BACKLOG` | No | Not created |
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

The next decisions concern only `western-natal`:

- exact rule extraction protocol per corpus;
- editions and translations to use for each corpus;
- aspect set and orb rules;
- point and body list;
- astronomical engine and ephemeris dataset;
- timezone and geocoding datasets;
- how Valens, Dorotheus, and Ptolemy claims are compared without merging them;
- minimum documentary status needed before a claim can become a `RuleVersion`;
- reference test fixtures and expected outputs.

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
