import assert from 'node:assert/strict';
import test from 'node:test';
import { groupComplementaryAxisPackets } from '../src/deliverables/axisTransitGroups.mjs';

// Synthetic packet fixtures test display identity, not astronomical calculation.
const WIDE = { startsAt: '2027-03-24T17:11:53.040Z', exactAt: '2027-03-25T22:06:38.427Z', endsAt: '2027-03-27T03:00:14.159Z' };
const NARROW = { startsAt: '2027-03-25T02:50:15.766Z', exactAt: WIDE.exactAt, endsAt: '2027-03-26T17:22:30.170Z' };
function fixture(firstExtra = {}, secondExtra = {}) {
  const proofs = [
    { evidenceId: 'transit.test.asc', type: 'PERSONAL_TRANSIT', value: { transitBody: 'Sun', natalPoint: 'ASC', aspectType: 'trine', orb: 0, effectiveOrbLimit: 1.2, phase: 'APPLYING', reliability: 'HIGH', ...WIDE, ...firstExtra }, provenance: { reliability: 'HIGH' } },
    { evidenceId: 'transit.test.dsc', type: 'PERSONAL_TRANSIT', value: { transitBody: 'Sun', natalPoint: 'DSC', aspectType: 'sextile', orb: 0, effectiveOrbLimit: .8, phase: 'APPLYING', reliability: 'HIGH', ...NARROW, ...secondExtra }, provenance: { reliability: 'HIGH' } }
  ];
  const packets = proofs.map(proof => ({ packetId: 'packet.' + proof.evidenceId, evidenceRefs: [proof.evidenceId], interpretationRuleRefs: [], claims: [{ type: 'PERSONAL_TRANSIT', transitBody: proof.value.transitBody, natalPoint: proof.value.natalPoint, aspectType: proof.value.aspectType, startsAt: proof.value.startsAt, exactAt: proof.value.exactAt, endsAt: proof.value.endsAt, orb: proof.value.orb, phase: proof.value.phase, evidenceRefs: [proof.evidenceId] }] }));
  return { proofs, packets, storyGroups: packets.map(packet => [packet]), byId: new Map(proofs.map(proof => [proof.evidenceId, proof])) };
}
const grouped = f => groupComplementaryAxisPackets(f.storyGroups, f.byId);
function unchangedSeparately(f) {
  const copy = structuredClone({ proofs: f.proofs, groups: f.storyGroups });
  const result = grouped(f);
  assert.equal(result.length, f.storyGroups.length);
  for (let i = 0; i < result.length; i++) {
    assert.equal(result[i].axisGroup, null);
    assert.equal(result[i].packets, f.storyGroups[i]);
    assert.equal(result[i].displayPackets, result[i].packets);
  }
  assert.deepEqual({ proofs: f.proofs, groups: f.storyGroups }, copy);
}

test('one complementary axis contact displays the existing containing window and keeps both original packets and proofs', () => {
  const f = fixture(), original = structuredClone({ proofs: f.proofs, groups: f.storyGroups });
  const result = grouped(f);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].packets, f.packets);
  assert.equal(result[0].packets[0], f.packets[0]);
  assert.equal(result[0].packets[1], f.packets[1]);
  assert.deepEqual(result[0].displayPackets, [f.packets[0]]);
  assert.deepEqual(result[0].axisGroup, { axis: 'ascendant_descendant', evidenceRefs: f.proofs.map(p => p.evidenceId), packetIds: f.packets.map(p => p.packetId), primaryEvidenceRef: f.proofs[0].evidenceId, primaryPacketId: f.packets[0].packetId });
  assert.deepEqual({ proofs: f.proofs, groups: f.storyGroups }, original);
});

test('the containing window wins in either input order without constructing a union of windows', () => {
  const f = fixture(); f.storyGroups.reverse();
  const result = grouped(f);
  assert.equal(result.length, 1);
  assert.equal(result[0].displayPackets[0], f.packets[0]);
  assert.deepEqual(result[0].displayPackets[0].claims[0].startsAt, WIDE.startsAt);
  assert.deepEqual(result[0].displayPackets[0].claims[0].endsAt, WIDE.endsAt);
  assert.deepEqual(result[0].packets, [f.packets[1], f.packets[0]]);
  assert.deepEqual(grouped(f), result, 'same ordered input, same descriptors');
});

test('a larger Descendant orb and containing window take precedence over the canonical angle preference', () => {
  const f = fixture({ ...NARROW, effectiveOrbLimit: .8 }, { ...WIDE, effectiveOrbLimit: 1.2 });
  assert.equal(grouped(f)[0].displayPackets[0], f.packets[1]);
});

test('equal windows and limits prefer ASC, independently of input order', () => {
  const f = fixture({}, { ...WIDE, effectiveOrbLimit: 1.2 });f.storyGroups.reverse();
  assert.equal(grouped(f).length,1);assert.equal(grouped(f)[0].displayPackets[0],f.packets[0]);
});

for (const [firstAspect, secondAspect] of [['conjunction','opposition'],['opposition','conjunction'],['trine','sextile'],['sextile','trine'],['square','square']]) {
  test(`the MC/IC axis groups only calculated complementary ${firstAspect}/${secondAspect}`, () => {
    const f=fixture({natalPoint:'MC',aspectType:firstAspect},{natalPoint:'IC',aspectType:secondAspect});
    const result=grouped(f);assert.equal(result.length,1);assert.equal(result[0].axisGroup.axis,'midheaven_imum_coeli');
    assert.deepEqual(result[0].packets.flatMap(packet=>packet.claims.map(claim=>claim.aspectType)),[firstAspect,secondAspect]);
  });
}

for (const [reason, firstExtra, secondExtra] of [
  ['different exact UTC millisecond', {}, { exactAt:'2027-03-25T22:06:38.428Z' }],
  ['different peak in the same local day', {}, { exactAt:'2027-03-25T23:06:38.427Z' }],
  ['different transiting body', {}, { transitBody:'Mars' }],
  ['same angle pole', {}, { natalPoint:'ASC' }],
  ['different axes', {}, { natalPoint:'IC' }],
  ['a non-angle target', {}, { natalPoint:'Venus' }],
  ['aspects not complementary', {}, { aspectType:'square' }],
  ['an unsupported aspect', {}, { aspectType:'quincunx' }],
  ['different phase', {}, { phase:'SEPARATING' }],
  ['different reliability', {}, { reliability:'LOW' }],
  ['different sixth decimal of current orb', {orb:.100001}, {orb:.100002}],
  ['string orb is not a measured numeric orb', {}, {orb:'0'}],
  ['missing orb', {}, {orb:undefined}],
  ['missing effective orb limit', {}, {effectiveOrbLimit:undefined}],
  ['negative orb', {}, {orb:-.2}],
  ['orb outside its own permitted limit', {}, {orb:1.1}],
  ['containing window has smaller effective limit', {effectiveOrbLimit:.8}, {effectiveOrbLimit:1.2}],
  ['windows cross instead of nesting', {}, {startsAt:'2027-03-25T02:00:00.000Z',endsAt:'2027-03-28T00:00:00.000Z'}],
  ['missing window start', {}, {startsAt:null}],
  ['missing window end', {}, {endsAt:null}],
  ['invalid peak', {}, {exactAt:'invalid'}],
  ['peak outside the calculated window', {}, {exactAt:'2027-03-29T00:00:00.000Z'}]
]) test('no grouped display for '+reason,()=>unchangedSeparately(fixture(firstExtra,secondExtra)));

for (const [reason, mutate] of [
  ['one packet has an interpretation rule', f=>f.packets[1].interpretationRuleRefs.push('already.licensed.rule')],
  ['absence of rules is not confirmed', f=>delete f.packets[1].interpretationRuleRefs],
  ['missing canonical source proof', f=>f.byId.delete(f.proofs[1].evidenceId)],
  ['missing unrelated source reference', f=>f.packets[1].evidenceRefs.push('missing.context')],
  ['no PERSONAL_TRANSIT claim', f=>f.packets[1].claims=[]],
  ['extra PERSONAL_TRANSIT claim', f=>f.packets[1].claims.push({...f.packets[1].claims[0]})],
  ['claim points at another evidence', f=>f.packets[1].claims[0].evidenceRefs=['elsewhere']],
  ['claim changes its source planet', f=>f.packets[1].claims[0].transitBody='Jupiter'],
  ['claim changes its source date', f=>f.packets[1].claims[0].startsAt='2027-03-24T00:00:00.000Z'],
  ['claim changes its source orb', f=>f.packets[1].claims[0].orb=.3],
  ['claim invents a source natal house', f=>f.packets[1].claims[0].natalHouse=7],
  ['value contradicts provenance reliability', f=>f.proofs[1].provenance.reliability='LOW'],
  ['a story already contains multiple recurrences', f=>f.storyGroups[1].push({...f.packets[1],packetId:'another.occurrence'})]
]) test('no source evidence is hidden when '+reason,()=>{const f=fixture();mutate(f);unchangedSeparately(f);});

test('no grouping can be inferred from only one side of an axis',()=>{
  const f=fixture();f.storyGroups=[f.storyGroups[0]];
  const result=grouped(f);assert.equal(result.length,1);assert.equal(result[0].axisGroup,null);assert.deepEqual(result[0].displayPackets,[f.packets[0]]);
});

test('the current orb is compared at its stored six-decimal precision, without a loose tolerance',()=>{
  const f=fixture({orb:.1000001},{orb:.1000002});assert.equal(grouped(f).length,1);
  unchangedSeparately(fixture({orb:.1000001},{orb:.1000012}));
});

test('a third contact is retained when a pair has already been grouped',()=>{
  const f=fixture(), thirdProof=structuredClone(f.proofs[1]), thirdPacket=structuredClone(f.packets[1]);
  thirdProof.evidenceId='transit.test.third';thirdPacket.packetId='packet.third';thirdPacket.evidenceRefs=[thirdProof.evidenceId];thirdPacket.claims[0].evidenceRefs=[thirdProof.evidenceId];
  f.byId.set(thirdProof.evidenceId,thirdProof);f.storyGroups.push([thirdPacket]);
  const result=grouped(f);assert.equal(result.length,2);
  assert.deepEqual(result.flatMap(group=>group.packets),[...f.packets,thirdPacket]);
  assert.equal(result[1].axisGroup,null);
});

test('missing source lookup never creates a complementary proof and malformed group containers fail explicitly',()=>{
  const f=fixture();assert.equal(groupComplementaryAxisPackets(f.storyGroups,null).length,2);
  assert.throws(()=>groupComplementaryAxisPackets(null,f.byId),TypeError);
  assert.throws(()=>groupComplementaryAxisPackets([null],f.byId),TypeError);
});
