LASTRO — COMPLÉMENT INDÉPENDANT (PRÉPARATION LOCALE)

Cette extension ne remplace pas la lecture Lastro et n'est reliée à aucune route, commande, base, paiement ou notification existante. Aucun fichier préexistant n'est modifié. Elle n'est pas déployée et ne constitue pas encore un dossier premium rédigé.

CE QUI FONCTIONNE
- Calcul tropical réel du moteur actuel, sept corps traditionnels, angles, maisons entières, aspects et incertitude. Le résultat, le socle et les preuves sont conservés sans mutation.
- Rendu HTML autonome avec roue vectorielle réellement calculée, positions et conventions affichées. Aucune image générée ni position tirée d'un modèle de langage.
- Vocabulaire symbolique du catalogue existant, uniquement pour des preuves stables qui possèdent leur propre règle active. Ce sont des repères de préparation, pas une narration IA ni une validation psychologique.
- Calendrier annuel chinois populaire : année lunisolaire selon le calendrier ICU, changement au Nouvel An lunaire à minuit Asia/Shanghai. Le libellé animal/élément est une classification traditionnelle du cycle, pas une caractéristique personnelle.
- Sorties privées : répertoire nouveau 0700, HTML et JSON 0600. Aucun écrasement de fichier préexistant. Pas de lecture de .env, pas de clé API, pas d'appel réseau/LLM dans la commande.

CADRES À NE PAS CONFONDRE
Les maisons de l'exemple fourni ne sont pas celles des maisons entières actuelles. Un système à quadrants pourrait donner d'autres maisons ; il doit être annoncé et vérifié séparément.
La frontière de l'année populaire chinoise est ici le Nouvel An lunaire, pas Li Chun. Le résultat n'est donc ni un pilier annuel BaZi certifié ni un calcul des quatre piliers.
Les positions tropicales et les futurs résultats sidéraux ne peuvent partager leurs licences implicitement. Toute méthode supplémentaire devra avoir son propre espace de preuves et ses propres conventions.
Aucune convergence entre traditions n'augmente une certitude sur la personne. La synthèse intertraditions reste not_licensed.

CE QUI N'EST PAS ENCORE DISPONIBLE
Jyotish/Lahiri, nakshatras/padas, dashas, BaZi complet, progressions, archétypes attribués et interprétation transgénérationnelle. Le moteur de transits existe dans Lastro, mais n'est pas appelé par ce premier aperçu natal. Les planètes lentes ne reçoivent pas d'interprétation natale par cet ajout.
Ces modules ont chacun un statut indisponible visible. Aucune phrase ne simule leur résultat. Aucune donnée des parents n'est demandée en l'absence d'une méthode active.
Le moteur sidéral reste à choisir et vérifier : convention Lahiri précise, référence d'éphémérides indépendante, incertitudes aux frontières de signes/nakshatras et licence d'utilisation du moteur. Aucun Swiss Ephemeris n'est ajouté ici.

UTILISATION
Depuis la racine du dépôt :
node addons/crossed-reading/run.mjs --input /chemin/prive/naissance.json --out /chemin/prive/nouveau-complement

L'entrée contient seulement birth, personLabel (optionnel) et generatedAt (optionnel). Exemple fictif :
{
  "birth": {
    "birthDate": "1990-01-15", "timePrecision": "exact", "timeValue": "16:30",
    "latitude": 48.8566, "longitude": 2.3522,
    "timeZone": "Europe/Paris", "placeName": "Paris", "country": "France"
  },
  "personLabel": "Thème fictif"
}
Les modes approximate/interval/unknown réutilisent strictement le moteur existant. Si la fenêtre de naissance traverse le Nouvel An chinois, aucune année/animal/élément unique n'est attribué.
Le calendrier est limité aux dates civiles Asia/Shanghai de 1901 à 2030 dans cette préparation. Un runtime sans calendrier chinois, une date hors plage ou un compteur absent donne une indisponibilité explicite, jamais un zodiacal annuel approximé à partir de l'année grégorienne seule.
Les preuves, règles, résultats, zodiaques ou maisons fournis dans l'entrée sont refusés. Il n'existe pas de mode payant.

TESTS
node --test addons/crossed-reading/*.test.mjs
npm test

Vérifier avant toute connexion au site : résultats indépendants du futur moteur sidéral, conventions des méthodes nouvelles, licence juridique appropriée, droits de rédaction par cadre et validation réelle de la prose. Cette préparation ne demande ni n'autorise un déploiement ou une dépense IA.

SOURCES DE MÉTHODE
- Code tropical existant : src/astro/westernNatal.mjs et ses références JPL Horizons stockées ; conventions Lastro inchangées.
- Hong Kong Observatory, tables grégoriennes/lunaires : https://www.hko.gov.hk/en/gts/time/conversion.htm
- Frontières vérifiées contre les tables officielles 1988/1989/2024/2025/2026 : https://www.hko.gov.hk/en/gts/time/calendar/text/files/T1989e.txt (remplacer l'année pour les autres références).
- Cycle Gan-Zhi : https://www.weather.gov.hk/en/gts/time/stemsandbranches.htm
- Correspondances traditionnelles des libellés : https://www.hsiacalendar.com/legend
- Définition du sidéral et variantes Lahiri à distinguer avant implémentation : https://www.astro.com/swisseph/swisseph.htm
- Conditions du moteur Swiss Ephemeris si retenu ultérieurement : https://www.astro.com/swisseph/swephprg.htm
Aucune valeur de naissance de l'exemple réel n'est enregistrée dans les sources ou les tests.
