// « Votre thème en mots simples » : même vocabulaire que la lecture complète,
// rien d'affirmé hors de ce que le calcul établit. Thèmes fictifs uniquement.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { HOUSE_DOMAINS_FR } from "../src/deliverables/chartGlossary.mjs";
import { docStrings } from "../src/deliverables/i18n.mjs";
import { BODY_THEMES, SIGN_THEMES } from "../src/deliverables/interpretationRules.mjs";
import { PLAIN_LANGUAGE_SECTION_ID, plainLanguageSection } from "../src/deliverables/plainLanguage.mjs";
import { renderDossierHtml } from "../src/deliverables/render.mjs";
import { buildSocle } from "../src/deliverables/socle.mjs";

const LIEU = { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" };

function socle(extra, birthDate = "1986-01-02") {
  return buildSocle(calculateWesternNatalChart({ birthDate, ...LIEU, ...extra }).result, docStrings("fr"));
}

const APPROX = () => socle({ timePrecision: "approximate", timeValue: "16:45", timeMarginMinutes: 30 });
const EXACT = () => socle({ timePrecision: "exact", timeValue: "16:45" });
const SANS_HEURE = () => socle({ timePrecision: "unknown" });

test("chaque planète est décodée avec le vocabulaire des règles et du glossaire", () => {
  const theme = APPROX();
  const { text } = plainLanguageSection({ socle: theme });
  for (const body of theme.bodies) {
    for (const word of BODY_THEMES[body.body]) assert.ok(text.includes(word), `${body.body} : ${word}`);
    assert.ok(text.includes(SIGN_THEMES[body.sign][0]), `${body.body} : couleur du signe`);
    const domain = HOUSE_DOMAINS_FR[body.house - 1].replace(/\.$/, "").toLowerCase();
    assert.ok(text.includes(`maison ${body.house}`) && text.includes(domain), `${body.body} : maison ${body.house}`);
  }
  assert.match(text, /L'Ascendant en Cancer \(probable\)/);
  assert.match(text, /Les liens entre vos planètes/);
});

test("le français reste correct : élisions et aucun « de » devant une voyelle", () => {
  const { text } = plainLanguageSection({ socle: APPROX() });
  assert.doesNotMatch(text, /couleur de [aeiouéèh]/i);
  assert.doesNotMatch(text, /fait de [aeiouéèh]/i);
  assert.match(text, /couleur d'ouverture/);
});

test("sans heure : ni maison, ni Ascendant, ni aspect inventé", () => {
  const { text } = plainLanguageSection({ socle: SANS_HEURE() });
  assert.doesNotMatch(text, /maison \d/);
  assert.doesNotMatch(text, /Ascendant en/);
});

test("un corps dont le signe change dans la marge n'est jamais placé dans un signe", () => {
  const theme = EXACT();
  theme.bodies = theme.bodies.map((body) => (body.body === "Moon" ? { ...body, signStableWithinMargin: false } : body));
  const { text } = plainLanguageSection({ socle: theme });
  assert.match(text, /La lune : signe non décidable|la Lune : signe non décidable/i);
  assert.doesNotMatch(text, /La Lune en [A-ZÉ]/);
});

test("aucune prédiction ni vocabulaire fataliste", () => {
  const { text } = plainLanguageSection({ socle: APPROX() });
  assert.doesNotMatch(text, /\b(vous allez|vous serez|destin|prédi[ct]tion annoncée)\b/i);
  assert.match(text, /pas un portrait figé ni une prédiction/);
});

test("réservé au français, et rendu comme une section du dossier", () => {
  assert.equal(plainLanguageSection({ socle: APPROX(), language: "en" }), null);
  const section = plainLanguageSection({ socle: APPROX() });
  assert.equal(section.id, PLAIN_LANGUAGE_SECTION_ID);
  const html = renderDossierHtml({ title: "Test", personLabel: null, createdAt: "2026-11-07T12:00:00.000Z", writerMode: "llm", sections: [section] });
  assert.match(html, /Votre thème en mots simples/);
  assert.match(html, /<strong>En clair :<\/strong>/);
});

test("les liens entre planètes : français correct, définitions données une seule fois", () => {
  const theme = EXACT();
  theme.retainedAspects = [
    { bodyA: "Sun", bodyB: "Moon", type: "opposition" },
    { bodyA: "Moon", bodyB: "Sun", type: "conjunction" },
    { bodyA: "Sun", bodyB: "Jupiter", type: "trine" },
    { bodyA: "Mars", bodyB: "Jupiter", type: "trine" },
    { bodyA: "Moon", bodyB: "Mars", type: "sextile" },
    { bodyA: "Mercury", bodyB: "Saturn", type: "square" }
  ];
  const { text } = plainLanguageSection({ socle: theme });
  assert.match(text, /Le Soleil face à la Lune \(opposition\)/);
  assert.match(text, /La Lune réunie au Soleil \(conjonction\)/);
  assert.match(text, /vos besoins émotionnels peuvent s'appuyer sur/);
  assert.doesNotMatch(text, /opposition la|à le |\bIci :/);
  // La définition d'une famille d'aspects n'apparaît qu'une fois, dans la légende.
  assert.equal(text.split("circulation plus facile").length - 1, 1);
  assert.equal(text.split("demande à être accordée").length - 1, 1);
  // Pas de majuscule après les deux-points, pas de double deux-points sur une ligne.
  for (const line of text.split("\n").filter((l) => l.startsWith("- **") && /\((opposition|carré|trigone|sextile|conjonction)\)/.test(l))) {
    assert.match(line, /\*\* : [a-zv]/, line);
    assert.equal(line.split(" : ").length, 2, line);
  }
});

test("la légende ne cite que les familles d'aspects présentes", () => {
  const theme = EXACT();
  theme.retainedAspects = [{ bodyA: "Sun", bodyB: "Jupiter", type: "trine" }];
  const { text } = plainLanguageSection({ socle: theme });
  assert.match(text, /\*\*Trigone\*\* :/);
  assert.doesNotMatch(text, /\*\*Conjonction\*\*|\*\*Carré|opposition\*\*/);
});
