LASTRO — COMPLÉMENT INDÉPENDANT : CALCULS JYOTISH, DASHAS ET BAZI

Cette extension possède un parcours web indépendant : /complement et POST /api/complement/calculate. Elle ne crée aucune commande ni donnée en base, n'appelle aucun fournisseur IA et ne déclenche ni paiement ni notification. Les parcours et calculs Lastro existants restent séparés. La lecture proposée explique les repères calculés et un vocabulaire lunaire documenté ; elle ne constitue pas une consultation complète de Jyotish ou de BaZi.

CE QUI EST CALCULÉ
1. Tropical : moteur existant inchangé, sept corps traditionnels, angles et maisons entières, aspects, éléments et modalités. Résultat/socle/preuves conservés sans mutation.
2. Jyotish sidéral : Lahiri-IAE1985 implémenté avec les rotations Astronomy Engine déjà disponibles ; sept corps traditionnels + Rahu/Ketu MOYENS, Ascendant/MC sidéraux et maisons entières recalculées, nakshatra/pada lunaire. Le cadre sidéral et ses preuves sont séparés du tropical.
3. Vimshottari : cycle120ans, solde de période à la naissance, mahadashas et antardashas ; année de durée365,25jours, bornes semi-ouvertes. Les dates proviennent de la Lune sidérale calculée, jamais de la Lune tropicale ni d'un modèle de langage.
4. BaZi : quatre piliers année/mois/jour/heure selon un profil explicitement nommé : annéeLiChun, moisJie astronomiques, jourminuitcivil, heurecivileIANA et Zi scindé à minuit. Aucune correction solaire implicite.
5. Annuel chinois populaire : calendrierICU, frontièreNouvelAnlunaire à minuitAsia/Shanghai. Ce résultat n'est pas substitué au pilier annuelBaZi, qui a une autre frontière.

LIRE L'APERÇU
Les calculs, le vocabulaire symbolique existant et les modules restant à préparer sont séparés. La roue tropicale est le SVG calculé existant ; aucune image générée, position ou texte astrologique inventé ne trace cette carte.
Les fonctions interprétatives existantes restent exclusivement tropicales. Les nouveaux faits Jyotish/BaZi n'obtiennent aucune licence de portrait psychologique ou de prédiction. Une similitude entre traditions n'ajoute aucune certitude sur la personne.
Le catalogue tropical reste une base de rédaction dans l'aperçu local. Sur le parcours web, symbolicReading.mjs produit une lecture documentaire courte, reliée aux preuves calculées et aux sources primaires Rao/HKO, sans transport IA. Les traits, événements, archétypes, dignités, interprétations karmiques/familiales ou transgénérationnelles ne sont pas fabriqués. Aucune donnée parentale supplémentaire n'est collectée.

CONVENTIONS ET INCERTITUDES
Les méthodes sont détaillées dans jyotish-method.txt, vimshottari-method.txt et bazi-method.txt. Conserver ces versions lors de tout export.
- Domaine temporel vérifié : naissanceUTC1901–2030. Horsplage : indisponibilité explicite, aucun calcul de remplacement.
- Sidéral : tolérance numérique61secondesd'arc (1' du moteur +1'' pourl'ayanamsha). Signe/nakshatra/pada près d'une frontière : classement incertain. Les coordonnées et l'heure restent déclaratives.
- Heure non ponctuelle : pas de degré/angle/maison sidéral unique ni de chronologie de dashas certaine. Les bornes planétaires sont de simples échantillons ; elles ne prétendent pas enfermer une excursion rétrograde intermédiaire.
- Dashas : les bornes de dates sont accompagnées d'une plage liée à la précision lunaire ; un changement de période peut donc rester incertain. Les dates arithmétiques ne garantissent aucun événement futur.
- BaZi : garde conservatrice±120secondes autour des Jie. Une fenêtre traversant une frontière donne les candidats plutôt qu'un pilier arbitraire. L'heure civile peut donner un autre pilier d'heure qu'une méthode d'heure solaire vraie ; ce choix est affiché.
- Angles : le nouveau sidéral utilise GAST/obliquité vraie/sélection de l'horizon oriental. À|latitude|>=65°, les angles et maisons ne sont pas restitués dans le complément ; les positions planétaires et les dashas restent disponibles. Voir high-latitude-core-followup.txt pour le diagnostic distinct concernant les anciens angles. Aucun correctif n'a été appliqué au moteur en production.

UTILISATION LOCALE
Depuis la racine du dépôt :
node addons/crossed-reading/run.mjs --input /chemin/prive/naissance.json --out /chemin/prive/nouveau-complement

Entrée : birth, personLabel optionnel, generatedAt optionnel. Exemple fictif :
{
  "birth": {
    "birthDate": "1990-01-15", "timePrecision": "exact", "timeValue": "16:30",
    "latitude": 48.8566, "longitude": 2.3522,
    "timeZone": "Europe/Paris", "placeName": "Paris", "country": "France"
  },
  "personLabel": "Thème fictif"
}
Les modes approximate/interval/unknown conservent leurs fenêtres et refusent les valeurs uniques non justifiées. L'entrée n'accepte aucun fait, règle, résultat, zodiaque ou système de maisons préfabriqué.
La commande ne lit pas .env ni de cléAPI. Aucun appel réseau/LLM. Sorties : nouveau répertoire0700, report.json et preview.html0600 ; aucun écrasement autorisé. Aucun mode payant.

VÉRIFICATIONS
node --test addons/crossed-reading/*.test.mjs
npm test
Comparaisons indépendantes :390ayanamshas,42positions planétaires,6nœudsmoyens,456angles,1560frontièresJie et contrôles de couture1900. Sources des fixtures et flags conservés dans fixtures/jyotish-reference.json et les documents de méthode. Les données de naissance réelles de l'exemple ne sont jamais enregistrées dans le code ou les tests.
Swiss Ephemeris a servi uniquement d'outil externe de comparaison dans un environnement temporaire. Aucun code/binaireSwiss, bindingPython ou nouvelle dépendance n'a été ajouté à l'application. Aucune modification de la licence du projet.

SUITE DISTINCTE
Les progressions, une consultation symbolique approfondie et l'éventuelle méthode d'archétypes/transgénérationnel ne font pas partie de ce complément. Aucun appel IA payant n'est ajouté par le raccordement web. Les statuts interpretationStatus:not_licensed et crossTraditionSynthesis:not_licensed restent intacts ; le statut bounded_documented_reading désigne uniquement les explications circonscrites décrites dans symbolic-method.txt.

PARCOURS WEB ET CONFIDENTIALITÉ
Le serveur ajoute les trois routes du complément et la fermeture de son exécuteur ; aucun parcours de commande existant n'est modifié. Un worker éphémère sans environnement de production effectue le calcul, avec mémoire et durée bornées, une seule demande active, cinq essais par minute et client et trente calculs par heure et processus. Un refus est explicite, jamais remplacé par un résultat fictif.
Les données de naissance transitent en POST JSON, sans URL personnelle, journal de contenu, stockage navigateur ni persistance serveur. Réponses no-store/no-referrer, contrôles d'origine, validation stricte des champs. Le résultat reste dans la mémoire de la page jusqu'à effacement ou fermeture. Un HTML enregistré ou un PDF appartient au stockage choisi par l'utilisateur ; l'effacement du formulaire ne supprime pas ces fichiers.
L'iframe du résultat n'exécute aucun script. Les seules fenêtres externes sont les sources fixes ouvertes par un clic, sans Referer ni accès à la fenêtre d'origine. Le PDF est obtenu par l'impression du navigateur, sans installation de moteur PDF serveur. Les caractères chinois sont doublés par leurs transcriptions latines ; le rendu exporté doit être contrôlé.
L'empreinte /healthz inclut désormais le code de addons/crossed-reading en plus de src/public. La présence de nouvelles routes ne prouve pas un déploiement : vérifier le SHA Render et l'empreinte après livraison.
