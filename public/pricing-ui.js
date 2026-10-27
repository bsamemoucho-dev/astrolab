// Ce que le site affiche du prix : la partie qui se teste sans navigateur.
//
// Le montant vient du serveur ; ici on décide seulement QUELLE phrase afficher
// pour un devis donné, et on remplit ses trous. Cette décision est extraite du DOM
// pour être mesurable : un devis valide ne doit jamais dire « code inconnu », et un
// code inconnu ne doit jamais annoncer une remise.

export function fillTemplate(modele, valeurs = {}) {
  return String(modele ?? "").replace(/\{(\w+)\}/g, (entier, cle) => (cle in valeurs ? String(valeurs[cle]) : entier));
}

// Clé de traduction du message affiché sous le champ du code.
export function promoMessageKey(quote) {
  if (quote?.valid) {
    return "payPromoApplied";
  }
  return quote?.reason === "unknown" ? "payPromoUnknown" : "payPromoEmpty";
}

// Classe du message : « ok » quand la remise s'applique, « ko » quand le code est
// refusé, rien quand il n'y a simplement pas de code.
export function promoMessageState(quote) {
  if (quote?.valid) {
    return "ok";
  }
  return quote?.reason === "unknown" ? "ko" : "";
}

// /api/config exposes pricing at the top level. Payment credentials and flags
// are a separate object and must never become the source of a displayed price.
export function publicPricingFromConfig(config) {
  const pricing = config?.pricing;
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)
      || !Number.isInteger(pricing.baseCents) || pricing.baseCents <= 0
      || !Number.isInteger(pricing.totalCents) || pricing.totalCents < 0
      || !Number.isInteger(pricing.promoDiscountCents) || pricing.promoDiscountCents < 0
      || pricing.totalCents + pricing.promoDiscountCents !== pricing.baseCents
      || typeof pricing.currency !== "string" || !/^[a-z]{3}$/i.test(pricing.currency)) {
    return null;
  }
  return pricing;
}
