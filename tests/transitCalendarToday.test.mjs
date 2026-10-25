import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFullDossierPlan } from '../src/deliverables/fullDossierPlan.mjs';
import { validateAstrologicalDates } from '../src/deliverables/calendarDates.mjs';
import { detectAstrologicalTextFacts, validateStructuredSection } from '../src/deliverables/factualClaimsValidator.mjs';
import { buildStructuredUserPrompt, scopedSectionPlanForBlock, writeStructuredSectionWithLlm } from '../src/deliverables/structuredSectionWriter.mjs';
import { renderableDossierSection } from '../src/deliverables/dossierPresentation.mjs';
import { docStrings } from '../src/deliverables/i18n.mjs';

// Synthetic calculated contacts, with no person's identity or birth data.
const WINDOW = { startsAt:'2026-10-24T00:00:00.000Z', endsAt:'2026-10-27T23:00:00.000Z' };
function proof(id, {nowUtc='2026-10-25T12:00:00.000Z', exactAt='2026-10-25T22:00:00.000Z', ...extra}={}) {
 return {evidenceId:id,type:'PERSONAL_TRANSIT',value:{status:'CURRENT',transitBody:'Sun',natalPoint:'ASC',aspectType:'trine',orb:0,effectiveOrbLimit:1.2,reliability:'HIGH',phase:Date.parse(exactAt)>Date.parse(nowUtc)?'APPLYING':Date.parse(exactAt)<Date.parse(nowUtc)?'SEPARATING':'EXACT',...WINDOW,exactAt,...extra},provenance:{reliability:'HIGH'}};
}
function fixture({nowUtc='2026-10-25T12:00:00.000Z',exactAt='2026-10-25T22:00:00.000Z',timeZone='Europe/Paris',other=[],...extra}={}) {
 const evidence={schema:'astrolab.dossier_evidence',referenceTimeZone:timeZone,evidence:[
  {evidenceId:'transits.snapshot',type:'TRANSIT_SNAPSHOT',value:{nowUtc,horizonDays:42}},proof('transit.sun.asc',{nowUtc,exactAt,...extra}),...other
 ]};
 const full=buildFullDossierPlan(evidence,{aspectChapterMode:'reference'}),section=full.sections.find(s=>s.sectionId==='current_sky');
 const block=section.blockPlans.find(b=>b.packetRefs.some(ref=>section.evidencePackets.find(p=>p.packetId===ref)?.evidenceRefs.includes('transit.sun.asc')));
 assert.ok(block,'the fixture must have a valid currently active contact');
 return{evidence,full,section,block,nowUtc,exactAt,timeZone};
}
const scoped=f=>scopedSectionPlanForBlock(f.section,f.block);
async function writeCalculated(f){let calls=0;const result=await writeStructuredSectionWithLlm({dossierEvidence:f.evidence,sectionPlan:scoped(f),options:{logger:{warn(){}},structuredWriterFn:()=>{calls++;throw new Error('A calculated reference must not invoke any model transport.');}}});assert.equal(calls,0);assert.equal(result.llmCalls,0);return result;}
function dateIssues(text,refs,timeZone='Europe/Paris'){return validateAstrologicalDates({text,refs,timeZone,aspectFacts:detectAstrologicalTextFacts});}
async function rejectsBeforeTransport(f,expectedCode){let calls=0;await assert.rejects(writeStructuredSectionWithLlm({dossierEvidence:f.evidence,sectionPlan:scoped(f),options:{logger:{warn(){}},structuredWriterFn:()=>{calls++;return{};}}}),error=>error.code==='SERVER_PREFIX_VALIDATION_FAILED'&&error.validation?.issues.some(issue=>issue.code===expectedCode));assert.equal(calls,0);}

for(const [label,nowUtc,exactAt,expected] of [
 ['later today','2026-10-25T12:00:00.000Z','2026-10-25T22:00:00.000Z',"L'aspect sera exact aujourd'hui, le 25 octobre 2026."],
 ['earlier today','2026-10-25T20:00:00.000Z','2026-10-25T10:00:00.000Z',"L'aspect a été exact aujourd'hui, le 25 octobre 2026."],
 ['at the reference instant','2026-10-25T12:00:00.000Z','2026-10-25T12:00:00.000Z',"L'aspect est exact aujourd'hui, le 25 octobre 2026."],
 ['within the declared now tolerance','2026-10-25T12:00:00.000Z','2026-10-25T12:00:45.000Z',"L'aspect est exact aujourd'hui, le 25 octobre 2026."],
 ['different UTC dates but the same Paris day','2026-10-25T23:10:00.000Z','2026-10-26T00:10:00.000Z',"L'aspect sera exact aujourd'hui, le 26 octobre 2026."],
 ['DST repeated local hour, still future by UTC','2026-10-25T00:15:00.000Z','2026-10-25T01:15:00.000Z',"L'aspect sera exact aujourd'hui, le 25 octobre 2026."],
 ['DST repeated local hour, already past by UTC','2026-10-25T01:45:00.000Z','2026-10-25T00:45:00.000Z',"L'aspect a été exact aujourd'hui, le 25 octobre 2026."]
])test('today: '+label+', production prefix and zero-transport writer agree',async()=>{
 const f=fixture({nowUtc,exactAt}),original=structuredClone(f.evidence);
 assert.ok(f.block.deterministicPrefix.endsWith(expected),f.block.deterministicPrefix);
 assert.equal(f.block.deterministic,true);assert.equal(f.block.calculatedReference,true);
 const result=await writeCalculated(f);assert.equal(result.validation.ok,true);assert.equal(result.section.blocks[0].text,f.block.deterministicPrefix);
 assert.deepEqual(f.evidence,original,'UTC instants and source statuses must remain unchanged');
});

test('the same UTC date can mean tomorrow in Paris, while an explicit UTC document still says today',async()=>{
 const options={nowUtc:'2026-10-25T22:50:00.000Z',exactAt:'2026-10-25T23:10:00.000Z'};
 const paris=fixture(options),utc=fixture({...options,timeZone:'UTC'});
 assert.doesNotMatch(paris.block.deterministicPrefix,/aujourd['’]hui/);assert.match(paris.block.deterministicPrefix,/sera exact le 26 octobre 2026/);
 assert.match(utc.block.deterministicPrefix,/sera exact aujourd'hui, le 25 octobre 2026/);
 await writeCalculated(paris);await writeCalculated(utc);
 assert.ok(!fCalendarPacket(paris));assert.ok(fCalendarPacket(utc));
});
function fCalendarPacket(f){return f.section.evidencePackets.find(p=>p.sourceRole==='transit_calendar_context'&&f.block.packetRefs.includes(p.packetId));}

test('the scoped reference clock is factual context, not permission to interpret an angle or natal placement',()=>{
 const f=fixture(),context=fCalendarPacket(f);assert.ok(context);assert.equal(context.interpretationDepth,'reference');assert.deepEqual(context.interpretationRuleRefs,[]);assert.deepEqual(context.themes,[]);
 assert.deepEqual(context.evidenceRefs,['transits.snapshot']);assert.deepEqual(context.claims.map(c=>c.type),['TRANSIT_SNAPSHOT']);
 const closed=scoped(f),prompt=JSON.parse(buildStructuredUserPrompt({sectionPlan:closed}));
 const sent=prompt.sectionPlan.blockPlans[0].packets.find(p=>p.sourceRole==='transit_calendar_context');
 assert.equal(sent.canInterpret,false);assert.equal(sent.semantics,undefined);assert.deepEqual(sent.themes,[]);assert.deepEqual(closed.allowedInterpretationRuleRefs,[]);
 for(const text of ['La Lune est en Cancer.','Le Soleil est en maison 5.','Neptune forme une opposition avec Saturne.']) {
  const validation=validateStructuredSection({dossierEvidence:f.evidence,sectionPlan:closed,section:{sectionId:closed.sectionId,blocks:[{blockId:f.block.blockId,text}]}});
  assert.ok(validation.issues.some(i=>i.code==='undeclared_text_fact'),text);
 }
});

test('relative exact dates require the supplied reference clock and never fall back to the system day',()=>{
 const f=fixture(),transit=f.evidence.evidence.find(p=>p.type==='PERSONAL_TRANSIT');
 const text="Le Soleil forme un trigone à votre Ascendant. L'aspect sera exact aujourd'hui.";
 assert.equal(dateIssues(text,[transit,...f.evidence.evidence.filter(p=>p.type==='TRANSIT_SNAPSHOT')]).length,0);
 assert.ok(dateIssues(text,[transit]).some(i=>i.code==='transit_text_date_mismatch'));
 const malformed={evidenceId:'transits.snapshot',type:'TRANSIT_SNAPSHOT',value:{nowUtc:'invalid'}};
 assert.ok(dateIssues(text,[transit,malformed]).some(i=>i.code==='transit_text_date_mismatch'));
});

for(const [label,nowUtc,peak,valid,invalid] of [
 ['local midnight forward','2026-10-25T22:50:00.000Z','2026-10-25T23:10:00.000Z','demain',"aujourd'hui"],
 ['local midnight backward','2026-10-25T23:10:00.000Z','2026-10-25T22:50:00.000Z','hier',"aujourd'hui"],
 ['the Paris DST day','2026-10-25T00:15:00.000Z','2026-10-25T01:15:00.000Z',"aujourd'hui",'demain']
])test('relative day validation: '+label,()=>{
 const f=fixture({nowUtc,exactAt:peak});
 const text=relative=>`Le Soleil forme un trigone à votre Ascendant. L'aspect est exact ${relative}.`;
 assert.deepEqual(dateIssues(text(valid),f.evidence.evidence),[]);
 assert.ok(dateIssues(text(invalid),f.evidence.evidence).some(i=>i.code==='transit_text_date_mismatch'));
});

test('a false relative today remains blocking before transport even when its explicit source date is correct',async()=>{
 const f=fixture({nowUtc:'2026-10-25T12:00:00.000Z',exactAt:'2026-10-26T12:00:00.000Z'});
 assert.doesNotMatch(f.block.deterministicPrefix,/aujourd['’]hui/);
 f.block.deterministicPrefix=f.block.deterministicPrefix.replace('sera exact le 26 octobre','sera exact aujourd’hui, le 26 octobre');
 await rejectsBeforeTransport(f,'transit_text_date_mismatch');
});

test('a false explicit date after an otherwise valid today is checked independently',async()=>{
 const f=fixture();f.block.deterministicPrefix=f.block.deterministicPrefix.replace("aujourd'hui, le 25 octobre","aujourd'hui, le 26 octobre");
 await rejectsBeforeTransport(f,'transit_text_date_mismatch');
});

test('a today prefix whose scoped clock was removed is rejected rather than reading a global clock',async()=>{
 const f=fixture(),calendar=fCalendarPacket(f);f.block.packetRefs=f.block.packetRefs.filter(ref=>ref!==calendar.packetId);
 await rejectsBeforeTransport(f,'transit_text_date_mismatch');
});

for(const [label,nowUtc,exactAt,from,to] of [
 ['future today cannot claim past','2026-10-25T12:00:00.000Z','2026-10-25T22:00:00.000Z','sera exact','a été exact'],
 ['past today cannot claim future','2026-10-25T20:00:00.000Z','2026-10-25T10:00:00.000Z','a été exact','sera exact']
])test('the relative day does not override the actual UTC direction: '+label,async()=>{
 const f=fixture({nowUtc,exactAt});f.block.deterministicPrefix=f.block.deterministicPrefix.replace(from,to);
 await rejectsBeforeTransport(f,'transit_temporal_direction_mismatch');
});

test('two complementary axis proofs stay immutable while the calculated row displays only the original wider window',async()=>{
 const nowUtc='2026-10-25T21:00:00.000Z',exactAt='2026-10-25T22:06:38.427Z';
 const second=proof('transit.sun.dsc',{nowUtc,exactAt,natalPoint:'DSC',aspectType:'sextile',effectiveOrbLimit:.8,startsAt:'2026-10-25T02:50:15.766Z',endsAt:'2026-10-26T17:22:30.170Z'});
 const f=fixture({nowUtc,exactAt,startsAt:'2026-10-24T17:11:53.040Z',endsAt:'2026-10-27T03:00:14.159Z',other:[second]}),original=structuredClone(f.evidence);
 const transitBlocks=f.section.blockPlans.filter(b=>b.deterministicPrefix);assert.equal(transitBlocks.length,1);
 assert.equal(f.block.axisGroup.primaryEvidenceRef,'transit.sun.asc');assert.deepEqual(f.block.axisGroup.evidenceRefs,['transit.sun.asc','transit.sun.dsc']);
 assert.match(f.block.deterministicPrefix,/Soleil forme un trigone à votre Ascendant/);assert.doesNotMatch(f.block.deterministicPrefix,/sextile|Descendant/);
 assert.match(f.block.deterministicPrefix,/entre le 24 octobre 2026 et le 27 octobre 2026/);
 const written=await writeCalculated(f),source=written.section.blocks[0];
 assert.equal(source.claims.filter(c=>c.type==='PERSONAL_TRANSIT').length,2);assert.ok(source.claims.some(c=>c.type==='TRANSIT_SNAPSHOT'));
 const displayed=renderableDossierSection({section:written.section,sectionPlan:scoped(f),dossierEvidence:f.evidence,strings:docStrings('fr')});
 assert.equal(displayed.calculatedReferences.length,1);assert.equal(displayed.calculatedReferences[0],f.block.deterministicPrefix);
 assert.equal(displayed.text,'');assert.deepEqual(f.evidence,original);
});
