# Documentary Claims: Ptolemy

## Corpus

- `corpusId`: `hellenistic-ptolemy`
- `corpusSheet`: [Ptolemy](../ptolemy.md)
- `extractionProtocol`: [Hellenistic Corpus Extraction Protocol](../extraction-protocol.md)
- `currentClaimCount`: 5

## Source Status

Reference edition:

- `ks-ptolemy-hubner-1998`

Working Greek text:

- `ks-ptolemy-pal-hubner-1998`

Translation comparison:

- `ks-ptolemy-robbins-lacuscurtius`

Access limit: PAL provides Hübner's Greek text without critical apparatus. Robbins is a translation comparison layer and not independent confirmation.

## Claims

### `dc-ptolemy-001-twofold-astral-inquiry`

```yaml
id: dc-ptolemy-001-twofold-astral-inquiry
corpusId: hellenistic-ptolemy
work: Tetrabiblos / Apotelesmatika
book: 1
section: 1
passage: I.1
sourceIds: [ks-ptolemy-pal-hubner-1998, ks-ptolemy-robbins-lacuscurtius]
sourceText: not reproduced; Greek text accessible through PAL Hübner text
sourceTextRightsStatus: PAL access; not quoted here
translationUsed: Frank E. Robbins, comparison translation only
exactReference: Ptolemy, Tetrabiblos I.1
context: proem defining the two main parts of astral inquiry
claim: Ptolemy distinguishes the determination of celestial configurations from the inquiry into effects resulting from those configurations.
claimType: definition
methodologicalScope: calculation layer versus interpretation layer; method architecture
documentaryStatus: DOCUMENTED
evidenceLevel: B
primaryProximity: near_primary
transmissionChainId: tc-hellenistic-ptolemy-main
supportingClaimIds: []
contradictingClaimIds: []
knownDependencies: [ks-ptolemy-robbins-lacuscurtius depends on Greek text tradition]
textualVariants: critical apparatus not available in PAL text
translationVariants: Robbins only checked as comparison layer
reconstruction: none recorded
uncertainties: exact wording should be checked against Hübner print apparatus for production documentation
notes: This supports AstroLab's architecture separation, not an astrological rule.
status: DOCUMENTING
```

### `dc-ptolemy-002-benefic-malefic-classification`

```yaml
id: dc-ptolemy-002-benefic-malefic-classification
corpusId: hellenistic-ptolemy
work: Tetrabiblos / Apotelesmatika
book: 1
section: 5
passage: I.5
sourceIds: [ks-ptolemy-pal-hubner-1998, ks-ptolemy-robbins-lacuscurtius]
sourceText: not reproduced; Greek text accessible through PAL Hübner text
sourceTextRightsStatus: PAL access; not quoted here
translationUsed: Frank E. Robbins, comparison translation only
exactReference: Ptolemy, Tetrabiblos I.5
context: chapter on benefic and malefic planets
claim: Ptolemy classifies Jupiter, Venus, and the Moon as benefic because of temperate/hot-moist qualities, Saturn and Mars as contrary/destructive, and the Sun and Mercury as common or variable by association.
claimType: classification
methodologicalScope: planetary condition/classification; seven traditional planets
documentaryStatus: DOCUMENTED
evidenceLevel: B
primaryProximity: near_primary
transmissionChainId: tc-hellenistic-ptolemy-main
supportingClaimIds: []
contradictingClaimIds: []
knownDependencies: [ks-ptolemy-robbins-lacuscurtius depends on Greek text tradition]
textualVariants: critical apparatus not available in PAL text
translationVariants: Robbins only checked as comparison layer
reconstruction: none recorded
uncertainties: must not be assumed identical to Valens or Dorotheus classifications without separate comparison
notes: Potential later RuleVersion candidate only after validation.
status: DOCUMENTING
```

### `dc-ptolemy-003-sect-classification`

```yaml
id: dc-ptolemy-003-sect-classification
corpusId: hellenistic-ptolemy
work: Tetrabiblos / Apotelesmatika
book: 1
section: 7
passage: I.7
sourceIds: [ks-ptolemy-pal-hubner-1998, ks-ptolemy-robbins-lacuscurtius]
sourceText: not reproduced; Greek text accessible through PAL Hübner text
sourceTextRightsStatus: PAL access; not quoted here
translationUsed: Frank E. Robbins, comparison translation only
exactReference: Ptolemy, Tetrabiblos I.7
context: chapter on diurnal and nocturnal planets
claim: Ptolemy assigns the Moon and Venus to the nocturnal sect, the Sun and Jupiter to the diurnal sect, Mercury variably by morning/evening condition, Saturn to the day, and Mars to the night.
claimType: classification
methodologicalScope: sect; seven traditional planets; planetary condition
documentaryStatus: DOCUMENTED
evidenceLevel: B
primaryProximity: near_primary
transmissionChainId: tc-hellenistic-ptolemy-main
supportingClaimIds: []
contradictingClaimIds: []
knownDependencies: [ks-ptolemy-robbins-lacuscurtius depends on Greek text tradition]
textualVariants: critical apparatus not available in PAL text
translationVariants: Robbins only checked as comparison layer
reconstruction: none recorded
uncertainties: comparison with Valens and Dorotheus requires exact scope alignment
notes: Similarity with Valens does not create a shared production rule.
status: DOCUMENTING
```

### `dc-ptolemy-004-tropical-zodiac-anchor`

```yaml
id: dc-ptolemy-004-tropical-zodiac-anchor
corpusId: hellenistic-ptolemy
work: Tetrabiblos / Apotelesmatika
book: 1
section: 10
passage: I.10
sourceIds: [ks-ptolemy-pal-hubner-1998, ks-ptolemy-robbins-lacuscurtius]
sourceText: not reproduced; Greek text accessible through PAL Hübner text
sourceTextRightsStatus: PAL access; not quoted here
translationUsed: Frank E. Robbins, comparison translation only
exactReference: Ptolemy, Tetrabiblos I.10
context: seasonal qualities and zodiacal starting point
claim: Ptolemy states that the zodiacal circle has no natural beginning as a circle and sets Aries from the vernal equinox as the beginning.
claimType: definition
methodologicalScope: zodiac convention; tropical zodiac; Western Natal V1 convention context
documentaryStatus: DOCUMENTED
evidenceLevel: B
primaryProximity: near_primary
transmissionChainId: tc-hellenistic-ptolemy-main
supportingClaimIds: []
contradictingClaimIds: []
knownDependencies: [ks-ptolemy-robbins-lacuscurtius depends on Greek text tradition]
textualVariants: critical apparatus not available in PAL text
translationVariants: Robbins only checked as comparison layer
reconstruction: none recorded
uncertainties: this documents Ptolemy's definition; it does not by itself validate AstroLab's numerical zodiac implementation
notes: Potentially relevant to the already validated V1 tropical-zodiac decision, but still not a RuleVersion.
status: DOCUMENTING
```

### `dc-ptolemy-005-planetary-domiciles`

```yaml
id: dc-ptolemy-005-planetary-domiciles
corpusId: hellenistic-ptolemy
work: Tetrabiblos / Apotelesmatika
book: 1
section: 18
passage: I.18
sourceIds: [ks-ptolemy-pal-hubner-1998, ks-ptolemy-robbins-lacuscurtius]
sourceText: not reproduced; Greek text accessible through PAL Hübner text
sourceTextRightsStatus: PAL access; not quoted here
translationUsed: Frank E. Robbins, comparison translation only
exactReference: Ptolemy, Tetrabiblos I.18
context: chapter on planetary houses/domiciles
claim: Ptolemy describes planetary familiarity with zodiacal parts through houses, triplicities, exaltations, terms, and related schemes, beginning domicile allocation with Leo for the Sun and Cancer for the Moon.
claimType: classification
methodologicalScope: sign rulership; planetary domiciles; dignities
documentaryStatus: DOCUMENTED
evidenceLevel: B
primaryProximity: near_primary
transmissionChainId: tc-hellenistic-ptolemy-main
supportingClaimIds: []
contradictingClaimIds: []
knownDependencies: [ks-ptolemy-robbins-lacuscurtius depends on Greek text tradition]
textualVariants: critical apparatus not available in PAL text
translationVariants: Robbins only checked as comparison layer
reconstruction: none recorded
uncertainties: full domicile allocation passage should be checked before complete rule formulation
notes: Similar to Dorotheus I.1 in topic, but remains a separate Ptolemy claim.
status: DOCUMENTING
```
