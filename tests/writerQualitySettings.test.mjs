// Réglage de qualité du rédacteur, activable sans changer le défaut de production :
// ASTROLAB_LLM_REASONING_EFFORT (low par défaut). Aucun appel réseau.

import assert from "node:assert/strict";
import test from "node:test";

import { SOL_REASONING_EFFORT, solReasoningEffort } from "../src/deliverables/writers.mjs";

test("l'effort de raisonnement reste « low » par défaut et n'accepte que des valeurs connues", () => {
  assert.equal(SOL_REASONING_EFFORT, "low");
  assert.equal(solReasoningEffort({}), "low");
  assert.equal(solReasoningEffort({ ASTROLAB_LLM_REASONING_EFFORT: "medium" }), "medium");
  assert.equal(solReasoningEffort({ ASTROLAB_LLM_REASONING_EFFORT: " HIGH " }), "high");
  assert.equal(solReasoningEffort({ ASTROLAB_LLM_REASONING_EFFORT: "maximum" }), "low");
});
