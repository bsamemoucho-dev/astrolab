# Budget expérimental A/B/C — plafond réduit à 2 USD

Vérification hors ligne du 18 octobre 2026, branche `experiment/openai-claude-comparison`. Aucun appel fournisseur. Les tokens ci-dessous sont des estimations, pas des consommations mesurées. Sorties : limites configurées, JSON et éventuel raisonnement facturable inclus. Tarifs standard sans remise de cache, hors taxes et autres usages des clés.

## Volumes et coûts, sans corrections

| Variante ou étape facturée | Appels | Entrée estimée | Sortie maximale | Coût estimé avec sortie au plafond |
|---|---:|---:|---:|---:|
| A, gpt-4o-mini | 25 | 34 144–54 630 | 22 500 | 0,018622–0,021695 USD |
| A, gpt-4.1-mini | 5 | 9 968–15 949 | 4 500 | 0,011187–0,013580 USD |
| **A total** | **30** | **44 112–70 579** | **27 000** | **0,029809–0,035274 USD** |
| B, relecture Claude supplémentaire seulement | 1 | 78 130–108 808 | 30 000 | 0,456260–0,517616 USD |
| B autonome, A inclus (ne pas additionner cette ligne au total) | 31 | 122 242–179 387 | 57 000 | 0,486069–0,552890 USD |
| C, Claude seul | 30 | 44 801–71 682 | 27 000 | 0,359602–0,413364 USD |
| **Expérience = A + relecture B + C** | **61** | **167 043–251 069** | **84 000** | **0,845671–0,966254 USD** |

Total entrée + sortie : environ **251 043–335 069 tokens**, si toutes les sorties atteignent leur plafond. Une sortie plus courte diminue la facture. Les trois variantes ne correspondent donc pas à un seul passage de 100 000 tokens.

Méthode reproductible : `node experiments/openai-claude/audit.mjs <répertoire-privé>` capture les vrais prompts avec transport simulé et réseau bloqué. Dernière mesure : 176 444 octets UTF-8 pour 30 appels A ; 136 573 pour gpt-4o-mini et 39 871 pour gpt-4.1-mini. Conversion exploratoire à 2,5–4 octets/token ; arrondis supérieurs par groupe. C : 179 204 octets après ajout du format Anthropic. Les deux tokenizers peuvent donner des résultats différents : ce ratio n'est pas une borne.

Pour B, l'enveloppe réelle de production avec plans et preuves, mais sans texte A, mesure 204 520 octets. Hypothèse : jusqu'à 27 000 tokens supplémentaires pour A, d'où 204 520/4 + 27 000 = 78 130, et 204 520/2,5 + 27 000 = 108 808. Cette hypothèse suppose que la sérialisation et le changement de tokenizer restent de cet ordre ; le texte A réel n'existe pas encore. Le compteur Anthropic tranchera avant la relecture. L'enveloppe contient déjà les consignes : aucun supplément arbitraire de 2 000 tokens n'est ajouté une seconde fois.

## Origine exacte des 0,95 USD et du plafond antérieur

Le document privé antérieur utilisait 176 472 octets de prompts, dont 136 601 pour gpt-4o-mini et 39 871 pour gpt-4.1-mini :

- A : `(136601/2,5 × 0,15 + 22500 × 0,60 + 39871/2,5 × 0,40 + 4500 × 1,60) / 1000000` = environ **0,035275 USD**.
- C : `(70589 × 2 + 27000 × 10) / 1000000` = **0,411178 USD**.
- B marginal : ancienne hypothèse 103 781 tokens d'entrée ; `(103781 × 2 + 30000 × 10) / 1000000` = **0,507562 USD**.
- Total = **0,954015 USD**, arrondi à **0,95 USD**, sans corrections.

Les 5 USD étaient le plafond de sécurité initialement demandé par l'utilisateur, avec une marge pour les corrections et l'incertitude sur les tokens. Ce n'était ni le coût prévu ni une somme nécessaire ou réservée intégralement. La mesure actuelle précise l'enveloppe B et conduit à environ **0,97 USD** dans l'hypothèse haute. L'expression « 100 000 tokens maximum par passage » n'est pas une limite garantie et ne doit plus être utilisée.

## Corrections et maximum théorique

Chaque bloc A ou C peut recevoir deux corrections après l'essai initial : au plus 60 appels supplémentaires par variante, 120 au total ; chaque appel est réservé et payé séparément. Chaque correction génère au plus 900 tokens, donc 54 000 tokens supplémentaires par variante. L'entrée reprend le prompt et ajoute les erreurs, les plans autorisés et un fragment de réponse : le nombre exact dépend des erreurs et peut dépasser le prompt initial. Les erreurs ne s'accumulent pas nécessairement de façon linéaire. Aucune correction automatique pour la relecture globale B ; ses propositions invalides conservent explicitement A.

| Scénario indicatif | Appels | Entrée estimée haute hors supplément des erreurs | Sortie maximale | Coût haute estimation hors supplément des erreurs |
|---|---:|---:|---:|---:|
| Aucun bloc corrigé | 61 | 251 069 | 84 000 | 0,966254 USD |
| Une correction sur chacun des 60 blocs A/C | 121 | 393 330 | 138 000 | 1,414892 USD |
| Deux corrections sur chacun des 60 blocs A/C | 181 | 535 591 | 192 000 | 1,863530 USD |

Les scénarios de correction réutilisent les volumes initiaux pour rendre le coût marginal lisible ; ce ne sont pas des maxima garantis. Le dernier laisse seulement environ **0,136 USD** pour le supplément d'entrée des erreurs et les différences de tokenisation. Un arrêt de validation après trois tentatives peut aussi interrompre l'expérience avant tout épuisement du budget.

Sans plafond global, la somme des limites de coût par appel pour un parcours avec 181 messages serait **28,39 USD** : `(180 × 0,15) - (0,15 - 0,04) + 1,50`. Ce chiffre est une enveloppe permissive des appels, pas le coût des prompts mesurés ; il n'est plus autorisé. Pour un parcours sans correction, cette même somme serait 10,39 USD. Le plafond global prime toujours sur les plafonds individuels. Il n'existe pas de maximum fixe d'entrée total indépendant du contenu des erreurs ; la limite financière bloque les réservations inabordables.

## Réservation effective et marge technique

Le registre réserve **un seul appel à la fois**, pas les 181 appels à l'avance. Entrée réservée = `max(compteur_fournisseur + 1024, octets_UTF8_de_la_charge + 4096)` ; coût réservé = entrée réservée au tarif plein + limite de sortie au tarif plein. Après une réponse fiable, seul le coût mesuré reste dépensé et la marge inutilisée est libérée. En cas d'usage inconnu, toute la réservation est conservée et la suite est bloquée.

Exemple hors ligne, si la borne par octets domine : les réservations additionnées des 30 appels initiaux A représentent environ 0,081106 USD ; celles de C 0,874168 USD. Pour B, avec une hypothèse supplémentaire de 108 000 octets de texte A sérialisé, la réservation serait environ 0,933232 USD. Leur somme illustrative est **1,888506 USD**. Ce ne sont ni des tokens facturés ni une borne assurée : le compteur réel ou l'échappement JSON peuvent augmenter la réserve. Comme les appels sont séquentiels et réconciliés, cette somme n'a pas à être disponible en une fois.

**Maximum global autorisé et bloquant : 2 USD pour OpenAI + Anthropic cumulés, dépenses et réservations comprises. Premier appel inchangé : 0,04 USD maximum, 900 tokens de sortie.** Le plafond est celui des coûts API suivis à ces tarifs, hors taxes et usages extérieurs au registre. Le plus gros appel individuel autorisé est B à 1,50 USD ; il doit aussi tenir dans le solde des 2 USD. Aucun compte fournisseur ni plafond console n'est modifié ici.

## Conservation du registre et faisabilité

Le chemin privé existant de l'expérience est conservé. Aucun `budget.json` n'avait encore été créé ; il est maintenant initialisé à 2 USD avec **0 dépensé, 0 réservé, 2 disponibles, 0 appel**. Aucun historique n'a été supprimé. Les fichiers de préparation et le plan annoncent également 2 USD. Le code sait réduire un ancien registre à 5 USD sous verrou, conserver toutes les lignes de dépenses/réservations et inscrire la réduction ; il refuse de relever ensuite un plafond déjà réduit. Même une ancienne dépense supérieure à 2 USD est conservée, avec solde négatif et refus de toute nouvelle dépense. Les réservations incertaines restent bloquantes.

**Faisabilité : oui, raisonnable sans corrections lourdes, non garantie.** Le premier bloc C est réutilisé ; l'ordre est ce bloc C, tout A, relecture B, puis reste de C. Si les réservations ou corrections absorbent le solde, la prochaine génération est refusée avant envoi (`BUDGET_INSUFFICIENT`), ou par sa limite individuelle (`CALL_MAXIMUM_EXCEEDED`). B peut être refusée si son enveloppe réelle est trop importante ; C peut rester incomplet car il est terminé en dernier. Les étapes validées restent sauvegardées. Aucune réduction silencieuse de qualité, des preuves ou du validateur pour terminer sous budget. Aucun appel réel avant un nouveau GO explicite.

Tarifs vérifiés dans les sources officielles : [Claude Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [gpt-4o-mini](https://developers.openai.com/api/docs/models/gpt-4o-mini), [gpt-4.1-mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini). Respectivement entrée/sortie par million : 2/10 USD, 0,15/0,60 USD et 0,40/1,60 USD.

Vérification de ce changement : **657/657 tests réussis**, zéro échec, zéro ignoré ; les 29 tests de sécurité sont inchangés. Les nouveaux contrôles couvrent le plafond 2 USD, le cumul des deux fournisseurs, la reprise, la réduction d’un ancien registre avec dépenses/réservations et le cas d’un historique déjà supérieur à 2 USD. Aucun appel réel ; coût de préparation : **0 USD**. Modifications locales uniquement, sans push ni déploiement.

## Amendement après le premier appel réel tronqué

Les tableaux ci-dessus décrivent la configuration initiale à 900 tokens par bloc. Après cet échec, seul le premier bloc C passe à 1 600 tokens. Ajouter 700 tokens de sortie et 0,007 USD aux estimations de chaque parcours complet ; les erreurs de correction peuvent encore augmenter l'entrée. Ajouter aussi 0,014146 USD de coût irrécupérable du premier essai (2 573 tokens d'entrée, 900 de sortie). Le plafond reste **2 USD cumulés**, la prochaine première tentative reste plafonnée à **0,04 USD**. Avec l'entrée réservée précédente de 11 389 tokens, elle réserve 0,038778 USD. Le solde avant reprise est **1,985854 USD**. Les tableaux sont estimatifs et ne justifient aucune hausse du plafond.

## Limite de sortie de tous les blocs C après le deuxième arrêt

La reprise a terminé A (30 appels, 0,0128418 USD) et B (1 appel, 0,367482 USD). C possède sa synthèse validée, puis identity.block1 a atteint sa limite de 900 tokens (0,013986 USD), avec JSON incomplet sauvegardé et usage réconcilié. Total déjà dépensé, échecs inclus : **0,4233418 USD** ; solde : **1,5766582 USD**. Aucun dossier client concerné.

La limite de **1 600 tokens s'applique désormais à tous les blocs C**, et à leurs corrections, pas seulement au premier. A conserve 900 tokens par appel, B 30 000. Les prompts, preuves et contrôles de volume/validation sont identiques ; aucune sortie tronquée ne passe la validation. Aucun retry automatique d'une troncature. La reprise réutilise A et B et la synthèse C existante.

C possède 30 blocs : son maximum initial de sortie devient 48 000 tokens, soit 21 000 tokens / 0,21 USD supplémentaires par rapport à la configuration initiale toute à 900. L'estimation haute initiale A + B + C passe d'environ 0,966 à 1,176 USD, avant erreurs et corrections. Les deux essais tronqués totalisent 0,028132 USD supplémentaires ; ce coût reste définitivement inclus dans le registre. Avec deux corrections sur chaque bloc C, les 144 000 tokens de sortie C représenteraient seuls 1,44 USD : toutes les corrections possibles ne sont donc pas garanties sous 2 USD. Les réservations réelles sont contrôlées avant chaque appel. Premier appel toujours limité à 0,04 USD ; autres blocs 0,15 USD ; ensemble **2 USD maximum**, sans réinitialisation.
