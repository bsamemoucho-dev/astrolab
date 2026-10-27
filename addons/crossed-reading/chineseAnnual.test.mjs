import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateChineseAnnual } from './chineseAnnual.mjs';
const at = (instant) => calculateChineseAnnual({ utcRange: { start: instant, end: instant } });
// External fixture dates: Hong Kong Observatory Gregorian/Lunar conversion tables.
// The boundary is midnight in UTC+8, not midnight in Paris or Li Chun.
for (const [day, previousYear, nextYear, animal, element, stem, branch] of [
  ['1988-02-16T16:00:00.000Z', 1987, 1988, 'Dragon', 'Terre', 'Wu', 'Chen'],
  ['1989-02-05T16:00:00.000Z', 1988, 1989, 'Serpent', 'Terre', 'Ji', 'Si'],
  ['2024-02-09T16:00:00.000Z', 2023, 2024, 'Dragon', 'Bois', 'Jia', 'Chen'],
  ['2025-01-28T16:00:00.000Z', 2024, 2025, 'Serpent', 'Bois', 'Yi', 'Si'],
  ['2026-02-16T16:00:00.000Z', 2025, 2026, 'Cheval', 'Feu', 'Bing', 'Wu']
]) {
  test(`annual calendar boundary ${nextYear} matches the published civil date`, () => {
    assert.equal(at(new Date(Date.parse(day) - 1).toISOString()).relatedYear, previousYear);
    const actual = at(day);
    assert.equal(actual.relatedYear, nextYear);
    assert.equal(actual.animalFr, animal); assert.equal(actual.elementFr, element);
    assert.equal(actual.stem, stem); assert.equal(actual.branch, branch);
    assert.equal(actual.frame.yearBoundary, 'lunar_new_year');
    assert.equal(actual.frame.timeZone, 'Asia/Shanghai');
    assert.equal(actual.interpretationStatus, 'not_licensed');
  });
}
test('birth uncertainty crossing new year does not acquire an annual label', () => {
  const actual = calculateChineseAnnual({ utcRange: { start: '1989-02-05T15:59:59Z', end: '1989-02-05T16:00:01Z' } });
  assert.equal(actual.status, 'unavailable');
  assert.equal(actual.reason, 'ANNUAL_YEAR_UNCERTAIN_WITHIN_BIRTH_WINDOW');
  assert.equal(actual.relatedYear, undefined); assert.equal(actual.animalFr, undefined);
});
test('an unknown hour remains usable only when the entire UTC window gives the same year', () => {
  const input = { utcRange: { start: '2000-05-01T00:00:00Z', end: '2000-05-02T00:00:00Z' } };
  const before = structuredClone(input), actual = calculateChineseAnnual(input);
  assert.equal(actual.status, 'calculated'); assert.equal(actual.relatedYear, 2000);
  assert.deepEqual(input, before);
});
test('January in a Gregorian year is not assigned that year automatically', () => {
  const actual = at('1989-01-10T12:00:00Z');
  assert.equal(actual.relatedYear, 1988); assert.equal(actual.animalFr, 'Dragon');
  assert.equal(actual.elementFr, 'Terre'); assert.equal(actual.frame.zodiac, undefined);
});
test('unsupported dates are explicit and have no fabricated label', () => {
  for (const value of ['1899-01-01T00:00:00Z', '2031-01-01T00:00:00Z']) {
    const actual = at(value);
    assert.equal(actual.status, 'unavailable'); assert.equal(actual.animalFr, undefined);
    assert.equal(actual.reason, 'DATE_OUTSIDE_LOCAL_PREVIEW_RANGE');
  }
});
test('invalid or timezone-ambiguous instants cannot silently fall back', () => {
  for (const value of [null, '', '1989-02-06', '1989-02-06T00:00:00', '1989-02-30T00:00:00Z']) assert.throws(() => at(value));
  assert.throws(() => calculateChineseAnnual({ utcRange: { start: '2000-01-02T00:00:00Z', end: '2000-01-01T00:00:00Z' } }));
  assert.throws(() => calculateChineseAnnual({ utcRange: { start: '2000-01-01T00:00:00Z', end: '2000-01-04T00:00:00Z' } }));
});
