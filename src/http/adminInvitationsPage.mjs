export function renderAdminInvitationsPage() {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="referrer" content="no-referrer">
  <title>Invitations | Admin Lastro</title>
  <link rel="stylesheet" href="/admin-invitations.css">
</head>
<body>
  <header class="admin-header">
    <a class="brand" href="/">Lastro</a>
    <nav aria-label="Administration"><a href="/rouflaquette">Lectures</a><a href="/rouflaquette/invitations" aria-current="page">Invitations</a></nav>
  </header>
  <main>
    <div class="page-heading"><div><p class="eyebrow">Administration</p><h1>Inviter à découvrir Lastro</h1><p>Une adresse e-mail, un avantage, une invitation personnelle.</p></div><button id="invitation-refresh" class="secondary" type="button">Actualiser le suivi</button></div>
    <section class="inventory" aria-label="Invitations disponibles">
      <article><strong id="free-available">—</strong><span>Lectures offertes disponibles</span></article>
      <article><strong id="discount-available">—</strong><span>Réductions de 10 € disponibles</span></article>
    </section>
    <section class="send-panel" aria-labelledby="send-title">
      <div><h2 id="send-title">Envoyer une invitation</h2><p>Le destinataire recevra un bouton à toucher et un QR code personnel. Aucun code à recopier.</p></div>
      <form id="invitation-form">
        <label for="invitation-email">Adresse e-mail<input id="invitation-email" name="email" type="email" autocomplete="off" maxlength="254" required placeholder="destinataire@exemple.fr"></label>
        <label for="invitation-kind">Avantage<select id="invitation-kind" name="kind"><option value="free">Lecture offerte — 0 €</option><option value="discount10">Réduction de 10 € — 8 € à payer</option></select></label>
        <label for="invitation-language">Langue de l’e-mail<select id="invitation-language" name="language"><option value="fr">Français</option><option value="en">English</option><option value="de">Deutsch</option><option value="es">Español</option><option value="it">Italiano</option><option value="pt">Português</option><option value="no">Norsk</option><option value="da">Dansk</option><option value="nl">Nederlands</option></select></label>
        <button id="invitation-send" type="submit">Envoyer l’invitation</button>
      </form>
      <p class="notice">Chaque invitation donne droit à une seule utilisation. Son ouverture ne consomme pas l’avantage. Aucun paiement ni dossier n’est créé lors de l’envoi.</p>
      <p id="invitation-feedback" class="feedback" role="status" aria-live="polite"></p>
    </section>
    <section aria-labelledby="follow-title">
      <div class="follow-heading"><h2 id="follow-title">Suivi des invitations</h2><span id="invitation-count" class="muted"></span></div>
      <p class="notice">« Accepté par Brevo » confirme la prise en charge par le fournisseur, pas l’arrivée dans la boîte de réception. Les utilisations sont rattachées à leur commande.</p>
      <table><thead><tr><th>Destinataire</th><th>Avantage</th><th>Créée le</th><th>Envoi</th><th>Utilisation</th><th>Commande / lecture</th></tr></thead><tbody id="invitation-rows"></tbody></table>
      <p id="invitation-empty" class="empty" hidden>Aucune invitation envoyée pour le moment.</p>
      <p id="invitation-error" class="error" role="alert"></p>
    </section>
  </main>
  <script type="module" src="/admin-invitations.js"></script>
</body>
</html>`;
}
