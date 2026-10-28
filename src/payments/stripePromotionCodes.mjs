// Native single-use Stripe promotions. Only lookup is performed here: Stripe
// remains responsible for applying and limiting redemption at Checkout.
// This endpoint is pinned independently from the existing Checkout integration.
import { normalizePromoCode, quotePrice } from "./pricing.mjs";
import { stripeConfiguration } from "./stripe.mjs";

export const STRIPE_PROMOTION_API_VERSION = "2024-06-20";
export const READING_DISCOUNT_PURPOSE = "lastro_reading_discount";
const STRIPE_PROMOTIONS_URL = "https://api.stripe.com/v1/promotion_codes";
const BASE_CENTS = 1800;
const DISCOUNT_CENTS = 1000;
const BATCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function providerUnavailable() {
  const error = new Error("La vérification du code promotionnel est momentanément indisponible.");
  error.status = 503;
  error.code = "PROMOTION_PROVIDER_UNAVAILABLE";
  error.publicMessage = error.message;
  return error;
}

function emptyMap(value) {
  return value == null || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
}

function noProductRestriction(value) {
  // In Stripe API 2024-06-20, applies_to is optional and is omitted for an
  // unrestricted coupon, even when explicitly requested through expansion.
  return value == null || (value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => key === "products")
    && Array.isArray(value.products) && value.products.length === 0);
}

function compatibleCouponCurrencies(value) {
  return emptyMap(value) || (typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 1 && value.eur?.amount_off === DISCOUNT_CENTS);
}

function eligiblePromotion(promotion, code, live) {
  if (!promotion || promotion.object !== "promotion_code"
    || !/^promo_[A-Za-z0-9_]+$/.test(promotion.id ?? "")
    || typeof promotion.code !== "string" || promotion.code.toLowerCase() !== code
    || promotion.active !== true || promotion.livemode !== live
    || promotion.max_redemptions !== 1 || promotion.times_redeemed !== 0
    || promotion.expires_at != null || promotion.customer != null || promotion.customer_account != null
    || promotion.metadata?.purpose !== READING_DISCOUNT_PURPOSE
    || !BATCH_ID.test(promotion.metadata?.batch_id ?? "")) return false;
  const restrictions = promotion.restrictions;
  if (!restrictions || typeof restrictions !== "object" || Array.isArray(restrictions)
    || restrictions.first_time_transaction !== false
    || restrictions.minimum_amount != null || restrictions.minimum_amount_currency != null
    || !emptyMap(restrictions.currency_options)) return false;
  const coupon = promotion.coupon;
  if (!coupon || coupon.object !== "coupon" || typeof coupon.id !== "string" || !coupon.id
    || coupon.valid !== true || coupon.livemode !== live
    || coupon.amount_off !== DISCOUNT_CENTS || coupon.currency !== "eur"
    || coupon.percent_off != null || coupon.duration !== "once"
    || coupon.redeem_by != null || !compatibleCouponCurrencies(coupon.currency_options)
    || !noProductRestriction(coupon.applies_to)
    || coupon.metadata?.purpose !== READING_DISCOUNT_PURPOSE
    || coupon.metadata?.batch_id !== promotion.metadata.batch_id
    || !Number.isInteger(coupon.max_redemptions) || coupon.max_redemptions < 1 || coupon.max_redemptions > 50
    || !Number.isInteger(coupon.times_redeemed) || coupon.times_redeemed < 0
    || coupon.times_redeemed >= coupon.max_redemptions) return false;
  return true;
}

export async function resolvePromotionQuote({ promoCode, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const quote = quotePrice({ promoCode, env });
  // Existing public/private environment offers retain their exact semantics.
  // No native lookup for empty, malformed, invitation or legacy-length codes.
  const code = normalizePromoCode(promoCode);
  if (quote.valid || quote.reason !== "unknown" || !/^[a-z0-9]{12}$/.test(code)) return quote;
  // This batch is explicitly 18 EUR less 10 EUR. Do not silently change its
  // commercial terms if a later deployment uses another price or currency.
  if (quote.baseCents !== BASE_CENTS || quote.currency !== "eur") return quote;
  const config = stripeConfiguration(env);
  if (!config || typeof fetchImpl !== "function") throw providerUnavailable();
  const { secretKey } = config;
  const url = new URL(STRIPE_PROMOTIONS_URL);
  url.searchParams.set("code", code);
  url.searchParams.set("active", "true");
  // A generic, unrestricted code is unique. Refuse ambiguous customer-specific
  // duplicates instead of choosing one. The pinned API embeds coupon directly.
  url.searchParams.set("limit", "2");
  // Request optional restrictions where available. Configured restrictions are
  // refused; the pinned API may still omit an unset optional applies_to field.
  url.searchParams.append("expand[]", "data.coupon.applies_to");
  url.searchParams.append("expand[]", "data.coupon.currency_options");
  let data;
  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${secretKey}`, "Stripe-Version": STRIPE_PROMOTION_API_VERSION },
      signal: AbortSignal.timeout(10000)
    });
    if (!response?.ok) throw providerUnavailable();
    data = await response.json();
  } catch {
    // Provider text, request URLs, credentials and customer-facing codes must
    // never enter an error/log, including the nested cause of a network failure.
    throw providerUnavailable();
  }
  if (!data || data.object !== "list" || !Array.isArray(data.data)
    || typeof data.has_more !== "boolean" || data.data.length > 2) throw providerUnavailable();
  if (data.has_more || data.data.length !== 1) return quote;
  const promotion = data.data[0];
  if (!eligiblePromotion(promotion, code, secretKey.includes("_live_"))) return quote;
  return {
    ...quote,
    discountCents: DISCOUNT_CENTS,
    totalCents: BASE_CENTS - DISCOUNT_CENTS,
    appliedCode: code,
    appliedIsPublic: false,
    valid: true,
    reason: "applied",
    // Server-only field. publicQuote must remove it before serialisation.
    stripePromotionCodeId: promotion.id
  };
}
