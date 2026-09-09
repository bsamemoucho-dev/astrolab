# Hellenistic Corpus Extraction Protocol

This protocol governs documentary extraction for the initial Hellenistic corpora used by Western Natal V1.

It is a documentation protocol only. It does not create production `RuleVersion` records and does not implement astrological calculation.

## Scope

Initial corpora:

- Vettius Valens;
- Dorotheus of Sidon;
- Ptolemy.

The corpora must remain separate. AstroLab must not create an averaged Hellenistic rule from the three corpora.

Extraction target: a first controlled inventory of passages relevant to Western Natal V1.

Priority topics:

- signs;
- houses or places;
- planetary positions;
- rulers;
- sect;
- planetary conditions;
- dignities;
- aspects or testimonies;
- angularity;
- lots;
- configurations;
- natal interpretation principles.

Out-of-scope topics for V1 must be identified as out of scope, not silently absorbed:

- temporal techniques;
- synastry;
- transits;
- electional material;
- horary material;
- other non-natal methods.

## Source Availability Status

Current repository status: three reference editions have been selected bibliographically and registered as `KnowledgeSource` records. Additional working digital sources and translation layers have been registered for limited passage-level extraction.

Registered reference editions:

- `ks-valens-pingree-1986`: David Pingree, `Vettii Valentis Antiocheni Anthologiarum libri novem`, B.G. Teubner, Leipzig, 1986.
- `ks-dorotheus-pingree-1976`: David Pingree, `Dorothei Sidonii Carmen astrologicum`, Teubner, 1976.
- `ks-ptolemy-hubner-1998`: Wolfgang Hübner, `Claudii Ptolemaei opera quae exstant omnia, III.1: ΑΠΟΤΕΛΕΣΜΑΤΙΚΑ`, Stuttgart-Leipzig, 1998.

Working sources now registered:

- Valens: Kroll 1908 Greek digital working text through Scaife ATLAS; Riley translation as dependent comparison layer.
- Dorotheus: Pingree Book I English translation through Skyscript OCR reproduction.
- Ptolemy: PAL digital text of Hübner 1998 without critical apparatus; Robbins translation as dependent comparison layer.

Access remains partial. Pingree 1986 for Valens is not locally accessible, Pingree 1976 full Dorotheus text/apparatus is not locally accessible, and Hübner's critical apparatus for Ptolemy is not accessible through the PAL working text.

## Extraction Rule

For every candidate passage, preserve separately:

- what is explicitly attested;
- what is translation;
- what is reconstruction;
- what is secondary interpretation;
- what is deduction;
- what remains unknown.

The number of sources repeating a claim is not evidence of truth by itself.

AstroLab must not infer:

- source count equals truth;
- primary source equals automatic truth;
- secondary source equals weak evidence;
- majority equals correct;
- minority equals weak;
- undocumented equals false.

## Required Claim Record

Every `DocumentaryClaim` must contain at minimum:

- `id`;
- `corpusId`;
- `work`;
- `book`;
- `section`;
- `passage`;
- `sourceIds`;
- `sourceText`;
- `sourceTextRightsStatus`;
- `translationUsed`;
- `exactReference`;
- `context`;
- `claim`;
- `claimType`;
- `methodologicalScope`;
- `documentaryStatus`;
- `evidenceLevel`;
- `primaryProximity`;
- `transmissionChainId`;
- `supportingClaimIds`;
- `contradictingClaimIds`;
- `knownDependencies`;
- `textualVariants`;
- `translationVariants`;
- `reconstruction`;
- `uncertainties`;
- `notes`;
- `status`.

## Classification Rules

### Explicit Attestation

Use only when the claim is directly tied to an identified passage in a selected edition or translation.

### Translation

A translation is not an independent source from the text it translates.

Multiple websites or summaries that reproduce the same translation must be represented as dependent sources in a `TransmissionChain`.

### Reconstruction

Use when the claim depends on incomplete, indirect, edited, or reconstructed evidence. The record must identify what is reconstructed and why.

### Secondary Interpretation

Use when a modern or later source interprets a primary passage. If the secondary source does not allow the primary passage to be found clearly, preserve that limitation.

### Deduction

Use when AstroLab infers a structured claim from documented material. The deduction must remain separate from the source text and must not become a production rule without validation.

### Unknown

Use when the repository does not contain enough information to classify the claim.

## Contradiction Handling

When two passages, translations, reconstructions, or secondary interpretations diverge:

- keep both claims;
- connect them through `contradictingClaimIds`;
- document the context;
- document the transmission chain;
- do not choose a winner automatically.

The same rule applies when a contradiction appears to come from translation.

## Corpus-Specific Rules

### Valens

- identify book and passage precisely;
- do not treat a rule as universal across the `Anthologies` because it appears once;
- record whether the passage is a rule, example, judgment, or technique-specific statement.

### Dorotheus

- identify every transmission layer;
- do not present a translated, Arabic-transmitted, or reconstructed passage as direct Greek text;
- keep natal material separate from other branches.

### Ptolemy

Separate:

- calculation;
- astronomical theory;
- astrological theory;
- interpretation;
- philosophical explanation.

Ptolemy must not become the default Hellenistic rule when Valens or Dorotheus differ.

## Claim Files

Claims are organized by corpus:

- [Valens claims](claims/valens.md)
- [Dorotheus claims](claims/dorotheus.md)
- [Ptolemy claims](claims/ptolemy.md)

If the claim inventory becomes large, split each corpus into one file per work/book while preserving stable claim ids.

## Current Extraction Result

- Valens: 4 verified documentary claims.
- Dorotheus: 4 verified documentary claims.
- Ptolemy: 5 verified documentary claims.

These are documentary claims only and are not `RuleVersion` records.

## Required Before First Real Extraction

1. Provide local access to Pingree 1986 for Valens and Pingree 1976 for Dorotheus, including apparatus where allowed.
2. Provide or approve additional translations, if needed for comparison layers.
3. Approve source text quotation policy.
4. Approve how Arabic, Greek, reconstructed, translated, and secondary layers are encoded.
5. Define additional `TransmissionChain` ids for secondary-source dependency chains.
6. Review the first claims before any candidate `RuleVersion` work.
