// Prix de la lecture : 18 EUR.
//
// Convention versionnée `lastro-pricing@1.1.0`. Le prix est décidé par le
// SERVEUR, jamais par le client : le navigateur n'envoie qu'un code promo, et le
// montant transmis à Stripe est recalculé ici. Un montant glissé dans la requête
// n'est pas corrigé — il n'est même pas lu.
//
// Le prix est dans le dépôt, versionné, testé, et le reçu Stripe porte le montant
// réellement payé. Les codes privés restent possibles via l'environnement, mais
// aucun code public n'est annoncé ni pré-rempli par défaut.

import { MAX_AMOUNT_CENTS, MIN_AMOUNT_CENTS as STRIPE_MINIMUM_CENTS } from "./stripe.mjs";

export const LASTRO_PRICING_VERSION = "lastro-pricing@1.1.0";
export const LEGACY_PRICING_VERSION = "lastro-pricing@1.0.0";

// 18 EUR — prix normal des nouvelles commandes.
export const DEFAULT_PRICE_CENTS = 1800;
export const DEFAULT_PROMO_CODE = "";
export const DEFAULT_PROMO_DISCOUNT_CENTS = 0;

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

// Les codes privés portent une autre mention : le client ne doit pas lire
// « offre de lancement » sur un code qui n'en est pas une.
const PRIVATE_LABELS = {
  fr: "code promotionnel",
  en: "promotional code",
  de: "Aktionscode",
  es: "código promocional",
  it: "codice promozionale",
  pt: "código promocional",
  no: "kampanjekode",
  da: "kampagnekode",
  nl: "actiecode"
};

// Marque apposée sur la session de paiement, et exigée pour la reconnaître.
export const READING_PURPOSE = "lastro_lecture";

export const LINE_LABEL = "Lecture symbolique personnalisée (Lastro)";

function entier(valeur, defaut) {
  if (valeur === null || valeur === undefined || (typeof valeur === "string" && valeur.trim() === "")) {
    return defaut;
  }
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

// Un code privé s'écrit « CODE=montant », plusieurs codes séparés par des virgules :
//   ASTROLAB_PROMO_CODES=KDMjf87Gh=100,AUTRE=-1000
// Montant POSITIF = le prix payé avec ce code (100 = 1 €) ; montant NÉGATIF = une
// remise (−1000 = 10 € de moins). Un code privé vit UNIQUEMENT dans
// l'environnement : il n'apparaît ni dans la page, ni dans /api/config, ni dans ce
// dépôt, qui est public.
export function parsePrivateCodes(spec) {
  const codes = [];
  for (const morceau of String(spec ?? "").split(",")) {
    const [brutCode, brutMontant] = morceau.split("=");
    const code = normalizePromoCode(brutCode);
    const montant = Number(String(brutMontant ?? "").trim());
    if (!code || !Number.isFinite(montant) || montant === 0) {
      continue;
    }
    codes.push({
      code,
      kind: montant < 0 ? "discount" : "price",
      amountCents: Math.abs(Math.round(montant)),
      isPublic: false
    });
  }
  return codes;
}

// Total réellement débité pour un code donné, jamais sous le minimum que Stripe
// accepte (0,50 €) et jamais au-dessus du plein tarif.
export function totalForCode(catalogue, entree) {
  if (!entree) {
    return catalogue.baseCents;
  }
  const brut = entree.kind === "price" ? entree.amountCents : catalogue.baseCents - entree.amountCents;
  return Math.min(Math.max(brut, STRIPE_MINIMUM_CENTS), catalogue.baseCents);
}

// Tous les montants qu'un paiement légitime peut porter : le plein tarif, le tarif
// de l'offre publique, et celui de chaque code privé. C'est cette liste qui permet
// de reconnaître une session payée comme étant bien la nôtre.
export function legitimateTotals(env = process.env) {
  const catalogue = pricingCatalogue(env);
  const totaux = new Set([catalogue.baseCents]);
  for (const entree of catalogue.codes) {
    totaux.add(totalForCode(catalogue, entree));
  }
  return [...totaux].sort((a, b) => a - b);
}

// Catalogue effectif : prix, offre publique, codes privés. Les variables
// d'environnement permettent de changer tout cela sans toucher au code.
export function pricingCatalogue(env = process.env) {
  const brut = entier(env.ASTROLAB_PRICE_CENTS, DEFAULT_PRICE_CENTS);
  // Un prix hors des bornes que Stripe accepte est ramené dans les bornes : on ne
  // laisse pas une variable d'environnement rendre le paiement impossible.
  const baseCents = Math.min(Math.max(brut, STRIPE_MINIMUM_CENTS), MAX_AMOUNT_CENTS);
  const code = normalizePromoCode(env.ASTROLAB_PROMO_CODE ?? DEFAULT_PROMO_CODE);
  const remiseDemandee = entier(env.ASTROLAB_PROMO_DISCOUNT_CENTS, DEFAULT_PROMO_DISCOUNT_CENTS);
  // La remise ne peut ni dépasser le prix, ni faire tomber le total sous le
  // minimum accepté par Stripe. Une remise nulle n'est pas une offre : on
  // n'annonce pas « −0 € ».
  const remise = Math.min(Math.max(remiseDemandee, 0), Math.max(baseCents - STRIPE_MINIMUM_CENTS, 0));
  const promo = code && remise > 0 ? { code, kind: "discount", amountCents: remise, isPublic: true } : null;
  return {
    version: LASTRO_PRICING_VERSION,
    currency: (env.STRIPE_CURRENCY?.trim() || "eur").toLowerCase(),
    baseCents,
    promo,
    codes: [...(promo ? [promo] : []), ...parsePrivateCodes(env.ASTROLAB_PROMO_CODES)]
  };
}

// Ce qu'un navigateur a le droit de savoir d'un devis : le prix, la remise, le
// code PUBLIC à pré-remplir. Jamais le code appliqué quand il est privé — sans
// quoi le point d'entrée public confirmerait un code qu'on veut discret.
export function publicQuote(quote) {
  const { appliedCode: _code, appliedIsPublic: _prive, stripePromotionCodeId: _stripePromotion, ...reste } = quote;
  return reste;
}

// Ce que le site a le droit de savoir : le prix, le code pré-rempli, et le total
// qui sera réellement débité.
export function publicPricing(env = process.env) {
  const catalogue = pricingCatalogue(env);
  // Les codes privés ne sortent JAMAIS d'ici : ni leur nom, ni leur montant.
  const remise = catalogue.promo ? catalogue.baseCents - totalForCode(catalogue, catalogue.promo) : 0;
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
  const entree = vide ? null : catalogue.codes.find((candidat) => candidat.code === demande) ?? null;
  const totalCents = totalForCode(catalogue, entree);
  return {
    version: catalogue.version,
    currency: catalogue.currency,
    baseCents: catalogue.baseCents,
    discountCents: catalogue.baseCents - totalCents,
    totalCents,
    // Le code affiché et pré-rempli reste celui de l'offre publique : un code
    // privé ne doit pas se retrouver dans la page.
    promoCode: catalogue.promo?.code ?? null,
    appliedCode: entree?.code ?? null,
    appliedIsPublic: Boolean(entree?.isPublic),
    valid: Boolean(entree),
    reason: entree ? "applied" : vide ? "empty" : "unknown"
  };
}

function metadataCents(value) {
  // Stripe returns metadata as strings. Refuse coercion, partial snapshots,
  // exponent notation and rounding: they are not a server price snapshot.
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= MAX_AMOUNT_CENTS ? parsed : null;
}

function existingDeliveryMatches(session, delivery, amount, currency) {
  return delivery?.freeAccess === false
    && typeof session?.id === "string" && session.id.length > 0
    && delivery.paymentSessionId === session.id
    && Number.isSafeInteger(delivery.amountCents) && delivery.amountCents === amount
    && typeof delivery.currency === "string" && delivery.currency.toLowerCase() === currency;
}

// Called after the server has retrieved the Stripe session and checked its
// paid status. A payment for another product, currency or unproved amount is
// not an entitlement. Returns null only when these remaining checks succeed.
export function checkoutSessionProblem(session, env = process.env, { existingDelivery = null } = {}) {
  const catalogue = pricingCatalogue(env);
  const montant = session?.amount_total;
  if (!Number.isSafeInteger(montant) || montant < STRIPE_MINIMUM_CENTS || montant > MAX_AMOUNT_CENTS) {
    return "amount_mismatch";
  }
  const devise = typeof session?.currency === "string" ? session.currency.toLowerCase() : "";
  if (devise !== catalogue.currency) {
    return "currency_mismatch";
  }
  const marque = session?.metadata?.purpose ?? null;
  if (marque !== null && marque !== READING_PURPOSE) {
    return "foreign_session";
  }

  const metadata = session?.metadata ?? {};
  if (typeof metadata !== "object" || Array.isArray(metadata)) return "price_snapshot_invalid";
  const hasVersion = Object.hasOwn(metadata, "pricing");
  const version = hasVersion ? metadata.pricing : null;
  if (hasVersion && ![LASTRO_PRICING_VERSION, LEGACY_PRICING_VERSION].includes(version)) {
    return "pricing_version_mismatch";
  }
  const snapshotFields = ["pricing_base_cents", "pricing_total_cents", "pricing_currency", "pricing_discount_cents"];
  const hasSnapshot = snapshotFields.some((key) => Object.hasOwn(metadata, key));

  if (version === LASTRO_PRICING_VERSION) {
    if (marque !== READING_PURPOSE) return "foreign_session";
    const base = metadataCents(metadata.pricing_base_cents);
    const total = metadataCents(metadata.pricing_total_cents);
    const discount = metadataCents(metadata.pricing_discount_cents);
    if (base === null || total === null || discount === null
      || base < STRIPE_MINIMUM_CENTS || total < STRIPE_MINIMUM_CENTS
      || total > base || discount !== base - total
      || typeof metadata.pricing_currency !== "string" || !/^[a-z]{3}$/.test(metadata.pricing_currency)) {
      return "price_snapshot_invalid";
    }
    if (metadata.pricing_currency !== devise) return "currency_mismatch";
    if (total !== montant) return "amount_mismatch";
    if (existingDelivery && !existingDeliveryMatches(session, existingDelivery, montant, devise)) return "delivery_mismatch";
    // An immutable server snapshot survives later PRICE changes. Currency and
    // product checks above still apply; client request fields never enter here.
    return null;
  }
  // A partial snapshot or one attached to another version must not fall through
  // to a cheaper legacy path, even when its total happens to be current.
  if (hasSnapshot) return "price_snapshot_invalid";

  if (existingDelivery) {
    // The record comes from the server store, not from the public request body.
    // A known paid order retains its original price without a second charge.
    return existingDeliveryMatches(session, existingDelivery, montant, devise) ? null : "delivery_mismatch";
  }
  if (version === LEGACY_PRICING_VERSION) {
    if (marque !== READING_PURPOSE) return "foreign_session";
    // Only the explicitly marked previous catalogue is eligible. Private codes
    // retain their configured semantics; 500 is never a global allowed amount.
    const historiques = new Set(legitimateTotals({ ...env, ASTROLAB_PRICE_CENTS: "500" }));
    return historiques.has(montant) ? null : "amount_mismatch";
  }
  // Unversioned sessions retain the current strict catalogue check. An old
  // 5 EUR total alone is not proof of an entitlement after the price changes.
  return new Set(legitimateTotals(env)).has(montant) ? null : "amount_mismatch";
}

// Ligne de commande Stripe : le client doit lire, sur son reçu, ce qu'il a payé
// et pourquoi. La remise est donc écrite noir sur blanc.
export function checkoutLineLabel({ quote, language } = {}) {
  const langue = String(language ?? "fr").slice(0, 2).toLowerCase();
  const table = quote?.appliedIsPublic === false ? PRIVATE_LABELS : OFFER_LABELS;
  const mention = table[langue] ?? table.en;
  const euros = (centimes) => `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
  if (!quote || !quote.discountCents) {
    return LINE_LABEL;
  }
  return `${LINE_LABEL} — ${euros(quote.baseCents)} moins ${euros(quote.discountCents)} (${mention})`;
}
