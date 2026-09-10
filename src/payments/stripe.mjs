// Paiement Stripe — Checkout intégré (Embedded), montant libre.
//
// Aucune dépendance npm : on appelle directement l'API REST Stripe avec fetch.
// Configuration par variables d'environnement :
//   STRIPE_SECRET_KEY      (sk_live_… / sk_test_…)  — jamais exposée au navigateur
//   STRIPE_PUBLISHABLE_KEY (pk_live_… / pk_test_…)  — publique, envoyée au client
//   STRIPE_CURRENCY        (optionnel, par défaut "eur")

const STRIPE_API = "https://api.stripe.com/v1";

export function stripeConfiguration() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
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
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body: body ? new URLSearchParams(body).toString() : undefined
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? `Stripe request failed (${response.status})`;
    const error = new Error(message);
    error.status = 502;
    throw error;
  }
  return data;
}

export async function createEmbeddedCheckoutSession({ amountCents, label }) {
  const config = stripeConfiguration();
  if (!config) {
    const error = new Error("Le paiement n'est pas configuré sur ce site.");
    error.status = 503;
    throw error;
  }
  const amount = Math.round(Number(amountCents));
  if (!Number.isFinite(amount) || amount < 50 || amount > 500000) {
    const error = new Error("Montant invalide : minimum 0,50 €.");
    error.status = 400;
    throw error;
  }
  const data = await stripeRequest(config, "/checkout/sessions", {
    method: "POST",
    body: {
      mode: "payment",
      ui_mode: "embedded",
      redirect_on_completion: "never",
      "automatic_payment_methods[enabled]": "true",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": config.currency,
      "line_items[0][price_data][unit_amount]": String(amount),
      "line_items[0][price_data][product_data][name]": label ?? "Lecture symbolique Lastro"
    }
  });
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
