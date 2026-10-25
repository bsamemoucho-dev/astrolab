import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAstrologicalTextFacts, validateStructuredSection } from '../src/deliverables/factualClaimsValidator.mjs';
import { buildFullDossierPlan } from '../src/deliverables/fullDossierPlan.mjs';
import { calendarDate, validateAstrologicalDates } from '../src/deliverables/calendarDates.mjs';
import { writeStructuredSectionWithLlm } from '../src/deliverables/structuredSectionWriter.mjs';
const bodies = { Sun:'Soleil', Moon:'Lune', Mercury:'Mercure', Venus:'Vénus', Mars:'Mars', Jupiter:'Jupiter', Saturn:'Saturne', Uranus:'Uranus', Neptune:'Neptune', Pluto:'Pluton' };
const aspects = { conjunction:'conjonction', opposition:'opposition', square:'carré', trine:'trigone', sextile:'sextile' };
function simple(evidence, text) {
  const ids=evidence.map(e=>e.evidenceId);
  const sectionPlan={ sectionId:'unit', primaryEvidenceRefs:ids, secondaryEvidenceRefs:[], allowedInterpretationRuleRefs:[], evidencePackets:[{packetId:'packet',evidenceRefs:ids,claims:[]}],blockPlans:[{blockId:'b',packetRefs:['packet']}] };
  return validateStructuredSection({dossierEvidence:{evidence},sectionPlan,section:{sectionId:'unit',blocks:[{blockId:'b',text}]}});
}
const house = (body, n) => ({evidenceId:`house.${body}.${n}`,type:'NATAL_BODY_HOUSE',value:{body,house:n,houseSystem:'WHOLE_SIGN'}});
const aspect = (bodyA,bodyB,aspectType) => ({evidenceId:`aspect.${bodyA}.${bodyB}.${aspectType}`,type:'NATAL_ASPECT',value:{bodyA,bodyB,aspectType}});
for(const [body,name] of Object.entries(bodies)) test(`houses: exact binding for ${body}, all 12 houses and French constructions`,()=>{
  for(let n=1;n<=12;n++) {
    const evidence=[house(body,n)];
    for(const text of [`${name} est en maison ${n}.`,`${name} se trouve dans la maison ${n}.`,`${name} occupe la ${n}e maison.`,`${name}, situé en maison ${n}, invite à réfléchir.`,`La maison ${n} accueille ${name}.`,`En maison ${n}, ${name} propose une piste.`,`${name} occupe votre maison ${n}.`,`Dans la maison ${n} se trouve ${name}.`]) {
      // The final inverted construction is a specific grammar, not arbitrary co-occurrence.
      const result=simple(evidence,text);assert.equal(result.ok,true,`${text}: ${JSON.stringify(result.issues)}`);
      const other=body==='Moon'?'Sun':'Moon';
      const rejected=simple([house(other,n)],text);
      assert.equal(rejected.ok,false,`${text} borrowed ${other}'s proof`);
      assert.ok(rejected.issues.some(i=>i.code==='undeclared_text_fact' && i.fact?.body===body));
    }
  }
});
test('houses: coordinated subjects, separate placements and thematic rulership stay distinct',()=>{
  assert.equal(simple([house('Moon',7),house('Venus',7)],'La Lune et Vénus se trouvent en maison 7.').ok,true);
  assert.equal(simple([house('Moon',7)],'La Lune et Vénus se trouvent en maison 7.').ok,false);
  assert.equal(simple([house('Moon',3),house('Sun',7)],'La Lune en maison 3 et le Soleil en maison 7 invitent à réfléchir.').ok,true);
  assert.equal(simple([house('Moon',3)],'Mercure, maître de la maison 3, évoque une fonction symbolique.').ok,true);
  assert.equal(simple([house('Moon',3)],'Mercure est important. La Lune est en maison 3.').ok,true);
});
for(const [type,word] of Object.entries(aspects)) test(`aspects: authorized/rejected ${type}, inversions and common constructions`,()=>{
  for(const [first,second] of [['Mercury','Mars'],['Mars','Mercury']]) {
    const a=bodies[first],b=bodies[second];
    for(const text of [`${a} et ${b} forment un ${word}.`,`${a} et votre ${b} sont en ${word}.`,`${a} est en ${word} de ${b}.`,`${a} forme un ${word} avec la planète ${b}.`,`Le ${word} entre ${a} et ${b} invite à réfléchir.`,`${a} — ${word} — ${b}.`,`${a} forme le 9 mars 2027 un ${word} avec ${b}.`]) {
      assert.equal(simple([aspect(first,second,type)],text).ok,true,text);
      const result=simple([aspect('Moon','Jupiter',type)],text);assert.equal(result.ok,false,text);assert.ok(result.issues.some(i=>i.code==='undeclared_text_fact'));
    }
  }
});
test('aspects: no cross-pairing across coordinated clauses or multiple aspects',()=>{
  for(const text of ['Mercure et Mars forment un sextile, tandis que Vénus forme un trigone avec Jupiter.','Mercure forme un sextile avec Mars et Vénus forme un trigone avec Jupiter.','Mercure et Mars sont en sextile. Le trigone entre Vénus et Jupiter apporte une autre piste.']) {
    const facts=detectAstrologicalTextFacts(text).filter(f=>f.type==='ASPECT');
    assert.equal(facts.length,2,JSON.stringify(facts));
    assert.equal(simple([aspect('Mercury','Mars','sextile'),aspect('Venus','Jupiter','trine')],text).ok,true,text);
  }
});
test('implicit aspects are documented ambiguity, not fabricated geometric facts',()=>{
  for(const text of ['La Lune, en harmonie avec votre Milieu du Ciel.','La Lune soutient votre réalisation.','Vous pouvez rechercher une harmonie entre action et réflexion.']) {
    assert.equal(detectAstrologicalTextFacts(text).some(f=>f.type==='ASPECT'),false);
  }
});
function transitFixture({startsAt='2026-10-05T22:30:00Z',exactAt='2026-10-05T22:45:00Z',endsAt='2026-10-06T23:15:00Z',timeZone='Europe/Paris',aspectType='sextile',transitBody='Mercury',natalPoint='Sun'}={}) {
  const dossierEvidence={referenceTimeZone:timeZone,evidence:[{evidenceId:'transit.fixture',type:'PERSONAL_TRANSIT',value:{transitBody,natalPoint,aspectType,startsAt,exactAt,endsAt,phase:'APPLYING',status:'CURRENT',orb:0}},{evidenceId:'transits.snapshot',type:'TRANSIT_SNAPSHOT',value:{nowUtc:'2026-10-01T12:00:00Z',horizonDays:42}}]};
  const full=buildFullDossierPlan(dossierEvidence);
  const plan=full.sections.find(s=>s.sectionId==='current_sky');const block=plan.blockPlans.find(b=>b.deterministicPrefix);
  return {dossierEvidence,sectionPlan:{...plan,blockPlans:[block]},block};
}
function validateTransit(f,text=f.block.deterministicPrefix) {return validateStructuredSection({...f,section:{sectionId:f.sectionPlan.sectionId,blocks:[{blockId:f.block.blockId,text}]}});}
const windows=[
 ['midnight Paris previous UTC day','2026-10-05T22:30:00Z','2026-10-05T22:45:00Z','2026-10-06T23:15:00Z'],
 ['summer time starts','2026-03-28T23:30:00Z','2026-03-29T01:30:00Z','2026-03-29T22:30:00Z'],
 ['winter time starts','2026-10-24T22:30:00Z','2026-10-25T01:30:00Z','2026-10-25T23:30:00Z'],
 ['year rollover','2026-12-31T22:30:00Z','2026-12-31T23:30:00Z','2027-01-01T23:30:00Z'],
 ['month rollover','2026-02-28T22:30:00Z','2026-02-28T23:30:00Z','2026-03-01T23:30:00Z'],
 ['one UTC day two Paris days','2026-10-05T00:00:00Z','2026-10-05T12:00:00Z','2026-10-05T22:00:00Z']
];
for(const [label,startsAt,exactAt,endsAt] of windows) test(`calendar: ${label}, production prefix and writer agree in Europe/Paris`,async()=>{
  const f=transitFixture({startsAt,exactAt,endsAt});const original=JSON.stringify(f.dossierEvidence);
  assert.equal(validateTransit(f).ok,true,JSON.stringify(validateTransit(f).issues));
  const local=calendarDate(exactAt,'Europe/Paris');
  const exactLead=f.block.deterministicPrefix.split('. ').find(s=>s.includes('exact'));
  assert.ok(exactLead.includes(String(local.day)));
  const result=await writeStructuredSectionWithLlm({...f,options:{structuredWriterFn:async()=>({sectionId:'current_sky',blocks:[{blockId:f.block.blockId,text:'Cette dynamique propose une piste symbolique.'}]})}});
  assert.equal(result.validation.ok,true);assert.ok(result.section.blocks[0].text.startsWith(f.block.deterministicPrefix));
  assert.equal(JSON.stringify(f.dossierEvidence),original,'UTC instants must not be changed');
  assert.equal(validateTransit(f,f.block.deterministicPrefix.replace(/\b20\d{2}\b/g,'2099')).ok,false);
});
test('calendar: UTC and Paris are explicit independent presentation choices',()=>{
  const paris=transitFixture();const utc=transitFixture({timeZone:'UTC'});
  assert.match(paris.block.deterministicPrefix,/6 octobre 2026 et le 7 octobre/);
  assert.match(utc.block.deterministicPrefix,/5 octobre 2026 et le 6 octobre/);
  assert.equal(validateTransit(paris,utc.block.deterministicPrefix).ok,false);
  assert.equal(validateTransit(utc,paris.block.deterministicPrefix).ok,false);
});
test('calendar: wrong role or impossible date is rejected, unrelated personal dates are not transit dates',()=>{
  const f=transitFixture({startsAt:'2026-10-04T12:00:00Z',exactAt:'2026-10-05T12:00:00Z',endsAt:'2026-10-06T12:00:00Z'});
  for(const text of ['Le transit commence le 6 octobre 2026.','L’aspect sera exact le 4 octobre 2026.','Le transit prend fin le 5 octobre 2026.','Le transit commence le 31 février 2026.']) assert.equal(validateTransit(f,text).ok,false,text);
  for(const text of ['Votre anniversaire le 9 mars 1980 reste une date personnelle.','Le transit vous rappelle vos souvenirs du 9 mars 1980.','Un rendez-vous le 31 décembre 2026 peut servir d’exemple.']) assert.equal(validateTransit(f,text).ok,true,text);
  for(const text of ['Le transit commence le 4 octobre 2026.','L’aspect sera exact le 5 octobre 2026.','Le transit prend fin le 6 octobre 2026.','Le transit commence le 04/10/2026.','Le transit commence le 2026-10-04.']) assert.equal(validateTransit(f,text).ok,true,text);
});
test('calendar: date cannot borrow a different transit or a different occurrence window',()=>{
  const f=transitFixture({startsAt:'2026-10-04T12:00:00Z',exactAt:'2026-10-05T12:00:00Z',endsAt:'2026-10-06T12:00:00Z'});
  const other={evidenceId:'other',type:'PERSONAL_TRANSIT',value:{transitBody:'Venus',natalPoint:'Moon',aspectType:'trine',startsAt:'2026-10-07T12:00:00Z',exactAt:'2026-10-08T12:00:00Z',endsAt:'2026-10-09T12:00:00Z'}};
  const refs=[f.dossierEvidence.evidence[0],other];
  assert.ok(validateAstrologicalDates({text:'Mercure forme un sextile avec le Soleil entre le 7 octobre 2026 et le 9 octobre 2026.',refs,timeZone:'Europe/Paris',aspectFacts:detectAstrologicalTextFacts}).length);
  const occurrence={...other,value:{...other.value,transitBody:'Mercury',natalPoint:'Sun',aspectType:'sextile'}};
  assert.ok(validateAstrologicalDates({text:'Mercure forme un sextile avec le Soleil entre le 4 octobre 2026 et le 9 octobre 2026.',refs:[refs[0],occurrence],timeZone:'Europe/Paris',aspectFacts:detectAstrologicalTextFacts}).length);
});
test('server prefix: invalid dates block before any correction call',async()=>{
  const f=transitFixture();f.block.deterministicPrefix=f.block.deterministicPrefix.replace(/2026/g,'2099');let calls=0;const logs=[];
  await assert.rejects(writeStructuredSectionWithLlm({...f,options:{logger:{warn:(_message,details)=>logs.push(details)},structuredWriterFn:async()=>{calls++;throw Error('must not run');}}}),e=>e.code==='SERVER_PREFIX_VALIDATION_FAILED'&&e.validation.issues.some(i=>i.code==='transit_text_date_mismatch'));
  assert.equal(calls,0);assert.ok(logs[0].findings.some(f=>f.fact?.role));assert.equal(JSON.stringify(logs).includes('2099'),false);
});
test('writer: unauthorized house is corrected through the existing blocking retry path',async()=>{
  const evidence={evidence:[house('Moon',7),{evidenceId:'natal.moon.sign',type:'NATAL_BODY_SIGN',value:{body:'Moon',sign:'Cancer'}}]};const plan=buildFullDossierPlan(evidence).sections.find(s=>s.sectionId==='emotional_world');let calls=0;
  const result=await writeStructuredSectionWithLlm({dossierEvidence:evidence,sectionPlan:plan,options:{logger:{warn(){}},structuredWriterFn:async()=>({sectionId:plan.sectionId,blocks:[{blockId:plan.blockPlans[0].blockId,text:++calls===1?'Le Soleil est en maison 7.':'La Lune est en maison 7.'}]})}});
  assert.equal(calls,2);assert.equal(result.validation.ok,true);
});

test('explicit planetary aspects to angles retain exact proof scope; implicit harmony remains untyped',()=>{
  const f=transitFixture({transitBody:'Moon',natalPoint:'MC',aspectType:'trine'});
  assert.equal(validateTransit(f).ok,true);
  const statement='La Lune forme un trigone avec votre Milieu du Ciel.';
  assert.equal(validateTransit(f,statement).ok,true);
  assert.equal(simple([],statement).ok,false);
  assert.equal(detectAstrologicalTextFacts(statement).filter(f=>f.type==='ASPECT')[0].bodyB,'MC');
  assert.equal(detectAstrologicalTextFacts('La Lune, en harmonie avec votre Milieu du Ciel.').some(f=>f.type==='ASPECT'),false);
  assert.equal(validateTransit(f,f.block.deterministicPrefix.replace('entre le 6 octobre 2026','entre le 6 octobre 2099')).ok,false);
});
test('snapshot deterministic text uses the same dossier zone as transit dates',async()=>{
  const f=transitFixture();f.dossierEvidence.evidence.find(e=>e.type==='TRANSIT_SNAPSHOT').value.nowUtc='2026-12-31T23:30:00Z';
  const plan=buildFullDossierPlan(f.dossierEvidence).sections.find(s=>s.sectionId==='current_sky');
  const intro=plan.blockPlans.find(b=>b.deterministic);const scoped={...plan,blockPlans:[intro]};
  const result=await writeStructuredSectionWithLlm({dossierEvidence:f.dossierEvidence,sectionPlan:scoped,options:{structuredWriterFn:async()=>{throw Error('deterministic block must not call writer');}}});
  assert.match(result.section.blocks[0].text,/1er janvier 2027/);assert.equal(result.validation.ok,true);
});
test('invalid reference timezone is not silently replaced',()=>assert.throws(()=>transitFixture({timeZone:'invalid/timezone'}),RangeError));

test('calendar: fixed independent Paris day expectations across DST and New Year',()=>{
  for(const [utc,expected] of [
    ['2026-03-28T23:30:00Z',{year:2026,month:3,day:29}],
    ['2026-03-29T22:30:00Z',{year:2026,month:3,day:30}],
    ['2026-10-24T22:30:00Z',{year:2026,month:10,day:25}],
    ['2026-10-25T23:30:00Z',{year:2026,month:10,day:26}],
    ['2026-12-31T23:30:00Z',{year:2027,month:1,day:1}]
  ]) assert.deepEqual(calendarDate(utc,'Europe/Paris'),expected);
});
test('calendar: two contacts in a sentence cannot exchange their exact dates',()=>{
  const refs=[{type:'PERSONAL_TRANSIT',value:{transitBody:'Mercury',natalPoint:'Sun',aspectType:'sextile',exactAt:'2026-10-05T12:00:00Z'}},{type:'PERSONAL_TRANSIT',value:{transitBody:'Venus',natalPoint:'Moon',aspectType:'trine',exactAt:'2026-10-08T12:00:00Z'}}];
  const check=text=>validateAstrologicalDates({text,refs,timeZone:'Europe/Paris',aspectFacts:detectAstrologicalTextFacts});
  assert.equal(check('Mercure forme un sextile avec le Soleil, exact le 5 octobre 2026, et Vénus forme un trigone avec la Lune, exact le 8 octobre 2026.').length,0);
  assert.ok(check('Mercure forme un sextile avec le Soleil, exact le 8 octobre 2026, et Vénus forme un trigone avec la Lune, exact le 5 octobre 2026.').length>=2);
});
