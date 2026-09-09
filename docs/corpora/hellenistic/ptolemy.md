# Hellenistic Corpus Sheet: Ptolemy

## Identity

- `corpusId`: `hellenistic-ptolemy`
- `school`: Hellenistic
- `author`: Claudius Ptolemy
- `period`: 2nd century CE
- `status`: `DOCUMENTING`
- `documentaryStatus`: `UNVERIFIED`
- `productionRuleEligible`: false

This sheet documents a corpus. It does not validate any production calculation or interpretation rule.

## Works Concerned

Primary work to document:

- `Tetrabiblos`

Claim register:

- [Documentary claims: Ptolemy](claims/ptolemy.md)

Extraction protocol:

- [Hellenistic Corpus Extraction Protocol](extraction-protocol.md)

Source register:

- [Hellenistic Knowledge Sources](sources.md)

Transmission chains:

- [Hellenistic Transmission Chains](transmission-chains.md)

Potential contextual work:

- astronomical material may be documented separately only if it is needed to understand calculation conventions and if a source decision validates that use.

Open scope questions:

- whether only the `Tetrabiblos` is in scope for V1 interpretation;
- whether astronomical context is part of this corpus sheet or a separate `KnowledgeSource` group;
- how philosophical, physical, and interpretive arguments are separated from calculation rules.

## Transmission State

Current repository status: reference edition selected; PAL provides Hübner 1998 Greek text without critical apparatus; Robbins is available as dependent translation comparison.

Transmission items to document before rule extraction:

- manuscript or edition basis;
- translation path used by AstroLab;
- passages where terminology changes a rule;
- later commentary or scholastic interpretation dependencies;
- whether a secondary explanation depends directly on Ptolemy or on later reception.

Documentary status for extracted PAL/Robbins claims is `DOCUMENTED`, but production eligibility remains false until critical apparatus and method review are complete.

## Reference Editions

Selected reference edition:

- `KnowledgeSource.id`: `ks-ptolemy-hubner-1998`
- Wolfgang Hübner, `Claudii Ptolemaei opera quae exstant omnia, III.1: ΑΠΟΤΕΛΕΣΜΑΤΙΚΑ`, Stuttgart-Leipzig, 1998.

Access status:

- bibliographic reference recorded;
- full text not available in the local project environment;
- textual basis not verified locally;
- rights and reuse permissions not assessed;
- no passage verified.

## Translations Used

Selected comparison translation:

- `ks-ptolemy-robbins-lacuscurtius`

This translation is retained only as a dependent comparison layer. It is not an independent source.

No translation-derived rule may become production-active until the translation is identified, versioned, and linked to the source passage.

## Primary Sources Available

Repository status: `ks-ptolemy-pal-hubner-1998` is accessible as Greek digital working text without critical apparatus.

To be documented:

- selected Greek text or edition;
- passage identifiers;
- manuscript or edition basis;
- whether the text is direct, reconstructed, excerpted, or translated.

## Secondary Sources

Not selected.

Secondary sources may document context and disagreement. They must not make Ptolemy the default Hellenistic rule when Valens or Dorotheus differ.

## Known Transmission Chain

Initial chain placeholder:

- `transmissionChainId`: `tc-hellenistic-ptolemy-main`
- `rootSourceId`: `ks-ptolemy-hubner-1998`
- `knownCopiesOrWitnesses`: not documented
- `translationPath`: not selected
- `dependencyAssessment`: `unknown`
- `uncertainties`: full text, witness basis, passage readings, translations, and textual variants are not available in the repository
- `status`: `DOCUMENTING`

Repeated claims in dependent commentaries or summaries must attach to a chain rather than counting as independent confirmation.

## Potentially Exploitable Rule Areas

These are research targets only:

- zodiacal and astronomical conventions, if validated by source and calculation policy;
- planetary nature and condition statements;
- sign, house, and angular topics;
- aspect or configuration logic;
- temperament or qualitative synthesis, if later admitted by scope;
- methodological limits stated by the text.

No item above is a production rule.

## Ambiguous Rule Areas

To resolve before production:

- whether a passage is a calculation rule, interpretive principle, philosophical explanation, or later commentary construct;
- whether Ptolemy's framing is compatible with Valens or Dorotheus for a given claim;
- whether a rule depends on astronomical assumptions not selected for AstroLab V1;
- whether later reception is being mistaken for Ptolemy's own claim.

## Variants

Variant tracking required:

- textual variants;
- translation variants;
- commentary variants;
- later-school reinterpretations;
- disagreements between Ptolemy and other Hellenistic corpora.

No variant is selected by default.

## Contradictions

No contradiction has been validated in this repository yet.

Contradictions to preserve when found:

- internal contradictions within Ptolemy's relevant corpus;
- contradictions between Ptolemy and Valens;
- contradictions between Ptolemy and Dorotheus;
- contradictions between text, commentary, and secondary summaries;
- contradictions caused by translation choices.

## Documentation Level

Current level: insufficient for rule extraction.

Reasons:

- reference edition selected but full text not locally accessible;
- working translation selected but dependent;
- initial passage inventory started;
- 5 `DocumentaryClaim` records;
- no `RuleVersion` records;
- no reference tests.

## Human Decisions Required

1. Provide local access to the selected reference edition or approved extracts.
2. Select translation(s), if any, for comparison.
3. Decide whether astronomical context is documented inside this corpus or in separate calculation-source records.
4. Define passage citation format.
5. Approve source text quotation limits.
6. Approve the extraction protocol for Ptolemy claims.
7. Decide how Ptolemy claims are compared with Valens and Dorotheus without becoming the default average rule.
8. Define the minimum `documentaryStatus` required before a Ptolemy claim can become a `RuleVersion`.
