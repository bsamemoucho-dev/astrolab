# ASTROLAB — Architecture de connaissance, versionnement et reproductibilité

**Décision d’architecture — 31 août 2026**

## 1. Décision

AstroLab ne doit jamais dépendre d’Internet en temps réel pour déterminer un calcul, une règle méthodologique ou une interprétation validée.

**Internet sert à rechercher, vérifier et éventuellement mettre à jour la connaissance interne d’AstroLab. Il ne constitue pas la source opérationnelle directe des réponses utilisateur.**

Cette règle est obligatoire pour la production.

---

## 2. Architecture de référence

```text
Sources externes
    ↓
Recherche / vérification humaine
    ↓
Documentation méthodologique AstroLab
    ↓
Règles et paramètres versionnés
    ↓
Moteurs de calcul déterministes
    ↓
Résultats structurés
    ↓
Moteur transversal
    ↓
Synthèse validée
    ↓
IA rédactionnelle
    ↓
Contrôle final
    ↓
Réponse utilisateur
```

L’IA ne doit jamais contourner cette chaîne pour aller chercher elle-même une règle sur Internet pendant la production.

---

## 3. Sources externes

Les sources externes peuvent être :

- ouvrages ;
- publications scientifiques ;
- musées ;
- institutions ;
- archives ;
- documents historiques ;
- sites spécialisés ;
- autres sources documentaires jugées pertinentes.

Chaque source retenue doit être enregistrée avec suffisamment de métadonnées pour permettre sa traçabilité.

Une source externe peut évoluer, disparaître ou être modifiée.

**Cela ne doit pas modifier automatiquement le comportement d’AstroLab.**

---

## 4. Registre interne

Toute méthode utilisée en production doit posséder une fiche interne.

Elle contient notamment :

- identifiant ;
- tradition ;
- école ;
- méthode ;
- définition ;
- données d’entrée ;
- conventions ;
- règles ;
- paramètres ;
- sources ;
- limites ;
- dépendances ;
- niveau de documentation ;
- version ;
- statut.

Les règles réellement utilisées par le moteur doivent être conservées dans le dépôt ou dans un stockage versionné contrôlé par AstroLab.

---

## 5. Internet ne doit pas être une dépendance de calcul

Une requête utilisateur comme :

> « Analyse ma naissance »

ne doit pas provoquer :

```text
Utilisateur
→ Internet
→ recherche libre
→ interprétation trouvée
→ IA
→ résultat
```

Elle doit provoquer :

```text
Utilisateur
→ données
→ règles AstroLab versionnées
→ calcul
→ résultat structuré
→ synthèse
```

Cela garantit la reproductibilité.

---

## 6. Mise à jour des connaissances

Lorsqu’une nouvelle information apparaît sur Internet :

**aucune modification automatique de la production.**

Processus :

```text
Nouvelle information
    ↓
Repérée
    ↓
Étudiée
    ↓
Comparée aux règles existantes
    ↓
Documentée
    ↓
Testée
    ↓
Décision
```

La nouvelle règle peut ensuite devenir :

- rejetée ;
- informative ;
- laboratoire ;
- candidate à une nouvelle version ;
- validée pour production.

---

## 7. Versionnement obligatoire

Chaque méthode est versionnée.

Exemple :

```text
western-natal 1.0
western-natal 1.1
western-natal 2.0
```

Une analyse conserve la version exacte utilisée.

Elle doit également conserver les versions des composants importants :

- moteur astronomique ;
- méthode ;
- règles ;
- paramètres ;
- moteur transversal ;
- générateur de texte ;
- éventuels référentiels.

---

## 8. Une ancienne analyse ne change jamais silencieusement

Si une nouvelle règle est validée :

```text
Analyse ancienne
→ reste liée à l’ancienne version
```

Une nouvelle analyse peut utiliser :

```text
Nouvelle méthode
→ nouvelle version
```

L’application peut proposer :

> « Une nouvelle version méthodologique est disponible. Recalculer votre analyse ? »

Le recalcul crée une nouvelle version de l’analyse.

Il ne détruit pas l’ancienne.

---

## 9. Empreinte de reproductibilité

Chaque analyse importante doit conserver une empreinte permettant de retrouver les conditions de calcul.

Exemple conceptuel :

```text
analysis_id
created_at

input_data_version
input_data_hash

method_versions
rule_versions
astronomical_data_version
cross_analysis_engine_version
ai_generation_version

calculation_parameters
result_hash
```

Le but est de pouvoir répondre plusieurs années plus tard :

> « Avec quelles données et quelles règles ce résultat a-t-il été produit ? »

---

## 10. Données astronomiques

Lorsqu’un moteur astronomique est utilisé, sa version et ses paramètres doivent être enregistrés.

Ne pas dépendre d’une API externe en temps réel si les données nécessaires peuvent être embarquées ou contrôlées localement.

Si une API externe est réellement nécessaire :

- enregistrer le fournisseur ;
- version/API utilisée ;
- date ;
- paramètres ;
- résultat retourné lorsque cela est nécessaire à la reproductibilité ;
- comportement de secours.

---

## 11. Sources supprimées ou modifiées

Si une page Internet disparaît :

**les règles déjà validées ne disparaissent pas.**

AstroLab conserve :

- la référence de la source ;
- les métadonnées ;
- la règle extraite ;
- la version concernée ;
- les éléments documentaires nécessaires selon les droits applicables.

L’objectif est de ne pas rendre les anciennes analyses dépendantes d’une page Web encore disponible.

---

## 12. Évolution massive d’Internet

Si, dans dix ans, des milliers de sites modifient leurs calculs ou leurs interprétations :

**aucun changement automatique dans AstroLab.**

L’application continue d’utiliser la version validée.

Une nouvelle méthode n’entre en production qu’après :

- examen ;
- documentation ;
- tests ;
- comparaison ;
- décision explicite.

---

## 13. Protection contre les dérives

Prévoir des tests de régression.

Pour des cas de référence :

```text
entrée connue
→ résultat attendu
```

Une modification du code ne doit pas modifier silencieusement les résultats de référence.

Si elle les modifie :

- le test échoue ;
- la modification doit être expliquée ;
- une nouvelle version peut être créée.

---

## 14. Jeux de référence

Conserver des cas de test permanents pour chaque méthode.

Ils doivent couvrir :

- cas normaux ;
- limites ;
- heures approximatives ;
- fuseaux historiques ;
- dates historiques ;
- changements de calendrier ;
- données manquantes ;
- variantes méthodologiques.

Ces jeux servent de référence à chaque nouvelle version.

---

## 15. IA rédactionnelle

L’IA reçoit uniquement un contexte contrôlé.

Exemple :

```text
Résultats calculés
+
interprétations validées
+
sources enregistrées
+
incertitudes
+
divergences
+
réserves
```

L’IA peut reformuler.

Elle ne doit pas décider qu’une nouvelle règle trouvée sur Internet est correcte.

---

## 16. Recherche Internet assistée

Une recherche Web peut éventuellement être proposée dans une fonction séparée de type :

> « Explorer les nouvelles méthodes »

Cette fonction appartient au laboratoire/recherche.

Elle ne doit pas modifier la production.

---

## 17. Laboratoire

Le laboratoire peut utiliser Internet plus librement pour :

- découvrir ;
- comparer ;
- documenter ;
- rechercher de nouvelles méthodes ;
- rechercher des sources ;
- identifier des variantes.

Mais ses résultats sont marqués :

`LABORATORY`

et restent séparés de la production.

---

## 18. Passage laboratoire → production

Processus obligatoire :

```text
LABORATOIRE
    ↓
Documentation
    ↓
Reproduction
    ↓
Tests
    ↓
Évaluation des dépendances
    ↓
Évaluation des faux positifs
    ↓
Validation
    ↓
Nouvelle version
    ↓
PRODUCTION
```

---

## 19. Principe d’indépendance

Le moteur transversal doit connaître les dépendances entre méthodes.

Si deux méthodes utilisent :

- la même source historique ;
- des règles dérivées l’une de l’autre ;
- les mêmes données ;
- une même convention fondamentale ;

elles ne doivent pas être comptées automatiquement comme deux confirmations indépendantes.

---

## 20. Séparation des couches

Le système doit maintenir quatre couches distinctes :

### Calcul

Produit les résultats numériques/structurés.

### Interprétation traditionnelle

Associe les résultats aux significations documentées de la méthode.

### Analyse transversale

Compare les résultats.

### Rédaction IA

Transforme les résultats contrôlés en texte compréhensible.

Aucune couche ne doit remplacer une autre.

---

## 21. Reproductibilité

Une même analyse réalisée avec :

- les mêmes données ;
- les mêmes versions ;
- les mêmes paramètres ;

doit produire le même résultat structuré.

Si un composant non déterministe est utilisé, son comportement doit être contrôlé ou son résultat conservé.

---

## 22. Modèle de données supplémentaire

Ajouter ou prévoir :

- `KnowledgeSource`
- `MethodVersion`
- `RuleVersion`
- `ReferenceDataset`
- `CalculationRun`
- `CalculationArtifact`
- `MethodDependency`
- `KnowledgeChange`
- `LaboratoryExperiment`
- `AnalysisVersion`

---

## 23. Audit méthodologique

Toute modification d’une règle de production doit être journalisée :

```text
ancienne version
nouvelle version
auteur
date
raison
sources
tests
résultats des tests
décision
```

---

## 24. Principe de conservation

Une analyse ancienne doit rester interprétable même si :

- un site disparaît ;
- une source change ;
- une API change ;
- un modèle IA change ;
- une nouvelle méthode apparaît ;
- une nouvelle version AstroLab est publiée.

---

## 25. Règle finale

**AstroLab doit être capable de dire non seulement « quel résultat ? », mais aussi « avec quelles règles, quelles données et quelle version ce résultat a-t-il été obtenu ? »**

Cette propriété est obligatoire pour le cœur du produit.

---

# Décision validée

### Décision
Internet n’est pas une source opérationnelle temps réel pour les calculs et interprétations de production.

### Raison
Garantir la stabilité, la reproductibilité, la traçabilité et la résistance aux modifications futures des sources externes.

### Conséquence
Les connaissances utilisées en production doivent être intégrées, documentées et versionnées dans l’écosystème AstroLab.

### Réserve
Les sources externes restent nécessaires pour la recherche, la vérification et l’évolution du référentiel.

### Statut
**VALIDÉ — ARCHITECTURE FONDAMENTALE**
