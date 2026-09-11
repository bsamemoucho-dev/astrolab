// Envoi des e-mails transactionnels (Brevo), en HTTP — aucune dépendance npm.
//
// Configuration par variables d'environnement :
//   BREVO_API_KEY        clé API Brevo (xkeysib-…), jamais exposée au navigateur
//   BREVO_SENDER_EMAIL   adresse d'expédition (ex. contact@lastro.fr), vérifiée chez Brevo
//   BREVO_SENDER_NAME    nom affiché (par défaut « Lastro »)
//
// Les e-mails ne sont pas critiques pour le paiement : si l'envoi échoue, le
// message reste dans la file (outbox) du stockage, avec la raison, au lieu
// d'être perdu.

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function emailConfiguration() {
  const apiKey = String(process.env.BREVO_API_KEY ?? "").trim();
  const senderEmail = String(process.env.BREVO_SENDER_EMAIL ?? "").trim();
  if (!apiKey || !senderEmail.includes("@")) {
    return null;
  }
  return {
    apiKey,
    senderEmail,
    senderName: String(process.env.BREVO_SENDER_NAME ?? "").trim() || "Lastro"
  };
}

export function emailEnabled() {
  return Boolean(emailConfiguration());
}

// Vérification d'adresse à l'inscription.
//
//   ASTROLAB_EMAIL_MODE=dev_code (défaut) : le code est renvoyé dans la réponse
//     HTTP et affiché à l'écran — pratique en développement, inacceptable en
//     production : n'importe qui validerait l'adresse d'un autre.
//   ASTROLAB_EMAIL_MODE=email : le code part par e-mail et n'est JAMAIS renvoyé
//     dans la réponse.
//
// Toute valeur explicite autre que `dev_code` est traitée comme `email` : une
// faute de frappe ne doit pas rouvrir la faille en silence. Non renseignée, la
// variable garde le comportement de développement.
export function emailVerificationMode() {
  const brut = process.env.ASTROLAB_EMAIL_MODE;
  if (brut === undefined) {
    return "dev_code";
  }
  return String(brut).trim().toLowerCase() === "dev_code" ? "dev_code" : "email";
}

export function verificationCodeIsReturned() {
  return emailVerificationMode() === "dev_code";
}

// Objet et corps de l'e-mail de vérification, dans la langue du client.
const VERIFICATION_EMAILS = {
  fr: { subject: "Votre code de vérification Lastro", body: (code) => `Votre code de vérification Lastro est ${code}.` },
  en: { subject: "Your Lastro verification code", body: (code) => `Your Lastro verification code is ${code}.` },
  de: { subject: "Dein Lastro-Bestätigungscode", body: (code) => `Dein Lastro-Bestätigungscode lautet ${code}.` },
  es: { subject: "Tu código de verificación de Lastro", body: (code) => `Tu código de verificación de Lastro es ${code}.` },
  it: { subject: "Il tuo codice di verifica Lastro", body: (code) => `Il tuo codice di verifica Lastro è ${code}.` },
  pt: { subject: "O seu código de verificação Lastro", body: (code) => `O seu código de verificação Lastro é ${code}.` },
  no: { subject: "Din bekreftelseskode for Lastro", body: (code) => `Bekreftelseskoden din for Lastro er ${code}.` },
  da: { subject: "Din bekræftelseskode til Lastro", body: (code) => `Din bekræftelseskode til Lastro er ${code}.` },
  nl: { subject: "Je Lastro-verificatiecode", body: (code) => `Je Lastro-verificatiecode is ${code}.` }
};

export function verificationEmail(language, code) {
  const langue = String(language ?? "fr").slice(0, 2).toLowerCase();
  const modele = VERIFICATION_EMAILS[langue] ?? VERIFICATION_EMAILS.en;
  return { subject: modele.subject, body: modele.body(String(code ?? "")) };
}

export async function sendEmail({ to, subject, text, html = null }) {
  const config = emailConfiguration();
  if (!config) {
    const error = new Error("L'envoi d'e-mails n'est pas configuré sur ce site.");
    error.status = 503;
    throw error;
  }
  const recipient = String(to ?? "").trim();
  if (!recipient.includes("@")) {
    const error = new Error("Adresse e-mail du destinataire manquante ou invalide.");
    error.status = 400;
    throw error;
  }

  let response;
  try {
    response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        sender: { email: config.senderEmail, name: config.senderName },
        to: [{ email: recipient }],
        subject: String(subject ?? "Lastro").slice(0, 200),
        textContent: String(text ?? ""),
        ...(html ? { htmlContent: html } : {})
      })
    });
  } catch (cause) {
    const error = new Error("Impossible de joindre le service d'e-mail.");
    error.status = 502;
    error.publicMessage = "L'envoi de l'e-mail a échoué. Votre lecture reste accessible avec votre lien.";
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.message ?? `Envoi refusé par le service d'e-mail (${response.status}).`);
    error.status = 502;
    error.publicMessage = "L'envoi de l'e-mail a échoué. Votre lecture reste accessible avec votre lien.";
    throw error;
  }
  return { delivered: true };
}

// Vide la file d'envoi : chaque message est marqué comme envoyé, ou conservé
// avec la raison de l'échec pour être renvoyé plus tard.
export async function flushQueuedEmails(store, { send = sendEmail, types = ["public_reading_link"] } = {}) {
  const state = await store.load();
  const attendus = new Set(types);
  const pending = state.outbox.filter((mail) => attendus.has(mail.type) && !mail.sentAt);
  if (pending.length === 0) {
    return { sent: 0, failed: 0, skipped: !emailEnabled() };
  }
  if (!emailEnabled()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  let sent = 0;
  let failed = 0;
  for (const mail of pending) {
    try {
      await send({ to: mail.to, subject: mail.subject, text: mail.body });
      await store.transact((current) => {
        const entry = current.outbox.find((item) => item.id === mail.id);
        if (entry) {
          entry.sentAt = new Date().toISOString();
          entry.error = null;
        }
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      await store.transact((current) => {
        const entry = current.outbox.find((item) => item.id === mail.id);
        if (entry) {
          entry.error = String(error.message ?? "envoi impossible").slice(0, 300);
          entry.attempts = (entry.attempts ?? 0) + 1;
        }
      });
      console.warn(`[Lastro] e-mail non envoyé à ${mail.to} — ${error.message}`);
    }
  }
  return { sent, failed, skipped: false };
}
