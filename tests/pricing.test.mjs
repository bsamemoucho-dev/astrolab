// Prix de la lecture : une seule formule à prix normal.
//
// Ce qui est mesuré ici, et qui protège l'argent du client comme celui du
// produit : le prix est décidé par le serveur, les codes privés sont calculés, et aucun
// montant venu du navigateur n'est jamais utilisé.

import assert from "node:assert/strict";
import test from "node:test";

import {
  checkoutLineLabel,
  DEFAULT_PROMO_CODE,
  LASTRO_PRICING_VERSION,
  normalizePromoCode,
  pricingCatalogue,
  publicPricing,
  quotePrice
} from "../src/payments/pricing.mjs";

test("le prix est fixe : 3 €, sans code public par défaut", () => {
  const catalogue = pricingCatalogue({});
  assert.equal(catalogue.version, LASTRO_PRICING_VERSION);
  assert.equal(catalogue.baseCents, 300);
  assert.equal(DEFAULT_PROMO_CODE, "");
  assert.equal(catalogue.promo, null);

  const sans = quotePrice({ promoCode: "", env: {} });
  assert.equal(sans.valid, false);
  assert.equal(sans.reason, "empty");
  assert.equal(sans.totalCents, 300);

  const faux = quotePrice({ promoCode: "bessbousse11", env: {} });
  assert.equal(faux.valid, false);
  assert.equal(faux.reason, "unknown");
  assert.equal(faux.totalCents, 300, "un code inconnu ne donne aucune remise");
});

test("les codes privés se comparent sans casse ni espaces", () => {
  const env = { ASTROLAB_PROMO_CODES: "BessBousse10=100" };
  for (const saisi of ["bessbousse10", "BessBousse10", " BESSBOUSSE10 ", "bess bousse 10", "bess-bousse-10", "bessbousse10\n"]) {
    const quote = quotePrice({ promoCode: saisi, env });
    assert.equal(quote.valid, true, `« ${saisi} » doit être reconnu`);
    assert.equal(quote.totalCents, 100);
  }
  assert.equal(normalizePromoCode("Bess Bousse-10"), "bessbousse10");
  // Un code vide n'est pas un code inconnu : le message affiché n'est pas le même.
  assert.equal(quotePrice({ promoCode: "   ", env: {} }).reason, "empty");
  assert.equal(quotePrice({}).reason, "empty");
});

test("l'offre peut être changée par l'environnement, dans des bornes sûres", () => {
  const autre = publicPricing({ ASTROLAB_PRICE_CENTS: "4000", ASTROLAB_PROMO_CODE: "autre-code", ASTROLAB_PROMO_DISCOUNT_CENTS: "500" });
  assert.equal(autre.baseCents, 4000);
  assert.equal(autre.promoCode, "autrecode", "le code est normalisé aussi côté catalogue");
  assert.equal(autre.promoDiscountCents, 500);
  assert.equal(autre.totalCents, 3500);

  // La remise ne peut pas rendre le prix inférieur au minimum que Stripe accepte
  // (0,50 €) : en dessous, le client ne pourrait pas payer du tout.
  const enorme = publicPricing({ ASTROLAB_PRICE_CENTS: "2500", ASTROLAB_PROMO_CODE: "public", ASTROLAB_PROMO_DISCOUNT_CENTS: "999999" });
  assert.equal(enorme.baseCents, 2500);
  assert.equal(enorme.totalCents, 50);

  // Un prix hors bornes est ramené dans les bornes : jamais de paiement impossible.
  // Le plancher est celui de Stripe (0,50 €), pas un prix produit : c'est ce qui
  // permet à un code promotionnel de facturer 1 €.
  assert.equal(publicPricing({ ASTROLAB_PRICE_CENTS: "10" }).baseCents, 50);
  assert.equal(publicPricing({ ASTROLAB_PRICE_CENTS: "999999999999" }).baseCents, 99999999);

  // Une remise nulle n'est pas une offre : on n'annonce pas « −0 € ».
  const sansOffre = publicPricing({ ASTROLAB_PROMO_DISCOUNT_CENTS: "0" });
  assert.equal(sansOffre.promoCode, null);
  assert.equal(sansOffre.promoDiscountCents, 0);
  assert.equal(quotePrice({ promoCode: DEFAULT_PROMO_CODE, env: { ASTROLAB_PROMO_DISCOUNT_CENTS: "0" } }).valid, false);

  // Un prix ou une remise illisible retombe sur le tarif par défaut.
  assert.equal(publicPricing({ ASTROLAB_PRICE_CENTS: "beaucoup" }).baseCents, 300);
  assert.equal(publicPricing({ ASTROLAB_PROMO_DISCOUNT_CENTS: "environ dix" }).promoDiscountCents, 0);
});

test("le reçu Stripe reste simple sans remise publique", () => {
  const plein = quotePrice({ promoCode: "", env: {} });
  const libelle = checkoutLineLabel({ quote: plein, language: "fr" });
  assert.doesNotMatch(libelle, /moins|offre/);
  assert.match(libelle, /Lecture symbolique personnalisée/);
});

// La partie affichée par le site se teste sans navigateur : la décision
// « quelle phrase pour ce devis » est extraite du DOM (public/pricing-ui.js).
test("le message affiché suit le devis, jamais l'inverse", async () => {
  const { fillTemplate, promoMessageKey, promoMessageState } = await import("../public/pricing-ui.js");

  const applique = { valid: true, reason: "applied", discountCents: 1000, totalCents: 1500 };
  const inconnu = { valid: false, reason: "unknown", discountCents: 0, totalCents: 2500 };
  const vide = { valid: false, reason: "empty", discountCents: 0, totalCents: 2500 };

  assert.equal(promoMessageKey(applique), "payPromoApplied");
  assert.equal(promoMessageState(applique), "ok");
  // Un devis valide ne dit jamais « code inconnu ».
  assert.notEqual(promoMessageKey(applique), "payPromoUnknown");
  assert.equal(promoMessageKey(inconnu), "payPromoUnknown");
  assert.equal(promoMessageState(inconnu), "ko");
  assert.equal(promoMessageKey(vide), "payPromoEmpty");
  assert.equal(promoMessageState(vide), "");
  // Un devis absent ne fait pas planter l'affichage.
  assert.equal(promoMessageKey(null), "payPromoEmpty");
  assert.equal(promoMessageState(undefined), "");

  // Les trous sont remplis, et un trou sans valeur reste visible plutôt que
  // d'afficher « undefined » au client.
  assert.equal(fillTemplate("Code appliqué : −{discount}.", { discount: "10,00 €" }), "Code appliqué : −10,00 €.");
  assert.equal(fillTemplate("Prix : {total}.", { total: "25,00 €" }), "Prix : 25,00 €.");
  assert.equal(fillTemplate("Aucun trou"), "Aucun trou");
  assert.equal(fillTemplate("Valeur {inconnue}", {}), "Valeur {inconnue}");
  assert.equal(fillTemplate(null), "");
});

// Les codes privés : un montant décidé par le serveur, jamais publié.
test("un code privé fixe le prix payé, sans apparaître dans la page", async () => {
  const { legitimateTotals, parsePrivateCodes, publicPricing, quotePrice } = await import("../src/payments/pricing.mjs");
  const env = { ASTROLAB_PROMO_CODES: "KDMjf87Gh=100" };

  // 1 € : le montant POSITIF est le prix payé, quel que soit le prix de base.
  const unEuro = quotePrice({ promoCode: "KDMjf87Gh", env });
  assert.equal(unEuro.valid, true);
  assert.equal(unEuro.totalCents, 100);
  assert.equal(unEuro.discountCents, 200);
  assert.equal(unEuro.appliedCode, "kdmjf87gh");
  assert.equal(unEuro.appliedIsPublic, false);
  // Il se compare comme les autres : sans casse ni espaces.
  assert.equal(quotePrice({ promoCode: " kdm jf87gh ", env }).totalCents, 100);

  // Le dépôt est public : ce code ne doit sortir NI dans la configuration, NI
  // dans le code de l'offre annoncée.
  const publique = publicPricing(env);
  assert.equal(publique.promoCode, null);
  assert.equal(publique.promoDiscountCents, 0);
  assert.equal(publique.totalCents, 300);
  const texte = JSON.stringify(publique);
  assert.doesNotMatch(texte, /kdmjf87gh/i, "le code privé ne doit pas figurer dans la configuration publique");
  assert.doesNotMatch(texte, /100\b/, "ni son montant");

  // Sans la variable d'environnement, le code n'existe pas : il est refusé.
  assert.equal(quotePrice({ promoCode: "KDMjf87Gh", env: {} }).reason, "unknown");
  assert.equal(quotePrice({ promoCode: "KDMjf87Gh", env: {} }).totalCents, 300);
});

test("un code privé peut aussi être une remise, et reste au-dessus du plancher", async () => {
  const { legitimateTotals, quotePrice } = await import("../src/payments/pricing.mjs");
  // Montant négatif = remise.
  assert.equal(quotePrice({ promoCode: "AMI", env: { ASTROLAB_PROMO_CODES: "AMI=-1000" } }).totalCents, 50);
  // Plusieurs codes à la fois, séparés par des virgules.
  const env = { ASTROLAB_PROMO_CODES: "KDMjf87Gh=100,AMI=-1000,CADEAU=-999999" };
  assert.equal(quotePrice({ promoCode: "KDMjf87Gh", env }).totalCents, 100);
  assert.equal(quotePrice({ promoCode: "AMI", env }).totalCents, 50);
  // Un code qui descendrait sous 0,50 € est ramené au minimum que Stripe accepte,
  // sinon le client ne pourrait pas payer du tout.
  assert.equal(quotePrice({ promoCode: "CADEAU", env }).totalCents, 50);
  // Une entrée illisible est ignorée, pas devinée.
  const bancal = { ASTROLAB_PROMO_CODES: "=100,SANSMONTANT,VIDE=,OK=200" };
  assert.equal(quotePrice({ promoCode: "SANSMONTANT", env: bancal }).reason, "unknown");
  assert.equal(quotePrice({ promoCode: "OK", env: bancal }).totalCents, 200);
});

test("tous les tarifs atteignables sont reconnus comme légitimes", async () => {
  const { checkoutSessionProblem, legitimateTotals } = await import("../src/payments/pricing.mjs");
  const env = { ASTROLAB_PROMO_CODES: "KDMjf87Gh=100" };
  assert.deepEqual(legitimateTotals(env), [100, 300]);

  const session = (montant) => ({ payment_status: "paid", amount_total: montant, currency: "eur", metadata: { purpose: "lastro_lecture" } });
  // Une lecture payée 1 € avec le code doit être reconnue : sinon le client
  // paierait puis se verrait refuser sa lecture.
  assert.equal(checkoutSessionProblem(session(100), env), null);
  assert.equal(checkoutSessionProblem(session(300), env), null);
  assert.equal(checkoutSessionProblem(session(2500), env), "amount_mismatch");
  assert.equal(checkoutSessionProblem(session(200), env), "amount_mismatch");
  // Sans le code configuré, 1 € n'est plus un montant légitime.
  assert.equal(checkoutSessionProblem(session(100), {}), "amount_mismatch");
});

test("le reçu distingue l'offre publique d'un code privé", async () => {
  const { checkoutLineLabel, quotePrice } = await import("../src/payments/pricing.mjs");
  const env = { ASTROLAB_PROMO_CODES: "KDMjf87Gh=100" };
  const prive = checkoutLineLabel({ quote: quotePrice({ promoCode: "KDMjf87Gh", env }), language: "fr" });
  assert.match(prive, /3,00 € moins 2,00 €/);
  assert.match(prive, /code promotionnel/);
  assert.doesNotMatch(prive, /kdmjf87gh/i, "le reçu ne nomme pas le code privé");
  const public_ = checkoutLineLabel({ quote: quotePrice({ promoCode: "PUBLIC", env: { ASTROLAB_PROMO_CODE: "PUBLIC", ASTROLAB_PROMO_DISCOUNT_CENTS: "100" } }), language: "fr" });
  assert.match(public_, /offre de lancement/);
  // La mention suit la langue du client.
  assert.match(checkoutLineLabel({ quote: quotePrice({ promoCode: "KDMjf87Gh", env }), language: "nl" }), /actiecode/);
});
