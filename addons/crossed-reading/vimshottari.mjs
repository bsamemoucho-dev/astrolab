// Independent arithmetic implementation of a documented Vimshottari profile.
// Input must already be a calculated sidereal Moon longitude. No ephemeris,
// tropical conversion, interpretation, network, store or provider is invoked.
export const VIMSHOTTARI_VERSION = 'lastro-vimshottari@0.1.0';
export const VIMSHOTTARI_YEAR_DAYS = 365.25;
export const VIMSHOTTARI_LORDS = Object.freeze([
  Object.freeze({ lord: 'Ketu', years: 7 }), Object.freeze({ lord: 'Venus', years: 20 }),
  Object.freeze({ lord: 'Sun', years: 6 }), Object.freeze({ lord: 'Moon', years: 10 }),
  Object.freeze({ lord: 'Mars', years: 7 }), Object.freeze({ lord: 'Rahu', years: 18 }),
  Object.freeze({ lord: 'Jupiter', years: 16 }), Object.freeze({ lord: 'Saturn', years: 19 }),
  Object.freeze({ lord: 'Mercury', years: 17 })
]);
const NAMES = Object.freeze(['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati']);
const YEAR_MS = VIMSHOTTARI_YEAR_DAYS * 86400000;
const WIDTH = 360 / 27;
const INPUT_KEYS = new Set(['utcRange', 'moonSiderealLongitude', 'moonLongitudeRange', 'longitudeToleranceDegrees', 'asOfUtc', 'horizonYears', 'timeZone']);
const mod = (n, d) => ((n % d) + d) % d;
function fail(code) { throw Object.assign(new TypeError(code), { code }); }
function record(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(code);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.has(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) fail(code);
  }
}
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)) fail('VIMSHOTTARI_UTC_REQUIRED');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== value.slice(0, 19)) fail('VIMSHOTTARI_INVALID_UTC');
  return date.getTime();
}
function degrees(value, max = 360) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= max) fail('VIMSHOTTARI_INVALID_LONGITUDE');
  return value;
}
function iso(value) {
  const date = new Date(Math.round(value));
  if (!Number.isFinite(date.getTime())) fail('VIMSHOTTARI_DATE_OVERFLOW');
  return date.toISOString();
}
function nakshatra(index) {
  const canonical = mod(index, 27);
  return { index: canonical, number: canonical + 1, name: NAMES[canonical], lord: VIMSHOTTARI_LORDS[canonical % 9].lord };
}
function possibleNakshatras(start, width, tolerance) {
  const first = Math.floor((start - tolerance) * 27 / 360);
  const last = Math.floor((start + width + tolerance) * 27 / 360);
  return Array.from({ length: last - first + 1 }, (_, i) => nakshatra(first + i));
}
function ranges(value, uncertaintyMs) { return { earliest: iso(value - uncertaintyMs), latest: iso(value + uncertaintyMs) }; }
function period(lordIndex, start, years, uncertaintyMs, mahaLord = null) {
  const end = start + years * YEAR_MS;
  return {
    lord: VIMSHOTTARI_LORDS[lordIndex].lord,
    ...(mahaLord ? { mahadashaLord: mahaLord } : {}), durationYears: years,
    startUtc: iso(start), endUtc: iso(end),
    startRangeUtc: ranges(start, uncertaintyMs), endRangeUtc: ranges(end, uncertaintyMs)
  };
}
function activeAt(periods, date, visibleStart, visibleEnd) {
  if (date < visibleStart || date >= visibleEnd) return { status: 'outside_horizon', mahadasha: null, antardasha: null };
  const candidates = [];
  for (const maha of periods) {
    if (date < Date.parse(maha.startRangeUtc.earliest) || date >= Date.parse(maha.endRangeUtc.latest)) continue;
    for (const antar of maha.antardashas) {
      if (date >= Date.parse(antar.startRangeUtc.earliest) && date < Date.parse(antar.endRangeUtc.latest)) candidates.push({ mahadasha: maha, antardasha: antar });
    }
  }
  if (candidates.length === 1) return { status: 'calculated', ...candidates[0] };
  return { status: 'uncertain', mahadasha: null, antardasha: null,
    candidates: candidates.map(({ mahadasha, antardasha }) => ({ mahadashaLord: mahadasha.lord, antardashaLord: antardasha.lord })) };
}

export function calculateVimshottari(input = {}) {
  record(input, INPUT_KEYS, 'VIMSHOTTARI_UNSUPPORTED_INPUT');
  record(input.utcRange, new Set(['start', 'end']), 'VIMSHOTTARI_INVALID_UTC_RANGE');
  const start = utc(input.utcRange.start), end = utc(input.utcRange.end);
  if (end < start || end - start > 48 * 3600000) fail('VIMSHOTTARI_INVALID_UTC_RANGE');
  const longitude = degrees(input.moonSiderealLongitude);
  const tolerance = input.longitudeToleranceDegrees === undefined ? 0 : input.longitudeToleranceDegrees;
  if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) fail('VIMSHOTTARI_INVALID_LONGITUDE_TOLERANCE');
  const horizonYears = input.horizonYears === undefined ? 120 : input.horizonYears;
  if (typeof horizonYears !== 'number' || !Number.isFinite(horizonYears) || horizonYears <= 0 || horizonYears > 120) fail('VIMSHOTTARI_INVALID_HORIZON');
  const timeZone = input.timeZone === undefined ? 'UTC' : input.timeZone;
  if (typeof timeZone !== 'string' || !timeZone) fail('VIMSHOTTARI_INVALID_TIME_ZONE');
  try { new Intl.DateTimeFormat('en', { timeZone }); } catch { fail('VIMSHOTTARI_INVALID_TIME_ZONE'); }
  const asOf = input.asOfUtc === undefined || input.asOfUtc === null ? null : utc(input.asOfUtc);
  let rangeStart = longitude, rangeWidth = 0;
  if (input.moonLongitudeRange !== undefined) {
    record(input.moonLongitudeRange, new Set(['start', 'end']), 'VIMSHOTTARI_INVALID_MOON_RANGE');
    rangeStart = degrees(input.moonLongitudeRange.start);
    const rangeEnd = degrees(input.moonLongitudeRange.end, 720);
    rangeWidth = rangeEnd >= rangeStart ? rangeEnd - rangeStart : rangeEnd + 360 - rangeStart;
    if (rangeWidth > 40 || mod(longitude - rangeStart, 360) > rangeWidth + 1e-10) fail('VIMSHOTTARI_INVALID_MOON_RANGE');
  } else if (start !== end) {
    // A birth window without its lunar range cannot support even a complete
    // list of possible nakshatras; never replace it with a noon point.
    return { status: 'uncertain', reason: 'MOON_RANGE_REQUIRED_FOR_BIRTH_WINDOW', frame: frame(timeZone, tolerance),
      periods: [], current: null, interpretationStatus: 'not_licensed' };
  }
  const possible = possibleNakshatras(rangeStart, rangeWidth, tolerance);
  const base = { frame: frame(timeZone, tolerance), asOfUtc: asOf === null ? null : iso(asOf), interpretationStatus: 'not_licensed' };
  if (start !== end || rangeWidth > 0 || possible.length > 1) {
    return { ...base, status: 'uncertain', reason: possible.length > 1 ? 'BIRTH_NAKSHATRA_UNCERTAIN' : 'BIRTH_TIME_OR_LONGITUDE_UNCERTAIN',
      utcRange: { start: iso(start), end: iso(end) },
      possibleBirthNakshatras: possible, possibleBirthLords: [...new Set(possible.map(entry => entry.lord))], periods: [], current: null };
  }
  const index = Math.floor(longitude * 27 / 360), lordIndex = index % 9;
  const totalYears = VIMSHOTTARI_LORDS[lordIndex].years;
  const fraction = longitude * 27 / 360 - index;
  const elapsedYears = fraction * totalYears, remainingYears = (1 - fraction) * totalYears;
  const anchor = Math.round(start - elapsedYears * YEAR_MS);
  const uncertaintyYears = tolerance / WIDTH * totalYears, uncertaintyMs = uncertaintyYears * YEAR_MS;
  const visibleEnd = start + horizonYears * YEAR_MS;
  const periods = [];
  let cursor = anchor, ordinal = 0;
  while (cursor < visibleEnd && ordinal < 11) {
    const currentIndex = (lordIndex + ordinal) % 9, years = VIMSHOTTARI_LORDS[currentIndex].years;
    const maha = period(currentIndex, cursor, years, uncertaintyMs);
    let subCursor = cursor;
    maha.antardashas = Array.from({ length: 9 }, (_, i) => {
      const subIndex = (currentIndex + i) % 9;
      const subYears = years * VIMSHOTTARI_LORDS[subIndex].years / 120;
      const child = period(subIndex, subCursor, subYears, uncertaintyMs, maha.lord);
      subCursor += subYears * YEAR_MS;
      // The exact proportional subdivisions fill their parent. Pin the last
      // serialized endpoint to the same integer millisecond, never beyond it.
      if (i === 8) { child.endUtc = maha.endUtc; child.endRangeUtc = { ...maha.endRangeUtc }; }
      return child;
    });
    maha.visibleStartUtc = iso(Math.max(cursor, start));
    maha.visibleEndUtc = iso(Math.min(cursor + years * YEAR_MS, visibleEnd));
    periods.push(maha); cursor += years * YEAR_MS; ordinal++;
  }
  return { ...base, status: 'calculated', birthUtc: iso(start),
    birthNakshatra: { ...nakshatra(index), longitude, withinDegrees: fraction * WIDTH, fractionElapsed: fraction },
    birthBalance: { lord: VIMSHOTTARI_LORDS[lordIndex].lord, totalYears, elapsedYears, remainingYears,
      remainingDays: remainingYears * VIMSHOTTARI_YEAR_DAYS,
      remainingYearsRange: { min: remainingYears - uncertaintyYears, max: remainingYears + uncertaintyYears } },
    visibleFromUtc: iso(start), visibleUntilUtc: iso(visibleEnd), periods,
    current: asOf === null ? null : activeAt(periods, asOf, start, visibleEnd) };
}
function frame(timeZone, tolerance) {
  return {
    method: VIMSHOTTARI_VERSION, tradition: 'jyotisha', system: 'Vimshottari', zodiac: 'sidereal',
    yearDays: VIMSHOTTARI_YEAR_DAYS, cycleYears: 120,
    yearConvention: 'fixed_365_25_day_duration_not_calendar_anniversary',
    periodBoundary: 'start_inclusive_end_exclusive', timeZone, timestampScale: 'UTC',
    moonInput: 'caller_supplied_calculated_sidereal_longitude', moonLongitudeToleranceDegrees: tolerance,
    datePrecision: tolerance ? 'nominal_milliseconds_with_longitude_tolerance_bounds' : 'arithmetic_milliseconds_not_ephemeris_accuracy',
    sources: ['https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf', 'https://goravani.com/resources/DasGoravani.pdf']
  };
}
