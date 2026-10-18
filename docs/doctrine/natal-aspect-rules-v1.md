# Règles d'aspect natal — convention `lastro-interpretation-library@0.3.0`

Statut : **expérimentation ciblée du 18 octobre 2026**, cinq règles, un seul axe
(le thème natal). Aucune autre famille de règles n'a été touchée.

## Le problème que ces règles résolvent

Trois chapitres du dossier payant — *Tensions intérieures*, *Ressources
complémentaires*, *Aspects majeurs* — recevaient bien les aspects calculés, mais
**aucune règle interprétative applicable**. `hasWritableMaterial` exigeant au
moins une règle, ils étaient purement et simplement supprimés du dossier livré.
Mesure sur le thème de référence : `internal_tensions` (2 preuves), `supporting_resources`
(3 preuves) et `major_aspects` (5 preuves) n'existaient pas.

La bibliothèque ne couvrait, côté natal, que quatre paires
(Mercure–Mars, Mercure–Vénus, Soleil–Mercure, Lune–Mercure) — et sur 25 règles
d'aspect, 16 appartiennent à l'axe relationnel. Les cinq aspects réellement
présents dans le thème de référence n'avaient donc **aucun** thème à transmettre.

## Ce que ces règles sont

Une règle = un fait autorisé (`evidenceType`, `match`) + des **thèmes** (syntagmes
nominaux) transmis au rédacteur + les interdits communs. Elles ne rédigent rien :
elles donnent au modèle de la matière, et le validateur continue de vérifier que
le texte ne dépasse pas les preuves du bloc.

Liste exacte (identifiants stables, versionnés) :

| Règle | Aspect | Catégorie | Thèmes |
|---|---|---|---|
| `western.natal.aspect.moon_jupiter.sextile@1` | Lune–Jupiter, sextile | soutien | ouverture émotionnelle appuyée sur la confiance ; sécurité intérieure rejointe par la générosité ; accueillir plus large que le nécessaire |
| `western.natal.aspect.mars_saturn.opposition@1` | Mars–Saturne, opposition | tension | élan d'agir contre limite rencontrée ; effort face à un cadre intérieur exigeant ; endurance longue au prix d'un rapport tendu à l'immédiateté |
| `western.natal.aspect.mercury_venus.sextile@1` | Mercure–Vénus, sextile | soutien | facilité à dire ce qui a de la valeur ; goût du lien par la parole ; facilité à activer, non automatique |
| `western.natal.aspect.sun_moon.opposition@1` | Soleil–Lune, opposition | tension | deux exigences opposées ; ajuster ce qui se montre et ce qui se ressent ; identité construite dans l'écart |
| `western.natal.aspect.sun_jupiter.trine@1` | Soleil–Jupiter, trigone | soutien | confiance pour élargir l'horizon ; élan de croissance qui soutient la direction personnelle ; la facilité peut dispenser de vérifier la mesure |

## Conventions explicites

1. **Catégorie = convention Lastro, pas fait scientifique.** Tension
   (conjonction, carré, opposition) et soutien (trigone, sextile) sont les
   catégories de `LASTRO_INTERPRETATION_CONVENTIONS` (`aspect_tension@1`,
   `aspect_support@1`). Rien n'est présenté comme démontré.
2. **Aucune règle ne crée de fait.** Le `match` est structurel
   (deux corps + type d'aspect) ; une règle ne peut s'appliquer qu'à une preuve
   `NATAL_ASPECT` déjà calculée et retenue.
3. **Aucun verdict de personnalité.** Les thèmes décrivent des dynamiques
   possibles. Pas de diagnostic, pas d'événement, pas de prédiction, pas de
   « vous êtes ».
4. **Sobriété proportionnelle à l'orbe.** Deux des cinq règles portent sur des
   aspects proches de leur limite (Mercure–Vénus 3,96° pour 4°, Soleil–Jupiter
   6,08° pour 8°) : leurs thèmes sont formulés comme *mobilisables* et non comme
   acquis. L'orbe et le serrage ne sont pas encore transmis au rédacteur (voir
   `docs/tranche-2-preparation.md`, point 1).
5. **Portée.** Ces règles n'ont pas de `scope` : elles valent pour l'axe natal.
   Les axes relationnels exigent un `scope` explicite et ne les voient donc pas.
   Une règle relationnelle de même identifiant ne doit jamais être masquée par
   une règle d'axe natal — c'est arrivé pendant l'expérimentation
   (`mercury_venus.sextile`), d'où le préfixe `.aspect.` et un test dédié.

## Affectation aux chapitres

Un aspect appartient désormais à **deux** endroits, avec deux angles :

- le chapitre de son corps (Soleil → identité, Lune → émotions, sinon aspects
  majeurs) ;
- le chapitre de sa catégorie : `internal_tensions` pour les tensions,
  `supporting_resources` pour les soutiens, `major_aspects` pour tous.

Auparavant le chapitre de catégorie recevait l'aspect en `interpretationDepth:
"reference"`, c'est-à-dire avec la consigne « rappelle brièvement, ne développe
pas » — le seul chapitre dont les tensions sont le sujet était le seul à qui
l'on interdisait de les traiter.

Plafonds conservés et rendus explicites : 5 aspects pour les deux chapitres de
catégorie, 12 pour `major_aspects` (le chapitre qui doit montrer la carte
complète ; à 8, un aspect réellement calculé disparaissait du dossier).

## Coût de la répétition (limite assumée)

Un aspect du Soleil ou de la Lune peut maintenant être développé dans trois
chapitres. Sans mémoire inter-chapitres (voir `docs/tranche-2-preparation.md`,
point 3), le rédacteur ne sait pas qu'il se répète. C'est mesuré et assumé : la
mémoire est le prochain chantier, pas une raison de rendormir les chapitres.

## Comment étendre — et comment ne pas le faire

- **Une règle par aspect réellement présent** dans les thèmes traités. Pas de
  matrice 21 × 5 écrite d'un coup : elle ne serait pas relue.
- Avant d'ajouter une règle, vérifier qu'elle change un chapitre réellement
  écarté, et mesurer (`node tools/estimate-cost.mjs`).
- Toute nouvelle règle passe par un test qui vérifie : identifiant unique,
  catégorie cohérente avec le type d'aspect, au moins deux thèmes, aucun
  vocabulaire de prédiction ou de diagnostic.
- Test de non-régression de couverture : `tests/natalAspectRules.test.mjs`
  vérifie que les trois chapitres ne redeviennent pas écartés et qu'aucune règle
  relationnelle n'est masquée.

## Ce qui n'est pas couvert (état honnête)

- Les **transits vers les angles** (ASC/DSC/MC/IC) n'ont aucune règle :
  18 des 48 transits mesurés sur le thème de référence restent sans thème.
- `NATAL_BODY_HOUSE` et `ANGLE_SIGN` n'ont **aucune** règle.
- Les **distributions** (éléments, modalités) n'ont aucune règle.
- `creativity` reste sans preuve assignée : ce n'est pas un manque de règle mais
  un manque de propriétaire.
