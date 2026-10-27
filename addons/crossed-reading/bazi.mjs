// Independent calendrical Four Pillars. No model, network, personal diagnosis,
// western interpretation rule, payment, store or notification is used here.
import { SearchSunLongitude } from 'astronomy-engine';
import { ASTRONOMY_ENGINE_VERSION } from '../../src/astro/constants.mjs';
import { resolveLocalDateTimeCandidates, timezoneDatabaseVersion, timezoneOffsetSeconds } from '../../src/astro/time.mjs';

export const BAZI_METHOD_VERSION = 'lastro-bazi-civil-jie@1.0.0';
export const BAZI_SOLAR_BOUNDARY_GUARD_SECONDS = 120;
const DAY_MS = 86400000, HOUR_MS = 3600000;
const MIN_UTC = Date.parse('1901-01-01T00:00:00Z'), MAX_UTC = Date.parse('2030-12-31T23:59:59.999Z');
// HKO Almanac 2024, January calendar: 1 January is 甲子 (Jia-Zi).
// The Gregorian civil-day count continues independently of lunar months/years.
const DAY_REFERENCE = Object.freeze({ civilDate: '2024-01-01', ordinal: Date.UTC(2024, 0, 1) / DAY_MS, cycleIndex: 0 });
const STEMS = Object.freeze(['Jia','Yi','Bing','Ding','Wu','Ji','Geng','Xin','Ren','Gui']);
const STEM_ZH = Object.freeze(['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']);
const BRANCHES = Object.freeze(['Zi','Chou','Yin','Mao','Chen','Si','Wu','Wei','Shen','You','Xu','Hai']);
const BRANCH_ZH = Object.freeze(['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']);
const JIE = Object.freeze([
  ['Li Chun','Début du printemps',315], ['Jing Zhe','Éveil des insectes',345],
  ['Qing Ming','Clarté pure',15], ['Li Xia','Début de l’été',45],
  ['Mang Zhong','Grain en épi',75], ['Xiao Shu','Petite chaleur',105],
  ['Li Qiu','Début de l’automne',135], ['Bai Lu','Rosée blanche',165],
  ['Han Lu','Rosée froide',195], ['Li Dong','Début de l’hiver',225],
  ['Da Xue','Grande neige',255], ['Xiao Han','Petit froid',285]
]);
const SOURCES = Object.freeze([
  'https://www.hko.gov.hk/en/gts/time/stemsandbranches.htm',
  'https://www.hko.gov.hk/en/education/astronomy-and-time/time-service/00506-what-year-is-it-today.html',
  'https://my.weather.gov.hk/en/gts/astron2024/files/HKO_almanac_2024.pdf',
  'https://www.hko.gov.hk/tc/gts/astron2025/files/HKO_almanac_2025.pdf',
  'https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#SearchSunLongitude'
]);
const solarCache = new Map();
const mod = (n, d) => ((n % d) + d) % d;
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)) fail('BAZI_UTC_RANGE_REQUIRED');
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 19) !== value.slice(0, 19)) fail('BAZI_INVALID_UTC_RANGE');
  return result.getTime();
}
function pillarValue(stemIndex, branchIndex) {
  const stem = STEMS[stemIndex], branch = BRANCHES[branchIndex];
  if (!stem || !branch || stemIndex % 2 !== branchIndex % 2) fail('BAZI_INVALID_STEM_BRANCH_PAIR');
  return { stem, branch, stemIndex, branchIndex, ganZhi: `${stem}-${branch}`, hanzi: STEM_ZH[stemIndex] + BRANCH_ZH[branchIndex] };
}
function fieldsFormatter(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) fail('BAZI_TIME_ZONE_REQUIRED');
  try {
    return new Intl.DateTimeFormat('en-CA', { calendar:'gregory', numberingSystem:'latn', timeZone,
      year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' });
  } catch { fail('BAZI_INVALID_TIME_ZONE'); }
}
function localFields(formatter, ms) {
  return Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
function civilOrdinal(fields) { return Date.UTC(fields.year, fields.month - 1, fields.day) / DAY_MS; }
function dayAt(fields) {
  const cycleIndex = mod(civilOrdinal(fields) - DAY_REFERENCE.ordinal + DAY_REFERENCE.cycleIndex, 60);
  return { ...pillarValue(cycleIndex % 10, cycleIndex % 12), cycleIndex };
}
function hourAt(fields, day) {
  const branch = Math.floor((fields.hour + 1) / 2) % 12;
  return pillarValue(mod(2 * (day.stemIndex % 5) + branch, 10), branch);
}

// A solar year starts at the actual geocentric apparent Sun longitude 315°.
// Internal roots remain UTC instants, not the Hong Kong date printed in a table.
export function baziSolarTerms(solarYear) {
  if (!Number.isInteger(solarYear) || solarYear < 1899 || solarYear > 2101) fail('BAZI_SOLAR_YEAR_OUT_OF_RANGE');
  if (!solarCache.has(solarYear)) {
    const first = SearchSunLongitude(315, new Date(Date.UTC(solarYear, 0, 25)), 20);
    if (!first) fail('BAZI_SOLAR_TERM_SEARCH_FAILED');
    const terms = [];
    let found = first;
    for (let index = 0; index <= 12; index++) {
      const [name, labelFr, longitude] = JIE[index % 12];
      if (index > 0) found = SearchSunLongitude(longitude, found.AddDays(20), 20);
      if (!found) fail('BAZI_SOLAR_TERM_SEARCH_FAILED');
      const ms = found.date.getTime();
      if (!Number.isFinite(ms) || (index && ms <= terms[index - 1].unixMs)) fail('BAZI_SOLAR_TERM_SEARCH_FAILED');
      terms.push(Object.freeze({ name, labelFr, longitude, unixMs: ms, utc: new Date(ms).toISOString(), monthIndex: index % 12 }));
    }
    solarCache.set(solarYear, Object.freeze(terms));
  }
  // Return new records so no caller can alter any cached calendrical boundary.
  return solarCache.get(solarYear).map(term => ({ ...term }));
}
function solarAt(ms) {
  const utcYear = new Date(ms).getUTCFullYear();
  const spring = baziSolarTerms(utcYear)[0].unixMs;
  const solarYear = ms < spring ? utcYear - 1 : utcYear;
  const terms = baziSolarTerms(solarYear);
  const monthIndex = terms.findIndex((term, index) => index < 12 && ms >= term.unixMs && ms < terms[index + 1].unixMs);
  if (monthIndex < 0) fail('BAZI_SOLAR_TERM_INTERVAL_UNRESOLVED');
  const year = pillarValue(mod(solarYear - 4, 10), mod(solarYear - 4, 12));
  const month = pillarValue(mod(2 * (year.stemIndex % 5) + 2 + monthIndex, 10), mod(monthIndex + 2, 12));
  return { year: { ...year, solarYear }, month: { ...month, monthIndex, startsAtUtc: terms[monthIndex].utc, endsAtUtc: terms[monthIndex + 1].utc, jie: terms[monthIndex].name } };
}
function unique(values) {
  const seen = new Set();
  return values.filter(value => { if (seen.has(value.ganZhi)) return false; seen.add(value.ganZhi); return true; });
}
function classify(role, values, reason) {
  const candidates = unique(values);
  const evidenceId = `bazi.pillar.${role}`;
  if (candidates.length === 1) return { status: 'calculated', ...candidates[0], evidenceId };
  return { status: 'uncertain', stem: null, branch: null, stemIndex: null, branchIndex: null, ganZhi: null, hanzi: null, candidates, reason, evidenceId };
}

// Enumerate civil boundaries exactly instead of using only window endpoints:
// an unknown full day can begin/end in Zi but includes all 12 double-hours.
// IANA offset changes are also located; skipped or repeated local times are
// accepted only through real UTC candidates returned by the existing resolver.
function civilSamples(start, end, timeZone, formatter) {
  if (start === end) return [start];
  const samples = new Set([start, end]);
  const add = ms => { if (ms >= start && ms <= end) samples.add(ms); };
  const localDays = [start, (start + end) / 2, end].map(ms => civilOrdinal(localFields(formatter, ms)));
  const minDay = Math.min(...localDays) - 1, maxDay = Math.max(...localDays) + 1;
  for (let ordinal = minDay; ordinal <= maxDay; ordinal++) {
    const day = new Date(ordinal * DAY_MS);
    const date = { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() };
    for (const hour of [0,1,3,5,7,9,11,13,15,17,19,21,23]) {
      const candidates = resolveLocalDateTimeCandidates({ date, time: { hour, minute: 0, second: 0 }, timeZone });
      for (const candidate of candidates) { const ms = candidate.utcInstant.getTime(); add(ms); add(ms - 1); }
    }
  }
  // Existing offset helper expects a whole-second instant. Floor here so a
  // millisecond sample does not masquerade as a one-second offset change.
  const offsetAt = ms => timezoneOffsetSeconds(timeZone, new Date(Math.floor(ms / 1000) * 1000));
  let left = start, offset = offsetAt(left);
  while (left < end) {
    const right = Math.min(end, left + HOUR_MS), nextOffset = offsetAt(right);
    if (offset !== nextOffset) {
      let low = left, high = right;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (offsetAt(mid) === offset) low = mid; else high = mid;
      }
      add(high - 1); add(high);
    }
    left = right; offset = nextOffset;
  }
  return [...samples].sort((a,b) => a-b);
}

export function calculateBazi({ birth, utcRange } = {}) {
  if (!birth || typeof birth !== 'object' || Array.isArray(birth)) fail('BAZI_BIRTH_CONTEXT_REQUIRED');
  const formatter = fieldsFormatter(birth.timeZone);
  const start = instant(utcRange?.start), end = instant(utcRange?.end);
  if (end < start || end - start > 48 * HOUR_MS) fail('BAZI_INVALID_UTC_RANGE');
  const frame = {
    method: 'bazi-four-pillars', methodVersion: BAZI_METHOD_VERSION,
    calendar: 'gregorian-civil-plus-solar-jie', yearBoundary:'li_chun', monthBoundary:'jie_solar_terms',
    dayBoundary:'local_midnight', ziHourConvention:'split_at_local_midnight', hourBasis:'local_civil',
    solarTimeCorrectionApplied:false, daylightSaving:'included_in_IANA_civil_time',
    timeZone: formatter.resolvedOptions().timeZone, requestedTimeZone: birth.timeZone,
    engineVersion: ASTRONOMY_ENGINE_VERSION, solarCoordinateSystem:'geocentric_apparent_true_ecliptic_of_date',
    solarRootSearchPrecisionSeconds:0.01, solarBoundaryGuardSeconds:BAZI_SOLAR_BOUNDARY_GUARD_SECONDS,
    guardMeaning:'conservative_classification_buffer_not_statistical_confidence',
    timezoneDatabaseVersion:timezoneDatabaseVersion(), runtimeIcu:process.versions.icu ?? null,
    dayReference: { civilDate:DAY_REFERENCE.civilDate, ganZhi:'Jia-Zi', source:SOURCES[2] },
    supportedUtcYears:[1901,2030], sources:[...SOURCES]
  };
  if (start < MIN_UTC || end > MAX_UTC) return { status:'unavailable', reason:'BAZI_DATE_OUTSIDE_SUPPORTED_RANGE', frame, pillars:{year:null,month:null,day:null,hour:null}, evidence:[], interpretationStatus:'not_licensed' };
  const guard = BAZI_SOLAR_BOUNDARY_GUARD_SECONDS * 1000;
  const solarEnds = [solarAt(start - guard), solarAt(end + guard)];
  const samples = civilSamples(start, end, birth.timeZone, formatter).map(ms => localFields(formatter, ms));
  const days = samples.map(dayAt), hours = samples.map((fields, index) => hourAt(fields, days[index]));
  const pillars = {
    year: classify('year', solarEnds.map(value => value.year), 'BIRTH_WINDOW_OR_SOLAR_BOUNDARY_GUARD'),
    month: classify('month', solarEnds.map(value => value.month), 'BIRTH_WINDOW_OR_SOLAR_BOUNDARY_GUARD'),
    day: classify('day', days, 'BIRTH_WINDOW_CROSSES_LOCAL_MIDNIGHT'),
    hour: classify('hour', hours, 'BIRTH_WINDOW_CROSSES_CIVIL_DOUBLE_HOUR_OR_MIDNIGHT')
  };
  // Unknown time never becomes an exact hour merely because a caller supplied
  // a contradictory point instead of the full date window.
  if (birth.timePrecision === 'unknown' && pillars.hour.status === 'calculated') {
    const candidate = { ...pillars.hour }; delete candidate.status; delete candidate.evidenceId;
    pillars.hour = { status:'uncertain', stem:null,branch:null,stemIndex:null,branchIndex:null,ganZhi:null,hanzi:null,
      candidates:[candidate], reason:'BIRTH_TIME_UNKNOWN_REQUIRES_COMPLETE_WINDOW', evidenceId:'bazi.pillar.hour' };
  }
  const evidence = Object.entries(pillars).map(([role, pillar]) => ({
    evidenceId:pillar.evidenceId, type:'BAZI_PILLAR', role, frame:'bazi-civil-jie', methodVersion:BAZI_METHOD_VERSION,
    status:pillar.status, value:pillar.status === 'calculated' ? Object.fromEntries(Object.entries(pillar).filter(([key]) => !['status','evidenceId'].includes(key))) : null,
    ...(pillar.status === 'uncertain' ? { candidates:structuredClone(pillar.candidates), reason:pillar.reason } : {}),
    utcRange:{start:new Date(start).toISOString(),end:new Date(end).toISOString()}, interpretationStatus:'not_licensed'
  }));
  return {
    status:Object.values(pillars).every(pillar => pillar.status === 'calculated') ? 'calculated' : 'uncertain',
    frame, utcRange:{start:new Date(start).toISOString(),end:new Date(end).toISOString()}, pillars, evidence,
    interpretationStatus:'not_licensed'
  };
}
