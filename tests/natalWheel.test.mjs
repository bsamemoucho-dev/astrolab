import assert from "node:assert/strict";
import test from "node:test";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildSocle } from "../src/deliverables/socle.mjs";
import { docStrings } from "../src/deliverables/i18n.mjs";
import { natalWheelLayout, NATAL_ASPECT_STYLES, zodiacWheelSvg } from "../src/deliverables/natalWheel.mjs";

const INPUT = Object.freeze({ birthDate: "1990-01-15", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", placeName: "Paris", country: "France", timePrecision: "exact", timeValue: "12:30" });
const makeSocle = (extra = {}) => buildSocle(calculateWesternNatalChart({ ...INPUT, ...extra }).result, docStrings("fr"));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
function expectedPoint(longitude, anchor, radius, size = 480) {
  const angle = (anchor === null ? 90 + longitude : 180 + longitude - anchor) * Math.PI / 180;
  return { x: size / 2 + radius * Math.cos(angle), y: size / 2 - radius * Math.sin(angle) };
}
function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}
function tags(svg, element, className) {
  return [...svg.matchAll(new RegExp(`<${element}\\b[^>]*class="${className}"[^>]*>`, "g"))].map((match) => attrs(match[0]));
}

// These inputs are fictional regression fixtures, not customer records.
test("natal SVG: seven true markers and aspect endpoints retain calculated longitudes", () => {
  const socle = makeSocle();
  const original = structuredClone(socle);
  const layout = natalWheelLayout(socle);
  const svg = zodiacWheelSvg(socle);
  const markers = tags(svg, "circle", "planet-point");
  assert.equal(markers.length, 7);
  assert.equal(layout.bodies.length, 7);
  for (const body of socle.bodies) {
    const marker = markers.find((entry) => entry["data-body"] === body.body);
    assert.ok(marker, body.body);
    assert.equal(Number(marker["data-longitude"]), body.longitude);
    const expected = expectedPoint(body.longitude, socle.ascendant.longitude, layout.radius.aspect);
    assert.ok(distance({ x: +marker.cx, y: +marker.cy }, expected) < .002, `${body.body} calculated longitude`);
  }
  assert.equal(layout.aspects.length, socle.retainedAspects.length);
  const lines = tags(svg, "line", "aspect-line");
  assert.equal(lines.length, socle.retainedAspects.length);
  for (const [index, proof] of socle.retainedAspects.entries()) {
    const first = socle.bodies.find((body) => body.body === proof.bodyA);
    const second = socle.bodies.find((body) => body.body === proof.bodyB);
    const line = lines[index];
    assert.equal(line["data-aspect"], proof.type);
    assert.equal(+line["data-orb"], proof.exactness);
    assert.equal(+line["data-orb-max"], proof.orbUsed);
    assert.ok(distance({ x: +line.x1, y: +line.y1 }, expectedPoint(first.longitude, socle.ascendant.longitude, layout.radius.aspect)) < .002);
    assert.ok(distance({ x: +line.x2, y: +line.y2 }, expectedPoint(second.longitude, socle.ascendant.longitude, layout.radius.aspect)) < .002);
  }
  assert.deepEqual(socle, original, "the presentation must not mutate any calculated fact");
});

test("natal SVG: signs, whole-sign houses and independent angles match the socle", () => {
  const socle = makeSocle();
  const svg = zodiacWheelSvg(socle);
  const layout = natalWheelLayout(socle);
  assert.equal((svg.match(/class="sign-label"/g) ?? []).length, 12);
  const houses = tags(svg, "line", "house-cusp");
  assert.equal(houses.length, 12);
  assert.equal(tags(svg, "text", "house-number").length, 12);
  const ascSign = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"].indexOf(socle.ascendant.sign);
  for (let house = 1; house <= 12; house += 1) {
    const cusp = houses.find((entry) => +entry["data-house"] === house);
    assert.equal(+cusp["data-longitude"], ((ascSign + house - 1) % 12) * 30);
  }
  // The house number is a zodiacal sector, not the Ascendant's exact degree.
  assert.notEqual(+houses[0]["data-longitude"], socle.ascendant.longitude);
  for (const body of socle.bodies) {
    const expectedHouse = ((Math.floor(body.longitude / 30) - ascSign + 12) % 12) + 1;
    assert.equal(body.house, expectedHouse, `${body.body} whole-sign house`);
  }
  const axes = tags(svg, "line", "chart-angle");
  assert.deepEqual(axes.map((axis) => axis["data-angle"]), ["AC", "DS", "MC", "FC"]);
  for (const axis of axes) {
    const original = ["AC", "DS"].includes(axis["data-angle"]) ? socle.ascendant.longitude : socle.midheaven.longitude;
    const offset = ["DS", "FC"].includes(axis["data-angle"]) ? 180 : 0;
    assert.ok(gap(+axis["data-longitude"], original + offset) < 1e-10);
    assert.ok(distance({ x: +axis.x2, y: +axis.y2 }, expectedPoint(original + offset, layout.anchor, layout.radius.outer + 5)) < .002);
  }
  const asc = axes[0];
  assert.ok(+asc.x2 < layout.cx);
  assert.equal(+asc.y2, layout.cy, "ASC is left and horizontal");
  const mc = axes.find((axis) => axis["data-angle"] === "MC");
  assert.notEqual(+mc["data-longitude"], +houses[9]["data-longitude"], "MC must not be moved onto whole-sign house 10");
});

for (const [type, degrees, expectedColour, expectedDash] of [
  ["conjunction", 0, "#81748a", "1 2"], ["sextile", 60, "#527b9d", undefined],
  ["square", 90, "#b56d6b", "4 3"], ["trine", 120, "#527b9d", undefined], ["opposition", 180, "#b56d6b", "4 3"]
]) {
  test(`natal SVG: supplied ${type} has the correct non-invented trace`, () => {
    const socle = { bodies: [{ body: "Sun", longitude: 0 }, { body: "Moon", longitude: degrees }], retainedAspects: [{ bodyA: "Sun", bodyB: "Moon", type, exactness: 0, orbUsed: 8 }] };
    const line = tags(zodiacWheelSvg(socle), "line", "aspect-line")[0];
    assert.ok(line);
    assert.equal(line["data-aspect"], type);
    assert.equal(line.stroke, expectedColour);
    assert.equal(line["stroke-dasharray"], expectedDash);
    assert.equal(NATAL_ASPECT_STYLES[type].colour, expectedColour);
    socle.retainedAspects = [];
    assert.equal(tags(zodiacWheelSvg(socle), "line", "aspect-line").length, 0, "no geometry-based aspect may be silently computed by the view");
  });
}

test("natal SVG: no external body, unretained, unstable or missing-position aspect is introduced", () => {
  const socle = makeSocle();
  socle.bodies.push({ body: "Uranus", longitude: 0 });
  socle.retainedAspects = [
    { bodyA: "Sun", bodyB: "Uranus", type: "square" },
    { bodyA: "Sun", bodyB: "Moon", type: "quincunx" },
    { bodyA: "Sun", bodyB: "Mars", type: "sextile", marginStable: false }
  ];
  const svg = zodiacWheelSvg(socle);
  assert.equal(tags(svg, "circle", "planet-point").length, 7);
  assert.doesNotMatch(svg, /data-body="Uranus"/);
  assert.equal(tags(svg, "line", "aspect-line").length, 0);
});

for (const longitudes of [
  [0, .1, .2, .3, .4, .5, .6], [357, 358, 359, 0, 1, 2, 3],
  [0, 0, 0, 0, 0, 0, 0], [35, 50, 60, 120, 150, 260, 359]
]) {
  test(`natal SVG: glyph collision spacing preserves true positions (${longitudes.join(",")})`, () => {
    const bodies = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].map((body, index) => ({ body, longitude: longitudes[index] }));
    const socle = { bodies, retainedAspects: [] };
    const original = structuredClone(socle);
    const layout = natalWheelLayout(socle);
    for (const first of layout.bodies) {
      const source = bodies.find((body) => body.body === first.body);
      assert.equal(first.longitude, source.longitude);
      assert.ok(distance(first.point, expectedPoint(source.longitude, null, layout.radius.aspect)) < .002);
      for (const second of layout.bodies) {
        if (first.body === second.body) continue;
        assert.ok(distance(first.label, second.label) > 34, `${first.body}/${second.body} glyph labels overlap`);
      }
    }
    assert.deepEqual(socle, original);
    assert.equal(zodiacWheelSvg(socle), zodiacWheelSvg(socle), "placement must remain deterministic");
  });
}

test("natal SVG: uncertain birth time draws ranges without fabricated exact points, aspects or houses", () => {
  const socle = makeSocle({ birthDate: "1970-06-15", timePrecision: "unknown", timeValue: undefined });
  const svg = zodiacWheelSvg(socle);
  assert.equal(tags(svg, "circle", "planet-point").length, 0);
  assert.equal(tags(svg, "path", "planet-range").length, 7);
  assert.equal(tags(svg, "line", "aspect-line").length, 0);
  assert.equal(tags(svg, "line", "chart-angle").length, 0);
  assert.equal(tags(svg, "line", "house-cusp").length, 0);
  assert.equal(natalWheelLayout(socle).anchor, null);
});

test("natal SVG: ASC and MC uncertainty are handled independently", () => {
  const approximate = makeSocle({ timePrecision: "approximate", timeMarginMinutes: 30 });
  assert.equal(approximate.ascendant.decidableWithinMargin, false);
  assert.equal(approximate.midheaven.decidableWithinMargin, true);
  let svg = zodiacWheelSvg(approximate);
  assert.equal(natalWheelLayout(approximate).anchor, null);
  assert.deepEqual(tags(svg, "line", "chart-angle").map((entry) => entry["data-angle"]), ["MC", "FC"]);
  assert.deepEqual(tags(svg, "path", "angle-range").map((entry) => entry["data-angle"]), ["AC", "DS"]);
  assert.equal(tags(svg, "line", "house-cusp").length, 0);
  approximate.midheaven.decidableWithinMargin = false;
  svg = zodiacWheelSvg(approximate);
  assert.equal(tags(svg, "line", "chart-angle").length, 0);
  assert.deepEqual(tags(svg, "path", "angle-range").map((entry) => entry["data-angle"]), ["AC", "DS", "MC", "FC"]);
});

test("natal SVG: uncertainty ranges crossing Aries remain short and keep both source bounds", () => {
  const socle = { bodies: [{ body: "Sun", longitude: null, longitudeRange: { start: 359.6, end: .4 } }], retainedAspects: [] };
  const layout = natalWheelLayout(socle);
  assert.ok(Math.abs(layout.bodies[0].range.sweep - .8) < 1e-10);
  assert.ok(gap(layout.bodies[0].longitude, 0) < 1e-10);
  const range = tags(zodiacWheelSvg(socle), "path", "planet-range")[0];
  assert.equal(+range["data-longitude-start"], 359.6);
  assert.equal(+range["data-longitude-end"], .4);
  assert.match(range.d, / 0 0 0 /, "small uncertainty arc, not the remaining 359.2 degrees");
  socle.bodies[0].longitudeRange = { start: .4, end: 359.6 };
  assert.ok(Math.abs(natalWheelLayout(socle).bodies[0].range.sweep + .8) < 1e-10, "retrograde wrap keeps its direction");
});

test("natal SVG: labels and aspect titles escape markup and arbitrary text", () => {
  const socle = { bodies: [{ body: "Sun", longitude: 0, label: '<script>alert("x")</script>' }], retainedAspects: [] };
  const svg = zodiacWheelSvg(socle);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
});

for (const language of ["fr", "en", "de", "es", "it", "pt", "no", "da", "nl"]) {
  test(`natal SVG: localized signs in ${language} retain the same calculated geometry`, () => {
    const socle = makeSocle();
    const t = docStrings(language);
    const svg = zodiacWheelSvg(socle, t);
    assert.match(svg, new RegExp(t.signs.Aries));
    assert.equal((svg.match(/class="sign-label"/g) ?? []).length, 12);
    assert.deepEqual(tags(svg, "circle", "planet-point"), tags(zodiacWheelSvg(socle, docStrings("fr")), "circle", "planet-point"));
  });
}


test("natal SVG: explicitly unavailable houses never appear even with a known Ascendant", () => {
  const socle = makeSocle();
  socle.housesAvailable = false;
  const svg = zodiacWheelSvg(socle);
  assert.equal(tags(svg, "line", "house-cusp").length, 0);
  assert.equal(tags(svg, "text", "house-number").length, 0);
  assert.equal(tags(svg, "line", "chart-angle").length, 4, "available axes remain available");
});

test("natal SVG: compact viewBox keeps coordinates and presentation measures bounded", () => {
  const svg = zodiacWheelSvg(makeSocle(), null, { size: 320 });
  assert.match(svg, /viewBox="0 0 320 320"/);
  const values = [...svg.matchAll(/(?:x|y|cx|cy|r|x1|y1|x2|y2|stroke-width|font-size)="(-?[\d.]+)"/g)].map((match) => match[1]);
  assert.ok(values.length > 0);
  for (const value of values) assert.doesNotMatch(value, /\.\d{4,}/);
});


test("natal SVG: retrograde labels and close angle labels remain separated", () => {
  const bodies = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].map((body, index) => ({ body, longitude: index * .2, retrograde: true }));
  const socle = { bodies, ascendant: { sign: "Aries", longitude: 0 }, midheaven: { sign: "Aries", longitude: 1 }, retainedAspects: [] };
  const layout = natalWheelLayout(socle);
  for (const a of layout.bodies) {
    for (const b of layout.bodies) {
      if (a.body === b.body) continue;
      // R's maximum extent is 19px from its label centre; the neighbouring
      // glyph disc is 12px. The label spacing also protects this badge.
      assert.ok(distance(a.label, b.label) > 19 + 12);
    }
  }
  assert.equal(layout.angleLabels.length, 4);
  for (const a of layout.angleLabels) {
    for (const b of layout.angleLabels) {
      if (a.body === b.body) continue;
      assert.ok(distance(a.point, b.point) > 30, `${a.body}/${b.body} angle labels overlap`);
    }
  }
  const svg = zodiacWheelSvg(socle);
  assert.equal(tags(svg, "text", "retrograde-mark").length, 7);
  assert.equal(tags(svg, "line", "angle-label-leader").length, 4);
  assert.equal(+tags(svg, "line", "chart-angle")[0]["data-longitude"], 0);
});
