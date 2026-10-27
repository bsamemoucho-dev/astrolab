import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildComplementPreview } from './index.mjs';
import { runPreview } from './run.mjs';
const BIRTH = { birthDate: '1990-01-15', timePrecision: 'exact', timeValue: '16:30', latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris', placeName: 'Paris' };
const args = () => ({ birth: { ...BIRTH }, personLabel: 'Thème fictif', generatedAt: '2026-10-27T12:00:00Z' });
test('the supplementary calendar has its own frame and creates no western or cross-tradition licence', () => {
  const input = args(), before = structuredClone(input);
  const report = buildComplementPreview(input);
  assert.equal(report.status, 'local_preview');
  assert.equal(report.chineseAnnual.frame.calendar, 'chinese-lunisolar');
  assert.equal(report.chineseAnnual.frame.zodiac, undefined);
  assert.equal(report.chineseAnnual.interpretationStatus, 'not_licensed');
  assert.equal(report.crossTraditionSynthesis.status, 'not_licensed');
  assert.equal(report.tropical.frame.zodiac, 'tropical');
  assert.ok(report.symbolic.entries.every(entry => entry.frame === 'western-tropical'));
  assert.deepEqual(input, before);
  assert.throws(() => buildComplementPreview({ ...input, chineseAnnual: { relatedYear: 2000 } }));
});
test('an unknown civil birth day crossing Chinese new year has no invented animal', () => {
  const report = buildComplementPreview({ ...args(), birth: { ...BIRTH, birthDate: '1989-02-05', timePrecision: 'unknown', timeValue: undefined, timeZone: 'America/New_York', latitude: 40.7128, longitude: -74.006 } });
  assert.equal(report.chineseAnnual.status, 'unavailable');
  assert.equal(report.chineseAnnual.reason, 'ANNUAL_YEAR_UNCERTAIN_WITHIN_BIRTH_WINDOW');
  assert.equal(report.chineseAnnual.animalFr, undefined);
  assert.equal(report.tropical.result.astronomicalCalculation.angles.status, 'not_calculated_time_unknown');
  assert.equal(report.tropical.result.astronomicalCalculation.angles.ascendant, null);
  assert.equal(report.tropical.result.astronomicalCalculation.angles.midheaven, null);
});
test('the local command writes private new files and never overwrites existing input/output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lastro-complement-'));
  try {
    const input = join(dir, 'input.json'), out = join(dir, 'preview');
    const original = JSON.stringify(args()); writeFileSync(input, original, { mode: 0o600 });
    assert.deepEqual(runPreview(['--input', input, '--out', out]), { status: 'local_preview', filesCreated: 2, aiCalls: 0, aiSpentUsd: 0 });
    assert.equal(readFileSync(input, 'utf8'), original);
    const report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
    assert.equal(report.status, 'local_preview');
    assert.match(readFileSync(join(out, 'preview.html'), 'utf8'), /<!doctype html>/iu);
    assert.equal(statSync(out).mode & 0o777, 0o700);
    assert.equal(statSync(join(out, 'report.json')).mode & 0o777, 0o600);
    assert.equal(statSync(join(out, 'preview.html')).mode & 0o777, 0o600);
    assert.throws(() => runPreview(['--input', input, '--out', out]), { code: 'OUTPUT_ALREADY_EXISTS' });
    assert.equal(readFileSync(input, 'utf8'), original);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('paid flags, malformed input and forged facts fail before an output is created', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lastro-complement-negative-'));
  try {
    const input = join(dir, 'input.json'), out = join(dir, 'preview');
    for (const argv of [['--allow-paid', 'yes', '--out', out], ['--input', input], ['--input', input, '--input', input]]) assert.throws(() => runPreview(argv), { code: 'INVALID_ARGUMENTS' });
    writeFileSync(input, JSON.stringify({ ...args(), evidence: [{ sign: 'Taurus' }] }));
    assert.throws(() => runPreview(['--input', input, '--out', out]));
    assert.throws(() => statSync(out));
    mkdirSync(out); writeFileSync(join(out, 'keep'), 'existing');
    assert.throws(() => runPreview(['--input', input, '--out', out]), { code: 'OUTPUT_ALREADY_EXISTS' });
    assert.equal(readFileSync(join(out, 'keep'), 'utf8'), 'existing');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('the three real methods are integrated without assigning sidereal or BaZi interpretation rights', () => {
  const input=args(),before=structuredClone(input),report=buildComplementPreview(input);
  for(const key of ['jyotish','dashas','bazi'])assert.equal(report[key].status,'calculated',key);
  assert.equal(report.jyotish.positions.length,9);
  assert.equal(report.jyotish.frame.zodiac,'sidereal');
  assert.equal(report.dashas.frame.system,'Vimshottari');
  assert.equal(report.bazi.frame.yearBoundary,'li_chun');
  assert.ok(report.unavailable.every(item=>!['jyotisha-natal','jyotisha-nakshatras','jyotisha-dashas','chinese-bazi'].includes(item.id)));
  assert.ok(report.symbolic.entries.every(item=>item.frame==='western-tropical'));
  for(const key of ['jyotish','dashas','bazi'])assert.equal(report[key].interpretationStatus,'not_licensed');
  assert.equal(report.crossTraditionSynthesis.status,'not_licensed');assert.deepEqual(input,before);
});
test('dashas are driven by the calculated SIDEREAL Moon and its precision budget, never the tropical Moon', () => {
  const report=buildComplementPreview(args()),moon=report.jyotish.positions.find(point=>point.body==='Moon');
  assert.equal(report.dashas.sourceMoonEvidenceRef,moon.evidenceId);
  assert.equal(report.dashas.birthNakshatra.longitude,moon.longitude);
  assert.notEqual(report.dashas.birthNakshatra.longitude,report.tropical.socle.bodies.find(point=>point.body==='Moon').longitude);
  assert.equal(report.dashas.frame.moonLongitudeToleranceDegrees,61/3600);
  assert.ok(report.dashas.evidence.every(item=>item.type.startsWith('JYOTISH_')));
});
test('popular Chinese year and solar BaZi year remain separate across their different new years', () => {
  const report=buildComplementPreview({...args(),birth:{...BIRTH,birthDate:'2024-02-05',timeValue:'12:00'}});
  assert.equal(report.chineseAnnual.relatedYear,2023);
  assert.equal(report.chineseAnnual.frame.yearBoundary,'lunar_new_year');
  assert.equal(report.bazi.pillars.year.stem,'Jia');assert.equal(report.bazi.pillars.year.branch,'Chen');
  assert.equal(report.bazi.frame.yearBoundary,'li_chun');
});
test('an unknown hour cannot produce a precise sidereal, dasha or hourly BaZi reading', () => {
  const report=buildComplementPreview({...args(),birth:{...BIRTH,timePrecision:'unknown',timeValue:undefined}});
  assert.equal(report.jyotish.status,'uncertain');assert.equal(report.dashas.status,'uncertain');
  assert.deepEqual(report.dashas.periods,[]);assert.equal(report.dashas.birthBalance,undefined);
  assert.equal(report.bazi.pillars.hour.status,'uncertain');assert.equal(report.bazi.pillars.hour.stem,null);
});
test('an unavailable high-latitude Ascendant does not block lunar dashas or the nine grahas', () => {
  const report=buildComplementPreview({...args(),birth:{...BIRTH,latitude:67}});
  assert.equal(report.jyotish.angles.ascendant.status,'unavailable');
  assert.equal(report.jyotish.positions.length,9);
  assert.equal(report.dashas.status,'calculated');assert.ok(report.dashas.periods.length>0);
});
test('outside the reference date range the new modules declare their limits without alternative calculations', () => {
  const report=buildComplementPreview({...args(),birth:{...BIRTH,birthDate:'1890-01-15'}});
  for(const key of ['jyotish','dashas','bazi'])assert.equal(report[key].status,'unavailable',key);
  assert.deepEqual(report.dashas.periods,[]);assert.deepEqual(report.jyotish.positions,[]);
  assert.ok(report.unavailable.some(item=>item.id==='jyotisha-natal'));
  assert.ok(report.unavailable.some(item=>item.id==='chinese-bazi'));
});
