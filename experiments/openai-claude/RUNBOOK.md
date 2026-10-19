# Annexe — expérience locale Lastro, avant le premier GO

## Sauvegarde et limites

Le correctif du validateur et les deux seules attentes autorisées sont sauvegardés dans le commit local `1a50b8932f8c2ecaf7eb8e0aadadfd9e3183fd60` : **641/641** tests. Les 29 tests de sécurité sont inchangés. Aucun push, merge ou déploiement. Le corpus historique non vérifiable est accepté seulement pour cette expérience fictive ; il bloque toujours la production.

Vérification finale : **654/654 tests**, dont les 641 initiaux et 13 contrôles supplémentaires. 134 fichiers JavaScript vérifiés sans erreur de syntaxe ni import relatif manquant. Après réduction du budget à 2 USD : **657/657 tests** (trois nouveaux tests de conservation/cumul du registre).

Le second changement ajoute uniquement l'adaptation expérimentale, son lanceur, des tests et ces documents. Les deux tickets de suivi sont des fichiers locaux dans `tickets/`, aucune solution de ticket n'est implémentée.

## API et modèle

L'adaptateur emploie l'API REST officielle Anthropic, sans dépendance SDK ni retry automatique : `GET /v1/models/claude-sonnet-5-5`, `POST /v1/messages/count_tokens`, puis `POST /v1/messages` uniquement après GO et réservation. Modèle fixé : `claude-sonnet-5-5`, disponible publiquement selon la documentation ; disponibilité avec votre clé encore non vérifiée. Paramètres Sonnet 5.5 : `thinking: between_tools`, effort `high`, aucun temperature/top_p/top_k personnalisé. Toute sortie, y compris un éventuel raisonnement, est bornée par max_tokens. Pas d’outil, écriture de cache explicite, mode premium ou fournisseur de remplacement. Les lectures de cache éventuellement retournées sont comptabilisées à leur tarif connu ; la réservation conserve le tarif plein, plus prudent.

Sources officielles vérifiées le 18 octobre 2026 :
- https://platform.claude.com/docs/en/models/sonnet-5-5/overview
- https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/api/messages/count_tokens
- https://developers.openai.com/api/docs/guides/token-counting

Tarif Claude standard global : **2 USD/M entrée, 10 USD/M sortie**. Le compteur officiel est interrogé sur le prompt réel ; une réservation conservatrice ajoute une marge et une borne en octets pour l'overhead. Aucun ratio d'octets n'est accepté comme substitut à ce compteur. Le tarif OpenAI reste celui du modèle effectif, jamais un tarif Claude ou un modèle unique agrégé. Les réponses OpenAI à identifiant snapshot sont vérifiées contre les deux snapshots connus et enregistrées avec leur identifiant exact.

## Budget et premier appel

Budget total bloquant 2 USD dans un registre privé persistant partagé par A/B/C, jamais réinitialisé à la reprise. Un ancien plafond de 5 USD est réduit sous verrou, en conservant toutes les dépenses et réservations ; la réduction est enregistrée. Aucune hausse automatique n’est acceptée. Premier message : synthèse C, **1 600 tokens générés maximum**, **0,04 USD maximum entrée + sortie** ; si le compteur et la marge conduisent au-delà, aucune génération n'est envoyée. Cela correspond au plus à 12 000 tokens d'entrée réservés et 1 600 de sortie au tarif indiqué. Les requêtes de métadonnées/comptage précèdent ce premier message après GO ; aucune n'est envoyée pendant cette préparation.

Le bloc C initial est réutilisé dans C, pas payé une deuxième fois. Chaque correction de validation est réservée séparément ; aucun retry réseau. Plafonds supplémentaires : 0,12 USD par appel de rédaction, 1,50 USD pour la relecture globale B, toujours sous le solde global de 2 USD. Un appel interrompu ou sans usage fiable conserve sa réservation et bloque la reprise. Un message tronqué avec usage fiable est comptabilisé puis rejeté. Un fichier inflight ou un verrou après interruption impose une revue ; ne pas l'effacer ou changer de répertoire pour contourner le budget.

Estimation globale exploratoire antérieure : environ 0,92 USD hors corrections, pas une promesse. Coût réel de cette préparation : **0 USD**. Le plafond console dédié, à configurer par vous, protège aussi des usages de la clé hors de ce registre.

## Configurer les clés et lancer après GO explicite

Dans un terminal zsh, saisir les valeurs masquées (pas de valeur dans l'historique, fichier ou chat) :

```sh
read -rs 'ANTHROPIC_API_KEY?Clé Anthropic : '
export ANTHROPIC_API_KEY
read -rs 'ASTROLAB_LLM_API_KEY?Clé OpenAI : '
export ASTROLAB_LLM_API_KEY
```

Toujours garder ce même répertoire privé pour l'expérience et ses reprises. Préparation locale sans requête :

```sh
node /Volumes/SSDA/Deep/AstroLab/experiments/openai-claude/run.mjs --mode plan --out /Users/Bassam/.codex/visualizations/2026/10/17/01a14bc6-57d7-74a3-a55b-68c5d7e07d46/comparaison-llm-lastro/experience
```

**Après votre GO autorisant l'expérience dans le plafond total de 2 USD seulement :**

```sh
node /Volumes/SSDA/Deep/AstroLab/experiments/openai-claude/run.mjs --mode compare --allow-paid --out /Users/Bassam/.codex/visualizations/2026/10/17/01a14bc6-57d7-74a3-a55b-68c5d7e07d46/comparaison-llm-lastro/experience
```

Option `--mode first` à la place de compare : un seul message Claude au maximum, puis arrêt ; il sera réutilisé par compare. Ne pas lancer first si votre GO autorise uniquement une préparation hors ligne. Le drapeau allow-paid matérialise l'autorisation d'exécution ; ce document n'est pas cette autorisation.

## Comparaison et résultats

Le thème fictif calculé par le moteur est figé dans fixture.json et partagé par les trois versions. A réutilise le writer de production, ses prompts, ses corrections et les modèles gpt-4o-mini/gpt-4.1-mini. C passe par les mêmes prompts, plans, preuves et validations ; le transport expérimental impose Claude pour toutes ses sections malgré les overrides OpenAI internes du writer. Ses métriques proviennent de l'usage réel Anthropic, pas de l'étiquette du writer. Aucun texte A n'est envoyé au rédacteur C.

B voit tous les chapitres de A et leurs permissions ; les préfixes/annexes restent serveur. Toute section rejetée conserve A avec motif explicite, sans dépassement du volume global de A. C doit conserver la structure et un volume à ±25 % de A, seuil fixé avant génération ; sinon l'expérience s'arrête sans tronquage ou remplissage silencieux.

Sorties privées 0600 : trois HTML X/Y/Z avec même rendu, carte et annexes, grille CSV, registre de coûts, métriques, checkpoints, journaux de validation et correspondance secrète séparée. Ne pas ouvrir la correspondance avant la notation. Aucun gagnant automatique. La répétition est mesurée par phrases normalisées identiques présentes dans plusieurs chapitres, hors préfixes et blocs calculés ; ce compteur n'évalue pas les paraphrases de sens.

Les coûts B incluent A, tandis que le budget réel de l'expérience ne compte A qu'une fois. Les projections 10/100/1 000 multiplient les coûts observés ; elles ne garantissent pas le coût d'autres thèmes. Toute reprise réutilise les sections terminées et les mêmes preuves, sans relance publique ni opération client.

## Reprise après la première réponse tronquée

Le premier appel réel du 18 octobre a consommé 2 573 tokens d'entrée et 900 de sortie : **0,014146 USD**, déjà comptabilisés. Son corps n'avait pas été sauvegardé par l'ancien lanceur ; il n'est pas reconstructible et aucun contenu validé n'en est réutilisé. Le marqueur est archivé après vérification de la ligne settled du registre, pas supprimé sans contrôle. Le registre et son plafond de 2 USD sont conservés.

Le premier bloc C passe à **1 600 tokens de sortie maximum**, les autres appels de rédaction restent à 900. À entrée réservée identique (11 389 tokens), la nouvelle réservation est **0,038778 USD**, sous le plafond inchangé de 0,04 USD. Le compteur est recalculé avant tout nouvel appel ; si l'entrée réservée dépasse 12 000 tokens, cet appel sera refusé avant génération.

Les futures réponses tronquées avec usage réconcilié sont sauvegardées en privé avec texte partiel, métriques et coût, puis rejetées. Leur marqueur inflight est retiré seulement après ces sauvegardes ; le processus s'arrête sans retry. Les appels interrompus ou sans compteurs fiables conservent leur marqueur et leur réservation. Aucune troncature n'est acceptée comme dossier valide.

La sortie totale initiale augmente de 700 tokens, soit **0,007 USD maximum de plus** sur l'estimation Claude précédente. Ajouter également les **0,014146 USD déjà dépensés**, sans remettre le compteur à zéro. La réussite sous 2 USD n'est pas garantie si d'autres blocs atteignent leur limite de sortie ou exigent des corrections. Reprendre avec la même commande compare et le même répertoire privé, dans le Terminal contenant ANTHROPIC_API_KEY ; OpenAI est chargé depuis le .env local existant avec --env-file. Ne pas coller les clés dans le chat.

## Limite de sortie de tous les blocs C après le deuxième arrêt

La reprise a terminé A (30 appels, 0,0128418 USD) et B (1 appel, 0,367482 USD). C possède sa synthèse validée, puis identity.block1 a atteint sa limite de 900 tokens (0,013986 USD), avec JSON incomplet sauvegardé et usage réconcilié. Total déjà dépensé, échecs inclus : **0,4233418 USD** ; solde : **1,5766582 USD**. Aucun dossier client concerné.

La limite de **1 600 tokens s'applique désormais à tous les blocs C**, et à leurs corrections, pas seulement au premier. A conserve 900 tokens par appel, B 30 000. Les prompts, preuves et contrôles de volume/validation sont identiques ; aucune sortie tronquée ne passe la validation. Aucun retry automatique d'une troncature. La reprise réutilise A et B et la synthèse C existante.

C possède 30 blocs : son maximum initial de sortie devient 48 000 tokens, soit 21 000 tokens / 0,21 USD supplémentaires par rapport à la configuration initiale toute à 900. L'estimation haute initiale A + B + C passe d'environ 0,966 à 1,176 USD, avant erreurs et corrections. Les deux essais tronqués totalisent 0,028132 USD supplémentaires ; ce coût reste définitivement inclus dans le registre. Avec deux corrections sur chaque bloc C, les 144 000 tokens de sortie C représenteraient seuls 1,44 USD : toutes les corrections possibles ne sont donc pas garanties sous 2 USD. Les réservations réelles sont contrôlées avant chaque appel. Premier appel toujours limité à 0,04 USD ; autres blocs 0,15 USD ; ensemble **2 USD maximum**, sans réinitialisation.
