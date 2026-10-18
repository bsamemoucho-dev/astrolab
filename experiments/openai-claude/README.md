# Lastro — expérience OpenAI / Claude, hors production

Branche `experiment/openai-claude-comparison`, base `origin/main` : `cb7c8f75d5cfc33190e39ee56041b9d43068c297`.

## État au 18 octobre 2026

Les trois failles démontrées sont corrigées dans le code expérimental : liaison planète/maison, constructions explicites d'aspects et dates de transits par rôle dans le fuseau du dossier. Les 29 tests de référence sont inchangés, et passent. Les deux attentes anciennes ont été actualisées avec autorisation explicite : corps Moon et deux jours locaux Paris. Voir [VALIDATION.md](VALIDATION.md).

**Préparation locale prête à demander le GO ; aucun appel avant ce GO. Déploiement toujours bloqué par le corpus historique manquant.** Aucun commit, push, merge, déploiement, appel fournisseur, e-mail ou opération client effectué pour cette préparation. Le stockage local ancien est lu seulement ; aucune preuve manquante n'est reconstruite.

## Reproduction hors ligne

```sh
node --test
node --test tests/llmComparisonSafety.test.mjs tests/astrologicalValidationPrecision.test.mjs tests/calendarPrefixes.test.mjs
node --test tests/experimentalBudgetGuard.test.mjs tests/experimentalEditorialProtocol.test.mjs tests/experimentalRegressionAudit.test.mjs
node experiments/openai-claude/audit.mjs /private/tmp/lastro-offline-audit
```

`node --test` : les 641 tests initiaux passent après les deux seules modifications d’attentes autorisées ; avec les tests supplémentaires de l’adaptateur et du lanceur, le résultat final est 654/654, entièrement hors ligne. Les tests HTTP existants nécessitent l'écoute locale sur 127.0.0.1. Les commandes ciblées passent sans fournisseur. `audit.mjs` utilise le vrai moteur de calcul et les vrais prompts/plans, avec un transport local simulé ; les résultats ne sont jamais présentés comme des dossiers A/B/C.

`regressionAudit.mjs <stockage-local> <module-validateur-production-figé> <sortie-privée>` ne doit recevoir que des chemins locaux autorisés. Il exige les plans et preuves d'origine pour une comparaison factuelle ; sans eux, le verdict reste indéterminé. Les textes ne sont jamais journalisés.

## Préparation de l'expérience

- `fixture.mjs` : thème fictif et ciel calculés en mémoire, sans accès au stockage client.
- `budgetGuard.mjs` : plafond maximum 5 USD, refus sans accord explicite, prix connus, réservation persistante avant transport, verrou, suivi par modèle, aucun retry automatique. Une requête d'issue incertaine garde son coût maximal réservé et bloque la reprise. Les fonctionnalités premium, outils, cache et raisonnement non budgétés sont refusés. Une réponse tronquée mais mesurée est comptabilisée puis rejetée.
- `editorialProtocol.mjs` : relecture B limitée aux blocs d'origine, permissions inchangées, préfixes serveur réattachés, conservation explicite de A si une section échoue, limite globale de mots, validation finale. Les annexes calculées ne sont pas éditables dans cette API. Tirage aléatoire des labels prévu, aucune correspondance de vrais dossiers générée à ce stade.
- Adaptateur REST Anthropic officiel et comptage réel câblés dans le module expérimental uniquement ; leur fonctionnement est testé avec un transport simulé. Aucun appel réel avant GO explicite. Voir [RUNBOOK.md](RUNBOOK.md). La protection locale ne plafonne pas les autres usages simultanés de la même clé hors du registre ; prévoir un workspace dédié si possible.
- La clé doit provenir exclusivement de `ANTHROPIC_API_KEY` à l'exécution. Aucun secret dans le code ou le dépôt.

Le modèle demandé reste `claude-sonnet-5-5`, sous réserve de disponibilité et de tarification revérifiées avant une future dépense autorisée. Aucun service externe contacté pendant la phase de correction du validateur.

Les tickets 01 (traçabilité) et 02 (maison du point natal) sont préparés localement dans `tickets/` sans implémentation ni publication GitHub.
