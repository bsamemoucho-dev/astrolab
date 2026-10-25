import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chartGlossarySection, CHART_GLOSSARY_VERSION } from "../src/deliverables/chartGlossary.mjs";
import { LANGUAGES, docStrings } from "../src/deliverables/i18n.mjs";
import { annexSections, renderDossierHtml, renderDossierMarkdown } from "../src/deliverables/render.mjs";
import { renderSocleAnnex } from "../src/deliverables/socle.mjs";

function domainRows(markdown) {
  const table = markdown.split("\n\n").at(-1);
  return table.split("\n").slice(2).map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()));
}

for (const { code } of LANGUAGES) {
  test(`chart glossary: twelve numbered houses and six terms remain visible in HTML and Markdown (${code})`, () => {
    const strings = docStrings(code), before = structuredClone(strings);
    const section = chartGlossarySection(strings);
    const domains = domainRows(section.text);
    assert.equal(domains.length, 12);
    assert.deepEqual(domains.map(([house]) => Number(house.match(/(\d+)$/u)?.[1])), Array.from({ length: 12 }, (_, i) => i + 1));
    assert.equal(section.text.split("\n\n")[1].split("\n").length, 8, "six definitions plus table header and separator");
    const html = renderDossierHtml({ title: "Reference fixture", personLabel: null, createdAt: "2026-10-25T12:00:00Z", sections: [section], strings });
    const markdown = renderDossierMarkdown({ title: "Reference fixture", personLabel: null, createdAt: "2026-10-25T12:00:00Z", sections: [section], strings });
    assert.ok(html.includes(`<h2>${section.title}</h2>`));
    assert.equal((html.match(/<tbody>/gu) ?? []).length, 2);
    assert.equal((html.match(/<tr>/gu) ?? []).length, 20, "both headers and eighteen reference rows");
    for (const [house, domain] of domains) {
      assert.ok(html.includes(`<td>${house}</td><td>${domain}</td>`));
      assert.ok(markdown.includes(`| ${house} | ${domain} |`));
    }
    assert.doesNotMatch(html, /<details|<summary/);
    assert.deepEqual(strings, before);
    if (code !== "fr") assert.doesNotMatch(section.text, /Domaine symbolique|Ces repères expliquent|Maison 5/);
  });
}

test("the glossary is general symbolic vocabulary, not an extra calculated or generated chapter", () => {
  const section = chartGlossarySection(docStrings("fr"));
  assert.equal(section.kind, "reference");
  assert.equal(section.provider, "reference");
  assert.equal(section.badgeCode, "symbolic");
  assert.equal(section.referenceVersion, CHART_GLOSSARY_VERSION);
  assert.equal(section.validation.scope, "general_reference_only");
  assert.equal(section.blocks, undefined);
  assert.equal(section.claims, undefined);
  assert.match(section.text, /conventions symboliques/);
  assert.match(section.text, /ne décrivent pas à eux seuls votre personnalité/);
  for (const term of ["Signe", "Maison", "Aspect", "Ascendant (AC)", "Orbe réel", "Orbe maximal"]) assert.ok(section.text.includes(`| ${term} |`));
  assert.match(section.text, /angle mesuré et l’angle exact/);
  assert.match(section.text, /Seuil de tolérance/);
});

test("the French house domains reproduce only the twelve published guide entries", () => {
  const guide = readFileSync(new URL("../public/guides/maisons-astrologiques.html", import.meta.url), "utf8");
  const published = [...guide.matchAll(/<tr><th scope="row">(Maison \d+)<\/th><td>([^<]+)<\/td><\/tr>/gu)].map((match) => [match[1], match[2]]);
  assert.equal(published.length, 12);
  assert.deepEqual(domainRows(chartGlossarySection(docStrings("fr")).text), published);
});

test("the glossary precedes the unchanged calculated annex without receiving or changing personal facts", () => {
  const socle = { facts: [{ id: "fixture.reference", label: "Fixture", value: "PRIVATE_FIXTURE_REFERENCE" }], uncertaintyNotes: [], warnings: [], person: { firstName: "Fictional" } };
  const strings = docStrings("fr"), before = structuredClone(socle);
  const sections = annexSections(socle, strings);
  assert.equal(sections.length, 2);
  assert.equal(sections[1].id, "annexe-socle");
  assert.equal(sections[1].text, renderSocleAnnex(socle, strings));
  assert.equal(sections[1].badgeCode, "calculated");
  assert.equal(sections[0].id, "comprendre-votre-carte");
  assert.deepEqual(sections[0], chartGlossarySection(strings));
  assert.doesNotMatch(sections[0].text, /PRIVATE_FIXTURE_REFERENCE|Fictional/);
  assert.deepEqual(socle, before);
  const html = renderDossierHtml({ title: "Reference fixture", personLabel: null, createdAt: "2026-10-25T12:00:00Z", sections, strings });
  assert.ok(html.indexOf(sections[0].title) < html.indexOf(strings.annexTitle));
  assert.match(html, /section\.block\.reference,footer\{break-inside:avoid;page-break-inside:avoid\}/);
  assert.match(html, /@media print\{[\s\S]*?section\.block\.reference\{margin-top:1\.6em\}/);
  assert.match(html, /@media print\{[\s\S]*?\.annex-gap\{display:none\}/);
  assert.equal((html.match(/class="block annex"/gu) ?? []).length, 1, "the glossary does not force a second calculated-annex page");
});

test("the initial guest document uses the light public theme before scripts run", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /<body class="guest">/);
});
