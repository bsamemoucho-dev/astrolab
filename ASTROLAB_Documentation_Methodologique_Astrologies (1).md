# ASTROLAB — Documentation méthodologique des traditions astrologiques et systèmes apparentés

**Version 0.1 — dossier de recherche pour le développement**  
**Date : 31 août 2026**

> Ce document est destiné à servir de référence au cadrage méthodologique d’AstroLab.  
> Il ne prétend pas être une encyclopédie exhaustive de toutes les pratiques astrologiques existantes. Il définit une cartographie structurée des grandes familles pertinentes pour le produit, ce qui peut être calculé à partir des données de naissance, ce qui exige d’autres données ou un praticien, et la manière dont chaque tradition doit être isolée avant toute comparaison transversale.

---

# 1. Règle fondamentale

AstroLab ne doit pas traiter « l’astrologie » comme un système unique.

Une tradition peut être :

- astrologique ;
- calendérique ;
- divinatoire ;
- astronomique ;
- rituelle ;
- historique ;
- ou un mélange de plusieurs de ces dimensions.

Le produit doit conserver cette distinction.

## Principe de séparation

Pour chaque système :

**Tradition → école → méthode → données → calcul → résultat → interprétation → comparaison**

Aucune étape ne doit être remplacée par une génération libre de texte.

---

# 2. Classification utilisée par AstroLab

Chaque système étudié reçoit un des statuts suivants.

| Statut | Signification |
|---|---|
| CALCULABLE | Peut être calculé automatiquement avec des règles suffisamment documentées |
| CALCULABLE SOUS CONDITIONS | Possible seulement avec certaines données ou conventions |
| HISTORIQUE | Reconstruction possible, mais documentation ou continuité insuffisante pour une utilisation commerciale directe |
| DIVINATOIRE | Le résultat dépend d’une opération de divination ou d’un praticien |
| CULTUREL | Peut être documenté sans être transformé en moteur prédictif |
| LABORATOIRE | Hypothèse ou méthode encore en validation |
| EXCLU | Ne pas implémenter en production sans nouvelle décision |

---

# 3. Données communes

Le modèle commun doit pouvoir représenter :

- date de naissance ;
- heure de naissance ;
- précision de l’heure ;
- fuseau horaire ;
- lieu de naissance ;
- coordonnées géographiques ;
- calendrier utilisé ;
- système de coordonnées ;
- convention zodiacale ;
- époque astronomique ;
- données manquantes ;
- données contradictoires ;
- source ;
- niveau de confiance.

Une donnée de naissance ne doit jamais être réduite à une valeur sans contexte.

---

# 4. Famille A — Mésopotamie / Babylonie

## 4.1 Nature

Les traditions mésopotamiennes constituent une source historique majeure de la divination céleste puis de l’astrologie horoscopique.

Des horoscopes babyloniens sont attestés directement par des tablettes cunéiformes conservées notamment au British Museum. Certaines sont explicitement décrites comme des horoscopes pour un nouveau-né ou comme des horoscopes de l’époque séleucide.

Sources :
- British Museum, tablette 78089 : https://www.britishmuseum.org/collection/object/W_1886-0617-5
- British Museum, tablette 38104 : https://www.britishmuseum.org/collection/object/W_1880-1012-6
- Encyclopaedia Iranica, Zodiac : https://www.iranicaonline.org/articles/zodiac/

## 4.2 Caractéristiques

Le développement mésopotamien comporte plusieurs couches :

- présages célestes ;
- observations astronomiques ;
- signes zodiacaux ;
- horoscopes individuels ;
- interprétation de positions célestes ;
- développement ultérieur de systèmes plus mathématiques.

Le zodiaque standard à douze signes est attesté dans la tradition mésopotamienne à partir du premier millénaire avant notre ère et son développement est lié à la période séleucide.

## 4.3 Ce qu’AstroLab peut faire

### V1 / expérimental

Reconstruire uniquement les éléments historiquement documentables.

Exemples de sortie :

- date historique ;
- positions pertinentes ;
- signes utilisés selon la reconstruction ;
- observations attestées ;
- règles interprétatives documentées.

## 4.4 Ce qu’AstroLab ne doit pas faire

Ne pas présenter une reconstruction moderne comme :

> « l’astrologie babylonienne exacte ».

Utiliser plutôt :

> « reconstruction selon les éléments documentés ».

## 4.5 Données nécessaires

- date ;
- heure si la méthode reconstruite l’exige ;
- lieu ;
- convention historique ;
- tables astronomiques adaptées.

## 4.6 Statut recommandé

**HISTORIQUE / LABORATOIRE**

---

# 5. Famille B — Égypte ancienne

## 5.1 Nature

L’Égypte ancienne possède une tradition astronomique et calendérique extrêmement riche.

Les décans constituent des groupes stellaires utilisés notamment pour mesurer le temps nocturne.

Le Metropolitan Museum documente des plafonds astronomiques avec constellations, décans, planètes et divisions temporelles.

Sources :
- Metropolitan Museum, Astronomical Ceiling : https://www.metmuseum.org/art/collection/search/544566
- Metropolitan Museum, Telling Time in Ancient Egypt : https://www.metmuseum.org/essays/telling-time-in-ancient-egypt
- Metropolitan Museum, Bastet and decans : https://www.metmuseum.org/art/collection/search/546227

## 5.2 Attention méthodologique

Il serait incorrect de présenter toute l’astronomie religieuse égyptienne comme une astrologie natale moderne.

Le système des décans a notamment une fonction de mesure du temps et possède des dimensions religieuses et calendériques.

Le zodiaque égyptien tardif est également différent des systèmes modernes.

## 5.3 Utilisation AstroLab

### V1

Module culturel/historique.

### Laboratoire

Reconstruction de certaines pratiques astrales documentées.

### Pas de V1

Créer automatiquement :

> « votre astrologie égyptienne »

à partir d’une simple date de naissance.

## 5.4 Statut

**CULTUREL / HISTORIQUE**

---

# 6. Famille C — Astrologie hellénistique et occidentale

## 6.1 Nature

C’est la famille la plus adaptée à un moteur horoscopique moderne, à condition de distinguer les écoles.

Elle comprend notamment des pratiques issues de l’Antiquité hellénistique, puis des développements romains, médiévaux, renaissants et modernes.

## 6.2 Structure fondamentale

Le calcul peut comprendre selon la méthode :

- positions planétaires ;
- signes ;
- maisons ;
- ascendant ;
- aspects ;
- angles ;
- dignités ;
- maîtres ;
- lots/parts ;
- techniques temporelles ;
- transits ;
- directions ;
- profections ;
- retours ;
- progressions.

## 6.3 Ne pas mélanger les écoles

AstroLab doit pouvoir distinguer :

- hellénistique ;
- médiévale ;
- Renaissance ;
- moderne traditionnelle ;
- moderne psychologique ;
- autres écoles contemporaines.

Une règle moderne ne doit pas être présentée comme une règle antique.

## 6.4 Données

- date ;
- heure ;
- lieu ;
- fuseau ;
- coordonnées ;
- convention zodiacale ;
- système de maisons ;
- époque/paramètres astronomiques.

## 6.5 Méthodes candidates

### Natal / genethlialogie

Analyse à partir de la naissance.

**V1 : OUI**

### Transits

Comparaison entre ciel actuel et thème natal.

**V1 : OUI**

### Profections

Technique temporelle annuelle.

**V1 : à valider précisément**

### Retours solaires

Analyse du retour annuel du Soleil.

**V1 : à valider précisément**

### Directions / progressions

Techniques temporelles nécessitant des conventions très précises.

**V1 : laboratoire ou version ultérieure selon validation.**

### Astrologie horaire

Repose sur l’heure d’une question.

**Pas dans le même module que l’analyse natale.**

### Astrologie élective

Cherche un moment favorable pour une action.

**Module distinct et futur.**

### Astrologie mondiale / mundane

Analyse d’entités collectives et d’événements.

**Pas nécessaire au bilan personnel V1.**

## 6.6 Synastrie

Comparaison de deux thèmes.

**V1 : OUI**, car elle est directement utile au module relationnel.

Mais séparer :

- thème A ;
- thème B ;
- relation A/B.

## 6.7 Statut

**V1 PRIORITAIRE**

---

# 7. Famille D — Jyotiṣa / traditions astrologiques indiennes

## 7.1 Nature

« Jyotiṣa » ne doit pas être traité comme un seul calcul.

Il existe des traditions et branches différentes.

Le terme est historiquement lié à l’astronomie/calendrier et à des pratiques de calcul et d’interprétation.

Les nakshatras font notamment partie de la structure ancienne du calendrier/zodiaque lunaire indien.

Source de référence historique :
- Cambridge / Journal of the Royal Asiatic Society, étude sur le Jyotisha et les nakshatras :
  https://www.cambridge.org/core/journals/journal-of-the-royal-asiatic-society/article/abs/art-xiion-the-jyotisha-observation-of-the-place-of-the-colures-and-the-date-derivable-from-it/91550866C6A8A4A489EB02A

## 7.2 Principes à distinguer

Le module devra notamment pouvoir représenter :

- signes/rāśi ;
- nakshatra ;
- maisons/bhāva ;
- planètes/graha ;
- ascendant/lagna ;
- aspects selon l’école ;
- dignités et états selon la tradition retenue ;
- divisions/varga ;
- périodes/dasha ;
- transits/gochara ;
- techniques annuelles ou événementielles selon l’école.

## 7.3 Ayanāṃśa

Point critique.

Le calcul sidéral dépend d’une convention d’ayanāṃśa.

Il ne faut pas choisir arbitrairement une valeur et la considérer universelle.

Le système doit enregistrer :

- convention ;
- version ;
- paramètres ;
- source ;
- date.

## 7.4 Nakshatra

Le module doit conserver :

- identification ;
- position ;
- division pertinente ;
- convention utilisée.

## 7.5 Dashā

Les systèmes de périodes doivent être traités comme des méthodes temporelles séparées.

Ne pas créer une « période indienne » générique.

## 7.6 Statut

**V1 PRIORITAIRE**, mais méthode par méthode.

---

# 8. Famille E — Traditions astrologiques et calendériques chinoises

## 8.1 Règle

Ne jamais parler d’un seul « horoscope chinois ».

Plusieurs systèmes coexistent.

## 8.2 BaZi / Four Pillars

Le système des Quatre Piliers organise les données temporelles autour de quatre piliers associés à :

- année ;
- mois ;
- jour ;
- heure.

Chaque pilier comporte deux composantes :

- tronc céleste ;
- branche terrestre.

La structure utilise notamment le cycle sexagésimal et les correspondances yin/yang et cinq phases.

### Données

- date ;
- heure ;
- lieu ;
- convention de calcul du jour ;
- calendrier/termes solaires ;
- éventuelle correction de temps.

### V1

**PRIORITAIRE**

Mais les règles d’interprétation doivent être spécifiées séparément.

---

# 9. Zi Wei Dou Shu

Le Zi Wei Dou Shu est un autre système de destinée chinois.

Il ne doit pas être fusionné avec le BaZi.

Le Chinese Text Project décrit notamment son histoire traditionnelle et distingue son fonctionnement du système des Four Pillars.

Source :
https://ctext.org/wiki.pl?if=en&res=979714

## Données

Selon la méthode :

- date ;
- heure ;
- calendrier ;
- paramètres de calcul.

## Architecture

Créer un module indépendant :

`chinese-ziwei`

et non une simple option de `chinese-bazi`.

## Statut

**V1 ou laboratoire selon validation complète des règles.**

---

# 10. Autres systèmes chinois

Le dossier doit pouvoir accueillir ultérieurement :

- méthodes calendériques ;
- systèmes liés aux cycles sexagésimaux ;
- techniques électives ;
- systèmes de divination ;
- Feng Shui/geomancie ;
- autres méthodes de destin.

Attention :

**Feng Shui n’est pas un horoscope de naissance.**

Il ne doit pas être injecté automatiquement dans le profil natal.

## Statut

**V2 / recherche**

---

# 11. Famille F — Traditions persanes et islamiques

## 11.1 Nature

Cette famille est particulièrement importante historiquement parce qu’elle a servi de zone de transmission et de synthèse entre traditions grecques, indiennes, iraniennes et mésopotamiennes.

L’Encyclopaedia Iranica documente la circulation de textes grecs et sanskrits en moyen-perse puis en arabe, ainsi que le rôle d’astrologues comme Abū Maʿšar.

Sources :
- Encyclopaedia Iranica, Astrology and Astronomy in Iran :
  https://www.iranicaonline.org/articles/astrology-and-astronomy-in-iran/
- Encyclopaedia Iranica, Horoscope :
  https://www.iranicaonline.org/articles/horoscope/
- Encyclopaedia Iranica, Abū Maʿšar :
  https://www.iranicaonline.org/articles/abu-masar-jafar-b/

## 11.2 Branches historiquement documentées

Notamment :

- astrologie natale ;
- astrologie mondiale ;
- astrologie élective ;
- interrogations ;
- techniques temporelles ;
- astrologie médicale historique ;
- astrologie historique.

## 11.3 Point essentiel

Cette famille montre pourquoi AstroLab doit conserver les filiations et dépendances historiques.

Une méthode iranienne médiévale peut incorporer des éléments grecs et indiens.

Elle ne doit donc pas être comptée automatiquement comme une preuve indépendante dans le moteur transversal.

## 11.4 Statut

**HISTORIQUE / LABORATOIRE**, avec certaines méthodes susceptibles d’entrer en V1 après étude.

---

# 12. Famille G — Traditions mayas

## 12.1 Nature

Il est préférable de parler de **systèmes calendériques mayas** plutôt que d’un simple « horoscope maya ».

Le Smithsonian National Museum of the American Indian documente :

- Haab ;
- Tzolk’in ;
- Calendar Round ;
- Long Count.

Source principale :
https://maya.nmai.si.edu/calendar/calendar-system

Le Smithsonian propose également un convertisseur permettant de convertir des dates grégoriennes vers des dates mayas :
https://maya.nmai.si.edu/calendar/maya-calendar-converter

## 12.2 Tzolk’in

Cycle de :

**260 jours**

construit par la combinaison :

- 20 signes de jour ;
- nombres de 1 à 13.

Le système produit 260 combinaisons.

## 12.3 Haab

Cycle de :

**365 jours**

structuré en :

- 18 périodes de 20 jours ;
- 5 jours supplémentaires.

## 12.4 Calendar Round

Interconnexion du Tzolk’in et du Haab.

Une combinaison complète revient après :

**18 980 jours**, soit environ 52 années Haab.

## 12.5 Long Count

Système permettant de situer les événements dans une chronologie longue.

Unités :

- k’in ;
- uinal ;
- tun ;
- katun ;
- baktun.

## 12.6 Application AstroLab

Le module peut calculer :

- position de naissance dans les cycles ;
- cycles futurs ;
- correspondances temporelles ;
- répétitions ;
- périodes.

Mais il ne doit pas importer automatiquement des significations provenant de systèmes modernes non mayas.

## 12.7 Statut

**V1 PRIORITAIRE**

---

# 13. Famille H — Mésoamérique centrale / traditions mexicaines

## 13.1 Tonalpohualli

Les recherches sur les calendriers mésoaméricains décrivent un cycle de 260 jours comparable dans sa structure générale au Tzolk’in.

L’Oxford Handbook of the Aztecs décrit notamment :

- 13 × 20 = 260 ;
- 18 × 20 + 5 = 365 ;
- cycle combiné de 18 980 jours ;
- année et rituels associés.

Source :
https://academic.oup.com/edited-volume/34663/chapter-abstract/295345071

## 13.2 Attention

Maya et Mexica/Aztec ne doivent pas être fusionnés.

Ils partagent des structures mésoaméricaines mais appartiennent à des contextes historiques et culturels différents.

## 13.3 Statut

**LABORATOIRE / CULTUREL**

---

# 14. Calendriers de 260 jours contemporains

Des recherches ethnographiques montrent que certains calendriers de 260 jours continuent à être utilisés dans des communautés mésoaméricaines contemporaines.

Une étude de l’INAH sur les Ayöök/Mixe décrit notamment un calendrier de 260 jours ayant des fonctions calendériques, divinatoires et prescriptives dans un contexte culturel précis.

Sources :
- INAH :
  https://revistas.inah.gob.mx/index.php/antropologia/article/view/17052
- UNAM :
  https://nahuatl.historicas.unam.mx/index.php/ecn/article/view/77995

## Règle AstroLab

Ne pas transformer une pratique communautaire contemporaine en « horoscope générique mésoaméricain ».

Toute implémentation doit être rattachée à :

- communauté ;
- tradition ;
- région ;
- pratique ;
- source.

---

# 15. Famille I — Japon / Onmyōdō

## 15.1 Nature

L’Onmyōdō est un ensemble japonais de pratiques liées au yin-yang, aux cinq phases, à l’astronomie, aux calendriers et à la divination.

Il a intégré des éléments provenant notamment des traditions chinoises.

Sources :
- Encyclopedia.com, Onmyōdō :
  https://www.encyclopedia.com/environment/encyclopedias-almanacs-transcripts-and-maps/onmyodo
- Nanzan Institute, étude historique :
  https://nirc.nanzan-u.ac.jp/journal/6/issue/186/article/1368

## 15.2 Important

L’Onmyōdō n’est pas simplement :

> « astrologie japonaise ».

Il comprend :

- calendrier ;
- astronomie ;
- divination ;
- auspices ;
- directions ;
- yin-yang ;
- cinq phases ;
- pratiques institutionnelles.

## 15.3 AstroLab

Créer un module culturel/historique avant toute automatisation.

## Statut

**V2 / recherche**

---

# 16. Famille J — Ifá / divination yoruba

## 16.1 Nature

L’Ifá n’est pas une astrologie natale.

UNESCO décrit l’Ifá comme un système divinatoire reposant sur des signes interprétés par un babalawo et sur un vaste corpus appelé odu.

Le corpus comprend 256 odu, subdivisés en vers ese.

Source :
https://ich.unesco.org/fr/RL/le-systeme-de-divination-ifa-00146

## 16.2 Conséquence

Ne jamais créer :

> date de naissance → votre Ifá.

Cela déformerait la pratique.

## 16.3 Architecture possible

À terme :

- bibliothèque culturelle ;
- documentation ;
- partenariat avec des praticiens ;
- interface permettant de renseigner un résultat réel fourni par un praticien.

## 16.4 Statut

**EXCLU DU CALCUL NATAL AUTOMATIQUE V1**

---

# 17. Autres traditions africaines

Ne pas créer une catégorie :

> « astrologie africaine ».

Cette formulation est trop large.

Pour chaque tradition future, créer une fiche :

- communauté ;
- région ;
- langue ;
- période ;
- pratique ;
- fonction ;
- données nécessaires ;
- rôle du praticien ;
- sources ;
- niveau de documentation ;
- statut d’automatisation.

## Statut

**RECHERCHE**

---

# 18. Famille K — Tibétain

Cette famille doit être étudiée comme un ensemble de traditions calendériques, astrologiques et divinatoires liées historiquement à plusieurs influences, notamment indiennes et chinoises.

Règle de développement :

Ne pas créer un module « astrologie tibétaine » générique sans avoir choisi une tradition et ses textes/règles précis.

## Statut

**LABORATOIRE / RECHERCHE**

---

# 19. Ce qu’AstroLab doit appeler « astrologie »

Le produit peut utiliser le mot astrologie pour son positionnement général.

Mais dans le moteur interne, utiliser une terminologie plus précise :

- `astrology`;
- `calendar`;
- `divination`;
- `astronomy`;
- `ritual`;
- `historical_reconstruction`.

Cela évite de forcer tous les systèmes dans une seule catégorie.

---

# 20. Méthodes transversales à ne pas confondre

## Natal

À partir de la naissance.

## Temporel

Étudie les périodes.

## Relationnel

Compare deux personnes.

## Familial

Compare plusieurs générations.

## Horaire

Part d'une question et d'un moment précis.

## Électif

Cherche un moment favorable pour agir.

## Mondial

Concerne des collectivités, États ou événements.

## Calendérique

Classe une date dans un ou plusieurs cycles.

## Divinatoire

Produit un résultat par une opération de divination.

---

# 21. Matrice de compatibilité

Le moteur transversal ne doit pas comparer toutes les méthodes avec toutes les autres.

Chaque méthode possède :

- dimensions comparables ;
- dimensions non comparables ;
- temporalité ;
- granularité ;
- dépendances ;
- statut.

Exemple :

| Résultat | Peut être comparé à | Peut apporter |
|---|---|---|
| thème natal | autre thème natal | structure personnelle |
| transit | thème natal | activation temporelle |
| Tzolk’in | calendrier | cycle/date |
| BaZi | autre méthode de naissance | structure/cycles |
| Ifá réel | résultat divinatoire | contexte symbolique, mais pas vote automatique |

---

# 22. Les niveaux d’indépendance

Chaque méthode doit recevoir :

- indépendante ;
- partiellement dépendante ;
- fortement dépendante ;
- inconnue.

Cela sert à éviter :

> trois variantes d'une même source = trois confirmations.

---

# 23. Comparaison sémantique

Ne jamais comparer seulement les mots.

Un concept doit être décrit par :

- identifiant ;
- nom ;
- définition ;
- domaine ;
- temporalité ;
- polarité ;
- contexte ;
- intensité éventuelle ;
- méthode d'origine.

---

# 24. Concept canonique AstroLab

AstroLab peut créer une couche de concepts internes.

Exemple :

`TRANSFORMATION`

peut relier :

- concept A ;
- concept B ;
- concept C.

Mais ce concept interne n'est pas une nouvelle tradition.

Il sert uniquement à comparer des éléments.

---

# 25. Pont méthodologique

Chaque rapprochement entre deux concepts doit être enregistré comme un objet :

- méthode A ;
- concept A ;
- méthode B ;
- concept B ;
- justification ;
- source ;
- statut ;
- tests ;
- date ;
- version.

Statuts :

- hypothétique ;
- plausible ;
- documenté ;
- robuste ;
- contesté ;
- abandonné.

---

# 26. Convergence

Une convergence ne doit apparaître que si :

1. les résultats sont comparables ;
2. les données sont suffisamment fiables ;
3. les méthodes ne sont pas simplement des doublons ;
4. le rapprochement respecte les règles de chaque tradition ;
5. le résultat résiste aux tests de stabilité ;
6. les divergences éventuelles sont prises en compte.

---

# 27. Complémentarité

Une complémentarité peut être retenue lorsque deux méthodes décrivent des dimensions différentes mais cohérentes.

Exemple conceptuel :

> méthode A → structure

> méthode B → temporalité

Cela n'est pas une confirmation.

---

# 28. Divergence

Une divergence est un résultat utile.

Le moteur doit pouvoir dire :

> « Les méthodes ne donnent pas ici une lecture commune. »

Ne pas chercher à résoudre artificiellement la divergence.

---

# 29. Indétermination

Lorsque les données ou les sources ne permettent pas de trancher :

> indéterminé.

Cette catégorie doit être visible dans les données internes.

---

# 30. Stabilité par variation

Pour toute donnée incertaine, tester plusieurs hypothèses.

Exemple :

14:00 → résultat A  
15:00 → résultat A  
16:00 → résultat A

=> stable.

Si :

14:00 → A  
15:00 → B  
16:00 → B

=> sensible.

---

# 31. Versionnement méthodologique

Chaque méthode doit être versionnée.

Exemple :

`western-natal@1.0`

`bazi@1.0`

`maya-tzolkin@1.0`

Une correction de règle produit une nouvelle version.

Un ancien bilan doit conserver les anciennes versions.

---

# 32. Registre de sources

Chaque règle doit être reliée à une source.

Informations :

- source ;
- auteur ;
- organisme ;
- date ;
- ouvrage ;
- page/chapter si disponible ;
- URL ;
- date de consultation ;
- règle concernée.

---

# 33. Niveaux de preuve interne

AstroLab ne doit pas appeler ces niveaux « vérité ».

Proposition :

### A — documentation primaire/historique forte

Règle directement attestée.

### B — documentation secondaire solide

Règle bien documentée par des chercheurs.

### C — tradition interprétative

Règle présente dans la pratique mais moins facilement vérifiable historiquement.

### D — reconstruction

Hypothèse reconstruite.

### E — expérimental

Hypothèse AstroLab.

---

# 34. Ce que l’IA a le droit de faire

L’IA peut :

- expliquer ;
- résumer ;
- organiser ;
- personnaliser ;
- relier des résultats déjà validés ;
- expliquer une divergence ;
- proposer une formulation prudente.

L’IA ne peut pas :

- calculer à la place du moteur ;
- inventer une règle ;
- inventer une source ;
- choisir arbitrairement une école ;
- inventer une convergence ;
- modifier les résultats ;
- supprimer une incertitude.

---

# 35. Format de résultat recommandé

Chaque résultat :

```text
id
tradition
école
méthode
version
données_utilisées
paramètres
résultat_brut
concepts
temporalité
qualité_données
niveau_documentation
indépendance
interprétations
sources
```

---

# 36. Format d'une conclusion transversale

```text
pattern_id
type
concepts
méthodes_contributrices
résultats_contributeurs
dimensions
temporalité
stabilité
indépendance
preuves_internes
divergences
réserves
statut
version
```

---

# 37. Exemple de conclusion correctement formulée

> Plusieurs méthodes font apparaître un thème comparable de transformation. Elles ne le définissent toutefois pas de manière identique. La correspondance est donc présentée comme une convergence thématique, et non comme une équivalence entre les traditions.

---

# 38. Exemple de conclusion incorrecte

> Trois astrologies prédisent exactement la même chose, donc cela va forcément arriver.

Cette formulation est interdite.

---

# 39. Ordre recommandé d'intégration V1

## Module 1

Astrologie occidentale natale documentée.

## Module 2

Jyotiṣa — sous-ensemble précisément spécifié.

## Module 3

BaZi / Four Pillars.

## Module 4

Systèmes mayas calendériques.

## Module 5

Synastrie occidentale.

## Module 6

Premières techniques temporelles validées.

Les autres systèmes restent activables progressivement.

---

# 40. Pourquoi limiter la première version

Le risque principal n'est pas de manquer de traditions.

Le risque est de produire des calculs :

- approximatifs ;
- mélangés ;
- mal sourcés ;
- non reproductibles.

Mieux vaut 4 ou 5 modules solides que 20 modules superficiels.

---

# 41. Architecture technique des modules

Chaque module doit implémenter un contrat commun.

Exemple conceptuel :

```text
canHandle(input)
validate(input)
calculate(input)
returnStructuredResult()
getSources()
getVersion()
getUncertainty()
```

Le module ne doit pas écrire directement dans l'interface.

---

# 42. Pipeline complet

```text
DONNÉES
   ↓
VALIDATION
   ↓
NORMALISATION
   ↓
MODULES
   ↓
RÉSULTATS STRUCTURÉS
   ↓
CONTRÔLE
   ↓
MOTEUR TRANSVERSAL
   ↓
MOTIFS
   ↓
SYNTHÈSE
   ↓
IA
   ↓
CONTRÔLE IA
   ↓
BILAN
```

---

# 43. Gestion des méthodes non disponibles

Si une méthode ne peut pas être calculée :

```text
status = unavailable
reason = insufficient_documentation
```

Le moteur continue avec les autres méthodes.

Le bilan indique éventuellement :

> Cette méthode n'a pas été incluse car les données/règles disponibles ne permettaient pas un calcul suffisamment fiable.

---

# 44. Gestion des écoles concurrentes

Lorsque plusieurs écoles proposent des règles différentes :

ne pas choisir silencieusement.

Enregistrer :

- école A ;
- école B ;
- différences ;
- choix éventuel ;
- raison ;
- version.

Si le choix n'est pas encore fait :

> laboratoire.

---

# 45. Données astronomiques

Le moteur doit utiliser une source/calcul astronomique reproductible.

Conserver :

- éphémérides ;
- version ;
- paramètres ;
- système de coordonnées ;
- époque ;
- précision.

Ne pas dépendre d'une API externe pour une donnée qui peut être calculée localement si cela augmente inutilement le coût ou le risque.

---

# 46. Lieu de naissance

Le lieu doit être normalisé.

Conserver :

- nom fourni ;
- ville normalisée ;
- pays ;
- latitude ;
- longitude ;
- fuseau historique si nécessaire ;
- source de géocodage.

Ne jamais utiliser uniquement le nom textuel d'une ville pour un calcul précis.

---

# 47. Fuseaux historiques

Pour les calculs historiques :

le système doit tenir compte du fuseau applicable à la date concernée lorsque cela est nécessaire.

Il ne faut pas appliquer automatiquement le fuseau actuel d'une ville à une naissance ancienne.

---

# 48. Heure d'été

Même principe :

- rechercher la règle historique applicable ;
- conserver la source ;
- ne pas supposer que les règles actuelles existaient à la date de naissance.

---

# 49. Heure inconnue

Si l'heure est inconnue :

ne pas inventer une heure.

Certaines méthodes restent possibles.

D'autres deviennent :

> indisponibles ou sensibles.

---

# 50. Ville inconnue

Même principe.

Le système peut parfois produire une analyse partielle, mais doit signaler les méthodes affectées.

---

# 51. Dates incertaines

Pour une date approximative :

pouvoir représenter :

- intervalle ;
- plusieurs hypothèses ;
- confiance.

Ne pas choisir arbitrairement.

---

# 52. Personnes décédées

Le système doit pouvoir enregistrer des personnes historiques/familiales sans supposer qu'elles ont un compte.

Les données doivent rester liées au dossier de l'utilisateur.

---

# 53. Données ajoutées après l'analyse

Une nouvelle donnée ne doit pas modifier silencieusement un ancien bilan.

Créer une nouvelle version.

---

# 54. Validation du passé

Le moteur peut produire une période historique avant que l'utilisateur renseigne ce qu'il a vécu.

Ensuite :

- l'utilisateur ajoute un événement ;
- cet événement est enregistré comme information ultérieure ;
- l'ancien calcul reste inchangé.

---

# 55. Apprentissage du système

AstroLab peut accumuler des données analytiques internes, mais il ne doit pas transformer automatiquement les retours utilisateur en « preuve ».

Un retour :

> « cela correspond à ma vie »

est un signal qualitatif.

Il ne constitue pas à lui seul une validation méthodologique.

---

# 56. Laboratoire statistique

Pour les hypothèses nouvelles, prévoir :

- groupe test ;
- groupe de comparaison ;
- tests en aveugle ;
- tests négatifs ;
- suppression de variables ;
- stabilité ;
- dépendance ;
- reproductibilité.

---

# 57. Découverte de motifs

Le moteur peut chercher des motifs non prévus.

Mais avant publication :

1. définir ;
2. tester ;
3. comparer ;
4. rechercher les faux positifs ;
5. documenter ;
6. versionner ;
7. valider.

---

# 58. Ce qui rend AstroLab réellement différent

La différenciation recherchée n'est pas :

> « plus d'horoscopes ».

Elle est :

> **un moteur qui conserve les systèmes séparés puis étudie leurs relations, leurs échelles temporelles, leurs dépendances, leurs convergences, leurs divergences et leurs motifs familiaux ou relationnels.**

---

# 59. Principe de prudence

Les résultats doivent être présentés comme des interprétations issues de traditions astrologiques/divinatoires.

Ils ne doivent pas être présentés comme :

- diagnostic médical ;
- preuve scientifique ;
- certitude psychologique ;
- garantie d'un événement ;
- conseil financier ou juridique.

---

# 60. Priorités documentaires

Avant d'activer une méthode en production :

### 1

Source primaire ou source académique solide.

### 2

Règles suffisamment explicites.

### 3

Calcul reproductible.

### 4

Jeux de tests.

### 5

Gestion des variantes.

### 6

Gestion des incertitudes.

### 7

Documentation des limites.

---

# 61. Fiches à produire pour chaque méthode

Chaque fiche doit suivre ce modèle :

```text
IDENTIFIANT
TRADITION
ÉCOLE
NOM DE LA MÉTHODE

ORIGINE
PÉRIODE
CONTEXTE

DONNÉES D'ENTRÉE
PARAMÈTRES

RÈGLES DE CALCUL

RÉSULTATS

INTERPRÉTATION TRADITIONNELLE

TEMPORALITÉ

VARIANTES

DÉPENDANCES

LIMITES

SOURCES

NIVEAU DE DOCUMENTATION

STATUT PRODUCTION

VERSION

TESTS
```

---

# 62. Fiches actuellement prioritaires

Créer en premier :

1. Western Natal
2. Western Synastry
3. Western Transits
4. Jyotisha Natal
5. Jyotisha Dashas
6. BaZi
7. Maya Tzolk’in
8. Maya Haab
9. Maya Calendar Round
10. Maya Long Count

Puis :

11. Zi Wei Dou Shu
12. Babylonian reconstruction
13. Persian/Islamic historical methods
14. Egyptian historical methods
15. Onmyōdō
16. Central Mexican calendars
17. autres traditions.

---

# 63. Architecture des dépendances

Exemple :

```text
Astronomical engine
       ↓
Western
       ↓
Transits

Astronomical/calendar engine
       ↓
Jyotisha
       ↓
Dashas

Calendar engine
       ↓
Maya
       ↓
Tzolkin / Haab / Round / Long Count
```

Une dépendance commune ne doit pas être comptée comme une confirmation indépendante.

---

# 64. Contrôle de qualité d'un module

Un module est validé seulement si :

- ses entrées sont définies ;
- ses sorties sont définies ;
- les calculs sont reproductibles ;
- les conventions sont documentées ;
- les variantes sont documentées ;
- les tests passent ;
- les sources sont enregistrées ;
- les limites sont connues.

---

# 65. Critère de refus

Un module doit rester hors production si :

- ses règles sont ambiguës ;
- ses sources sont insuffisantes ;
- plusieurs écoles incompatibles sont mélangées ;
- son calcul n'est pas reproductible ;
- il dépend d'un praticien ;
- son résultat est essentiellement inventé par l'IA.

---

# 66. Liste des systèmes et statut initial

| Système | Type | Statut AstroLab |
|---|---|---|
| Occidentale natale | astrologie | V1 |
| Occidentale synastrie | astrologie relationnelle | V1 |
| Occidentale transits | temporel | V1 |
| Jyotiṣa natal | astrologie | V1 |
| Dashas | temporel | V1/validation |
| BaZi | système de destinée | V1 |
| Zi Wei Dou Shu | système de destinée | V1/lab |
| Maya Tzolk’in | calendrier/divination | V1 |
| Maya Haab | calendrier | V1 |
| Maya Calendar Round | calendrier | V1 |
| Maya Long Count | chronologie | V1 |
| Babylonien | historique | laboratoire |
| Persan/Islamique | astrologie historique | laboratoire |
| Égypte ancienne | astronomie/calendrier | culturel |
| Onmyōdō | cosmologie/divination | V2 |
| Aztec/Mexica | calendriers/divination | laboratoire |
| Ifá | divination | exclu du natal automatique |
| autres traditions africaines | diverses | recherche |
| Tibétain | diverses | recherche |

---

# 67. Règle de langage dans l'application

Éviter :

> « Cette méthode prouve que… »

Préférer :

> « Cette méthode fait ressortir… »

Éviter :

> « Vous allez vivre… »

Préférer :

> « Cette lecture identifie une période associée à… »

Éviter :

> « Votre famille vous transmet… »

Préférer :

> « Un motif comparable apparaît chez plusieurs personnes de votre lignée selon les données disponibles. »

---

# 68. Résultat utilisateur idéal

L'utilisateur doit pouvoir passer de :

### Synthèse

à

### Pourquoi ?

à

### Méthodes

à

### Sources

à

### Incertitudes

sans être obligé de comprendre la technique.

---

# 69. Objectif final du moteur

Le moteur doit répondre à quatre questions :

1. **Qu'est-ce que chaque tradition produit ?**
2. **Qu'est-ce qui est réellement comparable ?**
3. **Qu'est-ce qui apparaît plusieurs fois sans être artificiellement compté plusieurs fois ?**
4. **Qu'est-ce qui devient intéressant lorsqu'on ajoute le temps, la famille et les relations ?**

C'est cette quatrième question qui constitue le cœur original du projet.

---

# 70. Décision de développement

Pour la V1 :

**Ne pas développer toutes les traditions.**

Développer un petit ensemble suffisamment documenté.

Construire l'architecture pour que les autres puissent être ajoutées ensuite.

---

# 71. Sources principales de référence

## Smithsonian National Museum of the American Indian

Calendriers mayas, Tzolk’in, Haab, Calendar Round, Long Count.

https://maya.nmai.si.edu/calendar/calendar-system

## British Museum

Horoscopes babyloniens sur tablettes cunéiformes.

https://www.britishmuseum.org/collection/object/W_1886-0617-5

https://www.britishmuseum.org/collection/object/W_1880-1012-6

## Metropolitan Museum of Art

Astronomie, décans et mesure du temps en Égypte ancienne.

https://www.metmuseum.org/art/collection/search/544566

https://www.metmuseum.org/essays/telling-time-in-ancient-egypt

## Encyclopaedia Iranica

Astrologie et astronomie en Iran, astrologie islamique, horoscope, Abū Maʿšar.

https://www.iranicaonline.org/articles/astrology-and-astronomy-in-iran/

https://www.iranicaonline.org/articles/horoscope/

https://www.iranicaonline.org/articles/abu-masar-jafar-b/

## UNESCO

Système de divination Ifá.

https://ich.unesco.org/fr/RL/le-systeme-de-divination-ifa-00146

## Oxford Academic

Calendriers mésoaméricains et calendrier aztèque.

https://academic.oup.com/edited-volume/34663/chapter-abstract/295345071

## UNAM / INAH

Études sur les calendriers mésoaméricains de 260 jours.

https://nahuatl.historicas.unam.mx/index.php/ecn/article/view/77995

https://revistas.inah.gob.mx/index.php/antropologia/article/view/17052

## Chinese Text Project

Présentation historique du Zi Wei Dou Shu.

https://ctext.org/wiki.pl?if=en&res=979714

## Nanzan Institute

Études historiques sur l'Onmyōdō.

https://nirc.nanzan-u.ac.jp/journal/6/issue/186/article/1368

---

# 72. Conclusion méthodologique

AstroLab ne doit pas chercher à produire :

> « le meilleur horoscope du monde ».

Il doit chercher à construire :

> **un système de lecture comparative, traçable et évolutif capable de faire dialoguer plusieurs traditions sans effacer leurs différences.**

La valeur du produit réside dans :

- la qualité des calculs ;
- la qualité des sources ;
- la séparation des traditions ;
- la gestion de l'incertitude ;
- la détection de relations pertinentes ;
- la recherche de motifs ;
- la comparaison temporelle ;
- la comparaison familiale ;
- la comparaison relationnelle ;
- la traçabilité ;
- la capacité à tester les hypothèses.

La règle ultime reste :

> **plus le résultat est surprenant, plus il doit être documenté et testé avant d'être présenté comme un résultat important.**

---

# 73. Prochaine étape technique

Ce document doit maintenant être transformé en trois artefacts de développement :

1. **`docs/methodology-registry.md`**
   - registre de toutes les méthodes ;

2. **`docs/method-contract.md`**
   - contrat technique commun à chaque module ;

3. **`docs/methods/`**
   - une fiche détaillée par méthode.

Codex ne doit implémenter une méthode que lorsque sa fiche possède le statut :

`VALIDATED_FOR_PRODUCTION`

Toutes les autres peuvent exister dans le registre sans être activées.

