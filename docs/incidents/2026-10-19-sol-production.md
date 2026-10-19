# Livraison GPT-6.1 Sol — 19 octobre 2026

## Périmètre autorisé

Livrer sur le service Render existant, sans génération IA d'essai, transaction
Stripe, e-mail de test ni modification des dossiers. Conserver intégralement le
site d'accueil, les langues, calculs, comptes, données et configurations métier.
La décision de déployer sans nouvelle campagne payante remplace l'attente d'essai
mentionnée dans l'annexe éditoriale précédente.

## Modèle et API

- Modèle exact : `gpt-6.1-sol`, identifiant officiel et accès de la clé de
  production contrôlés par `GET /v1/models/gpt-6.1-sol` : HTTP 200.
- Tous les chapitres narratifs, y compris Communication et Affection relationnelles,
  utilisent le même modèle configuré. Les surcharges `gpt-4.1-mini` sont retirées.
- Chat Completions est conservé : officiellement compatible sans appels d'outils.
- `reasoning_effort: low`, valeur officiellement supportée ; aucun `temperature`.
- `max_completion_tokens` remplace `max_tokens` pour Sol. Le plafond inclut le
  budget de sortie existant et 8 192 tokens de marge pour le raisonnement.
  Le budget de mots du texte reste inchangé. Cette marge ne demande pas au modèle
  de produire plus de pages et n'est facturée que si elle est effectivement utilisée.
- Réponse JSON conservée, `store: false`. Le modèle retourné doit confirmer Sol
  (ou son snapshot). Un refus, compteur absent, modèle différent ou indisponible
  produit une erreur explicite, sans changement de modèle.
- Les tokens de raisonnement sont compris dans `completion_tokens` facturés.
  Les consommations sont enregistrées même pour une réponse tronquée sans texte.
- Troncatures reconnues avant parsing ; aucune relance automatique de transport,
  interruption ou troncature. Les corrections de validation restent limitées à deux.
  Délai par appel Sol : 180 secondes.
- Le registre de budget existant et sa configuration sont conservés. Le contrôle
  préalable inclut la marge de raisonnement et une borne d'entrée en octets pour
  Sol, au lieu d'utiliser uniquement une approximation chars/4.

Sources officielles consultées le 19 octobre 2026 :
[modèle et tarifs Standard](https://developers.openai.com/api/docs/models/gpt-6.1-sol),
[compatibilité GPT-6](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6.1-sol),
[Chat Completions et max_completion_tokens](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

## Corrections éditoriales intégrées

Le commit `9d4e3105186c8d385d1e3f05f91e2a6e8bac4b7d` est l'ancêtre direct de
cette livraison : interactions anaphoriques contrôlées, propriété des idées,
rappels limités, figures conservées, couverture temporelle, orbes et mention de
validation clarifiés. Voir `2026-10-19-editorial-consistency.md`.
Les règles historiques non migrées restent disponibles ; aucune nouvelle
interprétation ou règle astrologique n'est inventée.

## Vérifications avant livraison

- Suite entière : **836 tests, 836 réussites** ; 11 nouveaux tests Sol.
- Les 29 tests de sécurité expérimentaux restent inchangés.
- Le parcours de paiement simulé garde ses assertions de livraison et de reprise
  sans nouvelle génération ; seul le faux fournisseur confirme désormais le
  modèle demandé, comme le fournisseur réel.
- Le nouveau texte d'accueil est présent, sans modification de ses fichiers.
- Production de départ : `2d9cbd893e0856db9828d359b738255591332754`, empreinte
  `/healthz` `ed9349d80b8e`, HTTP 200.
- Sauvegarde de base et environnement sur disque persistant :
  `/var/data/lastro-backups/pre-sol-2026-10-19T12-27-41-331Z/`.
  Permissions privées ; aucun secret ni dossier n'est inclus dans Git.
  23 lectures, 4 utilisateurs, 39 entrées outbox ; aucun dossier actif au contrôle.
  SHA-256 de la base :
  `2fc10806caa4db3f706bd0446da0444e7efdd9b6c10412e3491cfe018d766fce`.
- Code de retour arrière sauvegardé également dans un bundle Git local privé.
  La copie de base est sur le même disque persistant, pas une sauvegarde externe.
- Stripe : lecture du compte HTTP 200, mode réel, encaissements et reversements
  activés. Brevo : lecture du compte HTTP 200, relais SMTP actif depuis Render.
- Aucun Basic Auth, noindex global ou accès aux lectures gratuites n'est activé.
- Aucune variable de production n'est modifiée ; le modèle était auparavant
  choisi par la valeur par défaut du code. Ne pas appliquer le blueprint Vtest.

## Coût estimatif sans génération

Tarifs Standard, contexte court : 2 USD/M tokens d'entrée et 10 USD/M tokens de
sortie, raisonnement inclus. Aucun supplément Fast/Ultrafast n'est demandé.
Sur un thème fictif, avec les véritables invites de production :

| Hypothèse | Volume |
|---|---:|
| Appels hors corrections | 36 |
| Entrée estimée (chars/3,5) | 78 791 tokens |
| Sortie visible estimée depuis les repères de rédaction | 10 834 tokens |
| Raisonnement supposé | 500 à 1 500 tokens/appel |
| Coût estimé sans corrections ni remise de cache | **0,45 à 0,81 USD** |

C'est un ordre de grandeur, pas une moyenne mesurée de Sol. Le thème, les rappels
et les corrections changent le coût réel. La borne très conservatrice du thème
fictif, avec chaque appel au plafond, toutes les deux corrections et la borne
haute d'entrée en octets, est de 11,216 USD ; ce n'est ni une dépense attendue ni
un plafond global nouvellement configuré. La marge de tokens protège la sortie,
elle ne constitue pas une consigne de longueur.
**Aucun appel de génération réel n'est effectué pour cette livraison.**

## Vérifications après livraison et retour arrière

Confirmer le SHA actif Render, l'empreinte locale et `/healthz`, puis
`/api/config` et la configuration des deux axes spécialisés depuis le code actif.
Contrôler l'accueil, les assets, les formulaires et langues, les routes et leur
authentification, les HTML/PDF existants et les logs de démarrage. Lire les
métadonnées Stripe/Brevo uniquement. Comparer la base et la configuration à la
sauvegarde ; ne créer ni commande ni livraison pour effectuer ces contrôles.

En cas de blocage, arrêter les actions clients et diagnostiquer. Pour revenir au
code précédent, redéployer le SHA `2d9cbd893e0856db9828d359b738255591332754` sur
le même service, avec les variables et le disque existants. Aucune migration
n'étant introduite, ne pas remplacer la base par une copie ancienne lors d'un
simple retour arrière de code.

## Limites qui restent explicites

La migration des règles sémantiques reste partielle ; les règles historiques sont
conservées. Les contrôles éditoriaux ne prouvent pas la qualité de toute prose
possible. La couverture des six semaines dépend des contacts calculés existants.
Le sujet indépendant `PERSONAL_TRANSIT.natalHouse` n'est pas corrigé ici.
La concurrence de workers et l'idempotence globale des notifications restent des
sujets distincts ; cette livraison ne prétend pas les résoudre.
La qualité d'un dossier réellement écrit par Sol sera appréciée lors de l'usage
normal du site, conformément à la décision de ne pas lancer un essai payant.
