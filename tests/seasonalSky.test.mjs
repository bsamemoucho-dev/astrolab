import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import * as Astronomy from "astronomy-engine";
import { buildSeasonalSky } from "../src/astro/seasonalSky.mjs";
import { rawBodyPosition } from "../src/astro/ephemeris.mjs";
import { julianDay } from "../src/astro/time.mjs";
import { seasonalSkyCopy, renderSeasonalSky, mountSeasonalSky } from "../public/seasonal-sky.js";

const instant = new Date("2026-10-31T12:00:00.000Z");
const sample = () => buildSeasonalSky({ now: instant });
const clone = value => JSON.parse(JSON.stringify(value));
const languages = ["fr", "en", "de", "es", "it", "pt", "no", "da", "nl"];
function rootHarness() {
  const nodes = new Map(["symbol", "kicker", "title", "fact", "invitation", "date", "guide", "ciel"].map(name => [name, { textContent: "", hidden: false, href: "", dateTime: "" }]));
  const root = { hidden: true, querySelector: selector => nodes.get(selector.replace("#seasonal-sky-", "")) ?? null };
  return { root, nodes };
}

test("the welcome sign uses the actual Lastro tropical ephemeris at the exact UTC instant", () => {
  const value = sample();
  assert.equal(value.schema, "lastro.seasonal_sky@1.0.0");
  assert.equal(value.asOfUtc, instant.toISOString());
  assert.equal(value.zodiac, "tropical");
  assert.equal(value.referenceTimeZone, "Europe/Paris");
  assert.equal(value.localDate, "2026-10-31");
  assert.equal(value.sun.signId, "Scorpio");
  assert.equal(value.sun.signName, "Scorpion");
  assert.equal(value.sun.longitude, rawBodyPosition("Sun", julianDay(instant)).longitude);
  assert.equal(value.sun.degreeInSign, value.sun.longitude - 210);
  assert.equal(value.source.engineVersion, "astronomy-engine@2.1.19");
  assert.equal(instant.toISOString(), "2026-10-31T12:00:00.000Z", "the caller's Date is not mutated");
});

for (const [month, expected] of ["Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius"].entries()) {
  test(`the factual welcome covers month ${month + 1} without a month-name lookup`, () => {
    const value = buildSeasonalSky({ now: new Date(Date.UTC(2026, month, 15, 12)) });
    assert.equal(value.sun.signId, expected);
    assert.ok(value.sun.degreeInSign >= 0 && value.sun.degreeInSign < 30);
    const card = seasonalSkyCopy(value);
    assert.ok(existsSync(new URL(`../public${card.guideHref}`, import.meta.url)), "the guide is a real existing page");
  });
}

for (const [longitude, start, beforeSign, afterSign] of [
  [0, "2026-03-18", "Pisces", "Aries"],
  [90, "2026-06-19", "Gemini", "Cancer"],
  [210, "2026-10-20", "Libra", "Scorpio"],
  [270, "2026-12-19", "Sagittarius", "Capricorn"]
]) {
  test(`the sign changes at the computed ${longitude}° ingress, including the 360° wrap`, () => {
    const crossing = Astronomy.SearchSunLongitude(longitude, new Date(start), 6);
    assert.ok(crossing);
    const before = buildSeasonalSky({ now: new Date(crossing.date.getTime() - 2000) });
    const after = buildSeasonalSky({ now: new Date(crossing.date.getTime() + 2000) });
    assert.equal(before.sun.signId, beforeSign);
    assert.equal(after.sun.signId, afterSign);
  });
}

test("the reference date follows Europe/Paris across midnight, New Year and DST", () => {
  assert.equal(buildSeasonalSky({ now: new Date("2026-12-31T23:30:00Z") }).localDate, "2027-01-01");
  assert.equal(buildSeasonalSky({ now: new Date("2026-06-30T22:30:00Z") }).localDate, "2026-07-01");
  assert.equal(buildSeasonalSky({ now: new Date("2026-03-29T00:30:00Z") }).localDate, "2026-03-29");
  assert.equal(buildSeasonalSky({ now: new Date("2026-03-29T01:30:00Z") }).localDate, "2026-03-29");
  assert.equal(buildSeasonalSky({ now: new Date("2024-02-29T12:00:00Z") }).sun.signId, "Pisces");
  for (const now of [null, "2026-10-31", 0, {}, new Date("invalid")]) {
    assert.throws(() => buildSeasonalSky({ now }), RangeError);
  }
});

for (const language of languages) {
  test(`the card has localized content and safe factual rendering in ${language}`, () => {
    const { root, nodes } = rootHarness();
    assert.equal(renderSeasonalSky(root, sample(), language), true);
    assert.equal(root.hidden, false);
    assert.ok(nodes.get("fact").textContent.length > 20);
    assert.ok(nodes.get("title").textContent.length > 2);
    assert.equal(nodes.get("guide").hidden, language !== "fr");
    assert.equal(nodes.get("ciel").hidden, language !== "fr");
    assert.equal(nodes.get("date").dateTime, instant.toISOString());
    assert.equal(seasonalSkyCopy(sample(), language).locale, language);
    assert.doesNotMatch(nodes.get("fact").textContent, /vous allez|you will|destin|prédiction|diagnostic/i);
  });
}

test("the UI rejects incoherent or hostile facts instead of inventing a sign", () => {
  const bad = [null, {}, { ...sample(), schema: "other" }, { ...sample(), zodiac: "sidereal" },
    { ...sample(), referenceTimeZone: "UTC" }, { ...sample(), asOfUtc: "invalid" }];
  for (const change of [{ longitude: NaN }, { longitude: Infinity }, { longitude: 360 }, { longitude: -1 }, { longitude: "210" }, { signId: "Aries" }, { signId: "<script>alert(1)</script>" }]) {
    bad.push({ ...sample(), sun: { ...sample().sun, ...change } });
  }
  for (const snapshot of bad) {
    const { root } = rootHarness(); root.hidden = false;
    assert.equal(seasonalSkyCopy(snapshot), null);
    assert.equal(renderSeasonalSky(root, snapshot), false);
    assert.equal(root.hidden, true);
  }
  const hostile = clone(sample());
  hostile.sun.signName = '<img src=x onerror="alert(1)">';
  hostile.guideHref = "javascript:alert(1)";
  const { root, nodes } = rootHarness();
  assert.equal(renderSeasonalSky(root, hostile, "fr"), true);
  assert.equal(nodes.get("title").textContent, "Scorpion");
  assert.equal(nodes.get("guide").href, "/guides/signes/scorpion.html");
  assert.equal(seasonalSkyCopy(sample(), "__proto__").locale, "en");
  assert.equal(seasonalSkyCopy(sample(), "fr-FR").locale, "fr");
});

test("one anonymous factual GET powers the card and language changes do not fetch again", async () => {
  const { root, nodes } = rootHarness();
  const documentRef = { getElementById: id => id === "seasonal-sky" ? root : null, documentElement: { lang: "fr" } };
  let calls = 0, callback, watched;
  class Observer {
    constructor(fn) { callback = fn; }
    observe(target, options) { watched = { target, options }; }
    disconnect() { watched.disconnected = true; }
  }
  const mounted = await mountSeasonalSky({ documentRef, Observer, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, "/api/public/seasonal-sky");
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    assert.equal(options.body, undefined);
    return { ok: true, json: async () => sample() };
  } });
  assert.equal(mounted.rendered, true);
  assert.deepEqual(watched.options, { attributes: true, attributeFilter: ["lang"] });
  documentRef.documentElement.lang = "en"; callback();
  assert.equal(nodes.get("title").textContent, "Scorpio");
  assert.equal(nodes.get("guide").hidden, true);
  assert.equal(calls, 1);
  mounted.disconnect(); assert.equal(watched.disconnected, true);
});

test("offline, provider errors and malformed data leave the optional card hidden", async () => {
  for (const fetchImpl of [async () => { throw Error("offline"); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => { throw Error("bad JSON"); } }), async () => ({ ok: true, json: async () => ({}) })]) {
    const { root } = rootHarness();
    const documentRef = { getElementById: () => root, documentElement: { lang: "fr" } };
    const result = await mountSeasonalSky({ documentRef, fetchImpl });
    assert.equal(result.rendered, false);
    assert.equal(root.hidden, true);
  }
});

test("the welcome enhancement retains the existing form, pricing and page hierarchy", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../public/seasonal-sky.css", import.meta.url), "utf8");
  const js = readFileSync(new URL("../public/seasonal-sky.js", import.meta.url), "utf8");
  assert.match(html, /id="seasonal-sky"[^>]*hidden/);
  assert.equal((html.match(/id="seasonal-sky"/g) ?? []).length, 1);
  assert.ok(html.indexOf('id="seasonal-sky"') < html.indexOf('id="express-form"'));
  assert.match(html, /href="\/seasonal-sky.css"/);
  assert.match(html, /src="\/seasonal-sky.js" type="module"/);
  assert.match(html, /id="pay-start"/);
  assert.match(css, /body:not\(\.guest\) \.seasonal-sky/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.doesNotMatch(js, /innerHTML|localStorage|\/horoscope|\/readings|POST|api\.openai|anthropic/);
});
