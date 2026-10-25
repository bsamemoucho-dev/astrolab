import assert from "node:assert/strict";
import test from "node:test";
import { prepareTransitSelection, selectTransitCoverage } from "../src/deliverables/transitSelection.mjs";

const NOW = "2026-10-25T12:00:00.000Z";
const options = (period = "current", extra = {}) => ({ nowUtc: NOW, period, horizonDays: 42, ...extra });
const transit = (extra = {}) => ({
  status: "CURRENT", transitBody: "Neptune", natalPoint: "ASC", aspectType: "square",
  startsAt: "2026-09-07T00:00:00.000Z", exactAt: "2026-10-14T03:00:00.000Z", endsAt: "2027-03-09T00:00:00.000Z",
  orb: .25, effectiveOrbLimit: 1.2, phase: "SEPARATING", reliability: "HIGH", ...extra
});

test("ended recent contacts cannot appear as current even before the eight-item cap", () => {
  const ended = [
    transit({ transitBody: "Moon", natalPoint: "Mercury", status: "RECENT", startsAt: "2026-10-23T02:00:00Z", exactAt: "2026-10-23T06:00:00Z", endsAt: "2026-10-23T09:00:00Z" }),
    transit({ transitBody: "Venus", status: "RECENT", startsAt: "2026-10-19T00:00:00Z", endsAt: "2026-10-23T20:00:00Z" })
  ];
  const current = transit();
  const all = [...ended, current];
  const original = structuredClone(all);
  const selection = prepareTransitSelection(all, options());
  assert.deepEqual(selection.items, [current]);
  assert.equal(selection.items[0], current, "return the original evidence, not rewritten dates or status");
  assert.deepEqual(selection.diagnostics.map((item) => item.code), ["transit_not_current", "transit_not_current"]);
  assert.ok(selection.diagnostics.every((item) => item.reason === "ended_before_reference"));
  assert.deepEqual(selectTransitCoverage(all, 8, (item) => item, options()), [current]);
  assert.deepEqual(all, original);
});

test("current boundaries include the reference instant without promoting future or ended windows", () => {
  const endingNow = transit({ endsAt: NOW });
  const startingNow = transit({ startsAt: NOW });
  const future = transit({ startsAt: "2026-10-25T12:00:00.001Z" });
  const ended = transit({ endsAt: "2026-10-25T11:59:59.999Z" });
  const selection = prepareTransitSelection([endingNow, startingNow, future, ended], options());
  assert.deepEqual(selection.items, [endingNow, startingNow]);
});

test("upcoming selection starts strictly after now and includes the exact 42-day horizon boundary", () => {
  const create = (startsAt) => transit({ status: "UPCOMING", startsAt, exactAt: startsAt, endsAt: "2026-12-10T00:00:00Z" });
  const atNow = create(NOW);
  const afterNow = create("2026-10-25T12:00:00.001Z");
  const atHorizon = create("2026-12-06T12:00:00.000Z");
  const outside = create("2026-12-06T12:00:00.001Z");
  assert.deepEqual(prepareTransitSelection([atNow, afterNow, atHorizon, outside], options("upcoming")).items, [afterNow, atHorizon]);
  assert.equal(prepareTransitSelection([afterNow], options("upcoming", { horizonDays: 0 })).items.length, 0);
});

test("invalid or incomplete timing is diagnosed instead of creating a current or future fact", () => {
  for (const extra of [{ startsAt: null }, { endsAt: undefined }, { startsAt: "bad date" }, { endsAt: "2026-01-01T00:00:00Z" }]) {
    const selection = prepareTransitSelection([transit(extra)], options());
    assert.equal(selection.items.length, 0);
    assert.equal(selection.diagnostics[0].code, "transit_window_invalid");
  }
  const noReference = prepareTransitSelection([transit()], { period: "current" });
  assert.equal(noReference.items.length, 0);
  assert.equal(noReference.diagnostics[0].code, "transit_reference_time_missing");
  assert.equal(prepareTransitSelection([transit()], options("invalid")).diagnostics[0].code, "transit_selection_context_invalid");
  assert.equal(prepareTransitSelection([transit()], options("upcoming", { horizonDays: NaN })).diagnostics[0].code, "transit_selection_context_invalid");
});

test("a source status inconsistent with the selected section is not silently rewritten", () => {
  const contact = transit({ status: "RECENT" });
  const selection = prepareTransitSelection([contact], options());
  assert.equal(selection.items.length, 0);
  assert.equal(selection.diagnostics[0].code, "transit_status_inconsistent_with_section");
  assert.equal(contact.status, "RECENT");
});

for (const [first, second, preferred, axis] of [["ASC", "DSC", "ASC", "ascendant_descendant"], ["MC", "IC", "MC", "midheaven_imum_coeli"], ["ascendant", "descendant", "ascendant", "ascendant_descendant"], ["midheaven", "imumCoeli", "midheaven", "midheaven_imum_coeli"]]) {
  test(`equal squares to ${first}/${second} are one displayed contact with both original proofs retained`, () => {
    const a = transit({ natalPoint: first });
    const b = transit({ natalPoint: second });
    const source = [b, a];
    const before = structuredClone(source);
    const selection = prepareTransitSelection(source, options());
    assert.equal(selection.items.length, 1);
    assert.equal(selection.items[0].natalPoint, preferred);
    assert.equal(selection.axisPairs.length, 1);
    assert.equal(selection.axisPairs[0].retainedItem, a);
    assert.equal(selection.axisPairs[0].suppressedItem, b);
    assert.equal(selection.axisPairs[0].axis, axis);
    assert.equal(selection.diagnostics[0].code, "transit_equivalent_axis_square");
    assert.deepEqual(source, before);
  });
}

test("axis contacts remain separate when any timing, orb or confidence fact differs", () => {
  const a = transit();
  for (const extra of [
    { startsAt: "2026-09-07T00:00:00.001Z" }, { endsAt: "2027-03-09T00:00:00.001Z" },
    { exactAt: "2026-10-14T03:00:00.001Z" }, { exactAt: null },
    { orb: .250001 }, { effectiveOrbLimit: 1.200001 }, { orb: null },
    { phase: "APPLYING" }, { reliability: "MEDIUM" }, { transitBody: "Uranus" },
    { aspectType: "opposition" }, { aspectType: "conjunction" }
  ]) {
    const b = transit({ natalPoint: "DSC", ...extra });
    const selection = prepareTransitSelection([a, b], options());
    assert.equal(selection.items.length, 2, JSON.stringify(extra));
    assert.equal(selection.axisPairs.length, 0, JSON.stringify(extra));
  }
  assert.equal(prepareTransitSelection([a, transit({ natalPoint: "MC" })], options()).items.length, 2, "different axes remain separate");
});

test("equivalent date representations and zero orbs remain factual equivalents", () => {
  const a = transit({ orb: 0 });
  const b = transit({ natalPoint: "DSC", orb: 0, exactAt: "2026-10-14T05:00:00+02:00", endsAt: "2027-03-09T01:00:00+01:00" });
  assert.equal(prepareTransitSelection([a, b], options()).items.length, 1);
});

test("reference items can be selected without losing their evidence identities", () => {
  const byId = new Map([["proof.asc", transit()], ["proof.dsc", transit({ natalPoint: "DSC" })]]);
  const selection = prepareTransitSelection(["proof.dsc", "proof.asc"], options("current", { valueOf: (ref) => byId.get(ref) }));
  assert.deepEqual(selection.items, ["proof.asc"]);
  assert.equal(selection.axisPairs[0].suppressedItem, "proof.dsc");
  assert.equal(byId.size, 2);
});

test("the original three-argument sampling contract remains available to historical callers", () => {
  const old = [transit({ endsAt: "2026-10-23T20:00:00Z" })];
  assert.deepEqual(selectTransitCoverage(old, 8), old);
  assert.equal(selectTransitCoverage(old, 0).length, 0);
  assert.equal(selectTransitCoverage(old, -1).length, 0);
  const future = Array.from({ length: 42 }, (_, day) => ({ status: "UPCOMING", transitBody: day % 7 === 6 ? "Jupiter" : "Moon", startsAt: new Date(Date.UTC(2026, 9, 26 + day)).toISOString(), exactAt: new Date(Date.UTC(2026, 9, 26 + day)).toISOString(), endsAt: new Date(Date.UTC(2026, 9, 26 + day, 1)).toISOString() }));
  const selected = selectTransitCoverage(future, 8, (item) => item, options("upcoming"));
  assert.equal(selected.length, 8);
  assert.equal(new Set(selected.map((item) => Math.floor((Date.parse(item.startsAt) - Date.parse(future[0].startsAt)) / (7 * 86_400_000)))).size, 6);
  assert.ok(selected.some((item) => item.transitBody === "Jupiter"));
  assert.ok(selected.every((item) => future.includes(item)));
});
