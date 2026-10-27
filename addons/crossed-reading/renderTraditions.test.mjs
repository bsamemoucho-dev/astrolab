import assert from 'node:assert/strict';
import test from 'node:test';
import { renderIndependentReading } from './render.mjs';
import { buildComplementPreview } from './index.mjs';

const BIRTH = { birthDate: '1990-01-15', timePrecision: 'exact', timeValue: '16:30', latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris', placeName: 'Paris', country: 'France' };
const modules = (birth = {}) => buildComplementPreview({ birth: { ...BIRTH, ...birth }, personLabel: 'Thème fictif', generatedAt: '2026-10-27T12:00:00.000Z' });
const escaped = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const section = (html, id) => html.match(new RegExp(`<section aria-labelledby="${id}">([\\s\\S]*?)</section>`))?.[1] ?? '';
const localDay = (value, zone) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: zone }).format(new Date(value)).replace(/^1 /u, '1er ');

test('real sidereal, periods and Four Pillars render in separate frames without changing the report', () => {
  const report = modules(), before = structuredClone(report), html = renderIndependentReading(report);
  assert.match(html, /Votre carte sidérale \/ Jyotish/u);
  assert.match(html, /Lahiri IAE 1985/u);
  assert.match(html, /Les périodes Vimshottari/u);
  assert.match(html, /Les quatre piliers du BaZi/u);
  assert.equal((html.match(/class="planet-point"/gu) ?? []).length, 7);
  for (const point of report.jyotish.positions) if (point.status === 'calculated') assert.ok(section(html, 'jyotish-title').includes(escaped(point.signFr)), point.body);
  assert.match(section(html, 'jyotish-title'), /nœuds lunaires <strong>moyens/u);
  assert.match(section(html, 'jyotish-title'), /nakshatra est un secteur sidéral de 13°20′/u);
  assert.ok(section(html, 'jyotish-title').includes(escaped(report.jyotish.nakshatra.name)));
  assert.ok(section(html, 'jyotish-title').includes(`pada ${report.jyotish.nakshatra.pada}`));
  for (const pillar of Object.values(report.bazi.pillars)) {
    assert.ok(section(html, 'bazi-title').includes(escaped(pillar.ganZhi)));
    assert.ok(section(html, 'bazi-title').includes(escaped(pillar.hanzi)));
  }
  assert.deepEqual(report, before);
});

test('period dates render their local uncertainty bounds and only nine current antardashas', () => {
  const report = modules(), d = report.dashas, body = section(renderIndependentReading(report), 'dasha-title');
  assert.equal(d.current.status, 'calculated');
  assert.match(body, /durée fixe de 365,25 jours/u);
  assert.match(body, /débuts sont inclus, les fins exclues/u);
  assert.ok(body.includes(escaped(d.frame.timeZone)));
  const first = d.periods[0].startRangeUtc;
  assert.ok(body.includes(escaped(localDay(first.earliest, d.frame.timeZone))));
  assert.ok(body.includes(escaped(localDay(first.latest, d.frame.timeZone))));
  assert.ok(body.includes(escaped(localDay(d.asOfUtc, d.frame.timeZone))));
  assert.match(body, /ne sont pas redémarrées à cette date/u);
  assert.equal((body.match(/<tbody>/gu) ?? []).length, 2);
  assert.equal((body.match(/<tbody>([\s\S]*?)<\/tbody>/gu) ?? []).reduce((sum, table) => sum + (table.match(/<tr>/gu) ?? []).length, 0), d.periods.length + 9);
  assert.doesNotMatch(body, /T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/u);
});

test('Four Pillars show Li Chun, Jie, civil midnight and civil hour explicitly', () => {
  const body = section(renderIndependentReading(modules()), 'bazi-title');
  assert.match(body, /Li Chun/u); assert.match(body, /termes solaires <strong>Jie/u);
  assert.match(body, /jour à minuit civil/u);
  assert.match(body, /heure civile incluant l’éventuelle heure d’été/u);
  assert.match(body, /heure Zi est partagée à minuit/u);
  assert.match(body, /aucune correction en heure solaire vraie/u);
  assert.match(body, /la frontière diffère de l’année populaire au Nouvel An lunaire/u);
});

test('unknown time renders no unique sidereal degree, house, dasha or hour pillar', () => {
  const report = modules({ timePrecision: 'unknown', timeValue: undefined }), html = renderIndependentReading(report);
  const sidereal = section(html, 'jyotish-title'), periods = section(html, 'dasha-title'), bazi = section(html, 'bazi-title');
  assert.equal(report.jyotish.status, 'uncertain'); assert.equal(report.dashas.status, 'uncertain');
  assert.match(sidereal, /position non établie/u);
  assert.doesNotMatch(sidereal, /<td>Maison \d+<\/td>/u);
  assert.match(periods, /Aucune date précise/u); assert.doesNotMatch(periods, /<table/u);
  assert.equal(report.bazi.pillars.hour.status, 'uncertain');
  assert.match(bazi, /non unique/u); assert.match(bazi, /Possibilités/u);
});

test('a known nakshatra can retain an uncertain pada without inventing the quarter', () => {
  const report = modules(); report.jyotish.nakshatra.status = 'uncertain'; report.jyotish.nakshatra.pada = null;
  const body = section(renderIndependentReading(report), 'jyotish-title');
  assert.ok(body.includes(escaped(report.jyotish.nakshatra.name)));
  assert.match(body, /pada indéterminé/u); assert.doesNotMatch(body, /pada [1-4]/u);
});

test('a period junction gives possible pairs without selecting a false current pair', () => {
  const report = modules();
  report.dashas.current = { status: 'uncertain', mahadasha: null, antardasha: null, candidates: [{ mahadashaLord: 'Moon', antardashaLord: 'Mars' }, { mahadashaLord: 'Mars', antardashaLord: 'Mars' }] };
  const body = section(renderIndependentReading(report), 'dasha-title');
  assert.match(body, /Jonction de périodes incertaine/u);
  assert.match(body, /Lune \/ Mars/u); assert.match(body, /Mars \/ Mars/u);
  assert.doesNotMatch(body, /Les neuf sous-périodes de cette mahadasha/u);
});

test('explicit unavailable calculations show readable limits without replacement tables', () => {
  const report = modules();
  report.jyotish = { ...report.jyotish, status: 'unavailable', reason: 'JYOTISH_DATE_OUTSIDE_VERIFIED_RANGE', positions: [], angles: {}, nakshatra: null };
  report.dashas = { ...report.dashas, status: 'unavailable', reason: 'SOURCE_SIDEREAL_MOON_UNAVAILABLE', periods: [], current: null };
  report.bazi = { ...report.bazi, status: 'unavailable', reason: 'BAZI_DATE_OUTSIDE_SUPPORTED_RANGE', pillars: { year: null, month: null, day: null, hour: null } };
  const html = renderIndependentReading(report);
  for (const id of ['jyotish-title', 'dasha-title', 'bazi-title']) assert.doesNotMatch(section(html, id), /<table/u);
  assert.match(section(html, 'jyotish-title'), /hors de la plage de référence vérifiée/u);
  assert.match(section(html, 'dasha-title'), /La position lunaire sidérale/u);
  assert.match(section(html, 'bazi-title'), /hors de la plage de référence des quatre piliers/u);
});

for (const [label, mutate, expected] of [
  ['tropical Jyotish', r => { r.jyotish.frame.zodiac = 'tropical'; }, /JYOTISH_SIDEREAL_LAHIRI_FRAME_REQUIRED/u],
  ['another ayanamsha', r => { r.jyotish.frame.ayanamshaId = 'fagan_bradley'; }, /JYOTISH_SIDEREAL_LAHIRI_FRAME_REQUIRED/u],
  ['sidereal quadrant houses', r => { r.jyotish.frame.houseSystem = 'PLACIDUS'; }, /JYOTISH_SIDEREAL_LAHIRI_FRAME_REQUIRED/u],
  ['true nodes substituted', r => { r.jyotish.frame.meanNodeConvention = 'true_node'; }, /JYOTISH_SIDEREAL_LAHIRI_FRAME_REQUIRED/u],
  ['zero Jyotish tolerance', r => { r.jyotish.frame.numericalLongitudeToleranceDegrees = 0; }, /JYOTISH_SIDEREAL_LAHIRI_FRAME_REQUIRED/u],
  ['360-day dasha year', r => { r.dashas.frame.yearDays = 360; }, /VIMSHOTTARI_FRAME_REQUIRED/u],
  ['tropical dasha', r => { r.dashas.frame.zodiac = 'tropical'; }, /VIMSHOTTARI_FRAME_REQUIRED/u],
  ['missing dasha Moon proof', r => { r.dashas.sourceMoonEvidenceRef = 'natal.moon.sign'; }, /VIMSHOTTARI_SIDEREAL_MOON_SOURCE_REQUIRED/u],
  ['dasha tolerance below its Moon source', r => { r.dashas.frame.moonLongitudeToleranceDegrees = 0; }, /VIMSHOTTARI_SIDEREAL_MOON_SOURCE_REQUIRED/u],
  ['zero BaZi solar guard', r => { r.bazi.frame.solarBoundaryGuardSeconds = 0; }, /BAZI_CIVIL_JIE_FRAME_REQUIRED/u],
  ['lunar New Year used for BaZi', r => { r.bazi.frame.yearBoundary = 'lunar_new_year'; }, /BAZI_CIVIL_JIE_FRAME_REQUIRED/u],
  ['lunar month used for Jie', r => { r.bazi.frame.monthBoundary = 'lunar_month'; }, /BAZI_CIVIL_JIE_FRAME_REQUIRED/u],
  ['23h day substituted', r => { r.bazi.frame.dayBoundary = 'zi_23'; }, /BAZI_CIVIL_JIE_FRAME_REQUIRED/u],
  ['true solar time substituted', r => { r.bazi.frame.hourBasis = 'true_solar'; r.bazi.frame.solarTimeCorrectionApplied = true; }, /BAZI_CIVIL_JIE_FRAME_REQUIRED/u]
]) test(`new tradition frame rejects ${label}`, () => { const report = modules(); mutate(report); assert.throws(() => renderIndependentReading(report), expected); });

test('new dynamic fields are escaped and cannot introduce a network asset or executable code', () => {
  const report = modules(), payload = '<img src=x onerror="alert(1)"><script>bad()</script>&';
  report.jyotish.positions[0].label = payload; report.jyotish.positions[0].signFr = payload;
  report.jyotish.angles.ascendant.signFr = payload; report.jyotish.nakshatra.name = payload;
  report.jyotish.warnings = [payload]; report.jyotish.frame.ayanamshaVersion = payload;
  report.dashas.birthBalance.lord = payload; report.dashas.periods[0].lord = payload;
  report.bazi.pillars.year.stem = payload; report.bazi.pillars.month.ganZhi = payload;
  report.bazi.frame.timeZone = payload;
  const html = renderIndependentReading(report);
  assert.ok(html.includes(escaped(payload)));
  assert.doesNotMatch(html, /<script\b|<img\b|<[^>]+\son(?:error|load)=/iu);
  assert.doesNotMatch(html, /<(?:script|iframe|form|link|object|embed|button)\b|@import|url\(|javascript:|(?:src|href|action)\s*=\s*["']\s*(?:https?:|\/\/)/iu);
});

test('high-latitude presentation hides angular material but preserves planets, aspects and lunar periods', () => {
  const report = modules({ latitude: 70, longitude: 18.9, timeZone: 'Europe/Oslo' }), before = structuredClone(report);
  const html = renderIndependentReading(report), tropical = section(html, 'tropical-title');
  assert.match(tropical, /Angles et maisons non restitués à ces latitudes dans ce complément ; positions planétaires conservées/u);
  assert.doesNotMatch(tropical, /class="chart-angle"|class="house-cusp"|class="angle-label"|<td>Maison \d+<\/td>/u);
  assert.equal((html.match(/class="planet-point"/gu) ?? []).length, 7);
  assert.equal((html.match(/class="aspect-line"/gu) ?? []).length, report.tropical.socle.aspectGeometry.length);
  for (const point of report.tropical.socle.bodies) assert.ok(tropical.includes(escaped(point.degreeLabel)));
  assert.equal(report.dashas.status, 'calculated'); assert.match(html, /Les périodes Vimshottari/u);
  assert.equal(report.jyotish.positions.find(point => point.body === 'Moon').status, 'calculated');
  assert.doesNotMatch(section(html, 'symbolic-title'), /en maison \d+|Ascendant en/u);
  assert.deepEqual(report, before);
});
