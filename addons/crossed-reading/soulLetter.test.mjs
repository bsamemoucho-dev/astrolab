import assert from 'node:assert/strict';
import test from 'node:test';
import { buildComplementPreview } from './index.mjs';
import { buildSymbolicReading } from './symbolicReading.mjs';
import { buildSoulLetter, renderSoulLetter, SOUL_LETTER_METHOD_VERSION } from './soulLetter.mjs';

// Fictional births and public place coordinates, never customer records.
const BIRTH={birthDate:'1990-01-15',timePrecision:'exact',timeValue:'16:30',latitude:48.8566,longitude:2.3522,timeZone:'Europe/Paris',placeName:'Paris'};
const GENERATED='2026-10-27T00:00:00.000Z';
const BASE=buildComplementPreview({birth:BIRTH,generatedAt:GENERATED});
const copy=()=>structuredClone(BASE);
const moon=report=>report.jyotish.positions.find(point=>point.body==='Moon');
const words=letter=>letter.paragraphs.map(p=>p.text).join(' ').split(/\s+/u).filter(Boolean).length;

test('the letter is a bounded writing exercise grounded in the canonical lunar vocabulary',()=>{
  const report=copy(),before=structuredClone(report),letter=buildSoulLetter(report);
  const lunar=buildSymbolicReading(report).sections.find(section=>section.id==='sidereal-moon');
  assert.equal(letter.schema,'lastro.soul_letter@1.0.0');
  assert.equal(letter.methodVersion,SOUL_LETTER_METHOD_VERSION);
  assert.equal(letter.status,'available');
  assert.equal(letter.title,'Lettre d’âme');
  assert.equal(letter.badge,'Écriture symbolique');
  assert.equal(letter.frame,'jyotish-sidereal-lahiri');
  assert.equal(letter.crossTraditionSynthesis,'not_licensed');
  assert.equal(letter.notice,'Cette lettre symbolique s’inspire du repère lunaire. Elle propose des pistes libres, sans établir votre personnalité ni votre histoire.');
  for(const key of ['signId','signName','words']) assert.equal(letter.basis[key],lunar.vocabulary[key]);
  assert.deepEqual(letter.proofRefs,lunar.proofRefs);
  assert.deepEqual(letter.ruleRefs,lunar.ruleIds);
  assert.deepEqual(letter.sourceRefs,['rao-basics']);
  assert.deepEqual(letter.sources.map(source=>source.id),['rao-basics']);
  assert.equal(letter.salutation,'À vous,');
  assert.equal(letter.paragraphs.length,3);
  assert.ok(words(letter)>0 && words(letter)<=160,`Letter has ${words(letter)} words`);
  assert.ok((letter.paragraphs.map(p=>p.text).join(' ').match(/\?/gu)??[]).length<=1);
  for(const paragraph of letter.paragraphs) {
    assert.equal(paragraph.kind,'writing_invitation');
    assert.deepEqual(paragraph.methodRefs,[SOUL_LETTER_METHOD_VERSION]);
    assert.deepEqual(paragraph.proofRefs,lunar.proofRefs);
    assert.deepEqual(paragraph.ruleRefs,lunar.ruleIds);
    assert.deepEqual(paragraph.sourceRefs,lunar.sourceRefs);
  }
  assert.deepEqual(report,before);
  for(const module of ['jyotish','dashas','bazi']) assert.equal(report[module].interpretationStatus,'not_licensed');
});

test('all twelve actually calculated lunar signs receive distinct short invitations with existing vocabulary only',()=>{
  const letters=new Map();
  for(let day=1;day<=28;day++) {
    const report=buildComplementPreview({birth:{...BIRTH,birthDate:`1994-02-${String(day).padStart(2,'0')}`},generatedAt:GENERATED});
    if(moon(report).status!=='calculated') continue;
    const letter=buildSoulLetter(report),lunar=buildSymbolicReading(report).sections.find(section=>section.id==='sidereal-moon');
    assert.equal(letter.status,'available');
    assert.equal(letter.basis.signId,moon(report).sign);
    assert.equal(letter.basis.words,lunar.vocabulary.words);
    assert.equal(letter.paragraphs.length,3);
    assert.ok(words(letter)>0&&words(letter)<=160,`${letter.basis.signId}: ${words(letter)} words`);
    const prose=letter.paragraphs.map(p=>p.text).join(' ');
    assert.ok((prose.match(/\?/gu)??[]).length<=1);
    assert.ok(!/vous êtes|vous avez toujours|vous avez vécu|vous allez|votre destin|votre karma|votre personnalité/iu.test(prose));
    assert.ok(!/BaZi|mahadasha|antardasha|nakshatra|maison [0-9]|Ascendant|tropical/iu.test(prose));
    assert.ok(!/\bpage\b|écriture|\btexte\b|\bnote\b|\bphrase\b/iu.test(prose));
    assert.ok(!/silence\. Celle-ci n’attend|votre expérience garde le dernier mot/iu.test(prose));
    const personalised=letter.paragraphs.filter(p=>p.proofRefs.length).map(p=>p.text).join(' ');
    if(letters.has(letter.basis.signId)) assert.equal(personalised,letters.get(letter.basis.signId));
    letters.set(letter.basis.signId,personalised);
  }
  assert.equal(letters.size,12);
  assert.equal(new Set(letters.values()).size,12);
});

test('no key, transport or caller-provided prose is needed and no input is mutated',()=>{
  const report=copy(),before=structuredClone(report),previous=globalThis.fetch;
  globalThis.fetch=()=>{throw Error('Network is forbidden in this test');};
  try {
    assert.deepEqual(buildSoulLetter(report),buildSoulLetter(report));
    assert.equal(renderSoulLetter(report),renderSoulLetter(report));
    assert.deepEqual(report,before);
  } finally {globalThis.fetch=previous;}
});

test('unknown birth time never acquires a unique lunar letter or a generic replacement',()=>{
  const {timeValue,...birth}=BIRTH;
  const report=buildComplementPreview({birth:{...birth,timePrecision:'unknown'},generatedAt:GENERATED});
  const letter=buildSoulLetter(report);
  assert.equal(letter.status,'unavailable');
  assert.equal(letter.reason,'CERTAIN_SIDEREAL_MOON_REQUIRED');
  assert.equal(letter.salutation,null);
  assert.equal(letter.basis,null);
  for(const key of ['paragraphs','proofRefs','ruleRefs','sourceRefs','sources']) assert.deepEqual(letter[key],[]);
  assert.equal(renderSoulLetter(report),'');
});

test('an actual out-of-range birth does not get a substituted letter',()=>{
  const report=buildComplementPreview({birth:{...BIRTH,birthDate:'1850-01-15'},generatedAt:GENERATED});
  assert.equal(buildSoulLetter(report).status,'unavailable');
  assert.equal(renderSoulLetter(report),'');
});

test('missing optional lunar modules cannot be replaced by tropical or BaZi prose',()=>{
  const report=copy();delete report.jyotish;delete report.dashas;
  assert.equal(buildSoulLetter(report).status,'unavailable');
  assert.equal(renderSoulLetter(report),'');
});

test('an uncertain other planet does not silence a certain lunar letter',()=>{
  const report=copy();report.jyotish.status='uncertain';
  report.jyotish.positions.find(point=>point.body==='Mars').status='uncertain';
  assert.equal(buildSoulLetter(report).status,'available');
});

test('a high-latitude birth may use the certain Moon without acquiring angles or houses',()=>{
  const report=buildComplementPreview({birth:{...BIRTH,latitude:69.6492,longitude:18.9553,timeZone:'Europe/Oslo',placeName:'Public-coordinate fixture'},generatedAt:GENERATED});
  assert.equal(report.jyotish.angles.ascendant.status,'unavailable');
  const letter=buildSoulLetter(report);
  assert.equal(letter.status,'available');
  assert.equal(letter.basis.signId,moon(report).sign);
  assert.ok(!/Ascendant|Milieu du Ciel|maison [0-9]/iu.test(renderSoulLetter(report)));
  assert.deepEqual(letter.proofRefs,[moon(report).evidenceId]);
});

for(const [name,mutate] of [
  ['tropical vocabulary frame',report=>{report.tropical.frame.zodiac='sidereal';}],
  ['sidereal vocabulary frame',report=>{report.jyotish.frame.zodiac='tropical';}],
  ['another ayanamsha',report=>{report.jyotish.frame.ayanamshaId='unapproved';}],
  ['a promoted lunar licence',report=>{report.jyotish.interpretationStatus='licensed';}],
  ['a promoted cross-tradition synthesis',report=>{report.crossTraditionSynthesis.status='licensed';}],
  ['a changed dasha convention',report=>{report.dashas.frame.yearDays=360;}],
  ['a changed BaZi convention',report=>{report.bazi.frame.solarTimeCorrectionApplied=true;}]
]) test(`${name} still blocks the letter rather than acquiring a writing bypass`,()=>{
  const report=copy();mutate(report);
  assert.throws(()=>buildSoulLetter(report),{code:'COMPLEMENT_READING_FRAME_MISMATCH'});
  assert.throws(()=>renderSoulLetter(report),{code:'COMPLEMENT_READING_FRAME_MISMATCH'});
});

for(const [name,mutate] of [
  ['missing lunar proof',report=>{report.jyotish.evidence=report.jyotish.evidence.filter(proof=>proof.evidenceId!==moon(report).evidenceId);}],
  ['changed position without proof',report=>{moon(report).longitude+=0.1;}],
  ['wrong proof provenance',report=>{report.jyotish.evidence.find(proof=>proof.evidenceId===moon(report).evidenceId).provenance.zodiac='tropical';}],
  ['non-punctual time asserted as certain',report=>{report.jyotish.frame.utcRange.end='1990-01-15T16:31:00.000Z';}],
  ['numerical frontier asserted as certain',report=>{
    const point=moon(report);point.longitude=0.001;point.sign='Aries';
    report.jyotish.evidence.find(proof=>proof.evidenceId===point.evidenceId).value=structuredClone(point);
  }],
  ['script used as sign',report=>{moon(report).sign='<script>alert(1)</script>'; }]
]) test(`${name} retains the existing blocking proof check`,()=>{
  const report=copy();mutate(report);
  assert.throws(()=>buildSoulLetter(report),{code:'COMPLEMENT_READING_PROOF_MISMATCH'});
});

test('alleged letters, vocabulary, identity labels and external source URLs from a caller are ignored',()=>{
  const report=copy(),before=buildSoulLetter(report);
  report.personLabel='<script>alert(1)</script>';
  report.birth.placeName='<img src=x onerror=alert(1)>';
  report.symbolic={sections:[{id:'sidereal-moon',vocabulary:{signId:'Aries',signName:'Invented',words:'invented words'}}]};
  report.soulLetter={status:'available',paragraphs:[{text:'Forged biography'}]};
  report.sources=[{id:'rao-basics',url:'javascript:alert(1)'}];
  assert.deepEqual(buildSoulLetter(report),before);
  const html=renderSoulLetter(report);
  assert.ok(!/<script|<img|javascript:|Invented|Forged biography|undefined/u.test(html));
  assert.ok(html.includes('Lettre d’âme')&&html.includes('Écriture symbolique'));
  assert.ok(html.includes('class="soul-letter"'));
  assert.ok(html.includes('aria-labelledby="soul-letter-title"'));
  assert.ok(html.includes('id="soul-letter-title"'));
  assert.ok(html.includes('noopener noreferrer'));
  assert.ok(html.includes('vedicastrologer.org/articles/vedic_astro_textbook.pdf'));
});

test('a returned vocabulary, paragraph or source cannot poison a later letter',()=>{
  const report=copy(),letter=buildSoulLetter(report),reading=buildSymbolicReading(report);
  letter.sources[0].url='javascript:alert(1)';letter.paragraphs[1].text='Changed';letter.proofRefs[0]='wrong';
  reading.sections[0].vocabulary.words='Injected';reading.sections[0].vocabulary.ruleRefs.push('unapproved');
  const fresh=buildSoulLetter(report);
  assert.notEqual(fresh.paragraphs[1].text,'Changed');
  assert.ok(!fresh.basis.words.includes('Injected'));
  assert.ok(fresh.sources.every(source=>source.url.startsWith('https://')));
  assert.ok(!fresh.ruleRefs.includes('unapproved'));
  assert.deepEqual(fresh.proofRefs,[moon(report).evidenceId]);
});
