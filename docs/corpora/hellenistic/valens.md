# Hellenistic Corpus Sheet: Vettius Valens

## Identity

- `corpusId`: `hellenistic-valens`
- `school`: Hellenistic
- `author`: Vettius Valens
- `period`: 2nd century CE
- `status`: `DOCUMENTING`
- `documentaryStatus`: `UNVERIFIED`
- `productionRuleEligible`: false

This sheet documents a corpus. It does not validate any production calculation or interpretation rule.

## Works Concerned

Primary work to document:

- `Anthologies` / `Anthologiae`

Claim register:

- [Documentary claims: Vettius Valens](claims/valens.md)

Extraction protocol:

- [Hellenistic Corpus Extraction Protocol](extraction-protocol.md)

Source register:

- [Hellenistic Knowledge Sources](sources.md)

Transmission chains:

- [Hellenistic Transmission Chains](transmission-chains.md)

Open scope questions:

- exact book divisions to include in V1;
- whether later excerpts, paraphrases, or scholia are included;
- how to identify and separate later editorial reconstruction from source claims.

## Transmission State

Current repository status: reference edition selected; Kroll 1908 Greek text is available as digital working text; Riley is available as dependent working translation. Pingree 1986 full text is not locally accessible.

Transmission items to document before rule extraction:

- manuscript witnesses used by the selected reference edition;
- known gaps, corruptions, interpolations, or disputed passages;
- translation path used for AstroLab;
- passages whose reading materially changes a rule;
- dependency between modern summaries, editions, and translations.

Documentary status for extracted Kroll/Riley claims is `DOCUMENTED`, but production eligibility remains false until checked against Pingree 1986 and reviewed.

## Reference Editions

Selected reference edition:

- `KnowledgeSource.id`: `ks-valens-pingree-1986`
- David Pingree, `Vettii Valentis Antiocheni Anthologiarum libri novem`, B.G. Teubner, Leipzig, 1986.

Access status:

- bibliographic reference recorded;
- full text not available in the local project environment;
- textual basis not verified locally;
- rights and reuse permissions not assessed;
- no passage verified.

## Translations Used

Selected working translation:

- `ks-valens-riley-skyscript`

This translation is retained only as a dependent working layer. It is not an independent source.

No translation-derived rule may become production-active until the translation is identified, versioned, and linked to the source passage.

## Primary Sources Available

Repository status: `ks-valens-kroll-1908-scaife` is available as Greek digital working text.

To be documented:

- selected Greek text or edition;
- passage identifiers;
- manuscript or edition basis;
- whether the text is direct, reconstructed, excerpted, or translated.

## Secondary Sources

Not selected.

Secondary sources may document context, scholarly disagreement, or transmission state. They must not collapse Valens into a generic Hellenistic rule.

## Known Transmission Chain

Initial chain placeholder:

- `transmissionChainId`: `tc-hellenistic-valens-main`
- `rootSourceId`: `ks-valens-pingree-1986`
- `knownCopiesOrWitnesses`: not documented
- `translationPath`: not selected
- `dependencyAssessment`: `unknown`
- `uncertainties`: full text, witness basis, passage readings, translations, and textual variants are not available in the repository
- `status`: `DOCUMENTING`

Repeated claims in dependent modern sources must attach to this or another explicit chain rather than counting as independent confirmation.

## Potentially Exploitable Rule Areas

These are research targets only:

- sign, house, and planetary condition statements;
- Lots and their interpretive use, if selected later;
- time-lord or period techniques, excluded from V1 unless explicitly reopened;
- configuration and aspect interpretation;
- chart condition and testimony synthesis;
- treatment of uncertainty or rectification, if present in selected passages.

No item above is a production rule.

## Ambiguous Rule Areas

To resolve before production:

- whether a passage states a deterministic rule, an example, or a contextual judgment;
- whether terminology maps cleanly to AstroLab concepts;
- whether a claim depends on a technique excluded from V1;
- whether later editorial grouping changes the apparent method;
- whether apparently repeated rules are independent or part of one transmission chain.

## Variants

Variant tracking required:

- textual variants;
- translation variants;
- school or technique variants inside the corpus;
- modern interpretive variants in secondary literature.

No variant is selected by default.

## Contradictions

No contradiction has been validated in this repository yet.

Contradictions to preserve when found:

- internal contradictions within Valens;
- contradictions between Valens and Dorotheus;
- contradictions between Valens and Ptolemy;
- contradictions between primary text and later secondary summary;
- contradictions caused by translation or reconstruction.

## Documentation Level

Current level: insufficient for rule extraction.

Reasons:

- reference edition selected but full text not locally accessible;
- working translation selected but dependent;
- initial passage inventory started;
- 4 `DocumentaryClaim` records;
- no `RuleVersion` records;
- no reference tests.

## Human Decisions Required

1. Provide local access to the selected reference edition or approved extracts.
2. Select translation(s), if any, for comparison.
3. Define passage citation format.
4. Approve source text quotation limits.
5. Approve the extraction protocol for Valens claims.
6. Decide whether Valens can supply V1 interpretation rules or only contextual documentation initially.
7. Define the minimum `documentaryStatus` required before a Valens claim can become a `RuleVersion`.
