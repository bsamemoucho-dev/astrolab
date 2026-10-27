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
