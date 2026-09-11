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

test("l'impression laisse 2 cm de marge sur TOUTES les pages", () => {
  // Le modèle « rembourrage de la feuille » ne tenait que la première page : le
  // rembourrage d'une boîte s'applique une fois, pas à chaque page. Mesuré sur le
  // PDF livré : texte à 4,5 mm du haut et 7 mm du bas.
  assert.match(css, /@page\s*\{\s*size\s*:\s*A4\s*;\s*margin\s*:\s*20mm\s*;?\s*\}/);
  // La couverture reste pleine page : seule la première page est sans marge.
  assert.match(css, /@page\s*:first\s*\{\s*margin\s*:\s*0\s*;?\s*\}/);
  assert.match(css, /@media print\s*\{[\s\S]*\.sheet\s*\{[^}]*padding\s*:\s*0/);
  // Et la feuille ne remet pas de marges par-dessus celles de la page.
  assert.doesNotMatch(css, /@media print\s*\{[\s\S]*\.sheet\s*\{[^}]*padding\s*:\s*20mm/);
  // L'écran garde sa feuille A4 et son rembourrage de 2 cm.
  assert.match(css, /(^|\n)\s*\.sheet\{[^}]*padding:20mm/);
});

test("deux lignes vides séparent le texte de l'annexe", () => {
  assert.match(css, /\.annex-gap\{height:calc\(2 \* var\(--interligne\) \* 14\.5px\)\}/);
  assert.match(html, /<div class="annex-gap" aria-hidden="true"><\/div>\s*<section class="block annex">/);
  // Et dans l'export Markdown.
  const markdown = renderDossierMarkdown({
    title: "Lecture de test",
    personLabel: "Test",
    createdAt: "2026-09-11T00:00:00.000Z",
    sections: annexSections({ facts: [], uncertaintyNotes: [], warnings: [], person: {} }, docStrings("fr"))
  });
  assert.match(markdown, /\n\n\n## Annexe/);
});

test("l'interligne et l'espacement des blocs aèrent le document", () => {
  // Demande explicite du client : « vraiment plus d'espace entre les lignes,
  // peut-être 2 ou 2,5 ». Une seule valeur pilote tout le texte lu.
  const variable = css.match(/--interligne\s*:\s*([\d.]+)/);
  assert.ok(variable, "l'interligne doit être piloté par une variable");
  assert.ok(Number(variable[1]) >= 2, `interligne trop serré : ${variable[1]}`);
  // Et le texte lu s'en sert réellement (l'ancien test mesurait « footer p » par
  // accident, et validait 1,55 sans que le corps du texte soit concerné).
  assert.match(css, /(^|\n)\s*p\{[^}]*line-height:var\(--interligne\)/, "la règle de paragraphe doit utiliser l'interligne");
  assert.match(css, /\.annex p,\.annex li\{[^}]*line-height:var\(--interligne\)/);
  // Un espace entre paragraphes, et pas seulement l'interligne.
  assert.match(css, /(^|\n)\s*p\{[^}]*margin\s*:\s*0\s+0\s+[\d.]+em/);
  // Les sections respirent.
  const section = css.match(/section\.block\s*\{\s*margin-top\s*:\s*([\d.]+)em/);
  assert.ok(section && Number(section[1]) >= 2, "les sections doivent être nettement séparées");
});

test("le texte est justifié des deux côtés, avec césure", () => {
  assert.match(css, /(^|\n)\s*p\{[^}]*text-align:justify/);
  assert.match(css, /(^|\n)\s*p\{[^}]*hyphens:auto/);
  assert.match(css, /(^|\n)\s*p\{[^}]*text-justify:inter-word/);
  // Ce qui ne se justifie pas : titres, tableaux, légendes, notes de pied.
  assert.match(css, /h1,h2,h3,h4,th,td,[^{]*\{[^}]*text-align:initial/);
});

test("aucune règle d'écran ne peut s'appliquer au papier", () => {
  // La panne livrée : `@media (max-width:900px)` est VRAIE à l'impression (une
  // page A4 fait 794 px de large). Placée après le bloc d'impression et de même
  // spécificité, elle remplaçait les 2 cm de marge par 20 px. Toute requête de
  // largeur qui couvre la largeur d'une A4 doit donc être réservée à l'écran.
  const LARGEUR_A4_PX = 794;
  const requetes = [...css.matchAll(/@media([^{]*)\{/g)].map((m) => m[1].trim());
  assert.ok(requetes.length >= 2, "les blocs de média doivent exister");
  for (const requete of requetes) {
    if (/^print\b/.test(requete)) continue;
    if (/^screen\b/.test(requete)) continue;
    const largeur = /max-width\s*:\s*(\d+)px/.exec(requete);
    if (largeur) {
      assert.ok(
        Number(largeur[1]) < LARGEUR_A4_PX,
        `« @media ${requete} » s'applique aussi à l'impression A4 : ajoutez « screen and »`
      );
    }
  }
  assert.match(css, /@media screen and \(max-width:900px\)/);
});

test("le titre de l'annexe n'apparaît qu'une fois", () => {
  // Le document livré affichait deux fois de suite « Annexe — socle de calcul
  // vérifié » : une fois par le titre de section, une fois au début du texte.
  const titre = docStrings("fr").annexTitle;
  const occurrences = html.split(titre).length - 1;
  assert.equal(occurrences, 1, `le titre de l'annexe doit apparaître une fois (${occurrences})`);

  const markdown = renderDossierMarkdown({
    title: "Lecture de test",
    personLabel: "Test",
    createdAt: "2026-09-11T00:00:00.000Z",
    sections: annexSections({ facts: [], uncertaintyNotes: [], warnings: [], person: {} }, docStrings("fr"))
  });
  assert.equal(markdown.split(titre).length - 1, 1, "idem dans l'export Markdown");
});

test("un titre ne peut plus rester seul en bas de page", () => {
  assert.match(css, /h1,\s*h2,\s*h3,\s*h4\s*\{[^}]*break-after\s*:\s*avoid/);
  assert.match(css, /h2\s*\+\s*p[^{]*\{[^}]*break-before\s*:\s*avoid/);
  // Lignes orphelines et veuves encadrées.
  assert.match(css, /orphans\s*:\s*3/);
  assert.match(css, /widows\s*:\s*3/);
});

test("l'annexe commence sur une nouvelle page à l'impression", () => {
  assert.match(css, /section\.block\.annex\s*\{[^}]*break-before:page/);
  assert.match(css, /section\.block\.annex\s*\{[^}]*page-break-before:always/);
  // Elle ne doit pas non plus flotter en bas de page : rien ne la retient.
  assert.match(css, /section\.block\.annex\s*\{[^}]*margin-top:0/);
});

test("l'annexe est toujours visible : aucun détail cliquable", () => {
  // Le repli était la cause d'une annexe absente du PDF, et un document payant
  // ne doit pas avoir de contenu caché derrière un clic.
  assert.doesNotMatch(html, /<details/);
  assert.doesNotMatch(css, /details\.annex/);
  assert.match(html, /<section class="block annex">/);
  // Elle reste encadrée à l'écran, sobre à l'impression.
  assert.match(css, /\.annex\s*\{[^}]*border:1px solid/);
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
  assert.match(document, /<small>Soleil<\/small>/);
  assert.match(document, /<small>Lune<\/small>/);
  assert.match(document, /<small>Ascendant<\/small>/);
  // …et l'Ascendant n'est pas affirmé : la frontière est franchie dans la marge,
  // donc les deux signes possibles sont écrits, avec la mention.
  assert.match(document, /<b>Bélier \/ Taureau<\/b>/);
  assert.match(document, /<i>non décidable<\/i>/);
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
  assert.doesNotMatch(sansCover.slice(sansCover.indexOf("<body>")), /big-three/);
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
  assert.match(document, /thead\s*\{\s*display\s*:\s*table-header-group/);
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
