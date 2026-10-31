// Invitation capabilities are kept only in tab memory/sessionStorage. The
// fragment is removed before any API request, so it never enters a request URL.
export const INVITATION_STORAGE_KEY = "lastro.email-invitation.v1";
export const INVITATION_TOKEN = /^[A-Za-z0-9_-]{43}$/;

const COPY = {
  fr: { title: "Votre invitation Lastro", free: "Votre lecture est offerte. Aucune carte bancaire n’est nécessaire.", discount: "Votre réduction de 10 € est appliquée : 8 € à payer au lieu de 18 €.", loading: "Vérification de votre invitation…", invalid: "Cette invitation est indisponible. Aucun paiement ne sera ouvert.", used: "Cette invitation a déjà été utilisée.", open: "Retrouver ma lecture", oneUse: "Une utilisation. Ouvrir cette page ne consomme pas votre invitation." },
  en: { title: "Your Lastro invitation", free: "Your reading is free. No bank card is required.", discount: "Your €10 discount is applied: €8 to pay instead of €18.", loading: "Checking your invitation…", invalid: "This invitation is unavailable. No payment will be opened.", used: "This invitation has already been used.", open: "Find my reading", oneUse: "One use. Opening this page does not use your invitation." },
  de: { title: "Deine Lastro-Einladung", free: "Deine Lesung ist kostenlos. Keine Bankkarte erforderlich.", discount: "Dein Rabatt von 10 € gilt: 8 € statt 18 € zu zahlen.", loading: "Deine Einladung wird geprüft…", invalid: "Diese Einladung ist nicht verfügbar. Es wird keine Zahlung geöffnet.", used: "Diese Einladung wurde bereits verwendet.", open: "Meine Lesung finden", oneUse: "Einmal verwendbar. Das Öffnen dieser Seite verbraucht die Einladung nicht." },
  es: { title: "Tu invitación Lastro", free: "Tu lectura es gratuita. No necesitas tarjeta bancaria.", discount: "Tu descuento de 10 € está aplicado: pagas 8 € en lugar de 18 €.", loading: "Comprobando tu invitación…", invalid: "Esta invitación no está disponible. No se abrirá ningún pago.", used: "Esta invitación ya se ha utilizado.", open: "Recuperar mi lectura", oneUse: "Un solo uso. Abrir esta página no consume tu invitación." },
  it: { title: "Il tuo invito Lastro", free: "La tua lettura è gratuita. Non serve una carta bancaria.", discount: "Lo sconto di 10 € è applicato: 8 € da pagare invece di 18 €.", loading: "Verifica del tuo invito…", invalid: "Questo invito non è disponibile. Non verrà aperto alcun pagamento.", used: "Questo invito è già stato utilizzato.", open: "Ritrova la mia lettura", oneUse: "Un solo utilizzo. Aprire questa pagina non consuma l’invito." },
  pt: { title: "O seu convite Lastro", free: "A sua leitura é gratuita. Não é necessário cartão bancário.", discount: "O desconto de 10 € está aplicado: 8 € a pagar em vez de 18 €.", loading: "A verificar o seu convite…", invalid: "Este convite não está disponível. Não será aberto nenhum pagamento.", used: "Este convite já foi utilizado.", open: "Recuperar a minha leitura", oneUse: "Uma utilização. Abrir esta página não utiliza o convite." },
  no: { title: "Din Lastro-invitasjon", free: "Lesningen din er gratis. Bankkort er ikke nødvendig.", discount: "Rabatten på 10 € er brukt: 8 € å betale i stedet for 18 €.", loading: "Kontrollerer invitasjonen din…", invalid: "Denne invitasjonen er utilgjengelig. Ingen betaling åpnes.", used: "Denne invitasjonen er allerede brukt.", open: "Finn lesningen min", oneUse: "Én bruk. Å åpne siden bruker ikke opp invitasjonen." },
  da: { title: "Din Lastro-invitation", free: "Din læsning er gratis. Intet betalingskort er nødvendigt.", discount: "Din rabat på 10 € er anvendt: 8 € at betale i stedet for 18 €.", loading: "Kontrollerer din invitation…", invalid: "Denne invitation er ikke tilgængelig. Ingen betaling åbnes.", used: "Denne invitation er allerede brugt.", open: "Find min læsning", oneUse: "Én brug. Åbning af siden bruger ikke invitationen." },
  nl: { title: "Je Lastro-uitnodiging", free: "Je lezing is gratis. Een bankkaart is niet nodig.", discount: "Je korting van €10 is toegepast: €8 te betalen in plaats van €18.", loading: "Je uitnodiging controleren…", invalid: "Deze uitnodiging is niet beschikbaar. Er wordt geen betaling geopend.", used: "Deze uitnodiging is al gebruikt.", open: "Mijn lezing terugvinden", oneUse: "Eenmalig gebruik. Het openen van deze pagina verbruikt je uitnodiging niet." }
};

export function invitationStrings(language = "fr") {
  const code = String(language).slice(0, 2).toLowerCase();
  const exits = { fr: "Continuer sans invitation", en: "Continue without an invitation", de: "Ohne Einladung fortfahren", es: "Continuar sin invitación", it: "Continua senza invito", pt: "Continuar sem convite", no: "Fortsett uten invitasjon", da: "Fortsæt uden invitation", nl: "Doorgaan zonder uitnodiging" };
  const paid = { fr: "Votre paiement est déjà confirmé. Vous pouvez reprendre la préparation de votre lecture sans repayer.", en: "Your payment is already confirmed. Continue preparing your reading without paying again.", de: "Deine Zahlung ist bereits bestätigt. Setze die Vorbereitung ohne erneute Zahlung fort.", es: "Tu pago ya está confirmado. Continúa la preparación sin volver a pagar.", it: "Il pagamento è già confermato. Riprendi la preparazione senza pagare di nuovo.", pt: "O pagamento já está confirmado. Retome a preparação sem pagar novamente.", no: "Betalingen er bekreftet. Fortsett forberedelsen uten å betale igjen.", da: "Betalingen er bekræftet. Fortsæt forberedelsen uden at betale igen.", nl: "Je betaling is bevestigd. Ga verder zonder opnieuw te betalen." };
  const busy = { fr: "Une commande est déjà en cours dans cet onglet. Ouvrez la nouvelle invitation dans un autre onglet.", en: "An order is already in progress in this tab. Open the new invitation in another tab.", de: "In diesem Tab läuft bereits eine Bestellung. Öffne die neue Einladung in einem anderen Tab.", es: "Ya hay un pedido en curso en esta pestaña. Abre la nueva invitación en otra pestaña.", it: "Un ordine è già in corso in questa scheda. Apri il nuovo invito in un’altra scheda.", pt: "Já existe um pedido em curso neste separador. Abra o novo convite noutro separador.", no: "En bestilling pågår i denne fanen. Åpne den nye invitasjonen i en annen fane.", da: "En bestilling er i gang i denne fane. Åbn den nye invitation i en anden fane.", nl: "Er loopt al een bestelling in dit tabblad. Open de nieuwe uitnodiging in een ander tabblad." };
  const freeNotes = {
    fr: "Votre lecture offerte est préparée après votre confirmation. Elle est conservée 30 jours, puis supprimée.",
    en: "Your free reading is prepared after your confirmation. It is kept for 30 days, then deleted.",
    de: "Deine kostenlose Lesung wird nach deiner Bestätigung vorbereitet. Sie wird 30 Tage aufbewahrt und dann gelöscht.",
    es: "Tu lectura gratuita se prepara tras tu confirmación. Se conserva 30 días y después se elimina.",
    it: "La tua lettura gratuita viene preparata dopo la tua conferma. È conservata per 30 giorni, poi eliminata.",
    pt: "A sua leitura gratuita é preparada após a sua confirmação. É conservada durante 30 dias e depois eliminada.",
    no: "Den gratis lesningen forberedes etter din bekreftelse. Den oppbevares i 30 dager og slettes deretter.",
    da: "Din gratis læsning forberedes efter din bekræftelse. Den opbevares i 30 dage og slettes derefter.",
    nl: "Je gratis lezing wordt na je bevestiging voorbereid. Ze wordt 30 dagen bewaard en daarna verwijderd."
  };
  return { ...(COPY[code] ?? COPY.fr), exit: exits[code] ?? exits.fr, paid: paid[code] ?? paid.fr, busy: busy[code] ?? busy.fr, freeNote: freeNotes[code] ?? freeNotes.fr };
}

export function invitationNavigation({ href, storage, replaceUrl = () => {} }) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const supplied = fragment.has("invitation") || url.searchParams.has("invitation");
  let token = null;
  let invalid = false;
  if (supplied) {
    const candidates = fragment.getAll("invitation");
    token = candidates.length === 1 && [...fragment.keys()].length === 1 && !url.searchParams.has("invitation") ? candidates[0] : null;
    invalid = !INVITATION_TOKEN.test(token ?? "");
    url.hash = "";
    url.searchParams.delete("invitation");
    replaceUrl(`${url.pathname}${url.search}`);
    try {
      if (invalid) storage?.removeItem(INVITATION_STORAGE_KEY);
      else storage?.setItem(INVITATION_STORAGE_KEY, token);
    } catch { /* Tab memory remains usable; never fall back to localStorage. */ }
  } else {
    try { token = storage?.getItem(INVITATION_STORAGE_KEY) ?? null; } catch { /* Storage can be disabled. */ }
    if (token && !INVITATION_TOKEN.test(token)) {
      token = null;
      try { storage?.removeItem(INVITATION_STORAGE_KEY); } catch { /* no-op */ }
    }
  }
  return { active: supplied || Boolean(token), token: invalid ? null : token, status: invalid ? "unavailable" : token ? "unresolved" : "none" };
}

function safeDelivery(value, origin) {
  if (!value || typeof value !== "object" || typeof value.link !== "string") return null;
  try {
    const url = new URL(value.link, origin);
    if (url.origin !== origin || !/^\/r\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) || url.search || url.hash) return null;
    return { reference: typeof value.reference === "string" ? value.reference : null, link: url.href, status: value.status };
  } catch { return null; }
}

function acceptedInvitation(value, origin) {
  if (!value || typeof value.id !== "string" || !["free", "discount10"].includes(value.kind)
      || !["available", "used", "unavailable"].includes(value.status)
      || typeof value.recipientEmail !== "string" || value.recipientEmail.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.recipientEmail)) return null;
  const checkoutId = typeof value.checkoutSessionId === "string" && /^cs_(?:live|test)_[A-Za-z0-9_]{1,250}$/.test(value.checkoutSessionId) ? value.checkoutSessionId : null;
  if (value.paymentConfirmed === true && (!checkoutId || value.kind !== "discount10")) return null;
  const quote = value.quote;
  const total = value.kind === "free" ? 0 : 800;
  if (value.status === "available" && (!quote || quote.baseCents !== 1800 || quote.totalCents !== total
      || quote.discountCents !== 1800 - total || quote.currency !== "eur")) return null;
  return { id: value.id, kind: value.kind, recipientEmail: value.recipientEmail, status: value.status,
    quote: value.status === "available" ? Object.freeze({ version: quote.version, baseCents: 1800, totalCents: total, discountCents: 1800 - total, currency: "eur", valid: true, reason: "applied" }) : null,
    delivery: safeDelivery(value.delivery, origin), checkoutSessionId: checkoutId, paymentConfirmed: value.paymentConfirmed === true };
}

export function createEmailInvitationController({ href, storage, replaceUrl, requestResolve, onChange = () => {} }) {
  const navigation = invitationNavigation({ href, storage, replaceUrl });
  const origin = new URL(href).origin;
  let current = { ...navigation, invitation: null };
  let revision = 0;
  const snapshot = () => ({ ...current });
  const publish = () => onChange(snapshot());
  const resolve = async () => {
    if (!current.active || !current.token) { publish(); return snapshot(); }
    const id = ++revision;
    current = { ...current, status: "loading", invitation: null };
    publish();
    try {
      const response = await requestResolve(current.token);
      if (id !== revision) return snapshot();
      const invitation = acceptedInvitation(response?.invitation, origin);
      current = { ...current, invitation, status: invitation?.status ?? "unavailable" };
    } catch {
      if (id !== revision) return snapshot();
      current = { ...current, invitation: null, status: "unavailable" };
    }
    publish();
    return snapshot();
  };
  const clear = () => {
    revision++;
    try { storage?.removeItem(INVITATION_STORAGE_KEY); } catch { /* no-op */ }
    current = { active: false, token: null, status: "none", invitation: null };
    publish();
  };
  const navigate = (nextHref, { preserveCurrent = false } = {}) => {
    const next = new URL(nextHref);
    if (!new URLSearchParams(next.hash.slice(1)).has("invitation") && !next.searchParams.has("invitation")) return false;
    const navigation = invitationNavigation({ href: nextHref, storage: preserveCurrent ? null : storage, replaceUrl });
    if (preserveCurrent) return false;
    revision++;
    current = { ...navigation, invitation: null };
    publish();
    return true;
  };
  return { snapshot, resolve, clear, navigate };
}
