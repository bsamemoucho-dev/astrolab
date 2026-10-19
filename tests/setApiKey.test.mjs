// Enregistrement d'une clé API : normalisation, refus des saisies douteuses,
// remplacement idempotent. Ces tests ne manipulent aucune clé réelle.

import assert from "node:assert/strict";
import test from "node:test";

import {
  ecrireVariable,
  empreinte,
  nettoyerValeur,
  validerValeur
} from "../tools/set-api-key.mjs";

test("une clé collée est nettoyée de ses guillemets, espaces et retours ligne", () => {
  assert.equal(nettoyerValeur('  "sk-ant-abc123"  '), "sk-ant-abc123");
  assert.equal(nettoyerValeur("'sk-ant-abc123'"), "sk-ant-abc123");
  assert.equal(nettoyerValeur("sk-ant-abc123\r\n"), "sk-ant-abc123");
  assert.equal(nettoyerValeur("  "), "");
});

test("un collage avec marqueurs de terminal est nettoyé", () => {
  // Les terminaux modernes entourent un collage de ESC[200~ … ESC[201~.
  const colle = "\u001b[200~sk-ant-api03-" + "a".repeat(40) + "\u001b[201~";
  assert.equal(nettoyerValeur(colle), "sk-ant-api03-" + "a".repeat(40));
});

test("une saisie douteuse est refusée avant toute écriture", () => {
  assert.match(validerValeur(""), /vide/);
  assert.match(validerValeur("sk-ant abc def"), /espace/);
  assert.match(validerValeur("sk-ant-court"), /trop courte/);
  assert.match(validerValeur("AIzaSy" + "x".repeat(30), { prefixe: "sk-ant-" }), /sk-ant-/);
  assert.equal(validerValeur("sk-ant-" + "x".repeat(40), { prefixe: "sk-ant-" }), null);
});

test("l'écriture remplace la variable existante sans dupliquer ni écraser le reste", () => {
  const base = "ASTROLAB_LLM_MODEL=gpt-4o-mini\nANTHROPIC_API_KEY=ancienne\nASTROLAB_ENABLE_COMMERCE=0\n";
  const ecrit = ecrireVariable(base, "ANTHROPIC_API_KEY", "sk-ant-nouvelle");
  assert.equal(ecrit.match(/ANTHROPIC_API_KEY=/g).length, 1, "la variable doit apparaître une seule fois");
  assert.match(ecrit, /sk-ant-nouvelle/);
  assert.doesNotMatch(ecrit, /ancienne/);
  assert.match(ecrit, /ASTROLAB_LLM_MODEL=gpt-4o-mini/);
  assert.match(ecrit, /ASTROLAB_ENABLE_COMMERCE=0/);
  // Idempotent : réécrire la même valeur ne change plus rien.
  assert.equal(ecrireVariable(ecrit, "ANTHROPIC_API_KEY", "sk-ant-nouvelle"), ecrit);
});

test("l'empreinte identifie la clé sans la révéler", () => {
  const cle = "sk-ant-" + "z".repeat(40);
  const marque = empreinte(cle);
  assert.equal(marque.length, 10);
  assert.doesNotMatch(marque, /sk-ant/);
  assert.equal(empreinte(cle), marque);
  assert.notEqual(empreinte("sk-ant-" + "y".repeat(40)), marque);
});
