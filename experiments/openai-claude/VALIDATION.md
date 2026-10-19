# Validation astrologique — correction expérimentale

## Causes et corrections

1. **Maisons** : l'ancien extracteur ne conservait que le numéro de maison. Le nouveau conserve les corps des assertions de placement au moyen de constructions locales bornées, dans les deux sens et pour des sujets coordonnés. Chaque lien corps/maison exige sa propre preuve NATAL_BODY_HOUSE. Une mention thématique ou de maîtrise de maison n'est pas transformée en placement d'une planète voisine.
2. **Aspects** : sujets coordonnés et connecteurs `de/du` étaient absents. Les cinq types couvrent maintenant ces constructions, leurs inversions et les angles explicitement nommés. Les espaces intermédiaires ne peuvent franchir un autre corps ou aspect pour fabriquer un couple. La neutralisation du mois mars dans les dates reste active.
3. **Dates** : le validateur comparait les claims structurés mais pas les dates du texte. Un module commun convertit les instants en jours du fuseau de référence et contrôle startsAt, exactAt, endsAt et nowUtc. Les fenêtres d'une même occurrence restent liées ; deux contacts dans une phrase ne peuvent s'emprunter leurs dates. Les marqueurs biographiques ne sont pas convertis arbitrairement en dates de transit.

Le planner inscrit `referenceTimeZone` dans les plans et emploie le même formatage local que la validation et l'introduction calculée du writer. Ordre : fuseau déclaré explicitement, puis fuseau du contexte de naissance pour un nouveau plan, puis UTC pour les fixtures/entrées sans fuseau. Europe/Paris est utilisé pour le thème français. Aucun timestamp astronomique, calcul ou orbe modifié. Le validateur est versionné `dossier-factual-claims@0.2.0`.

## Deux attentes anciennes actualisées avec autorisation

- `tests/fullDossierPlanner.test.mjs:595` exige un fait de maison sans `body` pour « La Lune se trouve dans la maison 3 ». La nouvelle extraction retourne `body: Moon`. Les textes positifs de ce même test sont toujours acceptés ; seul le schéma attendu est devenu incompatible avec la liaison précise demandée.
- `tests/fullDossierPlanner.test.mjs:1100` attend « le 5 octobre » pour une fenêtre de `2026-10-05T00:00Z` à `2026-10-05T22:00Z`. À Paris, cela représente le 5 à 02 h jusqu'au 6 à 00 h : le préfixe correct couvre deux jours. Les instants UTC sont restés inchangés.

Les deux seules attentes ci-dessus ont été actualisées après autorisation explicite. Les instants UTC et les 29 tests de référence sont strictement inchangés. Résultat : 641/641, zéro test ignoré ou TODO. L’absence de corpus historique vérifiable est acceptée seulement pour l’expérience locale fictive et reste bloquante pour la production.

## Portée et limites

Les tests couvrent dix corps, douze maisons et huit constructions françaises par combinaison ; cinq aspects, inversions, sujets coordonnés et plusieurs aspects par phrase ; mois/planète Mars ; préfixes de production ; dates à minuit, DST, jours/mois/années distincts ; contrôles du writer et corrections, sans fournisseur.

Une extraction grammaticale bornée n'est pas une compréhension exhaustive du français. « La Lune, en harmonie avec votre Milieu du Ciel » peut suggérer un lien astrologique, mais n'identifie ni type ni orbe ; le détecteur n'en déduit pas un trigone ou sextile. Les phrases de soutien symbolique, les citations, négations, pronoms, ellipses ou constructions indirectes demandent encore une revue spécifique. Ne pas présenter l'absence de détection comme la preuve de l'absence de fait.

Les dates reconnues sont françaises (jour/mois, année facultative), ISO calendaires ou numériques françaises, lorsqu'un rôle astrologique explicite peut être rattaché au contexte. Les mois seuls, heures en prose et formulations littéraires sans rôle explicite ne sont pas une garantie de contrôle complet. Les anciennes éditions sans métadonnée fiable de fuseau nécessitent une revue de leur convention d'affichage d'origine, jamais un décalage automatique des preuves.

Le problème indépendant PERSONAL_TRANSIT.natalHouse n'est pas corrigé : il décrit la maison du point natal. Il n'autorise pas à placer la planète transitante dans une maison natale. Il faut une preuve explicite et correctement typée du point concerné, pas une permission générale de maison.

## Anciens dossiers

Le stockage local contient deux dossiers LLM historiques avec texte, mais sans DossierEvidence ni FullDossierPlan/packets d'origine. Les calculs natals associés ne reconstituent pas les permissions exactes par section. Verdict : deux non vérifiables, aucun verdict factuel inventé. Aucun texte ou renseignement personnel dans cette documentation ; détails et empreintes d'intégrité exclusivement dans le rapport privé local.

## Risques d'intégration

Les nouveaux contrôles peuvent révéler des affirmations anciennement non détectées, donc augmenter les rejets et corrections. Le fuseau local peut déplacer un jour affiché sans déplacer l'instant calculé. Le format public d'un fait de maison est enrichi du corps. Le corpus local n'étant pas vérifiable, l'absence de faux positifs sur des dossiers réels n'est pas démontrée. Prévoir un corpus privé autorisé avec textes, preuves, plans et convention temporelle d'origine avant une recommandation de production.

## Faux appariement planète–signe : 18 octobre 2026

Le validateur 0.2.0 utilisait une recherche de proximité de 32 caractères qui traversait un autre corps, un autre signe ou une ponctuation de phrase. Les trois réponses Claude de relationships.block1 écrivent correctement « une Lune en Balance et une Vénus en Verseau », mais étaient toutes rejetées pour un NATAL_BODY_SIGN Moon/Aquarius inventé par cette recherche.

Version **dossier-factual-claims@0.2.1** : la fenêtre locale ne traverse plus une autre attribution ni une frontière de phrase. Un autre corps ou angle est accepté uniquement comme sujet explicitement coordonné pour une position partagée. Le traitement est identique pour les angles et conserve la détection de Mars à côté des dates de mars. Aucun fait autorisé, calcul ou contrôle bloquant n'est modifié. Une véritable Lune en Verseau sans preuve correspondante reste rejetée par undeclared_text_fact.

**678/678 tests réussis**, dont 19 nouveaux tests, les 29 tests de sécurité inchangés, et les tests existants sans modification d'attente. Le premier essai des nouveaux tests a révélé une élision non reconnue dans « Lune et l’Ascendant » ; la grammaire a été corrigée avant le passage complet, sans changer l'attente. Les trois réponses réelles sauvegardées sont rejouées avec le writer de production et un transport hors ligne : chacune passe dès la première tentative, sans réécriture. A, B et C déjà sauvegardés passent également le nouveau validateur.

La première réponse initialement rejetée est récupérable telle quelle dans le checkpoint C après vérification et archivage de provenance. Aucun nouvel appel payant, aucune suppression de dépense. Dépense cumulée au diagnostic : 0,5455778 USD, solde 1,4544222 USD. La reprise saute A, B, les chapitres C déjà terminés et relationships récupéré. Aucun déploiement : le corpus historique vérifiable reste un prérequis avant production. Cette expérience demeure locale sur thème fictif ; les limites générales de couverture linguistique du détecteur restent documentées.
