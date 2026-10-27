import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateVimshottari, VIMSHOTTARI_LORDS, VIMSHOTTARI_YEAR_DAYS } from './vimshottari.mjs';

const BIRTH = '2000-01-01T00:00:00.000Z';
const YEAR_MS = 31557600000;
const input = (longitude = 0, extra = {}) => ({ utcRange: { start: BIRTH, end: BIRTH }, moonSiderealLongitude: longitude, ...extra });
const run = (longitude = 0, extra = {}) => calculateVimshottari(input(longitude, extra));
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

// Independent exact-fraction fixtures: Python fractions.Fraction + datetime,
// with 1461/4 days per year. No birth data from a real person is committed.
test('fixed-year analytical fixture: an Ashwini entry begins a full Ketu period', () => {
  const r = run(0);
  assert.equal(r.status, 'calculated');
  assert.equal(r.birthNakshatra.name, 'Ashwini');
  assert.equal(r.birthBalance.lord, 'Ketu');
  assert.equal(r.birthBalance.remainingYears, 7);
  assert.equal(r.periods[0].startUtc, BIRTH);
  assert.equal(r.periods[0].endUtc, '2006-12-31T18:00:00.000Z');
  assert.equal(r.periods[1].lord, 'Venus');
  assert.equal(r.frame.yearDays, 365.25);
  assert.equal(r.frame.periodBoundary, 'start_inclusive_end_exclusive');
  assert.equal(r.current, null);
  assert.equal(r.interpretationStatus, 'not_licensed');
});

test('half a nakshatra retains the real pre-birth beginning instead of restarting the period', () => {
  const r = run(20 / 3, { asOfUtc: BIRTH });
  close(r.birthBalance.remainingYears, 3.5);
  assert.equal(r.periods[0].startUtc, '1996-07-01T15:00:00.000Z');
  assert.equal(r.periods[0].endUtc, '2003-07-02T09:00:00.000Z');
  assert.equal(r.periods[0].durationYears, 7);
  assert.equal(r.current.mahadasha.lord, 'Ketu');
  assert.notEqual(r.current.antardasha.lord, 'Ketu', 'the first antardasha can already have elapsed before birth');
});

test('Rohini midpoint fixture gives five Moon years remaining with exact independent UTC bounds', () => {
  const r = run(140 / 3);
  assert.equal(r.birthNakshatra.name, 'Rohini');
  close(r.birthBalance.remainingYears, 5);
  assert.equal(r.periods[0].startUtc, '1994-12-31T18:00:00.000Z');
  assert.equal(r.periods[0].endUtc, '2004-12-31T06:00:00.000Z');
});

test('PVR Narasimha Rao section16.3 worked-example balance uses the full seven Mars years for subdivisions', () => {
  // The source gives a 2.24875-year Mars balance and explicitly prohibits
  // subdividing that remainder as if it were a fresh full mahadasha.
  const longitude = (4 + 1 - 2.24875 / 7) * 40 / 3;
  const r = run(longitude, { asOfUtc: BIRTH });
  assert.equal(r.birthBalance.lord, 'Mars');
  close(r.birthBalance.remainingYears, 2.24875);
  assert.equal(r.periods[0].durationYears, 7);
  close(r.periods[0].antardashas[0].durationYears, 49 / 120);
  assert.equal(r.current.antardasha.lord, 'Ketu');
});

test('PVR section16.3 Venus antardasha example matches exact rational dates under the chosen year', () => {
  const r = run(40 / 3);
  const [venus, sun, moon] = r.periods[0].antardashas;
  assert.equal(r.birthBalance.lord, 'Venus');
  close(venus.durationYears, 10 / 3);
  assert.equal(venus.endUtc, '2003-05-02T12:00:00.000Z');
  assert.equal(sun.durationYears, 1);
  assert.equal(sun.endUtc, '2004-05-01T18:00:00.000Z');
  close(moon.durationYears, 5 / 3);
  assert.equal(r.periods[0].endUtc, '2020-01-01T00:00:00.000Z');
});

for (let i = 0; i < 27; i++) {
  test(`nakshatra ${i + 1} repeats the documented nine-lord order without borrowing a tropical sign`, () => {
    const r = run((i + 0.25) * 40 / 3);
    assert.equal(r.birthNakshatra.index, i);
    assert.equal(r.birthBalance.lord, VIMSHOTTARI_LORDS[i % 9].lord);
    assert.equal(r.birthBalance.totalYears, VIMSHOTTARI_LORDS[i % 9].years);
    assert.equal(r.frame.zodiac, 'sidereal');
  });
}

test('the complete cycle and all subdivisions have no gaps, overlap or unexplained extra duration', () => {
  const before = input(140 / 3), copy = structuredClone(before);
  const r = calculateVimshottari(before);
  assert.deepEqual(before, copy);
  assert.equal(VIMSHOTTARI_LORDS.reduce((sum, entry) => sum + entry.years, 0), 120);
  assert.equal(VIMSHOTTARI_YEAR_DAYS, 365.25);
  assert.equal(Date.parse(r.periods[8].endUtc) - Date.parse(r.periods[0].startUtc), 120 * YEAR_MS);
  assert.equal(Date.parse(r.visibleUntilUtc) - Date.parse(r.visibleFromUtc), 120 * YEAR_MS);
  for (let i = 0; i < r.periods.length; i++) {
    const maha = r.periods[i];
    assert.equal(maha.antardashas.length, 9);
    assert.equal(maha.antardashas[0].lord, maha.lord);
    assert.equal(maha.antardashas[0].startUtc, maha.startUtc);
    assert.equal(maha.antardashas[8].endUtc, maha.endUtc);
    close(maha.antardashas.reduce((sum, child) => sum + child.durationYears, 0), maha.durationYears);
    if (i) assert.equal(r.periods[i - 1].endUtc, maha.startUtc);
    for (let j = 1; j < 9; j++) assert.equal(maha.antardashas[j - 1].endUtc, maha.antardashas[j].startUtc);
  }
});

test('half-open boundaries assign the exact first instant to the new maha and antar', () => {
  const initial = run(0);
  const firstEnd = initial.periods[0].endUtc;
  const before = run(0, { asOfUtc: new Date(Date.parse(firstEnd) - 1).toISOString() });
  assert.equal(before.current.mahadasha.lord, 'Ketu');
  const at = run(0, { asOfUtc: firstEnd });
  assert.equal(at.current.status, 'calculated');
  assert.equal(at.current.mahadasha.lord, 'Venus');
  assert.equal(at.current.antardasha.lord, 'Venus');
  const childEnd = initial.periods[0].antardashas[0].endUtc;
  assert.equal(run(0, { asOfUtc: childEnd }).current.antardasha.lord, 'Venus');
});

test('date lookup never assumes the current machine clock or assigns a period outside the requested horizon', () => {
  const r = run(5, { horizonYears: 1 });
  assert.equal(r.current, null);
  assert.equal(run(5, { asOfUtc: '1999-12-31T23:59:59Z' }).current.status, 'outside_horizon');
  assert.equal(run(5, { asOfUtc: r.visibleUntilUtc, horizonYears: 1 }).current.status, 'outside_horizon');
});

test('numeric lunar tolerance propagates to every date bound without being misrepresented as millisecond accuracy', () => {
  const r = run(140 / 3, { longitudeToleranceDegrees: 1 / 60 });
  assert.equal(r.status, 'calculated');
  const errorMs = 10 * (1 / 60) / (40 / 3) * YEAR_MS;
  for (const maha of r.periods) {
    assert.ok(Date.parse(maha.startRangeUtc.earliest) < Date.parse(maha.startUtc));
    assert.ok(Date.parse(maha.startRangeUtc.latest) > Date.parse(maha.startUtc));
    assert.ok(Math.abs((Date.parse(maha.startRangeUtc.latest) - Date.parse(maha.startRangeUtc.earliest)) - 2 * errorMs) <= 1);
    for (const child of maha.antardashas) {
      assert.ok(Date.parse(child.startRangeUtc.earliest) <= Date.parse(child.startUtc));
      assert.ok(Date.parse(child.endRangeUtc.latest) >= Date.parse(child.endUtc));
    }
  }
  assert.match(r.frame.datePrecision, /tolerance_bounds/u);
});

test('a lookup inside a tolerance band reports candidate lords rather than selecting one', () => {
  const r = run(140 / 3, { longitudeToleranceDegrees: 1 / 60 });
  const at = run(140 / 3, { longitudeToleranceDegrees: 1 / 60, asOfUtc: r.periods[0].endUtc });
  assert.equal(at.current.status, 'uncertain');
  assert.equal(at.current.mahadasha, null);
  assert.ok(at.current.candidates.some(candidate => candidate.mahadashaLord === 'Moon'));
  assert.ok(at.current.candidates.some(candidate => candidate.mahadashaLord === 'Mars'));
});

test('a Moon within the precision guard of a nakshatra frontier has no unique dasha timeline', () => {
  for (const longitude of [0, 40 / 3, 360 - 0.001, 40 / 3 + 0.001]) {
    const r = run(longitude, { longitudeToleranceDegrees: 1 / 60 });
    assert.equal(r.status, 'uncertain');
    assert.equal(r.reason, 'BIRTH_NAKSHATRA_UNCERTAIN');
    assert.ok(r.possibleBirthLords.length >= 2);
    assert.deepEqual(r.periods, []);
    assert.equal(r.birthBalance, undefined);
  }
});

test('unknown or approximate time is not turned into an exact nominal calendar', () => {
  const r = run(45, { utcRange: { start: BIRTH, end: '2000-01-01T01:00:00Z' }, moonLongitudeRange: { start: 44.8, end: 45.3 } });
  assert.equal(r.status, 'uncertain');
  assert.equal(r.reason, 'BIRTH_TIME_OR_LONGITUDE_UNCERTAIN');
  assert.deepEqual(r.periods, []); assert.equal(r.current, null);
  assert.equal(r.birthBalance, undefined);
  assert.equal(r.possibleBirthLords[0], 'Moon');
  const missingRange = run(45, { utcRange: { start: BIRTH, end: '2000-01-01T01:00:00Z' } });
  assert.equal(missingRange.reason, 'MOON_RANGE_REQUIRED_FOR_BIRTH_WINDOW');
});

test('lunar ranges crossing Aries and a nakshatra frontier retain both possibilities', () => {
  for (const range of [{ start: 359, end: 1 }, { start: 359, end: 361 }]) {
    const r = run(0, { utcRange: { start: BIRTH, end: '2000-01-01T04:00:00Z' }, moonLongitudeRange: range });
    assert.equal(r.status, 'uncertain');
    assert.deepEqual(r.possibleBirthNakshatras.map(entry => entry.name), ['Revati', 'Ashwini']);
    assert.deepEqual(r.possibleBirthLords, ['Mercury', 'Ketu']);
  }
});

test('invalid, missing, fabricated or excessive parameters fail explicitly', () => {
  for (const longitude of [undefined, null, NaN, Infinity, -1, 360, '20']) assert.throws(() => calculateVimshottari({ ...input(), moonSiderealLongitude: longitude }), { code: 'VIMSHOTTARI_INVALID_LONGITUDE' });
  for (const horizon of [null, 0, -1, 121, NaN, '120']) assert.throws(() => run(5, { horizonYears: horizon }), { code: 'VIMSHOTTARI_INVALID_HORIZON' });
  for (const tolerance of [null, -1, NaN, Infinity, 1.1, '0.1']) assert.throws(() => run(5, { longitudeToleranceDegrees: tolerance }), { code: 'VIMSHOTTARI_INVALID_LONGITUDE_TOLERANCE' });
  for (const value of ['2000-01-01', '2000-01-01T00:00:00', '2000-02-30T00:00:00Z']) assert.throws(() => run(5, { utcRange: { start: value, end: value } }));
  assert.throws(() => run(5, { asOfUtc: 'tomorrow' }));
  assert.throws(() => run(5, { timeZone: 'fake/zone' }), { code: 'VIMSHOTTARI_INVALID_TIME_ZONE' });
  assert.throws(() => run(5, { evidence: [] }), { code: 'VIMSHOTTARI_UNSUPPORTED_INPUT' });
  assert.throws(() => run(5, { utcRange: { start: BIRTH, end: '1999-12-31T00:00:00Z' } }));
  assert.throws(() => run(5, { utcRange: { start: BIRTH, end: '2000-01-04T00:00:00Z' } }));
  assert.throws(() => run(5, { moonLongitudeRange: { start: 10, end: 11 } }), { code: 'VIMSHOTTARI_INVALID_MOON_RANGE' });
  assert.throws(() => run(5, { moonLongitudeRange: { start: 0, end: 80 } }), { code: 'VIMSHOTTARI_INVALID_MOON_RANGE' });
  assert.throws(() => run(5, { moonLongitudeRange: { start: 0, end: 10, extra: true } }));
});
