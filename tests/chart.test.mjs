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
import { natalWheelLayout } from "../src/deliverables/natalWheel.mjs";
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

function attributes(markup) {
  return Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

function jetons(svg) {
  return [...svg.matchAll(/<circle class="planet-point"[^>]*\/>/g)].map(([markup]) => {
    const attrs = attributes(markup);
    return { body: attrs["data-body"], longitude: Number(attrs["data-longitude"]), x: Number(attrs.cx), y: Number(attrs.cy) };
  });
}

function angleAxis(svg, name) {
  const line = [...svg.matchAll(/<line class="chart-angle"[^>]*\/>/g)].find(([markup]) => attributes(markup)["data-angle"] === name);
  return line ? attributes(line[0]) : null;
}

test("la roue place les corps à leur longitude calculée", () => {
  const socle = EXACT();
  const svg = zodiacWheelSvg(socle, docStrings("fr"), { size: 320 });
  const layout = natalWheelLayout(socle, { size: 320 });
  const { cx, cy } = layout;

  // Sept corps, sept repères exacts. Les glyphes peuvent être décalés pour
  // rester lisibles ; les repères astronomiques restent sur le cercle d'aspects.
  const places = jetons(svg);
  assert.equal(places.length, 7);
  assert.equal((svg.match(/class="planet-range"/g) ?? []).length, 0);
  assert.deepEqual(places.map((place) => place.body).sort(), socle.bodies.map((body) => body.body).sort());

  // L'Ascendant est décidable : son repère est à GAUCHE, au vrai degré. L'axe
  // est désormais dans la couronne pour ne pas masquer les lignes d'aspects.
  const axe = angleAxis(svg, "AC");
  assert.ok(axe, "l'axe de l'Ascendant doit être tracé");
  assert.ok(Number(axe.x1) < cx && Number(axe.x2) < cx - 100, "l'Ascendant doit être à gauche");
  assert.ok(Math.abs(Number(axe.y1) - cy) < .001 && Math.abs(Number(axe.y2) - cy) < .001, "l'axe doit être horizontal");
  assert.ok(Math.abs(Number(axe["data-longitude"]) - socle.ascendant.longitude) < 1e-9, "degré calculé conservé malgré la normalisation circulaire");
  for (const name of ["AC", "DS", "MC", "FC"]) assert.ok(angleAxis(svg, name), `angle ${name} calculé`);

  for (const place of places) {
    const rayon = Math.hypot(place.x - cx, place.y - cy);
    assert.ok(Math.abs(rayon - layout.radius.aspect) < .001, `rayon inattendu : ${rayon}`);
    assert.equal(place.longitude, socle.bodies.find((body) => body.body === place.body).longitude);
  }
  assert.equal((svg.match(/class="sign-label"/g) ?? []).length, 12);
  assert.equal((svg.match(/class="house-cusp"/g) ?? []).length, 12);
});

test("l'angle de chacun des sept corps suit sa longitude", () => {
  const socle = EXACT();
  const svg = zodiacWheelSvg(socle, docStrings("fr"), { size: 320 });
  const places = jetons(svg);
  // Vérification indépendante par l'angle à l'écran : ni le déplacement des
  // étiquettes ni leur ordre dans le SVG ne peuvent modifier le vrai repère.
  for (const body of socle.bodies) {
    const place = places.find((entry) => entry.body === body.body);
    assert.ok(place, body.body);
    const actual = Math.atan2(160 - place.y, place.x - 160) * 180 / Math.PI;
    const expected = 180 + body.longitude - socle.ascendant.longitude;
    const gap = Math.abs(((actual - expected + 540) % 360) - 180);
    assert.ok(gap < .002, `${body.body} : écart angulaire ${gap}°`);
  }
});

test("sans heure, la roue trace des arcs au lieu d'inventer des points", () => {
  const socle = SANS_HEURE();
  const svg = zodiacWheelSvg(socle, docStrings("fr"), { size: 320 });
  assert.equal(jetons(svg).length, 0);
  const ranges = [...svg.matchAll(/<path class="planet-range"[^>]*\/>/g)].map(([path]) => attributes(path));
  assert.equal(ranges.length, 7);
  for (const body of socle.bodies) {
    const range = ranges.find((entry) => entry["data-body"] === body.body);
    assert.ok(range, body.body);
    assert.equal(Number(range["data-longitude-start"]), body.longitudeRange.start);
    assert.equal(Number(range["data-longitude-end"]), body.longitudeRange.end);
  }
  assert.doesNotMatch(svg, /class="chart-angle"|class="house-cusp"|class="aspect-line"/);
});

test("l'Ascendant indécis devient une zone, pas un axe", () => {
  const socle = APPROX();
  assert.equal(socle.ascendant.decidableWithinMargin, false, "le cas de test doit franchir une frontière de signe");
  const svg = zodiacWheelSvg(socle, docStrings("fr"), { size: 320 });
  assert.equal(angleAxis(svg, "AC"), null);
  assert.equal(angleAxis(svg, "DS"), null);
  assert.match(svg, /AC \?/);
  assert.match(svg, /class="angle-range" data-angle="AC"/);
  assert.doesNotMatch(svg, /class="house-cusp"/);
  assert.equal(jetons(svg).length, 7);
  assert.equal(natalWheelLayout(socle).anchor, null);
  assert.match(String(docStrings("fr").chartOrientedOnAries), /0° Bélier/);
});

test("un Milieu du Ciel indécis reste une plage même si l'Ascendant est décidable", () => {
  const socle = EXACT();
  socle.midheaven.decidableWithinMargin = false;
  socle.midheaven.longitudeAtWindowStart = socle.midheaven.longitude - 5;
  socle.midheaven.longitudeAtWindowEnd = socle.midheaven.longitude + 5;
  const svg = zodiacWheelSvg(socle, docStrings("fr"));
  assert.ok(angleAxis(svg, "AC"));
  assert.equal(angleAxis(svg, "MC"), null);
  assert.equal(angleAxis(svg, "FC"), null);
  assert.match(svg, /class="angle-range" data-angle="MC"/);
  assert.match(svg, /MC \?/);
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

test("les sept barres portent les répartitions calculées avec libellés et chiffres", () => {
  const socle = EXACT(), section = chartSection(socle, docStrings("fr"));
  const distribution = signDistribution(socle.bodies);
  const widths = [...section.html.matchAll(/class="bar" style="width:(\d+)%/g)].map((m) => Number(m[1]));
  assert.deepEqual(widths, [
    ...["fire", "earth", "air", "water"].map((key) => Math.round(distribution.byElement[key] / distribution.classified * 100)),
    ...["cardinal", "fixed", "mutable"].map((key) => Math.round(distribution.byModality[key] / distribution.classified * 100))
  ]);
  assert.doesNotMatch(section.html, /donut|conic-gradient/);
  for (const [label, count] of [["Cardinal",4],["Fixe",1],["Mutable",2]]) {
    assert.match(section.html, new RegExp(`<span>${label}</span>[^]*?<b>${count}</b>`));
  }
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
    // Le titre accessible du SVG reste complet ; le centre est maintenant
    // réservé aux aspects calculés, conformément à la nouvelle présentation.
    const accessibleTitle = svg.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.equal(accessibleTitle, titre.replaceAll("&", "&amp;"), `${langue} : le SVG porte le titre complet`);
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
  // Les données astronomiques conservent leur précision. Seules les coordonnées
  // de présentation doivent être arrondies, sans bruit de virgule flottante.
  const coordinates = [...svg.matchAll(/\b(?:x|y|cx|cy|x1|y1|x2|y2)="([\d.-]+)"/g)].map((match) => match[1]);
  assert.ok(coordinates.length > 100);
  for (const value of coordinates) assert.match(value, /^-?\d+(?:\.\d{1,3})?$/, `coordonnée non arrondie : ${value}`);
  for (const [, path] of svg.matchAll(/\bd="([^"]+)"/g)) assert.doesNotMatch(path, /\d\.\d{4,}/, "tracé non arrondi");
});
