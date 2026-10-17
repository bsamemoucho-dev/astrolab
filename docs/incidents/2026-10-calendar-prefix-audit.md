# Correction des préfixes calendaires et audit des dossiers échoués

Audit du 17 octobre 2026. Dépôt : `/Volumes/SSDA/Deep/AstroLab` ; branche vérifiée : `deploy-price-5-eur` ; base : `25b3b17ecd58c6e36dd1fe3c06721f8adb386bf3`.

## Correction

Le validateur confondait le mois « mars » dans les préfixes calculés avec la planète Mars. Le préfixe seul suffisait à créer un faux aspect Soleil–Mars (L-2026-9EHVJM-FAHF) ou Vénus–Mars (L-2026-EUC777-NZ2X).

L'extracteur neutralise uniquement le token du mois dans les dates françaises explicites jour/mois ou mois/année, après normalisation des accents et de la casse. Il conserve les offsets, les véritables mentions de Mars et les autres caractères : une date intercalée dans un véritable aspect ne bloque pas sa détection. Lorsqu'un même token d'aspect est déjà associé à un sujet et un objet explicites, il ne doit pas être réutilisé pour fabriquer un aspect entre son objet et une autre planète plus loin dans la phrase.

Les préfixes passent le même validateur avant tout appel au LLM. Un rejet produit HTTP 500 et `SERVER_PREFIX_VALIDATION_FAILED`, avec zéro appel LLM. Les validations du texte complet restent bloquantes. Les logs contiennent le bloc, le code de règle et le fait structuré, avec `server_prefix` pour le contrôle isolé et `combined_text` pour les rejets ultérieurs ; cette seconde valeur n'attribue pas abusivement l'échec au préfixe ou au LLM.

Les logs ne contiennent ni texte généré, ni message libre de validation, ni dates, ni identifiants de preuves, ni coordonnées client. Les faits enregistrés se limitent aux champs astrologiques typés.

## Vérification

`tests/calendarPrefixes.test.mjs` utilise `buildFullDossierPlan`, le véritable générateur de préfixes de production, puis `validateStructuredSection` et le parcours `writeStructuredSectionWithLlm` avec un rédacteur simulé, sans requête réseau.

La matrice couvre 5 aspects × 12 mois × 10 corps × 3 fenêtres (même jour, mois suivants, année suivante) × 2 sections (CURRENT/UPCOMING), soit 3 600 préfixes et 3 600 contre-exemples non autorisés. S'ajoutent les deux incidents, les passages multiples, la coexistence mois/planète, les dates intercalées, les rejets internes sans LLM, les corrections bloquantes du texte généré et la confidentialité des logs.

Commandes de vérification :

```sh
cd /Volumes/SSDA/Deep/AstroLab
node --test tests/calendarPrefixes.test.mjs tests/fullDossierPlanner.test.mjs
npm test
git diff --check
```

Résultats sur la version finale : **554 tests passés, 0 échec** pour `npm test` ; **72 tests passés, 0 échec** pour la sélection ciblée ; contrôles de syntaxe et `git diff --check` réussis. Aucun calcul astrologique modifié. Les formulations calendaires ambiguës sans jour ni année ne sont pas supprimées globalement : le nom nu « Mars » reste une planète, afin de préserver le contrôle des véritables faits.

## Audit de production strictement en lecture seule

Sources : état JSON existant lu directement avec `fs.readFileSync` (sans instancier JsonStore), logs Render disponibles, GET Stripe de la session Checkout et de son PaymentIntent avec la charge développée. Aucune relance, notification, modification de dossier, opération Stripe ou écriture dans l'état de production.

Les 12 dossiers sont tous `failed`, sans `reading` sauvegardé. Aucune livraison de lecture n'est confirmée pour ces dossiers. Les trois notifications mentionnées ci-dessous sont des notifications d'échec, jamais une livraison du dossier.

Dates affichées en Europe/Paris (UTC+02:00 à ces dates), à la seconde. « n.d. » signifie que l'heure d'échec exacte n'est pas enregistrée ; la dernière modification est donnée séparément et ne constitue pas une preuve d'heure d'échec.

| Dossier | Création (Paris) | Échec enregistré (Paris) | Dernière modification si échec absent |
|---|---|---|---|
| L-2026-TKEF9D-J2UZ | 03/10/2026 19:21:11 | n.d. | 03/10/2026 19:21:13 |
| L-2026-8EDPCV-HRW5 | 03/10/2026 19:21:57 | n.d. | 03/10/2026 19:21:58 |
| L-2026-VVRBBH-NWZS | 03/10/2026 21:09:15 | n.d. | 03/10/2026 21:10:32 |
| L-2026-YS5NWV-7VY3 | 03/10/2026 21:11:46 | n.d. | 03/10/2026 21:13:02 |
| L-2026-SFBMXL-XG66 | 04/10/2026 01:38:38 | n.d. | 04/10/2026 01:39:37 |
| L-2026-HXA4LB-XWCE | 04/10/2026 02:48:20 | n.d. | 04/10/2026 02:49:23 |
| L-2026-KBGQXK-6YDT | 04/10/2026 13:49:58 | n.d. | 04/10/2026 13:51:07 |
| L-2026-5K92RV-N795 | 04/10/2026 14:07:05 | 04/10/2026 14:12:47 | — |
| L-2026-DNEJEY-KVRR | 04/10/2026 14:12:07 | 04/10/2026 14:13:11 | — |
| L-2026-TP6S23-DZWF | 10/10/2026 12:37:47 | 10/10/2026 12:39:53 | — |
| L-2026-EUC777-NZ2X | 10/10/2026 22:44:51 | 10/10/2026 22:46:53 | — |
| L-2026-9EHVJM-FAHF | 17/10/2026 22:47:36 | 17/10/2026 22:49:35 | — |

Un paiement en mode réel ne prouve pas une commande extérieure : le titulaire peut avoir effectué un essai interne. De même, un accès par code partagé ne permet pas à lui seul d’identifier l’utilisateur comme exploitant. L’enquête d’identité reste dans un rapport privé, hors Git et hors PR.

Légende financière : « offert ancien » = `freeAccess=true`, sans session de paiement ni code individuel enregistré ; le mécanisme précis (code partagé, développement ou autre) n'est pas documenté. « test partagé » = `sharedFreeAccessQuota=true`, sans code individuel ni session de paiement. Les montants gratuits sont absents de l'état ; aucun encaissement n'est enregistré pour ces dossiers, ce qui ne permet pas d'affirmer l'absence de toute transaction externe non liée.

| Dossier | Origine / paiement | Montant capturé prouvé | Notification client | Bloc ou section en échec | Code exact disponible | Cause / certitude | Action recommandée, non exécutée |
|---|---|---|---|---|---|---|---|
| L-2026-TKEF9D-J2UZ | Offert ancien ; sans paiement lié | Aucun enregistré | Absence de preuve d'envoi ou tentative | Non conservé | Erreur fournisseur `credit_balance_exhausted` / HTTP 429 ; aucun code de validation | Autre : quota API épuisé ; élevée | Vérifier la disponibilité actuelle du fournisseur avant d'envisager une reprise autorisée |
| L-2026-8EDPCV-HRW5 | Offert ancien ; sans paiement lié | Aucun enregistré | Absence de preuve d'envoi ou tentative | Non conservé | Erreur fournisseur `credit_balance_exhausted` / HTTP 429 ; aucun code de validation | Autre : quota API épuisé ; élevée | Même vérification fournisseur |
| L-2026-VVRBBH-NWZS | Offert ancien ; sans paiement lié | Aucun enregistré | Absence de preuve d'envoi ou tentative | Section `general_synthesis` ; bloc non conservé | Non conservé | Indéterminée ; faible | Retrouver une archive des trois validations avant reprise |
| L-2026-YS5NWV-7VY3 | Offert ancien ; sans paiement lié | Aucun enregistré | Absence de preuve d'envoi ou tentative | Section `general_synthesis` ; bloc non conservé | Non conservé | Indéterminée ; faible | Retrouver une archive des trois validations avant reprise |
| L-2026-SFBMXL-XG66 | Paiement réel ; encaissé, non remboursé selon Stripe au contrôle | 3,00 EUR | Absence de preuve d'envoi ou tentative ; aucune lecture prête pour la même session | Section `general_synthesis` ; bloc non conservé | Non conservé | Indéterminée ; faible pour la cause, élevée pour l'encaissement | Priorité client payant : diagnostic de la validation, puis décision humaine de livraison ou remboursement ; aucun nouveau paiement |
| L-2026-HXA4LB-XWCE | Offert ancien ; sans paiement lié | Aucun enregistré | Absence de preuve d'envoi ou tentative | Section `general_synthesis` ; bloc non conservé | Non conservé | Indéterminée ; faible | Retrouver une archive des trois validations avant reprise |
| L-2026-KBGQXK-6YDT | Offert ancien ; sans paiement lié | Aucun enregistré | Absence de preuve d'envoi ou tentative | `general_synthesis.block1` | Code de validation et code applicatif non conservés | Indéterminée ; faible | Reconstituer les preuves et retrouver les validations |
| L-2026-5K92RV-N795 | Test partagé ; sans paiement lié | Aucun enregistré | Absence de preuve d'envoi ou tentative | `general_synthesis.block1` | Application : `structured_block_validation_failed` ; règle précise absente | Indéterminée ; faible | Retrouver les validations ; deux tentatives de génération enregistrées ne donnent pas leur contenu |
| L-2026-DNEJEY-KVRR | Test partagé ; sans paiement lié | Aucun enregistré | Absence de preuve d'envoi ou tentative | `general_synthesis.block1` | Application : `structured_block_validation_failed` ; règle précise absente | Indéterminée ; faible | Retrouver les validations avant reprise |
| L-2026-TP6S23-DZWF | Test partagé ; sans paiement lié | Aucun enregistré | Notification d'échec envoyée, 1 tentative, accusé fournisseur enregistré | `relational_communication.resource` | Application : `structured_block_validation_failed` ; règle précise absente | Indéterminée ; faible | Comparer aux correctifs relationnels déjà présents sans leur attribuer cet échec faute de preuve |
| L-2026-EUC777-NZ2X | Test partagé ; sans paiement lié | Aucun enregistré | Notification d'échec envoyée, 1 tentative, accusé fournisseur enregistré | `current_sky.transit_07` | Application : `structured_block_validation_failed` ; `undeclared_text_fact` reproduit sur le préfixe | Collision « mars » ; élevée par reproduction, logs détaillés historiques indisponibles | Candidat à reprise après validation et déploiement de cette correction, sous autorisation distincte |
| L-2026-9EHVJM-FAHF | Test partagé ; sans paiement lié | Aucun enregistré | Notification d'échec envoyée, 1 tentative, accusé fournisseur enregistré | `current_sky.transit_01` | Application : `structured_block_validation_failed` ; `undeclared_text_fact` dans les 3 logs et reproduit | Collision « mars » ; élevée | Même action conditionnelle |

Les notifications d'échec ont `status=sent`, `attempts=1`, `sentAt` et un identifiant fournisseur. Cela prouve l'acceptation de l'envoi par le fournisseur, pas la réception en boîte ni la lecture. Horaires Paris : TP6S23-DZWF le 10/10 à 12:39:53.706 ; EUC777-NZ2X le 10/10 à 22:46:53.840 ; 9EHVJM-FAHF le 17/10 à 22:49:36.021. Chacun a aussi une alerte administrateur envoyée. Pour les neuf autres, aucune entrée d'outbox correspondante : ni tentative ni envoi ne sont démontrés, et l'absence de notification n'est pas démontrée hors de ce système.

Preuve Stripe du dossier payant : `livemode=true`, session `complete`, `payment_status=paid`, PaymentIntent `succeeded`, `amount_received=300`, charge `paid=true`, `captured=true`, `amount_captured=300`, `refunded=false`, `amount_refunded=0`, devise EUR. Aucun identifiant Stripe ou client n'est inclus ici.

## Totaux et limites

1. Dossiers échoués avec paiement réellement encaissé confirmé : **1**.
2. Dossiers avec paiement réel sans livraison confirmée : **1** ; identité interne ou externe du titulaire non établie par cet audit anonymisé. Aucun dossier prêt ne partage sa session de paiement.
3. Encaissement brut correspondant : **3,00 EUR** ; remboursement enregistré : **0,00 EUR** ; solde après remboursement : **3,00 EUR**, hors frais et autres opérations éventuelles non auditées.
4. Dossiers offerts concernés : **11**, dont **5 tests partagés** et **6 accès gratuits anciens au mécanisme indéterminé** ; **0 code individuel enregistré**, **0 session Stripe test liée**.
5. Dossiers dont le blocage identifié est levé par cette correction : **2 candidats à récupération**. Cela ne garantit pas la réussite d'une génération complète. Pour les 10 autres, récupération non démontrée par cette correction ; 2 exigent une vérification fournisseur et 8 un diagnostic de validation.

Les textes LLM et les faits rejetés historiques n'ont pas été persistés ; aucun diagnostic « maison de transit » n'est établi pour ces 12 dossiers. Ne pas déduire une règle précise du seul code applicatif d'échec. Les dates exactes d'échec manquent pour les sept dossiers les plus anciens. Une archive externe des logs, si elle existe, est nécessaire pour compléter ces informations ; aucune commande sur l'état courant ne peut recréer des réponses LLM disparues.

## Problème indépendant : maison du point natal

Non corrigé dans ce changement. `fullDossierPlan` transmet `PERSONAL_TRANSIT.natalHouse` au rédacteur, mais la reconnaissance textuelle d'une maison exige actuellement une preuve `NATAL_BODY_HOUSE`. Un packet autorisant seulement un transit avec `natalHouse=7` peut donc transmettre une maison dont la mention « maison 7 » est ensuite rejetée.

Le calcul source (`currentSkyService.natalPointsFromChart` / `westernTransits`) rattache cette maison au **point natal**, pas à une maison occupée actuellement par la planète en transit. Il ne faut surtout pas transformer cette valeur en placement de la planète transitante.

Solution distincte proposée : ajouter explicitement au BlockPlan la preuve natale existante correspondant au point natal et à la maison calculée, seulement si elle est stable, exploitable et conforme à la politique de réutilisation ; sinon ne pas présenter cette propriété comme un fait narratif autorisé. Vérifier la sémantique, la propriété de preuve et le système de maisons avant modification. Ne pas élargir globalement `refSupportsHouse` à tout transit.

Tests spécifiques à prévoir : maison stable identique acceptée avec sa preuve ; maison différente bloquée ; mauvaise planète bloquée ; heure inconnue ou maison instable exclue ; distinction point natal / planète transitante ; absence de réutilisation primaire non autorisée.

## Mise en production proposée, après validation humaine seulement

Render déploie automatiquement `main` : ni push sur `main`, ni fusion, ni appel de déploiement n'ont été effectués.

Après revue, créer une branche de correction, y committer uniquement les quatre fichiers de ce changement, pousser la branche et ouvrir une PR vers `main`. Vérifier la CI avant d'autoriser la fusion. Après autorisation explicite de production, la fusion déclenchera l'auto-déploiement existant.

```sh
cd /Volumes/SSDA/Deep/AstroLab
git switch -c fix/calendar-prefix-validation origin/main
git add src/deliverables/factualClaimsValidator.mjs src/deliverables/structuredSectionWriter.mjs tests/calendarPrefixes.test.mjs docs/incidents/2026-10-calendar-prefix-audit.md
git commit -m "fix: distinguish calendar months from planetary aspects"
git push -u origin fix/calendar-prefix-validation
gh pr create --base main --title "Fix calendar month collisions in aspect validation" --body "Distingue les mois calendaires des planètes, valide les préfixes avant le LLM et conserve les rejets factuels bloquants. Validation : 554 tests passent."
# Uniquement après validation du déploiement et CI verte :
gh pr merge <NUMERO_PR> --squash
# Contrôle en lecture seule après déploiement :
curl -fsS https://www.lastro.fr/healthz
node --input-type=module -e 'import {releaseFingerprint} from "./src/http/release.mjs"; console.log(releaseFingerprint())'
```

Comparer le fingerprint à celui du commit réellement fusionné. Ne pas utiliser `tools/verify-production-reading.mjs` pour ce contrôle : cet outil crée une lecture en production. Toute reprise client ou notification reste une opération distincte nécessitant l'autorisation de l'exploitant.
