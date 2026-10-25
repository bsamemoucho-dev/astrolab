# Qualité éditoriale et fiabilité du parcours public — 25 octobre 2026

## Problème et causes reproduites
L'objectif est une lecture spécifique et utile, sans remplissage ni ajout de doctrine, à partir des preuves déjà disponibles. Le nombre de pages et de mots n'est pas un objectif.

Le rédacteur demandait un dilemme et plusieurs façons de le vivre pour toute idée propriétaire, y compris un soutien sans conflit. Les précautions des règles pouvaient devenir un avertissement répété en chaque paragraphe. La mission Travail favorisait le même lexique que l'identité ; Ressources demandait des éléments concrets que les preuves ne suffisent pas à établir. Enfin le prétraitement du préfixe serveur fusionnait les paragraphes et supprimait silencieusement les phrases contenant une date avant validation.

Le contexte fermé avait un autre défaut : une thèse filtrée par chapitre restait visible dans des blocs n'en possédant pas toutes les preuves, avec les articulations et labels factuels associés. Le détecteur d'aspects pouvait aussi substituer l'objet d'une proposition au sujet de la suivante. Enfin natalHouse d'un transit n'était pas accompagné de la preuve natale de maison dans son bloc.

## Changements éditoriaux
- Suppression du dilemme universel ; l'angle dépend des concepts et relations réellement transmis. Pas de seconde lecture fabriquée quand une seule hypothèse est disponible.
- Nuances appliquées comme contraintes internes, sans répéter le cadrage symbolique après chaque placement. Aucun conseil de bien-être interchangeable pour remplacer une explication.
- Missions Travail et Ressources recentrées sur leur apport distinct, sans métier, réussite, biens ni situation financière déduits. L'absence de matière ne déclenche aucun remplissage.
- Paragraphes conservés. Aucun effacement de phrase générée avant contrôle : date et temporalité réservées au serveur sont corrigées ou rejetées explicitement.
- Diagnostic conservateur de trois tics français : conditionnel mécanique, ouvertures répétées et accumulation de conseils interchangeables. Une seule reprise ciblée du bloc, avec son texte initial et les mêmes preuves, peut utiliser une des deux corrections déjà prévues. Maximum total inchangé : trois tentatives par bloc. Chaque sortie repasse le contrôle factuel.
- Un tic persistant reste un diagnostic ; aucune amputation et aucun échec de commande fondé sur un simple pourcentage de style. Les codes des diagnostics vont aux logs, jamais le texte initial.

Cette mesure ne juge ni toute la profondeur ni toutes les répétitions d'idées. Aucun texte futur produit par une vraie IA n'a été évalué dans cette intervention ; les transports sont simulés. Ce lot ne doit pas être présenté comme une garantie de qualité littéraire.

## Preuves et validation stricte
Thèse, labels factuels, articulations, hypothèses et rappels de conclusion sont filtrés selon les preuves du bloc. Le contexte complet des compositions reste disponible lorsqu'il est autorisé. Le détecteur d'aspects suit le sujet par occurrence, les coordinations et les relatives ; les cinq aspects, Mars/« mars », preuves partielles et aspects non autorisés sont couverts.

Une maison natale de transit nécessite une preuve NATAL_BODY_HOUSE explicite, du bon corps, de la même maison et du même système, suffisamment fiable. Le contexte factuel ne donne aucune règle d'interprétation de maison. La profondeur primaire est contrôlée par preuve issue des packets serveur ; un packet de référence ne déclasse plus tout un bloc.

Aucun calcul astronomique ni règle astrologique ajouté ou modifié. Les tests numériques ciblés et leurs références externes existantes passent ; ils ne constituent pas une nouvelle validation astronomique exhaustive.

## Fiabilité et protection des données
Un worker doit conserver son leaseId pour enregistrer progression, succès ou échec. Un ancien worker ne peut écraser un résultat terminal ni notifier à sa place. Une demande de régénération ne révoque pas un bail actif. L'initialisation concurrente du JsonStore partage une seule promesse ; une erreur d'initialisation demeure visible et réessayable.

Les scans de récupération concernent uniquement les nouvelles demandes/tentatives marquées public-generation-recovery@1. Une seule récupération automatique est autorisée ; au-delà, diagnostic de revue manuelle sans notification ajoutée. Les anciens dossiers sont exclus. Les scans ignorent les entrées expirées sans purge ; les autres transactions de rétention ne changent pas. Consulter le statut ne lance plus de génération et ne purge plus le stockage.

Limites : pas de checkpoint de chapitres, reprise complète après interruption ; appels IA déjà engagés non annulés ; stockage JSON à un seul processus écrivain ; déduplication de commande limitée à la conservation de sa session Stripe ; acceptation Brevo suivie d'un crash toujours ambiguë. Aucune migration de données, aucun changement de Stripe/Brevo ou de modèle.

## Recette et livraison
La suite de référence avant ce lot comptait 863 tests. Les tests ajoutés couvrent le contexte par bloc, le parseur, les maisons, la reprise de style et ses refus factuels, le comptage des appels simulés, les baux, le redémarrage, l'initialisation et le GET sans effets de bord.

Deux attentes de fullDossierPlanner sur la suppression des reformulations temporelles sont volontairement remplacées par des refus explicites des mêmes phrases/dates, sans modifier les instants ni relâcher les preuves. Les 29 tests de sécurité existants sont inchangés.

Précontrôle lecture seule : `node tools/deploy-preflight.mjs --db /var/data/astrolab.json`. Il refuse toute génération en attente/en cours et toute notification encore éligible à l'envoi ; il distingue les notifications historiques épuisées sans déduire qu'elles ont été livrées. C'est un instantané, pas un verrou atomique empêchant une nouvelle commande.

Avant publication : tests et CI sur le SHA exact, sauvegarde privée données/configuration, contrôle répété des travaux actifs immédiatement avant déploiement. Après publication : commit Render et empreinte, santé, configuration Sol/Stripe/Brevo, comparaison individuelle des dossiers et des notifications, journaux de démarrage. En cas de nouvelle demande concurrente, interrompre la publication tant qu'elle n'est pas terminée. Le retour arrière de code conserve les données et les variables actuelles.

Aucun appel IA réel, paiement, e-mail ou reprise d'ancien dossier n'est lancé pour cette recette. Les anciens HTML restent inchangés. Le lot inclut le commit local antérieur de portée de thèse, conservé et complété ; les fichiers étrangers non suivis sont exclus.

## Résultat final hors ligne
`node --test` : **948 tests réussis, zéro échec**, contre 863 sur l'état local de référence. Les 29 tests de sécurité n'ont pas changé ; aucun fichier de calcul astronomique, de paiement, d'envoi d'e-mail ou d'interface publique n'a changé.

Le diagnostic de style a été vérifié sur le texte fourni : il repère notamment le conditionnel mécanique d'un chapitre, sans prétendre couvrir tous les défauts du dossier. La reprise stylistique est au maximum une PAR BLOC, incluse dans les trois tentatives existantes. Le coût moyen peut donc augmenter lorsqu'elle est nécessaire ; aucun modèle relecteur supplémentaire ni appel de revue du dossier entier n'est ajouté. Dépense réelle pendant cette recette : 0 USD.
