# Couche de composition éditoriale — convention `lastro-editorial-composition@1.0.0`

Statut : **prototype local, non déployé, non exercé contre un modèle payant.**
Ce document fixe ce que le moteur a le droit de faire, et surtout ce qu'il n'a pas
le droit de faire.

## Le problème

Le moteur transmettait au rédacteur des **phrases interprétatives déjà écrites**
(« tension entre l'élan d'agir et la limite rencontrée »). Mesure sur deux
générations réelles : 15 thèmes sur 18 repris avec au moins quatre mots
identiques (gpt-4o-mini), 12 sur 18 (Claude), jusqu'à neuf mots d'affilée. Le
modèle ne construisait pas : il reformulait. Et chaque chapitre travaillait seul :
`aspects majeurs` répétait presque intégralement les deux chapitres de catégorie.

## La règle centrale : la géométrie autorise, les concepts articulent

Un croisement entre deux configurations n'est produit que sous l'une de ces deux
licences :

1. **corps partagé** — les deux configurations touchent le même corps calculé ;
2. **figure calculée** — elles appartiennent à une même figure détectée
   (`apex_on_opposition`, `grand_trine`).

Sans licence, le moteur **refuse** et l'écrit : « Aucune relation astrologique
directe suffisamment étayée pour ce croisement. » Ce refus est un résultat, pas
un échec : il empêche de remplir un chapitre avec des rapprochements littéraires.

Sur le thème de démonstration (14/03/1979 ≈ 09 h 00, Lyon) :

| Croisement demandé | Verdict |
|---|---|
| Mars–Saturne × Soleil–Lune | **refusé** — aucun corps partagé, aucune figure commune |
| Mercure–Vénus × Mars–Saturne | **refusé** — (contre-exemple obligatoire) |
| Lune–Jupiter × Soleil–Lune | **autorisé** — membres de la figure Soleil–Lune–Jupiter |
| Soleil–Jupiter × Mars–Saturne | **refusé** |
| Mercure–Vénus × Lune–Jupiter | **refusé** |

Trois relations sont autorisées au total : les trois paires de la figure. Sept
croisements sont refusés explicitement.

## La figure `apex_on_opposition`

Détection : A oppose B, et C forme un aspect (trigone, sextile ou carré) à A
**et** à B. La convention associée (`lastro.figure.apex_on_opposition@1`) est une
**convention de composition**, pas une doctrine traditionnelle :

- elle autorise à lire les trois configurations ensemble ;
- elle impose l'ordre de lecture par serrage d'orbe ;
- elle n'ajoute **aucune signification** : c'est l'apex et la catégorie de ses
  deux aspects (soutien ou tension) qui disent si la figure relie ou presse ;
- sur ce thème : apex Jupiter, trigone au Soleil (6,08°) et sextile à la Lune
  (1,09°) — le lien le plus serré est du côté de la Lune.

Le T-carré est le même mécanisme avec deux carrés (mode `hard`) ; le grand
trigone est détecté séparément.

## Du fait au matériau : sémantique structurée

Les cinq règles d'aspect portent désormais, à côté de leurs `themes` historiques,
un bloc `semantics` :

```
concepts : ["action", "limite", "effort", "retenue", "endurance"]
relation : "l'élan se mesure à une limite intérieure"
motif    : "effort tenu"
nuances  : ["tension ne veut pas dire incapacité", …]
```

Le prompt transmet ces **concepts** et non les phrases, et interdit explicitement
de les recopier. Les `themes` restent envoyés pour les règles anciennes qui n'ont
pas encore de sémantique : la migration est progressive, jamais bloquante.

## Une seule mémoire : le plan éditorial

`fullDossierPlan.editorialPlan` contient la thèse, les idées, **un propriétaire
unique par idée**, la mission de chaque chapitre, ce qui peut être rappelé et ce
qui est réservé à plus tard. Le rédacteur reçoit ces listes ; il ne reçoit aucune
mémoire conversationnelle. Tout est déterministe : deux exécutions produisent le
même plan.

Un chapitre peut **citer** une configuration qu'il ne possède pas (référence
croisée ajoutée en profondeur `reference`), mais il ne peut pas la redévelopper :
l'idée appartient à un autre chapitre.

## Le chapitre « Aspects majeurs » : trois options

| Option | Mise en œuvre | Coût | Effet |
|---|---|---|---|
| **A — synthèse** | `aspectChapterMode: "synthesis"` : le chapitre garde ses blocs mais ne possède plus aucune configuration ; il ne peut que formuler du transversal | 2 blocs (même coût qu'avant) | dépend entièrement de la capacité du modèle à dire autre chose ; risque de paraphrase du plan |
| **B — référence** | `aspectChapterMode: "reference"` : aucun bloc narratif ; la table des aspects de l'annexe suffit | **−2 appels** | supprime mécaniquement la répétition ; le chapitre reste dans le plan comme référence |
| **C — suppression** | `aspectChapterMode: "absent"` : le chapitre quitte le plan | −2 appels | identique à B en coût, mais l'information de référence quitte le dossier narratif |

**Recommandation : B.** Elle supprime la répétition par construction (le chapitre
n'a plus rien à redire), conserve une trace vérifiable des aspects dans l'annexe,
et ne dépend pas de la capacité du modèle à produire une synthèse. C resterait un
choix éditorial plus radical, sans gain de coût supplémentaire. A est le pari le
plus intéressant mais le moins garanti : c'est celui qu'il faut **tester** avant
de l'adopter.

## Ce que la couche ne fait pas

- Elle n'invente aucune relation symbolique : chaque relation cite sa convention
  et ses preuves.
- Elle ne remplace pas les validateurs factuels : les faits cités restent bornés
  par les `evidenceRefs` du chapitre.
- Elle ne décide pas du texte : elle prépare le raisonnement.
- Elle ne force aucune convergence : sur un thème sans figure, elle produit zéro
  relation et le dit (`no_calculated_figure`).

## Limites connues

- Sur un thème dont les aspects n'ont **aucune règle**, la figure est détectée
  mais aucun croisement n'est produit : le moteur signale `figure_member_without_semantics`.
- La sémantique structurée n'existe que pour les cinq règles d'aspect de
  l'expérimentation ; les autres familles (maisons, angles, transits) gardent
  leurs `themes` en phrases.
- La mémoire est un registre d'idées, pas une compréhension : elle empêche de
  redévelopper une idée, elle ne garantit pas que le texte l'exprime bien. La
  mesure (`editorialDiagnostics`) le dit, elle ne le corrige pas.
