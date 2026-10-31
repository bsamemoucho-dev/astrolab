# Invitations personnelles par e-mail

L’administrateur ouvre `/rouflaquette/invitations`, saisit une adresse, choisit une lecture offerte ou une réduction de 10 EUR, puis envoie. L’e-mail contient un bouton et un QR PNG joint ouvrant le même lien personnel. Aucun SMS ni génération IA n’intervient à l’envoi.

## Avantages et suivi

- Les invitations réservent les avantages existants : codes gratuits importés de 12 caractères à usage unique, ou promotions Stripe natives enregistrées dans le stock privé. Aucun nouveau coupon, crédit ou avantage illimité n’est créé automatiquement.
- Une demande rejouée, un double clic ou une seconde demande pour le même destinataire et le même avantage retrouve l’invitation existante sans second e-mail ni second avantage.
- L’ouverture du lien et la consultation du devis ne consomment rien. Pour une lecture offerte, consommation du code et création du dossier partagent la transaction. Pour une réduction, Stripe limite la promotion ; le dossier reste lié au paiement exact de 8 EUR et à son destinataire.
- Le lien reste utilisable pour retrouver son dossier existant, dans sa durée de conservation, après utilisation. Un paiement confirmé est repris avant de vérifier si sa promotion a déjà été consommée : il ne faut jamais demander de payer à nouveau.
- Les codes non attribués et l’accès réutilisable de l’exploitant conservent leur parcours. Un code gratuit attribué peut encore servir avec son destinataire lié. Une réduction attribuée exige son lien personnel pour conserver le rattachement de la commande.

Le suivi distingue réservation, acceptation par Brevo, résultat d’envoi incertain, paiement confirmé et dossier créé. Une acceptation API Brevo n’est pas une preuve de livraison dans la boîte de réception. Si l’utilisation d’une promotion ne peut pas être rattachée avec certitude, l’interface indique qu’une vérification est nécessaire.

## Confidentialité et reprise

Les jetons aléatoires sont hachés dans `emailInvitations`. Le lien utilise un fragment `#invitation=…`, retiré par le navigateur et transmis à l’API dans le corps des requêtes. Le navigateur le conserve seulement dans le stockage de l’onglet. Le suivi administrateur ne retourne aucun jeton, code clair ni QR.

L’outbox contient le lien et le QR nécessaires à l’envoi ; ils sont supprimés de ce message après acceptation par Brevo. Un résultat incertain ou un envoi interrompu impose une revue manuelle, sans nouvel envoi automatique aveugle. Aucun ancien dossier, historique d’utilisation ou paiement n’est réinitialisé. La durée de conservation des lectures reste inchangée.

Les liens, destinataires et QR sont propres aux invitations et ne doivent jamais être ajoutés au dépôt, aux journaux techniques ou à un service de génération de QR externe. Le QR est généré localement et testé par un décodeur indépendant.

## Configuration et vérification

La configuration Stripe et Brevo existante est conservée. `PUBLIC_BASE_URL` reste obligatoire en production ; les invitations Lastro utilisent l’origine canonique `https://www.lastro.fr`. Le stock de promotions est lu dans `/var/data/lastro-promotions`, sans modification lors d’une consultation.

Exécuter `npm ci` puis `npm test`. Les tests couvrent les deux avantages, les permissions, l’isolation des destinataires, la concurrence, les réponses perdues, les reprises après paiement, les anciens codes et e-mails, ainsi que les QR dans les neuf langues. Ils utilisent des transports simulés ; ils n’effectuent aucun encaissement, e-mail client ou appel IA payant.

Le nouveau bloc d’accueil « Le signe du moment » emploie la position tropicale réellement calculée du Soleil et une date Europe/Paris, sans rédaction IA ni horoscope personnel.

Références : [API e-mail Brevo](https://developers.brevo.com/reference/send-transac-email), [générateur QR](https://github.com/soldair/node-qrcode), [idempotence Stripe](https://docs.stripe.com/api/idempotent_requests).
