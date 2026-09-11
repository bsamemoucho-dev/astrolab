# État du projet et suite — brief de reprise

Ce fichier sert à reprendre le travail dans une nouvelle conversation sans
reconstituer le contexte. Il décrit **ce qui est fait, ce qui est décidé, ce qui
reste**, et les constats techniques vérifiés.

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

## Comportements vérifiés dans le moteur (à ne pas re-supposer)

- **Heure inconnue** : angles, maisons et secte ne sont pas calculés ; les
  degrés ne sont plus affichés (plus de « 0°00′ » ni de signe « null »).
- **Heure approximative** : l'heure est traitée comme un **instant de
  référence** (ex. 10:00). Aucune marge n'est capturée — le moteur le dit :
  *« No uncertainty margin was supplied »*. L'Ascendant sort comme une valeur
  unique, marquée `depends_on_approximate_birth_time`, et `exact_angles_without_uncertainty_margin`
  figure dans les indéterminables. **Le langage ne reflète pas cette fragilité :
  c'est le défaut le plus grave identifié.**
- **Aspects** : ils sont **calculés et transmis au rédacteur** dès qu'une heure
  est fournie (le socle contient des faits `aspect.*`). Mais l'annexe les
  déclare encore « inactive structures » : **incohérence doctrinale à trancher**.
- **Placeholders non remplis** et **contradictions planète ↔ signe** et
  **inventions biographiques** : détectés, section réécrite, phrase retirée en
  dernier recours. Couverture limitée au français pour les deux derniers.

## Décisions en attente (elles bloquent la suite)

1. **Marge sur l'heure approximative** — recommandation : proposer « vers 10h »
   + marge optionnelle (15/30/60 min), **± 30 min par défaut**, et plafonner le
   langage des angles et maisons (« probablement en Lion ») tant que la marge
   n'est pas connue.
2. **Doctrine des aspects** — recommandation : les **activer** sous convention
   Lastro documentée (`lastro-aspects@1.0.0`) qui écrit les **orbes retenus**,
   et cesser de les déclarer inactifs dans l'annexe. Sans cette décision,
   « Vos forces et vos tensions » ne peut pas revenir.

## Chantiers ouverts, dans l'ordre

1. **Annexe visible dans le PDF** — fait (repliée à l'écran, dépliée à
   l'impression). Sans elle, aucune lecture n'est auditable.
2. **Marge horaire + plafond de langage** (décision 1).
3. **Doctrine des aspects** (décision 2), puis réactivation de « Vos forces et
   vos tensions », qui doit rester **conditionnelle** à des indicateurs robustes.
4. **Antécédents orphelins** : plusieurs sections commencent par « Cette
   position… », « Cette maison… » sans nommer la planète ou la maison. La règle
   correcte : **nommer une fois** le placement en début de section, puis ne pas
   le réexpliquer. L'anti-répétition a surcorrigé (consigne actuelle : ne
   réexplique pas → le modèle a compris « ne nomme pas »).
5. **Anti-répétition étendue aux aspects et maisons** (un même aspect est
   aujourd'hui répété dans deux sections).
6. **Vouvoiement constant** en français (le texte mélange « vous » et « tu ») et
   vocabulaire : « trigone », jamais « trine ».
7. **Ordre des sections (tranche E)** : corriger les `rank` (coup d'œil 1,
   grandes lignes 2, identité 3, émotions 4, relations 5, action 6, clés 7,
   passé 8, famille 9, lettre miroir 10, périodes 11), trier par rang dans les
   deux services, renommer « Structure psychologique & émotionnelle » →
   « Vos émotions » et « Lecture approfondie du passé » → « Votre passé » dans
   les 9 langues.

## Invariants à respecter

- **Une consigne n'est pas une contrainte** : toute règle importante doit être
  **mesurée** (détecteur) puis **réécrite**, pas seulement demandée au modèle.
- **Rien d'affirmé qui ne soit calculé** : pas d'angle, de maison ou d'aspect
  inventés ; le plafond de langage dépend de la **qualité des données**.
- **Quatre natures** de provenance : `CALCULATED`, `TRADITIONAL_RULE` (aucune
  active), `LASTRO_RULE` (conventions versionnées), `LLM_SYNTHESIS`.
- Une section sans matière fiable **disparaît** : jamais de « module
  indisponible » ni de remplissage dans un document vendu.
- Ne jamais exposer : statuts internes, badges de classification, horodatage
  brut, placeholders, langage de préproduction.
- **Sécurité** : secrets uniquement dans les variables d'environnement
  (jamais dans le dépôt) ; le code de test et les clés Stripe/Brevo ne sont pas
  dans le code.

## Commandes utiles

```bash
npm test                                   # 124 tests
node --check <fichier>                     # après chaque édition
git status -sb                             # « ahead » = commits non poussés
curl -s https://www.lastro.fr/api/config   # état paiement / e-mail / code de test
```
