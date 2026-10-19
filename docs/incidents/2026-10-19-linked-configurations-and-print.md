# Configurations reliées et impression — correctif du 19 octobre 2026

## Causes

La restriction des rappels à une phrase avait été appliquée à des chapitres de
composition. La synthèse n'exploitait plus que sa distribution primaire ; la
conclusion et Relations recevaient essentiellement des rappels sans interprétation.
La thèse ne reconnaissait que deux figures classiques, pas un réseau de
configurations à planètes partagées. Trois aspects ciblés n'avaient pas de règle
natale générale ; leurs preuves existaient mais ne donnaient pas de matière au
rédacteur. Les maisons calculées n'avaient pas de règle de domaine exploitable.
Enfin, les conjonctions étaient classées par défaut parmi les tensions.

Le moteur avait bien transmis une interprétation plus prudente, mais la consigne
de conditionnel et les questions finales obligatoires avaient créé un nouveau
gabarit répétitif. L'encadré Cadre précédait un saut de page forcé avant la carte ;
les fonds CSS des graphiques ne bénéficiaient pas de print-color-adjust.

## Changements

- Réseaux connectés bâtis uniquement à partir des relations déjà licenciées.
  Une appartenance transitive n'autorise jamais un lien direct entre deux
  configurations disjointes. Une structure partagée n'est pas renommée en grand
  trigone ou en autre figure classique absente des calculs.
- Thèse et conclusion disposent du réseau pertinent et de son contexte calculé.
  La conclusion reçoit des extraits de chapitres déjà produits seulement lorsque
  toutes les preuves du bloc source sont autorisées dans sa propre portée.
  Les extraits sont bornés, priorisent les chapitres porteurs et ne sont pas
  transmis aux blocs individuels ou de transit.
- Une conjonction entre deux corps présents en maison 7 peut organiser le chapitre
  Relations et son réseau : corps partagés, signes, maisons et Descendant restent
  des preuves distinctes, réellement présentes. Aucune maison n'est reconstruite
  si l'heure de naissance ou la méthode ne permet pas de la calculer.
- Règles symboliques versionnées ciblées : Soleil–Vénus conjoint, Soleil–Mars et
  Vénus–Mars sextiles ; domaines des maisons 5 et 7 et Descendant en signe.
  Ces conventions fournissent des significations possibles, pas des faits sur une
  personne. Les règles historiques et les axes spécialisés restent disponibles.
- Conjonctions classées selon les corps : Soleil–Vénus, Lune–Vénus et Jupiter–Vénus
  en soutien, Mars–Saturne en tension, autres paires en intégration sans valence
  présumée. La convention de tension modifiée passe à @2.
- Les chapitres de composition ont accès aux sources d'interprétation nécessaires,
  sans devenir propriétaires de chaque placement. Les chapitres réduits à des
  rappels sans matière propre sont omis avec un diagnostic explicite.
- Au plus une question facultative par chapitre, réservée à un seul bloc ; aucune
  en synthèse/conclusion. Contrôle bloquant par bloc et sur le chapitre assemblé.
  La formule « Une question utile serait » et les formulations techniques connues
  sont refusées dans le texte client. La prudence n'impose plus un conditionnel
  permanent ni une question de fin de paragraphe.
- Graphiques en print-color-adjust:exact, couverture explicitement blanche à
  l'impression ; l'encadré et la carte partagent désormais la première page après
  couverture. Aucun contenu narratif n'est ajouté pour accroître la pagination.

Versions : bibliothèque 0.4.0, plan 0.4.0, validateur 0.4.0, composition 1.1.0,
figures 1.0.2. Les calculs astronomiques et les instants UTC ne sont pas modifiés.

## Vérifications

`node --test` : **852 tests réussis, zéro échec**, dont 16 nouvelles régressions.
Les 29 tests de sécurité expérimentaux restent strictement inchangés.
Les attentes existantes adaptées portent sur les versions et le nombre de règles
migrées (8 au lieu de 5), pas sur l'acceptation de faits non autorisés.
Les erreurs undeclared_text_fact et crossed_claim_not_licensed restent bloquantes.

L'aperçu PDF privé utilise exactement le texte du HTML fourni, avec le nouveau CSS.
Rendu Chromium avec printBackground:false : 13 pages au lieu de 14 ; Cadre,
carte, barres et modalités sur la page 2 ; narration dès la page 3. Contrôles de
texte par pypdf et inspection des images : graphiques présents, aucun débordement
sur les pages vérifiées, couverture blanche lisible. Ce PDF est une vérification
de mise en page, pas un dossier nouvellement rédigé ou une « V3 » narrative.
Les fichiers fournis ne sont jamais écrasés et ne sont pas intégrés au dépôt.

La correspondance exacte du HTML V2 avec le stockage a été vérifiée par SHA-256,
en lecture seule. La métadonnée de génération enregistrée confirme gpt-6.1-sol ;
les détails et la référence restent dans le rapport privé local.

Aucun appel IA réel, paiement, e-mail, reprise ou modification de dossier client.
Le modèle Sol et les configurations Stripe/Brevo restent inchangés.

## Livraison et limites

Base de livraison et retour arrière :
`2e0d6300f9382c9acd4d7e85281860b42323bedc`.
Sauvegarder la base et les variables avant mise à jour de main, attendre une CI
verte sur le SHA exact, puis contrôler Render, l'empreinte, les services et la
conservation des données. Ne jamais restaurer une ancienne base pour un simple
retour arrière de code ; les nouvelles règles n'introduisent aucune migration.

Les contrôles automatiques prouvent la disponibilité et la portée des sources,
pas la qualité littéraire de tout texte possible. Le conditionnel fait l'objet
consignes de variété, sans quota arbitraire de mots. Les règles sémantiques
restent partiellement migrées ; les règles historiques sont préservées. Le sujet
indépendant PERSONAL_TRANSIT.natalHouse n'est pas modifié.
