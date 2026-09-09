// Estimated API cost for LLM-generated dossier sections.
// Prices are public list prices in USD per 1M tokens; the authoritative number
// is the provider's billing page. Unknown models fall back to a conservative
// gpt-4o-mini-like price and are flagged as estimated.

const PRICES_USD_PER_M = Object.freeze({
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4": { in: 30, out: 60 } // legacy list price; only as fallback reference
});

export function priceTable() {
  return PRICES_USD_PER_M;
}

export function priceForModel(model) {
  const name = String(model ?? "").toLowerCase();
  if (name.startsWith("gpt-4o-mini") || name.startsWith("gpt-4.1-mini")) {
    return name.startsWith("gpt-4.1-mini") ? PRICES_USD_PER_M["gpt-4.1-mini"] : PRICES_USD_PER_M["gpt-4o-mini"];
  }
  if (name.startsWith("gpt-4.1")) {
    return PRICES_USD_PER_M["gpt-4.1"];
  }
  if (name.startsWith("gpt-4o")) {
    return PRICES_USD_PER_M["gpt-4o"];
  }
  if (name.startsWith("gpt-4")) {
    return PRICES_USD_PER_M["gpt-4"];
  }
  return PRICES_USD_PER_M["gpt-4o-mini"];
}

export function estimateUsageCost(model, promptTokens, completionTokens) {
  const prompt = Number(promptTokens ?? 0);
  const completion = Number(completionTokens ?? 0);
  if (!prompt && !completion) {
    return null;
  }
  const price = priceForModel(model);
  const usd = (prompt / 1e6) * price.in + (completion / 1e6) * price.out;
  return {
    model: model ?? null,
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: prompt + completion,
    usd: Math.round(usd * 1e6) / 1e6,
    estimated: true,
    note: "Estimation d'après les tarifs publics indicatifs ; la facture exacte se trouve sur le portail du fournisseur."
  };
}
