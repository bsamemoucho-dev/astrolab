const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEND_LABELS = { pending: "En attente", sending: "Envoi en cours", sent: "Accepté par Brevo", failed: "Échec d’envoi", unknown: "Envoi à vérifier" };
const READING_LABELS = { queued: "En attente", generating: "En préparation", ready: "Prête", failed: "Échec de génération" };

export function invitationAdminRow(value = {}) {
  const mail = value.mail ?? {};
  const usage = value.usage ?? {};
  const used = value.status === "used" || usage.status === "used" || Boolean(value.usedAt || usage.usedAt);
  const usageStatus = used ? "used"
    : usage.status === "payment_confirmed" || value.status === "payment_confirmed" ? "payment_confirmed"
      : usage.status === "unavailable" || value.status === "unavailable" ? "unavailable"
        : usage.status === "unknown" || value.status === "unknown" ? "unknown" : "available";
  const usageLabel = { used: "Utilisée", payment_confirmed: "Payé — lecture à créer", unavailable: "Avantage indisponible — à vérifier", unknown: "Utilisation à vérifier", available: "Non utilisée" }[usageStatus];
  return {
    id: typeof value.id === "string" ? value.id : "",
    email: typeof value.recipientEmail === "string" ? value.recipientEmail : "—",
    benefit: value.kind === "free" ? "Lecture offerte" : value.kind === "discount10" ? "−10 € · 8 € à payer" : "—",
    createdAt: value.createdAt ?? null,
    sendStatus: Object.hasOwn(SEND_LABELS, mail.status) ? mail.status : "unknown",
    sendLabel: SEND_LABELS[mail.status] ?? SEND_LABELS.unknown,
    attempts: Number.isSafeInteger(mail.attempts) && mail.attempts >= 0 ? mail.attempts : 0,
    acceptedAt: mail.acceptedAt ?? null,
    manualReview: Boolean(mail.manualReviewRequired),
    used, usageStatus, usageLabel,
    usedAt: usage.usedAt ?? value.usedAt ?? null,
    reference: used ? usage.reference ?? value.deliveryReference ?? null : null,
    reading: used ? READING_LABELS[usage.readingStatus ?? value.readingStatus] ?? null : null
  };
}

export function createInvitationSendController({ request, makeRequestId }) {
  let pending = false;
  let requestId = null;
  let identity = null;
  const send = async ({ email, kind, language = "fr" }) => {
    if (pending) return null;
    const recipient = String(email ?? "").trim().toLowerCase();
    if (!EMAIL.test(recipient) || recipient.length > 254 || !["free", "discount10"].includes(kind)) {
      throw new Error("Indiquez une adresse e-mail et un avantage valides.");
    }
    const next = JSON.stringify({ email: recipient, kind, language });
    if (next !== identity) { identity = next; requestId = makeRequestId(); }
    pending = true;
    try {
      // Retain the same request ID after both success and uncertain transport.
      // The server also deduplicates by recipient + kind across browser tabs.
      return await request({ email: recipient, kind, requestId, language });
    } finally { pending = false; }
  };
  return { send, isPending: () => pending };
}

export function mountAdminInvitations({ document, fetchImpl = fetch, makeRequestId = () => crypto.randomUUID(), schedule = setTimeout, unschedule = clearTimeout } = {}) {
  const byId = (id) => document.getElementById(id);
  const form = byId("invitation-form");
  if (!form) return null;
  const sendButton = byId("invitation-send");
  const feedback = byId("invitation-feedback");
  const errorBox = byId("invitation-error");
  const dates = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
  let timer = null;
  let refreshing = false;
  let stopped = false;
  const formatDate = (value) => {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? dates.format(date) : "—";
  };
  async function api(method = "GET", body) {
    const response = await fetchImpl("/api/admin/email-invitations", {
      method, credentials: "same-origin", cache: "no-store",
      headers: { accept: "application/json", ...(body ? { "content-type": "application/json", "x-astrolab-admin-action": "send-email-invitation" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 401 ? "Connectez-vous à Lastro avec votre compte administrateur." : response.status === 403 ? "Un compte administrateur est requis." : data.error ?? "Le suivi des invitations est momentanément indisponible.");
    return data;
  }
  const sender = createInvitationSendController({ request: (body) => api("POST", body), makeRequestId });
  const badge = (label, tone) => {
    const node = document.createElement("span");
    node.className = "badge";
    node.dataset.tone = tone;
    node.textContent = label;
    return node;
  };
  const note = (parent, value) => {
    const node = document.createElement("span");
    node.className = "cell-note";
    node.textContent = value;
    parent.append(node);
  };
  function rowElement(item) {
    const row = document.createElement("tr");
    const cell = (label, text) => {
      const node = document.createElement("td");
      node.dataset.label = label;
      if (text !== undefined) node.textContent = text;
      row.append(node);
      return node;
    };
    cell("Destinataire", item.email);
    cell("Avantage", item.benefit);
    cell("Créée le", formatDate(item.createdAt));
    const mail = cell("Envoi");
    mail.append(badge(item.sendLabel, item.sendStatus === "sent" ? "good" : ["failed", "unknown"].includes(item.sendStatus) ? "bad" : "waiting"));
    if (item.acceptedAt) note(mail, formatDate(item.acceptedAt));
    if (item.attempts) note(mail, `${item.attempts} tentative${item.attempts > 1 ? "s" : ""}`);
    if (item.manualReview) note(mail, "Vérification manuelle nécessaire avant tout nouvel envoi.");
    const usage = cell("Utilisation");
    usage.append(badge(item.usageLabel, item.used ? "good" : ["unavailable", "unknown"].includes(item.usageStatus) ? "bad" : "waiting"));
    if (item.usedAt) note(usage, formatDate(item.usedAt));
    const delivery = cell("Commande / lecture", typeof item.reference === "string" ? item.reference : "—");
    if (item.reading) note(delivery, item.reading);
    return row;
  }
  const refresh = async () => {
    if (refreshing || stopped) return;
    refreshing = true;
    if (timer !== null) { unschedule(timer); timer = null; }
    try {
      const data = await api();
      if (!Array.isArray(data.invitations)) throw new Error("Le suivi reçu est incomplet.");
      const rows = data.invitations.map(invitationAdminRow);
      const holder = byId("invitation-rows");
      holder.replaceChildren(...rows.map(rowElement));
      byId("invitation-empty").hidden = rows.length > 0;
      byId("invitation-count").textContent = `${rows.length} invitation${rows.length > 1 ? "s" : ""}`;
      for (const [id, key] of [["free-available", "freeAvailable"], ["discount-available", "discountAvailable"]]) {
        const value = data.inventory?.[key];
        byId(id).textContent = Number.isSafeInteger(value) && value >= 0 ? String(value) : "Indisponible";
      }
      errorBox.textContent = "";
      if (rows.some((row) => ["pending", "sending"].includes(row.sendStatus)) && !stopped && document.visibilityState !== "hidden") {
        timer = schedule(refresh, 5000);
      }
      return data;
    } catch (error) {
      errorBox.textContent = error.message;
    } finally { refreshing = false; }
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sender.isPending()) return;
    feedback.textContent = "";
    feedback.dataset.error = "false";
    sendButton.disabled = true;
    try {
      const result = await sender.send({ email: byId("invitation-email").value, kind: byId("invitation-kind").value, language: byId("invitation-language").value });
      if (!result) return;
      feedback.textContent = result.created
        ? "Invitation enregistrée. Le statut d’envoi sera actualisé ci-dessous."
        : "Une invitation de ce type existe déjà pour cette adresse. Aucun second avantage n’a été créé.";
      await refresh();
    } catch (error) {
      feedback.textContent = error.message;
      feedback.dataset.error = "true";
    } finally { sendButton.disabled = false; }
  });
  byId("invitation-refresh").addEventListener("click", refresh);
  void refresh();
  return { refresh, stop() { stopped = true; if (timer !== null) unschedule(timer); } };
}

if (typeof document !== "undefined" && document.getElementById("invitation-form")) mountAdminInvitations({ document });
