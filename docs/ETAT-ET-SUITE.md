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

## Habillage du document (comparaison concurrente, 11/09/2026)

Après avoir vu ce qu'un concurrent produit (couverture à cartes, roue du ciel,
tableau des planètes avec dignités, barres d'éléments et de « force des aspects »,
encadrés, marqueurs), la **famille 1** a été retenue et livrée : de la redite de
faits calculés, sans aucune règle nouvelle.

- **Couverture** : trois cartes (Soleil, Lune, Ascendant) sous le titre. Un
  Ascendant non décidable dans la marge affiche **les deux signes possibles** et
  la mention « non décidable » ; un signe simplement stable affiche « probable ».
  C'est exactement ce que la concurrence n'écrit pas.
- **Tableau des positions** dans l'annexe : sept corps puis Ascendant et Milieu
  du Ciel, colonnes Planète / Signe / Degré / Maison / Rétrograde, en-tête répété
  à chaque page imprimée. La marge est écrite **dans la cellule du degré**
  (« 25°03′ (±30 min) ») et une maison non décidable reste vide (—).
- **Habillage** : titres de section en petites capitales espacées avec marqueur,
  bandeau de couverture, tableaux, encadrés. Le `markdownToHtml` sait désormais
  rendre les tableaux `| … |` (l'export Markdown les porte aussi).
- **L'annexe n'est plus repliable.** Elle était dans un `<details>` (repliée à
  l'écran, censée se déplier à l'impression) : la règle CSS ne tenait pas dans le
  navigateur du client, donc le PDF sortait **sans l'annexe**, et un document
  payant ne doit de toute façon pas cacher de contenu derrière un clic. C'est
  maintenant une section comme les autres, toujours visible. La chaîne
  `annexShow` (« Voir les données astronomiques utilisées ») est supprimée des
  neuf langues : une chaîne morte finit par faire croire que le repli existe.
- **Export PDF** : le bouton ouvre la fenêtre d'impression (c'est le navigateur
  qui décide, pas la page — un `.pdf` téléchargé directement demanderait une
  génération côté serveur). En revanche le **nom de fichier proposé** est
  maintenant celui du document (« Lecture symbolique — Caro ») au lieu du titre de
  l'application, les fichiers HTML/Markdown téléchargés portent aussi ce nom, et
  l'aide du bouton est traduite dans les neuf langues (« choisissez Enregistrer au
  format PDF ; décochez En-têtes et pieds de page »). L'export du compte passe par
  le même chemin : plus de fenêtre surgissante à autoriser.
- **Fuite corrigée au passage** : l'export Markdown écrivait l'horodatage brut
  (`2026-09-11T09:29:18.661Z`) au lieu d'une date lisible, comme le HTML.
- **Outil** : `tools/preview-document.mjs` fabrique un document complet avec des
  textes de remplacement, sans réseau ni coût, pour juger la mise en page à
  l'impression — c'est le seul moyen de l'itérer sans payer une lecture.

**Délibérément NON fait**, faute de convention écrite ou de décision :

- barres « éléments » et « modalités » en **pourcentages** : un pourcentage suppose
  une règle de pondération. Un simple comptage serait calculé ; un score exige une
  convention `LASTRO_RULE` versionnée. Les pourcentages du concurrent n'ont aucune
  convention visible dans son document ;
- « force de vos aspects » : le mot *force* est une interprétation. Nous avons
  l'orbe et l'écart, donc une barre de **serrage** serait honnête (à faire si
  voulu) ;
- colonne **Dignité** : les dignités sont inactives (aucune `TRADITIONAL_RULE`) ;
- **roue du ciel** : faisable en SVG depuis nos longitudes, avec la fenêtre
  d'incertitude rendue visible — proposée, pas encore retenue.

## Contrôle d'un PDF réel et suite (11/09/2026)

Un PDF de 10 pages a été relu **sans navigateur** grâce à un nouvel outil,
`tools/inspect-pdf.mjs` : il décompresse les flux de contenu et applique les
tables `ToUnicode` des polices pour restituer le texte **page par page**. C'est
désormais la façon de vérifier un fichier livré (Chrome sans interface est bloqué
dans cet environnement).

Ce que ce contrôle a établi :

- l'**annexe est bien dans le fichier** (pages 8 à 10) : le repli supprimé était
  la bonne correction ;
- la **couverture porte les trois placements** et le **tableau des positions** est
  présent (« Positions calculées ») ;
- la date est écrite en clair (« Généré le 11 septembre 2026 »), pas d'horodatage
  brut ;
- l'annexe **ne commençait pas sur une nouvelle page** → corrigé :
  `break-before:page` à l'impression (elle est d'une autre nature que la lecture) ;
- **la lettre miroir vouvoyait encore** (« je souhaite vous inviter ») alors que la
  consigne demandait le tutoiement depuis `e28c51c`. Une consigne non mesurée ne
  tient pas : `findVouvoiement` fait maintenant du vouvoiement un **défaut** dans
  `transgenerationnel` et `lettre-miroir` (réécriture demandée, jamais
  d'amputation).

## Audit externe (SEO, SPA, Stripe) — ce qui a été suivi, et ce qui a été écarté

Un audit a produit trois recommandations. **La cause de son erreur sur le paiement
était notre README** : il annonçait « does not yet implement […] real payment
provider integration » et « la partie commerciale n'est qu'un brouillon
technique », alors que le paiement encaisse en production. Un auditeur qui lit la
porte d'entrée du dépôt en conclut logiquement que le bouton d'achat doit être
masqué. Le README a été réécrit (état réel, ce qui manque vraiment, comment
vérifier), et `STRIPE_INTEGRATION_TODO.md` déplacé dans `docs/`.

Vérification faite, point par point :

1. **« Pas de robots.txt ni de sitemap.xml » — exact, mais la raison importante
   était ailleurs.** Le site n'a qu'une page publique ; en revanche il expose deux
   familles de chemins **privés** : `/r/<jeton>` (le lien de récupération d'une
   lecture achetée, dont le jeton est le seul secret) et `/api/`. Ajoutés :
   `public/robots.txt` (Allow `/`, Disallow `/api/` et `/r/`), `public/sitemap.xml`
   (une seule adresse), et surtout un en-tête **`X-Robots-Tag: noindex, nofollow`**
   posé avant tout routage sur ces deux préfixes — `robots.txt` n'est qu'une
   convention, l'en-tête tient même si un lien est découvert autrement.
2. **« SPA : faites du pré-rendu ou du SSR » — recommandation écartée.** La page
   publique est du HTML statique ; le contenu dynamique est le **document privé du
   client**, qui ne doit surtout pas être indexé. Le SSR ajouterait une pile de
   rendu serveur pour zéro gain. Les vrais manques étaient : une description
   `<meta>` qui parlait de l'**outil d'exploitation** (« Dossier personnel
   structuré pour analyses transversales documentées ») au lieu du service vendu,
   aucune balise Open Graph (aucun aperçu lors d'un partage de lien), pas de
   canonical, pas de favicon. Corrigés.
3. **« L'intégration Stripe est inachevée, masquez le bouton d'achat » — faux et
   dangereux.** Le paiement est **en production et encaisse** (Checkout embarqué,
   carte, Apple Pay, Google Pay). Le fichier `STRIPE_INTEGRATION_TODO.md` — renommé depuis en
   `docs/stripe-checkout-decisions.md`, parce qu'un `*_TODO.md` à la racine fait
   croire à un chantier en cours — est un document d'**historique des décisions**,
   avec un bandeau de statut en tête. Suivre
   cette recommandation aurait coupé la seule source de revenus du produit.

Reste, si le référencement devient un objectif : une **page d'accueil publique
dédiée**, servie en HTML statique avec son propre contenu, plutôt qu'une vue cachée
de l'application (aujourd'hui seule la vue de connexion est active dans le HTML
livré, le visiteur voit la bonne vue après exécution du JavaScript).

## Contradiction du pied de page (corrigée)

Un relecteur a relevé, sur la dernière page, deux phrases inconciliables :

- « Texte rédigé par une IA — 2 relectures et corrections automatiques — **non relu
  par un humain** » ;
- « Rédaction : rédacteur IA configuré, sections validées par la machine **avant
  relecture humaine** ».

Les deux venaient du même pied de page : la seconde promettait une relecture que la
première démentait. Corrigé ainsi :

- **un seul texte de transparence**, dans les neuf langues : « Cette lecture est
  générée par une intelligence artificielle à partir de données astronomiques
  calculées et vérifiées automatiquement. Les interprétations sont symboliques et ne
  constituent ni des prédictions ni des vérités absolues. »
- la **note de rédaction** ne promet plus de relecture : elle décrit ce qui est
  réellement fait (production par un rédacteur IA, puis contrôle automatique de la
  cohérence avec les données calculées, des répétitions et du vocabulaire) ;
- la **clôture éthique** est réduite au libre arbitre (« Vous restez seul juge de ce
  qui vous correspond ») : elle répétait mot pour mot l'avis qui la précède ;
- le dossier du compte, lui, **garde** l'état de relecture réel
  (`aiReviewNote(…, reviewedByHuman)`) : c'est un fait de workflow, pas une
  promesse, et il ne contredit plus rien.

Détail assumé : « spécialisée » a été retiré de la phrase proposée — le rédacteur
est un modèle généraliste piloté par des consignes strictes, pas un modèle
spécialisé ; l'affirmer serait exactement le genre de mention non vérifiable que le
projet s'interdit.

**Et corrigé** : si la clé du rédacteur IA manque ou expire, le parcours public
livrait une lecture en mode gabarit portant « Ce document n'est pas prêt pour la
livraison » — chez un client qui a payé. Décision : **on ne vend pas ce qu'on ne
peut pas rédiger**, et la règle ne s'applique que là où l'argent circule.

- **avant tout débit** (aucune session de paiement fournie) : refus `503` avec un
  message explicite (« vous ne serez pas débité »), et **aucune commande créée** ;
  le formulaire n'ouvre même pas le panneau de paiement (`llmConfigured` est
  public dans `/api/config`) ;
- **client déjà débité** (session fournie et payée) : la commande est **enregistrée
  puis marquée en échec** — le lien de récupération existe, la relance se fait sans
  repayer, et **aucun brouillon n'est livré** ;
- **sans paiement configuré** (développement, démonstration, auto-hébergement) :
  rien ne change, le parcours public continue de produire un brouillon étiqueté.

Mesuré par `tests/paidPathGate.test.mjs` (4 cas, dont le client déjà débité avec
Stripe simulé).

## Habillage « livre premium », graphiques calculés (11/09/2026)

Un template HTML a été fourni (`lastro-template-v1.html`) : couverture pleine page
en dégradé, cartes, tableau, barres, anneau, roue. Deux constats à l'analyse :

- la **direction artistique** est adoptée telle quelle (papier crème, violet, or,
  Georgia pour les titres, sans-serif pour le corps, pages A4 exactes) ;
- les **graphiques du template étaient décoratifs** : la roue est un cercle CSS
  avec des glyphes positionnés à la main (`left:52%;top:10%`), et les pourcentages
  sont écrits en dur (20/55/15/10 et 61/5/34 — les chiffres du concurrent). Ils ont
  donc été **recalculés depuis le thème**.

Ce qui est maintenant livré, et mesuré par `tests/chart.test.mjs` :

- **roue calculée en SVG** (`src/deliverables/chart.mjs`) : secteurs des douze
  signes colorés par élément, glyphes, numéros de maison Whole Sign, chaque corps à
  sa longitude réelle, axes Ascendant et Milieu du Ciel. Quand l'Ascendant n'est
  pas décidable, la roue est orientée sur 0° Bélier et dessine la **zone balayée**
  (« AC ? ») au lieu d'un axe ; sans heure, chaque corps devient un **arc** au lieu
  d'un point. Un corps voisin est décalé sur un second rayon plutôt que superposé.
- **répartitions calculées** : quatre barres (éléments) et un anneau (modalités),
  sous convention `lastro-distribution@1.0.0` — sept corps traditionnels, sans
  pondération, corps sans signe établi exclus et comptés à part. Les pourcentages
  sont le rapport au nombre de corps **classés**.
- **couverture pleine page** reprenant le template, avec les trois placements et
  leur fragilité (« non décidable », « probable »).
- **pagination exacte** : `@page { size:A4; margin:0 }` et **2 cm de rembourrage**
  de feuille (le template en mettait 17 mm ; la demande initiale était 2 cm). La
  carte du ciel et l'annexe commencent chacune sur une page.

**Ce qui reste, et qui demande une décision** : la « conversion automatique en
PDF ». Aujourd'hui le PDF sort du dialogue d'impression du navigateur. Une
conversion automatique impose un **moteur de rendu HTML côté serveur**
(Chromium sans interface) : +300 Mo d'image Docker (ou ~60 Mo avec un build
dédié), et surtout une empreinte mémoire de plusieurs centaines de Mo par rendu —
à comparer aux 512 Mo d'une instance Render Starter. Le document HTML/CSS est
prêt pour cette étape ; c'est l'infrastructure qui demande un arbitrage.

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
| `tools/preview-document.mjs` | aperçu du document (mise en page) sans réseau ni coût |
| `tools/inspect-pdf.mjs` | lecture d'un PDF livré, page par page (texte extrait par les tables ToUnicode) |
| `src/deliverables/chart.mjs` | roue du ciel en SVG et répartitions calculées |
| `public/robots.txt`, `public/sitemap.xml`, `public/favicon.svg` | exploration et partage |
| `tests/printLayout.test.mjs` | contrats de mise en page imprimée et câblage des champs de lieu |

## Commandes utiles

```bash
npm test                                   # 196 tests
node --check <fichier>                     # après chaque édition
git status -sb                             # « ahead » = commits non poussés
curl -s https://www.lastro.fr/api/config   # état paiement / e-mail / code de test
```
