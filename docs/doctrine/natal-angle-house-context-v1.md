# Contexte natal d’angle et de maisons — convention Lastro V1

Statut : extension ciblée autorisée explicitement le 25 octobre 2026. Bibliothèque `lastro-interpretation-library@0.5.0`, convention `lastro.natal.angle-house-context@1`.

## Nature et sources
Ces règles sont des conventions interprétatives internes Lastro (`LASTRO_RULE`), pas des découvertes astronomiques ni des résultats scientifiques. Elles ne sont pas attribuées au corpus hellénistique documentaire, qui demeure inéligible à l’activation automatique.

Le vocabulaire de départ existe dans les guides publics `public/guides/ascendant.html` (fonction symbolique d’entrée dans le monde), `public/guides/maisons-astrologiques.html` (domaines de vie) et dans les fonctions planétaires de la bibliothèque. L’autorisation actuelle permet de formaliser les cinq lectures manquantes ci-dessous, avec des limites explicites. Les guides seuls ne donnaient pas auparavant une licence de rédaction personnalisée.

## Périmètre exact

| Identifiant | Preuve requise | Lecture symbolique permise |
|---|---|---|
| `western.angle.ascendant.sign.cancer@1` | Ascendant en Cancer stable | Manière d’aborder une situation à travers l’attention au climat, la protection et le familier. |
| `western.body.moon.house.3@1` | Lune en maison 3 Whole Sign stable | Ressenti et sécurité intérieure envisagés dans la parole, les apprentissages et les échanges de proximité. |
| `western.body.mercury.house.6@1` | Mercure en maison 6 Whole Sign stable | Pensée et langage dans l’organisation et les tâches quotidiennes. |
| `western.body.saturn.house.6@1` | Saturne en maison 6 Whole Sign stable | Cadre, responsabilités et limites dans le travail quotidien. |
| `western.body.jupiter.house.8@1` | Jupiter en maison 8 Whole Sign stable | Ouverture et confiance envisagées dans la mise en commun, les ressources partagées et les transformations. |

Aucune matrice de tous les signes, corps et maisons n’est créée. Une règle ne s’étend ni à une autre planète, ni à une autre maison, ni à un autre signe d’Ascendant. Les maisons exigent le système Whole Sign explicitement présent dans la preuve.

## Incertitude et droits de rédaction
Chaque règle exige une preuve de stabilité explicite (`certainty.stableAcrossApplicableWindow: true`). L’heure inconnue ne crée aucun Ascendant ni aucune maison. Une stabilité absente, inconnue ou négative ne donne pas cette nouvelle licence. Les métadonnées de stabilité sont dérivées des résultats existants du moteur ; aucune valeur astronomique n’est changée pour rendre une règle applicable.

Le rédacteur doit disposer de la preuve et de sa règle dans son bloc fermé. Un placement en maison ne remplace pas une preuve de signe, ni l’inverse. Une maison, un corps, un angle ou un signe incompatible reste un fait non déclaré et est rejeté par le validateur existant.

La combinaison avec un autre placement ou aspect reste soumise aux licences de composition déjà calculées : cette extension ne crée aucune interaction entre configurations.

## Limites sémantiques
- Ascendant Cancer : aucun caractère établi, timidité, hypersensibilité, histoire familiale, attitude physique ou manière d’être perçue ne peut être affirmé comme un fait.
- Lune maison 3 : aucun niveau d’études, capacité intellectuelle, fratrie réelle ou vécu émotionnel n’est déduit.
- Mercure/Saturne maison 6 : aucun métier, rendement, réussite, état de santé, diagnostic ou obligation professionnelle réelle n’est déduit.
- Jupiter maison 8 : aucun capital, argent reçu, héritage, dette, décès, sexualité, secret ou événement de transformation réel n’est annoncé.
- Toutes : aucune prédiction, biographie fabriquée, certitude sur un tiers, ni diagnostic psychologique.

Les concepts et relations sont fournis comme matière de lecture symbolique, sans gabarit obligatoire ni quota de mots. Leur développement reste une possibilité de réflexion, pas une description certaine du lecteur.

## Validation attendue
Les tests couvrent les cinq couples exacts, les voisins incompatibles, le système de maisons, la stabilité absente ou négative, l’absence de sur-généralisation, la disponibilité dans un bloc réellement autorisé et le rejet inchangé des faits non déclarés. Le tableau « Configurations étudiées » ne présente que les preuves correspondant aux règles réellement utilisées dans ce bloc et autorisées pour le chapitre.
