import assert from 'node:assert/strict';
import test from 'node:test';
import { rulesForEvidence } from '../src/deliverables/interpretationRules.mjs';
import { buildFullDossierPlan } from '../src/deliverables/fullDossierPlan.mjs';
import { buildStructuredUserPrompt, scopedSectionPlanForBlock } from '../src/deliverables/structuredSectionWriter.mjs';
import { validateStructuredSection } from '../src/deliverables/factualClaimsValidator.mjs';

const proof = (transitBody='Mercury', natalPoint='Jupiter', aspectType='square') => ({evidenceId:`transit.${transitBody}.${natalPoint}.${aspectType}`,type:'PERSONAL_TRANSIT',value:{status:'UPCOMING',transitBody,natalPoint,aspectType,orb:.2,effectiveOrbLimit:1.2,startsAt:'2026-10-28T00:00:00Z',exactAt:'2026-10-30T12:00:00Z',endsAt:'2026-10-31T00:00:00Z',phase:'APPLYING'}});
function context(){const evidence={referenceTimeZone:'Europe/Paris',evidence:[{evidenceId:'transits.snapshot',type:'TRANSIT_SNAPSHOT',value:{nowUtc:'2026-10-25T21:00:00Z',horizonDays:42}},proof()]};const plan=buildFullDossierPlan(evidence,{aspectChapterMode:'reference'}).sections.find(s=>s.sectionId==='next_weeks');return{evidence,plan,block:plan.blockPlans[0]};}

test('transit semantics describe both canonical functions and preserve their temporal roles',()=>{
 const mercuryJupiter=rulesForEvidence(proof())[0];
 assert.equal(mercuryJupiter.semantics.roles.transitingBody,'Mercury');
 assert.equal(mercuryJupiter.semantics.roles.natalPoint,'Jupiter');
 assert.ok(mercuryJupiter.semantics.concepts.includes('pensée et langage'));
 assert.ok(mercuryJupiter.semantics.concepts.includes('confiance'));
 const sunMoon=rulesForEvidence(proof('Sun','Moon','sextile'))[0];
 assert.ok(sunMoon.semantics.concepts.includes('identité consciente'));
 assert.ok(sunMoon.semantics.concepts.includes('monde émotionnel'));
 assert.notEqual(sunMoon.semantics.relation,mercuryJupiter.semantics.relation);
 const venusMercury=rulesForEvidence(proof('Venus','Mercury','sextile'))[0];
 assert.ok(venusMercury.semantics.concepts.includes('affectivité'));
 assert.notEqual(venusMercury.semantics.roles.transitingFunction,sunMoon.semantics.roles.transitingFunction);
});

test('new transit metadata does not create a licence for an outer planet or an angle',()=>{
 for(const p of [proof('Neptune','ASC'),proof('Uranus','Saturn','opposition'),proof('Mars','MC','opposition')]) assert.deepEqual(rulesForEvidence(p),[]);
});

test('the closed production prompt supplies the pair-specific semantics rather than a second stock phrase',()=>{
 const {plan,block}=context();
 const scoped=scopedSectionPlanForBlock(plan,block);
 const prompt=JSON.parse(buildStructuredUserPrompt({sectionPlan:scoped}));
 const packet=prompt.sectionPlan.blockPlans[0].packets.find(p=>p.facts.some(f=>f.type==='PERSONAL_TRANSIT'));
 assert.equal(packet.semantics.roles.transitingBody,'Mercury');
 assert.equal(packet.semantics.roles.natalPoint,'Jupiter');
 assert.deepEqual(packet.themes,[]);
 assert.equal(scoped.evidencePackets.length,1);
});

test('pair-specific semantics never authorize another aspect mentioned in client prose',()=>{
 const {evidence,plan,block}=context();
 const scoped=scopedSectionPlanForBlock(plan,block);
 const result=validateStructuredSection({dossierEvidence:evidence,sectionPlan:scoped,section:{sectionId:plan.sectionId,blocks:[{blockId:block.blockId,text:block.deterministicPrefix+'\n\nLa Lune forme une opposition avec Saturne.'}]}});
 assert.ok(result.issues.some(i=>i.code==='undeclared_text_fact'));
});
