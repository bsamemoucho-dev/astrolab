import assert from "node:assert/strict";
import test from "node:test";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { chartBlockHtml, signDistribution } from "../src/deliverables/chart.mjs";
import { natalChartLabels } from "../src/deliverables/chartLabels.mjs";
import { docStrings, LANGUAGES } from "../src/deliverables/i18n.mjs";
import { buildSocle } from "../src/deliverables/socle.mjs";

const INPUT = { birthDate: "1990-01-15", timePrecision: "exact", timeValue: "12:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", placeName: "Paris", country: "France" };
const socleFor = (language = "fr", extra = {}) => buildSocle(calculateWesternNatalChart({ ...INPUT, ...extra }).result, docStrings(language));
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function rowFor(html, body) {
  return html.match(new RegExp(`<div class="natal-position-row" data-body="${body}">([^]*?)</div>`))?.[1];
}

test("le panneau reproduit les sept positions et maisons calculées, sans modifier le socle", () => {
  const socle = socleFor();
  const before = structuredClone(socle);
  const html = chartBlockHtml(socle);
  assert.equal((html.match(/class="natal-position-row"/g) ?? []).length, 7);
  assert.doesNotMatch(html, /class="natal-uncertainty-legend"/);
  for (const body of socle.bodies) {
    const row = rowFor(html, body.body);
    assert.ok(row, body.body);
    assert.ok(row.includes(escape(body.label)), body.body);
    assert.ok(row.includes(escape(body.degreeLabel)), body.body);
    assert.match(row, new RegExp(`maison ${body.house}</span>`));
  }
  assert.ok(html.indexOf('class="chart-distributions"') > html.indexOf('class="natal-panel"'));
  const distribution = signDistribution(socle.bodies);
  assert.equal((html.match(/class="bar-row"/g) ?? []).length, 7);
  assert.deepEqual([...html.matchAll(/class="bar" style="width:(\d+)%/g)].map((m) => Number(m[1])), [
    ...Object.values(distribution.byElement), ...Object.values(distribution.byModality)
  ].map((count) => Math.round(count / distribution.classified * 100)));
  assert.deepEqual(socle, before);
});

test("le panneau affiche la date civile, l’heure locale, le lieu et le fuseau d’origine", () => {
  const html = chartBlockHtml(socleFor());
  assert.match(html, /15 janvier 1990 · 12:30/);
  assert.match(html, /Paris, France/);
  assert.match(html, /Europe\/Paris/);
  assert.doesNotMatch(html, /14 janvier 1990/);
});

test("le panneau échappe les métadonnées et les libellés issus du dossier", () => {
  const socle = socleFor();
  socle.birth.placeName = '<img src="x" onerror="alert(1)">';
  socle.facts = socle.facts.filter((fact) => fact.id !== "identity.place");
  socle.bodies[0].degreeLabel = '<script>bad()</script> & "test"';
  const html = chartBlockHtml(socle);
  assert.doesNotMatch(html, /<img|<script>/);
  assert.match(html, /&lt;img src=&quot;x&quot;/);
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt; &amp; &quot;test&quot;/);
});

test("le panneau respecte l’heure inconnue et n’invente ni degré ni maison", () => {
  const socle = socleFor("fr", { timePrecision: "unknown", timeValue: undefined });
  const html = chartBlockHtml(socle);
  assert.match(html, /heure inconnue/);
  assert.match(html, /class="natal-uncertainty-legend">Arc et \? : position incertaine dans la plage de naissance/);
  assert.doesNotMatch(html, /class="natal-house"/);
  for (const body of socle.bodies) {
    const row = rowFor(html, body.body);
    assert.ok(row.includes(escape(body.degreeLabel)), body.body);
    assert.doesNotMatch(row, /\d+°/);
  }
  assert.match(html, /0° Bélier/);
});

test("les heures approximatives et intervalles gardent leur incertitude explicite", () => {
  const approximate = socleFor("fr", { timePrecision: "approximate", timeMarginMinutes: 30 });
  const html = chartBlockHtml(approximate);
  assert.match(html, /12:30 \(heure approximative ±30 min\)/);
  assert.doesNotMatch(rowFor(html, "Sun"), /±30 min/);
  assert.match(html, /Positions indicatives à l’heure de naissance indiquée/);
  assert.match(html, /class="natal-uncertainty-legend">Arc et \? : position incertaine dans la plage de naissance/);
  if (approximate.housesDecidableWithinMargin === false) assert.doesNotMatch(html, /class="natal-house"/);
  const interval = socleFor("fr", { timePrecision: "interval", timeValue: undefined, timeStart: "11:30", timeEnd: "13:30" });
  assert.match(chartBlockHtml(interval), /11:30 – 13:30/);
});

test("un ancien socle sans métadonnées de naissance utilise ses seuls faits existants", () => {
  const socle = socleFor();
  delete socle.birth;
  const html = chartBlockHtml(socle);
  assert.match(html, /15 janvier 1990/);
  assert.match(html, /12:30 \(exacte\)/);
  assert.match(html, /Paris, France/);
  socle.facts = [];
  const missing = chartBlockHtml(socle);
  assert.match(missing, /heure inconnue/);
  assert.doesNotMatch(missing, /15 janvier 1990|12:30|Paris, France/);
});

test("les neuf langues disposent d’un titre, des positions et d’une légende localisés", () => {
  for (const { code } of LANGUAGES) {
    const socle = socleFor(code);
    const labels = natalChartLabels(code);
    const html = chartBlockHtml(socle, docStrings(code));
    assert.ok(html.includes(`<h2>${escape(labels.title)}</h2>`), code);
    assert.ok(html.includes(escape(labels.legend)), code);
    assert.ok(html.includes(escape(labels.aspects)), code);
    assert.doesNotMatch(html, /class="natal-uncertainty-legend"/);
    const uncertain = chartBlockHtml(socleFor(code, { timePrecision: "unknown", timeValue: undefined }), docStrings(code));
    assert.ok(uncertain.includes(escape(labels.uncertainty)), `${code}/uncertainty`);
    for (const body of socle.bodies) assert.ok(rowFor(html, body.body).includes(escape(body.degreeLabel)), `${code}/${body.body}`);
    if (code !== "fr") assert.doesNotMatch(html, /Thème natal|Les traits relient|heure inconnue/);
  }
});

test("la légende distingue les trois familles de tracés et explique les repères sans promettre d’événement", () => {
  const html = chartBlockHtml(socleFor());
  for (const kind of ["harmony", "tension", "conjunction"]) assert.match(html, new RegExp(`class="legend-line ${kind}"`));
  assert.match(html, /sans classement automatique/);
  assert.match(html, /AC : Ascendant · DS : Descendant · MC : Milieu du Ciel · FC : Fond du Ciel/);
  assert.match(html, /degré calculé/);
  assert.match(html, /ne prédisent aucun événement/);
});
