// Envoi des e-mails transactionnels (Brevo), en HTTP — aucune dépendance npm.
//
// Configuration par variables d'environnement :
//   BREVO_API_KEY        clé API Brevo (xkeysib-…), jamais exposée au navigateur
//   BREVO_SENDER_EMAIL   adresse d'expédition (ex. contact@lastro.fr), vérifiée chez Brevo
//   BREVO_SENDER_NAME    nom affiché (par défaut « Lastro »)
//   BREVO_REPLY_TO       adresse de réponse éventuelle
//
// Les e-mails ne sont pas critiques pour le paiement : si l'envoi échoue, le
// message reste dans la file (outbox) du stockage, avec la raison, au lieu
// d'être perdu.

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
export const OUTBOX_MAX_ATTEMPTS = 3;
export const OUTBOX_RETRY_DELAY_MS = 60 * 1000;
export const OUTBOX_STALE_SENDING_MS = 10 * 60 * 1000;

export function emailConfiguration() {
  const apiKey = String(process.env.BREVO_API_KEY ?? "").trim();
  const senderEmail = String(process.env.BREVO_SENDER_EMAIL ?? "").trim();
  if (!apiKey || !senderEmail.includes("@")) {
    return null;
  }
  return {
    apiKey,
    senderEmail,
    senderName: String(process.env.BREVO_SENDER_NAME ?? "").trim() || "Lastro",
    replyTo: String(process.env.BREVO_REPLY_TO ?? "").trim() || null
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
        ...(config.replyTo && config.replyTo.includes("@") ? { replyTo: { email: config.replyTo } } : {}),
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
  const payload = await response.json().catch(() => ({}));
  return { delivered: true, providerMessageId: payload.messageId ?? payload.messageIds?.[0] ?? null };
}

async function reserveQueuedEmail(store, types) {
  const attendus = new Set(types);
  const now = Date.now();
  return store.transact((state) => {
    const mail = state.outbox.find((entry) => {
      if (!attendus.has(entry.type) || entry.sentAt) {
        return false;
      }
      const status = entry.status ?? "pending";
      const attempts = Number(entry.attempts ?? 0);
      const nextAttemptAt = entry.nextAttemptAt ? new Date(entry.nextAttemptAt).getTime() : 0;
      return status === "pending" && attempts < OUTBOX_MAX_ATTEMPTS && nextAttemptAt <= now;
    });
    if (!mail) {
      return null;
    }
    mail.status = "sending";
    mail.sendingStartedAt = new Date().toISOString();
    mail.attempts = Number(mail.attempts ?? 0) + 1;
    return structuredClone(mail);
  });
}

async function markQueuedEmailSent(store, id, result) {
  await store.transact((state) => {
    const entry = state.outbox.find((mail) => mail.id === id);
    if (entry) {
      entry.status = "sent";
      entry.sentAt = new Date().toISOString();
      entry.error = null;
      entry.nextAttemptAt = null;
      entry.providerMessageId = result?.providerMessageId ?? null;
    }
  });
}

async function markQueuedEmailFailed(store, id, error) {
  return store.transact((state) => {
    const entry = state.outbox.find((mail) => mail.id === id);
    if (entry) {
      entry.status = Number(entry.attempts ?? 0) >= OUTBOX_MAX_ATTEMPTS ? "failed" : "pending";
      entry.error = String(error.message ?? "envoi impossible").slice(0, 300);
      entry.failedAt = new Date().toISOString();
      entry.nextAttemptAt = entry.status === "pending" ? new Date(Date.now() + OUTBOX_RETRY_DELAY_MS).toISOString() : null;
      return structuredClone(entry);
    }
    return null;
  });
}

export async function detectStaleSendingEmails(
  store,
  { types = ["public_reading_link", "public_reading_failure", "admin_alert"], staleMs = OUTBOX_STALE_SENDING_MS, now = Date.now() } = {}
) {
  const attendus = new Set(types);
  return store.transact((state) => {
    const stale = [];
    for (const entry of state.outbox) {
      if (!attendus.has(entry.type) || entry.status !== "sending" || entry.sentAt) {
        continue;
      }
      const started = entry.sendingStartedAt ? new Date(entry.sendingStartedAt).getTime() : 0;
      if (!started || now - started < staleMs) {
        continue;
      }
      entry.status = "failed";
      entry.manualReviewRequired = true;
      entry.failureKind = "sending_stale";
      entry.error = "Envoi resté en statut sending après crash ou arrêt serveur ; statut fournisseur inconnu.";
      entry.failedAt = new Date(now).toISOString();
      entry.nextAttemptAt = null;
      stale.push(structuredClone(entry));
    }
    return stale;
  });
}

// Vide la file d'envoi : chaque message est réservé avant appel Brevo, puis
// marqué comme envoyé ou conservé avec la raison de l'échec.
export async function flushQueuedEmails(
  store,
  { send = sendEmail, types = ["public_reading_link"], onFinalFailure = null } = {}
) {
  const state = await store.load();
  const hasPending = state.outbox.some((mail) => {
    const status = mail.status ?? "pending";
    return types.includes(mail.type) && status === "pending" && !mail.sentAt && Number(mail.attempts ?? 0) < OUTBOX_MAX_ATTEMPTS;
  });
  if (!hasPending) {
    return { sent: 0, failed: 0, skipped: !emailEnabled() };
  }
  if (!emailEnabled()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  let sent = 0;
  let failed = 0;
  const finalFailures = [];
  for (;;) {
    const mail = await reserveQueuedEmail(store, types);
    if (!mail) {
      break;
    }
    try {
      const result = await send({ to: mail.to, subject: mail.subject, text: mail.body, html: mail.html ?? null });
      await markQueuedEmailSent(store, mail.id, result);
      sent += 1;
    } catch (error) {
      failed += 1;
      const marked = await markQueuedEmailFailed(store, mail.id, error);
      if (marked?.status === "failed") {
        finalFailures.push(marked);
        if (marked.type === "admin_alert") {
          console.error(`[Lastro][ADMIN_ALERT_FAILED] alerte admin non envoyée après ${marked.attempts} tentative(s) — ${marked.reference ?? marked.id} — ${marked.error}`);
        }
        await onFinalFailure?.(marked, error);
      }
      console.warn(`[Lastro] e-mail non envoyé — ${error.message}`);
    }
  }
  return { sent, failed, finalFailures, skipped: false };
}
