import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFullDossierPlan } from '../src/deliverables/fullDossierPlan.mjs';
import { detectAstrologicalTextFacts, validateStructuredSection } from '../src/deliverables/factualClaimsValidator.mjs';
import { writeStructuredSectionWithLlm } from '../src/deliverables/structuredSectionWriter.mjs';

const aspects = ['conjunction', 'opposition', 'square', 'trine', 'sextile'];
const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const iso = (month, day, year = 2026) => new Date(Date.UTC(year, month, day)).toISOString();
function fixture({ body = 'Neptune', point = 'Sun', aspect = 'trine', start = iso(8, 7), end = iso(2, 9, 2027), exact = iso(9, 14), status = 'CURRENT', multiple = false, production = false } = {}) {
  const value = { transitBody: body, natalPoint: point, aspectType: aspect, startsAt: start, endsAt: end, exactAt: exact, phase: 'SEPARATING', orb: 0, status };
  const evidence = [
    { evidenceId: 'transits.snapshot', type: 'TRANSIT_SNAPSHOT', value: { nowUtc: iso(9, 17), horizonDays: 42 } },
    { evidenceId: 'transit.fixture.first', type: 'PERSONAL_TRANSIT', value }
  ];
  if (multiple) evidence.push({ evidenceId: 'transit.fixture.second', type: 'PERSONAL_TRANSIT', value: { ...value, startsAt: iso(1, 28, 2027), exactAt: iso(2, 4, 2027), endsAt: iso(3, 2, 2027) } });
  const dossierEvidence = { evidence };
  const full = buildFullDossierPlan(dossierEvidence, { aspectChapterMode: production ? 'reference' : 'narrative' });
  const section = full.sections.find(s => s.sectionId === (status === 'UPCOMING' ? 'next_weeks' : 'current_sky'));
  const block = section.blockPlans.find(b => b.blockId.includes('.transit_'));
  const sectionPlan = { ...section, blockPlans: [block] };
  return { dossierEvidence, sectionPlan, block };
}
function validate(f, text = f.block.deterministicPrefix) {
  return validateStructuredSection({ dossierEvidence: f.dossierEvidence, sectionPlan: f.sectionPlan, section: { sectionId: f.sectionPlan.sectionId, blocks: [{ blockId: f.block.blockId, text }] } });
}
const writerText = 'Ce passage invite à une réflexion symbolique.';
function writerOptions(f, text = writerText, logs = []) {
  return { logger: { warn: (...args) => logs.push(args) }, structuredWriterFn: async () => ({ sectionId: f.sectionPlan.sectionId, blocks: [{ blockId: f.block.blockId, text }] }) };
}

for (const [incident, point, start, end, exact] of [
  ['L-2026-9EHVJM-FAHF', 'Sun', '2026-09-07T23:57:30.556Z', '2027-03-09T03:08:45.968Z', '2026-10-14T20:05:37.059Z'],
  ['L-2026-EUC777-NZ2X', 'Venus', '2026-09-09T06:34:42.679Z', '2027-03-08T05:23:13.201Z', '2027-02-06T04:28:18.602Z']
]) test(`${incident}: calculated production prefix is validated without an LLM call`, async () => {
  const f = fixture({ point, start, end, exact, production: true });
  assert.match(f.block.deterministicPrefix, /mars 2027/);
  assert.equal(validate(f).ok, true);
  assert.equal(detectAstrologicalTextFacts(f.block.deterministicPrefix).some(fact => fact.bodyA === 'Mars' || fact.bodyB === 'Mars'), false);
  let calls = 0;
  const options = writerOptions(f);
  const fn = options.structuredWriterFn;
  options.structuredWriterFn = async (...args) => { calls++; return fn(...args); };
  const result = await writeStructuredSectionWithLlm({ ...f, options });
  assert.equal(f.block.calculatedReference, true);
  assert.equal(calls, 0);
  assert.equal(result.validation.ok, true);
  assert.equal(result.section.blocks[0].text, f.block.deterministicPrefix);
  assert.equal(result.llmCalls, 0);
});

for (const aspect of aspects) test(`production calendar prefixes: ${aspect}, 12 months, 10 bodies, 3 windows, current/upcoming`, () => {
  let cases = 0;
  for (let month = 0; month < 12; month++) for (const body of bodies) for (const window of ['same_day', 'cross_month', 'cross_year']) for (const status of ['CURRENT', 'UPCOMING']) {
    const start = iso(month, 7);
    const end = window === 'same_day' ? start : window === 'cross_month' ? iso(month + 1, 9) : iso(month, 9, 2027);
    const point = body === 'Sun' ? 'Venus' : 'Sun';
    const f = fixture({ body, point, aspect, start, end, exact: start, status });
    const result = validate(f);
    assert.equal(result.ok, true, JSON.stringify({ body, aspect, month, window, status, prefix: f.block.deterministicPrefix, issues: result.issues }));
    // A genuine undeclared Mars contact must still be rejected alongside the date.
    const wrongBody = body === 'Mars' ? 'Jupiter' : 'Mars';
    const wrongWord = body === 'Mars' ? 'Jupiter' : 'Mars';
    const negative = validate(f, `${f.block.deterministicPrefix} ${wrongWord} forme une opposition à votre Lune.`);
    assert.ok(negative.issues.some(issue => issue.code === 'undeclared_text_fact' && [issue.fact?.bodyA, issue.fact?.bodyB].includes(wrongBody)));
    cases++;
  }
  assert.equal(cases, 720);
});

for (const aspect of aspects) test(`multiple production passages including March: ${aspect}`, () => {
  const f = fixture({ body: 'Mars', aspect, multiple: true });
  assert.match(f.block.deterministicPrefix, /Passages retenus/);
  assert.match(f.block.deterministicPrefix, /mars/);
  assert.equal(validate(f).ok, true);
  assert.ok(detectAstrologicalTextFacts(f.block.deterministicPrefix).some(fact => fact.bodyA === 'Mars' || fact.bodyB === 'Mars'));
});

test('bare Mars remains a planet; explicit French calendar variants remain dates', () => {
  for (const date of ['9 mars 2027', '9 mars', '09 mars 2027', '1er mars 2027', 'mars 2027', '9 MARS 2027']) {
    const facts = detectAstrologicalTextFacts(`Mars forme un carré à votre Soleil le ${date}, et Vénus forme un trigone avec Mercure.`);
    assert.deepEqual(new Set(facts.map(f => [f.bodyA, f.bodyB].sort().join('|') + ':' + f.aspectType)), new Set(['Mars|Sun:square', 'Mercury|Venus:trine']));
  }
  assert.ok(detectAstrologicalTextFacts('Le trigone entre Mars et Vénus.').some(f => f.bodyA === 'Mars' && f.bodyB === 'Venus'));
});

test('invalid server prefix is blocking, logged safely and makes zero LLM calls', async () => {
  const f = fixture();
  f.block.deterministicPrefix = 'Mars forme une opposition à votre Lune. Donnée privée audit@example.invalid.';
  const logs = [];
  let calls = 0;
  const options = writerOptions(f, writerText, logs);
  options.structuredWriterFn = async () => { calls++; throw new Error('must not run'); };
  await assert.rejects(writeStructuredSectionWithLlm({ ...f, options }), error => {
    assert.equal(error.code, 'SERVER_PREFIX_VALIDATION_FAILED');
    assert.equal(error.status, 500);
    assert.equal(error.provenance, 'server_prefix');
    assert.equal(error.blockId, f.block.blockId);
    assert.ok(error.validation.issues.some(i => i.code === 'undeclared_text_fact'));
    return true;
  });
  assert.equal(calls, 0);
  assert.equal(logs[0][1].attempt, 0);
  assert.equal(logs[0][1].findings[0].provenance, 'server_prefix');
  assert.equal(logs[0][1].findings[0].code, 'undeclared_text_fact');
  assert.ok(logs[0][1].findings[0].fact);
  assert.equal(JSON.stringify(logs).includes('audit@example.invalid'), false);
  assert.equal(JSON.stringify(logs).includes('Donnée privée'), false);
});

test('valid prefix plus invented LLM aspect stops after two attempts, without prefix attribution', async () => {
  const f = fixture({ body: 'Mars' });
  const logs = [];
  let calls = 0;
  const options = writerOptions(f, 'Mars forme une opposition à votre Lune. audit@example.invalid', logs);
  const fn = options.structuredWriterFn;
  options.structuredWriterFn = async (...args) => { calls++; return fn(...args); };
  await assert.rejects(writeStructuredSectionWithLlm({ ...f, options }), error => {
    assert.equal(error.code, 'structured_section_validation_stalled');
    assert.ok(error.validation.issues.some(i => i.code === 'undeclared_text_fact'));
    return true;
  });
  // Un refus identique ne justifie pas un troisième appel payant.
  assert.equal(calls, 2);
  assert.equal(logs.length, 2);
  assert.ok(logs.every(([, log]) => log.blockId === f.block.blockId && log.findings.every(finding => finding.provenance === 'combined_text')));
  assert.equal(JSON.stringify(logs).includes('audit@example.invalid'), false);
});

test('a fact also written by the LLM is never assigned exclusively to server prefix', async () => {
  const f = fixture({ body: 'Mars' });
  const options = writerOptions(f, `${f.block.deterministicPrefix} Mars forme une opposition à votre Lune.`);
  await assert.rejects(writeStructuredSectionWithLlm({ ...f, options }), error => error.code === 'structured_section_validation_stalled');
});

for (const [aspect, word] of [['conjunction', 'conjonction'], ['opposition', 'opposition'], ['square', 'carré'], ['trine', 'trigone'], ['sextile', 'sextile']]) test(`real planetary aspect across an intervening March date: ${aspect}`, () => {
  const f = fixture({ body: 'Mars', aspect });
  for (const text of [
    `Mars forme le 9 mars 2027 un ${word} à votre Soleil.`,
    `Mars forme un ${word} le 9 mars 2027 avec votre Soleil.`
  ]) {
    assert.ok(detectAstrologicalTextFacts(text).some(fact => fact.aspectType === aspect && [fact.bodyA, fact.bodyB].includes('Mars')));
    assert.equal(validate(f, text).ok, true);
    const other = fixture({ body: 'Neptune', aspect });
    assert.ok(validate(other, text).issues.some(issue => issue.code === 'undeclared_text_fact'));
  }
});


for (const [body, point] of [['Uranus', 'Saturn'], ['Neptune', 'ASC'], ['Mars', 'MC']]) test(`calculated reference ${body}/${point} preserves its prefix and claims with zero transport calls`, async () => {
  const f = fixture({ body, point, aspect: 'opposition', production: true });
  assert.equal(f.block.deterministic, true);
  assert.equal(f.block.calculatedReference, true);
  let calls = 0;
  const result = await writeStructuredSectionWithLlm({ ...f, options: { logger: { warn() {} }, config: { apiKey: 'fake', baseUrl: 'https://offline.invalid/v1', model: 'offline-test', fetchFn: async () => { calls++; throw Error('must not call the network'); } } } });
  assert.equal(calls, 0);
  assert.equal(result.llmCalls, 0);
  assert.deepEqual(result.usage, { promptTokens: 0, completionTokens: 0 });
  assert.equal(result.validation.ok, true);
  assert.equal(result.section.blocks[0].text, f.block.deterministicPrefix);
  assert.ok(result.section.blocks[0].claims.some(claim => claim.type === 'PERSONAL_TRANSIT' && claim.transitBody === body && claim.natalPoint === point));
});

test('empty calculated reference fails before transport rather than returning a generic sentence', async () => {
  const f = fixture({ production: true });
  f.block.deterministicPrefix = '   ';
  let calls = 0; const logs = [];
  await assert.rejects(writeStructuredSectionWithLlm({ ...f, options: { logger: { warn: (...args) => logs.push(args) }, structuredWriterFn: async () => { calls++; throw Error('must not run'); } } }), error => {
    assert.equal(error.code, 'SERVER_PREFIX_VALIDATION_FAILED');
    assert.equal(error.provenance, 'server_prefix');
    assert.ok(error.validation.issues.some(issue => issue.code === 'missing_block_text'));
    return true;
  });
  assert.equal(calls, 0);
  assert.ok(logs.some(([, details]) => details.findings.some(finding => finding.code === 'missing_block_text' && finding.provenance === 'server_prefix')));
});


test('contradictory calculated reference is blocking and safely logged before zero transport calls', async () => {
  const f = fixture({ production: true });
  f.block.deterministicPrefix = 'Uranus forme une opposition à votre Lune. Privé test@example.invalid.';
  let calls = 0; const logs = [];
  await assert.rejects(writeStructuredSectionWithLlm({ ...f, options: { logger: { warn: (...args) => logs.push(args) }, structuredWriterFn: async () => { calls++; throw Error('must not run'); } } }), error => {
    assert.equal(error.code, 'SERVER_PREFIX_VALIDATION_FAILED');
    assert.equal(error.status, 500);
    assert.equal(error.provenance, 'server_prefix');
    assert.equal(error.blockId, f.block.blockId);
    assert.ok(error.validation.issues.some(issue => issue.code === 'undeclared_text_fact'));
    return true;
  });
  assert.equal(calls, 0);
  assert.equal(logs[0][1].attempt, 0);
  assert.ok(logs[0][1].findings.some(finding => finding.code === 'undeclared_text_fact' && finding.fact && finding.provenance === 'server_prefix'));
  assert.doesNotMatch(JSON.stringify(logs), /Privé|test@example/);
});
