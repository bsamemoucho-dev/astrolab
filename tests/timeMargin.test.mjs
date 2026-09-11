// Marge d'incertitude sur l'heure approximative : le langage doit être borné.
//
// Une consigne n'est pas une contrainte. Ces tests vérifient les trois maillons :
// le socle écrit la marge et refuse d'affirmer un signe non décidable, le
// détecteur mesure le texte réel, et les neuf langues portent les chaînes.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { docStrings, LANGUAGES } from "../src/deliverables/i18n.mjs";
import { buildSocle, renderSocleAnnex } from "../src/deliverables/socle.mjs";
import { findUnhedgedTimedAssertions, validateSectionText } from "../src/deliverables/validator.mjs";

const parisInput = {
  personId: "person_test",
  birthDate: "1990-01-15",
  timeValue: "12:30",
  timePrecision: "approximate",
  birthPlace: "Paris",
  country: "France",
  latitude: 48.8566,
  longitude: 2.3522,
  timeZone: "Europe/Paris",
  coordinateSource: "test_fixture",
  coordinateConfidence: "verified_fixture"
};

function socleFor(overrides = {}) {
  return buildSocle(calculateWesternNatalChart({ ...parisInput, ...overrides }).result);
}

const unstable = socleFor({ timeMarginMinutes: 30 }); // Bélier → Taureau dans la marge
const stable = socleFor({ timeMarginMinutes: 15 }); // Taureau sur toute la marge
const exactSocle = buildSocle(
  calculateWesternNatalChart({ ...parisInput, timePrecision: "exact" }).result
);

test("le socle écrit la marge retenue et son origine", () => {
  const defaulted = socleFor();
  const defaultFact = defaulted.facts.find((fact) => fact.id === "uncertainty.margin");
  assert.ok(defaultFact);
  assert.match(defaultFact.value, /±30 min/);
  assert.match(defaultFact.value, /défaut/i);

  const supplied = socleFor({ timeMarginMinutes: 60 });
  const suppliedFact = supplied.facts.find((fact) => fact.id === "uncertainty.margin");
  assert.match(suppliedFact.value, /±60 min/);
  assert.match(suppliedFact.value, /client/i);

  // Heure exacte : aucune marge affichée, aucune fausse incertitude ajoutée.
  assert.equal(exactSocle.facts.find((fact) => fact.id === "uncertainty.margin"), undefined);
  assert.equal(exactSocle.timeLanguageCap, null);
});

test("un signe d'angle qui change dans la marge n'est pas affirmé dans l'annexe", () => {
  assert.match(unstable.ascendant.degreeLabel, /non décidable/i);
  assert.match(unstable.ascendant.degreeLabel, /Bélier/);
  assert.match(unstable.ascendant.degreeLabel, /Taureau/);
  assert.equal(unstable.ascendant.decidableWithinMargin, false);
  assert.equal(unstable.housesAvailable, false);
  assert.equal(unstable.housesDecidableWithinMargin, false);
  // Aucune maison n'est attachée à une planète quand les maisons ne sont pas
  // décidables : « maison 7 » serait une affirmation.
  assert.ok(unstable.bodies.every((body) => body.house === null && body.houseLabel === null));
  assert.ok(unstable.uncertaintyNotes.some((note) => /n'est pas décidable/.test(note)));

  // Marge serrée : le signe redevient nommable, mais comme probable.
  assert.equal(stable.ascendant.decidableWithinMargin, true);
  assert.match(stable.ascendant.degreeLabel, /signe stable/i);
  assert.ok(stable.bodies.every((body) => body.house !== null));
  assert.ok(stable.uncertaintyNotes.some((note) => /probable, jamais comme exact/.test(note)));

  const annex = renderSocleAnnex(unstable);
  assert.match(annex, /Marge d'incertitude retenue/);
  assert.match(annex, /non décidable/i);
});

test("le détecteur attrape un angle affirmé sans nuance et laisse passer une formulation probabiliste", () => {
  // Signe non décidable : le nommer est fautif, même avec une nuance.
  const undecidable = findUnhedgedTimedAssertions("Votre Ascendant est en Bélier.", unstable);
  assert.equal(undecidable.length, 1);
  assert.equal(undecidable[0].code, "undecidable_angle_sign_asserted");

  // Signe stable mais présenté comme un fait : fautif.
  const unhedged = findUnhedgedTimedAssertions("Votre Ascendant est en Taureau.", stable);
  assert.equal(unhedged.length, 1);
  assert.equal(unhedged[0].code, "unhedged_angle_sign_assertion");

  // Signe stable présenté comme probable : acceptable.
  assert.deepEqual(
    findUnhedgedTimedAssertions("Votre Ascendant se situe probablement en Taureau.", stable),
    []
  );
  // Frontière nommée explicitement avec nuance : acceptable.
  assert.deepEqual(
    findUnhedgedTimedAssertions("Votre Ascendant se situe probablement entre le Bélier et le Taureau.", unstable),
    []
  );
  // Frontière nommée sans nuance : encore fautif.
  assert.equal(findUnhedgedTimedAssertions("Votre Ascendant est entre le Bélier et le Taureau.", unstable).length, 1);
});

test("le détecteur attrape un degré précis et une maison non décidable", () => {
  const degree = findUnhedgedTimedAssertions("Votre Ascendant se situe à 12° du Taureau.", stable);
  assert.equal(degree.length, 1);
  assert.equal(degree[0].code, "exact_angle_degree_with_uncertainty_margin");

  const house = findUnhedgedTimedAssertions("Saturne se trouve en maison 7 et pèse sur vos engagements.", unstable);
  assert.equal(house.length, 1);
  assert.equal(house[0].code, "undecidable_house_asserted");

  // Marge serrée : les maisons sont décidables, la phrase n'est plus fautive.
  assert.deepEqual(findUnhedgedTimedAssertions("Saturne se trouve en maison 7.", stable), []);
});

test("le détecteur ne dit rien quand l'heure est exacte ou la marge absente", () => {
  for (const sentence of [
    "Votre Ascendant est en Taureau.",
    "Votre Ascendant se situe à 12° du Taureau.",
    "Saturne se trouve en maison 7."
  ]) {
    assert.deepEqual(findUnhedgedTimedAssertions(sentence, exactSocle), [], sentence);
    assert.deepEqual(findUnhedgedTimedAssertions(sentence, null), [], sentence);
  }
});

test("validateSectionText refuse une section qui affirme un angle non décidable", () => {
  const text =
    "Votre manière d'avancer est directe. Votre Ascendant est en Bélier, ce qui colore votre présence. Vous aimez ouvrir la voie.";
  const report = validateSectionText({ sectionId: "position-naissance-axe", text, socle: unstable });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "undecidable_angle_sign_asserted"));
});

test("les neuf langues portent les chaînes de marge, placeholders compris", () => {
  const keys = [
    "margin",
    "marginRange",
    "marginDefault",
    "marginSupplied",
    "signStable",
    "signNotDecidable",
    "withinMargin"
  ];
  const uncertaintyKeys = ["approximate", "approximateStable", "approximateUnstable", "approximateBodySigns", "approximateSect"];
  for (const { code } of LANGUAGES) {
    const strings = docStrings(code);
    for (const key of keys) {
      assert.ok(strings.labels?.[key] ?? strings.values?.[key], `${code}.${key} manquant`);
      assert.ok(String(strings.labels?.[key] ?? strings.values?.[key]).trim().length > 0, `${code}.${key} vide`);
    }
    for (const key of uncertaintyKeys) {
      assert.ok(strings.uncertainty?.[key], `${code}.uncertainty.${key} manquant`);
    }
    assert.match(strings.values.marginDefault, /\{n\}/, `${code}.marginDefault sans {n}`);
    assert.match(strings.values.marginSupplied, /\{n\}/, `${code}.marginSupplied sans {n}`);
    assert.match(strings.values.withinMargin, /\{n\}/, `${code}.withinMargin sans {n}`);
    assert.match(strings.uncertainty.approximate, /\{margin\}/, `${code}.approximate sans {margin}`);
    assert.match(strings.uncertainty.approximateStable, /\{sign\}/, `${code}.approximateStable sans {sign}`);
    assert.match(strings.uncertainty.approximateUnstable, /\{from\}/, `${code}.approximateUnstable sans {from}`);
    assert.match(strings.uncertainty.approximateUnstable, /\{to\}/, `${code}.approximateUnstable sans {to}`);
    assert.match(strings.uncertainty.approximateBodySigns, /\{bodies\}/, `${code}.approximateBodySigns sans {bodies}`);
  }
  // Aucun gabarit non résolu ne doit sortir dans l'annexe.
  for (const { code } of LANGUAGES) {
    const socle = buildSocle(calculateWesternNatalChart({ ...parisInput, timeMarginMinutes: 30 }).result, docStrings(code));
    const annex = renderSocleAnnex(socle, docStrings(code));
    assert.ok(!/\{[a-z]+\}/.test(annex), `placeholder non remplacé dans l'annexe ${code}`);
  }
});
