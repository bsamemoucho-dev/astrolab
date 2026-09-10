import test from "node:test";
import assert from "node:assert/strict";

import { approximateQueries, searchPlacesForEntryDetailed } from "../src/geo/placeResolver.mjs";

test("approximateQueries tolère une faute de frappe en fin de mot", () => {
  const candidates = approximateQueries("Marseile");
  assert.ok(candidates.includes("Marseil"));
  assert.ok(candidates.includes("Marsei"));
  assert.ok(!candidates.includes("Marseile"));
});

test("approximateQueries retire un dernier mot mal saisi", () => {
  const candidates = approximateQueries("Marseille Frnce");
  assert.ok(candidates.includes("Marseille"));
});

test("approximateQueries ignore les saisies trop courtes", () => {
  assert.deepEqual(approximateQueries("Pa"), []);
  assert.deepEqual(approximateQueries(""), []);
});

test("la recherche locale reste exacte (pas de repli approximatif)", async () => {
  const result = await searchPlacesForEntryDetailed("Paris, France");
  assert.equal(result.approximate, false);
  assert.equal(result.places.length, 1);
  assert.equal(result.places[0].timeZone, "Europe/Paris");
});

test("la recherche locale signale les homonymes", async () => {
  const result = await searchPlacesForEntryDetailed("Springfield");
  assert.equal(result.approximate, false);
  assert.equal(result.places.length, 2);
});
