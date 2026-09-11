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

import { MAX_AMOUNT_CENTS, MIN_AMOUNT_CENTS as STRIPE_MINIMUM_CENTS } from "./stripe.mjs";

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
  const { appliedCode: _code, appliedIsPublic: _prive, ...reste } = quote;
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

// Un paiement prouve qu'on a payé — pas qu'on a payé CETTE lecture. Stripe a une
// seule clé pour tout le compte : une session payée pour un autre produit, ou un
// lien de paiement créé à la main dans le tableau de bord, ne doit pas ouvrir une
// lecture. On vérifie donc le montant, la devise, et la marque du produit.
//
// Renvoie `null` quand la session est acceptée, sinon le motif du refus.
export function checkoutSessionProblem(session, env = process.env) {
  const catalogue = pricingCatalogue(env);
  const montant = Number(session?.amount_total);
  // Tous les tarifs atteignables, codes privés compris : sinon une lecture payée
  // 1 € avec un code serait refusée comme « montant inattendu ».
  const legitimes = new Set(legitimateTotals(env));
  if (!Number.isFinite(montant) || !legitimes.has(montant)) {
    return "amount_mismatch";
  }
  const devise = String(session?.currency ?? "").toLowerCase();
  if (devise && devise !== catalogue.currency) {
    return "currency_mismatch";
  }
  const marque = session?.metadata?.purpose ?? null;
  // Absente : session créée avant cette vérification — le montant suffit à la
  // reconnaître, et refuser casserait la reprise d'un client déjà débité.
  // Présente et différente : c'est explicitement un autre produit, on refuse.
  if (marque && marque !== READING_PURPOSE) {
    return "foreign_session";
  }
  return null;
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
