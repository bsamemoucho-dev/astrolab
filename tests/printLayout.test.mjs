// Contrats de mise en page du document livré, et cohérence du formulaire public.
//
// Deux retours d'un vrai PDF :
//   - la page était trop serrée (marges faibles, blocs condensés) et un titre de
//     section restait seul en bas de page ;
//   - taper la ville de naissance des parents ne déclenchait aucune reconnaissance,
//     ni pour le père ni pour la mère.
//
// Ces deux contrôles portent sur le document RÉELLEMENT produit (la CSS embarquée
// dans le HTML) et sur la liste de câblage du formulaire, pas sur une intention.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { docStrings } from "../src/deliverables/i18n.mjs";
import { annexSections, renderDossierHtml } from "../src/deliverables/render.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = renderDossierHtml({
  title: "Lecture de test",
  personLabel: "Test",
  createdAt: "2026-09-11T00:00:00.000Z",
  writerMode: "llm",
  sections: [{ id: "introduction", title: "Votre ciel en un coup d'œil", badgeCode: "symbolic", badgeLabel: "x", kind: "symbolic", text: "Un paragraphe." }, ...annexSections({ facts: [], uncertaintyNotes: [], warnings: [], person: {} }, docStrings("fr"))]
});
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

test("l'impression laisse 2 cm de marge tout autour", () => {
  assert.match(css, /@page\s*\{\s*margin\s*:\s*2cm\s*;?\s*\}/);
  // La marge doit venir de la page, pas s'ajouter à un rembourrage de feuille :
  // sinon la marge réelle est la somme des deux.
  assert.match(css, /\.sheet\s*\{[^}]*padding\s*:\s*0/);
});

test("l'interligne et l'espacement des blocs aèrent le document", () => {
  const interligne = css.match(/p\s*\{[^}]*line-height\s*:\s*([\d.]+)/);
  assert.ok(interligne, "la règle de paragraphe doit fixer un interligne");
  assert.ok(Number(interligne[1]) >= 1.5, `interligne trop serré : ${interligne[1]}`);
  // Un espace entre paragraphes, et pas seulement l'interligne.
  assert.match(css, /p\s*\{[^}]*margin\s*:\s*0\s+0\s+[\d.]+em/);
  // Les sections respirent.
  const section = css.match(/section\.block\s*\{\s*margin-top\s*:\s*([\d.]+)em/);
  assert.ok(section && Number(section[1]) >= 2, "les sections doivent être nettement séparées");
});

test("un titre ne peut plus rester seul en bas de page", () => {
  assert.match(css, /h1,\s*h2,\s*h3,\s*h4\s*\{[^}]*break-after\s*:\s*avoid/);
  assert.match(css, /h2\s*\+\s*p[^{]*\{[^}]*break-before\s*:\s*avoid/);
  // Lignes orphelines et veuves encadrées.
  assert.match(css, /orphans\s*:\s*3/);
  assert.match(css, /widows\s*:\s*3/);
});

test("l'annexe reste visible à l'impression", () => {
  assert.match(css, /details\.annex\s*>\s*\.block-body\s*\{[^}]*display\s*:\s*block\s*!important/);
  assert.match(css, /details\.annex\s*>\s*summary\s*\{\s*display\s*:\s*none/);
});

test("tout champ de lieu du parcours public est branché sur la reconnaissance", () => {
  const page = readFileSync(path.join(RACINE, "public/index.html"), "utf8");
  const script = readFileSync(path.join(RACINE, "public/app.js"), "utf8");

  // Champs de lieu présents dans le formulaire public, et leurs encadrés.
  const champsPage = [...page.matchAll(/name="([a-zA-Z]*BirthPlace)"/g)].map((match) => match[1]);
  assert.ok(champsPage.includes("motherBirthPlace"), "le champ du lieu de naissance de la mère doit exister");
  assert.ok(champsPage.includes("fatherBirthPlace"), "le champ du lieu de naissance du père doit exister");

  // Liste de câblage : nom du champ → encadré de résultat.
  const bloc = script.match(/const EXPRESS_PLACE_FIELDS = \[([\s\S]*?)\];/);
  assert.ok(bloc, "la liste de câblage des champs de lieu doit exister");
  const cables = [...bloc[1].matchAll(/\["([a-zA-Z]+)",\s*"([a-z-]+)"\]/g)].map((match) => [match[1], match[2]]);

  for (const champ of new Set(champsPage)) {
    const entree = cables.find(([nom]) => nom === champ);
    assert.ok(entree, `${champ} n'est branché sur aucune reconnaissance de lieu`);
    assert.ok(
      page.includes(`id="${entree[1]}"`),
      `l'encadré ${entree[1]} de ${champ} n'existe pas dans la page`
    );
  }
});
