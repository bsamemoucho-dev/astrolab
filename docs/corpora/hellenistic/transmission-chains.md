# Hellenistic Transmission Chains

This register records transmission and dependency chains for the initial Hellenistic corpus work.

Transmission chains are not proof of truth. They document dependency, proximity, uncertainty, and access limits.

## Current Access Limit

The selected reference editions are recorded bibliographically, but their full texts are not available in the local project environment.

Because the texts are not locally accessible, manuscript witnesses, textual variants, and passage-level transmission details have not been verified.

## Chains

### `tc-hellenistic-valens-main`

- `id`: `tc-hellenistic-valens-main`
- `name`: Vettius Valens primary working chain
- `description`: Working chain for claims extracted from the selected Pingree 1986 reference edition of Valens.
- `sourceIds`: [`ks-valens-pingree-1986`, `ks-valens-kroll-1908-scaife`, `ks-valens-riley-skyscript`]
- `rootSourceId`: `ks-valens-pingree-1986`
- `knownCopiesOrWitnesses`: not verified locally
- `translationPath`: Kroll 1908 / Pingree 1986 -> Riley English translation
- `dependencyAssessment`: Riley depends on Kroll/Pingree; Kroll and Pingree are not counted as identical witnesses, and Kroll readings require Pingree comparison before production
- `uncertainties`: Pingree full text and critical apparatus are not locally accessible; Riley is preliminary and not perfected
- `status`: `DOCUMENTING`

### `tc-hellenistic-dorotheus-main`

- `id`: `tc-hellenistic-dorotheus-main`
- `name`: Dorotheus of Sidon primary working chain
- `description`: Working chain for claims extracted from the selected Pingree 1976 reference edition of Dorotheus.
- `sourceIds`: [`ks-dorotheus-pingree-1976`, `ks-dorotheus-pingree-book1-skyscript`]
- `rootSourceId`: `ks-dorotheus-pingree-1976`
- `knownCopiesOrWitnesses`: not verified locally
- `translationPath`: Pingree 1976 edition/translation -> Skyscript OCR reproduction of Book I
- `dependencyAssessment`: Skyscript Book I depends on Pingree and is not independent; Dorotheus claims remain transmission-sensitive
- `uncertainties`: full critical text, Arabic base text, Greek/Latin fragments, reconstruction notes, and apparatus are not locally accessible
- `status`: `DOCUMENTING`

### `tc-hellenistic-ptolemy-main`

- `id`: `tc-hellenistic-ptolemy-main`
- `name`: Ptolemy primary working chain
- `description`: Working chain for claims extracted from the selected Hübner 1998 reference edition of Ptolemy.
- `sourceIds`: [`ks-ptolemy-hubner-1998`, `ks-ptolemy-pal-hubner-1998`, `ks-ptolemy-robbins-lacuscurtius`]
- `rootSourceId`: `ks-ptolemy-hubner-1998`
- `knownCopiesOrWitnesses`: not verified locally
- `translationPath`: Hübner 1998 Greek text -> PAL digital text; Robbins English translation used only as comparison
- `dependencyAssessment`: Robbins is dependent on Greek text tradition and is not independent confirmation; PAL provides Hübner text without apparatus
- `uncertainties`: critical apparatus and witness basis are not locally accessible
- `status`: `DOCUMENTING`

## Dependency Rules

- A translation depends on the text or edition it translates and must not count as an independent source.
- Multiple reproductions of the same translation belong to the same dependency chain unless independence is documented.
- Secondary interpretation without a traceable primary passage remains limited to secondary interpretation.
- Contradictions between edition, translation, reconstruction, and interpretation must be preserved as separate claims once passage-level extraction begins.
