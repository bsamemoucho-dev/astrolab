# Écart produit & feuille de route — dossiers clients « qualité conversation »

Status: working document. Source conversations:
- « Nouveau projet possible » (AstroLab, vision/méthode) : `https://chatgpt.com/share/6aa083cd-523c-83eb-9e51-cb221b1c2383`
- « Interprétation horoscope 2026 » (livrables clients, prompts maîtres, business) : `https://chatgpt.com/share/6aa084d6-3894-83ed-b0e4-3535516f4027`

Objectif de ce document : exprimer ce que le livrable commercial doit être, mesurer ce qu'AstroLab sait déjà produire, nommer les conflits avec les décisions V1 actuelles, lister les décisions produit à trancher, et proposer une feuille de route par tranches pour rapprocher le produit de la qualité visée.

---

## 1. Le produit visé (défini dans la conversation « Interprétation horoscope 2026 »)

Résumé global de l'échange (extrait fidèle, reformulé) :

> Service de lectures symboliques et astrologiques personnalisées, à la frontière de l'astrologie occidentale/indienne/chinoise, des archétypes (Jung), du transgénérationnel et de l'écriture narrative (lettres d'âme, miroir, passage). Pas de prédiction événementielle, pas de diagnostic, pas de thérapie. Cartographie intérieure éthique, non anxiogène.

Offres :
- **Synthèse (6–8 pages)** : axe de vie, héritages, passé, lettre d'âme, clé d'intégration.
- **Étude complète premium (30–60 pages)** : astrologie occidentale + sidérale + chinoise, transgénérationnel approfondi, archétypes dominants, lecture du passé, lettres, module « Périodes & Cycles ».
- **Module Périodes & Cycles** : phases clôture/réajustement/ouverture, fenêtres larges (0–1 an, 1–3 ans, 3–5 ans), posture intérieure, aucune date d'événement.

Structure obligatoire du dossier intégral (prompt maître final, 11 sections) :
1. Introduction générale (cadre, non-prédictif)
2. Position de naissance & axe de vie (tropical + sidéral + chinois)
3. Structure psychologique & émotionnelle
4. Lecture transgénérationnelle (héritages, loyautés, rôles transmis)
5. Archétypes dominants
6. Lecture approfondie du passé
7. Lettre d'âme
8. Lettre miroir
9. Périodes & Cycles
10. Clés d'intégration
11. Conclusion éthique

Contraintes d'écriture : narratif, incarné, non déterministe (« il est possible que… », « ce que tu as porté / ce que tu peux poser »), libre arbitre rappelé, aucun diagnostic, aucune promesse d'événement.

Infrastructure discutée (business) : site app-like (Framer), paiement Stripe unique, formulaire Tally, espace privé client, livraison PDF, back-office Notion. Fonctionnement actuel : 1 client = 1 formulaire → 1 prompt maître → 1 dossier ChatGPT, relu puis livré.

---

## 2. Capacités actuelles d'AstroLab (dépôt local)

### 2.1 Ce qui est solide et réutilisable tel quel

| Capacité | Détail | Statut |
|---|---|---|
| Calcul astronomique déterministe | 7 corps traditionnels, signes tropicaux, angles, maisons Whole Sign, sect | ✅ validé contre JPL (≤ 0,01°), tests verts |
| Gestion du temps incertain | exact / approximatif / intervalle / inconnu, sans inventer d'heure | ✅ tests |
| Stabilité d'intervalle + franchissements de signe | `uncertainty.intervalAnalysis`, `ascendantSignWindows` (garde-fou « Ascendant déclaré ») | ✅ (tranche récente) |
| Résultat structuré avec provenance | schéma versionné, hash, artefacts, `RuleVersion` jamais créée sans source | ✅ |
| Couche d'analyse prototype | faits / facteurs / relations / interprétation bloquée / synthèse limitée | ✅ développement |
| Comptes, dossiers, audit, export/effacement | socle identité + traçabilité | ✅ |
| Commerce (brouillon) | plans à crédits, ordres, grand livre | ✅ dev uniquement |
| Moteur de rapport | artefacts de rapport **bloqués** tant que pas de résultats méthodologiques + transversal déterministe | ✅ garde-fou actif |

### 2.2 Exclusions V1 explicites (docs/methodology-registry.md, « V1 Scope Decision »)

- pas de transits ;
- pas de synastrie ;
- pas d'autres traditions (le champ V1 ne couvre que Western natal hellénistique) ;
- **pas de texte d'interprétation généré par IA** ;
- le moteur de calcul n'utilise pas Internet au runtime ;
- les conventions V1 ne sont pas des `RuleVersion` tant que sources/formules/tests ne sont pas validés.

### 2.3 Conséquence immédiate

Le livrable premium (sections 2–9 du prompt maître) mobilise exactement ce que le V1 a exclu :
interprétation rédigée (3, 5, 6, 7, 8, 10), autres traditions (2 : sidéral, chinois), transgénérationnel (4), prévision par cycles/transits (9). **Ce n'est pas un oubli de développement : c'est une décision de périmètre.** L'écart perçu (« plus performant mais moins complet ») est donc d'abord un écart de **périmètre et de couche de livraison**, pas de qualité de calcul.

---

## 3. Cartographie du livrable premium → support AstroLab

Légende : ✅ calculable aujourd'hui · 🔶 calculable plus tard sous méthode documentée (registre) · ✍️ rédaction IA narrative (hors calcul) · 🧬 lecture symbolique hors calcul (données famille) · ⛔ exclu / à décider.

| Section livrable (prompt maître) | Support AstroLab aujourd'hui | Support possible | Ce qui manque |
|---|---|---|---|
| 1. Introduction & cadre | ✅ (texte fixe de cadre, non personnalisé) | ✍️ | plan de dossier |
| 2. Position de naissance & axe de vie | ✅ tropical (soleil, angle, maisons) | 🔶 sidéral (jyotisha-natal), 🔶 chinois (bazi/année) | modules jyotish/chinois documentés ; synthèse d'axe = interprétation |
| 3. Structure psychologique & émotionnelle | ⚠️ analyse prototype (structurel) | ✍️ | règles d'interprétation documentées **ou** écriture symbolique étiquetée |
| 4. Transgénérationnel | ⛔ aucune donnée parents structurée côté interprétation | 🧬 + ✍️ | données parents (dates/lieux), lecture symbolique |
| 5. Archétypes dominants | ⛔ (hors astrologie calculée) | ✍️ 🧬 | bibliothèque d'archétypes + règles d'attribution (ou écriture étiquetée) |
| 6. Lecture du passé | ⛔ | ✍️ (respectueuse, non événementielle) | directives éthiques du prompt maître |
| 7–8. Lettres d'âme / miroir | ⛔ | ✍️ | prompt par lettre ; ton validé |
| 9. Périodes & Cycles | ⛔ (pas de transits/progressions) | 🔶 transits, progressions, révolution solaire, retour de Saturne | décision de périmètre + méthode + éthique « fenêtres, pas dates » |
| 10. Clés d'intégration | ⛔ | ✍️ | directives |
| 11. Conclusion éthique | ✅ (bloc garde-fou) | ✍️ | — |

## 4. Atouts d'AstroLab à préserver dans le livrable

1. **Le « I. Ce qui est certain »** des dossiers conversation peut être **généré par la machine, pas rédigé** : positions, angles, maisons, stabilité, plages d'Ascendant — avec traçabilité. C'est l'avantage décisif sur le travail à la main dans ChatGPT (les conversations ont dû corriger Nadira : Ascendant Sagittaire, pas Gémeaux).
2. **Versioning et reproductibilité** : même données → même socle ; le dossier peut référencer un `resultHash`.
3. **Provenance par section** : calculé / règle documentée / interprétation symbolique / rédaction IA — ce que la conversation fait de façon déclarative (« ce qui est certain », « ce qui est approximatif »), AstroLab peut le rendre **structurel**.
4. **Garde-fous déjà écrits** : contrat de rapport AI (pas de données/sources inventées, pas de certitude excessive, contradictions visibles) — directement applicable au rédacteur de dossier.
5. **Gestion du temps incertain** : un dossier honnête doit dire quand l'Ascendant est inconnu ; AstroLab sait déjà le faire proprement.

## 5. Conflits à trancher (décisions produit)

Chaque décision a un impact sur la feuille de route. À trancher par le porteur produit :

- **D1 — Deux couches produit.** AstroLab = (a) noyau recherche/méthode (règles documentées, `RuleVersion`, tests) et (b) **couche livrable client** (dossier narratif généré depuis le meilleur socle disponible + étiquetage honnête). Les deux coexistent ; la couche (b) ne modifie jamais la couche (a).
  - Conséquence : remplacer l'exclusion « no AI-generated interpretation text » par « aucune interprétation IA dans les **résultats de méthode** ; l'écriture narrative est confinée à la couche livrable, étiquetée et validée ».
- **D2 — Étiqutage du livrable.** Chaque section du dossier porte un badge : `calculé` / `règle documentée` / `interprétation symbolique non validée` / `rédaction IA`. Le badge est-il affiché au client (transparence premium) ou seulement en interne ?
- **D3 — Traditions croisées.** Soit (i) on documente jyotish sidéral + chinois dans le registre (travail long, méthode), soit (ii) la couche livrable peut utiliser des calculs « développement » marqués `laboratoire`/`symbolique`, soit (iii) on ne livre que du tropical en attendant. La conversation vend déjà du croisé ; la question est : **quelle précision technique pour le sidéral/chinois avant de le vendre** (ayanamsa, calendrier lunaire/animal) ?
- **D4 — Périodes & Cycles.** Périmètre des outils de prévision sérieuse à implémenter (transits, progressions, retour de Saturne, révolution solaire, fenêtres larges) avec la règle éthique « fenêtres, thèmes, postures — jamais de dates d'événements ». Nécessite de sortir ces méthodes de `RESEARCH_BACKLOG`.
- **D5 — Données famille.** Le transgénérationnel exige naissances des parents (dates/lieux, optionnels). Stockage + consentement + usage limité au livrable.
- **D6 — Rédacteur IA.** Fournisseur/modèle, budget, confidentialité (données client), étape de validation automatique + relecture humaine (workflow actuel conservé), et mode hors-ligne du noyau (le calcul ne dépend pas du réseau ; la rédaction, si).
- **D7 — PDF & livraison.** PDF généré par job asynchrone (architecture le prévoit déjà) ; à brancher après D6.
- **D8 — Ce qui reste « recherche ».** Les dossiers clients peuvent-ils référencer des lectures que le noyau n'a pas validées (archétypes Jung, transgénérationnel) ? Recommandation : oui, dans la couche (b), avec étiquette `symbolique` explicite et hors du socle calculé.

## 6. Architecture cible (conceptuelle)

```
Données entrée (formulaire client)
        │
        ▼
┌───────────────────────────── noyau AstroLab (local, déterministe) ──┐
│ dossier → calcul (western natal ; plus tard jyotish/chinois)          │
│        → socle « certain » structuré (positions, angles, stabilité)   │
│        → (option) analyses temporelles (Périodes & Cycles)            │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │ sections « calculé » (toujours justes, traçables)
                                 ▼
┌────────────────────── couche livrable (nouvelle) ────────────────────┐
│ plan de dossier (11 sections) ; directives d'écriture (prompt maître)│
│ rédacteur IA par section, alimenté uniquement par :                  │
│   · socle structuré + incertitudes + badges de provenance            │
│   · directives de ton/éthique (fenêtres, pas dates, libre arbitre)   │
│ validateur de rapport (contrat existant : rien d'inventé, pas de     │
│   certitude excessive, incertitudes affichées, contradictions vues)  │
│ relecture humaine → versionnage du dossier → PDF (job) → livraison   │
└───────────────────────────────────────────────────────────────────────┘
```

Principes préservés : le calcul n'écrit jamais ; le rédacteur ne calcule jamais et ne crée ni fait, ni règle, ni source ; chaque dossier est un artefact versionné lié aux hachages du socle ; aucune méthode nouvelle n'entre dans le noyau sans passer par le registre.

## 7. Feuille de route par tranches

État d'avancement (mise à jour de cette session) : les fondations de la couche livrable (socle vérifié, plan 11 sections, rédacteur LLM/template, validateur, API et UI « Dossier client », export HTML/Markdown versionné) sont **implémentées** — voir `src/deliverables/`, `src/models/deliverableService.mjs`, `GET/POST/DELETE /api/deliverables` et la vue « Dossier client ». Par défaut d'implémentation (à confirmer) : D1 = deux couches, D2 = badges portés dans le document (pastilles par section) et dans les métadonnées.

### Tranche 0 — Fondations documentaires (faible coût, débloque tout)
- [ ] Consolider ce document en spec produit signée (D1–D8).
- [ ] Archiver les livrables de référence (résumé global + prompt maître + formulaire) dans `docs/` (copie de travail), pour que le repo soit autonome par rapport à ChatGPT.
- [ ] Définir le vocabulaire des badges de provenance du livrable.

### Tranche 1 — « Socle certain » livrable (sans IA narrative)
Faire produire par AstroLab la **section 2 factuelle** d'un dossier (et l'annexe technique du « I. Ce qui est certain ») : positions, signes, angles, maisons, stabilité de l'heure, plages d'Ascendant, incertitudes — sous forme de **fiche structurée prête à insérer** dans le dossier client.
- Sortie : nouveau service/générateur (ex. `dossierService` étendu ou `deliverableService`) qui compose cette fiche depuis un `calculationArtifacts` existant.
- Tests : exactitude des intitulés, honnêteté en heure inconnue, déterminisme, badges présents.
- Bénéfice immédiat : même sans rédacteur IA, la partie « certaine » du livrable est machine-juste, reproductible et différentiante.

✅ **Implémenté** : `buildSocle` + annexe « socle de calcul vérifié » (position, corps, angles, maisons, secte, aspects géométriques, analyse d'intervalle, avertissements) insérée dans chaque dossier ; tests y compris en heure inconnue.

### Tranche 2 — Plan de dossier + rédacteur IA laboratoire
- [ ] Composant `DossierPlan` : les 11 sections, chacune avec : entrées autorisées (quelles données structurées), badges, directives d'écriture, section de validation.
- [ ] Rédacteur IA **en laboratoire** (flag), appels par section, entrées strictement limitées (cf. D6), sortie passée au **validateur de rapport** existant (contrat AI Report Guardrail).
- [ ] Exemple de référence : régénérer un dossier « Caroline » (1986-01-02 16:45 Courbevoie, déjà utilisé en tests) : socle calculé par AstroLab, rédaction par section, comparaison au modèle conversation.
- [ ] Décision D2 sur l'affichage des badges.

✅ **Partiellement implémenté** : plan 11 sections (dont une annexe socle), directives d'écriture encodées, rédacteur par section (adaptateur OpenAI-compatible via `ASTROLAB_LLM_*` ou template déterministe), validation machine (contradictions avec le socle, prédictions d'événements, propos médicaux, certitudes déterministes), dossier versionné avec exports HTML/Markdown. Reste : clé LLM en production, choix du modèle/fournisseur (D6), et la décision D2 côté affichage client.

### Tranche 3 — Modules de calcul manquants du livrable
Par ordre de dépendance produit (chaque entrée nécessite une décision D3/D4) :
- [ ] **Périodes & Cycles v0** : transits actuels contre thème natal + retours (Saturne ~29 ans) + révolutions solaires, calculés en local, sorties en **fenêtres/thèmes** (jamais en dates d'événements) → promouvoir `western-transits` de `RESEARCH_BACKLOG` à `LABORATORY` avec fiche méthode.
- [ ] **Jyotish sidéral v0** (soleil/lune/asc sidéral, ayanamsa à verrouiller) → `jyotisha-natal`.
- [ ] **Chinois v0** (animal + élément de l'année ; plus tard BaZi) → `chinese-bazi`.
- [ ] Chaque module : fiche `docs/methods/`, statuts, tests de référence, badges.

### Tranche 4 — Chaîne livrable complète
- [ ] Formulaire client (naissance, parents optionnels, intention, modules) → création dossier.
- [ ] Job asynchrone « générer dossier » (calcul → rédaction → validation → PDF).
- [ ] Espace client (dossiers versionnés, artefacts, export), réconciliation avec le socle commerce (ordres, crédits) existant.
- [ ] Relecture humaine obligatoire avant envoi (workflow conversation conservé).

### Tranche 5 — Production / infrastructure
Selon README et architecture : base relationnelle + migrations, SMTP/OAuth, fournisseur IA sécurisé, PDF, durcissement (rate limiting, CSRF), paiement réel. Le noyau de calcul reste local et déterministe.

## 8. Risques et limites (à assumer dans la spec)

- **Qualité = modèle + directives + relecture.** La qualité de la conversation vient du prompt maître et d'un modèle capable, pas d'un algorithme local. La couche (b) dépendra donc d'un appel IA (coût, confidentialité, disponibilité).
- **Cohérence socle ↔ rédaction.** Le validateur doit empêcher que le texte contredise le socle (ex. écrire « Ascendant Gémeaux » alors que le calcul dit Sagittaire, ou inventer une heure en temps inconnu).
- **Méthodes non documentées en couche livrable.** Si l'on livre du sidéral/chinois/archétypes avant validation, il faut l'étiquette `symbolique` + une limite affichée ; ne jamais laisser croire à une règle validée.
- **Éthique commerciale.** Les garde-fous du prompt maître (pas d'événements, pas de diagnostic, libre arbitre) doivent être **structuraux** dans le validateur, pas seulement décoratifs.
- **Transgénérationnel.** Lecture symbolique sans prétention factuelle ; nécessite consentement sur les données parents.

## 9. Décision immédiate suggérée

1. Valider D1 (deux couches) et D2 (badges), car elles conditionnent toutes les tranches.
2. Lancer la **Tranche 1** (« socle certain » livrable) : actionnable maintenant, sans IA, à partir de l'existant.
3. En parallèle, produire **un dossier exemple de référence** (données sûres) avec socle AstroLab + rédaction conversation pour figer le format attendu — objet de comparaison pour la Tranche 2.

---

Ce document est volontairement un **point de départ à signer** : chaque tranche ne démarre qu'une fois les décisions dont elle dépend actées. Les fichiers `docs/methodology-registry.md` et `docs/architecture.md` devront être amendés quand D1–D8 seront validées (périmètre V1, place de l'écriture IA, méthodes temporelles).
