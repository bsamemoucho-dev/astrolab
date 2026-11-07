import assert from "node:assert/strict";
import test from "node:test";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { chartBlockHtml } from "../src/deliverables/chart.mjs";
import { docStrings, LANGUAGES } from "../src/deliverables/i18n.mjs";
import { renderDossierHtml } from "../src/deliverables/render.mjs";
import { buildSocle } from "../src/deliverables/socle.mjs";

const chart = { id: "chart", kind: "chart", html: '<div class="verified-chart">Calculated chart</div>' };
const chapters = [
  { id: "identity", title: "Identité", text: "Premier paragraphe.\n\nSecond paragraphe.", kind: "symbolic" },
  { id: "missing", title: "Unavailable title", text: "Unavailable prose", badgeCode: "unavailable" },
  { id: "conclusion", title: "Conclusion", text: "Conclusion de la lecture.", kind: "symbolic" },
  { id: "annex", title: "Annexe calculée", text: "| Point | Valeur |\n|---|---|\n| Corps | Donnée |", kind: "annex" }
];
const render = (sections, options = {}) => renderDossierHtml({ title: "Lecture", personLabel: "Personne fictive", createdAt: "2026-11-01", sections, ...options });
const body = (html) => html.slice(html.indexOf("<body>"));

test("the compact contents links to every visible section once, after the chart", () => {
  const before = structuredClone([chart, ...chapters]);
  const html = body(render([chart, ...chapters]));
  const contents = html.match(/<nav class="dossier-contents"[^]*?<\/nav>/)?.[0];
  assert.ok(contents);
  assert.ok(html.indexOf('class="verified-chart"') < html.indexOf('<nav class="dossier-contents"'));
  assert.ok(html.indexOf('<nav class="dossier-contents"') < html.indexOf('<h2>Identité</h2>'));
  const links = [...contents.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  const anchors = [...html.matchAll(/class="section-anchor" id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(links.length, 4);
  assert.deepEqual(links, anchors);
  assert.equal(new Set(anchors).size, anchors.length);
  assert.doesNotMatch(html, /Unavailable title|Unavailable prose/);
  assert.match(html, /<div class="block-body"><p>Premier paragraphe\.<\/p>\n<p>Second paragraphe\.<\/p>/);
  assert.deepEqual([chart, ...chapters], before);
});

test("contents work without a chart and omit empty or single-section navigation", () => {
  assert.ok(body(render(chapters)).indexOf('<nav class="dossier-contents"') < body(render(chapters)).indexOf('<h2>Identité</h2>'));
  assert.doesNotMatch(body(render([])), /dossier-contents/);
  assert.doesNotMatch(body(render([chapters[0]])), /dossier-contents/);
});

for (const { code } of LANGUAGES) {
  test(`contents retain localized navigation and escape untrusted titles (${code})`, () => {
    const html = body(render([chart, { ...chapters[0], id: '\"><script>', title: '<script>alert("x")</script>' }, chapters[3]], { strings: docStrings(code) }));
    const contents = html.match(/<nav class="dossier-contents"[^]*?<\/nav>/)?.[0];
    assert.ok(contents);
    assert.match(contents, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>|id="[^"]*script/);
    assert.equal((html.match(/Annexe calculée/g) ?? []).length, 1, "annex heading is not duplicated in navigation");
    if (code !== "fr") assert.doesNotMatch(contents, /Sommaire|Carte du ciel|Annexe de calcul/);
  });
}

test("page numbering comes from native page counters, preserving page geometry and economical cover", () => {
  const html = render([chart, ...chapters]);
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.match(css, /@page\{\s*@bottom-center\{content:counter\(page\) " \/ " counter\(pages\)/);
  assert.match(css, /@page :first\{\s*@bottom-center\{content:none\}/);
  assert.match(css, /\.cover-page\{background:linear-gradient\(155deg,#fffdf9 0%,#f5f0f8 66%,#eee4f1 100%\);color:var\(--ink\);[^}]*print-color-adjust:exact/);
  assert.match(css, /\.block-body > p,\.dossier-subsection > p\{break-inside:avoid-page;page-break-inside:avoid\}/);
  assert.match(css, /section\.block\.chart-page\{[^}]*break-after:auto;page-break-after:auto/);
  assert.doesNotMatch(css, /counter-increment:page/);
  assert.match(html, /<div class="cover-name">Personne fictive<\/div>/);
});

test("calculated distributions and their uncertainty note are an indivisible chart group", () => {
  const calculation = calculateWesternNatalChart({ birthDate: "1990-01-15", timeValue: "12:30", timePrecision: "approximate", timeMarginMinutes: 30, latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" });
  const socle = buildSocle(calculation.result, docStrings("fr"));
  const before = structuredClone(socle);
  const html = chartBlockHtml(socle, docStrings("fr"));
  const group = html.slice(html.indexOf('<div class="chart-distribution-group">'));
  assert.match(group, /^<div class="chart-distribution-group">\s*<div class="chart-distributions">/);
  assert.match(group, /<p class="footer-note chart-distribution-note">[^]*<\/p>\s*<\/div>$/);
  assert.match(group, /lastro-distribution@1\.1\.0/);
  assert.match(group, /Ascendant indécis/);
  assert.deepEqual(socle, before, "layout must not alter calculated facts");
});


test("short emotional and closing chapters remain one block; long chapters may flow", () => {
  const short = body(render([{ id: "emotional_world", title: "Monde émotionnel", kind: "symbolic", text: "Un premier paragraphe.\n\nUn deuxième paragraphe." }]));
  assert.match(short, /<div class="chapter-compact">[^]*<h2>Monde émotionnel<\/h2>[^]*<p>Un premier paragraphe/);
  const long = body(render([{ id: "emotional_world", title: "Monde émotionnel", kind: "symbolic", text: "Mot ".repeat(181) }]));
  assert.doesNotMatch(long, /class="chapter-compact"/);
  const withLongSubsection = body(render([{ id: "emotional_world", title: "Monde émotionnel", text: "Court.", subsections: [{ title: "Complément", text: "Mot ".repeat(181) }] }]));
  assert.doesNotMatch(withLongSubsection, /class="chapter-compact"/);
});


test("the compact chapter boundary counts calculated references and preserves all prose", () => {
  const chapter = { id: "conclusion", title: "Conclusion", kind: "symbolic", text: "Mot ".repeat(180).trim() };
  assert.match(body(render([chapter])), /class="chapter-compact"/);
  const extended = { ...chapter, calculatedReferences: ["Repère supplémentaire"], calculatedReferencesLabel: "Repères" };
  const html = body(render([extended]));
  assert.doesNotMatch(html, /class="chapter-compact"/);
  assert.match(html, /Repère supplémentaire/);
  assert.equal((html.match(/Mot/g) ?? []).length, 180);
});
