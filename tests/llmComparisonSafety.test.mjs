import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateWesternNatalChart } from '../src/astro/westernNatal.mjs';
import { buildDossierEvidence } from '../src/deliverables/dossierEvidence.mjs';
import { buildFullDossierPlan } from '../src/deliverables/fullDossierPlan.mjs';
import { detectAstrologicalTextFacts, validateStructuredSection, validateDossierClaims } from '../src/deliverables/factualClaimsValidator.mjs';
import { syntheticInput, buildSyntheticFixture } from '../experiments/openai-claude/fixture.mjs';
const calculation = calculateWesternNatalChart(syntheticInput, { calculatedAt: '2026-10-18T12:00:00.000Z', runId: 'calc_safety' });
const dossierEvidence = buildDossierEvidence({ natalResult: calculation.result, natalRun: calculation.calculationRun, generatedAt: '2026-10-18T12:00:00.000Z' });
const byId = new Map(dossierEvidence.evidence.map(e => [e.evidenceId, e]));
// Use actual production plan/packets, scoped to exactly the selected evidence.
function validate(refs, text) {
  const plan = buildFullDossierPlan({ evidence: refs.map(ref => byId.get(ref)) }).sections.find(s => s.evidencePackets.length);
  assert.ok(plan, 'production planner must supply packets');
  return validateStructuredSection({ dossierEvidence, sectionPlan: plan, section: { sectionId: plan.sectionId, blocks: plan.blockPlans.map(b => ({ blockId: b.blockId, text })) } });
}
function reject(refs, text) {
  const result = validate(refs, text);
  assert.equal(result.ok, false, `UNSUPPORTED FACT ACCEPTED: ${text}; extracted=${JSON.stringify(detectAstrologicalTextFacts(text))}`);
  assert.ok(result.issues.some(i => i.code === 'undeclared_text_fact'), JSON.stringify(result.issues));
}
const sun = byId.get('natal.sun.sign');
const signFr = { Capricorn: 'Capricorne', Aries: 'Bélier' };
test('safety: calculated authorized Sun sign is accepted', () => {
  assert.equal(validate([sun.evidenceId], `Votre Soleil est en ${signFr[sun.value.sign]}.`).ok, true);
});
test('safety: wrong Sun sign is rejected', () => reject([sun.evidenceId], `Votre Soleil est en ${sun.value.sign === 'Aries' ? 'Capricorne' : 'Bélier'}.`));
for (const [type, name] of [['conjunction','conjonction'], ['opposition','opposition'], ['square','carré'], ['trine','trigone'], ['sextile','sextile']]) {
  test(`safety: unauthorized Mercury-Mars ${type} is rejected`, () => reject([sun.evidenceId], `Mercure forme un ${name} avec Mars.`));
}
const moonHouse = byId.get('natal.moon.house');
test('safety: calculated authorized Moon house is accepted', () => assert.equal(validate([moonHouse.evidenceId], `Votre Lune est en maison ${moonHouse.value.house}.`).ok, true));
test('safety: house number absent from proofs is rejected', () => reject([moonHouse.evidenceId], `Votre Lune est en maison ${moonHouse.value.house === 12 ? 1 : moonHouse.value.house + 1}.`));
test('safety: another planet cannot borrow the Moon house proof', () => {
  // No Sun house evidence is authorized, even if the number happens to match.
  reject([moonHouse.evidenceId], `Votre Soleil est en maison ${moonHouse.value.house}.`);
});
test('safety: separate sentences do not invent an aspect across a full stop', () => {
  const text = 'Mercure appelle à réfléchir. Le sextile entre Mars et Vénus ouvre une autre piste.';
  const facts = detectAstrologicalTextFacts(text).filter(f => f.type === 'ASPECT');
  assert.deepEqual(facts.map(f => [f.bodyA, f.bodyB].sort().join('|')), ['Mars|Venus']);
  reject([sun.evidenceId], text);
});
test('safety: nonstandard explicit aspect connector must not evade detection', () => reject([sun.evidenceId], 'Mercure forme un sextile avec la planète Mars.'));
test('safety: two aspects in one sentence remain distinct and unauthorized pair is rejected', () => {
  const aspect = dossierEvidence.evidence.find(e => e.type === 'NATAL_ASPECT' && e.value.bodyA === 'Moon' && e.value.bodyB === 'Mercury' && e.value.aspectType === 'square');
  assert.ok(aspect);
  reject([aspect.evidenceId], 'La Lune forme un carré avec Mercure et Mercure forme un sextile avec Mars.');
});
test('safety: genuine Mars with March date is still rejected when unauthorized', () => reject([sun.evidenceId], 'Mars forme le 9 mars 2027 un trigone avec votre Soleil.'));
let transitFixture;
async function realTransit() {
  transitFixture ??= await buildSyntheticFixture();
  const { dossierEvidence: evidence, fullDossierPlan } = transitFixture;
  const plan = fullDossierPlan.sections.find(s => ['current_sky','next_weeks'].includes(s.sectionId) && s.blockPlans.some(b => b.deterministicPrefix));
  const block = plan.blockPlans.find(b => b.deterministicPrefix);
  const sectionPlan = { ...plan, blockPlans: [block] };
  const section = text => ({ sectionId: plan.sectionId, blocks: [{ blockId: block.blockId, text }] });
  return { evidence, sectionPlan, block, section };
}
test('safety: true engine transit prefix matches its evidence', async () => {
  const f = await realTransit();
  assert.equal(validateStructuredSection({ dossierEvidence: f.evidence, sectionPlan: f.sectionPlan, section: f.section(f.block.deterministicPrefix) }).ok, true);
});
test('safety: modified transit date in free text must be rejected', async () => {
  const f = await realTransit();
  const text = f.block.deterministicPrefix.replace(/\b20[0-9]{2}\b/g, '2099');
  assert.notEqual(text, f.block.deterministicPrefix);
  const result = validateStructuredSection({ dossierEvidence: f.evidence, sectionPlan: f.sectionPlan, section: f.section(text) });
  assert.equal(result.ok, false, `MODIFIED DATE ACCEPTED: ${text}`);
});
test('safety: modified structured transit date is rejected', async () => {
  const f = await realTransit();
  const packet = f.sectionPlan.evidencePackets.find(p => f.block.packetRefs.includes(p.packetId));
  const claim = packet.claims.find(c => c.type === 'PERSONAL_TRANSIT');
  const result = validateDossierClaims({ dossierEvidence: f.evidence, claims: [{ ...claim, exactAt: '2099-01-01T00:00:00.000Z' }] });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(i => i.code === 'exact_at_mismatch'));
});

for (const [type, word] of [['conjunction','conjonction'], ['opposition','opposition'], ['square','carré'], ['trine','trigone'], ['sextile','sextile']]) {
  test(`safety: plural-subject ${type} must be detected and rejected`, () => reject([sun.evidenceId], `Mercure et Mars forment un ${word}.`));
  test(`safety: connector-de ${type} must be detected and rejected`, () => reject([sun.evidenceId], `Mercure est en ${word} de Mars.`));
}

test('safety: a modified structured body-house claim remains rejected', () => {
  const result = validateDossierClaims({ dossierEvidence, claims: [{ claimId: 'synthetic.bad_house', type: 'NATAL_BODY_HOUSE', body: 'Sun', house: moonHouse.value.house, houseSystem: 'WHOLE_SIGN', evidenceRefs: [moonHouse.evidenceId] }] });
  assert.equal(result.ok, false);
});

test('safety: an authorized calculated natal aspect is accepted', () => {
  const aspect = dossierEvidence.evidence.find(e => e.type === 'NATAL_ASPECT' && e.value.bodyA === 'Moon' && e.value.bodyB === 'Mercury' && e.value.aspectType === 'square');
  assert.ok(aspect);
  assert.equal(validate([aspect.evidenceId], 'La Lune forme un carré avec Mercure.').ok, true);
});
