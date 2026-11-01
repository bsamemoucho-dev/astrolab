import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFullDossierPlan } from '../src/deliverables/fullDossierPlan.mjs';
import { buildStructuredUserPrompt, scopedSectionPlanForBlock, writeStructuredSectionWithLlm } from '../src/deliverables/structuredSectionWriter.mjs';
import { rulesForEvidence } from '../src/deliverables/interpretationRules.mjs';

// Synthetic evidence with the reported shape, never a customer's birth data.
const NOW = '2026-11-01T12:00:00.000Z';
const sign = (body, name) => ({ evidenceId: `natal.${body.toLowerCase()}.sign`, type: 'NATAL_BODY_SIGN', value: { body, sign: name } });
const aspect = (bodyA, bodyB, aspectType) => ({ evidenceId: `aspect.${bodyA.toLowerCase()}.${bodyB.toLowerCase()}.${aspectType}`, type: 'NATAL_ASPECT', value: { bodyA, bodyB, aspectType, orb: 1, orbLimit: 6 } });
const snapshot = { evidenceId: 'transits.snapshot', type: 'TRANSIT_SNAPSHOT', value: { nowUtc: NOW, horizonDays: 42 } };
const evidence = (extra = []) => ({ schema: 'astrolab.dossier_evidence', referenceTimeZone: 'Europe/Paris', evidence: [sign('Sun', 'Gemini'), sign('Moon', 'Taurus'), sign('Mercury', 'Gemini'), sign('Venus', 'Gemini'), sign('Saturn', 'Gemini'), ...extra, snapshot] });
const plan = (source) => buildFullDossierPlan(source, { aspectChapterMode: 'reference' });
const section = (p, id) => p.sections.find((entry) => entry.sectionId === id);
const prompt = (s, block) => JSON.parse(buildStructuredUserPrompt({ sectionPlan: scopedSectionPlanForBlock(s, block) }));

for (const [bodyA, bodyB, kind, chapter] of [['Moon', 'Mars', 'square', 'emotional_world'], ['Sun', 'Mercury', 'conjunction', 'identity'], ['Mercury', 'Mars', 'trine', 'supporting_resources']]) {
  test(`an unlicensed ${bodyA}/${bodyB} ${kind} is retained as evidence without an orphan prose announcement`, () => {
    const proof = aspect(bodyA, bodyB, kind);
    const source = evidence([proof]);
    const original = structuredClone(source);
    assert.deepEqual(rulesForEvidence(proof), [], 'a scoped relational rule is not a natal license');
    const p = plan(source);
    const s = section(p, chapter);
    assert.ok(s.evidencePackets.some((packet) => packet.evidenceRefs.includes(proof.evidenceId)), 'the calculated fact remains traceable');
    assert.ok(s.blockPlans.every((block) => !block.deterministicPrefix?.includes(bodyA === 'Moon' ? 'carré' : bodyA === 'Sun' ? 'conjonction' : 'trigone')));
    for (const block of s.blockPlans) {
      const exposed = prompt(s, block).sectionPlan.blockPlans[0].packets;
      assert.ok(exposed.every((packet) => packet.canInterpret), 'unlicensed facts stay outside prose block inputs');
    }
    assert.deepEqual(source, original);
  });
}

test('a licensed natal aspect keeps its factual prefix and original rule', () => {
  const proof = aspect('Sun', 'Venus', 'conjunction');
  const p = plan(evidence([proof]));
  const s = section(p, 'supporting_resources');
  assert.ok(s.blockPlans.some((block) => block.deterministicPrefix?.includes('conjonction')));
  const packet = s.evidencePackets.find((item) => item.evidenceRefs.includes(proof.evidenceId));
  assert.ok(packet.interpretationRuleRefs.includes('western.natal.aspect.sun_venus.conjunction@1'));
});

test('same-sign placements receive distinct existing functional focuses, not a new interaction license', () => {
  const p = plan(evidence());
  const roles = ['identity', 'communication', 'affectivity', 'work_realization'].map((id) => {
    const s = section(p, id);
    const block = s.blockPlans[0];
    assert.ok(block?.narrativeRole);
    assert.match(block.narrativeRole, /même signe/);
    const exposed = prompt(s, block).sectionPlan.blockPlans[0];
    assert.equal(exposed.narrativeRole, block.narrativeRole);
    assert.deepEqual(s.allowedRelations, [], 'a shared sign is not a calculated interaction');
    return block.narrativeRole;
  });
  assert.equal(new Set(roles).size, roles.length);
  assert.match(roles[0], /direction personnelle/);
  assert.match(roles[1], /pensée et le langage/);
  assert.match(roles[2], /accorder de la valeur/);
  assert.match(roles[3], /responsabilité et les limites/);
  assert.match(section(p, 'general_synthesis').editorialPlan.mission, /côte à côte/);
});

function contact(id, start, end, body = 'Moon', natalPoint = 'Mercury') {
  return { evidenceId: `transit.${id}`, type: 'PERSONAL_TRANSIT', value: {
    status: Date.parse(start) > Date.parse(NOW) ? 'UPCOMING' : 'CURRENT', transitBody: body, natalPoint, aspectType: 'sextile',
    startsAt: start, exactAt: start, endsAt: end, phase: 'APPLYING', orb: .1, effectiveOrbLimit: 1.2
  } };
}

test('the production selection limits the catalogue while covering all six weeks and retaining original proofs', () => {
  const contacts = Array.from({ length: 42 }, (_, day) => contact(`future.${day}`, new Date(Date.UTC(2026, 10, 2 + day)).toISOString(), new Date(Date.UTC(2026, 10, 2 + day, 12)).toISOString(), day % 7 === 3 ? 'Jupiter' : 'Moon'));
  const source = evidence(contacts), original = structuredClone(source);
  const s = section(plan(source), 'next_weeks');
  const selected = s.evidencePackets.flatMap((p) => p.claims).filter((claim) => claim.type === 'PERSONAL_TRANSIT');
  assert.equal(selected.length, 6);
  assert.equal(new Set(selected.map((c) => Math.floor((Date.parse(c.startsAt) - Date.parse(contacts[0].value.startsAt)) / (7 * 86400000)))).size, 6);
  assert.ok(selected.some((c) => c.transitBody === 'Jupiter'));
  assert.deepEqual(source, original);
});

test('later today is explicitly distinguished from a contact already current, without changing either status', async () => {
  const later = contact('later-today', '2026-11-01T15:00:00.000Z', '2026-11-01T18:00:00.000Z', 'Mercury', 'Jupiter');
  const ongoing = contact('ongoing', '2026-10-31T15:00:00.000Z', '2026-11-02T18:00:00.000Z', 'Venus', 'Mercury');
  const source = evidence([later, ongoing]), original = structuredClone(source);
  const p = plan(source);
  const s = section(p, 'next_weeks');
  const block = s.blockPlans.find((b) => b.packetRefs.some((ref) => s.evidencePackets.find((pk) => pk.packetId === ref)?.evidenceRefs.includes(later.evidenceId)));
  assert.match(block.deterministicPrefix, /Plus tard aujourd’hui/);
  assert.equal(p.ownerByEvidenceRef[later.evidenceId], 'next_weeks');
  assert.equal(p.ownerByEvidenceRef[ongoing.evidenceId], 'current_sky');
  let calls = 0;
  const result = await writeStructuredSectionWithLlm({ dossierEvidence: source, sectionPlan: scopedSectionPlanForBlock(s, block), options: { logger: { warn() {} }, structuredWriterFn: ({ sectionPlan }) => {
    calls++;
    return { sectionId: sectionPlan.sectionId, blocks: [{ blockId: block.blockId, text: 'La formulation et l’élargissement des possibilités peuvent coopérer symboliquement.' }] };
  } } });
  assert.equal(result.validation.ok, true);
  assert.equal(calls, 1);
  assert.deepEqual(source, original);
});

test('current selection favors four licensed non-lunar contacts over redundant short lunar prose', () => {
  const contacts = [
    ...['Moon', 'Mercury', 'Venus', 'Mars', 'Saturn'].map((body) => contact(`current.${body}`, '2026-10-31T15:00:00.000Z', '2026-11-02T18:00:00.000Z', body, 'Sun')),
    contact('current.Moon2', '2026-11-01T08:00:00.000Z', '2026-11-01T18:00:00.000Z', 'Moon', 'Jupiter')
  ];
  const source = evidence(contacts), original = structuredClone(source);
  const s = section(plan(source), 'current_sky');
  const selected = s.evidencePackets.flatMap((p) => p.claims).filter((claim) => claim.type === 'PERSONAL_TRANSIT');
  assert.equal(selected.length, 4);
  assert.ok(selected.every((claim) => claim.transitBody !== 'Moon'));
  assert.ok(contacts.every((proof) => source.evidence.includes(proof)));
  assert.deepEqual(source, original);
});

for (const [nowUtc, startsAt, expectedLaterToday] of [
  ['2026-11-01T22:30:00.000Z', '2026-11-01T23:30:00.000Z', false],
  ['2026-10-25T00:15:00.000Z', '2026-10-25T01:15:00.000Z', true]
]) {
  test(`later-today wording follows the reference zone at midnight or DST (${startsAt})`, () => {
    const proof = contact('calendar', startsAt, new Date(Date.parse(startsAt) + 60 * 60000).toISOString(), 'Mercury', 'Jupiter');
    proof.value.status = 'UPCOMING';
    const source = evidence([proof]);
    source.evidence.find((p) => p.type === 'TRANSIT_SNAPSHOT').value.nowUtc = nowUtc;
    const s = section(plan(source), 'next_weeks');
    const prefix = s.blockPlans[0].deterministicPrefix;
    assert.equal(prefix.includes('Plus tard aujourd’hui'), expectedLaterToday);
  });
}
