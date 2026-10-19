# Cohérence éditoriale — 19 octobre 2026

## État de livraison

Correctif local dans `fix/editorial-consistency`, fondé sur le commit de production
`2d9cbd893e0856db9828d359b738255591332754`. Aucun déploiement, push, appel IA réel,
paiement, notification, modification de dossier ou changement de configuration.
Les deux éléments non suivis étrangers au correctif restent exclus.

## Fournisseur réellement utilisé

La configuration de production contrôlée lors du diagnostic utilise OpenAI :
`gpt-4o-mini` pour le rédacteur général, `gpt-4.1-mini` pour les deux sections
relationnelles spécialisées. Le module Anthropic est expérimental ; il n'est pas
le rédacteur du parcours public. Aucun modèle ni tarif n'est modifié ici.

## Causes établies et changements

### Interactions non autorisées

Le détecteur exigeait deux aspects explicites dans une même phrase et un marqueur
appartenant à une liste fermée. La formulation signalée (« cette harmonie peut
être mise à l’épreuve par les tensions évoquées précédemment ») ne contenait ni
les deux aspects ni un marqueur reconnu.

Le détecteur reconnaît maintenant ce marqueur, avec les deux apostrophes, et les
renvois explicites vers les aspects déjà nommés. Le validateur examine aussi les
blocs antérieurs du même chapitre. En cas d'antécédents multiples, aucune licence
n'est supposée : chaque paire possible doit être autorisée. Les relations
calculées restent la seule source de licence. Les simples énumérations et les
négations couvertes par les règles existantes restent acceptées.

Les logs techniques exposent uniquement les corps, types d'aspects et la
provenance du constat ; les phrases et données personnelles ne sont pas ajoutées
aux logs par ce changement.

### Répétitions et profondeur

En mode de production `composition` + `reference`, un aspect n'est plus une
interprétation primaire dans le chapitre du corps ET dans sa catégorie. Son
propriétaire est unique ; les placements en signe/maison ont également leur idée
et leur propriétaire dans la mémoire éditoriale.

Les packets de rappel ne transmettent plus les thèmes ou concepts à développer.
Les rappels isolés ont un bloc distinct : une phrase et 45 mots maximum, contrôlés
par le validateur. Leur repère est de 25 mots ; le reste du budget reste affecté
au développement principal. Le budget numérique survit au découpage par bloc,
sans transmettre les packets des autres blocs.

Une figure licenciée conserve toutes ses preuves dans un seul bloc d'exploration.
Les aspects qui servent sa structure ne sont pas artificiellement séparés dans
un rappel d'une phrase. Les consignes demandent des dilemmes et manifestations
possibles, au conditionnel, plutôt qu'une succession de qualités.

### Fenêtre des transits

Deux troncatures privilégiaient les premiers jours : les 48 premiers résultats
classés puis les 8 premières preuves du chapitre futur. Le service réserve
maintenant jusqu'à 24 places aux transits futurs, réparties sur six portions de
leur intervalle disponible, puis complète la limite globale de 48. Le plan
retient jusqu'à 8 contacts représentatifs et diversifie les corps quand possible.
Le ciel actuel est également plafonné à 8 contacts dans le plan de production.

Les occurrences futures d'une configuration déjà active restent dans le chapitre
futur en production. Les passages d'une même configuration restent regroupés à
l'intérieur de chaque chapitre. Aucun calcul, instant UTC, orbe ou statut
astronomique n'est modifié. La sélection utilise exclusivement les contacts
calculés ; elle ne crée pas un transit pour combler une semaine vide.

Les métadonnées de sélection sont versionnées et incluses dans la clé du cache.
Le texte précise que les transits sont une sélection, pas une prévision exhaustive.

### Présentation des garanties et des orbes

La mention finale décrit un contrôle automatique des faits et règles ; elle
précise qu'il ne garantit pas la qualité des interprétations et qu'une relecture
humaine reste nécessaire. Elle ne prétend pas qu'une personne a déjà relu le texte.

L'annexe affiche l'orbe réel (écart au degré exact) puis l'orbe maximal autorisé,
dans les neuf langues. Les valeurs calculées restent identiques.
La couverture et les règles de pagination PDF ne sont pas modifiées.

## Vérification

- `node --test` : **825 réussites, 0 échec**, contre 799 tests avant changement.
- 26 nouvelles régressions dans `tests/editorialConsistency.test.mjs` : renvois,
  licences positives/négatives, négations, contrôles entre blocs, propriété unique,
  plafonds de rappels, budget, intégrité des figures, six semaines, diversité,
  périodes peu fournies, occurrences futures, neuf langues, faits non autorisés.
- Les 29 tests de `tests/llmComparisonSafety.test.mjs` sont inchangés.
- Parcours de dossier et comparaison A/B/C exécutés avec transports simulés.
- Les attentes existantes modifiées concernent la version du plan, la mention
  finale, les libellés des orbes et le nouveau découpage des rappels. Le test de
  coexistence des concepts et anciennes phrases continue en mode narratif.
- Le test de reprise comparative déduit son nombre d'appels du plan effectivement
  écrit plutôt que d'imposer l'ancien nombre 30 ; il exige zéro correction et
  vérifie toujours qu'une reprise ne régénère pas les étapes terminées.
- `git diff --check` : aucune anomalie.

## Limites et prochaine décision

Les règles de langage sont finies. Elles couvrent le cas reproduit et ses variantes
testées ; elles ne constituent pas une preuve exhaustive de compréhension de toutes
les paraphrases françaises. Un renvoi ambigu peut maintenant être bloqué plutôt
qu'interprété favorablement. La propriété des preuves et les plafonds réduisent la
répétition sans garantir l'absence de toute redondance sémantique.

La couverture dépend des contacts calculés disponibles. Aucun objectif de 5 100
mots ou de nombre de pages n'est imposé. Un chapitre pauvre en matière autorisée
peut rester court ; les aspects sans règle interprétative restent dans l'annexe.
Les limites protègent la validation ; il faut encore vérifier la qualité du texte
réel. Le changement de répartition peut modifier le nombre d'appels et les coûts,
notamment dans l'ancienne expérience narrative.

L'ancien HTML local ne permet pas de confirmer le nombre de pages d'un ancien PDF.
Le cas signalé est reproduit à partir de la formulation fournie, avec des données
de test ; aucun dossier client n'a été récupéré ou régénéré pour ces tests.

**Dépense de cette correction : 0 USD.** L'autorisation antérieure concernait un
seul essai fictif, déjà réalisé avant le déploiement précédent (0,0100984 USD).
Un nouvel essai fictif avec un budget bloquant de 0,20 USD nécessite une nouvelle
autorisation avant tout appel réel. Il doit utiliser un répertoire privé neuf et
un registre conservé, sans paiement Stripe, e-mail Brevo ni dossier de production.
Comparer ensuite la cohérence et l'utilité du texte avant d'envisager la mise en ligne.

## Retour arrière après une éventuelle livraison future

Le correctif n'a aucune migration de données. Le code précédent est le SHA
`2d9cbd893e0856db9828d359b738255591332754`. Si le correctif est ultérieurement
livré et présente une anomalie, revenir à ce commit sur le service existant avec
les mêmes variables et disque persistant. Ne restaurer aucune ancienne base pour
un simple retour arrière de code. Contrôler `/healthz`, l'empreinte active, la
configuration Stripe/Brevo et les logs de démarrage, sans opération client.
