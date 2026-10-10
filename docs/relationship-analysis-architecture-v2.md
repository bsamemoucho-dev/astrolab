# Architecture relationnelle Lastro V2

> **Statut : documentation produit/méthodologie.**
> Cette V2 conserve l'audit précédent comme historique dans
> `docs/relationship-analysis-architecture.md`, mais remplace ses conclusions
> opérationnelles par l'état réel audité et les décisions produit actuelles.
> Aucune fonctionnalité future n'est décrite comme existante.

## A. Principes fondamentaux

### Le relationnel n'est pas seulement la synastrie

Lastro distingue plusieurs familles de lectures :

| Famille conceptuelle | Sujets | Objet |
|---|---:|---|
| `natal` | 1 | Moi |
| `individual_relational` | 1 | Moi en relation |
| `individual_relational` + angle Amour | 1 | Moi en amour |
| `western-synastry` | 2 | Nous |
| `western-synastry` + angle Amour | 2 | Nous en amour |
| `temporal_individual` | 1 + ciel actuel | Moi maintenant |
| `temporal_relational` | 2 + relation + ciel actuel | Nous maintenant |

Ordre produit retenu :

1. `individual_relational` : une personne, lecture relationnelle individuelle.
2. `western-synastry` / pair romantic : deux personnes, vraie synastrie Amour.

Le code possède déjà un concept/champ `scope`. Le mapping exact entre ces scopes
conceptuels et l'implémentation future reste ouvert : extension du champ existant,
renommage, ou autre structure.

### Lastro calcule d'abord. Il interprète ensuite.

Pipeline de référence :

```text
données
↓
calcul astrologique
↓
faits structurés / evidence
↓
plan
↓
interprétation
↓
validation contre l'evidence
↓
dossier
```

Le LLM ne doit jamais déterminer lui-même une position planétaire, un signe, un
aspect, une orbe, un angle, une maison ou tout autre fait astrologique qui doit
venir du calcul. Il interprète des faits déjà calculés.

Formulation publique future possible :

> Beaucoup de lectures astrologiques en ligne reposent sur quelques informations
> générales. Lastro suit une autre approche : les éléments astrologiques utilisés
> dans la lecture sont d'abord calculés, puis l'interprétation est construite à
> partir de ces faits.

Ne pas écrire que les autres sites inventent, ni toute affirmation générale
impossible à démontrer.

## B. Etat actuel du code

### CURRENT - collections et objets existants

Le magasin JSON contient notamment :

- `persons`
- `birthData`
- `relationships`
- `analyses`
- `analysisVersions`
- `methodResults`
- `calculationRuns`
- `calculationArtifacts`
- `deliverables`
- `publicReadings`
- `outbox`

`Person` ne porte pas directement `birthDate`. Les données de naissance sont
dans `birthData`.

`Relationship` existe déjà et est directionnel :

```text
fromPersonId → toPersonId
```

Cette direction est importante pour des relations comme `mother`, `father`,
`child`, etc. Elle ne doit pas être transformée artificiellement en paire non
ordonnée dans la documentation.

### CURRENT - types de relation

Les types actuellement présents dans le code sont :

- `mother`
- `father`
- `grandparent`
- `great_grandparent`
- `sibling`
- `child`
- `partner`
- `ex_partner`
- `friend`
- `associate`
- `other`

`other` est le repli existant. Une valeur conceptuelle future comme
`unspecified` peut être étudiée, mais elle n'existe pas aujourd'hui dans l'enum.

### CURRENT - Person sans BirthData

Une personne liée peut aujourd'hui exister sans `BirthData`. Ce comportement est
documenté comme intentionnel.

Principe :

> Une personne peut exister dans Lastro sans être astrologiquement exploitable par
> toutes les méthodes. Ce sont les méthodes qui déclarent leurs prérequis.

| Cas | Ce que le code permet aujourd'hui |
|---|---|
| Person sans date de naissance | Relation enregistrable. Aucune méthode astrologique nécessitant une date. |
| Person avec date mais heure inconnue | Certaines méthodes restent disponibles. Angles/maisons peuvent être indisponibles. |
| Person avec date + heure mais lieu inconnu | Données insuffisantes pour les calculs qui exigent timezone et coordonnées. |
| Person avec données complètes | Méthodes disponibles selon leurs prérequis propres. |

Pour le futur produit, l'interface pourra proposer "Ajouter ses informations de
naissance" sans rendre cela obligatoire pour l'existence de la personne.

### CURRENT - calcul natal et current sky

Le natal V1 calcule actuellement sept corps :

- Soleil
- Lune
- Mercure
- Vénus
- Mars
- Jupiter
- Saturne

Le pipeline `current_sky` / transits utilise davantage de corps, notamment
Uranus, Neptune et Pluton. La présence d'un corps dans `current_sky` ne signifie
pas qu'il est automatiquement validé pour la synastrie.

### CURRENT - ASC, MC et maisons

Angles et maisons sont partiellement validés :

- ASC/MC sont calculés par du code Lastro local.
- Whole Sign dépend de l'Ascendant calculé.
- Les angles portent le statut
  `development_calculation_requires_ephemeris_validation`.
- Les fixtures externes sont plus solides pour les corps planétaires que pour
  les angles/maisons.

Décision : ASC, MC, maisons et house overlays sont hors de la première V1
synastrie.

### CURRENT - incertitude de l'heure

Le vocabulaire réel du code est :

- `exact`
- `approximate`
- `interval`
- `unknown`

Le code contient également des mécanismes comme :

- `marginWindow`
- `intervalAnalysis`
- `ascendantSignWindows`

et des classifications :

- `stable`
- `sensitive`
- `indeterminate`

La cible conceptuelle `birthTimeWindow` peut être documentée, mais elle n'existe
pas comme abstraction homogène partout. L'harmonisation éventuelle avec
`stable / variable / unavailable` reste ouverte. Ne pas supposer que `sensitive`
et `variable` sont automatiquement synonymes.

Principe : un fait dépendant de l'incertitude ne doit jamais être présenté comme
certain si le calcul ne le permet pas. Pour un futur aspect calculé sur une
fenêtre horaire, conserver `orbMin` / `orbMax` pourra être nécessaire si l'orbe
varie.

### CURRENT - evidence et validation

Le pipeline structuré natal valide déjà les claims d'aspects contre l'evidence.
`validateDossierClaims` et `validateStructuredSection` vérifient les claims
`NATAL_ASPECT` et `NATAL_ASPECT_ORB` contre l'evidence réelle, avec tests.

Le validateur legacy free-text est plus limité et n'est pas le garde-fou
principal.

La synastrie devra étendre ou réutiliser cette logique pour les aspects croisés
A↔B. Cette V2 ne crée pas un second validateur spécifique.

## C. Lecture relationnelle individuelle

### TARGET - Moi en relation

La lecture relationnelle individuelle nécessite un seul thème natal. Elle ne
décrit jamais une relation avec une personne précise.

Lecture natale :

> Qui suis-je symboliquement à travers mon thème ?

Lecture "Moi en relation" :

> Comment certains éléments de mon thème s'expriment spécifiquement dans ma
> manière d'être en relation ?

Cette verticale produit n'est pas une synastrie incomplète.

Axes validés pour la structure V1 de "Moi en relation" :

- Communication relationnelle ;
- Manière d'exprimer son affection ;
- Manière d'entrer en relation ;
- Besoin d'espace et de proximité ;
- Manière d'aborder les désaccords ;
- Besoins relationnels.

L'ancien axe "Désir, initiative et manière d'agir" est reporté à une éventuelle
V2/V3. Aucune doctrine sexuelle ou comportementale n'est ajoutée dans la V1
publique, et `Venus-Mars` reste inutilisé pour le moment.

"Ressources relationnelles" et "Zones demandant de l'attention" ne sont pas
des axes autonomes. Elles correspondent aux blocs transversaux du writer
structuré :

- `resource` ;
- `attention_point`.

`attention_point` est facultatif et ne doit jamais être produit si aucune règle
ne fournit d'`attentionTheme`.

Cette lecture doit être transversale. Elle ne doit pas répéter Soleil, Lune,
Mercure, Vénus, Mars, etc. sous forme de nouvelles sections. Elle construit des
axes relationnels à partir de plusieurs faits.

Etat validé :

- Communication relationnelle V1 : validée au checkpoint `75ea178` ;
- writer : `gpt-4.1-mini`, uniquement pour cet axe ;
- Mercury sign : exclu de la V1 de cet axe ;
- fixtures réelles validées : 2 ;
- validation technique : PASS ;
- validation doctrinale : PASS ;
- traçabilité : PASS.
- Manière d'exprimer son affection V1 : doctrine validée dans
  `docs/doctrine/affection-v1.md`, implémentée par les règles
  `western.relational.affection.*@1`, writer `gpt-4.1-mini`, et intégrée au
  dossier client après Communication relationnelle.

Les quatre autres axes V1 restent non implémentés et sans doctrine validée. Les
pistes documentaires existantes ne doivent pas être transformées en règles tant
qu'une décision méthodologique humaine ne les a pas validées.

Ces axes sont une grille interprétative Lastro. Ils ne doivent pas être présentés
comme une doctrine astrologique traditionnelle autonome.

### Langage et libellés

Ne pas utiliser de vocabulaire clinique.

Ne pas parler de :

- style d'attachement ;
- diagnostic psychologique ;
- trouble ;
- dépendance affective ;
- profil clinique ;
- pathologie.

Préférer des formulations descriptives et symboliques.

Les identifiants techniques internes peuvent rester en anglais. Les libellés
destinés au lecteur français doivent être en français :

| Identifiant conceptuel | Libellé français |
|---|---|
| `romantic` | Amour |
| `general` | Relation en général |
| `friendship` | Amitié |
| `family` | Famille |
| `professional` | Collaboration |
| `individual_relational` | Moi en relation |

Le mapping complet vers les autres langues est futur.

La structure générale de "Moi en relation" retient six axes en V1. Les blocs
`resource` et `attention_point` sont transversaux ; `attention_point` reste
facultatif et dépend strictement de la présence d'un `attentionTheme` validé.
La structure exacte de "Moi en amour" reste ouverte.

## D. Synastrie à deux

### TARGET - western-synastry

`western-synastry` est approuvée pour développement V1.

Elle n'est pas :

- implémentée ;
- validée ;
- éligible production.

Première verticale :

```text
2 personnes
+
angle Amour
→ vraie synastrie occidentale
```

Corps V1 :

- Soleil
- Lune
- Mercure
- Vénus
- Mars
- Jupiter
- Saturne

Exclus de cette première V1 :

- Uranus
- Neptune
- Pluton
- Nœuds
- Chiron

Aspects V1 envisagés :

- conjonction ;
- opposition ;
- trigone ;
- carré ;
- sextile.

Référence existante : `lastro-aspects@1.0.0`. Les valeurs exactes des orbes
croisées restent à décider.

`western-synastry` est l'identifiant de méthode. La future `methodVersion` de la
synastrie reste `TBD`. `LASTRO_SYNASTRY_1` peut être réservé conceptuellement,
mais ne doit pas être présenté comme une version complète existante.

### Nous, A→B et B→A

La synastrie ne doit pas être décrite comme totalement symétrique.

Le dossier principal est un dossier "Nous", mais il peut distinguer :

- ce que A active chez B ;
- ce que B active chez A ;
- les dynamiques communes.

Le calcul astrologique reste déterministe. La narration peut être directionnelle.

Distinction conceptuelle :

| Concept | Principe |
|---|---|
| `Relationship` | Peut rester directionnel. |
| Synastry subject pair | Peut être traitée comme paire de sujets pour identité/déduplication future. |
| Interpretation | A→B et B→A restent distincts. |

Ne pas décider maintenant du mécanisme de stockage exact.

## E. `relationshipType` vs `analysisLens`

Deux notions doivent rester séparées :

```text
relationshipType
→ Qui est cette personne pour moi ?

analysisLens
→ Qu'est-ce que je souhaite explorer ?
```

Les concepts envisagés pour `analysisLens` sont :

- `romantic`
- `general`
- `friendship`
- `family`
- `professional`

Seul l'angle Amour fait partie de la première synastrie envisagée.

`analysisLens` n'existe pas aujourd'hui dans le modèle. Il est un concept cible.
L'endroit exact où il sera persisté sera décidé lors de l'implémentation. Il doit
être un choix explicite de l'utilisateur, sans valeur par défaut silencieuse.

## F. Calcul vs interprétation

`relationshipType` et `analysisLens` ne doivent jamais changer :

- les positions astronomiques ;
- les aspects calculés ;
- les orbes calculées ;
- l'existence d'un fait astrologique.

Architecture conceptuelle :

```text
données A + données B
        ↓
calcul astrologique déterministe
        ↓
faits de synastrie
        ↓
contexte relationnel + angle choisi
        ↓
sélection / hiérarchisation de l'evidence
        ↓
plan
        ↓
interprétation
        ↓
validation
```

Le contexte relationnel peut modifier :

- la pertinence éditoriale de certains faits ;
- l'ordre des sections ;
- le vocabulaire ;
- les thèmes abordés ;
- les faits mis en avant.

Il ne peut pas :

- inventer un aspect ;
- supprimer un aspect du calcul ;
- modifier une orbe ;
- transformer géométriquement le thème.

## G. Evidence / validation

Pour toute lecture relationnelle future :

- un fait astrologique doit venir du calcul ;
- l'interprétation doit référencer des faits autorisés ;
- une affirmation non soutenue par l'evidence doit être rejetée ou réécrite ;
- les faits non stables ne doivent pas être affirmés catégoriquement.

Exemple conceptuel futur :

```js
{
  bodyA: "Venus",
  bodyB: "Mars",
  aspectType: "square",
  orb: 2.1,
  stability: "stable"
}
```

Le writer peut interpréter ce fait. Il ne peut pas inventer `Moon A trine Venus B`
si ce fait n'existe pas dans l'evidence autorisée.

## H. Incertitude horaire

Pour la synastrie, l'incertitude de chaque personne doit être portée séparément.

Principes cibles :

- un fait stable peut être utilisé normalement ;
- un fait sensible, variable ou indéterminé ne doit pas être formulé comme certain ;
- si l'heure est inconnue, ne pas inventer angles, maisons, ASC/MC ou house overlays ;
- si une orbe varie sur une fenêtre horaire future, conserver conceptuellement
  `orbMin` / `orbMax` pourra être nécessaire.

Les modalités rédactionnelles précises des faits `sensitive / variable` restent
ouvertes.

## I. Périmètre V1

| Elément | Statut |
|---|---|
| Lecture "Moi en relation" | TARGET V1, partiellement implémentée : Communication relationnelle V1 et Affection V1 validées ; quatre autres axes V1 non implémentés ; Désir/initiative reporté V2/V3 |
| Lecture "Moi en amour" | TARGET V1 possible, structure ouverte |
| `western-synastry` Amour | APPROVED FOR V1 DEVELOPMENT, non implémentée |
| Corps synastrie | Sept corps natals V1 |
| Aspects | Cinq aspects majeurs envisagés |
| Scores globaux | Exclus |
| ASC/MC/maisons/house overlays | Exclus V1 |

### Garde-fous pour l'angle Amour

L'angle Amour doit être interdit si le type de relation connu est :

- `mother`
- `father`
- `grandparent`
- `great_grandparent`
- `sibling`
- `child`

La synastrie Amour doit également être interdite si l'une des deux personnes est
mineure à la date de l'analyse.

Pour une vraie synastrie Amour V1, la date de naissance des deux personnes est un
prérequis astrologique. Absence de `birthDate` implique synastrie Amour
indisponible.

Ne pas créer de mécanisme permettant de remplacer la date par une simple
déclaration de majorité pour lancer la synastrie.

Si le type de relation est volontairement non précisé dans le futur, ne pas
forcer l'utilisateur à révéler le type précis. Prévoir conceptuellement un
garde-fou indépendant permettant de confirmer au minimum :

- qu'il ne s'agit pas d'un lien familial interdit ;
- que les personnes sont majeures.

## J. Hors V1 / futur

Sont DEFERRED / FUTURE :

- Amitié ;
- Famille ;
- Collaboration / Travail-Duo ;
- house overlays ;
- ASC/MC relationnels ;
- composite ;
- Davison ;
- compatibilité avec un signe solaire uniquement ;
- positions astrologiques saisies manuellement ;
- Nous maintenant ;
- analyses de groupe ;
- Jyotish ;
- BaZi ;
- Maya ;
- traditions celtiques ;
- synthèse inter-traditions.

La compatibilité avec un signe serait une lecture partielle, pas une vraie
synastrie.

Pour de futures données astrologiques saisies manuellement, prévoir
conceptuellement une provenance différente :

- `CALCULATED_BY_LASTRO`
- `USER_DECLARED`

Ces valeurs ne sont pas à présenter comme implémentées.

### Travail / Duo

Travail / Duo n'est pas inclus dans la première V1. Le futur module ne doit pas
être conçu ou présenté comme un outil RH.

Ne pas utiliser pour :

- recruter ;
- sélectionner ;
- évaluer ;
- promouvoir ;
- sanctionner ;
- licencier ;
- prendre une décision professionnelle concernant une personne.

Le nom "Manager / Collaborateur" n'est pas retenu à ce stade. La future lecture
pourra éventuellement concerner une collaboration ou un duo déjà existant, sous
réserve de décisions produit/juridiques ultérieures.

## K. Garde-fous éditoriaux

Pour toutes les lectures relationnelles :

- pas de déterminisme ;
- pas de promesse de destin ;
- pas d'inférence psychologique clinique ;
- pas d'inférence à partir de données culturelles non pertinentes au calcul.

Formulations interdites :

- "Vous êtes faits l'un pour l'autre."
- "Cette relation va échouer."
- "Cette personne est votre âme sœur."
- "Vous devez rester ensemble."

Ne pas inférer le fonctionnement relationnel ou la compatibilité à partir :

- du nom ;
- du prénom ;
- de la nationalité ;
- de l'origine ;
- de l'ethnie ;
- de la religion ;
- du pays ;
- d'autres informations culturelles non pertinentes au calcul.

Le dossier Amour doit respecter ce principe :

> Une lecture symbolique ne remplace ni votre ressenti, ni vos limites, ni votre
> sécurité.

Une tension astrologique ne doit jamais être présentée comme :

- une violence à accepter ;
- une souffrance nécessaire ;
- une situation dangereuse à supporter ;
- une obligation de rester dans la relation.

## L. Pertinence éditoriale et scores

### `relationshipSalience`

Prévoir conceptuellement une classification `relationshipSalience`.

Pour les sept corps V1 :

| Classe | Corps |
|---|---|
| PERSONAL | Soleil, Lune, Mercure, Vénus, Mars |
| SOCIAL | Jupiter, Saturne |

Première logique documentaire :

- personal-personal : forte pertinence potentielle ;
- personal-social : pertinence normale ;
- social-social : davantage contexte collectif / de cohorte.

Cette classification n'est pas un score. Elle ne modifie pas le calcul. Elle sert
à la hiérarchisation éditoriale. C'est une approximation V1 ; une méthode plus
fine pourra tenir compte de l'écart d'âge et de la vitesse des corps.

### Scores

Décision V1 :

- aucun score global ;
- aucun pourcentage ;
- aucun score `/100`.

Ne pas produire :

```text
Compatibilité : 86 %
```

Distinctions :

| Terme | Sens |
|---|---|
| SCORE | Réduction numérique d'une relation. |
| CLASSIFICATION | Appartenance à une catégorie discrète. |
| ECHELLE ORDINALE | Position sur plusieurs niveaux ordonnés. |

`relationshipSalience` est une classification, pas un score. Les éventuelles
échelles ordinales futures restent à décider.

## M. Données de la personne B

Principe de minimisation :

- un prénom ou pseudonyme doit pouvoir suffire autant que possible ;
- le calcul astrologique ne nécessite pas un nom complet ;
- les données nécessaires dépendent de la méthode ;
- une personne sans date de naissance peut exister sans être exploitable par
  toutes les méthodes.

La question juridique/RGPD complète reste ouverte avant commercialisation
publique de la synastrie. Ne pas décider de base légale dans cette passe. Ne pas
prétendre qu'un consentement explicite est nécessaire ou suffisant.

Sujets à finaliser avant production publique :

- minimisation ;
- données nécessaires par méthode ;
- suppression ;
- conservation ;
- transparence ;
- données tierces.

## N. Versionnement / reproductibilité

### CURRENT

Le code contient déjà plusieurs métadonnées de reproductibilité, selon les
pipelines :

- `methodVersion`
- `engineVersion` ou `engine.version` selon les objets ;
- `ephemerisVersion`
- `timezoneDatabaseVersion`
- `calculatedAt`
- `inputDataHash`
- `resultHash`
- `normalized_input`
- `structured_result`
- `dataSnapshot`
- versions de plan/evidence/writer dans certains dossiers ;
- métadonnées LLM dans certains dossiers/lectures.

Ne pas supposer que tous ces noms existent partout ni qu'ils ont partout le même
niveau de protection.

L'immutabilité est en partie conventionnelle dans le `JsonStore`. Le code évite
de réécrire certains artefacts historiques, mais il n'existe pas un verrou
technique général comparable à un append-only store.

### TARGET

Un ancien dossier doit rester attaché au snapshot et aux versions qui l'ont
produit. Un recalcul futur produit une nouvelle version et ne réécrit pas
silencieusement l'historique.

## O. Cas limites

| Cas | Décision |
|---|---|
| A === B | Interdit. |
| Deux personnes distinctes avec mêmes date/heure/lieu | Autorisé. |
| Thèmes identiques ou quasi identiques | Autorisé ; ne jamais en déduire une compatibilité parfaite. |
| Relation existante entre A et B | Réutiliser lorsque pertinent plutôt que créer silencieusement un doublon. |
| Déduplication `(A,B) = (B,A)` | Ne pas appliquer naïvement à toutes les relations, car `Relationship` est directionnelle et typée. |
| Minimum arbitraire d'aspects | Pas de seuil du type "minimum 5 aspects". |
| Evidence faible | Sections raccourcies, absentes, `skipped` ou `not_available`; jamais de remplissage inventé. |
| B sans date de naissance | Personne relationnelle possible ; méthodes nécessitant la date indisponibles. |

## P. Questions ouvertes

1. Valeurs exactes des orbes de synastrie.
2. Future `methodVersion` officielle de la synastrie.
3. Doctrine et règles précises des quatre axes V1 non implémentés de "Moi en relation".
4. Structure précise de "Moi en amour".
5. Structure précise du dossier "Nous en amour".
6. Modalités de rédaction des faits `sensitive / variable`.
7. Mapping exact entre `stable / sensitive / indeterminate` et une éventuelle
   abstraction `stable / variable / unavailable`.
8. Mapping exact avec le champ `scope` existant.
9. Persistance future du concept `analysisLens`.
10. Mécanisme exact de déduplication d'une synastrie A/B.
11. Navigation utilisateur : où accéder à "Moi", "Moi en relation", "Moi en
    amour", "Nous".
12. Nom public global du module relationnel.
13. Positionnement commercial / tarification.
14. Politique données tierces / RGPD avant production publique.
15. Future utilisation ou non d'échelles qualitatives.
16. Ajout futur des angles/maisons une fois correctement validés.
17. Traitement plus précis des aspects de cohorte selon l'écart réel entre dates
    de naissance.

## Q. Roadmap

| Etape | Statut |
|---|---|
| Documenter l'état réel du code | CURRENT |
| Corriger le registre méthodologique | CURRENT |
| Stabiliser "Moi en relation" | PARTIAL : Communication relationnelle V1 et Affection V1 validées, quatre axes V1 restants à définir |
| Définir `western-synastry` Amour | TARGET |
| Fixer les orbes et la `methodVersion` | OPEN |
| Implémenter moteur synastrie | FUTURE |
| Etendre evidence/validation aux aspects A↔B | FUTURE |
| Ajouter angles/maisons/overlays après validation externe | DEFERRED |
| Modules Amitié/Famille/Collaboration | DEFERRED |
