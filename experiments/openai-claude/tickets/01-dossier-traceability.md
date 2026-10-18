# Ticket 1 — Traçabilité et conservation des dossiers

Statut : suivi local, solution non implémentée. Bloquant pour un déploiement du nouveau validateur : le corpus legacy local ne permet pas une revalidation avec ses permissions originales.

Conserver un snapshot immuable lié à la version du dossier et à son resultHash : preuves atomiques et provenance, plan éditorial, packets/BlockPlans, règles et versions, version du validateur, fuseau de référence et convention de présentation temporelle. Garder les preuves d'origine d'un dossier échoué également, sans exposer des prompts ou coordonnées dans les logs publics.

Définir avant implémentation le périmètre de données strictement nécessaire et une durée de conservation conforme aux engagements Lastro (durée actuelle à vérifier, aucune durée inventée ici). Stockage privé avec contrôle d'accès, chiffrement adapté, sauvegardes et suppression effective selon la même politique. Aucun snapshot dans Git, aucune clé ou jeton d'accès dans les preuves. Exports exclusivement privés et autorisés ; pseudonymisation du rapport technique.

Critères d'acceptation : rejouer exactement un texte avec ses preuves et permissions d'origine ; vérifier empreintes et versions ; distinguer snapshots manquants et documents invalides ; tester isolation entre comptes, suppression/expiration et sauvegardes ; documenter les engagements de conservation et la migration sans reconstruire silencieusement l'historique.
