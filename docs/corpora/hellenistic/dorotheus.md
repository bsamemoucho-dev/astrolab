# Hellenistic Corpus Sheet: Dorotheus of Sidon

## Identity

- `corpusId`: `hellenistic-dorotheus`
- `school`: Hellenistic
- `author`: Dorotheus of Sidon
- `period`: 1st century CE
- `status`: `DOCUMENTING`
- `documentaryStatus`: `TRANSMISSION_UNCERTAIN`
- `productionRuleEligible`: false

This sheet documents a corpus. It does not validate any production calculation or interpretation rule.

## Works Concerned

Primary work to document:

- `Carmen Astrologicum`

Claim register:

- [Documentary claims: Dorotheus of Sidon](claims/dorotheus.md)

Extraction protocol:

- [Hellenistic Corpus Extraction Protocol](extraction-protocol.md)

Source register:

- [Hellenistic Knowledge Sources](sources.md)

Transmission chains:

- [Hellenistic Transmission Chains](transmission-chains.md)

Open scope questions:

- whether AstroLab treats the extant text as direct source, translated transmission, reconstruction, or mixed evidence;
- whether electional or other non-natal material is excluded from V1;
- how natal-relevant passages are separated from later transmission layers.

## Transmission State

Current repository status: reference edition selected; Book I English translation is available as a working layer. Full Arabic text, Greek/Latin fragments, reconstruction notes, and apparatus are not locally accessible. Transmission remains materially uncertain for extraction purposes.

Transmission items to document before rule extraction:

- state of the Greek original for the selected passages;
- intermediate translation or paraphrase layers;
- known later redactions or adaptations;
- passages where transmission uncertainty changes the rule;
- dependency between editions, translations, and later summaries.

The corpus starts as `TRANSMISSION_UNCERTAIN`; this must remain visible in every extracted claim unless a specific passage receives a different documented status.

## Reference Editions

Selected reference edition:

- `KnowledgeSource.id`: `ks-dorotheus-pingree-1976`
- David Pingree, `Dorothei Sidonii Carmen astrologicum`, Teubner, 1976.

Access status:

- bibliographic reference recorded;
- full text not available in the local project environment;
- transmission layers not verified locally;
- textual basis and reconstruction notes not verified locally;
- rights and reuse permissions not assessed;
- no passage verified.

## Translations Used

Selected working translation:

- `ks-dorotheus-pingree-book1-skyscript`

This translation is retained only as a dependent working layer. It is not an independent source, and it must not be presented as direct Greek text.

Any translation path must be documented explicitly. A rule must not be treated as direct Dorotheus evidence when it depends on later transmission without qualification.

## Primary Sources Available

Repository status: bibliographic reference selected; Book I English translation accessible; underlying Arabic/Greek/Latin source layers not locally accessible.

To be documented:

- selected text witness or edition;
- passage identifiers;
- language layer used;
- reconstruction status;
- certainty of attribution.

## Secondary Sources

Not selected.

Secondary sources may document context, transmission, and disagreement. They do not convert uncertain transmission into production certainty.

## Known Transmission Chain

Initial chain placeholder:

- `transmissionChainId`: `tc-hellenistic-dorotheus-main`
- `rootSourceId`: `ks-dorotheus-pingree-1976`
- `knownCopiesOrWitnesses`: not documented
- `translationPath`: not retained yet; Arabic, Greek, reconstructed, translated, and secondary layers must be encoded when sources are available
- `dependencyAssessment`: `unknown`
- `uncertainties`: full text, transmission layers, witness basis, passage readings, translations, and reconstructions are not available in the repository
- `status`: `DOCUMENTING`

Repeated claims depending on the same transmitted text must be represented as dependent, not independent.

## Potentially Exploitable Rule Areas

These are research targets only:

- natal significations and judgment patterns;
- planetary condition statements;
- house or place significations;
- aspect or testimony logic;
- Lots, if selected later;
- electional material, excluded from V1 unless explicitly reopened.

No item above is a production rule.

## Ambiguous Rule Areas

To resolve before production:

- whether a claim belongs to Dorotheus or to a later transmission layer;
- whether the relevant passage is natal, electional, or another branch;
- whether wording supports a rule, example, or contextual judgment;
- whether a modern reconstruction is being used;
- whether a claim contradicts Valens or Ptolemy.

## Variants

Variant tracking required:

- textual variants;
- translation variants;
- reconstruction variants;
- branch or technique variants;
- secondary-source disagreements about attribution or interpretation.

No variant is selected by default.

## Contradictions

No contradiction has been validated in this repository yet.

Contradictions to preserve when found:

- internal contradictions within the transmitted Dorotheus corpus;
- contradictions between Dorotheus and Valens;
- contradictions between Dorotheus and Ptolemy;
- contradictions between reconstructed and transmitted readings;
- contradictions between source text and secondary summaries.

## Documentation Level

Current level: insufficient for rule extraction.

Reasons:

- reference edition selected but full text not locally accessible;
- working translation selected for Book I only;
- transmission path not verified at passage level;
- initial passage inventory started;
- 4 `DocumentaryClaim` records;
- no `RuleVersion` records;
- no reference tests.

## Human Decisions Required

1. Provide local access to the selected reference edition or approved extracts.
2. Select translation(s), if any, for comparison.
3. Define how Greek, Arabic, translated, reconstructed, and secondary layers are encoded.
4. Define passage citation format.
5. Approve source text quotation limits.
6. Approve the extraction protocol for Dorotheus claims.
7. Decide whether `TRANSMISSION_UNCERTAIN` claims can enter laboratory experiments, and under what label.
8. Define the minimum status required before any Dorotheus claim can become a `RuleVersion`.
