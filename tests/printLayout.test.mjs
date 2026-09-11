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

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { docStrings } from "../src/deliverables/i18n.mjs";
import { annexSections, markdownToHtml, renderDossierHtml, renderDossierMarkdown } from "../src/deliverables/render.mjs";
import { buildSocle, renderSocleAnnex } from "../src/deliverables/socle.mjs";

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

test("l'annexe commence sur une nouvelle page à l'impression", () => {
  assert.match(css, /@media print \{[\s\S]*\.annex \{[^}]*break-before:page/);
  assert.match(css, /@media print \{[\s\S]*\.annex \{[^}]*page-break-before:always/);
  // Elle ne doit pas non plus flotter en bas de page : rien ne la retient.
  assert.match(css, /@media print \{[\s\S]*\.annex \{[^}]*margin-top:0/);
});

test("l'annexe est toujours visible : aucun détail cliquable", () => {
  // Le repli était la cause d'une annexe absente du PDF, et un document payant
  // ne doit pas avoir de contenu caché derrière un clic.
  assert.doesNotMatch(html, /<details/);
  assert.doesNotMatch(css, /details\.annex/);
  assert.match(html, /<section class="block annex">/);
  // Elle reste encadrée à l'écran, sobre à l'impression.
  assert.match(css, /\.annex \{[^}]*border:1px solid/);
  assert.match(css, /@media print \{[\s\S]*\.annex \{ border:0; background:none/);
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

test("la couverture porte les trois placements, avec leur fragilité", () => {
  const socle = buildSocle(
    calculateWesternNatalChart({
      birthDate: "1990-01-15",
      timeValue: "12:30",
      timePrecision: "approximate",
      timeMarginMinutes: 30,
      latitude: 48.8566,
      longitude: 2.3522,
      timeZone: "Europe/Paris"
    }).result,
    docStrings("fr")
  );
  const document = renderDossierHtml({
    title: "Lecture de test",
    personLabel: "Caro",
    createdAt: "2026-09-11T00:00:00.000Z",
    writerMode: "llm",
    sections: [],
    strings: docStrings("fr"),
    cover: socle.cover
  });
  // Les trois placements sont là…
  assert.match(document, /class="cover-card-label">Soleil</);
  assert.match(document, /class="cover-card-label">Lune</);
  assert.match(document, /class="cover-card-label">Ascendant</);
  // …et l'Ascendant n'est pas affirmé : la frontière est franchie dans la marge,
  // donc les deux signes possibles sont écrits, avec la mention.
  assert.match(document, /class="cover-card-value">Bélier \/ Taureau</);
  assert.match(document, /class="cover-card-precision">non décidable</);
  // Une couverture sans données ne doit pas produire de cartes vides.
  const sansCover = renderDossierHtml({
    title: "Lecture",
    personLabel: null,
    createdAt: "2026-09-11T00:00:00.000Z",
    writerMode: "llm",
    sections: [],
    strings: docStrings("fr")
  });
  // On regarde le CORPS : la CSS contient forcément les règles .cover-cards.
  assert.doesNotMatch(sansCover.slice(sansCover.indexOf("<body>")), /cover-cards/);
});

test("le tableau des positions est un vrai tableau, avec en-tête répétable", () => {
  const socle = buildSocle(
    calculateWesternNatalChart({
      birthDate: "1990-01-15",
      timeValue: "12:30",
      timePrecision: "exact",
      latitude: 48.8566,
      longitude: 2.3522,
      timeZone: "Europe/Paris"
    }).result,
    docStrings("fr")
  );
  const annexe = renderSocleAnnex(socle, docStrings("fr"));
  // Sept corps, plus l'Ascendant et le Milieu du Ciel.
  const lignes = annexe.split("\n").filter((ligne) => /^\| [^|]+ \|/.test(ligne) && !/^\|[-: ]+\|/.test(ligne));
  assert.equal(lignes.length, 10, `lignes de tableau : ${lignes.length}`);
  assert.match(annexe, /\| Planète \| Signe \| Degré \| Maison \| Rétrograde \|/);

  const document = renderDossierHtml({
    title: "Lecture",
    personLabel: null,
    createdAt: "2026-09-11T00:00:00.000Z",
    writerMode: "llm",
    sections: annexSections(socle, docStrings("fr"))
  });
  assert.match(document, /<table><thead><tr><th>Planète<\/th>/);
  assert.match(document, /<tbody>.*<td>Soleil<\/td>/);
  // L'en-tête doit se répéter si le tableau se poursuit page suivante.
  assert.match(document, /thead \{ display:table-header-group/);
});

test("une heure approximative écrit la marge dans la cellule du degré", () => {
  const socle = buildSocle(
    calculateWesternNatalChart({
      birthDate: "1990-01-15",
      timeValue: "12:30",
      timePrecision: "approximate",
      timeMarginMinutes: 30,
      latitude: 48.8566,
      longitude: 2.3522,
      timeZone: "Europe/Paris"
    }).result,
    docStrings("fr")
  );
  const annexe = renderSocleAnnex(socle, docStrings("fr"));
  assert.match(annexe, /\| Soleil \| Capricorne \| [^|]*\(±30 min\) \|/);
  // Les maisons ne sont pas décidables dans cette marge : la cellule reste vide.
  assert.match(annexe, /\| Soleil \| Capricorne \| [^|]+\| — \| — \|/);
});

test("l'export Markdown ne contient ni horodatage brut ni carte", () => {
  const socle = buildSocle(
    calculateWesternNatalChart({
      birthDate: "1990-01-15",
      timeValue: "12:30",
      timePrecision: "exact",
      latitude: 48.8566,
      longitude: 2.3522,
      timeZone: "Europe/Paris"
    }).result,
    docStrings("fr")
  );
  const markdown = renderDossierMarkdown({
    title: "Lecture",
    personLabel: "Caro",
    createdAt: "2026-09-11T09:29:18.661Z",
    sections: [],
    strings: docStrings("fr"),
    cover: socle.cover
  });
  assert.doesNotMatch(markdown, /2026-09-11T09:29:18/);
  assert.match(markdown, /\*\*Ascendant\*\* : Taureau/);
});

test("le rendu Markdown des tableaux n'avale pas ce qui suit", () => {
  const html = markdownToHtml(
    ["| A | B |", "|---|---|", "| 1 | 2 |", "", "Un paragraphe.", "", "- une puce", "", "## Un titre"].join("\n")
  );
  assert.match(html, /<table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /<p>Un paragraphe\.<\/p>/);
  assert.match(html, /<ul><li>une puce<\/li><\/ul>/);
  assert.match(html, /<h3>Un titre<\/h3>/);
  // La ligne de séparation ne doit pas devenir une ligne du tableau.
  assert.doesNotMatch(html, /<td>-{2,}<\/td>/);
});

test("le nom de fichier proposé vient du document, pas de l'application", () => {
  const script = readFileSync(path.join(RACINE, "public/app.js"), "utf8");
  // Le titre est lu dans le HTML imprimé, puis appliqué à la page hôte : sans
  // cela le PDF enregistré s'appelait « Lastro — Lecture symbolique … ».
  assert.match(script, /function titreDuDocument\(html\)/);
  assert.match(script, /document\.title = titre/);
  assert.match(script, /document\.title = titrePage/);
  assert.match(script, /function nomDeFichier\(titre, extension/);
  // Les téléchargements HTML et Markdown portent le nom de la lecture.
  assert.match(script, /link\.download = nomDeFichier\(titreDuDocument\(state\.guestReading\.html\), "html"\)/);
  assert.match(script, /link\.download = nomDeFichier\(titreDuDocument\(state\.guestReading\.html\), "md"\)/);
  // La page ne porte plus de détail cliquable nulle part.
  assert.doesNotMatch(readFileSync(path.join(RACINE, "public/index.html"), "utf8"), /<details[^>]*annex/i);
});
