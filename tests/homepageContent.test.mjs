// Contenu de la page d'accueil publique (hero + section pédagogique).
//
// Ces tests vérifient la structure et les formulations exactes affichées aux
// visiteurs, sans navigateur : ils lisent directement les fichiers servis
// (public/index.html, public/app.js, public/styles.css).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const indexHtml = read("public/index.html");
const appJs = read("public/app.js");
const styles = read("public/styles.css");

const TITLE = "Votre signe n’est que le début de l’histoire";
const LEAD =
  "Quand vous dites « Je suis Balance ou Capricorne », vous parlez de votre signe solaire : la position du Soleil dans le zodiaque au moment de votre naissance.";
const INTRO_PEDAGOGY =
  "Mais ce jour-là, la Lune, Mercure, Vénus, Mars et les autres planètes occupaient chacune un signe, souvent différent. Vous n’avez donc pas un seul signe : vous avez tout un thème à explorer.";
const HIGHLIGHT = "Vous n’avez donc pas un seul signe : vous avez tout un thème à explorer.";
const ASTRES = [
  ["le Soleil", "ce que vous cherchez à incarner ;"],
  ["la Lune", "vos besoins émotionnels ;"],
  ["Mercure", "votre manière de penser et de communiquer ;"],
  ["Vénus", "ce que vous aimez et ce qui compte pour vous ;"],
  ["Mars", "votre manière d’agir et de vous affirmer."]
];
const SENTENCE_2 = "Dans la tradition astrologique, chaque astre représente symboliquement une dimension de votre personnalité, et le signe qu’il occupe colore son expression :";
const SENTENCE_3 = "C’est pourquoi deux personnes du même signe solaire peuvent avoir des thèmes très différents.";
const SENTENCE_4 = "Les planètes entretiennent aussi des relations entre elles. Certaines configurations sont traditionnellement associées à des tensions, d’autres à des ressources ou à des équilibres. C’est cet ensemble que Lastro explore.";
const SENTENCE_5 = "À partir de vos informations de naissance, Lastro calcule la position des astres et leurs relations, puis construit une lecture symbolique de votre thème. Ce n’est pas un verdict sur qui vous êtes, ni une certitude sur ce que vous deviendrez : c’est une autre manière de vous questionner et de réfléchir à votre propre histoire.";
const SIGNATURE = "Car au fond, personne ne peut décider à votre place de ce qui vous ressemble.";

const stripTags = (html) => html.replace(/<[^>]+>/g, "");
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const textOf = (html) => normalize(stripTags(html));

/** Bloc HTML d'une vue : de son ouverture à l'ouverture de la vue suivante. */
function viewBlock(id) {
  const start = indexHtml.indexOf(`<section id="${id}"`);
  assert.notEqual(start, -1, `vue ${id} absente`);
  const next = indexHtml.indexOf("\n        <section ", start + 10);
  return indexHtml.slice(start, next === -1 ? undefined : next);
}

const expressView = viewBlock("express-view");
const heroStart = expressView.indexOf('id="guest-hero"');
const heroEnd = expressView.indexOf('<div class="pedagogy"');
const pedagogyStart = expressView.indexOf('<div class="pedagogy"');
const pedagogyEnd = expressView.indexOf('<div class="express-wrap"');

const hero = expressView.slice(heroStart, heroEnd);
const pedagogy = expressView.slice(pedagogyStart, pedagogyEnd);

test("le hero de l'accueil porte le nouveau titre en H1 unique", () => {
  const h1s = hero.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) || [];
  assert.equal(h1s.length, 1, "le hero doit contenir exactement un H1");
  assert.equal(textOf(h1s[0]), TITLE);
  // La phrase du titre reste intacte : seule la couleur change sur le dernier segment.
  assert.match(h1s[0], /<span>le début de l’histoire<\/span>/);
  assert.equal(textOf(h1s[0].replace(/<span>/g, "").replace(/<\/span>/g, "")), TITLE);
  // Aucun autre H1 dans la vue d'accueil (pas de titre concurrent).
  assert.equal((expressView.match(/<h1\b/g) || []).length, 1);
});

test("le titre et l'introduction français sont identiques dans le HTML et dans les libellés", () => {
  const lead = hero.match(/<p class="guest-lead">([\s\S]*?)<\/p>/);
  assert.ok(lead, "paragraphe d'introduction absent");
  assert.equal(textOf(lead[1]), LEAD);

  const frBlock = appJs.slice(appJs.indexOf("  fr: {"), appJs.indexOf("  en: {"));
  assert.match(frBlock, /heroTitle: "Votre signe n’est que <span>le début de l’histoire<\/span>"/);
  assert.ok(
    frBlock.includes(`lead: "${LEAD}"`),
    "UI.fr.lead doit reprendre exactement l'introduction (app.js réécrit le paragraphe au démarrage)"
  );
});

test("l'introduction est rendue au-dessus du bouton principal, lui-même au-dessus de la section pédagogique", () => {
  const leadIndex = hero.indexOf('class="guest-lead"');
  const ctaIndex = hero.indexOf('class="gold-btn hero-cta"');
  assert.notEqual(leadIndex, -1);
  assert.notEqual(ctaIndex, -1);
  assert.ok(leadIndex < ctaIndex, "le bouton doit suivre l'introduction");
  assert.ok(expressView.indexOf('id="guest-hero"') < pedagogyStart);
  assert.ok(pedagogyStart < expressView.indexOf('<div class="express-wrap">'));
  // Le bouton mène au formulaire existant, sans script supplémentaire.
  assert.match(hero, /<a class="gold-btn hero-cta" href="#express-form" data-french-only>Découvrir mon thème<\/a>/);
});

test("la section pédagogique reprend exactement le texte fourni", () => {
  const paragraphs = (pedagogy.match(/<p\b[^>]*>[\s\S]*?<\/p>/g) || []).map(textOf);
  assert.deepEqual(paragraphs, [
    INTRO_PEDAGOGY,
    SENTENCE_2,
    SENTENCE_3,
    SENTENCE_4,
    SENTENCE_5,
    SIGNATURE
  ]);
});

test("la phrase clé est mise en avant, en gras, dans le premier paragraphe", () => {
  const first = pedagogy.match(/<p>([\s\S]*?)<\/p>/)[0];
  const strong = first.match(/<strong class="pedagogy-highlight">([\s\S]*?)<\/strong>/);
  assert.ok(strong, "phrase clé non balisée");
  assert.equal(normalize(stripTags(strong[1])), HIGHLIGHT);
  // Elle est extraite en fin de paragraphe, pas dupliquée ailleurs.
  assert.equal((pedagogy.match(/<strong/g) || []).length, 6, "1 phrase clé + 5 astres");
});

test("les cinq astres forment une liste ordonnée et complète", () => {
  const items = (pedagogy.match(/<li>([\s\S]*?)<\/li>/g) || []).map((li) => {
    assert.match(li, /<strong>[\s\S]*?<\/strong>/, "chaque astre doit être en gras");
    const full = normalize(stripTags(li));
    const separator = full.indexOf(" : ");
    assert.notEqual(separator, -1, `définition manquante : ${full}`);
    return [full.slice(0, separator), full.slice(separator + 3)];
  });
  assert.equal(items.length, 5);
  assert.deepEqual(items, ASTRES);
  // Les définitions sont bien celles fournies, y compris la ponctuation finale.
  const listText = normalize(stripTags(pedagogy.match(/<ul class="aster-list">[\s\S]*?<\/ul>/)[0]));
  assert.ok(listText.includes("incarner ;"));
  assert.ok(listText.includes("émotionnels ;"));
  assert.ok(listText.includes("communiquer ;"));
  assert.ok(listText.includes("pour vous ;"));
  assert.ok(listText.endsWith("vous affirmer."));
});

test("la phrase de clôture est isolée en signature", () => {
  assert.match(
    pedagogy,
    /<p class="pedagogy-signature">Car au fond, personne ne peut décider à votre place de ce qui vous ressemble\.<\/p>/
  );
  // Elle n'apparaît qu'une fois sur l'accueil.
  assert.equal(indexHtml.split(SIGNATURE).length - 1, 1);
});

test("la section pédagogique n'introduit aucun titre concurrent", () => {
  assert.doesNotMatch(pedagogy, /<h[1-6]\b/);
  // L'ordre des sections de la page est conservé : accueil, pédagogie, formulaire, offres.
  assert.ok(indexHtml.indexOf('id="express-view"') < indexHtml.indexOf('id="offre-view"'));
  assert.ok(indexHtml.indexOf('class="pedagogy"') < indexHtml.indexOf('id="offre-view"'));
});

test("le contenu français ne s'affiche pas dans les autres langues", () => {
  // Les blocs ajoutés sont marqués, et la règle d'affichage s'appuie sur la langue du document.
  assert.equal((expressView.match(/data-french-only/g) || []).length, 2, "bouton + section pédagogique");
  assert.match(styles, /:root:not\(\[lang="fr"\]\) \[data-french-only\] \{ display: none !important; \}/);
  assert.match(indexHtml, /<html lang="fr">/);
  assert.match(appJs, /document\.documentElement\.lang = currentLanguage\(\);/);
  // Aucun autre libellé de langue n'a reçu le texte français.
  assert.equal(appJs.split("le début de l’histoire").length - 1, 1);
  assert.equal(appJs.split("Balance ou Capricorne").length - 1, 1);
  assert.ok(appJs.includes('heroTitle: "Welcome to <span>Lastro</span>."'), "l'anglais garde son titre");
});

test("les formulaires, offres et fonctionnalités existants restent en place", () => {
  for (const marker of [
    'id="express-form"',
    'name="birthDate"',
    'id="express-precision"',
    'id="pay-start"',
    'id="offre-view"',
    'id="register-form"',
    'id="guest-language"'
  ]) {
    assert.ok(indexHtml.includes(marker), `élément manquant : ${marker}`);
  }
  // Le hero reste réservé aux visiteurs non connectés (masqué par applyGuestLayout).
  assert.match(indexHtml, /<div id="guest-hero" hidden>/);
});

test("les styles de la section pédagogique suivent le design existant", () => {
  assert.match(styles, /\.pedagogy \{[\s\S]*?max-width: 720px;[\s\S]*?display: grid;/);
  assert.match(styles, /\.aster-list \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(styles, /@media \(min-width: 720px\) \{\s*\.aster-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(styles, /\.pedagogy-signature \{[\s\S]*?font-family: var\(--serif\);[\s\S]*?color: var\(--gold\);/);
  assert.match(styles, /#guest-hero \.hero-cta \{[\s\S]*?min-height: 50px;[\s\S]*?border-radius: 999px;/);
  assert.match(styles, /#express-form \{ scroll-margin-top: 88px; \}/);
  // Le segment doré ne se coupe jamais en fin de ligne, et le titre garde une échelle mobile.
  assert.match(styles, /#guest-hero h1 span \{[\s\S]*?display: inline-block;/);
  assert.match(styles, /@media \(max-width: 640px\) \{\s*#guest-hero h1 \{ font-size: clamp\(1\.75rem, 8\.2vw, 2\.35rem\)/);
  assert.match(styles, /@media \(max-width: 360px\) \{\s*#guest-hero h1 \{ font-size: clamp\(1\.45rem, 6\.6vw, 1\.8rem\)/);
  // Aucun encadré promotionnel ajouté autour de la signature.
  assert.doesNotMatch(styles, /\.pedagogy-signature \{[^}]*border-radius/);
});
