// Plafond de dépense des appels LLM (préversion, et tout service qui le demande).
//
// Pourquoi ce module : les plafonds existants (budget de mots, de tokens) bornent
// la TAILLE d'une réponse, pas la facture. Une préversion ouverte à des testeurs
// pouvait donc enchaîner des dizaines de dossiers sans qu'aucun mécanisme ne
// dise « stop, on a dépensé ce qui était prévu ».
//
// Fonctionnement :
//   ASTROLAB_LLM_BUDGET_USD=0.50          plafond cumulé, en dollars (0 = pas de plafond)
//   ASTROLAB_LLM_BUDGET_PATH=/var/data/llm-budget.json   registre (défaut : à côté de la base)
//
// Avant chaque appel, le coût maximal est estimé (prompt + plafond de tokens de
// sortie) et comparé au registre ; si l'appel suivant ferait dépasser le plafond,
// il est refusé AVANT le réseau. Après l'appel, la dépense réelle lue dans `usage`
// est ajoutée au registre. Le registre vit sur le disque persistant : un
// redémarrage ne remet pas le compteur à zéro.
//
// Sans ASTROLAB_LLM_BUDGET_USD, ce module ne fait rien : production inchangée.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { estimateUsageCost, priceForModel } from "../deliverables/cost.mjs";

const LEDGER_VERSION = "lastro-llm-budget@1";
const DEFAULT_OUTPUT_TOKENS = 900;

export function llmBudgetUsd() {
  const raw = process.env.ASTROLAB_LLM_BUDGET_USD;
  if (raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 1e6) / 1e6;
}

export function llmBudgetPath() {
  const explicit = String(process.env.ASTROLAB_LLM_BUDGET_PATH ?? "").trim();
  if (explicit) {
    return resolve(explicit);
  }
  const dbPath = String(process.env.ASTROLAB_DB_PATH ?? "").trim() || join(process.cwd(), "data/astrolab.json");
  return join(dirname(resolve(dbPath)), "llm-budget.json");
}

export function readLlmBudgetLedger(filePath = llmBudgetPath()) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    const spent = Number(parsed?.spentUsd);
    return {
      version: String(parsed?.version ?? LEDGER_VERSION),
      spentUsd: Number.isFinite(spent) && spent > 0 ? Math.round(spent * 1e6) / 1e6 : 0,
      calls: Number.isFinite(Number(parsed?.calls)) ? Number(parsed.calls) : 0,
      updatedAt: parsed?.updatedAt ?? null
    };
  } catch {
    return { version: LEDGER_VERSION, spentUsd: 0, calls: 0, updatedAt: null };
  }
}

function writeLedger(ledger, filePath) {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`);
  renameSync(temporary, filePath); // écriture atomique : jamais de registre tronqué
}

export function estimateCallCostUsd({ model, promptChars, outputTokens, promptTokensUpperBound } = {}) {
  const promptTokens = Number.isFinite(promptTokensUpperBound) ? Math.max(0, Math.ceil(promptTokensUpperBound)) : Math.ceil(Math.max(0, Number(promptChars ?? 0)) / 4);
  const requestedOutput = Number(outputTokens) > 0 ? Number(outputTokens) : DEFAULT_OUTPUT_TOKENS;
  const price = priceForModel(model);
  const usd = (promptTokens / 1e6) * price.in + (requestedOutput / 1e6) * price.out;
  return { promptTokens, outputTokens: requestedOutput, usd: Math.round(usd * 1e6) / 1e6 };
}

export function llmBudgetState() {
  const capUsd = llmBudgetUsd();
  if (capUsd === null) {
    return null;
  }
  const ledger = readLlmBudgetLedger();
  return {
    enabled: true,
    capUsd,
    spentUsd: ledger.spentUsd,
    remainingUsd: Math.max(0, Math.round((capUsd - ledger.spentUsd) * 1e6) / 1e6),
    calls: ledger.calls
  };
}

/**
 * À appeler AVANT la requête réseau. Lève une erreur 503 explicite quand le
 * plafond serait dépassé : le message dit combien a été dépensé et sur quoi
 * agir, plutôt qu'un échec de génération opaque.
 */
export function assertLlmBudget({ model, promptChars, outputTokens, promptTokensUpperBound } = {}) {
  const capUsd = llmBudgetUsd();
  if (capUsd === null) {
    return null;
  }
  const ledger = readLlmBudgetLedger();
  const estimate = estimateCallCostUsd({ model, promptChars, outputTokens, promptTokensUpperBound });
  if (ledger.spentUsd + estimate.usd > capUsd) {
    const error = new Error(
      `Plafond de dépense LLM atteint sur ce service : ${ledger.spentUsd.toFixed(4)} $ dépensés sur ${capUsd.toFixed(2)} $ prévus. ` +
        "Aucun appel supplémentaire n'est effectué. Pour continuer un test, augmentez ASTROLAB_LLM_BUDGET_USD ; pour arrêter les frais, retirez la clé."
    );
    error.status = 503;
    error.code = "llm_budget_exhausted";
    error.budget = { capUsd, spentUsd: ledger.spentUsd, estimatedNextCallUsd: estimate.usd };
    throw error;
  }
  return { capUsd, spentUsd: ledger.spentUsd, estimate };
}

/** À appeler APRÈS un appel réussi : enregistre la dépense réelle. */
export function recordLlmSpend({ model, usage, promptChars, outputTokens } = {}) {
  const capUsd = llmBudgetUsd();
  if (capUsd === null) {
    return null;
  }
  const ledger = readLlmBudgetLedger();
  const cost =
    estimateUsageCost(model, usage?.promptTokens, usage?.completionTokens)?.usd ??
    estimateCallCostUsd({ model, promptChars, outputTokens }).usd;
  const next = {
    version: LEDGER_VERSION,
    spentUsd: Math.round((ledger.spentUsd + cost) * 1e6) / 1e6,
    calls: ledger.calls + 1,
    updatedAt: new Date().toISOString()
  };
  try {
    writeLedger(next, llmBudgetPath());
  } catch (error) {
    // Ne jamais perdre une lecture pour un compteur : on le signale, on continue.
    console.warn(`[Lastro] registre de dépense LLM non inscriptible (${error.code ?? error.message}) : la lecture continue.`);
  }
  return { ...next, capUsd, lastCallUsd: cost };
}
