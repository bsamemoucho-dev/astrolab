import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFullDossierPlan } from '../src/deliverables/fullDossierPlan.mjs';
import { validateStructuredSection } from '../src/deliverables/factualClaimsValidator.mjs';
import { buildStructuredUserPrompt, scopedSectionPlanForBlock, writeStructuredSectionWithLlm } from '../src/deliverables/structuredSectionWriter.mjs';

function fixture({ houses = [['Moon', 7, 'WHOLE_SIGN']], natalHouse = 7, houseSystem = 'WHOLE_SIGN', status = 'CURRENT', natalPoint = 'Moon', extraTransits = [], reliability = 'HIGH' } = {}) {
  const evidence = [
    { evidenceId: 'transits.snapshot', type: 'TRANSIT_SNAPSHOT', value: { nowUtc: '2026-10-25T12:00:00.000Z', horizonDays: 42 } },
    { evidenceId: 'transit.jupiter.moon', type: 'PERSONAL_TRANSIT', value: {
      status, transitBody: 'Jupiter', natalPoint, aspectType: 'trine', natalHouse, houseSystem,
      orb: 0.2, phase: 'APPLYING', startsAt: '2026-10-24T22:30:00.000Z', exactAt: '2026-10-25T23:30:00.000Z', endsAt: '2026-10-29T23:30:00.000Z'
    } },
    ...houses.map(([body, house, system]) => ({ evidenceId: `natal.${body.toLowerCase()}.house`, type: 'NATAL_BODY_HOUSE', value: { body, house, houseSystem: system }, provenance: { reliability } })),
    ...extraTransits
  ];
  const dossierEvidence = { referenceTimeZone: 'Europe/Paris', evidence };
  const full = buildFullDossierPlan(dossierEvidence, { aspectChapterMode: 'reference' });
  const plan = full.sections.find((section) => section.sectionId === (status === 'UPCOMING' ? 'next_weeks' : 'current_sky'));
  const block = plan.blockPlans.find((block) => block.packetRefs.some((ref) => plan.evidencePackets.find((packet) => packet.packetId === ref)?.evidenceRefs.includes('transit.jupiter.moon')));
  return { dossierEvidence, full, plan, block };
}

function validate(f, text) {
  return validateStructuredSection({ dossierEvidence: f.dossierEvidence, sectionPlan: { ...f.plan, blockPlans: [f.block] }, section: { sectionId: f.plan.sectionId, blocks: [{ blockId: f.block.blockId, text }] } });
}
const supports = (f) => f.plan.evidencePackets.filter((packet) => packet.sourceRole === 'transit_natal_house_context');

for (const status of ['CURRENT', 'UPCOMING']) test(`transit natal house: canonical target proof is closed, factual context (${status})`, () => {
  const f = fixture({ status });
  const support = supports(f);
  assert.equal(support.length, 1);
  assert.deepEqual(support[0].evidenceRefs, ['natal.moon.house']);
  assert.deepEqual(support[0].interpretationRuleRefs, []);
  assert.deepEqual(support[0].themes, []);
  assert.equal(support[0].interpretationDepth, 'reference');
  assert.equal(support[0].openingAllowed, false);
  assert.ok(f.block.packetRefs.includes(support[0].packetId));
  assert.ok(f.plan.secondaryEvidenceRefs.includes('natal.moon.house'));
  assert.ok(!f.plan.primaryEvidenceRefs.includes('natal.moon.house'));
  const owner = f.full.sections.find((section) => section.primaryEvidenceRefs.includes('natal.moon.house'));
  assert.equal(owner.sectionId, 'relationships');
  const result = validate(f, 'La Lune natale est en maison 7.');
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.match(f.block.deterministicPrefix, /26 octobre 2026/);
  const userPrompt = JSON.parse(buildStructuredUserPrompt({ sectionPlan: scopedSectionPlanForBlock(f.plan, f.block) }));
  // The actual serialized prompt must carry the canonical body-house claim.
  assert.match(JSON.stringify(userPrompt), /NATAL_BODY_HOUSE/);
  assert.match(JSON.stringify(userPrompt), /transit_natal_house_context/);
});

test('transit natal house: the transiting planet never borrows its natal target house', () => {
  const f = fixture();
  for (const text of ['Jupiter est en maison 7.', 'Vénus est en maison 7.', 'La Lune est en maison 3.']) {
    const result = validate(f, text);
    assert.ok(result.issues.some((issue) => issue.code === 'undeclared_text_fact'), text);
  }
});

for (const [label, options, code] of [
  ['missing canonical evidence', { houses: [] }, 'transit_natal_house_evidence_missing'],
  ['another body', { houses: [['Venus', 7, 'WHOLE_SIGN']] }, 'transit_natal_house_evidence_missing'],
  ['another house', { houses: [['Moon', 3, 'WHOLE_SIGN']] }, 'transit_natal_house_evidence_incompatible'],
  ['another system', { houses: [['Moon', 7, 'PLACIDUS']] }, 'transit_natal_house_evidence_incompatible'],
  ['missing system', { houseSystem: null }, 'transit_natal_house_evidence_incompatible'],
  ['unreliable canonical evidence', { reliability: 'INSUFFICIENT' }, 'transit_natal_house_evidence_incompatible'],
  ['out of range house', { natalHouse: 13 }, 'transit_natal_house_evidence_incompatible']
]) test(`transit natal house: ${label} never authorizes a target placement`, () => {
  const f = fixture(options);
  assert.deepEqual(supports(f), []);
  assert.ok(f.plan.transitHouseEvidenceDiagnostics.some((diagnostic) => diagnostic.code === code));
  const result = validate(f, 'La Lune natale est en maison 7.');
  assert.ok(result.issues.some((issue) => issue.code === 'undeclared_text_fact'));
});

test('transit natal house: unknown target house does not disclose an unrelated canonical house', () => {
  const f = fixture({ natalHouse: null });
  assert.deepEqual(supports(f), []);
  assert.deepEqual(f.plan.transitHouseEvidenceDiagnostics, []);
  assert.ok(validate(f, 'La Lune natale est en maison 7.').issues.some((issue) => issue.code === 'undeclared_text_fact'));
});

test('transit natal house: one transit block cannot borrow another target proof', () => {
  const f = fixture({ houses: [['Moon', 7, 'WHOLE_SIGN'], ['Sun', 2, 'WHOLE_SIGN']], extraTransits: [{ evidenceId: 'transit.mercury.sun', type: 'PERSONAL_TRANSIT', value: {
    status: 'CURRENT', transitBody: 'Mercury', natalPoint: 'Sun', aspectType: 'square', natalHouse: 2, houseSystem: 'WHOLE_SIGN', orb: 0.2,
    startsAt: '2026-10-25T00:00:00Z', exactAt: '2026-10-26T12:00:00Z', endsAt: '2026-10-27T00:00:00Z'
  } }] });
  assert.equal(supports(f).length, 2);
  const packets = f.plan.evidencePackets.filter((packet) => f.block.packetRefs.includes(packet.packetId));
  assert.ok(packets.some((packet) => packet.evidenceRefs.includes('natal.moon.house')));
  assert.ok(!packets.some((packet) => packet.evidenceRefs.includes('natal.sun.house')));
  assert.ok(validate(f, 'Le Soleil natal est en maison 2.').issues.some((issue) => issue.code === 'undeclared_text_fact'));
});

test('transit natal house: supporting context cannot demote a primary transit or bypass primary reuse', () => {
  const f = fixture();
  f.plan.alreadyInterpretedEvidenceRefs.push('transit.jupiter.moon');
  const result = validate(f, 'La Lune natale est en maison 7.');
  assert.ok(result.issues.some((issue) => issue.code === 'evidence_reuse_as_primary'), JSON.stringify(result.issues));
});

test('transit natal house: production prefix and canonical target fact pass the complete writer without correction', async () => {
  const f = fixture();
  let calls = 0;
  const result = await writeStructuredSectionWithLlm({ dossierEvidence: f.dossierEvidence, sectionPlan: { ...f.plan, blockPlans: [f.block] }, options: {
    structuredWriterFn: ({ sectionPlan }) => { calls += 1; return { sectionId: sectionPlan.sectionId, blocks: [{ blockId: f.block.blockId, text: 'La Lune natale est en maison 7.' }] }; }
  } });
  assert.equal(calls, 1);
  assert.equal(result.validation.ok, true);
  assert.ok(result.section.blocks[0].text.startsWith(f.block.deterministicPrefix));
  assert.equal(result.llmCalls, 0);
});


test('transit natal house: an angle target never gains a fabricated NATAL_BODY_HOUSE proof', () => {
  const f = fixture({ natalPoint: 'ASC', natalHouse: 1, houses: [['ASC', 1, 'WHOLE_SIGN'], ['Moon', 7, 'WHOLE_SIGN']] });
  assert.deepEqual(supports(f), []);
  assert.ok(f.plan.transitHouseEvidenceDiagnostics.some((diagnostic) => diagnostic.code === 'transit_natal_house_evidence_missing'));
  assert.ok(validate(f, 'La maison 1 invite à réfléchir.').issues.some((issue) => issue.code === 'undeclared_text_fact'));
});
