// Couverture des détecteurs dans les NEUF langues vendues.
//
// Les règles de sécurité factuelle doivent tenir partout : une contradiction
// planète ↔ signe, un placeholder ou un angle présenté comme exact ne sont pas
// des problèmes de français. Ce fichier mesure langue par langue ce qui est
// réellement détecté, et déclare ce qui reste propre au français.
//
// Les phrases des tests sont écrites à la main dans chaque langue (pas
// reconstruites depuis les tables i18n) : sinon le test se contenterait de
// vérifier que la table se retrouve elle-même.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { DETECTOR_LANGUAGES } from "../src/deliverables/detectorVocabulary.mjs";
import { docStrings } from "../src/deliverables/i18n.mjs";
import { buildSocle } from "../src/deliverables/socle.mjs";
import {
  DETECTOR_COVERAGE,
  findForbiddenVocabulary,
  findSignContradictions,
  findTutoiement,
  findUnfilledPlaceholders,
  findUnhedgedTimedAssertions
} from "../src/deliverables/validator.mjs";

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

// ±15 min : le signe de l'Ascendant (Taureau) est stable sur toute la marge.
// ±30 min : la frontière est franchie (Bélier → Taureau), donc non décidable.
function socleFor(language, overrides = {}) {
  const socle = buildSocle(
    calculateWesternNatalChart({ ...parisInput, timePrecision: "approximate", ...overrides }).result,
    docStrings(language)
  );
  return { ...socle, language };
}

const STABLE = (language) => socleFor(language, { timeMarginMinutes: 15 });
const UNSTABLE = (language) => socleFor(language, { timeMarginMinutes: 30 });

// Phrases écrites à la main. `sign` est remplacé par le nom localisé du signe.
const AFFIRMATIONS = {
  fr: { unhedged: (s) => `Votre Ascendant en ${s} vous donne de la constance.`, hedged: (s) => `Votre Ascendant se situe probablement en ${s}.` },
  en: { unhedged: (s) => `Your Ascendant in ${s} gives you steadiness.`, hedged: (s) => `Your Ascendant is probably in ${s}.` },
  de: { unhedged: (s) => `Ihr Aszendent im ${s} gibt Ihnen Beständigkeit.`, hedged: (s) => `Ihr Aszendent liegt wahrscheinlich im ${s}.` },
  es: { unhedged: (s) => `Su Ascendente en ${s} le da estabilidad.`, hedged: (s) => `Su Ascendente está probablemente en ${s}.` },
  it: { unhedged: (s) => `Il tuo Ascendente in ${s} ti dà stabilità.`, hedged: (s) => `Il tuo Ascendente è probabilmente in ${s}.` },
  pt: { unhedged: (s) => `O seu Ascendente em ${s} dá-lhe estabilidade.`, hedged: (s) => `O seu Ascendente está provavelmente em ${s}.` },
  no: { unhedged: (s) => `Ascendanten din i ${s} gir deg stabilitet.`, hedged: (s) => `Ascendanten din er sannsynligvis i ${s}.` },
  da: { unhedged: (s) => `Din Ascendant i ${s} giver dig stabilitet.`, hedged: (s) => `Din Ascendant er sandsynligvis i ${s}.` },
  nl: { unhedged: (s) => `Je Ascendant in ${s} geeft je stabiliteit.`, hedged: (s) => `Je Ascendant is waarschijnlijk in ${s}.` }
};

const PLACEHOLDERS = {
  fr: "Votre prénom apparaîtra ici.",
  en: "Your first name will appear here.",
  de: "Ihr Vorname erscheint hier.",
  es: "Su nombre aparecerá aquí.",
  it: "Il tuo nome apparirà qui.",
  pt: "O seu nome aparecerá aqui.",
  no: "Fornavnet ditt vises her.",
  da: "Fornavnet dit vises her.",
  nl: "Je voornaam verschijnt hier."
};

const CORRECT_SENTENCES = {
  fr: (body) => `Votre ${body} traverse une période de maturation intérieure.`,
  en: (body) => `Your ${body} goes through a period of inner maturation.`,
  de: (body) => `Ihr ${body} durchläuft eine Phase innerer Reifung.`,
  es: (body) => `Su ${body} atraviesa un período de maduración interior.`,
  it: (body) => `Il tuo ${body} attraversa un periodo di maturazione interiore.`,
  pt: (body) => `O seu ${body} atravessa um período de maturação interior.`,
  no: (body) => `${body} din går gjennom en periode med indre modning.`,
  da: (body) => `Din ${body} gennemgår en periode med indre modning.`,
  nl: (body) => `Je ${body} gaat door een periode van innerlijke rijping.`
};

test("les neuf langues vendues sont couvertes par le vocabulaire des détecteurs", () => {
  assert.deepEqual([...DETECTOR_LANGUAGES].sort(), ["da", "de", "en", "es", "fr", "it", "nl", "no", "pt"]);
  for (const language of DETECTOR_LANGUAGES) {
    const strings = docStrings(language);
    for (const key of ["planets", "signs", "aspects", "labels"]) {
      assert.ok(strings[key], `${language}.${key} manquant : les détecteurs ne peuvent pas être localisés`);
    }
    for (const body of ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
      assert.ok(strings.planets[body], `${language}.planets.${body} manquant`);
    }
    for (const sign of ["Aries", "Taurus", "Leo", "Virgo", "Capricorn"]) {
      assert.ok(strings.signs[sign], `${language}.signs.${sign} manquant`);
    }
  }
});

test("une contradiction planète ↔ signe est détectée dans les neuf langues", () => {
  const strings = docStrings("fr");
  // Soleil en Capricorne, Lune en Vierge dans le thème de référence : on écrit
  // une phrase qui les place dans un signe faux, avec le nom localisé.
  for (const language of DETECTOR_LANGUAGES) {
    const t = docStrings(language);
    const socle = { ...socleFor(language), language };
    const faux = CORRECT_SENTENCES[language](t.planets.Sun).replace(".", `, ${t.signs.Leo}.`);
    const trouve = findSignContradictions(faux, socle);
    assert.equal(trouve.length, 1, `${language} : contradiction non détectée — « ${faux} »`);
    assert.equal(trouve[0].code, "contradiction_with_socle");

    // La même phrase avec le bon signe ne doit rien déclencher.
    const sunSign = socle.bodies.find((body) => body.id === "body.Sun").sign;
    const juste = CORRECT_SENTENCES[language](t.planets.Sun).replace(".", `, ${t.signs[sunSign]}.`);
    assert.deepEqual(findSignContradictions(juste, socle), [], `${language} : faux positif — « ${juste} »`);
  }
  // Le français nomme le signe attendu dans le message (outil d'exploitation).
  assert.match(strings.signs.Capricorn, /Capricorne/);
});

test("l'affirmation d'un angle non décidable est détectée dans les neuf langues", () => {
  for (const language of DETECTOR_LANGUAGES) {
    const t = docStrings(language);
    const unstable = UNSTABLE(language);
    // Le signe de la fenêtre doit être nommé : on l'annonce dans la phrase.
    const inWindow = t.signs[unstable.timeLanguageCap.ascendantSignsInWindow[0]];
    const phrase = AFFIRMATIONS[language].unhedged(inWindow);
    const violations = findUnhedgedTimedAssertions(phrase, unstable);
    assert.ok(
      violations.some((violation) => violation.code === "undecidable_angle_sign_asserted"),
      `${language} : angle non décidable non détecté — « ${phrase} »`
    );
  }
});

test("un signe d'angle stable et nuancé passe, le même sans nuance est signalé, dans les neuf langues", () => {
  for (const language of DETECTOR_LANGUAGES) {
    const t = docStrings(language);
    const stable = STABLE(language);
    const sign = t.signs[stable.ascendant.sign];

    const hedged = AFFIRMATIONS[language].hedged(sign);
    assert.deepEqual(
      findUnhedgedTimedAssertions(hedged, stable),
      [],
      `${language} : formulation nuancée refusée — « ${hedged} »`
    );

    const unhedged = AFFIRMATIONS[language].unhedged(sign);
    const violations = findUnhedgedTimedAssertions(unhedged, stable);
    assert.equal(violations.length, 1, `${language} : affirmation non nuancée non signalée — « ${unhedged} »`);
    // Nuance manquante sur un signe STABLE : ce n'est pas une affirmation fausse.
    assert.equal(violations[0].code, "unhedged_angle_sign_assertion");
  }
});

test("un placeholder localisé est détecté dans les neuf langues", () => {
  for (const language of DETECTOR_LANGUAGES) {
    const socle = { ...socleFor(language), language };
    const phrase = PLACEHOLDERS[language];
    const trouve = findUnfilledPlaceholders(phrase, socle);
    assert.equal(trouve.length, 1, `${language} : placeholder non détecté — « ${phrase} »`);
    assert.equal(trouve[0].code, "unfilled_placeholder");
  }
  // Les marques structurelles restent universelles, même sans langue connue.
  for (const phrase of ["[Votre prénom]", "{{name}}", "<insert here>"]) {
    assert.equal(findUnfilledPlaceholders(phrase, null).length, 1, `« ${phrase} » doit être détecté`);
  }
});

test("une balise de mise en forme n'est pas prise pour un trou à remplir", () => {
  // Le 12 septembre, l'aperçu est sorti avec ONZE sections vides : le rédacteur de
  // remplacement rendait « <p>…</p> », et chaque phrase contenant une balise était
  // retirée comme un placeholder non rempli.
  const phrase = "<p>Vous avancez avec une prudence qui n'a rien d'une réserve.</p>";
  assert.deepEqual(findUnfilledPlaceholders(phrase, { language: "fr" }), []);
  for (const balise of ["<em>texte</em>", "<strong>texte</strong>", "<br>", "<ul><li>un</li></ul>", "<h2>Titre</h2>"]) {
    assert.deepEqual(findUnfilledPlaceholders(balise, { language: "fr" }), [], `« ${balise} » est du balisage`);
  }
  // Les vrais trous écrits entre chevrons restent détectés : le nom de la balise
  // n'appartient pas au balisage connu.
  for (const trou of ["<VOTRE PRÉNOM>", "<à compléter>", "<insert here>", "<prénom du père>"]) {
    assert.equal(findUnfilledPlaceholders(trou, { language: "fr" }).length, 1, `« ${trou} » doit être détecté`);
  }
});

test("les règles françaises ne s'appliquent pas aux autres langues", () => {
  // « trine » est le mot juste en anglais : il ne doit jamais être refusé.
  assert.deepEqual(findForbiddenVocabulary("The trine between your Moon and Saturn.", "en"), []);
  assert.equal(findForbiddenVocabulary("Le trine entre votre Lune et votre Saturne.", "fr").length, 1);
  // Le tutoiement est une règle de français : « you » n'est pas « tu ».
  assert.deepEqual(findTutoiement("You move forward with caution.", "en"), []);
  assert.equal(findTutoiement("Tu avances avec prudence.", "fr").length, 1);
  // Et la déclaration de couverture doit rester vraie.
  assert.ok(DETECTOR_COVERAGE.allLanguages.includes("time_margin_language_cap"));
  assert.ok(DETECTOR_COVERAGE.allLanguages.includes("planet_and_angle_sign_contradiction"));
  assert.ok(DETECTOR_COVERAGE.allLanguages.includes("unfilled_placeholder"));
  assert.ok(DETECTOR_COVERAGE.frenchOnly.includes("biographical_invention"));
  assert.ok(DETECTOR_COVERAGE.frenchOnly.includes("tutoiement"));
  assert.ok(DETECTOR_COVERAGE.frenchOnly.includes("forbidden_vocabulary"));
});
