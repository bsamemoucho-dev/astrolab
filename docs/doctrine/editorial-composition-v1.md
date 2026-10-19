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

**Décision appliquée : B est le mode du PRODUIT.** Le plan générique garde
`narrative` par défaut (les expériences et le moteur historique ne changent pas) ;
`fullDossierService` demande explicitement `reference`. Conséquences mesurées :
le dossier passe de 15 à 14 chapitres rédigés, `major_aspects` disparaît de la
narration, et sa `referenceTable` (aspects, orbes, triée par serrage) reste
disponible pour l'annexe. Un mode inconnu lève désormais au lieu de retomber
silencieusement sur un autre comportement.

Un défaut corrigé au passage : une section de référence (zéro bloc) était encore
« écrite » à vide et comptée comme générée. Le rédacteur refuse maintenant une
section sans bloc, avec le motif `reference_only`.

**Recommandation : B.** Elle supprime la répétition par construction (le chapitre
n'a plus rien à redire), conserve une trace vérifiable des aspects dans l'annexe,
et ne dépend pas de la capacité du modèle à produire une synthèse. C resterait un
choix éditorial plus radical, sans gain de coût supplémentaire. A est le pari le
plus intéressant mais le moins garanti : c'est celui qu'il faut **tester** avant
de l'adopter.

## Garde-fou : une interaction affirmée doit être licenciée

Le moteur refuse un croisement ; encore faut-il que le texte ne l'affirme pas
quand même. Le validateur détecte désormais les phrases qui **nomment deux
aspects distincts et affirment qu'ils interagissent** (`se répondent`,
`se renforcent`, `se compensent`, `tempère`, `relie`… liste fermée), puis
vérifie que la paire figure parmi les croisements autorisés du chapitre.

- code d'issue : `crossed_claim_not_licensed` (bloquant, comme les autres
  erreurs factuelles) ;
- une phrase qui **nie** le lien, ou qui se contente d'**énumérer** deux aspects,
  n'est pas un croisement : rien n'est signalé ;
- le contrôle ne s'applique qu'au moteur de composition (le moteur historique
  n'a pas de relations autorisées : le lui appliquer bloquerait tout) ;
- la détection est par phrase : deux aspects dans deux phrases différentes ne
  constituent pas une interaction affirmée.

Cas testés : paire de la figure → acceptée ; Mars–Saturne × Mercure–Vénus →
refusée ; forme négative → acceptée ; énumération → acceptée.

## Mesurer la dépendance aux formulations sources

La mesure (`editorialDiagnostics.verbatimDependency`) a une sémantique précise :

- elle compare des **jetons normalisés** (minuscules, accents retirés,
  apostrophe = séparateur, ponctuation retirée) — « s'appuie » compte donc pour
  deux jetons ;
- elle renvoie la **plus longue suite consécutive** d'une source retrouvée telle
  quelle, avec la source en cause ;
- seuil par défaut : 3 jetons ; en dessous, rien n'est signalé ;
- elle est **lexicale, pas sémantique** : une reformulation qui conserve une
  courte suite fortuite (« s'appuie sur la » = 4 jetons) n'est pas une copie ;
- complément indispensable : `lexicalOverlap` (Jaccard sur les mots pleins)
  mesure la redondance de contenu, et `crossChapterRepetition` croise les deux.

Calibration vérifiée par test : copie intégrale → longueur de la source ; copie
de 6 jetons → 6 ; ordre changé → suite courte ; accents/casse → détectés ;
sous-seuil → 0. Sur les deux dossiers existants : recopie maximale par chapitre
12 / 8 / 15 (gpt-4o-mini) et 9 / 8 / 8 (Claude) ; recouvrement lexical
tensions×aspects 0,37 et ressources×aspects 0,32 (gpt-4o-mini), 0,24 et 0,28
(Claude).

## Migration progressive vers la sémantique structurée

Le prompt transmet des **concepts** quand la règle en a, et ses **phrases**
sinon : les deux formats coexistent dans un même chapitre, ce qui permet de
migrer famille par famille sans rien casser (`editorialPlan.semantics`).

État mesuré aujourd'hui (`semanticsCoverage()`) :

| Famille | Structurées | Total |
|---|---:|---:|
| `NATAL_ASPECT` | **5** | 30 |
| `NATAL_BODY_SIGN` | 0 | 96 |
| `PERSONAL_TRANSIT` | 0 | 245 |
| `TRANSIT_SNAPSHOT` | 0 | 1 |
| **Total** | **5** | **372** |

Procédure pour la famille suivante, sans refonte :

1. choisir **une** règle réellement utilisée dans un chapitre existant ;
2. lui ajouter `semantics { concepts, relation, motif, nuances }` — des noms et
   une formule courte, jamais une phrase déjà rédigée ;
3. vérifier que le chapitre qui la reçoit change de nature (les concepts
   arrivent, les phrases disparaissent pour cette règle) ;
4. laisser `semanticsCoverage()` documenter l'avancement, sans jamais prétendre
   que la migration est terminée.

## Couverture factuelle : lier ce qui est dit

Trois tournures échappaient au détecteur, et un chapitre correct n'était couvert
qu'à **1 fait sur 4** :

1. **phrase à sujet implicite** — « en trigone avec le Soleil (6,08°), en sextile
   avec la Lune (1,09°) ». Le sujet (Jupiter) est loin, la seconde phrase reprend
   celui de la première. Un liant dédié reconnaît `ASPECT + avec/à + objet` et
   applique deux règles : reprise du sujet précédent quand aucun corps n'apparaît
   entre les deux (énumération), sinon dernier corps cité **non déjà objet** d'un
   aspect (sinon la phrase est ambiguë et n'est pas devinée). Couverture du
   chapitre de démonstration : **3 / 4**.
2. **orbe chiffré sans aspect nommé** — « deux exigences… (orbe de 4,99°) ».
   Le nombre n'est vérifiable par personne : **avertissement**
   `orb_without_named_aspect`, jamais bloquant. Le 4ᵉ fait du chapitre est dans
   ce cas : il n'est pas *nommé*, donc non lié — ce n'est plus un faux positif.
3. **parenthèse** — « trigone avec le Soleil (6,08°), en sextile avec la Lune »
   produisait un « Soleil–Lune sextile » inexistant : la parenthèse ferme
   désormais la paire.

Aucun seuil d'orbe, aucune liste de vocabulaire, aucun contrôle n'a été
assoupli : le liant ne peut qu'AJOUTER des faits vérifiés.

## Isolation : la phrase porte sur tous les aspects

« Aucun fait ne relie Mars–Saturne à la figure » ne doit pas être vrai seulement
pour les aspects qui ont une règle. `analyseIsolation` examine **tous** les
aspects retenus du thème et produit un fait vérifiable :

> Sur les 5 aspects retenus du thème, aucun ne touche un corps de cette figure
> (Sun, Moon, Jupiter) : les configurations hors figure ne lui sont reliées par
> aucun aspect calculé.

Quand un aspect relie la figure (test synthétique : un carré Mars–Jupiter), la
phrase s'inverse et nomme le corps partagé. Le rédacteur reçoit ce fait, il ne
l'invente pas.

## Présentation : le chapitre ne raconte pas son atelier

La version testée ouvrait sur « les deux liens sont des soutiens », puis
commentait ses mesures, ses conventions et ses limites — une justification
technique en pleine lecture. La mission d'exploration est désormais en **trois
mouvements** (ce que la structure a de particulier ; deux lectures menées jusqu'à
ce qu'elles changent quelque chose pour le lecteur ; une question ou une
ouverture), avec un interdit explicite : ni « hypothèse », ni « mesure », ni
« convention », ni « on ne peut pas en déduire ». Les preuves et les limites
restent publiées dans l'annexe et portées par les badges.

## Généralité : le moteur ne produit pas deux hypothèses par construction

| Configuration | Figure | Hypothèses |
|---|---|---|
| Thème de démonstration | apex harmonique asymétrique | **2** |
| T-carré (1975-09-08) | apex dur | **2** |
| Grand trigone (1974-03-11) | trigone | **1** |
| Thème sans figure (1970-06-21) | aucune | **0** |
| Apex symétrique (synthétique) | harmonique, orbes 4° / 4,5° | **1** |
| Apex relié (synthétique) | + carré Mars–Jupiter | **2** |

Le nombre d'hypothèses dépend de la géométrie : sans discriminant mesuré (écart
d'orbe < 2°), une seule lecture est produite.

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
