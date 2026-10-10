# Doctrine Affection V1 — VALIDATED

Statut :

```text
28 règles doctrinales rédigées
implémentation: NON
validation produit finale: OUI
décisions validées:
  - priorité déterministe entre plusieurs aspects simultanément disponibles
  - maximum un attention_point par axe
  - fallback Venus sign seulement si le signe est stable
```

## Périmètre

```text
axe:
  couvre uniquement la manière de donner
  et de manifester son affection

ne couvre pas:
  - manière de recevoir l'affection
  - besoins affectifs
  - désir ou comportement sexuel
  - séduction ou manière d'entrer en relation
  - formulation ou communication
  - synastrie
```

## Principes de sélection

```text
sélection:
  aspects prioritaires
  maximum de deux aspects développés

si plus de deux aspects Affection certains et éligibles existent:
  calculer pour chaque aspect:
    exactitudeNormalisée = orb absolue / orb maximale autorisée
  classer par exactitudeNormalisée croissante
  puis par orb absolue croissante
  puis par interpretationRuleRef lexicographique
  retenir au maximum les deux premiers

note:
  ce classement ne crée aucune hiérarchie doctrinale
  entre les familles planétaires
  il sert uniquement à choisir les aspects les plus exacts
  relativement à leurs orbes autorisées

si au moins un aspect certain est sélectionné:
  Venus sign non utilisé

si aucun aspect Affection certain n'est disponible:
  fallback Venus sign
  uniquement si le signe est stable

règles génériques natales de Venus sign:
  interdites

point d'attention:
  jamais inventé
  uniquement s'il existe explicitement dans la règle
```

## Politique de certitude

```text
heure exacte:
  aspects utilisables normalement

heure approximative:
  aspect utilisable seulement s'il reste stable
  sur toute la marge déclarée

heure inconnue ou intervalle:
  état actuel du moteur: aucun aspect calculé

note doctrinale:
  cette limite technique actuelle n'interdit pas
  une future utilisation d'un aspect dont la stabilité
  sur toute la plage pourrait être démontrée

fallback Venus sign:
  uniquement si le signe est stable
  sur toute la plage applicable

stabilité du fallback Venus sign:
  heure exacte:
    position calculée à l'heure exacte
  heure approximative:
    même signe sur toute la marge déclarée
  intervalle:
    même signe sur tout l'intervalle
  heure inconnue:
    même signe pendant toute la journée civile locale

si aucun aspect Affection certain n'est disponible
et que le signe de Vénus n'est pas stable:
  l'axe ne produit aucun bloc interprétatif

interdit:
  - utiliser un signe représentatif incertain
  - choisir arbitrairement le signe du début ou de la fin
    de la plage
  - fixer une heure fictive
  - réutiliser une règle natale générique
```

## Politique des points d'attention

```text
conjunction:
  au cas par cas

trine:
  aucun attentionTheme en V1

sextile:
  aucun attentionTheme en V1

square:
  tension d'expression explicitement écrite dans la règle

opposition:
  polarité explicitement écrite dans la règle

interdit:
  le writer ne déduit jamais lui-même
  un point d'attention à partir du type d'aspect

maximum:
  un seul bloc attention_point par axe

si plusieurs aspects sélectionnés possèdent explicitement
un attentionTheme:
  utiliser celui qui arrive en premier selon le même
  classement déterministe que la sélection d'aspects

absence:
  l'absence de point d'attention est valide

interdictions:
  aucun point d'attention ne doit être:
    - déduit du type d'aspect
    - inventé par le planner ou le writer
    - construit par inversion d'une ressource
    - produit depuis une règle dont attentionTheme est absent
```

## Inventaire

```text
Venus sign fallback:
  12 règles

Moon–Venus:
  5 règles

Sun–Venus:
  1 règle
  conjunction uniquement

Venus–Jupiter:
  5 règles

Venus–Saturn:
  5 règles

total:
  28 règles
```

IDs :

```text
western.relational.affection.venus.sign.aries@1
western.relational.affection.venus.sign.taurus@1
western.relational.affection.venus.sign.gemini@1
western.relational.affection.venus.sign.cancer@1
western.relational.affection.venus.sign.leo@1
western.relational.affection.venus.sign.virgo@1
western.relational.affection.venus.sign.libra@1
western.relational.affection.venus.sign.scorpio@1
western.relational.affection.venus.sign.sagittarius@1
western.relational.affection.venus.sign.capricorn@1
western.relational.affection.venus.sign.aquarius@1
western.relational.affection.venus.sign.pisces@1
western.relational.affection.moon_venus.conjunction@1
western.relational.affection.moon_venus.trine@1
western.relational.affection.moon_venus.sextile@1
western.relational.affection.moon_venus.square@1
western.relational.affection.moon_venus.opposition@1
western.relational.affection.sun_venus.conjunction@1
western.relational.affection.venus_jupiter.conjunction@1
western.relational.affection.venus_jupiter.trine@1
western.relational.affection.venus_jupiter.sextile@1
western.relational.affection.venus_jupiter.square@1
western.relational.affection.venus_jupiter.opposition@1
western.relational.affection.venus_saturn.conjunction@1
western.relational.affection.venus_saturn.trine@1
western.relational.affection.venus_saturn.sextile@1
western.relational.affection.venus_saturn.square@1
western.relational.affection.venus_saturn.opposition@1
```

## Venus sign fallback

### `western.relational.affection.venus.sign.aries@1`

```text
ID: western.relational.affection.venus.sign.aries@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée de façon directe,
  spontanée et enthousiaste

dynamique spontanée:
  manifester son affection rapidement et ouvertement,
  par un geste concret ou un élan visible

ressource:
  capacité à rendre son affection explicite
  et à lui donner une forme concrète

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - agressivité
  - jalousie ou possessivité
  - instabilité affective
  - incapacité à s'engager
  - besoin de conquête
  - besoin d'une réponse immédiate
  - libido ou comportement sexuel
  - manière de recevoir l'affection
  - manque d'affection dans les moments calmes
  - initiative de rencontre ou fait de faire le premier pas
    (relève de « Manière d'entrer en relation »)
```

### `western.relational.affection.venus.sign.taurus@1`

```text
ID: western.relational.affection.venus.sign.taurus@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée avec constance,
  par des attentions concrètes et régulières

dynamique spontanée:
  manifester son affection par des gestes tangibles
  et des marques d'attention répétées

ressource:
  capacité à inscrire l'expression de son affection
  dans des gestes concrets et suivis

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - possessivité ou jalousie
  - matérialisme
  - affection nécessairement exprimée par l'argent
    ou par des cadeaux
  - absence d'expression verbale
  - rigidité, entêtement ou résistance au changement
  - lenteur ou passivité dans la relation
  - fidélité garantie ou durée de la relation
  - besoin de sécurité ou de stabilité
    (relève de « Besoins relationnels »)
  - sensualité sexuelle ou libido
    (relève de « Désir, initiative et manière d'agir »)
  - besoin de proximité physique
    (relève de « Besoin d'espace et de proximité »)
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.gemini@1`

```text
ID: western.relational.affection.venus.sign.gemini@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée par la complicité,
  le jeu et la curiosité partagée

dynamique spontanée:
  manifester son affection en partageant des découvertes,
  de l'humour et des moments de complicité ludique

ressource:
  capacité à rendre son affection visible
  par l'intérêt porté aux centres d'intérêt de l'autre
  et par le plaisir de partager avec lui

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - inconstance, superficialité ou dispersion affective
  - infidélité ou difficulté à s'engager
  - détachement émotionnel ou affection « cérébrale »
  - besoin de variété ou de nouveauté
    (relève de « Besoins relationnels »)
  - séduction ou flirt
    (relève de « Manière d'entrer en relation »
    ou de « Désir, initiative et manière d'agir »)
  - affection nécessairement exprimée par les mots
    ou par la conversation
  - manière de formuler, ton, tact, éloquence
    ou qualité de l'expression verbale
    (relève de « Communication relationnelle »)
  - compatibilité intellectuelle avec l'autre
    (relèverait d'une future synastrie)
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.cancer@1`

```text
ID: western.relational.affection.venus.sign.cancer@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée par le soin
  et par l'attention portée à ce qui compte pour l'autre

dynamique spontanée:
  manifester son affection en prenant soin de l'autre,
  par des attentions adaptées à son quotidien
  et par des moments accueillants

ressource:
  capacité à traduire son affection
  en gestes de soin attentifs et concrets

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - surprotection, possessivité ou jalousie
  - susceptibilité, humeur changeante ou repli sur soi
  - dépendance affective
  - rôle parental ou maternel dans la relation
  - capacité à deviner instinctivement les besoins de l'autre
  - besoin d'être rassuré, de sécurité ou de cocon
    (relève de « Besoins relationnels »)
  - besoin de fusion ou de proximité
    (relève de « Besoin d'espace et de proximité »)
  - mémoire affective, attachement au passé ou nostalgie
  - domesticité ou affection nécessairement exprimée
    par le foyer, la cuisine ou la famille
  - manière dont l'autre interprète ces attentions
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.leo@1`

```text
ID: western.relational.affection.venus.sign.leo@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée avec chaleur,
  générosité et de façon visible

dynamique spontanée:
  manifester son affection ouvertement,
  en valorisant l'autre et en exprimant clairement
  ce que l'on apprécie chez lui ou chez elle

ressource:
  capacité à donner des marques d'affection
  chaleureuses, explicites et généreuses

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - besoin d'admiration, d'attention ou de reconnaissance
    (relève de « Besoins relationnels »)
  - orgueil, vanité ou égocentrisme
  - théâtralité ou affection mise en scène
  - démonstration nécessairement publique
  - domination ou volonté de contrôle
  - possessivité ou jalousie
  - affection conditionnelle ou attente de retour
  - générosité nécessairement matérielle ou financière
  - séduction ou volonté de plaire
    (relève de « Manière d'entrer en relation »
    ou de « Désir, initiative et manière d'agir »)
  - manière dont l'autre reçoit ces manifestations
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.virgo@1`

```text
ID: western.relational.affection.venus.sign.virgo@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée par l'aide concrète,
  le service rendu et l'attention aux détails pratiques

dynamique spontanée:
  manifester son affection en proposant une aide utile,
  en rendant service et en portant attention
  aux détails du quotidien

ressource:
  capacité à traduire son affection
  en actes pratiques et en attentions précises

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - esprit critique, exigence ou perfectionnisme
  - froideur ou réserve émotionnelle
  - anxiété ou inquiétude
  - sacrifice de soi ou dévouement excessif
  - volonté de contrôler, corriger ou organiser l'autre
  - compétence pratique ou sens de l'organisation garantis
  - affection nécessairement exprimée
    par les tâches domestiques
  - besoin de se sentir utile
    (relève de « Besoins relationnels »)
  - tendance à donner des solutions ou des conseils
  - manière de formuler ou de conseiller
    (relève de « Communication relationnelle »)
  - manière dont l'autre accueille cette aide
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.libra@1`

```text
ID: western.relational.affection.venus.sign.libra@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée par les égards,
  la considération et la place accordée à l'autre

dynamique spontanée:
  manifester son affection par des attentions délicates
  et en tenant compte des préférences de l'autre
  dans les moments et les choix partagés

ressource:
  capacité à rendre son affection visible
  par des gestes de considération
  et par une véritable place faite à l'autre

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - attente de réciprocité ou de retour affectif
    (relève de « Besoins relationnels »)
  - évitement des conflits ou des désaccords
    (relève de « Manière d'aborder les désaccords »)
  - besoin d'harmonie, d'approbation ou de vivre en couple
    (relève de « Besoins relationnels »)
  - indécision ou hésitation affective
  - superficialité ou attachement aux apparences
  - complaisance ou effacement de soi
  - peur de la solitude
  - séduction ou charme
    (relève de « Manière d'entrer en relation »)
  - tact, ton, formulation ou recherche d'accord dans la parole
    (relève de « Communication relationnelle »)
  - manière dont l'autre réagit à ces égards
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.scorpio@1`

```text
ID: western.relational.affection.venus.sign.scorpio@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée avec intensité,
  profondeur et implication personnelle

dynamique spontanée:
  manifester son affection par un investissement personnel marqué
  et en accordant de l'importance aux moments
  affectivement significatifs dans le lien

ressource:
  capacité à maintenir une présence affectivement engagée
  lorsque la relation traverse un moment difficile
  ou émotionnellement chargé

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - jalousie, possessivité ou méfiance
  - besoin de contrôle, rapport de pouvoir ou manipulation
  - obsession, dépendance ou fusion
  - rancune ou esprit de vengeance
  - goût du secret ou dissimulation
  - fonctionnement affectif en « tout ou rien »
  - fidélité garantie ou promesse de durée de la relation
  - soutien inconditionnel ou disponibilité garantie
  - intensité sexuelle ou libido
    (relève de « Désir, initiative et manière d'agir »)
  - besoin de profondeur, d'exclusivité ou de confiance
    (relève de « Besoins relationnels »)
  - besoin de fusion ou de proximité
    (relève de « Besoin d'espace et de proximité »)
  - préférence pour le tête-à-tête ou discrétion en groupe
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.sagittarius@1`

```text
ID: western.relational.affection.venus.sign.sagittarius@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée par l'enthousiasme,
  l'encouragement et le partage d'expériences

dynamique spontanée:
  manifester son affection en proposant des découvertes,
  des projets ou des expériences à vivre ensemble

ressource:
  capacité à exprimer son affection
  en soutenant les projets de l'autre
  et en ouvrant des possibilités à partager

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - inconstance, infidélité ou difficulté à s'engager
  - fuite, désinvolture ou légèreté affective
  - imprudence ou goût du risque
  - optimisme permanent ou tempérament forcément positif
  - absence d'attentions dans le quotidien
  - besoin de liberté ou d'indépendance
    (relève de « Besoin d'espace et de proximité »)
  - besoin d'aventure, de voyage ou de nouveauté
    (relève de « Besoins relationnels »)
  - capacité à faire grandir ou évoluer l'autre
  - franchise ou manière de dire les choses
    (relève de « Communication relationnelle »)
  - séduction ou goût de la conquête
    (relève de « Manière d'entrer en relation »)
  - compatibilité philosophique, morale ou spirituelle
    (relèverait d'une future synastrie)
  - manière dont l'autre réagit à ces propositions
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.capricorn@1`

```text
ID: western.relational.affection.venus.sign.capricorn@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée par une implication suivie,
  le soutien de ce qui se construit
  et la contribution aux responsabilités partagées

dynamique spontanée:
  manifester son affection en soutenant les objectifs de l'autre
  et en prenant une part concrète
  dans les engagements décidés ensemble

ressource:
  capacité à traduire son affection
  en implication dans des projets et des responsabilités
  qui demandent de la continuité

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - froideur, distance ou difficulté à exprimer ses émotions
  - rigidité ou austérité
  - calcul, intérêt ou ambition dans la relation
  - autorité ou volonté de contrôle
  - pessimisme ou méfiance
  - lenteur à s'engager ou peur de l'engagement
  - importance du statut social ou des apparences
  - soutien nécessairement professionnel ou financier
  - sens des responsabilités ou fiabilité garantis
  - fidélité garantie ou promesse de durée de la relation
  - besoin de sécurité, de stabilité ou de cadre
    (relève de « Besoins relationnels »)
  - manière dont l'autre vit ou évalue cette implication
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.aquarius@1`

```text
ID: western.relational.affection.venus.sign.aquarius@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée de manière personnalisée,
  en accordant de l'importance à la singularité de l'autre

dynamique spontanée:
  manifester son affection par des attentions personnalisées,
  inspirées par les goûts, les intérêts ou les particularités
  de l'autre

ressource:
  capacité à donner à son affection une forme personnelle,
  même lorsqu'elle ne suit pas les codes habituels

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - acceptation inconditionnelle ou absence totale de jugement
  - détachement, froideur ou distance émotionnelle
  - affection « amicale plutôt qu'amoureuse »
  - excentricité, provocation ou goût de la rébellion
  - originalité ou créativité garanties
  - imprévisibilité ou instabilité affective
  - difficulté à s'engager
  - intellectualisation des sentiments
  - opinions politiques, sociales ou humanitaires particulières
  - besoin de liberté, d'indépendance ou d'espace
    (relève de « Besoin d'espace et de proximité »)
  - respect ou gestion de l'autonomie de l'autre
    (relève de « Besoin d'espace et de proximité »)
  - manière dont l'autre interprète ces attentions
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

### `western.relational.affection.venus.sign.pisces@1`

```text
ID: western.relational.affection.venus.sign.pisces@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  fallback uniquement
  utilisé seulement en l'absence d'aspect Affection

sens central:
  une affection exprimée avec tendresse,
  par une attention aux émotions exprimées
  et par des gestes délicats ou symboliques

dynamique spontanée:
  manifester son affection par des attentions sensibles
  ou évocatrices, particulièrement dans les moments
  émotionnellement significatifs

ressource:
  capacité à donner à son affection
  une expression tendre, nuancée et symbolique

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - capacité à deviner ce que l'autre ressent
  - empathie parfaite ou compréhension émotionnelle garantie
  - hypersensibilité ou intuition particulière
  - sacrifice de soi ou dévouement excessif
  - idéalisation, illusion ou naïveté
  - romantisme irréaliste
  - amour inconditionnel ou compassion universelle
  - manque de limites ou confusion
  - fuite ou évitement
  - dépendance affective
  - posture de sauveur ou de victime
  - absence de gestes concrets
  - talent artistique, spiritualité ou médiumnité
  - besoin de fusion ou de proximité
    (relève de « Besoin d'espace et de proximité »)
  - besoin d'être compris ou soutenu
    (relève de « Besoins relationnels »)
  - manière dont l'autre interprète les gestes symboliques
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
```

## Moon–Venus

Politique de sélection commune :

```text
heure exacte:
  aspect utilisable normalement

heure approximative:
  aspect utilisable uniquement s'il reste stable
  sur toute la marge déclarée

heure inconnue ou intervalle:
  aspect indisponible
  le moteur actuel ne calcule aucun aspect dans ces cas

aspect Moon–Venus exclu ou incertain:
  poursuivre la sélection parmi les autres aspects Affection certains

fallback Venus sign:
  utilisé uniquement si aucun aspect Affection certain ne reste
  et si le signe de Vénus est lui-même stable
```

Interdictions communes aux règles Moon–Venus :

```text
ne permet pas d'affirmer:
  - besoin d'être rassuré ou protégé
    (relève de « Besoins relationnels »)
  - besoin de fusion ou de proximité
    (relève de « Besoin d'espace et de proximité »)
  - dépendance affective
  - rôle maternel, parental ou protecteur
  - capacité à deviner les émotions de l'autre
  - empathie parfaite ou compréhension émotionnelle garantie
  - harmonie émotionnelle garantie ou absence de conflits
  - facilité relationnelle générale
  - réussite ou stabilité de la relation
  - manière de recevoir l'affection
  - compatibilité ou incompatibilité émotionnelle
    avec une autre personne
    (relèverait d'une future synastrie)
```

Distinction doctrinale :

```text
conjonction:
  sensibilité, soin et affection étroitement associés

trigone:
  circulation fluide et cohérente entre attention émotionnelle
  et expression de l'affection

sextile:
  capacité disponible, mobilisée lorsque le contexte
  offre une occasion de manifester son affection

carré:
  tension entre les deux registres ;
  le soin peut tenir lieu d'expression affective
  sans marque de tendresse distincte au même moment

opposition:
  polarité entre les deux registres ;
  l'un peut momentanément prendre davantage de place
  que l'autre
```

### `western.relational.affection.moon_venus.conjunction@1`

```text
ID: western.relational.affection.moon_venus.conjunction@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

sens central:
  proximité entre la sensibilité affective,
  le soin et la manière de manifester son affection

dynamique spontanée:
  manifester son affection par la tendresse,
  le soin et une attention portée
  aux émotions exprimées par l'autre

ressource:
  capacité à traduire son attention émotionnelle
  en marques d'affection visibles et concrètes

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - besoin d'être rassuré ou protégé
    (relève de « Besoins relationnels »)
  - besoin de fusion ou de proximité
    (relève de « Besoin d'espace et de proximité »)
  - dépendance affective
  - rôle maternel, parental ou protecteur
  - capacité à deviner les émotions de l'autre
  - empathie parfaite ou compréhension émotionnelle garantie
  - humeur changeante ou hypersensibilité
  - harmonie émotionnelle garantie ou absence de conflits
  - facilité relationnelle générale
  - réussite ou stabilité de la relation
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité ou incompatibilité émotionnelle
    avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.moon_venus.trine@1`

```text
ID: western.relational.affection.moon_venus.trine@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche l'utilisation du fallback Venus sign lorsqu'il est retenu

sens central:
  accord fluide entre la sensibilité affective
  et la manière de manifester son affection

dynamique spontanée:
  exprimer sa tendresse de manière fluide
  dans les gestes et les attentions de la relation

ressource:
  capacité à maintenir une cohérence
  entre l'attention émotionnelle
  et les marques d'affection exprimées

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - besoin d'être rassuré ou protégé
    (relève de « Besoins relationnels »)
  - besoin de fusion ou de proximité
    (relève de « Besoin d'espace et de proximité »)
  - dépendance affective
  - rôle maternel, parental ou protecteur
  - capacité à deviner les émotions de l'autre
  - empathie parfaite ou compréhension émotionnelle garantie
  - harmonie émotionnelle garantie ou absence de conflits
  - facilité relationnelle générale
  - réussite ou stabilité de la relation
  - manière de recevoir l'affection
  - compatibilité ou incompatibilité émotionnelle
    avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.moon_venus.sextile@1`

```text
ID: western.relational.affection.moon_venus.sextile@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche l'utilisation du fallback Venus sign lorsqu'il est retenu

sens central:
  possibilité de mobiliser sa sensibilité affective
  pour manifester son affection lorsque le contexte s'y prête

dynamique spontanée:
  saisir les moments propices pour manifester sa tendresse
  par une attention liée à la situation

ressource:
  capacité à adapter la forme de ses marques d'affection
  au contexte du moment

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - besoin d'être rassuré ou protégé
    (relève de « Besoins relationnels »)
  - besoin de fusion ou de proximité
    (relève de « Besoin d'espace et de proximité »)
  - dépendance affective
  - rôle maternel, parental ou protecteur
  - capacité à deviner les émotions de l'autre
  - empathie parfaite ou compréhension émotionnelle garantie
  - harmonie émotionnelle garantie ou absence de conflits
  - facilité relationnelle générale
  - réussite ou stabilité de la relation
  - manière de recevoir l'affection
  - compatibilité ou incompatibilité émotionnelle
    avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.moon_venus.square@1`

```text
ID: western.relational.affection.moon_venus.square@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  politique de sélection Moon–Venus commune
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu

sens central:
  tension entre la sensibilité émotionnelle,
  le soin et la manière de manifester son affection

dynamique spontanée:
  le soin concret et la tendresse explicite occupent
  tous deux une place dans la manière de manifester
  son affection

ressource:
  capacité à réunir une attention concrète et une marque
  de tendresse explicite dans une même manifestation

point d'attention:
  le soin que la personne apporte peut parfois
  tenir lieu d'expression affective,
  sans qu'une marque de tendresse distincte
  soit exprimée au même moment

ne permet pas d'affirmer:
  - absence d'affection ou de tendresse
  - incapacité à aimer ou à prendre soin de l'autre
  - difficulté générale à exprimer ses sentiments
  - contradiction permanente ou ambivalence affective
  - instabilité émotionnelle ou humeur changeante
  - conflits relationnels garantis
  - insatisfaction affective
  - besoin d'être rassuré ou protégé
    (relève de « Besoins relationnels »)
  - besoin de fusion ou de proximité
    (relève de « Besoin d'espace et de proximité »)
  - dépendance affective
  - rôle maternel, parental ou protecteur
  - capacité à deviner les émotions de l'autre
  - incompréhension garantie de la part de l'autre
  - échec ou instabilité de la relation
  - manière de recevoir l'affection
  - compatibilité ou incompatibilité émotionnelle
    avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.moon_venus.opposition@1`

```text
ID: western.relational.affection.moon_venus.opposition@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  politique de sélection Moon–Venus commune
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu

sens central:
  polarité entre la sensibilité émotionnelle,
  le soin et la manière de manifester son affection

dynamique spontanée:
  manifester son affection par le soin et l'attention
  émotionnelle comme par des marques de tendresse explicites

ressource:
  capacité à mobiliser selon le moment
  le registre du soin ou celui de la tendresse

point d'attention:
  l'un des deux registres peut momentanément prendre
  davantage de place que l'autre, de sorte que le soin
  et la tendresse explicite ne sont pas toujours
  manifestés en même temps

ne permet pas d'affirmer:
  - absence d'affection ou de tendresse
  - incapacité à aimer ou à prendre soin de l'autre
  - difficulté générale à exprimer ses sentiments
  - contradiction permanente ou ambivalence affective
  - alternance systématique ou comportement imprévisible
  - instabilité émotionnelle ou humeur changeante
  - conflits relationnels garantis
  - insatisfaction affective
  - besoin d'être rassuré ou protégé
    (relève de « Besoins relationnels »)
  - besoin de fusion ou de proximité
    (relève de « Besoin d'espace et de proximité »)
  - dépendance affective
  - rôle maternel, parental ou protecteur
  - capacité à deviner les émotions de l'autre
  - projection de l'un des deux registres sur le partenaire
  - incompréhension garantie de la part de l'autre
  - échec ou instabilité de la relation
  - manière de recevoir l'affection
  - compatibilité ou incompatibilité émotionnelle
    avec une autre personne
    (relèverait d'une future synastrie)
```

## Sun–Venus

Contraintes astronomiques V1 :

```text
Sun–Venus:
  conjunction: règle autorisée
  sextile: aucune règle
  square: aucune règle
  trine: aucune règle
  opposition: aucune règle

raison:
  parmi les cinq aspects majeurs retenus,
  seule la conjonction est astronomiquement possible
  entre le Soleil et Vénus en natal
```

### `western.relational.affection.sun_venus.conjunction@1`

```text
ID: western.relational.affection.sun_venus.conjunction@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

note technique actuelle:
  le moteur ne calcule actuellement aucun aspect
  pour une heure inconnue ou un intervalle
  cette limite technique ne fait pas partie de la doctrine
  si le moteur sait ultérieurement établir que l'aspect
  est stable sur toute la plage, cette règle pourra s'appliquer

sens central:
  proximité entre l'expression personnelle,
  ce qui est valorisé et la manière de manifester son affection

dynamique spontanée:
  manifester son affection en exprimant
  l'estime et l'importance accordées à l'autre

ressource:
  capacité à donner à ses marques d'affection
  une forme personnelle, explicite et assumée

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - charme, beauté ou pouvoir de séduction
  - popularité ou facilité à plaire
  - talent artistique ou sens esthétique particulier
  - narcissisme, vanité ou égocentrisme
  - besoin d'admiration, d'approbation ou de reconnaissance
    (relève de « Besoins relationnels »)
  - estime de soi élevée ou faible
  - affection nécessairement démonstrative ou publique
  - générosité permanente
  - fidélité garantie ou engagement durable
  - harmonie ou réussite de la relation
  - formulation, tact ou qualité de la parole
    (relève de « Communication relationnelle »)
  - attirance, désir ou comportement sexuel
    (relève de « Désir, initiative et manière d'agir »)
  - initiative de rencontre ou volonté de plaire
    (relève de « Manière d'entrer en relation »)
  - manière dont l'autre reçoit cette valorisation
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

## Venus–Jupiter

Interdictions communes :

```text
ne permet pas d'affirmer:
  - extravagance permanente
  - démesure présentée comme un trait général
  - dépenses, cadeaux coûteux ou affection exprimée par l'argent
  - chance en amour ou facilité à trouver un partenaire
  - multiplicité des relations ou infidélité
  - promesses non tenues ou engagement superficiel
  - indulgence excessive ou complaisance
  - attitude protectrice, paternaliste ou condescendante
  - convictions morales, religieuses ou philosophiques
  - besoin de plaisir, de confort ou d'abondance
    (relève de « Besoins relationnels »)
  - réussite ou harmonie de la relation
  - manière dont l'autre réagit aux encouragements
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

Distinction doctrinale :

```text
conjonction:
  affection et générosité étroitement associées

trigone:
  circulation fluide entre affection,
  générosité et encouragement

sextile:
  générosité mobilisée lorsqu'une occasion se présente

carré:
  tension portant sur l'amplification
  d'une marque d'affection

opposition:
  polarité entre une expression ciblée
  et une expression plus large
```

### `western.relational.affection.venus_jupiter.conjunction@1`

```text
ID: western.relational.affection.venus_jupiter.conjunction@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

note technique actuelle:
  le moteur ne calcule actuellement aucun aspect
  pour une heure inconnue ou un intervalle
  cette limite technique ne fait pas partie de la doctrine
  si le moteur sait ultérieurement établir qu'un aspect
  est stable sur toute la plage, la règle correspondante
  pourra s'appliquer

sens central:
  affection et générosité étroitement associées

dynamique spontanée:
  manifester son affection avec générosité,
  en donnant volontiers de son temps et de son attention

ressource:
  capacité à associer ses marques d'affection
  à l'encouragement et au soutien des initiatives de l'autre

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - extravagance permanente
  - démesure présentée comme un trait général
  - dépenses, cadeaux coûteux ou affection exprimée par l'argent
  - chance en amour ou facilité à trouver un partenaire
  - multiplicité des relations ou infidélité
  - promesses non tenues ou engagement superficiel
  - indulgence excessive ou complaisance
  - attitude protectrice, paternaliste ou condescendante
  - convictions morales, religieuses ou philosophiques
  - besoin de plaisir, de confort ou d'abondance
    (relève de « Besoins relationnels »)
  - réussite ou harmonie de la relation
  - manière dont l'autre réagit aux encouragements
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.venus_jupiter.trine@1`

```text
ID: western.relational.affection.venus_jupiter.trine@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

note technique actuelle:
  le moteur ne calcule actuellement aucun aspect
  pour une heure inconnue ou un intervalle
  cette limite technique ne fait pas partie de la doctrine
  si le moteur sait ultérieurement établir qu'un aspect
  est stable sur toute la plage, la règle correspondante
  pourra s'appliquer

sens central:
  circulation fluide entre l'affection,
  la générosité et l'encouragement

dynamique spontanée:
  exprimer son affection par une présence généreuse
  et des encouragements dans le cours de la relation

ressource:
  capacité à associer de manière fluide
  marques d'affection et soutien chaleureux

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - extravagance permanente
  - démesure présentée comme un trait général
  - dépenses, cadeaux coûteux ou affection exprimée par l'argent
  - chance en amour ou facilité à trouver un partenaire
  - multiplicité des relations ou infidélité
  - promesses non tenues ou engagement superficiel
  - indulgence excessive ou complaisance
  - attitude protectrice, paternaliste ou condescendante
  - convictions morales, religieuses ou philosophiques
  - besoin de plaisir, de confort ou d'abondance
    (relève de « Besoins relationnels »)
  - réussite ou harmonie de la relation
  - manière dont l'autre réagit aux encouragements
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.venus_jupiter.sextile@1`

```text
ID: western.relational.affection.venus_jupiter.sextile@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

note technique actuelle:
  le moteur ne calcule actuellement aucun aspect
  pour une heure inconnue ou un intervalle
  cette limite technique ne fait pas partie de la doctrine
  si le moteur sait ultérieurement établir qu'un aspect
  est stable sur toute la plage, la règle correspondante
  pourra s'appliquer

sens central:
  générosité affective disponible,
  mobilisée lorsqu'une occasion se présente

dynamique spontanée:
  saisir les occasions de faire plaisir à l'autre
  ou de l'encourager

ressource:
  capacité à mobiliser une présence chaleureuse
  ou un encouragement dans une situation concrète

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - extravagance permanente
  - démesure présentée comme un trait général
  - dépenses, cadeaux coûteux ou affection exprimée par l'argent
  - chance en amour ou facilité à trouver un partenaire
  - multiplicité des relations ou infidélité
  - promesses non tenues ou engagement superficiel
  - indulgence excessive ou complaisance
  - attitude protectrice, paternaliste ou condescendante
  - convictions morales, religieuses ou philosophiques
  - besoin de plaisir, de confort ou d'abondance
    (relève de « Besoins relationnels »)
  - réussite ou harmonie de la relation
  - manière dont l'autre réagit aux encouragements
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.venus_jupiter.square@1`

```text
ID: western.relational.affection.venus_jupiter.square@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

note technique actuelle:
  le moteur ne calcule actuellement aucun aspect
  pour une heure inconnue ou un intervalle
  cette limite technique ne fait pas partie de la doctrine
  si le moteur sait ultérieurement établir qu'un aspect
  est stable sur toute la plage, la règle correspondante
  pourra s'appliquer

sens central:
  tension entre l'élan affectif
  et l'ampleur donnée à son expression

dynamique spontanée:
  manifester son affection avec élan et générosité

ressource:
  capacité à investir largement du temps
  et de l'attention dans ses marques d'affection

point d'attention:
  l'élan généreux peut parfois donner
  à une marque d'affection une ampleur
  plus importante que sa forme initiale

ne permet pas d'affirmer:
  - extravagance permanente
  - démesure présentée comme un trait général
  - dépenses, cadeaux coûteux ou affection exprimée par l'argent
  - chance en amour ou facilité à trouver un partenaire
  - multiplicité des relations ou infidélité
  - promesses non tenues ou engagement superficiel
  - indulgence excessive ou complaisance
  - attitude protectrice, paternaliste ou condescendante
  - convictions morales, religieuses ou philosophiques
  - besoin de plaisir, de confort ou d'abondance
    (relève de « Besoins relationnels »)
  - réussite ou harmonie de la relation
  - manière dont l'autre réagit aux encouragements
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.venus_jupiter.opposition@1`

```text
ID: western.relational.affection.venus_jupiter.opposition@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

note technique actuelle:
  le moteur ne calcule actuellement aucun aspect
  pour une heure inconnue ou un intervalle
  cette limite technique ne fait pas partie de la doctrine
  si le moteur sait ultérieurement établir qu'un aspect
  est stable sur toute la plage, la règle correspondante
  pourra s'appliquer

sens central:
  polarité entre une marque d'affection centrée sur le lien
  et un mouvement plus large de générosité ou d'encouragement

dynamique spontanée:
  manifester son affection par des attentions personnelles
  comme par un soutien ou des encouragements plus larges

ressource:
  capacité à mobiliser selon le moment
  une expression affective ciblée ou plus ample

point d'attention:
  l'une de ces deux échelles d'expression peut momentanément
  prendre davantage de place que l'autre,
  de sorte que l'attention personnelle
  et l'élan généreux ne sont pas toujours associés

ne permet pas d'affirmer:
  - extravagance permanente
  - démesure présentée comme un trait général
  - dépenses, cadeaux coûteux ou affection exprimée par l'argent
  - chance en amour ou facilité à trouver un partenaire
  - multiplicité des relations ou infidélité
  - promesses non tenues ou engagement superficiel
  - indulgence excessive ou complaisance
  - attitude protectrice, paternaliste ou condescendante
  - convictions morales, religieuses ou philosophiques
  - besoin de plaisir, de confort ou d'abondance
    (relève de « Besoins relationnels »)
  - réussite ou harmonie de la relation
  - manière dont l'autre réagit aux encouragements
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

## Venus–Saturn

Interdictions communes, recopiées intégralement sous chaque règle :

```text
ne permet pas d'affirmer:
  - froideur, distance ou absence émotionnelle
  - incapacité à aimer ou à exprimer son affection
  - blocage affectif ou inhibition permanente
  - peur de l'intimité, du rejet ou de l'abandon
  - frustration, privation ou manque d'affection
  - pessimisme ou méfiance
  - rigidité, contrôle ou autorité dans la relation
  - affection vécue comme une obligation ou un devoir
  - sacrifice de soi ou dévouement imposé
  - affection conditionnelle, devant être gagnée ou méritée
  - lenteur systématique à s'engager
  - différence d'âge ou attirance pour une personne plus âgée
  - fidélité garantie ou promesse de durée de la relation
  - relation karmique, destinée ou inévitable
  - besoin de sécurité, de stabilité ou de cadre
    (relève de « Besoins relationnels »)
  - statut social, ambition ou réussite professionnelle
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.venus_saturn.conjunction@1`

```text
ID: western.relational.affection.venus_saturn.conjunction@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

sens central:
  affection, mesure et continuité
  étroitement associées

dynamique spontanée:
  manifester son affection par des gestes suivis
  et par une implication concrète dans la relation

ressource:
  capacité à donner à l'expression de son affection
  une forme concrète qui s'inscrit dans la durée

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - froideur, distance ou absence émotionnelle
  - incapacité à aimer ou à exprimer son affection
  - blocage affectif ou inhibition permanente
  - peur de l'intimité, du rejet ou de l'abandon
  - frustration, privation ou manque d'affection
  - pessimisme ou méfiance
  - rigidité, contrôle ou autorité dans la relation
  - affection vécue comme une obligation ou un devoir
  - sacrifice de soi ou dévouement imposé
  - affection conditionnelle, devant être gagnée ou méritée
  - lenteur systématique à s'engager
  - différence d'âge ou attirance pour une personne plus âgée
  - fidélité garantie ou promesse de durée de la relation
  - relation karmique, destinée ou inévitable
  - besoin de sécurité, de stabilité ou de cadre
    (relève de « Besoins relationnels »)
  - statut social, ambition ou réussite professionnelle
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.venus_saturn.trine@1`

```text
ID: western.relational.affection.venus_saturn.trine@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

sens central:
  accord fluide entre l'affection,
  la constance et la mesure

dynamique spontanée:
  exprimer son affection par des gestes réguliers,
  cohérents et suivis dans le temps

ressource:
  capacité à associer de manière fluide
  marques d'affection et continuité

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - froideur, distance ou absence émotionnelle
  - incapacité à aimer ou à exprimer son affection
  - blocage affectif ou inhibition permanente
  - peur de l'intimité, du rejet ou de l'abandon
  - frustration, privation ou manque d'affection
  - pessimisme ou méfiance
  - rigidité, contrôle ou autorité dans la relation
  - affection vécue comme une obligation ou un devoir
  - sacrifice de soi ou dévouement imposé
  - affection conditionnelle, devant être gagnée ou méritée
  - lenteur systématique à s'engager
  - différence d'âge ou attirance pour une personne plus âgée
  - fidélité garantie ou promesse de durée de la relation
  - relation karmique, destinée ou inévitable
  - besoin de sécurité, de stabilité ou de cadre
    (relève de « Besoins relationnels »)
  - statut social, ambition ou réussite professionnelle
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.venus_saturn.sextile@1`

```text
ID: western.relational.affection.venus_saturn.sextile@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

sens central:
  capacité disponible pour donner une suite concrète
  à une marque d'affection

dynamique spontanée:
  saisir les occasions d'inscrire une marque d'affection
  dans un acte concret ou un engagement précis

ressource:
  capacité à prolonger une marque d'affection
  par un acte concret lorsque la situation s'y prête

point d'attention:
  absent en V1

ne permet pas d'affirmer:
  - froideur, distance ou absence émotionnelle
  - incapacité à aimer ou à exprimer son affection
  - blocage affectif ou inhibition permanente
  - peur de l'intimité, du rejet ou de l'abandon
  - frustration, privation ou manque d'affection
  - pessimisme ou méfiance
  - rigidité, contrôle ou autorité dans la relation
  - affection vécue comme une obligation ou un devoir
  - sacrifice de soi ou dévouement imposé
  - affection conditionnelle, devant être gagnée ou méritée
  - lenteur systématique à s'engager
  - différence d'âge ou attirance pour une personne plus âgée
  - fidélité garantie ou promesse de durée de la relation
  - relation karmique, destinée ou inévitable
  - besoin de sécurité, de stabilité ou de cadre
    (relève de « Besoins relationnels »)
  - statut social, ambition ou réussite professionnelle
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.venus_saturn.square@1`

```text
ID: western.relational.affection.venus_saturn.square@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

sens central:
  tension entre l'élan affectif
  et la volonté de lui donner une forme mesurée ou durable

dynamique spontanée:
  manifester son affection par des gestes réfléchis,
  concrets et investis

ressource:
  capacité à transformer un élan affectif
  en une marque d'affection construite et suivie

point d'attention:
  l'expression de l'affection peut parfois être différée
  pendant que la personne cherche une forme
  qu'elle estime pouvoir réellement soutenir

ne permet pas d'affirmer:
  - froideur, distance ou absence émotionnelle
  - incapacité à aimer ou à exprimer son affection
  - blocage affectif ou inhibition permanente
  - peur de l'intimité, du rejet ou de l'abandon
  - frustration, privation ou manque d'affection
  - pessimisme ou méfiance
  - rigidité, contrôle ou autorité dans la relation
  - affection vécue comme une obligation ou un devoir
  - sacrifice de soi ou dévouement imposé
  - affection conditionnelle, devant être gagnée ou méritée
  - lenteur systématique à s'engager
  - différence d'âge ou attirance pour une personne plus âgée
  - fidélité garantie ou promesse de durée de la relation
  - relation karmique, destinée ou inévitable
  - besoin de sécurité, de stabilité ou de cadre
    (relève de « Besoins relationnels »)
  - statut social, ambition ou réussite professionnelle
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

### `western.relational.affection.venus_saturn.opposition@1`

```text
ID: western.relational.affection.venus_saturn.opposition@1
axe propriétaire: affection
provenance: LASTRO_RULE

sélection:
  aspect prioritaire
  compte dans le maximum de deux aspects développés
  empêche le fallback Venus sign lorsqu'il est retenu
  utilisable uniquement lorsque l'aspect est considéré
  comme certain selon la politique commune de stabilité

sens central:
  polarité entre l'expression spontanée de l'affection
  et une expression plus réfléchie et suivie

dynamique spontanée:
  manifester son affection par des gestes directs
  comme par des engagements concrets dans la relation

ressource:
  capacité à mobiliser selon le moment
  l'élan spontané ou l'engagement suivi

point d'attention:
  l'élan spontané et l'engagement suivi peuvent
  s'exprimer à des moments différents
  plutôt que dans un même geste

ne permet pas d'affirmer:
  - froideur, distance ou absence émotionnelle
  - incapacité à aimer ou à exprimer son affection
  - blocage affectif ou inhibition permanente
  - peur de l'intimité, du rejet ou de l'abandon
  - frustration, privation ou manque d'affection
  - pessimisme ou méfiance
  - rigidité, contrôle ou autorité dans la relation
  - affection vécue comme une obligation ou un devoir
  - sacrifice de soi ou dévouement imposé
  - affection conditionnelle, devant être gagnée ou méritée
  - lenteur systématique à s'engager
  - différence d'âge ou attirance pour une personne plus âgée
  - fidélité garantie ou promesse de durée de la relation
  - relation karmique, destinée ou inévitable
  - besoin de sécurité, de stabilité ou de cadre
    (relève de « Besoins relationnels »)
  - statut social, ambition ou réussite professionnelle
  - manière de recevoir l'affection
    (relève de « Besoins relationnels »)
  - compatibilité avec une autre personne
    (relèverait d'une future synastrie)
```

## Frontières entre familles

```text
Moon–Venus:
  soin et tendresse

Sun–Venus:
  estime et expression personnelle

Venus–Jupiter:
  générosité, soutien et encouragement

Venus–Saturn:
  constance, sérieux et engagement
```

## DÉCISIONS VALIDÉES — À IMPLÉMENTER ULTÉRIEUREMENT

1. Priorité entre aspects :
   lorsque plus de deux aspects Affection certains et éligibles
   sont disponibles, le classement déterministe par exactitude
   normalisée, orb absolue, puis `interpretationRuleRef`
   lexicographique sélectionne au maximum deux aspects.

2. Points d'attention :
   l'axe Affection produit au maximum un seul `attention_point`.
   S'il existe plusieurs `attentionThemes` explicites parmi les
   aspects sélectionnés, le même classement déterministe choisit
   celui qui est développé.

3. Stabilité du fallback :
   le fallback Venus sign ne peut être utilisé que si le signe de
   Vénus est certain sur toute la plage temporelle applicable.
   Si aucun aspect certain n'est disponible et que le signe de
   Vénus n'est pas stable, l'axe ne produit aucun bloc
   interprétatif.
