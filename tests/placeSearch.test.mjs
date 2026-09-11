import test from "node:test";
import assert from "node:assert/strict";

import {
  approximateQueries,
  resetPlaceCache,
  searchPlacesForEntryDetailed
} from "../src/geo/placeResolver.mjs";

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

test("une même recherche ne rappelle pas le service externe", async () => {
  // Sans cache, chaque frappe de chaque visiteur relançait un appel sortant vers
  // un service gratuit, et l'endpoint public s'en servait de relais.
  const originalFetch = globalThis.fetch;
  const appels = [];
  globalThis.fetch = async (url) => {
    appels.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ name: "Oulan-Bator", country: "Mongolie", latitude: 47.9, longitude: 106.9, timezone: "Asia/Ulaanbaatar" }]
      })
    };
  };
  try {
    resetPlaceCache();
    // Une saisie qui n'existe pas dans le gazetteer local : l'appel sortant a lieu.
    const premier = await searchPlacesForEntryDetailed("Ville-Inconnue-Du-Test");
    const apresPremier = appels.length;
    assert.ok(apresPremier > 0, "la première recherche doit interroger le service externe");

    const second = await searchPlacesForEntryDetailed("Ville-Inconnue-Du-Test");
    assert.equal(appels.length, apresPremier, "la seconde recherche doit être servie par le cache");
    assert.deepEqual(second.places, premier.places);

    // Casse et espaces ne créent pas une entrée de cache différente.
    await searchPlacesForEntryDetailed("  ville-inconnue-du-test  ");
    assert.equal(appels.length, apresPremier);

    // Le cache se vide sur demande (les tests ne doivent pas hériter l'un de l'autre).
    resetPlaceCache();
    await searchPlacesForEntryDetailed("Ville-Inconnue-Du-Test");
    assert.ok(appels.length > apresPremier, "après reset, le service externe est réinterrogé");
  } finally {
    globalThis.fetch = originalFetch;
    resetPlaceCache();
  }
});
