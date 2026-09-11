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
- **Qualité de langue (français)** : antécédents orphelins (« Cette position… »
  sans placement nommé), répétition d'un aspect ou d'une maison d'une section à
  l'autre, tutoiement, « trine » → détectés ; **réécriture demandée sans
  amputation** (contrairement aux erreurs factuelles).
- **Ordre des sections** : imposé par le `rank`, une seule fonction de tri
  (`dossierSectionsInOrder`) partagée par les deux services — coup d'œil 1,
  grandes lignes 2, identité 3, émotions 4, relations 5, action 6, forces et
  tensions 6.5 (conditionnelle), clés 7, passé 8, famille 9, lettre miroir 10,
  périodes 11.
- **Annexe** : repliée à l'écran, dépliée à l'impression. Elle publie la marge
  retenue et son origine, la convention d'aspects et sa table d'orbes, les
  aspects retenus avec orbe et écart, et la note de méthode localisée. Elle
  n'expose plus les avertissements bruts du moteur (anglais, statut interne,
  langage de préproduction).

## Ce qui reste

1. **« Vos périodes & cycles »** : module toujours indisponible (nécessite le
   calcul des transits/progressions). Il disparaît du document au lieu de dire
   « non disponible ».
2. **Rédacteur IA réel** : les garde-fous sont éprouvés avec des rédacteurs
   injectés ; la validation sur une vraie lecture complète (clé LLM configurée)
   reste à faire, en particulier la mesure du taux de réécriture par section.
3. **Étendre les détecteurs aux huit autres langues** : tous les détecteurs de
   langue (placeholders, contradictions, biographie, marge, antécédents,
   répétition, tutoiement) ne couvrent que le français.
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
  dans le dépôt) ; le code de test et les clés Stripe/Brevo ne sont pas dans le
  code.

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

## Commandes utiles

```bash
npm test                                   # 149 tests
node --check <fichier>                     # après chaque édition
git status -sb                             # « ahead » = commits non poussés
curl -s https://www.lastro.fr/api/config   # état paiement / e-mail / code de test
```
