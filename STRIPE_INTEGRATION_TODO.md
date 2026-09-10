# Intégration Stripe Checkout — état et suite à faire

Ce fichier est la **source de vérité** pour ce qui reste à faire côté paiement.
Il complète l'intégration existante : **aucun fichier n'a été créé pour le paiement**,
l'appel existant a seulement été mis à jour.

## Décision prise : paiement dans la page (pas de redirection)

Checkout Studio demandait `ui_mode: hosted_page` (le client est **redirigé** vers une page
de paiement Stripe). **Décision confirmée : on garde `ui_mode: embedded_page`** — le
formulaire de paiement s'affiche à l'intérieur de la page Lastro, sans redirection.

Ce que cela implique :

- le client monte le formulaire Stripe en JavaScript avec `stripe.initEmbeddedCheckout(...)`,
  ce qui **exige** une session `embedded_page` — une session `hosted_page` ne peut pas être
  affichée dans la page ;
- `success_url` et `cancel_url` ne sont pas utilisés, puisqu'on reste sur place
  (`redirect_on_completion: "never"`) : la lecture se génère dès le paiement confirmé ;
- `integration_identifier` reste `hosted_web_0001` (valeur fixée par Checkout Studio),
  c'est un simple libellé d'attribution côté Stripe, sans effet sur le parcours.

**Si un jour tu veux basculer sur la page hébergée Stripe :**

1. dans [src/payments/stripe.mjs](src/payments/stripe.mjs) : passer `ui_mode` à `"hosted_page"`,
   retirer `redirect_on_completion`, ajouter `success_url` et `cancel_url` ;
2. dans [public/app.js](public/app.js) : remplacer le montage `initEmbeddedCheckout` par une
   redirection vers `session.url` (le serveur doit alors renvoyer `url` au lieu de
   `clientSecret`) ;
3. `cancel_url` vers la page de lecture, `success_url` avec le gabarit
   `{CHECKOUT_SESSION_ID}`.

## Values to Replace

Aucun placeholder ne subsiste dans le code : les paramètres `sample_only` ont été laissés
avec les valeurs réelles du produit.

**Fichiers concernés :**
- [src/payments/stripe.mjs](src/payments/stripe.mjs)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| mode | `payment` | **Rien à faire** : Lastro vend des lectures à l'unité. Passer à `subscription` seulement si un abonnement est ajouté un jour. |
| line_items | `price_data` dynamique : libellé « Lecture symbolique Lastro », **montant libre à partir de 5 €, sans plafond** (plancher `MIN_AMOUNT_CENTS` dans [src/payments/stripe.mjs](src/payments/stripe.mjs) ; seule limite haute : le maximum de Stripe pour un paiement unique), devise `STRIPE_CURRENCY` (eur) | **Rien à faire** : le montant est libre, il n'y a donc pas de `price_...` à créer. Les pastilles 5/10/20/30/50 € de [public/index.html](public/index.html) ne sont que des **suggestions** : le champ de saisie accepte davantage (le texte sous le champ le dit explicitement). Pour changer le plancher, modifier `MIN_AMOUNT_CENTS` (serveur) et `MIN_PAYMENT_EUROS` ([public/app.js](public/app.js)). Si tu passes un jour à des prix fixes, crée les produits dans le Dashboard (<https://dashboard.stripe.com/prices>) et remplace la ligne par `line_items[0][price]=price_...`. |
| success_url | *absent volontairement* | Non utilisé en paiement intégré (`redirect_on_completion: "never"`). À ajouter uniquement si tu passes en page hébergée : URL de la page de lecture, en conservant `{CHECKOUT_SESSION_ID}`. |
| cancel_url | *absent volontairement* | Idem : à ajouter uniquement en page hébergée (retour vers le formulaire de lecture). |
| ui_mode | `embedded_page` (avec repli automatique sur `embedded` pour les anciens comptes) | À confirmer : `embedded_page` = paiement dans la page (choix actuel) ; `hosted_page` = redirection vers Stripe (demande de Checkout Studio). |

## Configured Parameters

Ces paramètres viennent de Checkout Studio et sont déjà en place.

**Fichiers concernés :**
- [src/payments/stripe.mjs](src/payments/stripe.mjs)

| Parameter | Value |
|-----------|-------|
| ui_mode | `embedded_page` (paiement dans la page) |
| mode | `payment` |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `false` |
| submit_type | `auto` |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |
| redirect_on_completion | `never` (nécessaire au paiement intégré) |
| payment_method_collection | *non envoyé* : réservé au mode `subscription` |
| automatic_payment_methods | *supprimé* : ce paramètre n'existe plus dans l'API Stripe |

Détail qui a coûté du temps : `automatic_payment_methods` **n'existe plus** sur
`POST /v1/checkout/sessions` et `embedded` a été renommé `embedded_page` (vérifié sur la
spécification officielle, version d'API `2026-08-26.dahlia`). Les moyens de paiement
(carte, Apple Pay, Google Pay) sont désormais ceux activés dans
**Stripe → Paramètres → Moyens de paiement** : Stripe les applique automatiquement.

## Setup and next steps

### Variables d'environnement

À définir dans Render → Environment (et dans un `.env` local pour tester) :

| Variable | Rôle | Exemple |
|---|---|---|
| `STRIPE_SECRET_KEY` | Clé secrète, **jamais** exposée au navigateur | `sk_live_…` / `sk_test_…` |
| `STRIPE_PUBLISHABLE_KEY` | Clé publique, envoyée au navigateur par `/api/config` | `pk_live_…` / `pk_test_…` |
| `STRIPE_CURRENCY` | Devise (optionnel, `eur` par défaut) | `eur` |

Le projet n'utilise **pas** Vite : pas de préfixe `VITE_`. Les deux clés ci-dessus sont les
seuls noms utilisés, dans `.env.example`, dans `src/payments/stripe.mjs` et dans
`public/app.js` (qui reçoit la clé publique via l'API). L'appel à l'API Stripe se fait en
REST direct, **sans SDK** : aucune version d'API n'est épinglée dans le code, le compte
utilise donc sa version par défaut.

⚠️ Pièges qui ont déjà bloqué cette intégration :
- une clé collée avec un **retour à la ligne** ou un caractère invisible → détecté et nettoyé
  automatiquement, avec un avertissement au démarrage ;
- une clé **tronquée** au copier-coller → utiliser l'icône « copier » de Stripe, jamais une
  sélection à la souris ;
- les clés **live** ne fonctionnent pas avec la carte de test `4242…` : pour tester, utilise
  une paire `pk_test_` / `sk_test_`.

`/api/config` expose un diagnostic sans secret, pratique pour vérifier sans lire les logs :

```bash
curl -s https://astrolab-h6ep.onrender.com/api/config | python3 -c "
import json,sys; p=json.load(sys.stdin)['payments']
print('configuré :', p['configured'], '| problème :', p['problem'], '| notice :', p['notice'])
print('diagnostic:', p.get('diagnostics'))
print('dernière erreur Stripe :', p.get('lastError'))
"
```

`diagnostics.secretLength` doit être égal à `publishableLength` (les deux clés d'un même
compte ont la même longueur), et `lastError` doit être `null`.

### Structure du projet (fichiers concernés)

Aucun fichier n'a été ajouté pour Stripe. L'intégration vit dans :

```text
src/payments/stripe.mjs     appel REST POST /v1/checkout/sessions + lecture d'une session
src/http/app.mjs            POST /api/public/checkout-session, garde-fou de paiement, /api/config
public/app.js               montage du formulaire Stripe dans #checkout-container
```

### Comment ça marche

1. Le client choisit un montant **à partir de 5 €** (pastilles 5/10/20/30/50 € en suggestions, **20 € proposé par défaut**, saisie libre **sans plafond**) puis coche la mention « texte généré par une IA ».
2. `POST /api/public/checkout-session` crée une session Checkout (`embedded_page`, montant
   libre) et renvoie `sessionId` + `clientSecret`.
3. `stripe.initEmbeddedCheckout(...)` monte le formulaire **dans la page** ; à la
   confirmation, `onComplete` déclenche la génération.
4. `POST /api/public/readings` **vérifie le paiement** auprès de Stripe
   (`payment_status === "paid"`), refuse une session déjà utilisée (409) et refuse une
   lecture sans paiement (402) : le paiement est obligatoire, la lecture n'est jamais
   produite gratuitement tant que les clés sont configurées.
5. La lecture est générée puis renvoyée au navigateur ; rien n'est conservé côté serveur
   pour le parcours public.

### Tester sans payer

Deux moyens, complémentaires :

1. **Clés de test Stripe** (`pk_test_` / `sk_test_`) : le parcours complet est réel, avec la
   carte `4242 4242 4242 4242`, sans aucun débit. À privilégier pour valider le tunnel de
   paiement lui-même.
2. **Code de test** (`ASTROLAB_TEST_CODE`) : un code saisi dans le tunnel remplace le
   paiement et génère la lecture gratuitement, même avec les clés live. À privilégier pour
   tester la lecture de bout en bout (jusqu'au document téléchargé) sans encaisser.

Pour activer le code de test :

- Render → **Environment** → ajouter `ASTROLAB_TEST_CODE` avec **12 caractères minimum**
  (ex. une longue suite aléatoire) — le code n'est **jamais** écrit dans le dépôt ni envoyé
  au navigateur : il est comparé côté serveur ;
- dans le tunnel de paiement, un lien discret « J'ai un code de test » apparaît (il reste
  **invisible** pour les visiteurs tant qu'aucun code n'est configuré) ;
- un code valide : la lecture se génère sans paiement ; un code invalide : refus (403), avec
  une limite de 20 tentatives par heure ; chaque usage gratuit est journalisé
  (`[Lastro] lecture offerte (code de test)`).

⚠️ Ne communique ce code à personne : il donne des lectures gratuites. En cas de fuite,
change sa valeur dans Render (l'ancien code cesse immédiatement de fonctionner).

### Envoyer le lien de récupération par e-mail (Brevo)

Le client reçoit après paiement un **lien de récupération** vers sa lecture (valable 30 jours).
Pour qu'il le reçoive aussi par e-mail :

1. créer un compte sur <https://www.brevo.com> (offre gratuite : 300 e-mails/jour) ;
2. **Expéditeurs, domaines & IP → Domaines → Ajouter `lastro.fr`** : Brevo affiche alors
   2 ou 3 enregistrements DNS (un `TXT` de vérification, un `DKIM` de type
   `mail._domainkey`, parfois un `DMARC`). Recopie-les **tels quels** chez IONOS, à côté de
   tes enregistrements existants — **ne touche pas aux MX** de ton e-mail ;
3. **SMTP & API → Clés API** : créer une clé (elle commence par `xkeysib-`) ;
4. Render → **Environment** :

```
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=contact@lastro.fr
BREVO_SENDER_NAME=Lastro
```

Tant que ces variables ne sont pas définies, **rien n'est perdu** : le lien reste affiché au
client et le message attend dans la file interne (`outbox` du stockage) avec la raison de
l'échec. Dès que la configuration est là, les messages en attente partent au prochain envoi.

⚠️ Vérifie que `BREVO_SENDER_EMAIL` correspond bien à une adresse **vérifiée** chez Brevo,
sinon l'API refuse l'envoi (le message d'erreur est journalisé).

### Tests

| Carte | Comportement |
|---|---|
| `4242 4242 4242 4242` | paiement accepté (mode **test** uniquement) |
| `4000 0025 0000 3155` | demande une authentification 3D Secure |
| `4000 0000 0000 9995` | refus pour fonds insuffisants |
| Date d'expiration | n'importe quelle date future, CVC quelconque |

Apple Pay / Google Pay ne s'affichent **pas** sur `127.0.0.1`, ni en mode test sur un domaine
`*.onrender.com` : il faut un domaine réel en HTTPS (et Safari pour Apple Pay).

### Étapes suivantes

1. Vérifier dans Stripe → Paramètres → Moyens de paiement que « Cartes » est activé.
2. Tester une lecture complète en clés de test, puis repasser en clés live.
3. Envisager un **webhook** `checkout.session.completed` pour l'encaissement asynchrone : le
   parcours actuel vérifie le paiement à la demande, ce qui suffit pour une lecture unique,
   mais un webhook est nécessaire dès qu'il faudra livrer sans que le client reste sur la page.
4. Ajouter plus tard l'identifiant client Stripe (`customer_id`) et l'historique de commandes
   dans la base, quand les comptes clients existeront (aujourd'hui le parcours public est
   sans compte et sans stockage).

### Ressources

- Support : <https://support.stripe.com>
- Documentation : <https://docs.stripe.com/mcp>
- Clés de test : <https://dashboard.stripe.com/test/apikeys>
- Prix et produits : <https://dashboard.stripe.com/prices>
