// La carte du ciel : une roue et des répartitions CALCULÉES.
//
// Le template validé montrait une roue décorative (glyphes positionnés à la main
// dans un cercle CSS) et des pourcentages en dur. Ici on vérifie que tout vient du
// thème : la place de chaque corps, l'orientation de la roue, l'absence de point
// inventé quand l'heure manque, et des répartitions dont les chiffres se
// recomposent.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import {
  ELEMENT_BY_SIGN,
  MODALITY_BY_SIGN,
  centreLines,
  chartSection,
  signDistribution,
  zodiacWheelSvg
} from "../src/deliverables/chart.mjs";
import { docStrings } from "../src/deliverables/i18n.mjs";
import { annexSections, renderDossierHtml, renderDossierMarkdown } from "../src/deliverables/render.mjs";
import { buildSocle } from "../src/deliverables/socle.mjs";

const LIEU = { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", placeName: "Paris", country: "France" };

function soclePour(extra = {}, language = "fr") {
  return buildSocle(
    calculateWesternNatalChart({ birthDate: "1990-01-15", ...LIEU, ...extra }).result,
    docStrings(language)
  );
}

const EXACT = () => soclePour({ timePrecision: "exact", timeValue: "12:30" });
const APPROX = () => soclePour({ timePrecision: "approximate", timeValue: "12:30", timeMarginMinutes: 30 });
const SANS_HEURE = () =>
  buildSocle(
    calculateWesternNatalChart({ birthDate: "1970-06-15", ...LIEU, timePrecision: "unknown" }).result,
    docStrings("fr")
  );

function jetons(svg) {
  return [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="11\.5"/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2])
  }));
}

test("la roue place les corps à leur longitude calculée", () => {
  const socle = EXACT();
  const svg = zodiacWheelSvg(socle, docStrings("fr"), { size: 320 });
  const cx = 160;
  const cy = 160;

  // Sept corps, sept jetons, et aucun arc : l'heure est exacte, les positions
  // sont des points.
  const places = jetons(svg);
  assert.equal(places.length, 7);
  assert.equal((svg.match(/fill-opacity="0.5"/g) ?? []).length, 0);

  // L'Ascendant est décidable : l'axe part du centre vers la GAUCHE (180°).
  const axe = svg.match(/<line x1="160" y1="160" x2="([\d.-]+)" y2="([\d.-]+)" stroke="#5a447f"/);
  assert.ok(axe, "l'axe de l'Ascendant doit être tracé");
  const [, x2, y2] = axe.map(Number);
  assert.ok(x2 < cx - 100, `l'Ascendant doit être à gauche (x=${x2})`);
  assert.ok(Math.abs(y2 - cy) < 1, `l'axe doit être horizontal (y=${y2})`);

  // Chaque jeton est à la distance du rayon des corps (aucune position fantaisie).
  const rayons = places.map((place) => Math.hypot(place.x - cx, place.y - cy));
  for (const rayon of rayons) {
    assert.ok(Math.abs(rayon - 102.4) < 0.5 || Math.abs(rayon - 81.6) < 0.5, `rayon inattendu : ${rayon}`);
  }
});

test("l'angle d'un corps suit sa longitude", () => {
  // Soleil en Capricorne 25° et Ascendant en Taureau : le Soleil doit se trouver à
  // 180 + (295 - 33) = 82° environ, donc en haut à droite du centre.
  const socle = EXACT();
  const soleil = socle.bodies.find((body) => body.body === "Sun");
  const svg = zodiacWheelSvg(socle, docStrings("fr"), { size: 320 });
  const cx = 160;
  const cy = 160;
  const places = jetons(svg);
  // On retrouve le jeton du Soleil par sa position attendue.
  const angleAttendu = 180 + (soleil.longitude - socle.ascendant.longitude);
  const attendu = {
    x: cx + 102.4 * Math.cos((angleAttendu * Math.PI) / 180),
    y: cy - 102.4 * Math.sin((angleAttendu * Math.PI) / 180)
  };
  const proche = places.some((place) => Math.hypot(place.x - attendu.x, place.y - attendu.y) < 2);
  assert.ok(proche, `aucun jeton à la position calculée (${attendu.x.toFixed(1)}, ${attendu.y.toFixed(1)})`);
});

test("sans heure, la roue trace des arcs au lieu d'inventer des points", () => {
  const socle = SANS_HEURE();
  const svg = zodiacWheelSvg(socle, docStrings("fr"), { size: 320 });
  // Aucun jeton : aucune longitude n'est établie.
  assert.equal(jetons(svg).length, 0);
  // Sept arcs de position, un par corps.
  assert.equal((svg.match(/fill-opacity="0.5"/g) ?? []).length, 7);
  // Pas d'axe : l'Ascendant n'est pas calculable, donc rien n'est affirmé.
  assert.doesNotMatch(svg, /stroke="#5a447f" stroke-width="2.2"/);
});

test("l'Ascendant indécis devient une zone, pas un axe", () => {
  const socle = APPROX();
  assert.equal(socle.ascendant.decidableWithinMargin, false, "le cas de test doit franchir une frontière de signe");
  const svg = zodiacWheelSvg(socle, docStrings("fr"), { size: 320 });
  // Pas d'axe linéaire, mais la zone balayée et la mention.
  assert.doesNotMatch(svg, /stroke="#5a447f" stroke-width="2.2"/);
  assert.match(svg, /AC \?/);
  assert.match(svg, /fill-opacity="0.18"/);
  // Les corps, eux, gardent leurs jetons : leurs longitudes sont calculées.
  assert.equal(jetons(svg).length, 7);
  // Et la roue ne prétend pas être orientée sur l'Ascendant.
  assert.match(String(docStrings("fr").chartOrientedOnAries), /0° Bélier/);
});

test("la répartition est calculée, et les corps sans signe en sortent", () => {
  const exact = signDistribution(EXACT().bodies);
  assert.equal(exact.classified, 7);
  assert.deepEqual(exact.byElement, { fire: 1, earth: 4, air: 1, water: 1 });
  assert.deepEqual(exact.byModality, { cardinal: 4, fixed: 1, mutable: 2 });
  // Chaque corps classé l'est selon sa table, jamais au hasard.
  for (const body of EXACT().bodies) {
    assert.ok(ELEMENT_BY_SIGN[body.sign] && MODALITY_BY_SIGN[body.sign]);
  }
  const somme = Object.values(exact.byElement).reduce((total, valeur) => total + valeur, 0);
  assert.equal(somme, exact.classified);

  // Heure inconnue : le signe de la Lune n'est pas établi, elle est EXCLUE du
  // décompte au lieu d'être rangée dans un signe au hasard.
  const sansHeure = signDistribution(SANS_HEURE().bodies);
  assert.deepEqual(sansHeure.notEstablished, ["Moon"]);
  assert.equal(sansHeure.classified, 6);
  assert.equal(sansHeure.total, 7);
  assert.equal(Object.values(sansHeure.byElement).reduce((total, valeur) => total + valeur, 0), 6);
});

test("les barres et l'anneau portent les chiffres calculés, pas des valeurs décoratives", () => {
  const socle = EXACT();
  const section = chartSection(socle, docStrings("fr"));
  const distribution = signDistribution(socle.bodies);
  const largeurs = [...section.html.matchAll(/class="bar" style="width:(\d+)%/g)].map((m) => Number(m[1]));
  assert.equal(largeurs.length, 4);
  assert.deepEqual(
    largeurs,
    ["fire", "earth", "air", "water"].map((cle) => Math.round((distribution.byElement[cle] / distribution.classified) * 100))
  );
  // L'anneau se ferme sur 100 % : les arrondis ne laissent pas de trou.
  const anneau = section.html.match(/conic-gradient\(([^)]*)\)/);
  assert.ok(anneau);
  assert.match(anneau[1], /100%$/);
  // Aucun pourcentage écrit à la main ne doit subsister.
  assert.doesNotMatch(section.html, /(61|55|34|20|15|10)%/);
});

test("la carte du ciel ouvre le document, après la couverture et avant le texte", () => {
  const socle = EXACT();
  const document = renderDossierHtml({
    title: "Lecture",
    personLabel: "Caro",
    createdAt: "2026-09-11T00:00:00.000Z",
    writerMode: "llm",
    sections: [
      chartSection(socle, docStrings("fr")),
      { id: "introduction", title: "Votre ciel en un coup d'œil", badgeCode: "symbolic", badgeLabel: "x", kind: "symbolic", text: "Un paragraphe." },
      ...annexSections(socle, docStrings("fr"))
    ]
  });
  const corps = document.slice(document.indexOf("<body>"));
  assert.ok(corps.indexOf("cover-page") < corps.indexOf("chart-page"), "la couverture précède la carte du ciel");
  assert.ok(corps.indexOf("chart-page") < corps.indexOf("Votre ciel en un coup d'œil"), "la carte précède le texte");
  assert.ok(corps.indexOf("chart-page") < corps.indexOf("Annexe"), "la carte précède l'annexe");
  // La page graphique commence sur sa propre page, comme l'annexe.
  assert.match(document, /section\.block\.chart-page\s*\{[^}]*break-before:page/);
  // Et l'export Markdown porte les mêmes chiffres, sans graphique.
  const markdown = renderDossierMarkdown({
    title: "Lecture",
    personLabel: "Caro",
    createdAt: "2026-09-11T00:00:00.000Z",
    sections: [chartSection(socle, docStrings("fr"))]
  });
  assert.match(markdown, /Feu 1 · Terre 4 · Air 1 · Eau 1/);
  assert.match(markdown, /Cardinal 4 · Fixe 1 · Mutable 2/);
  assert.doesNotMatch(markdown, /<svg/);
});

// Le titre au centre de la roue était coupé à trois mots : « Votre carte du ciel »
// s'affichait « VOTRE / CARTE / DU ». Le français, l'espagnol, l'italien et le
// portugais perdent un mot avec cette règle.
test("le titre de la roue n'est jamais tronqué, dans les neuf langues", () => {
  const langues = ["fr", "en", "de", "es", "it", "pt", "no", "da", "nl"];
  for (const langue of langues) {
    const titre = docStrings(langue).chartTitle;
    const lignes = centreLines(titre);
    assert.ok(lignes.length <= 3, `${langue} : au plus trois lignes (${lignes.length})`);
    // Aucun mot perdu, aucun mot ajouté, ordre conservé.
    assert.deepEqual(
      lignes.join(" ").split(/\s+/),
      titre.toUpperCase().split(/\s+/),
      `${langue} : le titre complet est rendu (${lignes.join(" | ")})`
    );
    const svg = zodiacWheelSvg(soclePour({ timePrecision: "exact", timeValue: "12:30" }, langue), docStrings(langue));
    // Le texte du centre, recomposé à partir des seules lignes du centre (violet).
    const centre = [...svg.matchAll(/fill="#4b3f57">([^<]+)<\/text>/g)].map((m) => m[1]).join(" ");
    assert.equal(centre, titre.toUpperCase(), `${langue} : le centre porte le titre complet`);
  }
});

test("le centre de la roue coupe sur des lignes équilibrées", () => {
  assert.deepEqual(centreLines("Votre carte du ciel"), ["VOTRE CARTE", "DU CIEL"]);
  assert.deepEqual(centreLines("Deine Himmelskarte"), ["DEINE", "HIMMELSKARTE"]);
  assert.deepEqual(centreLines("La tua carta del cielo"), ["LA TUA CARTA", "DEL CIELO"]);
  // Un titre d'un seul mot très long tient sur une ligne : rien n'est inventé.
  assert.deepEqual(centreLines("Himmelskarte"), ["HIMMELSKARTE"]);
  assert.deepEqual(centreLines(""), []);
});

test("la roue n'écrit pas de flottants bruts dans ses tracés", () => {
  const svg = zodiacWheelSvg(EXACT(), docStrings("fr"));
  assert.doesNotMatch(svg, /\d\.\d{5,}/, "aucun rayon du type 150.39999999999998");
});
