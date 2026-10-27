import assert from 'node:assert/strict';
import test from 'node:test';
import { buildComplementPreview } from './index.mjs';
import { buildSymbolicReading, renderSymbolicReading, DOCUMENTED_READING_VERSION } from './symbolicReading.mjs';

// Fictional, public-coordinate fixtures only. No real customer's birth data.
const BIRTH = {birthDate:'1990-01-15',timePrecision:'exact',timeValue:'16:30',latitude:48.8566,longitude:2.3522,timeZone:'Europe/Paris',placeName:'Paris'};
const GENERATED = '2026-10-27T00:00:00.000Z';
const BASE = buildComplementPreview({birth:BIRTH,generatedAt:GENERATED});
const copy = () => structuredClone(BASE);
const moon = r => r.jyotish.positions.find(point=>point.body==='Moon');
const ids = reading => reading.sections.map(section=>section.id);

test('documented reading binds every personalised statement to calculated evidence without amending licences', () => {
  const r=copy(), before=structuredClone(r), reading=buildSymbolicReading(r);
  assert.equal(reading.version,DOCUMENTED_READING_VERSION);
  assert.equal(reading.status,'bounded_documented_reading');
  assert.equal(reading.crossTraditionSynthesis,'not_licensed');
  assert.deepEqual(ids(reading),['sidereal-moon','lunar-sector','periods-reading','four-pillars-reading']);
  const available=new Set([...r.jyotish.evidence,...r.dashas.evidence,...r.bazi.evidence].map(proof=>proof.evidenceId));
  for(const section of reading.sections) for(const paragraph of section.paragraphs) {
    if(paragraph.kind==='calculated' || paragraph.kind==='traditional_vocabulary') assert.ok(paragraph.proofRefs.length);
    for(const ref of paragraph.proofRefs) assert.ok(available.has(ref),ref);
    for(const ref of paragraph.sourceRefs) assert.ok(reading.sources.some(source=>source.id===ref),ref);
  }
  assert.deepEqual(r,before);
  assert.equal(r.jyotish.interpretationStatus,'not_licensed');
  assert.equal(r.bazi.interpretationStatus,'not_licensed');
  assert.equal(r.dashas.interpretationStatus,'not_licensed');
});

test('reading is deterministic, performs no network and does not require or read a model key', () => {
  const fetchBefore=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error('No network permitted');};
  try { assert.deepEqual(buildSymbolicReading(copy()),buildSymbolicReading(copy())); }
  finally { globalThis.fetch=fetchBefore; }
});

test('all twelve actual lunar signs have a bounded documented vocabulary', () => {
  const seen=new Set();
  for(let day=1;day<=28;day++) {
    const r=buildComplementPreview({birth:{...BIRTH,birthDate:`1994-02-${String(day).padStart(2,'0')}`},generatedAt:GENERATED});
    if(moon(r).status!=='calculated') continue;
    const reading=buildSymbolicReading(r), section=reading.sections.find(s=>s.id==='sidereal-moon');
    assert.ok(section?.paragraphs.some(p=>p.kind==='traditional_vocabulary'));
    assert.ok(section.sourceRefs.includes('rao-basics'));
    seen.add(moon(r).sign);
  }
  assert.equal(seen.size,12);
});

for(const mutate of [
  r=>{r.tropical.frame.zodiac='sidereal';},
  r=>{r.jyotish.frame.zodiac='tropical';},
  r=>{r.jyotish.frame.ayanamshaId='another_method';},
  r=>{r.jyotish.interpretationStatus='licensed';},
  r=>{r.dashas.frame.yearDays=360;},
  r=>{r.bazi.frame.solarTimeCorrectionApplied=true;},
  r=>{r.bazi.frame.dayBoundary='23:00';},
  r=>{r.crossTraditionSynthesis.status='licensed';}
]) test('incompatible or promoted frames cannot acquire a documentary reading', () => {
  const r=copy(); mutate(r);
  assert.throws(()=>buildSymbolicReading(r),{code:'COMPLEMENT_READING_FRAME_MISMATCH'});
});

test('missing sidereal Moon proof blocks personalised content', () => {
  const r=copy(); r.jyotish.evidence=r.jyotish.evidence.filter(p=>p.evidenceId!==moon(r).evidenceId);
  assert.throws(()=>buildSymbolicReading(r),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
});

test('a changed Moon position without matching proof blocks rather than borrowing a tropical meaning', () => {
  const r=copy(); moon(r).longitude+=0.1;
  assert.throws(()=>buildSymbolicReading(r),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
});

test('a sign at the numerical frontier cannot be relabelled certain for the reading', () => {
  const r=copy(), point=moon(r);
  point.longitude=0.001; point.sign='Aries';
  r.jyotish.evidence.find(p=>p.evidenceId===point.evidenceId).value=structuredClone(point);
  assert.throws(()=>buildSymbolicReading(r),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
});

test('nakshatra and pada must match the actual lunar sector and evidence', () => {
  const r=copy(); r.jyotish.nakshatra.pada=1;
  assert.throws(()=>buildSymbolicReading(r),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
});

test('a dasha cannot point to another Moon source or a modified timeline', () => {
  const r=copy(); r.dashas.sourceMoonEvidenceRef='western.moon';
  assert.throws(()=>buildSymbolicReading(r),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
  const s=copy(); s.dashas.evidence[0].value.periods=[];
  assert.throws(()=>buildSymbolicReading(s),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
});

test('a fabricated current period cannot be mentioned as a current calculated fact', () => {
  const r=copy(); r.dashas.current.mahadasha.lord='Fabricated';
  assert.throws(()=>buildSymbolicReading(r),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
});

test('BaZi pillar names and proof frame must agree', () => {
  const r=copy(); r.bazi.pillars.day.ganZhi='Fake';
  assert.throws(()=>buildSymbolicReading(r),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
  const s=copy(); s.bazi.evidence.find(p=>p.role==='day').frame='tropical';
  assert.throws(()=>buildSymbolicReading(s),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
});

test('uncertainty in a different planet does not silence the certain lunar entry', () => {
  const r=copy(); r.jyotish.status='uncertain';
  r.jyotish.positions.find(p=>p.body==='Mars').status='uncertain';
  assert.ok(ids(buildSymbolicReading(r)).includes('sidereal-moon'));
});

test('unknown birth time does not become a unique Moon, nakshatra, period, or hour', () => {
  const {timeValue,...birth}=BIRTH;
  const r=buildComplementPreview({birth:{...birth,timePrecision:'unknown'},generatedAt:GENERATED});
  const reading=buildSymbolicReading(r);
  for(const id of ['sidereal-moon','lunar-sector','periods-reading']) assert.ok(!ids(reading).includes(id));
  assert.ok(reading.sections.flatMap(s=>s.paragraphs).some(p=>p.text.includes('pilier de l’heure reste indéterminé')));
  assert.ok(!reading.proofRefs.includes('bazi.pillar.hour'));
});

test('an out-of-range birth yields a concise uncertainty explanation, not a substituted interpretation', () => {
  const r=buildComplementPreview({birth:{...BIRTH,birthDate:'1850-01-15'},generatedAt:GENERATED});
  const reading=buildSymbolicReading(r);
  assert.deepEqual(ids(reading),['uncertain-reading']);
  assert.deepEqual(reading.proofRefs,[]);
});

test('the rendered reading neither repeats identity input nor uses caller-supplied labels or source URLs', () => {
  const r=copy(); r.personLabel='<script>alert(1)</script>'; r.birth.placeName='<img src=x onerror=alert(1)>';
  const html=renderSymbolicReading(r);
  assert.ok(!html.includes('<script') && !html.includes('<img'));
  assert.ok(html.includes('noopener noreferrer'));
  assert.ok(!html.includes('undefined'));
  assert.ok(!html.includes('forcer une prédiction'));
  assert.ok(html.includes('ni une prévision'));
  assert.ok(html.includes('365,25 jours'));
});

test('sources and paragraphs returned to a caller cannot mutate the next reading', () => {
  const a=buildSymbolicReading(copy()); a.sources[0].url='javascript:alert(1)'; a.sections[0].paragraphs[0].text='Changed';
  const b=buildSymbolicReading(copy());
  assert.ok(b.sources.every(s=>s.url.startsWith('https://')));
  assert.notEqual(b.sections[0].paragraphs[0].text,'Changed');
});
