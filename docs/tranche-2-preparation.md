# Tranche 2 — préparations non développées

Quatre améliorations identifiées comme nécessaires, **spécifiées ici et non
développées**. Chacune est indépendante et peut être autorisée séparément.
Aucun appel payant, aucun déploiement.

Ordre recommandé : 1 (incertitude) → 3 (mémoire) → 4 (langue) → 2 (transits),
parce que 2 dépend d'un choix éditorial de sélection et que 1 est un risque de
justesse, pas de confort.

---

## 1. Transmettre l'incertitude de naissance au rédacteur

**Constat vérifié.** Le chemin payant ne dit **jamais** au modèle que l'heure est
approximative : `structuredSectionWriter.mjs` ne contient aucune occurrence de
« uncertainty » (0 sur 981 lignes), et les preuves `BIRTH_CONTEXT` et
`UNCERTAINTY` sont **orphelines** — aucun chapitre ne les possède, elles
n'atteignent donc aucun prompt. Le chemin historique (`writers.mjs`) possède au
contraire des consignes très abouties (`timeApproximateDirective`,
`TIME_UNKNOWN_DIRECTIVE`).

Conséquence : avec une heure à ± 30 min, le rédacteur peut affirmer un
Ascendant ou un Milieu du Ciel que le calcul déclare **non décidable**, et rien
dans la validation factuelle ne l'en empêche (le validateur vérifie qu'un fait
est *autorisé*, pas qu'il est *stable*).

**Changement minimal proposé**
1. Ajouter `BIRTH_CONTEXT` et `UNCERTAINTY` comme preuves **de cadre** de chaque
   chapitre (non interprétables : transmises hors packets, dans un champ
   `birthTimePrecision` du payload).
2. Porter dans le prompt système du chemin structuré les deux directives
   existantes de `writers.mjs` (réutilisation directe, pas de réécriture).
3. Ajouter au validateur une règle bloquante : « un signe d'angle déclaré non
   décidable ne peut pas être affirmé » (`asserted_unestablished_sign`, déjà
   présente côté historique, à porter sur le chemin structuré).

**Fichiers** : `structuredSectionWriter.mjs` (prompt + payload),
`dossierEvidence.mjs` (propriétaire des deux preuves),
`factualClaimsValidator.mjs` (contrôle d'angle non décidable).
**Effort** : 0,5 à 1 j. **Coût** : ~100 tokens d'entrée par appel.
**Critère d'acceptation** : sur le thème de référence (± 30 min, MC non
décidable), aucun bloc produit ne nomme le signe du Milieu du Ciel ; la phrase
d'incertitude figure dans le chapitre d'identité.
**Risque** : alourdit le prompt ; à tester sur les 9 langues plus tard.

---

## 2. Améliorer la sélection des transits

**Constat vérifié.** `next_weeks` reçoit `primaryEvidenceRefs.slice(0, 8)` dans
l'ordre chronologique du moteur (`fullDossierPlan.mjs`). Reproduction sur le
thème de référence au 18/10/2026 : **8 transits sur 8 sont lunaires**. La cause
est mécanique : la fenêtre d'orbe de la Lune est de ± 2,8 h (plafond 1,5°), donc
les contacts lunaires se succèdent tous les 1 à 3 jours, alors qu'un transit
solaire reste « en cours » pendant des semaines et part dans `current_sky`.
Aucun quota par corps, aucune durée minimale, aucun étalement d'horizon.

**Changement minimal proposé** — une fonction de sélection dédiée, déterministe
et testable :
1. regrouper par « histoire » (`corps|point|aspect`, déjà fait) ;
2. imposer **au plus 2 contacts par corps en transit** dans `next_weeks` ;
3. privilégier la **durée** (contacts de plus de 7 jours) avant l'échéance ;
4. réserver au moins **4 corps distincts** sur 8 places ;
5. exposer la règle dans l'annexe (`lastro-transit-selection@1.0.0`) : le client
   doit pouvoir lire *pourquoi* ces transits-là.

**Fichiers** : `fullDossierPlan.mjs` (`capSectionEvidence` → sélection dédiée),
nouvelle convention dans `docs/conventions-lastro.md`.
**Effort** : 1,5 à 2 j. **Coût** : inchangé (moins de blocs, mieux choisis).
**Critère d'acceptation** : sur 3 thèmes de test, `next_weeks` contient au moins
4 corps distincts et aucun corps ne dépasse 2 contacts.
**Risque** : éditorial (choisir « le plus structurant » est un jugement) → la
règle doit être écrite, versionnée, et affichée en annexe.

---

## 3. Mémoire inter-chapitres

**Constat vérifié.** Le prompt d'un bloc ne contient **ni** les chapitres déjà
écrits **ni** la liste des placements déjà interprétés
(`buildStructuredUserPrompt` = `{sectionPlan, correctionIssues}` uniquement).
`alreadyInterpretedEvidenceRefs` existe mais est **inerte** : il est calculé avec
le même prédicat que `interpretationDepth`, et le validateur ne le contrôle que
pour les blocs primaires. La répétition est donc structurellement inévitable —
et l'expérimentation sur les aspects l'aggrave (un aspect du Soleil peut être
développé dans trois chapitres).

**Changement minimal proposé**
1. Transmettre au bloc un résumé court (1 phrase, ≤ 200 caractères) des blocs
   déjà acceptés, plus la liste des `evidenceId` déjà utilisés en primaire.
2. Ajouter une consigne : « ne réexplique pas ces placements ; apporte un angle
   nouveau ».
3. Ajouter un détecteur mécanique inter-chapitres (répétition de la même paire
   corps/aspect ou du même numéro de maison) en **avertissement**, jamais en
   suppression.

**Fichiers** : `structuredSectionWriter.mjs` (payload + prompt),
`factualClaimsValidator.mjs` (détecteur), `fullDossierPlan.mjs` (rien).
**Effort** : 1 à 1,5 j. **Coût** : +10 à 20 % d'entrée (le résumé s'ajoute à
chaque appel).
**Critère d'acceptation** : sur un dossier généré, aucune paire (corps, aspect)
expliquée deux fois avec les mêmes thèmes ; mesure avant/après sur le compteur
de répétitions (`tools/estimate-cost.mjs` n'y suffit pas : il faut une génération).
**Risque** : un résumé mal calibré peut fabriquer de la continuité artificielle ;
le garder factuel (faits déjà dits, pas d'interprétation).

---

## 4. Respecter la langue choisie par le client

**Constat vérifié.** Le chemin payant ne transmet **ni la langue ni le guide de
style** : `buildStructuredSystemPrompt` n'inclut aucune ligne « écris en X », et
les objectifs, thèmes et consignes sont en français. Un visiteur néerlandais
reçoit des titres et une annexe en néerlandais avec un **corps de texte
français**. Les 9 `styleGuide` existent (`i18n.mjs`) mais ne sont câblés qu'au
chemin historique.

**Changement minimal proposé**
1. Passer `language` + `styleGuide` à `buildStructuredSystemPrompt` et
   `buildStructuredUserPrompt` (le paramètre existe déjà côté historique).
2. Tant que la qualité n'est pas vérifiée langue par langue, **réduire la vente**
   aux langues réellement relues : proposer l'interface traduite mais refuser la
   commande hors `fr`/`en` (ou l'annoncer explicitement). Une promesse de langue
   non tenue coûte plus cher qu'un choix réduit.
3. Les détecteurs éditoriaux restent français ; étendre langue par langue avec un
   test de couverture par langue (`DETECTOR_COVERAGE` existe).

**Fichiers** : `structuredSectionWriter.mjs`, `public/app.js` (sélecteur),
`src/http/app.mjs` (garde de vente), `i18n.mjs` (déjà prêt).
**Effort** : 1 j pour le câblage, +1 j par langue pour la vérification.
**Coût** : inchangé.
**Critère d'acceptation** : un dossier généré en `nl` ne contient aucun mot
français (test automatique sur un échantillon).
**Risque** : ouvrir 9 langues sans relecture dégrade la qualité perçue — c'est
pourquoi la réduction de l'offre est proposée d'abord.
