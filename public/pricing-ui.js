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
