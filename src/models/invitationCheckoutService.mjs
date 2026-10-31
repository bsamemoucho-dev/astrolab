import { requireInvitation, invitationPublicView } from "./emailInvitationService.mjs";
import { deliveryLink } from "./publicDeliveryService.mjs";
import { quotePrice, publicQuote, checkoutSessionProblem, LASTRO_PRICING_VERSION, READING_PURPOSE, checkoutLineLabel } from "../payments/pricing.mjs";
import { resolvePromotionQuoteById } from "../payments/stripePromotionCodes.mjs";
import { createEmbeddedCheckoutSession, retrieveCheckoutSession } from "../payments/stripe.mjs";

const fail = (code, message, status = 409) => { throw Object.assign(new Error(message), { code, status, expected: true }); };

export function freeInvitationQuote(env = process.env) {
  const base = quotePrice({ env });
  return { version: LASTRO_PRICING_VERSION, currency: base.currency, baseCents: base.baseCents,
    discountCents: base.baseCents, totalCents: 0, promoCode: null, valid: true, reason: "invitation" };
}

export async function resolveEmailInvitation(store, token, { baseUrl, resolvePromotion = resolvePromotionQuoteById, retrieveSession = retrieveCheckoutSession } = {}) {
  await store.load(); await store.queue;
  const state = await store.load(), entry = requireInvitation(state, token);
  const invitation = invitationPublicView(state, entry);
  if (entry.usedAt) {
    const delivery = state.publicReadings.find(row => row.id === entry.deliveryId);
    return { invitation: { ...invitation, quote: null,
      ...(delivery ? { delivery: { reference: delivery.reference, status: delivery.status,
        link: deliveryLink(delivery.token, baseUrl) } } : {}) } };
  }
  const checkoutSessionId = entry.checkoutSessionId ?? entry.checkout?.sessionId;
  if (entry.kind === "discount10" && checkoutSessionId) {
    const session = await retrieveSession(checkoutSessionId);
    if (session.id !== checkoutSessionId || session.metadata?.invitation_id !== entry.id
        || session.amount_total !== 800 || session.currency !== "eur" || checkoutSessionProblem(session)) {
      fail("INVITATION_CHECKOUT_MISMATCH", "Le paiement lié à cette invitation doit être vérifié.");
    }
    if (session.payment_status === "paid") {
      return { invitation: { ...invitation, checkoutSessionId, paymentConfirmed: true,
        quote: { version: LASTRO_PRICING_VERSION, baseCents: 1800, discountCents: 1000,
          totalCents: 800, currency: "eur", promoCode: null, valid: true, reason: "applied" } } };
    }
  }
  try {
    const quote = entry.kind === "free" ? freeInvitationQuote()
      : publicQuote(await resolvePromotion({ promotionCodeId: entry.stripePromotionCodeId }));
    return { invitation: { ...invitation, quote } };
  } catch (error) {
    if (error.code !== "INVITATION_DISCOUNT_UNAVAILABLE") throw error;
    return { invitation: { ...invitation, status: "unavailable", quote: null } };
  }
}

// The stable invitation ID gives an idempotent Stripe key even if a provider
// response is lost before the store transaction commits. No client chooses it.
export async function createInvitationCheckout(store, token, {
  expectedTotalCents, expectedCurrency, language,
  resolvePromotion = resolvePromotionQuoteById,
  createSession = createEmbeddedCheckoutSession, retrieveSession = retrieveCheckoutSession
} = {}) {
  if (expectedTotalCents !== 800 || expectedCurrency !== "eur") {
    fail("PRICING_CHANGED", "Vérifiez le montant de cette invitation avant de poursuivre.");
  }
  return store.transact(async state => {
    const entry = requireInvitation(state, token, { kind: "discount10", allowUsed: false });
    let attempt = Number.isSafeInteger(entry.checkout?.attempt) ? entry.checkout.attempt : 0;
    const sessionId = entry.checkout?.sessionId ?? entry.checkoutSessionId ?? null;
    if (sessionId) {
      const session = await retrieveSession(sessionId);
      if (session.id !== sessionId || session.metadata?.invitation_id !== entry.id || session.amount_total !== 800
          || session.currency !== "eur" || checkoutSessionProblem(session)) {
        fail("INVITATION_CHECKOUT_MISMATCH", "Le paiement lié à cette invitation doit être vérifié.");
      }
      if (session.status !== "expired") {
        if (typeof session.client_secret !== "string" || !session.client_secret) {
          fail("INVITATION_CHECKOUT_UNAVAILABLE", "Le paiement ne peut pas être repris pour le moment.", 503);
        }
        return { sessionId, clientSecret: session.client_secret, amountCents: session.amount_total, currency: session.currency };
      }
      if (session.payment_status === "paid") fail("INVITATION_CHECKOUT_MISMATCH", "Un paiement confirmé ne peut pas être remplacé.");
      attempt += 1;
    }
    const quote = await resolvePromotion({ promotionCodeId: entry.stripePromotionCodeId });
    if (!quote.valid || quote.baseCents !== 1800 || quote.totalCents !== 800 || quote.currency !== "eur"
        || quote.stripePromotionCodeId !== entry.stripePromotionCodeId) {
      fail("INVITATION_DISCOUNT_UNAVAILABLE", "Cette réduction n’est plus disponible. Aucun paiement n’a été ouvert.");
    }
    const result = await createSession({ amountCents: 800, baseAmountCents: 1800,
      stripePromotionCodeId: entry.stripePromotionCodeId,
      customerEmail: entry.recipientEmail,
      idempotencyKey: `lastro-invitation:${entry.id}:${attempt}`,
      label: checkoutLineLabel({ quote, language: language ?? entry.language }),
      metadata: { purpose: READING_PURPOSE, pricing: quote.version, pricing_base_cents: "1800",
        pricing_total_cents: "800", pricing_discount_cents: "1000", pricing_currency: "eur",
        promo_code: "none", invitation_id: entry.id } });
    if (!/^cs_[A-Za-z0-9_]+$/.test(result?.sessionId ?? "") || !result.clientSecret
        || result.amountCents !== 800 || result.currency !== "eur") {
      fail("INVITATION_CHECKOUT_MISMATCH", "Le paiement n’a pas pu être préparé avec cette invitation.", 502);
    }
    entry.checkout = { sessionId: result.sessionId, attempt, createdAt: new Date().toISOString() };
    entry.checkoutSessionId = result.sessionId;
    return result;
  });
}
