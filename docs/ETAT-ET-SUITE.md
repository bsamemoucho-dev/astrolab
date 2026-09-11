# État du projet et suite — brief de reprise

Ce fichier sert à reprendre le travail dans une nouvelle conversation sans
reconstituer le contexte. Il décrit **ce qui est fait**, **ce qui est décidé**,
**ce qui reste**, et les constats techniques vérifiés.

## Où en est le produit

Lastro est **en production** : `https://www.lastro.fr` (Render, dépôt
`bsamemoucho-dev/astrolab`, branche `main`). Paiement Stripe intégré dans la
page, envoi des liens par e-mail (Brevo, `info@lastro.fr`), disque persistant
monté (`/var/data/astrolab.json`), code d'accès gratuit de test
(`ASTROLAB_TEST_CODE`).

Le parcours public : formulaire → paiement → rédaction → lecture + **lien de
récupération** (`/r/<jeton>`, valable 30 jours) + e-mail. Une commande est
enregistrée **avant** la rédaction : un échec ou une page fermée reste
récupérable, sans jamais repayer.

## Décisions prises (elles ne sont plus en attente)

1. **Marge sur l'heure approximative — tranché.** Le formulaire demande « vers
   quelle heure » et propose ± 15 / ± 30 / ± 60 minutes ; **± 30 min par
   défaut**. Convention versionnée `lastro-time-margin@1.0.0`.
2. **Doctrine des aspects — tranché : activés.** Convention versionnée
   `lastro-aspects@1.0.0` avec **orbes écrits**, publiée dans l'annexe. « Vos
   forces et vos tensions » est réactivée, **conditionnelle** à des indicateurs
   robustes.

Le détail doctrinal des deux conventions est dans
[`docs/conventions-lastro.md`](conventions-lastro.md). Toute nouvelle convention
suit la même discipline : versionnée, écrite dans l'annexe, mesurée par un
détecteur.

## Comportements vérifiés dans le moteur (à ne pas re-supposer)

- **Heure inconnue** : angles, maisons et secte ne sont pas calculés ; les degrés
  ne sont plus affichés (plus de « 0°00′ » ni de signe « null »).
- **Heure approximative** : la marge est **toujours connue et écrite**. Angles,
  maisons et secte sont calculés aux deux bornes de la fenêtre.
  - signe stable dans la marge → donné comme **probable**, jamais exact ;
  - signe qui change dans la marge → **non décidable**, aucun signe affirmé, et
    les maisons ne sont plus transmises ;
  - secte qui bascule (lever/coucher du Soleil) → non affichée ;
  - corps dont le signe change dans la marge → jamais affirmé dans un signe.
- **Plafond de langage mesuré** : `findUnhedgedTimedAssertions` détecte dans le
  texte réel un degré précis sur un angle, un signe d'angle non nuancé, un signe
  d'angle non décidable, une maison non décidable, un signe de corps instable.
  Réécriture demandée, puis phrases fautives retirées.
- **Aspects** : convention `lastro-aspects@1.0.0` (conjonction et opposition 8°,
  trigone 7°, carré 6°, sextile 4°, élargis à 10/8/8/6° avec un luminaire). Un
  aspect qui sort de l'orbe sur la marge est **écarté**, motif écrit, et la liste
  des écartés figure dans l'annexe.
- **Placeholders non remplis**, **contradictions planète ↔ signe**,
  **inventions biographiques** : détectés, section réécrite, phrase retirée en
  dernier recours. Couverture limitée au français.
- **Journal d'exploitation** : chaque réécriture, chaque défaut de style conservé
  et chaque retrait de phrase est journalisé **avec ses motifs** (`unfilled_placeholder`,
  `unhedged_angle_sign_assertion`, `biographical_invention`…). Un exploitant peut
  savoir pourquoi une section a été reprise sans relire le texte.
- **Qualité de langue (français)** : antécédents orphelins (« Cette position… »
  sans placement nommé), répétition d'un aspect ou d'une maison d'une section à
  l'autre, tutoiement, « trine » → détectés ; **réécriture demandée sans
  amputation** (contrairement aux erreurs factuelles).
- **Couverture par langue des détecteurs** (mesurée par
  `tests/languageCoverage.test.mjs`, déclarée dans `DETECTOR_COVERAGE`) :
  - **les 9 langues** : plafond de langage de la marge, contradiction
    planète ↔ signe et angle ↔ signe, placeholders, anti-répétition ;
  - **français seulement** : prédiction d'événement, affirmation médicale,
    formulation déterministe, invention biographique, tutoiement, vocabulaire
    imposé (« trigone »), antécédent orphelin.
  Les noms de signes et d'angles sont cherchés en **préfixe de mot** : sans cela,
  « Ascendanten » (norvégien) et « im Löwen » (allemand) échappaient au contrôle.
  Les noms de corps restent en mot exact (« Sun » ne doit pas valoir « sunny »).
- **Ordre des sections** : imposé par le `rank`, une seule fonction de tri
  (`dossierSectionsInOrder`) partagée par les deux services, vérifiée sur la
  lecture publique **et** sur le dossier du compte — coup d'œil 1,
  grandes lignes 2, identité 3, émotions 4, relations 5, action 6, forces et
  tensions 6.5 (conditionnelle), clés 7, passé 8, famille 9, lettre miroir 10,
  périodes 11.
- **Annexe** : repliée à l'écran, dépliée à l'impression. Elle publie la marge
  retenue et son origine, la convention d'aspects et sa table d'orbes, les
  aspects retenus avec orbe et écart, et la note de méthode localisée. Elle
  n'expose plus les avertissements bruts du moteur (anglais, statut interne,
  langage de préproduction).

## Retours sur un PDF réel (11/09/2026)

Cinq retours après impression d'une vraie lecture, tous traités :

1. **Mise en page.** 2 cm de marge tout autour à l'impression (`@page`), feuille
   sans rembourrage en impression (sinon les marges s'additionnent), blocs plus
   aérés, interligne du corps passé de 1,75 à 1,6 avec un vrai espace entre
   paragraphes (1,1 em) et entre sections (2,6 em). **Un titre ne peut plus
   rester seul en bas de page** (`break-after:avoid` sur les titres,
   `break-before:avoid` sur le paragraphe qui les suit, `orphans`/`widows` à 3).
   Verrouillé par `tests/printLayout.test.mjs`.
   Note : la date, l'URL et le numéro de page visibles sur le PDF viennent des
   en-têtes/pieds du navigateur (option « En-têtes et pieds de page » de la boîte
   d'impression), pas du document.
2. **Tutoiement dans la partie adressée aux parents.** Exception voulue au
   vouvoiement général : `transgenerationnel` et `lettre-miroir` demandent
   explicitement la deuxième personne du singulier, le guide de style français ne
   dit plus « vouvoiement constant », et `findTutoiement` ne signale plus le
   tutoiement dans ces deux sections (`TUTOIEMENT_SECTIONS`).
3. **Lieux des parents non reconnus (corrigé).** `attachPlaceAutocomplete`
   n'était branché que sur le champ `birthPlace` : taper la ville du père ou de la
   mère ne déclenchait aucune recherche ni correction. La liste
   `EXPRESS_PLACE_FIELDS` branche désormais les trois champs de lieu, chacun avec
   son encadré de résultat, et `resolvePlaceForForm` sait quel champ réécrire avec
   le nom canonique. Un test compare cette liste aux champs réellement présents
   dans le formulaire : un champ de lieu non branché fait échouer la suite.
4. **« hôpital de … » introuvable : comportement normal.** La reconnaissance passe
   par l'API de géocodage Open-Meteo (base GeoNames) : des **communes**, pas des
   établissements. Les libellés disent maintenant « ville de naissance » et un
   repère précise que la reconnaissance ne connaît que les villes.
5. **Paiement : Link retiré, portefeuilles conservés.** La session Checkout
   restreint les moyens à `card` — Apple Pay et Google Pay sont des portefeuilles
   *à l'intérieur* de « carte », ils restent donc proposés — et exclut
   explicitement `link` (`excluded_payment_method_types`), avec repli automatique
   si la version d'API du compte ne connaît pas ce paramètre. Reste à vérifier
   côté Stripe : l'activation d'Apple Pay et le réglage de Link dans
   *Paramètres → Moyens de paiement*. Rappel : Apple Pay ne s'affiche que sur
   Safari (macOS/iOS) avec une carte dans Wallet ; sur Chrome ou Firefox desktop,
   c'est Google Pay qui apparaît.

Défaut supplémentaire repéré sur ce même PDF : l'introduction **répétait le titre
de la section** (« Votre ciel en un coup d'œil : … ») parce que la consigne le
citait littéralement. La consigne demande maintenant un paragraphe de synthèse
« sans reprendre le titre de la section ».

## Corrections marquantes (contexte pour la suite)

- **Contradiction planète ↔ signe : faux positif systématique (corrigé).** Le
  socle exposait `id: "body.Sun"` mais pas de clé `body` ; le détecteur ne
  reconnaissait donc **aucun** corps et déclarait une contradiction dès qu'une
  phrase nommait une planète avec un signe — **même le bon**. Sur le parcours
  public, ces phrases étaient réécrites puis, la réécriture échouant, **retirées**.
  C'est une cause probable des « antécédents orphelins » décrits plus haut :
  des sections amputées de leur phrase d'ouverture. Corrigé, avec un test qui
  exige qu'une phrase juste passe.
- **Règle française appliquée à toutes les langues (corrigé).** « trine » est le
  mot juste en anglais ; il était refusé comme vocabulaire interdit dans un
  document anglais. Les règles de langue sont désormais liées à la langue du
  document.
- **Consigne et garde-fou se contredisaient (corrigé).** La consigne de
  « Votre passé » demandait « les responsabilités précoces possibles, les
  renoncements silencieux » — exactement ce que le détecteur d'invention
  biographique retire. Le modèle obéissait à la consigne, puis le garde-fou
  effaçait la phrase : deuxième cause directe des sections amputées. Les
  consignes de rédaction ne nomment plus le vocabulaire interdit (le nommer
  amorce le modèle) ; elles décrivent quoi faire. Un test vérifie désormais que
  **tout terme refusé par un détecteur est absent des consignes**.
- **`\b` et les lettres accentuées (corrigé).** « complète » contenait « te »
  pour le détecteur de tutoiement, et « carré » n'était jamais reconnu comme
  aspect. Frontières de mot Unicode.

## Ce qui reste

1. **« Vos périodes & cycles »** : module toujours indisponible (nécessite le
   calcul des transits/progressions). Il disparaît du document au lieu de dire
   « non disponible ».
2. **Tirage fr + en (8 lectures) — mesuré, et il a changé le diagnostic.** La
   mesure unique était trop favorable. Sur 8 lectures (2 langues × 4 cas) :
   - **110 appels LLM pour 88 sections (+25 %)**, 30 réécritures, **24 phrases
     retirées** ;
   - `heure-inconnue` était le cas noir : **18 et 19 appels pour 11 sections, 8 et
     9 sections amputées**. Cause : sans heure, le signe de la Lune n'est pas établi
     (« Balance → Scorpion ») ; le modèle en nommait un, le détecteur le refusait à
     juste titre, et la phrase disparaissait — section après section. Aucune
     consigne ne disait quoi faire de ce vide, contrairement au cas de la marge.
   **Correctif appliqué et remesuré** : consigne dédiée aux corps dont le signe
   n'est pas établi (dans la langue du document), code de détection dédié
   `asserted_unestablished_sign` (ce n'était pas une « contradiction »), et mention
   explicite dans l'annexe. Résultat sur le même cas : **0 amputation** (contre 8 et
   9), 13 et 15 appels (contre 18 et 19).
   Détail chiffré conservé : `docs/research/mesure-fr-en.json` (avant) et
   `docs/research/mesure-heure-inconnue-apres.json` (après).
   Restent deux défauts systématiques, corrigés par consigne mais **pas encore
   remesurés** : un gabarit non rempli (5 sur 22 sections) et un coup d'œil
   dépassant le plafond de 900 caractères (4 sur 22) — chacun coûtant une
   réécriture par lecture.

3. **Rédacteur IA réel — première mesure.** Une lecture complète a été générée en local
   avec le rédacteur IA configuré (2 janvier 1986, Courbevoie, heure
   approximative ±30 min, 9 langues non testées ici) :
   - **13 appels LLM pour 11 sections** : 3 sections ont déclenché une
     réécriture, et une seule a été amputée d'une phrase ;
   - motifs réels relevés : `unfilled_placeholder` (un gabarit non rempli dans le
     coup d'œil), `unhedged_angle_sign_assertion` (signe d'Ascendant stable mais
     affirmé sans nuance), `biographical_invention` (invention biographique) ;
   - **aucun `contradiction_with_socle`** : le faux positif systématique est bien
     éteint (avant correction, les 11 sections auraient été réécrites) ;
   - le document livré ne contient ni placeholder, ni fuite interne, et publie la
     marge et la convention d'aspects.
   Reste à mesurer : le taux de réécriture sur un **tirage de plusieurs dizaines
   de lectures**, langue par langue, pour régler les détecteurs au lieu de les
   supposer bien calibrés.
3. **Étendre les règles éditoriales aux huit autres langues** : les règles de
   sécurité factuelle sont désormais couvertes dans les 9 langues, mais la
   prédiction d'événement, l'affirmation médicale, l'invention biographique,
   l'antécédent orphelin et le tutoiement restent propres au français.
4. **Exemple de référence** : régénérer un dossier « Caroline »
   (1986-01-02, Courbevoie) et le comparer au modèle conversation.
5. **Antécédents orphelins** : la consigne et le détecteur sont en place ; il
   reste à vérifier le taux réel de correction sur un tirage de lectures réelles.

## Invariants à respecter

- **Une consigne n'est pas une contrainte** : toute règle importante doit être
  **mesurée** (détecteur) puis **réécrite**, pas seulement demandée au modèle.
- **Rien d'affirmé qui ne soit calculé** : pas d'angle, de maison ou d'aspect
  inventés ; le plafond de langage dépend de la **qualité des données**.
- **Quatre natures** de provenance : `CALCULATED`, `TRADITIONAL_RULE`
  (aucune active), `LASTRO_RULE` (conventions versionnées), `LLM_SYNTHESIS`. Une
  convention ne porte que sur la structure, jamais sur la signification.
- Une section sans matière fiable **disparaît** : jamais de « module
  indisponible » ni de remplissage dans un document vendu.
- Ne jamais exposer : statuts internes, badges de classification, horodatage
  brut, placeholders, langage de préproduction, avertissements bruts du moteur.
- Deux régimes de correction : **fatal** (affirmation fausse → réécriture puis
  retrait de la phrase) et **style** (maladresse → réécriture, jamais
  d'amputation).
- **Sécurité** : secrets uniquement dans les variables d'environnement (jamais
  dans le dépôt). Mesuré par `tests/noSecrets.test.mjs` : les fichiers suivis par
  git sont scannés à chaque `npm test` (clés Stripe live/test, webhook, Brevo,
  jeton GitHub, clé privée PEM, valeur longue affectée à une variable secrète) et
  `.env` doit rester non suivi. Le fichier de test ne recopie jamais la valeur
  trouvée : il nomme le fichier, la ligne et le motif.

## Cartographie utile

| Fichier | Rôle |
|---|---|
| `src/astro/westernNatal.mjs` | calcul astronomique, marge d'incertitude, angles, maisons, secte |
| `src/astro/rules/lastroAspects.mjs` | convention `lastro-aspects@1.0.0` (orbes, aspects retenus) |
| `src/deliverables/socle.mjs` | socle vérifié + annexe technique |
| `src/deliverables/validator.mjs` | tous les détecteurs (fatal et style) |
| `src/deliverables/plan.mjs` | sections, rangs, directives de rédaction |
| `src/deliverables/i18n.mjs` | 9 langues (interface, annexe, conventions) |
| `src/models/publicReadingService.mjs` | parcours public vendu (réécriture, sections conditionnelles) |
| `src/http/app.mjs` | routes publiques, paiement, livraison |
| `public/app.js`, `public/index.html` | formulaire public (heure, marge, paiement) |
| `tests/noSecrets.test.mjs` | garde-fou : aucun secret dans les fichiers suivis |
| `src/deliverables/detectorVocabulary.mjs` | vocabulaire des détecteurs par langue (incertitude, identité, degrés) |
| `tests/languageCoverage.test.mjs` | couverture mesurée des détecteurs dans les 9 langues |
| `tests/writerDirectives.test.mjs` | ce que le rédacteur reçoit vraiment (invite interceptée, sans réseau) |
| `.github/workflows/tests.yml` | `npm test` + contrôle de syntaxe à chaque push |
| `tools/measure-readings.mjs` | tirage de lectures pour mesurer le taux de réécriture, par langue |
| `tools/verify-production-reading.mjs` | vérification de bout en bout après déploiement |
| `tests/printLayout.test.mjs` | contrats de mise en page imprimée et câblage des champs de lieu |

## Commandes utiles

```bash
npm test                                   # 170 tests
node --check <fichier>                     # après chaque édition
git status -sb                             # « ahead » = commits non poussés
curl -s https://www.lastro.fr/api/config   # état paiement / e-mail / code de test
```
