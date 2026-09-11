// Convention d'aspects « lastro-aspects@1.0.0 ».
//
// Les aspects ne sont plus des « structures inactives » : une convention de
// produit, versionnée et écrite, décide quelles relations angulaires existent.
// La signification, elle, reste au rédacteur (LLM_SYNTHESIS).

import assert from "node:assert/strict";
import test from "node:test";

import {
  ASPECT_ORB_TABLE,
  LASTRO_ASPECTS_RULE_VERSION,
  angularSeparation,
  evaluateLastroAspects,
  retainedAspects
} from "../src/astro/rules/lastroAspects.mjs";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { docStrings, LANGUAGES } from "../src/deliverables/i18n.mjs";
import { buildSocle, renderSocleAnnex } from "../src/deliverables/socle.mjs";

const parisInput = {
  personId: "person_test",
  birthDate: "1990-01-15",
  timeValue: "12:30",
  birthPlace: "Paris",
  country: "France",
  latitude: 48.8566,
  longitude: 2.3522,
  timeZone: "Europe/Paris",
  coordinateSource: "test_fixture",
  coordinateConfidence: "verified_fixture"
};

function positionsOf(overrides = {}) {
  const result = calculateWesternNatalChart({ ...parisInput, ...overrides }).result;
  return result.astronomicalCalculation.bodies;
}

test("la convention est versionnee, de nature LASTRO_RULE, et dit ce qu'elle ne retient pas", () => {
  assert.equal(LASTRO_ASPECTS_RULE_VERSION.versionId, "lastro-aspects@1.0.0");
  assert.equal(LASTRO_ASPECTS_RULE_VERSION.nature, "LASTRO_RULE");
  assert.equal(LASTRO_ASPECTS_RULE_VERSION.documentaryStatus, "LASTRO_CONVENTION_NOT_TRADITIONAL_SOURCE");
  assert.match(LASTRO_ASPECTS_RULE_VERSION.notRetained, /mineurs/);
  assert.match(LASTRO_ASPECTS_RULE_VERSION.disclaimer, /n'interprète pas/);

  const convention = evaluateLastroAspects(positionsOf());
  assert.equal(convention.ruleVersionId, "lastro-aspects@1.0.0");
  assert.deepEqual(
    convention.orbTable.map((entry) => [entry.type, entry.orbDegrees, entry.orbDegreesWithLuminary]),
    [
      ["conjunction", 8, 10],
      ["opposition", 8, 10],
      ["trine", 7, 8],
      ["square", 6, 8],
      ["sextile", 4, 6]
    ]
  );
  // Les orbes écrits dans le module sont ceux publiés dans l'annexe.
  for (const entry of convention.orbTable) {
    assert.equal(entry.orbDegrees, ASPECT_ORB_TABLE[entry.type].orbDegrees);
  }
});

test("un orbe plus large est applique des qu'un luminaire est implique", () => {
  // Soleil à 100°, Lune à 15° → distance 85°, carré à 5° d'écart : dans l'orbe
  // élargi des luminaires (8°), hors de l'orbe ordinaire du carré (6°).
  const luminaries = evaluateLastroAspects([
    { body: "Sun", longitude: 100 },
    { body: "Moon", longitude: 15 }
  ]);
  const sunMoon = luminaries.items[0];
  assert.equal(sunMoon.type, "square");
  assert.equal(sunMoon.exactness, 5);
  assert.equal(sunMoon.orbUsed, 8);
  assert.equal(sunMoon.orbWithLuminary, true);
  assert.equal(sunMoon.retained, true);

  // Deux corps qui ne sont pas des luminaires : l'orbe du carré reste à 6°.
  // Un écart de 7° n'est donc PAS retenu.
  const others = evaluateLastroAspects([
    { body: "Mars", longitude: 10 },
    { body: "Jupiter", longitude: 107 }
  ]);
  const marsJupiter = others.items[0];
  assert.equal(marsJupiter.candidateType, "square");
  assert.equal(marsJupiter.exactness, 7);
  assert.equal(marsJupiter.orbUsed, 6);
  assert.equal(marsJupiter.orbWithLuminary, false);
  assert.equal(marsJupiter.retained, false);
  assert.equal(angularSeparation(10, 107), 97);
});

test("un couple hors orbe n'est pas retenu, et le motif est ecrit", () => {
  // Deux corps sans luminaire, écart de 12° sur un trigone (orbe 7°).
  const positions = [
    { body: "Mars", longitude: 10 },
    { body: "Jupiter", longitude: 142 }
  ];
  const convention = evaluateLastroAspects(positions);
  const item = convention.items[0];
  assert.equal(item.candidateType, "trine");
  assert.equal(item.exactness, 12);
  assert.equal(item.retained, false);
  assert.equal(item.discardedReason, "outside_orb");
  assert.equal(item.type, null);
  assert.equal(convention.summary.discardedOutsideOrb, 1);
  assert.deepEqual(retainedAspects(convention), []);
});

test("un aspect qui sort de l'orbe sur la marge d'incertitude n'est pas retenu", () => {
  // Soleil–Lune trigone à 7.82° d'écart : dans l'orbe de 8° à l'instant de
  // référence, mais la Lune bouge et l'aspect sort de l'orbe sur ±30 min.
  const exact = evaluateLastroAspects(positionsOf({ timePrecision: "exact" }));
  const exactItem = exact.items.find((item) => item.id === "aspect.Sun.Moon");
  assert.equal(exactItem.retained, true);
  assert.equal(exactItem.type, "trine");
  assert.equal(exactItem.marginStability, null);

  const approximate = evaluateLastroAspects(positionsOf({ timePrecision: "approximate", timeMarginMinutes: 30 }));
  const marginItem = approximate.items.find((item) => item.id === "aspect.Sun.Moon");
  assert.equal(marginItem.withinOrb, true);
  assert.equal(marginItem.marginStability.stable, false);
  assert.equal(marginItem.retained, false);
  assert.equal(marginItem.discardedReason, "not_stable_within_declared_margin");
  assert.equal(approximate.summary.discardedNotStableWithinMargin, 2);
  assert.equal(
    approximate.summary.retained + approximate.summary.discardedOutsideOrb + approximate.summary.discardedNotStableWithinMargin,
    21
  );
  assert.ok(retainedAspects(approximate).every((item) => item.marginStability === null || item.marginStability.stable));
});

test("chaque aspect evalue porte sa provenance et sa version de regle", () => {
  const convention = evaluateLastroAspects(positionsOf());
  assert.equal(convention.items.length, 21);
  assert.ok(convention.items.every((item) => item.provenance === "LASTRO_RULE"));
  assert.ok(convention.items.every((item) => item.ruleVersionId === "lastro-aspects@1.0.0"));
  // Les couples retenus sont tries en premier, du plus serre au plus large.
  const gaps = convention.items.map((item) => item.exactness);
  assert.deepEqual(gaps, [...gaps].sort((a, b) => a - b));
});

test("l'annexe ecrit la convention, les orbes et les aspects retenus", () => {
  const result = calculateWesternNatalChart({ ...parisInput, timePrecision: "exact" }).result;
  const socle = buildSocle(result);
  const conventionFact = socle.facts.find((fact) => fact.id === "method.aspects");
  assert.match(conventionFact.value, /lastro-aspects@1\.0\.0/);
  assert.match(conventionFact.value, /conjonction 8° \(10°/);
  assert.match(conventionFact.value, /trigone 7° \(8°/);
  const geometryFact = socle.facts.find((fact) => fact.id === "method.aspectGeometry");
  assert.match(geometryFact.value, /21 couples examinés/);
  assert.ok(socle.retainedAspects.length > 0);
  const first = socle.retainedAspects[0];
  const fact = socle.facts.find((entry) => entry.id === first.id);
  assert.match(fact.value, new RegExp(first.aspectLabel));
  assert.match(fact.value, /orbe \d+°/);
  assert.match(fact.value, /écart \d+\.\d+°/);

  const annex = renderSocleAnnex(socle);
  assert.match(annex, /lastro-aspects@1\.0\.0/);
  // Le vocabulaire français est « trigone », jamais « trine ».
  assert.doesNotMatch(annex, /\btrine\b/i);
  // Aucun avertissement brut du moteur, aucun statut interne dans l'annexe.
  assert.doesNotMatch(annex, /inactive structures/i);
  assert.doesNotMatch(annex, /calculated_development_not_production/);
  assert.doesNotMatch(annex, /JPL Horizons/i);
});

test("les neuf langues nomment les aspects et n'exposent aucun placeholder", () => {
  const expected = {
    fr: "trigone",
    en: "trine",
    de: "Trigon",
    es: "trígono",
    it: "trigono",
    pt: "trígono",
    no: "trigon",
    da: "trigon",
    nl: "driehoek"
  };
  const result = calculateWesternNatalChart({ ...parisInput, timePrecision: "exact" }).result;
  for (const { code } of LANGUAGES) {
    const strings = docStrings(code);
    assert.equal(strings.aspects.trine, expected[code], code);
    assert.ok(strings.labels.aspects);
    assert.ok(strings.values.withLuminaries);
    assert.ok(strings.annexMethod);
    const socle = buildSocle(result, strings);
    const annex = renderSocleAnnex(socle, strings);
    assert.ok(!/\{[a-z]+\}/.test(annex), `placeholder non remplacé (${code})`);
    assert.match(annex, new RegExp(expected[code]), `nom d'aspect absent (${code})`);
  }
});
