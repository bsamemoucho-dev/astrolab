// Annual popular calendar convention only. This is not the Ba Zi year pillar.
// No network, storage or personalised symbolic reading.
export const CHINESE_ANNUAL_VERSION = 'lastro-chinese-annual-calendar@0.1.0';
const STEMS = ['Jia', 'Yi', 'Bing', 'Ding', 'Wu', 'Ji', 'Geng', 'Xin', 'Ren', 'Gui'];
const BRANCHES = ['Zi', 'Chou', 'Yin', 'Mao', 'Chen', 'Si', 'Wu', 'Wei', 'Shen', 'You', 'Xu', 'Hai'];
const ANIMALS = ['Rat', 'Bœuf', 'Tigre', 'Lapin', 'Dragon', 'Serpent', 'Cheval', 'Chèvre', 'Singe', 'Coq', 'Chien', 'Cochon'];
const ELEMENTS = ['Bois', 'Feu', 'Terre', 'Métal', 'Eau'];
const SOURCES = [
  'https://www.hko.gov.hk/en/gts/time/conversion.htm',
  'https://www.weather.gov.hk/en/gts/time/stemsandbranches.htm',
  'https://www.hsiacalendar.com/legend'
];
const MIN = Date.parse('1900-12-31T16:00:00.000Z');
const MAX = Date.parse('2030-12-31T15:59:59.999Z');
const mod = (n, d) => ((n % d) + d) % d;
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)) throw new TypeError('UTC_RANGE_REQUIRED');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== value.slice(0, 19)) throw new TypeError('INVALID_UTC_RANGE');
  return date;
}
export function calculateChineseAnnual({ utcRange } = {}) {
  const start = instant(utcRange?.start), end = instant(utcRange?.end);
  if (end < start || end - start > 48 * 3600000) throw new RangeError('INVALID_UTC_RANGE');
  const frame = {
    method: CHINESE_ANNUAL_VERSION, calendar: 'chinese-lunisolar',
    yearBoundary: 'lunar_new_year', timeZone: 'Asia/Shanghai',
    engine: 'ECMA-402.Intl.DateTimeFormat', runtimeIcu: process.versions.icu ?? null,
    runtimeNode: process.versions.node, runtimeTz: process.versions.tz ?? null,
    supportedCivilYears: [1901, 2030],
    classificationNature: 'calendrical_traditional_label',
    sources: [...SOURCES]
  };
  const unavailable = (reason) => ({ status: 'unavailable', reason, frame, interpretationStatus: 'not_licensed' });
  if (start.getTime() < MIN || end.getTime() > MAX) return unavailable('DATE_OUTSIDE_LOCAL_PREVIEW_RANGE');
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-u-ca-chinese', { calendar: 'chinese', timeZone: frame.timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
  } catch { return unavailable('CHINESE_CALENDAR_RUNTIME_UNAVAILABLE'); }
  if (formatter.resolvedOptions().calendar !== 'chinese') return unavailable('CHINESE_CALENDAR_RUNTIME_UNAVAILABLE');
  const relatedYear = (date) => {
    const part = formatter.formatToParts(date).find((entry) => entry.type === 'relatedYear');
    return part && /^\d{4}$/u.test(part.value) ? Number(part.value) : null;
  };
  const first = relatedYear(start), last = relatedYear(end);
  if (first === null || last === null) return unavailable('CHINESE_CALENDAR_COUNTER_UNAVAILABLE');
  if (first !== last) return unavailable('ANNUAL_YEAR_UNCERTAIN_WITHIN_BIRTH_WINDOW');
  const stemIndex = mod(first - 4, 10), branchIndex = mod(first - 4, 12);
  return {
    status: 'calculated', frame, relatedYear: first,
    stem: STEMS[stemIndex], branch: BRANCHES[branchIndex],
    animalFr: ANIMALS[branchIndex], elementFr: ELEMENTS[Math.floor(stemIndex / 2)],
    evidenceId: `chinese.annual.${first}`, utcRange: { start: start.toISOString(), end: end.toISOString() },
    interpretationStatus: 'not_licensed'
  };
}
