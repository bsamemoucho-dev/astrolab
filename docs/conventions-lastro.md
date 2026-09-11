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

## `lastro-convergence@1.0.0` — hiérarchie des convergences

Convention de synthèse qui hiérarchise les convergences d'une lecture. Elle ne
constitue pas une règle astrologique traditionnelle et ne peut jamais augmenter la
certitude **factuelle** : elle n'augmente que la force du langage symbolique.

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
