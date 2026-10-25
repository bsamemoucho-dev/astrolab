# Lecture contextualisée et pages claires — 25 octobre 2026

## Causes constatées

- La page publique avait été éclaircie sans harmoniser les feuilles des guides, le calendrier et les suggestions de villes. Le document initial pouvait aussi apparaître sombre avant son script.
- Les preuves d'angle et de maison existaient, mais cinq contextes ne possédaient aucune licence symbolique active. Les encadrés pouvaient citer des maisons sans lecture autorisée.
- Les fonctions des deux corps des transits étaient disponibles dans le catalogue, mais le prompt mettait surtout en avant des expressions communes aux aspects. Des exemples de formulations avaient aussi créé des répétitions de style.
- Deux contacts complémentaires avec les extrémités opposées d'un axe pouvaient représenter un même pic UTC, avec des fenêtres différentes dues aux orbes. Le texte affichait deux repères.
- Les dates locales et la direction UTC étaient contrôlées, mais la formulation « aujourd'hui » devait être reliée à l'instant du dossier. Le contrôle de direction n'était pas exécuté assez tôt pour un préfixe serveur.

## Correction

Les pages publiques et connectées utilisent une palette claire cohérente, sans modifier l'authentification ni les actions. Le guide des maisons et un glossaire imprimable donnent les douze domaines et six définitions générales.

Cinq conventions Lastro explicitement autorisées sont ajoutées : Ascendant Cancer, Lune maison 3, Mercure et Saturne maison 6, Jupiter maison 8. Leur documentation est dans `../doctrine/natal-angle-house-context-v1.md`. Elles exigent une preuve stable ; les maisons exigent WHOLE_SIGN. Une incertitude non résolue refuse la licence. Aucun calcul ni matrice générale d'interprétation n'est ajouté. Les blocs existants reçoivent une consigne explicite pour développer leur contexte primaire ; aucun bloc ou appel supplémentaire n'est créé.

Les encadrés ne citent un contexte interprété qu'avec sa propre licence active dans le bloc. Les repères sans lecture portent un intitulé exact. Les transits traditionnels réutilisent les fonctions documentées de leurs deux corps et de leur aspect. Aucun droit de lecture n'est ajouté aux transits lents/angles qui n'en disposent pas.

Les contacts complémentaires sont regroupés seulement si leurs preuves, pic UTC, orbe réel, phase et fiabilité concordent. Le représentant est une fenêtre originale contenant l'autre ; les deux preuves restent dans le bloc. Aucune nouvelle fenêtre n'est calculée. Les contacts interprétés et les occurrences distinctes restent séparés.

« Aujourd'hui » utilise le fuseau du dossier et un snapshot fermé sans licence interprétative. Une date relative incorrecte ou une direction passé/futur contraire au pic UTC reste bloquante, dès la prévalidation du préfixe serveur et aussi globalement.

Le plan réserve les applications aux chapitres propriétaires et la conclusion reçoit aussi la synthèse et les relations déjà validées. Des compteurs de style limitent les amorces répétées dans la correction bornée existante. Aucun texte n'est coupé après validation.

## Vérifications et limites

La suite couvre les cinq nouveaux contextes dans le vrai moteur et le vrai prompt avec transport simulé, les incertitudes, les licences hors portée, les aspects non autorisés, les dates Paris/minuit/DST, les axes complémentaires et les erreurs du préfixe avant transport. Les 29 tests de sécurité préexistants restent inchangés. Le calcul astronomique, le modèle configuré, Stripe, Brevo, les comptes et le stockage ne changent pas.

Les contrôles de navigateur sont simulés hors ligne ; la validation PDF utilise le moteur de rendu actuel et préserve la narration existante. Aucun nouvel appel LLM payant n'est utilisé pour cette livraison. Les tests prouvent les contraintes et la transmission du contexte, pas la qualité littéraire d'une future réponse réelle. Les autres placements sans convention restent des faits calculés ; le glossaire général ne donne aucune licence personnelle.

## Livraison et retour arrière

Vérifier la CI sur le SHA exact, l'absence de génération/notification active et sauvegarder le stockage et l'environnement en accès privé avant fusion. Après déploiement Render, contrôler le SHA, l'empreinte `/healthz`, les routes publiques, le modèle, les configurations Stripe/Brevo et l'absence de modification du stockage.

Retour arrière : redéployer le commit antérieur `dda54b41fabf296b71766a236036b32ca5fd3b0d` sur le service existant, en conservant l'environnement et le stockage courant. Ne jamais restaurer automatiquement une ancienne base susceptible d'effacer des commandes intervenues après la sauvegarde. Aucun dossier existant n'est relancé et aucune notification n'est envoyée pendant ces contrôles.
