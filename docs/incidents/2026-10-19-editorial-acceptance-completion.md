# Complément de recette éditoriale et impression — 19 octobre 2026

## Écarts constatés après livraison 1b47005
Le correctif précédent traitait le réseau de configurations, les permissions de composition, les propriétaires, le classement des conjonctions et le saut de page, mais ne remplissait pas toute la demande de présentation. Le donut des modalités et le nombre de chapitres dans le pied de document subsistaient. Il n’existait pas de bloc factuel visuellement distinct. Deux consignes demandaient encore de commenter la matière insuffisante au lecteur ; une autre rendait implicitement la question obligatoire. Le module de diagnostics lexicaux était testé mais non appelé par le parcours public.

## Complément
- Trois barres calculées pour les modalités, quatre pour les éléments. Libellés, chiffres et bordures restent lisibles sans fonds ; aucune modification des distributions ou des calculs.
- Encadré factuel facultatif limité à trois aspects natals réellement employés et possédés par le chapitre, sans recopier orbes et détails de l’annexe. Exclu de la synthèse et de la conclusion. Un préfixe natal du serveur peut être déplacé vers cet encadré après validation du texte complet ; aucun texte du LLM ni date de transit n’est supprimé. Les mêmes faits sont présents dans l’export Markdown.
- Cadrage symbolique intégral conservé avec la carte ; couverture blanche et protection des titres maintenues.
- Mention de validation sans nombre de chapitres. Métadonnée aiReview.passes=0 et semanticLlmReview=false : il n’existe pas de seconde relecture LLM du dossier.
- Consignes contradictoires supprimées ; paragraphes courts, une idée par paragraphe, aucun commentaire de manque de règles demandé au modèle.
- Mesure lexicale des répétitions effectivement exécutée dans le parcours public ; données techniques sans prose ni identité dans les logs. Diagnostic non bloquant conformément au contrat du module. Ne garantit ni absence de répétition sémantique ni qualité littéraire et ne déclenche aucune dépense.

Aucune nouvelle règle astrologique ajoutée dans ce complément. Attention : la livraison précédente avait ajouté des conventions symboliques pour les aspects et maisons concernés, ce qui dépassait la demande de réutiliser uniquement les règles déjà disponibles. Elles restent versionnées et sont conservées ici conformément à la demande de préserver les corrections précédentes ; elles ne constituent pas des faits astronomiques validés.

## Contrôles réellement exécutés par dossier
Il faut distinguer les tests de développement des contrôles runtime. Pour chaque bloc concerné : validation préalable du préfixe serveur ; validation du texte complet de chaque tentative (une génération et au plus deux corrections sur erreurs détectées) ; validation de la section assemblée ; validation finale globale des sections principales puis des deux axes relationnels. Cette dernière réutilise le même validateur et ne constitue pas une opinion indépendante. Puis diagnostic lexical du dossier avant rendu/livraison. Les appels déterministes et blocs omis ne dépensent pas de tokens. Aucun second modèle n’approuve actuellement tout le sens du dossier. Le nombre exact d’invocations varie avec le plan, les préfixes et les corrections ; afficher un nombre fixe de relectures serait trompeur.

## Recette durable
Chaque exigence client doit avoir un statut et une preuve : règle/packet/plan pour les permissions, cas négatifs pour les faits et interactions interdits, parcours public avec transport simulé pour le câblage, PDF réellement rendu pour la présentation. Les tests ne doivent pas se limiter à constater qu’une fonction isolée existe. Les évaluations de style restent distinctes de la validation des faits. Un futur relecteur IA ne pourrait proposer que des changements dans les mêmes preuves et licences, avec revalidation du texte final ; il ne serait pas une autorité astronomique ni une garantie sans erreur.

Les comptes, paiements Stripe, e-mails Brevo, secrets, stockage et modèle de production ne changent pas. Aucun appel payant ni dossier client utilisé dans les tests. L’aperçu de recette est fictif et rédigé par transport simulé, pas une nouvelle lecture client.

## Résultat de recette avant livraison
`node --test` : 858 tests réussis, zéro échec, aucune dépense API. Les 29 tests de sécurité sont inchangés. Diff vérifié : aucun changement du calcul, des paiements, des e-mails, des secrets ou des pages publiques. Rendu Chromium privé en mode impression : sept barres, fonds explicitement supprimés, niveaux de gris ; inspection visuelle de la carte avec cadrage complet et de la page narrative avec encadré de faits. Le texte fictif injecté est volontairement répétitif pour tester le diagnostic ; il ne constitue pas une évaluation du style d’une génération réelle.
