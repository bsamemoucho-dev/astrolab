# Plan APRÈS — moteur de composition (thèse, idées, relations, mémoire)

Plan : `full-dossier-plan@0.2.0` · moteur `composition` · aspects `reference`
Blocs narratifs au total : 13

## Thèse du dossier

> Le thème est organisé par une figure calculée : le Soleil oppose la Lune ; Jupiter est en trigone avec le Soleil et en sextile avec la Lune. C'est elle qui donne au dossier son fil conducteur.

Propriétaire : `general_synthesis`

## Figures calculées

- **apex_on_opposition** (harmonic) — le Soleil oppose la Lune ; Jupiter est en trigone avec le Soleil et en sextile avec la Lune
  - membres : Soleil–Lune opposition 4.985194°, Soleil–Jupiter trigone 6.07925°, Lune–Jupiter sextile 1.094056°
  - plus serré : aspect.moon.jupiter.sextile
  - convention : `lastro.figure.apex_on_opposition@1`

## Croisements autorisés

- `relation.figure.apex.jupiter.moon.sun.aspect.moon.jupiter.sextile.aspect.sun.jupiter.trine` — lastro.composition.figure_third_term@1
  - Les trois configurations forment une figure calculée : le Soleil oppose la Lune ; Jupiter est en trigone avec le Soleil et en sextile avec la Lune. Membres : Soleil–Lune opposition (orbe 4.985194°), Soleil–Jupiter trigone (orbe 6.07925°), Lune–Jupiter sextile (orbe 1.094056°). Le lien le plus serré est Lune–Jupiter (orbe 1.094056°).
- `relation.figure.apex.jupiter.moon.sun.aspect.moon.jupiter.sextile.aspect.sun.moon.opposition` — lastro.composition.figure_third_term@1
  - Les trois configurations forment une figure calculée : le Soleil oppose la Lune ; Jupiter est en trigone avec le Soleil et en sextile avec la Lune. Membres : Soleil–Lune opposition (orbe 4.985194°), Soleil–Jupiter trigone (orbe 6.07925°), Lune–Jupiter sextile (orbe 1.094056°). Le lien le plus serré est Lune–Jupiter (orbe 1.094056°).
- `relation.figure.apex.jupiter.moon.sun.aspect.sun.moon.opposition.aspect.sun.jupiter.trine` — lastro.composition.figure_third_term@1
  - Les trois configurations forment une figure calculée : le Soleil oppose la Lune ; Jupiter est en trigone avec le Soleil et en sextile avec la Lune. Membres : Soleil–Lune opposition (orbe 4.985194°), Soleil–Jupiter trigone (orbe 6.07925°), Lune–Jupiter sextile (orbe 1.094056°). Le lien le plus serré est Lune–Jupiter (orbe 1.094056°).

## Croisements refusés (réponse explicite)

- aspect.moon.jupiter.sextile × aspect.mars.saturn.opposition → Aucune relation astrologique directe suffisamment étayée pour ce croisement.
- aspect.moon.jupiter.sextile × aspect.mercury.venus.sextile → Aucune relation astrologique directe suffisamment étayée pour ce croisement.
- aspect.mars.saturn.opposition × aspect.mercury.venus.sextile → Aucune relation astrologique directe suffisamment étayée pour ce croisement.
- aspect.mars.saturn.opposition × aspect.sun.moon.opposition → Aucune relation astrologique directe suffisamment étayée pour ce croisement.
- aspect.mars.saturn.opposition × aspect.sun.jupiter.trine → Aucune relation astrologique directe suffisamment étayée pour ce croisement.
- aspect.mercury.venus.sextile × aspect.sun.moon.opposition → Aucune relation astrologique directe suffisamment étayée pour ce croisement.
- aspect.mercury.venus.sextile × aspect.sun.jupiter.trine → Aucune relation astrologique directe suffisamment étayée pour ce croisement.

## Idées et propriétaires (mémoire)

| Idée | Type | Propriétaire |
|---|---|---|
| thèse du dossier | thesis | `general_synthesis` |
| Moon–Jupiter sextile | configuration | `supporting_resources` |
| Mars–Saturn opposition | configuration | `internal_tensions` |
| Mercury–Venus sextile | configuration | `supporting_resources` |
| Sun–Moon opposition | configuration | `internal_tensions` |
| Sun–Jupiter trine | configuration | `supporting_resources` |
| figure apex_on_opposition (Jupiter) | figure | `internal_tensions` |

## Contrat de chaque chapitre

### `general_synthesis` — 1 bloc(s), 0 croisement(s)

**Mission** : Annonce la figure qui organise le thème et les deux ou trois idées que le dossier va développer. Tu les nommes, tu ne les développes pas : chaque idée a son chapitre.

- Faits développés : earth (répartition) (primary)
- Faits cités : Soleil en Pisces (reference) ; Soleil–Lune opposition (reference) ; Soleil–Jupiter trigone (reference) ; Lune–Jupiter sextile (reference)
- Possède : thèse du dossier
- Peut rappeler : —
- Réservé à plus tard : Moon–Jupiter sextile ; Mars–Saturn opposition ; Mercury–Venus sextile ; Sun–Moon opposition ; Sun–Jupiter trine ; figure apex_on_opposition (Jupiter)

### `internal_tensions` — 1 bloc(s), 3 croisement(s)

**Mission** : Montre une tension sans la refermer. Décris ce que chaque opposition met en jeu, puis, si une figure calculée relie ses extrémités à un troisième corps, dis ce que ce troisième terme change dans la lecture. Tu ne redéveloppes pas les ressources traitées ailleurs : tu peux les nommer en une clause.

- Faits développés : Mars–Saturne opposition (primary) ; Soleil–Lune opposition (primary)
- Faits cités : Lune–Jupiter sextile (reference) ; Soleil–Jupiter trigone (reference)
- Possède : Mars–Saturn opposition ; Sun–Moon opposition ; figure apex_on_opposition (Jupiter)
- Peut rappeler : thèse du dossier
- Réservé à plus tard : Moon–Jupiter sextile ; Mercury–Venus sextile ; Sun–Jupiter trine

### `supporting_resources` — 1 bloc(s), 3 croisement(s)

**Mission** : Montre ce qui rend la tension tenable, pas des dons isolés. Chaque appui est relié à ce qu'il soutient ou à ce qu'il nuance. Tu peux rappeler en une clause les tensions auxquelles ces appuis répondent, sans les redécrire.

- Faits développés : Mercure–Vénus sextile (primary) ; Lune–Jupiter sextile (primary) ; Soleil–Jupiter trigone (primary)
- Faits cités : Soleil–Lune opposition (reference)
- Possède : Moon–Jupiter sextile ; Mercury–Venus sextile ; Sun–Jupiter trine
- Peut rappeler : thèse du dossier ; Mars–Saturn opposition ; Sun–Moon opposition ; figure apex_on_opposition (Jupiter)
- Réservé à plus tard : —

### `major_aspects` — 0 bloc(s), 0 croisement(s)

**Mission** : Tu ne décris aucun aspect : tout a été dit dans les chapitres de catégorie. Tu formules ce que la carte des aspects montre d'ensemble et qui n'a pas encore été écrit. Si tu n'as rien de nouveau à dire, dis-le en une phrase.

- Faits développés : Mars–Saturne opposition (primary) ; Mercure–Vénus sextile (primary) ; Lune–Jupiter sextile (primary) ; Soleil–Jupiter trigone (primary) ; Soleil–Lune opposition (primary)
- Faits cités : —
- Possède : —
- Peut rappeler : thèse du dossier ; Moon–Jupiter sextile ; Mars–Saturn opposition ; Mercury–Venus sextile ; Sun–Moon opposition ; Sun–Jupiter trine ; figure apex_on_opposition (Jupiter)
- Réservé à plus tard : —

### `conclusion` — 1 bloc(s), 0 croisement(s)

**Mission** : Relie les grandes dynamiques déjà établies, sans réinterpréter chaque fait. Dis ce qui reste ouvert, pas ce qui est résolu.

- Faits développés : —
- Faits cités : Soleil en Pisces (reference) ; Lune en Virgo (reference) ; Lune–Jupiter sextile (reference) ; Mars–Saturne opposition (reference) ; Mercure–Vénus sextile (reference) ; Soleil–Jupiter trigone (reference) ; earth (répartition) (reference)
- Possède : —
- Peut rappeler : thèse du dossier ; Moon–Jupiter sextile ; Mars–Saturn opposition ; Mercury–Venus sextile ; Sun–Moon opposition ; Sun–Jupiter trine ; figure apex_on_opposition (Jupiter)
- Réservé à plus tard : —

