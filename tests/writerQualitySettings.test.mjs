// Réglage de qualité du rédacteur, modifiable sans redéployer de code :
// ASTROLAB_LLM_REASONING_EFFORT (high par défaut). Aucun appel réseau.

import assert from "node:assert/strict";
import test from "node:test";

import { completionTokenLimit, DEFAULT_MODEL, SOL_REASONING_EFFORT, solReasoningEffort, solRequestTimeoutMs } from "../src/deliverables/writers.mjs";

test("la marge de raisonnement suit l'effort, pour ne pas épuiser la limite avant le texte", () => {
  assert.equal(completionTokenLimit(DEFAULT_MODEL, 2000, "low"), 10192);
  assert.equal(completionTokenLimit(DEFAULT_MODEL, 2000, "medium"), 18384);
  assert.equal(completionTokenLimit(DEFAULT_MODEL, 2000, "high"), 34768);
  assert.equal(completionTokenLimit("autre-modele", 2000, "high"), 2000);
});

test("le délai par appel suit l'effort", () => {
  assert.equal(solRequestTimeoutMs("low"), 180000);
  assert.equal(solRequestTimeoutMs("medium"), 300000);
  assert.equal(solRequestTimeoutMs("high"), 420000);
});

test("l'effort de raisonnement est « high » par défaut et n'accepte que des valeurs connues", () => {
  assert.equal(SOL_REASONING_EFFORT, "high");
  assert.equal(solReasoningEffort({}), "high");
  assert.equal(solReasoningEffort({ ASTROLAB_LLM_REASONING_EFFORT: "low" }), "low");
  assert.equal(solReasoningEffort({ ASTROLAB_LLM_REASONING_EFFORT: "medium" }), "medium");
  assert.equal(solReasoningEffort({ ASTROLAB_LLM_REASONING_EFFORT: " HIGH " }), "high");
  assert.equal(solReasoningEffort({ ASTROLAB_LLM_REASONING_EFFORT: "maximum" }), "high");
});
