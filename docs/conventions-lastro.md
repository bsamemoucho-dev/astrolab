# Conventions Lastro (`LASTRO_RULE`)

Une convention Lastro n'est **pas** une règle astrologique traditionnelle. Elle
n'est pas sourcée dans un corpus, elle n'est pas présentée comme une vérité : c'est
une **décision de produit**, versionnée, écrite noir sur blanc dans l'annexe du
document livré, et remplaçable par une version ultérieure.

Quatre natures de provenance coexistent et ne se mélangent jamais
(`src/deliverables/provenance.mjs`) :

| Nature | Définition | État |
|---|---|---|
| `CALCULATED` | Position astronomique calculée et vérifiée | actif |
| `TRADITIONAL_RULE` | Règle issue d'une tradition identifiée et sourcée | **aucune active** |
| `LASTRO_RULE` | Convention interne, documentée et versionnée | actif (voir ci-dessous) |
| `LLM_SYNTHESIS` | Formulation produite par le rédacteur | actif |

Règle de séparation : une convention ne peut porter que sur la **structure**
(quelles relations existent, avec quels paramètres). La **signification** d'une
structure reste au rédacteur, donc en `LLM_SYNTHESIS`. Activer une convention de
structure n'active aucune doctrine interprétative.

Toute convention est référencée dans `parameters.ruleVersionsCreated` du résultat
structuré, dans `provenance.structuralConventions` de la lecture publique, et
écrite dans l'annexe technique du document.

---

## `lastro-time-margin@1.0.0` — marge sur l'heure approximative

**Décision.** Une heure de naissance approximative (« vers 10h ») n'est pas un
instant exact. Elle est traitée comme un **repère**, et tout ce qui en dépend est
calculé à l'intérieur d'une **marge déclarée**.

- valeurs proposées au client : **± 15, ± 30, ± 60 minutes** ;
- valeur par défaut si rien n'est précisé : **± 30 minutes** ;
- la source de la marge est toujours distinguée : `supplied` (précisée par le
  client) ou `default` (valeur Lastro) ;
- une valeur invalide est **refusée** (erreur 400), jamais corrigée en silence ;
- une heure exacte ne reçoit **jamais** de marge : rien n'est ajouté
  silencieusement.

**Conséquences calculées.** Le moteur calcule les angles, les maisons et la secte
aux deux bornes de la fenêtre :

- **Ascendant / Milieu du Ciel** : si le signe est le même aux deux bornes, il est
  donné comme *probable* ; s'il change, il est **non décidable** et aucun signe
  n'est affirmé ;
- **Maisons Whole Sign** : elles suivent le signe de l'Ascendant ; si ce signe
  n'est pas décidable, les maisons ne le sont pas non plus et aucun numéro de
  maison n'est transmis au rédacteur ;
- **Secte** : si elle bascule dans la marge (naissance proche du lever ou du
  coucher), elle n'est pas affichée ;
- **Corps** : chaque corps porte son signe aux deux bornes ; un corps dont le
  signe change dans la marge n'est jamais affirmé dans un signe.

**Plafond de langage.** La marge est une donnée, pas une excuse : le document doit
refléter la fragilité. Un détecteur mesure le texte réel
(`findUnhedgedTimedAssertions`) et déclenche une réécriture, puis un retrait des
phrases fautives : signe d'angle non nuancé, signe non décidable, degré précis sur
un angle, maison non décidable, signe affirmé pour un corps instable.

---

## `lastro-aspects@1.0.0` — aspects retenus

**Décision.** Les relations angulaires entre les sept corps traditionnels sont
calculées avec des **orbes écrits**, au lieu de rester des « structures
inactives ». Ce qui est activé est la structure, pas la signification.

### Table d'orbes retenue

| Aspect | Angle exact | Orbe | Orbe si un luminaire (Soleil ou Lune) est impliqué |
|---|---:|---:|---:|
| Conjonction | 0° | 8° | 10° |
| Opposition | 180° | 8° | 10° |
| Trigone | 120° | 7° | 8° |
| Carré | 90° | 6° | 8° |
| Sextile | 60° | 4° | 6° |

Ces valeurs sont des usages courants en astrologie occidentale moderne, retenus
comme convention de produit — pas comme vérité démontrée. Le vocabulaire français
imposé est « trigone », jamais « trine ».

### Ce qui n'est pas retenu en 1.0.0

Aspects mineurs (semi-sextile, quincunx, quintile), parallèles de déclinaison,
orbes dépendant de la maison, distinction appliquant/séparant. Les ajouter exigera
une version `1.1.0` documentée.

### Interaction avec la marge d'incertitude

Un aspect qui entre dans l'orbe à l'instant de référence mais **en sort** sur la
marge n'est pas un aspect retenu : il est écarté, avec le motif écrit
(`not_stable_within_declared_margin`) et la liste des aspects écartés figure dans
les limites d'incertitude de l'annexe. Sur le thème de référence de test
(15 janvier 1990, 12:30, Paris), deux aspects sur huit sont écartés de cette
manière à ± 30 minutes.

### Traçabilité

Chaque couple évalué (21 couples) porte : type retenu ou `null`, type candidat le
plus proche, orbe appliqué, écart à l'angle exact, stabilité sur la marge,
provenance `LASTRO_RULE`, identifiant de version. L'annexe publie la convention,
la table d'orbes, les aspects retenus (orbe et écart) et le nombre de couples
examinés.

---

## `lastro-distribution@1.0.0` — répartition par élément et par modalité

**Décision.** La page « carte du ciel » montre la répartition des corps entre les
quatre éléments (Feu, Terre, Air, Eau) et les trois modalités (Cardinal, Fixe,
Mutable). Un pourcentage suppose une règle : la voici, écrite.

- **quels corps** : les **sept corps traditionnels** de la méthode, pas un autre
  ensemble ;
- **aucune pondération** : chaque corps compte pour un. Aucune importance relative
  n'est inventée — le moteur ne hiérarchise pas les corps ;
- **corps sans signe établi** : exclus du décompte et **comptés à part**, avec la
  mention « *n* corps sans signe établi, non comptés dans cette répartition ». Un
  pourcentage calculé sur des signes inconnus serait un chiffre inventé ;
- **les pourcentages affichés** sont le rapport entre le nombre de corps et le
  nombre de corps **classés** (et non le total des sept, qui inclurait les
  exclus) ;
- la convention est écrite **dans le document**, sous les graphiques.

**Pourquoi pas de score de « force »** : une hiérarchie de planètes (dignités,
anges, maîtrises) demanderait une règle traditionnelle sourcée ; aucune n'est
active (`TRADITIONAL_RULE` : aucune). Tant que c'est le cas, la répartition reste
un décompte.

---

## Rendu de la roue du ciel

La roue est de la **géométrie** (`CALCULATED`) : secteurs des douze signes, position
de chaque corps à sa longitude, numéros de maison Whole Sign, axes. Deux
conventions de rendu sont retenues, parce qu'elles changent ce que le lecteur croit
lire :

- **orientation** : la roue est tournée sur l'**Ascendant**, placé à gauche, le
  zodiaque tournant dans le sens inverse des aiguilles. Quand l'Ascendant n'est pas
  décidable (marge d'incertitude, ou heure inconnue), la roue est orientée sur
  **0° Bélier en haut** et le document l'écrit — une roue orientée sur un axe
  indécis serait un mensonge visuel ;
- **incertitude** : un Ascendant dont la frontière tombe dans la marge est dessiné
  comme une **zone balayée** (« AC ? »), jamais comme un axe ; une position qui
  balaie plusieurs signes (heure inconnue) est dessinée comme un **arc**, jamais
  comme un point.

---

## `lastro-convergence@1.0.0` — hiérarchie des convergences

Convention de synthèse qui hiérarchise les convergences d'une lecture. Elle ne
constitue pas une règle astrologique traditionnelle et ne peut jamais augmenter la
certitude **factuelle** : elle n'augmente que la force du langage symbolique.

---

## `lastro-pricing@1.0.0` — prix de la lecture et offre de lancement

Ce n'est pas une convention astrologique, mais c'est une règle versionnée : elle dit
ce qui est affiché au client et ce qui est débité. Elle vit dans
`src/payments/pricing.mjs`.

| Élément | Valeur en 1.0.0 | Comment la changer |
|---|---|---|
| Prix de la lecture | **25 €** (`ASTROLAB_PRICE_CENTS=2500`) | variable d'environnement |
| Code de lancement | **`bessbousse10`** (`ASTROLAB_PROMO_CODE`) | variable d'environnement |
| Remise du code | **−10 €** (`ASTROLAB_PROMO_DISCOUNT_CENTS=1000`) | variable d'environnement |
| Prix payé avec le code | **15 €** | calculé, jamais écrit à la main |

Codes **privés**, facultatifs, définis uniquement par l'environnement
(`ASTROLAB_PROMO_CODES=CODE=montant`, plusieurs codes séparés par des virgules) :
un montant **positif** est le prix payé avec ce code (`CODE=100` → 1 €), un montant
**négatif** est une remise (`CODE=-1000` → 10 € de moins). Ils ne figurent ni dans
la page, ni dans `/api/config`, ni dans le dépôt — qui est public. Un montant qui
descendrait sous 0,50 € (minimum Stripe) est ramené à 0,50 €, et **tous** ces tarifs
sont reconnus comme légitimes au moment de vérifier un paiement : une lecture payée
1 € avec un code ne doit pas être refusée comme « montant inattendu ».

Règles de la convention :

- le **montant est calculé par le serveur**, jamais envoyé par le navigateur : le
  client n'envoie qu'un code, et le montant d'un éventuel `amountCents` glissé dans
  la requête n'est pas lu ;
- le **code est public** (il est pré-rempli dans le formulaire de paiement) : ce
  n'est pas un secret, et il ne doit pas en être un. Ce qui est protégé, c'est le
  calcul, pas la discrétion du code ;
- la remise est **bornée** : elle ne peut ni dépasser le prix, ni faire tomber le
  total sous le minimum accepté par Stripe (0,50 €). Une remise nulle n'est pas une
  offre : aucun « −0 € » n'est annoncé ;
- un code **inconnu** ne donne aucune remise et le paiement est refusé (400) plutôt
  que débité au plein tarif sans que le client l'ait vu ;
- le reçu Stripe porte le montant réellement payé, et la ligne de commande dit
  pourquoi (`25,00 € moins 10,00 € (offre de lancement)`), dans la langue du client ;
- le prix affiché est toujours celui du serveur : si le devis échoue, le site
  réaffiche le tarif **sans remise** et n'invente aucun montant.

---

## Ajouter une convention

1. Créer la table versionnée dans le code (ex. `src/astro/rules/`), avec
   `nature: "LASTRO_RULE"`, un `versionId`, une finalité et ce qui n'est pas
   retenu.
2. Écrire sa portée ici, dans ce fichier.
3. Publier ses paramètres et sa version dans l'annexe du document client, dans la
   langue du client (les neuf langues sont couvertes).
4. Mesurer l'effet sur le texte réel par un détecteur, pas seulement par une
   consigne : une consigne n'est pas une contrainte.
5. Ajouter un test qui vérifie la version, les paramètres, la provenance et
   l'absence de fuite de langage interne dans le document livré.
