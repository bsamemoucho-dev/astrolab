// Paiement Stripe — Checkout intégré (Embedded), montant libre.
//
// Aucune dépendance npm : on appelle directement l'API REST Stripe avec fetch.
// Configuration par variables d'environnement :
//   STRIPE_SECRET_KEY      (sk_live_… / sk_test_…)  — jamais exposée au navigateur
//   STRIPE_PUBLISHABLE_KEY (pk_live_… / pk_test_…)  — publique, envoyée au client
//   STRIPE_CURRENCY        (optionnel, par défaut "eur")

const STRIPE_API = "https://api.stripe.com/v1";

// Offre de prix : montant libre à partir de 5 € (en centimes). Aucun plafond
// produit : la seule limite haute est celle de Stripe pour un paiement unique.
export const MIN_AMOUNT_CENTS = 500;
export const MAX_AMOUNT_CENTS = 99999999; // 999 999,99 € — plafond technique de Stripe

const SECRET_PREFIXES = ["sk_live_", "sk_test_", "rk_live_", "rk_test_"];
const PUBLISHABLE_PREFIXES = ["pk_live_", "pk_test_"];

function rawSecret() {
  return String(process.env.STRIPE_SECRET_KEY ?? "");
}

function rawPublishable() {
  return String(process.env.STRIPE_PUBLISHABLE_KEY ?? "");
}

// Une clé recopiée depuis le tableau de bord Stripe arrive parfois avec un
// retour à la ligne ou un caractère invisible au milieu. Ces caractères ne sont
// pas visibles dans l'interface de l'hébergeur, mais ils faisaient échouer
// chaque appel à Stripe (le serveur renvoyait « Internal server error »). On les
// retire, et on signale le nettoyage pour que la clé soit recollée proprement.
const INVISIBLE_CHARACTERS = /[\s\u00a0\u200b\u200c\u200d\u2060\ufeff]/g;

function cleanKey(value) {
  return String(value ?? "").replace(INVISIBLE_CHARACTERS, "");
}

// Problèmes qui rendent le paiement réellement inutilisable.
export function stripeKeyProblem() {
  const secret = cleanKey(rawSecret());
  const publishable = cleanKey(rawPublishable());
  if (!secret && !publishable) {
    return null;
  }
  if (!secret || !publishable) {
    return "incomplete_key_pair";
  }
  if (!SECRET_PREFIXES.some((prefix) => secret.startsWith(prefix))) {
    return "secret_key_unexpected_prefix";
  }
  if (!PUBLISHABLE_PREFIXES.some((prefix) => publishable.startsWith(prefix))) {
    return "publishable_key_unexpected_prefix";
  }
  const secretMode = secret.includes("_live_") ? "live" : "test";
  const publishableMode = publishable.includes("_live_") ? "live" : "test";
  if (secretMode !== publishableMode) {
    return "key_mode_mismatch";
  }
  return null;
}

// Simple avertissement : la clé a été nettoyée mais le paiement fonctionne.
export function stripeKeyNotice() {
  for (const [name, raw] of [
    ["secret", rawSecret()],
    ["publishable", rawPublishable()]
  ]) {
    const trimmed = raw.trim();
    if (trimmed && trimmed !== cleanKey(trimmed)) {
      return `${name}_key_cleaned`;
    }
  }
  return null;
}

// Diagnostic sans secret : longueurs et identifiant de compte (déjà public via
// la clé publiable), pour distinguer une clé tronquée d'une clé d'un autre
// compte sans jamais exposer la clé secrète elle-même.
export function stripeKeyDiagnostics() {
  const secret = cleanKey(rawSecret());
  const publishable = cleanKey(rawPublishable());
  if (!secret && !publishable) {
    return { secretLength: 0, publishableLength: 0, accountMatches: null };
  }
  const accountOf = (key) => key.slice(8, 24);
  return {
    secretLength: secret.length,
    publishableLength: publishable.length,
    secretPrefix: secret.slice(0, 8) || null,
    // Une clé live complète : 109 caractères (sk_live_ + 101).
    secretLooksComplete: secret.length >= 100,
    accountMatches: secret.length >= 24 && publishable.length >= 24 ? accountOf(secret) === accountOf(publishable) : null
  };
}

let lastFailure = null;

export function lastStripeFailure() {
  return lastFailure;
}

function recordFailure(message) {
  lastFailure = { at: new Date().toISOString(), message: String(message ?? "").slice(0, 300) };
}

export function stripeConfiguration() {
  if (stripeKeyProblem()) {
    return null;
  }
  const secretKey = cleanKey(rawSecret());
  const publishableKey = cleanKey(rawPublishable());
  if (!secretKey || !publishableKey) {
    return null;
  }
  return {
    secretKey,
    publishableKey,
    currency: (process.env.STRIPE_CURRENCY?.trim() || "eur").toLowerCase()
  };
}

export function stripeEnabled() {
  return Boolean(stripeConfiguration());
}

async function stripeRequest(config, path, { method = "GET", body = null } = {}) {
  let response;
  try {
    response = await fetch(`${STRIPE_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
      },
      body: body ? new URLSearchParams(body).toString() : undefined
    });
  } catch (cause) {
    const error = new Error(
      "Impossible de joindre Stripe. Vérifiez STRIPE_SECRET_KEY (clé recopiée sans retour à la ligne) et la connexion sortante du service."
    );
    error.status = 502;
    error.publicMessage = "Le paiement est momentanément indisponible. Merci de réessayer dans quelques minutes.";
    error.cause = cause;
    recordFailure(`${error.message} (${cause?.message ?? cause})`);
    throw error;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? `Stripe request failed (${response.status})`;
    const error = new Error(message);
    error.status = 502;
    error.publicMessage = "Le paiement est momentanément indisponible. Merci de réessayer dans quelques minutes.";
    recordFailure(message);
    throw error;
  }
  lastFailure = null;
  return data;
}

// Stripe a renommé les modes d'interface : `embedded_page` (actuel) remplace
// `embedded`. On envoie le nom actuel, et on retombe sur l'ancien si le compte
// est épinglé à une version d'API antérieure.
const EMBEDDED_UI_MODES = ["embedded_page", "embedded"];

export async function createEmbeddedCheckoutSession({ amountCents, label }) {
  const config = stripeConfiguration();
  if (!config) {
    const error = new Error("Le paiement n'est pas configuré sur ce site.");
    error.status = 503;
    throw error;
  }
  const amount = Math.round(Number(amountCents));
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT_CENTS) {
    const error = new Error("Montant invalide : la lecture se règle à partir de 5 €.");
    error.status = 400;
    throw error;
  }
  if (amount > MAX_AMOUNT_CENTS) {
    const error = new Error("Montant trop élevé : le maximum accepté par Stripe est de 999 999,99 €.");
    error.status = 400;
    throw error;
  }
  // Paramètres configurés dans Checkout Studio (valeurs fixées par l'interface).
  // `mode` et les lignes de commande restent ceux du produit : paiement unique,
  // montant libre choisi par le client.
  const common = {
    mode: "payment",
    redirect_on_completion: "never",
    billing_address_collection: "auto",
    "phone_number_collection[enabled]": "false",
    "automatic_tax[enabled]": "false",
    allow_promotion_codes: "false",
    submit_type: "auto",
    integration_identifier: "hosted_web_0001",
    origin_context: "web",
    // Carte uniquement. Apple Pay et Google Pay sont des portefeuilles À
    // L'INTÉRIEUR du moyen « carte » : ils restent donc proposés quand le
    // navigateur les prend en charge. Link, lui, est un moyen distinct : il
    // s'affichait sur ordinateur et ne fonctionnait pas, on le retire.
    "payment_method_types[0]": "card",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": config.currency,
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": label ?? "Lecture symbolique Lastro"
  };

  // Deux raisons de réessayer, jamais plus : le nom du mode d'affichage et le
  // paramètre d'exclusion, qui exigent une version d'API récente. Une clé ou un
  // compte refusé ne se réessaie pas.
  // Ordre : on fait d'abord varier le nom du mode d'affichage (comportement
  // historique), puis on retire l'exclusion si la version d'API ne la connaît pas.
  const variantes = EMBEDDED_UI_MODES.map((uiMode) => ({
    ...common,
    "excluded_payment_method_types[0]": "link",
    ui_mode: uiMode
  }));
  for (const uiMode of EMBEDDED_UI_MODES) {
    variantes.push({ ...common, ui_mode: uiMode });
  }

  let data = null;
  let lastError = null;
  for (const body of variantes) {
    try {
      data = await stripeRequest(config, "/checkout/sessions", { method: "POST", body });
      break;
    } catch (error) {
      lastError = error;
      if (!/ui_mode|excluded_payment_method_types/i.test(error.message)) {
        throw error;
      }
    }
  }
  if (!data) {
    throw lastError;
  }
  return {
    sessionId: data.id,
    clientSecret: data.client_secret,
    amountCents: data.amount_total ?? amount,
    currency: data.currency ?? config.currency
  };
}

export async function retrieveCheckoutSession(sessionId) {
  const config = stripeConfiguration();
  if (!config) {
    const error = new Error("Le paiement n'est pas configuré sur ce site.");
    error.status = 503;
    throw error;
  }
  const id = String(sessionId ?? "").trim();
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
    const error = new Error("Session de paiement invalide.");
    error.status = 400;
    throw error;
  }
  return stripeRequest(config, `/checkout/sessions/${encodeURIComponent(id)}`);
}
