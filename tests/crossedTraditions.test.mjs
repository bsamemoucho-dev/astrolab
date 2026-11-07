// Chapitre « Regards croisés » : calculé, sans rédacteur, et honnête sur
// l'incertitude. Naissances fictives uniquement.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import {
  CROSSED_TRADITIONS_VERSION,
  crossedTraditionsFacts,
  crossedTraditionsSection
} from "../src/deliverables/crossedTraditions.mjs";
import { docStrings } from "../src/deliverables/i18n.mjs";
import { renderDossierHtml } from "../src/deliverables/render.mjs";
import { buildSocle } from "../src/deliverables/socle.mjs";

const LIEU = { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", placeName: "Paris", country: "France" };
const GENERATED_AT = "2026-11-07T12:00:00.000Z";

function cas(extra) {
  const natalInput = { birthDate: "1990-01-15", ...LIEU, ...extra };
  const socle = buildSocle(calculateWesternNatalChart(natalInput).result, docStrings("fr"));
  return { natalInput, socle, generatedAt: GENERATED_AT };
}

const EXACT = () => cas({ timePrecision: "exact", timeValue: "16:30" });
const APPROX = () => cas({ timePrecision: "approximate", timeValue: "16:30", timeMarginMinutes: 30 });
const SANS_HEURE = () => cas({ timePrecision: "unknown" });

test("heure exacte : deux zodiaques côte à côte, piliers complets, période en cours", () => {
  const facts = crossedTraditionsFacts(EXACT());
  assert.ok(facts.ayanamsha > 23 && facts.ayanamsha < 24.5);
  const row = (label) => facts.comparisons.find((entry) => entry.label === label);
  assert.equal(row("Soleil").tropical, "Capricorne");
  assert.equal(row("Soleil").sidereal, "Capricorne");
  assert.equal(row("Lune").sidereal, "Lion");
  assert.equal(row("Ascendant").sidereal, "Gémeaux");
  assert.deepEqual(facts.pillars.map((pillar) => pillar.ganZhi), ["Ji-Si", "Ding-Chou", "Geng-Chen", "Jia-Shen"]);
  assert.deepEqual(facts.dayMaster, { stem: "Geng", phase: "Métal", polarity: "yang" });
  assert.equal(facts.dasha.mahadasha, "Rahu");
  assert.equal(facts.dasha.since, 2014);
});

test("heure approximative : aucun signe sidéral affirmé comme exact, pilier d'heure indéterminé", () => {
  const facts = crossedTraditionsFacts(APPROX());
  for (const row of facts.comparisons.filter((entry) => entry.label !== "Ascendant")) {
    assert.match(row.sidereal, /\((probable|non décidable)\)$/, row.label);
  }
  assert.equal(facts.comparisons.find((entry) => entry.label === "Ascendant").sidereal, null);
  assert.match(facts.comparisons.find((entry) => entry.label === "Ascendant").tropical, /\(probable\)$/);
  assert.equal(facts.pillars.find((pillar) => pillar.role === "hour").ganZhi, null);
  assert.equal(facts.dasha, null);
});

test("sans heure : pas d'Ascendant, la section reste produite", () => {
  const section = crossedTraditionsSection(SANS_HEURE());
  assert.ok(section);
  assert.doesNotMatch(section.text, /\| Ascendant \|/);
  assert.match(section.text, /\| Heure \| indéterminé \|/);
});

test("le texte n'annonce ni événement ni synthèse, et cite sa convention", () => {
  const { text } = crossedTraditionsSection(EXACT());
  assert.match(text, new RegExp(CROSSED_TRADITIONS_VERSION.replace(/[.@]/g, "\\$&")));
  assert.match(text, /n'annonce aucun événement/);
  assert.match(text, /ne renforcent aucune interprétation/);
  assert.doesNotMatch(text, /complément/);
  assert.doesNotMatch(text, /\b(vous allez|vous serez|prédi|destin)/i);
});

test("le chapitre est réservé au français et se retire sans bloquer en cas d'échec", () => {
  assert.equal(crossedTraditionsSection({ ...EXACT(), language: "en" }), null);
  const warnings = [];
  const section = crossedTraditionsSection({
    natalInput: { birthDate: "1850-01-01", ...LIEU, timePrecision: "exact", timeValue: "12:00" },
    socle: EXACT().socle,
    generatedAt: GENERATED_AT,
    logger: { warn: (...args) => warnings.push(args) }
  });
  assert.equal(section, null);
});

test("le chapitre s'affiche dans le dossier HTML avec ses tableaux", () => {
  const section = crossedTraditionsSection(EXACT());
  const html = renderDossierHtml({ title: "Test", personLabel: null, createdAt: GENERATED_AT, writerMode: "llm", sections: [section] });
  assert.match(html, /Regards croisés/);
  assert.match(html, /<th>Védique \(sidéral\)<\/th>/);
  assert.match(html, /Geng-Chen \(庚辰\)/);
});
