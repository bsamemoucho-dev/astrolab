// Prix de la lecture : une seule formule, un code de lancement.
//
// Convention versionnée `lastro-pricing@1.0.0`. Le prix est décidé par le
// SERVEUR, jamais par le client : le navigateur n'envoie qu'un code promo, et le
// montant transmis à Stripe est recalculé ici. Un montant glissé dans la requête
// n'est pas corrigé — il n'est même pas lu.
//
// Le code de lancement est PUBLIC : il est pré-rempli dans le formulaire, donc
// visible par tout le monde. Ce n'est pas un secret, et il ne doit pas en être un
// (un secret pré-rempli dans une page ne serait plus un secret). Ce qui doit être
// solide, c'est le calcul du prix, pas la discrétion du code.
//
// Pourquoi pas un coupon Stripe : cela obligerait à créer le coupon ET le code
// promotionnel dans le tableau de bord Stripe avant que le site fonctionne — une
// dépendance invisible qui casse le tunnel le jour où elle manque. Ici l'offre est
// dans le dépôt, versionnée, testée, et le reçu Stripe porte le montant réellement
// payé.

import { MAX_AMOUNT_CENTS, MIN_AMOUNT_CENTS } from "./stripe.mjs";

export const LASTRO_PRICING_VERSION = "lastro-pricing@1.0.0";

// 25 € — offre de lancement à 15 € avec le code ci-dessous.
export const DEFAULT_PRICE_CENTS = 2500;
export const DEFAULT_PROMO_CODE = "bessbousse10";
export const DEFAULT_PROMO_DISCOUNT_CENTS = 1000;

// Mention portée sur la ligne de commande Stripe, dans la langue du client.
const OFFER_LABELS = {
  fr: "offre de lancement",
  en: "launch offer",
  de: "Einführungsangebot",
  es: "oferta de lanzamiento",
  it: "offerta di lancio",
  pt: "oferta de lançamento",
  no: "lanseringstilbud",
  da: "lanceringstilbud",
  nl: "introductieaanbieding"
};

export const LINE_LABEL = "Lecture symbolique personnalisée (Lastro)";

function entier(valeur, defaut) {
  const nombre = Number(valeur);
  return Number.isFinite(nombre) ? Math.round(nombre) : defaut;
}

// Un code se compare sans espaces ni casse : « BessBousse10 » et « bessbousse10 »
// sont le même code. Les tirets et espaces saisis par erreur sont retirés.
export function normalizePromoCode(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "");
}

// Catalogue effectif : prix, code de l'offre en cours, remise. Les variables
// d'environnement permettent de changer l'offre sans toucher au code.
export function pricingCatalogue(env = process.env) {
  const brut = entier(env.ASTROLAB_PRICE_CENTS, DEFAULT_PRICE_CENTS);
  // Un prix hors des bornes que Stripe accepte est ramené dans les bornes : on ne
  // laisse pas une variable d'environnement rendre le paiement impossible.
  const baseCents = Math.min(Math.max(brut, MIN_AMOUNT_CENTS), MAX_AMOUNT_CENTS);
  const code = normalizePromoCode(env.ASTROLAB_PROMO_CODE ?? DEFAULT_PROMO_CODE);
  const remiseDemandee = entier(env.ASTROLAB_PROMO_DISCOUNT_CENTS, DEFAULT_PROMO_DISCOUNT_CENTS);
  // La remise ne peut ni dépasser le prix, ni faire tomber le total sous le
  // minimum accepté par Stripe. Une remise nulle n'est pas une offre : on
  // n'annonce pas « −0 € ».
  const remise = Math.min(Math.max(remiseDemandee, 0), Math.max(baseCents - MIN_AMOUNT_CENTS, 0));
  return {
    version: LASTRO_PRICING_VERSION,
    currency: (env.STRIPE_CURRENCY?.trim() || "eur").toLowerCase(),
    baseCents,
    promo: code && remise > 0 ? { code, discountCents: remise } : null
  };
}

// Ce que le site a le droit de savoir : le prix, le code pré-rempli, et le total
// qui sera réellement débité.
export function publicPricing(env = process.env) {
  const catalogue = pricingCatalogue(env);
  const remise = catalogue.promo?.discountCents ?? 0;
  return {
    version: catalogue.version,
    currency: catalogue.currency,
    baseCents: catalogue.baseCents,
    promoCode: catalogue.promo?.code ?? null,
    promoDiscountCents: remise,
    totalCents: catalogue.baseCents - remise
  };
}

// Devis pour un code donné. `reason` dit toujours pourquoi la remise s'applique
// ou non — le site ne devine jamais, il affiche ce que le serveur a calculé.
export function quotePrice({ promoCode, env = process.env } = {}) {
  const catalogue = pricingCatalogue(env);
  const demande = normalizePromoCode(promoCode);
  const vide = demande === "";
  const applique = Boolean(catalogue.promo) && !vide && demande === catalogue.promo.code;
  const discountCents = applique ? catalogue.promo.discountCents : 0;
  return {
    version: catalogue.version,
    currency: catalogue.currency,
    baseCents: catalogue.baseCents,
    discountCents,
    totalCents: catalogue.baseCents - discountCents,
    promoCode: catalogue.promo?.code ?? null,
    valid: applique,
    reason: applique ? "applied" : vide ? "empty" : "unknown"
  };
}

// Ligne de commande Stripe : le client doit lire, sur son reçu, ce qu'il a payé
// et pourquoi. La remise est donc écrite noir sur blanc.
export function checkoutLineLabel({ quote, language } = {}) {
  const code = String(language ?? "fr").slice(0, 2).toLowerCase();
  const offre = OFFER_LABELS[code] ?? OFFER_LABELS.en;
  const euros = (centimes) => `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
  if (!quote || !quote.discountCents) {
    return LINE_LABEL;
  }
  return `${LINE_LABEL} — ${euros(quote.baseCents)} moins ${euros(quote.discountCents)} (${offre})`;
}
