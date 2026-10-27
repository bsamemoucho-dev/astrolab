import assert from "node:assert/strict";
import test from "node:test";
import { renderIndependentReading } from "./render.mjs";
import { buildIndependentReading } from "./build.mjs";
import { calculateChineseAnnual } from "./chineseAnnual.mjs";

const BIRTH = { birthDate: "1990-01-15", timePrecision: "exact", timeValue: "16:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", placeName: "Paris", country: "France", coordinateSource: "Fixture publique", coordinateConfidence: "ville" };
const make = (birth = {}) => {
  const report = buildIndependentReading({ birth: { ...BIRTH, ...birth }, personLabel: "Thème fictif", generatedAt: "2026-10-27T00:00:00.000Z" });
  report.chineseAnnual = calculateChineseAnnual({ utcRange: report.tropical.frame.utcRange });
  return report;
};
const escaped = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

test("standalone preview labels the real tropical frame and preserves every caller value", () => {
  const report = make(), before = structuredClone(report);
  const html = renderIndependentReading(report);
  assert.match(html, /^<!doctype html>/u);
  assert.match(html, /<html lang="fr">/u);
  assert.match(html, /Aperçu local · complément indépendant/u);
  assert.match(html, /Base de préparation locale/u);
  assert.match(html, /maisons entières \(Whole Sign\)/u);
  assert.match(html, /Zodiaque <strong>tropical<\/strong>/u);
  assert.match(html, /Aucun texte IA nouveau n’est produit/u);
  for (const body of report.tropical.socle.bodies) {
    assert.ok(html.includes(`<td>${escaped(body.label)}</td><td>${escaped(body.degreeLabel)}</td><td>Maison ${body.house}</td>`), body.body);
  }
  assert.deepEqual(report, before);
});

test("the existing computed SVG uses seven exact longitudes and retained aspects only", () => {
  const report = make(), html = renderIndependentReading(report);
  const markers = [...html.matchAll(/<circle class="planet-point"[^>]+>/gu)].map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, value])));
  assert.equal(markers.length, 7);
  for (const body of report.tropical.socle.bodies) assert.equal(Number(markers.find((marker) => marker["data-body"] === body.body)?.["data-longitude"]), body.longitude);
  assert.equal((html.match(/class="aspect-line"/gu) ?? []).length, report.tropical.socle.aspectGeometry.length);
  for (const aspect of report.tropical.socle.aspectGeometry) {
    const actual = aspect.exactness.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const max = aspect.orbUsed.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    assert.ok(html.includes(`<td>${actual}°</td><td>${max}°</td>`));
  }
  assert.match(html, /L’orbe réel est l’écart entre l’angle mesuré et l’angle exact/u);
  assert.match(html, /Avec Soleil ou Lune/u);
});

test("catalogue and unavailable methods stay separate from a finished personalised interpretation", () => {
  const report = make(), html = renderIndependentReading(report);
  assert.match(html, /Vocabulaire symbolique · catalogue uniquement/u);
  assert.match(html, /une lecture personnalisée complète reste à rédiger et à contrôler/u);
  assert.match(html, /Aucune synthèse croisée n’est licenciée/u);
  assert.match(html, /Une ressemblance entre des vocabulaires occidentaux et chinois n’apporte pas une preuve indépendante/u);
  for (const entry of report.symbolic.entries) {
    assert.ok(html.includes(escaped(entry.ruleId)));
    assert.ok(html.includes(escaped(entry.evidenceId)));
    for (const theme of entry.themes) assert.ok(html.includes(`<li>${escaped(theme)}</li>`));
  }
  for (const unavailable of report.unavailable) {
    assert.ok(html.includes(`<h3>${escaped(unavailable.title)}</h3>`));
    assert.ok(html.includes(escaped(unavailable.reason)));
  }
  assert.doesNotMatch(html, /validé machine|validé par un humain|relecture humaine effectuée|profil psychologique validé/iu);
});

test("Chinese annual label names its own lunar boundary and never masquerades as BaZi", () => {
  const report = make(), html = renderIndependentReading(report);
  assert.match(html, /Repère calendaire calculé/u);
  assert.ok(html.includes(`${escaped(report.chineseAnnual.animalFr)} · ${escaped(report.chineseAnnual.elementFr)}`));
  assert.match(html, /frontière au Nouvel An lunaire · fuseau Asia\/Shanghai/u);
  assert.match(html, /Ils ne décrivent pas une personnalité/u);
  assert.match(html, /ne calcule pas les quatre piliers du BaZi/u);
});

test("missing or uncertain annual result is explicit and invents no animal", () => {
  const report = make();
  report.chineseAnnual = { status: "unavailable", reason: "Fenêtre traversant une limite d’année." };
  const html = renderIndependentReading(report);
  assert.match(html, /Repère indisponible/u);
  assert.match(html, /Fenêtre traversant une limite d’année/u);
  assert.doesNotMatch(html, /class="annual-label"/u);
  delete report.chineseAnnual;
  assert.match(renderIndependentReading(report), /Le calcul de l’année chinoise n’est pas fourni/u);
});

test("unknown birth time keeps angle and house uncertainty in the standalone document", () => {
  const report = make({ timePrecision: "unknown", timeValue: undefined }), html = renderIndependentReading(report);
  assert.match(html, /heure inconnue/u);
  assert.match(html, /non établi avec les données fournies/u);
  assert.doesNotMatch(html, /<td>Maison \d+<\/td>/u);
  assert.doesNotMatch(html, /class="planet-point"/u);
  assert.ok(html.includes(escaped(report.tropical.socle.bodies.find((body) => body.body === "Moon").degreeLabel)));
});

test("one unstable body does not promise a house while other stable houses remain visible", () => {
  const report = make(), moon = report.tropical.socle.bodies.find((body) => body.body === "Moon");
  moon.signStableWithinMargin = false;
  const html = renderIndependentReading(report);
  assert.ok(html.includes(`<td>Lune</td><td>${escaped(moon.degreeLabel)}</td><td>non établie</td>`));
  assert.match(html, /<td>Soleil<\/td><td>[^<]+<\/td><td>Maison \d+<\/td>/u);
});

test("all dynamic text is escaped, including SVG titles, birth, catalogue and calendar fields", () => {
  const report = make(), payload = '<img src=x onerror="alert(1)"><script>bad()</script>&';
  report.personLabel = payload;
  report.generatedAt = payload;
  report.birth.placeName = payload;
  report.birth.coordinateSource = payload;
  report.tropical.frame.methodVersion = payload;
  report.tropical.socle.bodies[0].label = payload;
  report.tropical.socle.bodies[0].degreeLabel = payload;
  report.tropical.socle.uncertaintyNotes = [payload];
  report.symbolic.entries[0].ruleId = payload;
  report.symbolic.entries[0].themes = [payload];
  report.unavailable[0].title = payload;
  report.unavailable[0].reason = payload;
  report.chineseAnnual.animalFr = payload;
  report.chineseAnnual.elementFr = payload;
  const html = renderIndependentReading(report);
  assert.ok(html.includes(escaped(payload)));
  assert.doesNotMatch(html, /<script\b|<img\b|<[^>]+\son(?:error|load)=/iu);
  assert.ok(html.includes(`<title>Lastro · aperçu indépendant · ${escaped(payload)}</title>`));
  assert.ok(html.includes(`<li>${escaped(payload)}</li>`));
});

test("document embeds no remote resource, executable script, form, payment action or tracking asset", () => {
  const html = renderIndependentReading(make());
  assert.doesNotMatch(html, /<(?:script|iframe|form|link|object|embed|button)\b|@import|url\(|javascript:|(?:src|href|action)\s*=\s*["']\s*(?:https?:|\/\/)/iu);
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/u);
  assert.match(html, /@page\{size:A4;margin:17mm\}/u);
  assert.match(html, /@media print/u);
});

for (const [label, change, message] of [
  ["production status", (r) => { r.status = "production"; }, /LOCAL_PREVIEW_REQUIRED/u],
  ["sidereal frame", (r) => { r.tropical.frame.zodiac = "sidereal"; }, /TROPICAL_FRAME_REQUIRED/u],
  ["quadrant houses", (r) => { r.tropical.frame.houseSystem = "PLACIDUS"; }, /TROPICAL_FRAME_REQUIRED/u],
  ["foreign method", (r) => { r.tropical.frame.method = "jyotisha-natal"; }, /TROPICAL_FRAME_REQUIRED/u],
  ["foreign symbolic entry", (r) => { r.symbolic.entries[0].frame = "jyotisha-sidereal"; }, /SYMBOLIC_FRAME_MISMATCH/u],
  ["finished symbolic dossier", (r) => { r.symbolic.status = "written"; }, /CATALOGUE_REQUIRED/u],
  ["unlicensed cross synthesis", (r) => { r.crossTraditionSynthesis.status = "licensed"; }, /SYNTHESIS_NOT_SUPPORTED/u],
  ["BaZi year substituted", (r) => { r.chineseAnnual.frame.yearBoundary = "lichun"; }, /ANNUAL_FRAME_REQUIRED/u]
]) {
  test(`renderer refuses unsupported ${label}`, () => {
    const report = make();
    change(report);
    assert.throws(() => renderIndependentReading(report), message);
  });
}


test("annual boundary uncertainty has a readable reason without a technical code or invented animal", () => {
  const report = make();
  report.chineseAnnual = { status: "unavailable", reason: "ANNUAL_YEAR_UNCERTAIN_WITHIN_BIRTH_WINDOW" };
  const html = renderIndependentReading(report);
  assert.match(html, /La fenêtre de naissance traverse un changement d’année chinoise/u);
  assert.doesNotMatch(html, /ANNUAL_YEAR_UNCERTAIN_WITHIN_BIRTH_WINDOW|class="annual-label"/u);
});
