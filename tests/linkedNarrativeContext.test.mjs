import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFullDossierPlan } from '../src/deliverables/fullDossierPlan.mjs';
import { composeEditorialMaterial } from '../src/deliverables/editorialComposition.mjs';
import { aspectCategory } from '../src/deliverables/figures.mjs';
import { rulesForEvidence, ruleMatchesEvidence } from '../src/deliverables/interpretationRules.mjs';
import { validateStructuredSection } from '../src/deliverables/factualClaimsValidator.mjs';
import { buildStructuredUserPrompt, scopedSectionPlanForBlock, writeStructuredSectionWithLlm, writeStructuredSectionsWithLlm } from '../src/deliverables/structuredSectionWriter.mjs';

// Fictional evidence graph, without client identity, birth date or birthplace.
function fixture({ houses=true }={}) {
 const evidence=[];const add=(evidenceId,type,value)=>evidence.push({evidenceId,type,value});
 for(const [body,sign,house] of [['Sun','Capricorn',7],['Venus','Capricorn',7],['Mars','Scorpio',5],['Moon','Virgo',3],['Mercury','Sagittarius',6]]) {
  add(`natal.${body.toLowerCase()}.sign`,'NATAL_BODY_SIGN',{body,sign});
  if(houses)add(`natal.${body.toLowerCase()}.house`,'NATAL_BODY_HOUSE',{body,house,houseSystem:'WHOLE_SIGN'});
 }
 if(houses)add('angle.descendant.sign','ANGLE_SIGN',{angle:'descendant',sign:'Capricorn'});
 for(const [bodyA,bodyB,aspectType,orb] of [['Sun','Venus','conjunction',2],['Sun','Mars','sextile',0.4],['Venus','Mars','sextile',2.4],['Moon','Mercury','square',1]]) add(`aspect.${bodyA.toLowerCase()}.${bodyB.toLowerCase()}.${aspectType}`,'NATAL_ASPECT',{bodyA,bodyB,aspectType,orb,orbLimit:6});
 return {schema:'astrolab.dossier_evidence',referenceTimeZone:'Europe/Paris',evidence};
}
const planOf=evidence=>buildFullDossierPlan(evidence,{aspectChapterMode:'reference'});
const refsOf=section=>section.evidencePackets.flatMap(packet=>packet.evidenceRefs);
const result=(evidence,sectionPlan,text)=>validateStructuredSection({dossierEvidence:evidence,sectionPlan,section:{sectionId:sectionPlan.sectionId,blocks:sectionPlan.blockPlans.map((block,index)=>({blockId:block.blockId,text:index===0?text:'Une lecture symbolique reste ouverte.'}))}});

test('three linked aspects are retained as a network, not an invented classical figure',()=>{
 const material=composeEditorialMaterial({dossierEvidence:fixture(),rulesForEvidence});
 assert.equal(material.figures.length,0);
 assert.equal(material.linkedGroups.length,1);
 assert.equal(material.linkedGroups[0].evidenceRefs.length,3);
 assert.equal(material.linkedGroups[0].relationRefs.length,3);
 assert.ok(material.rejected.every(pair=>pair.evidenceRefs.includes('aspect.moon.mercury.square')));
});
for(const sectionId of ['general_synthesis','relationships','conclusion'])test(`${sectionId}: complete evidence and interpretation sources reach one composition block`,()=>{
 const evidence=fixture(),plan=planOf(evidence),section=plan.sections.find(section=>section.sectionId===sectionId);
 assert.equal(section.compositionMode,true);assert.equal(section.blockPlans.length,1);assert.equal(section.blockPlans[0].maxSentences,undefined);
 for(const ref of ['aspect.sun.venus.conjunction','aspect.sun.mars.sextile','aspect.venus.mars.sextile','natal.sun.house','natal.venus.house','natal.mars.house'])assert.ok(refsOf(section).includes(ref),`${sectionId} lacks ${ref}`);
 assert.equal(section.allowedRelations.length,3);
 const prompt=JSON.parse(buildStructuredUserPrompt({sectionPlan:scopedSectionPlanForBlock(section,section.blockPlans[0])}));
 const packets=prompt.sectionPlan.blockPlans[0].packets;
 assert.ok(packets.some(packet=>packet.facts.some(fact=>fact.type==='NATAL_ASPECT'&&fact.bodyA==='Venus'&&fact.bodyB==='Mars')&&packet.semantics));
 assert.equal(result(evidence,section,'Le Soleil forme une conjonction avec Vénus. Le Soleil forme un sextile avec Mars. Vénus forme un sextile avec Mars. Ces aspects se répondent.').ok,true);
});
test('Sun Venus conjunction is not presented as an inner tension; unknown conjunctions stay neutral',()=>{
 const plan=planOf(fixture()),tensions=plan.sections.find(section=>section.sectionId==='internal_tensions');
 assert.deepEqual(refsOf(tensions),['aspect.moon.mercury.square']);
 assert.equal(aspectCategory('conjunction',{bodyA:'Sun',bodyB:'Venus'}),'support');
 assert.equal(aspectCategory('conjunction',{bodyA:'Saturn',bodyB:'Mars'}),'tension');
 assert.equal(aspectCategory('conjunction',{bodyA:'Mercury',bodyB:'Sun'}),'integration');
 assert.equal(aspectCategory('conjunction'),'integration');
});
test('house and angle rules cannot borrow another house, body or angle',()=>{
 const evidence=fixture(),house=evidence.evidence.find(item=>item.evidenceId==='natal.sun.house'),rule=rulesForEvidence(house)[0];
 assert.ok(rule);assert.equal(ruleMatchesEvidence(rule,{...house,value:{...house.value,house:5}}),false);
 assert.equal(ruleMatchesEvidence(rule,{...house,value:{...house.value,body:'Venus'}}),false);
 const angle=evidence.evidence.find(item=>item.type==='ANGLE_SIGN'),angleRule=rulesForEvidence(angle)[0];assert.ok(angleRule);
 assert.equal(ruleMatchesEvidence(angleRule,{...angle,value:{...angle.value,angle:'ascendant'}}),false);
});
test('missing houses never get reconstructed for the relationships chapter',()=>{
 const plan=planOf(fixture({houses:false}));
 assert.ok(plan.sections.every(section=>section.evidencePackets.every(packet=>packet.claims.every(claim=>claim.type!=='NATAL_BODY_HOUSE'))));
 assert.ok(!plan.sections.find(section=>section.sectionId==='relationships').blockPlans.length);
});
test('a chapter without its own usable material is omitted instead of delivering 13 words',()=>{
 const plan=planOf(fixture()),section=plan.sections.find(section=>section.sectionId==='security_resources');
 assert.equal(section.unavailableReason,'no_distinct_interpretive_material');assert.deepEqual(section.blockPlans,[]);
});
test('the unconnected Moon Mercury square still cannot compensate the linked network',()=>{
 const evidence=fixture(),section=planOf(evidence).sections.find(section=>section.sectionId==='general_synthesis');
 const bad=result(evidence,section,'La Lune forme un carré avec Mercure. Le Soleil forme une conjonction avec Vénus. Ces deux aspects se compensent.');
 assert.equal(bad.ok,false);assert.ok(bad.issues.some(issue=>issue.code==='crossed_claim_not_licensed'));
 assert.ok(bad.issues.some(issue=>issue.code==='undeclared_text_fact'));
});
test('fabricated house remains a blocking factual error',()=>{
 const evidence=fixture(),section=planOf(evidence).sections.find(section=>section.sectionId==='relationships');
 assert.ok(result(evidence,section,'Mars en maison 7.').issues.some(issue=>issue.code==='undeclared_text_fact'));
});
test('question budgets and technical scaffolding are blocking; no question is required',()=>{
 const evidence=fixture(),section=planOf(evidence).sections.find(section=>section.sectionId==='relationships');
 assert.equal(result(evidence,section,'Une lecture symbolique laisse ouvertes plusieurs manières de vivre le lien.').ok,true);
 assert.equal(result(evidence,section,'Comment entretenir ce lien ?').ok,true);
 assert.ok(result(evidence,section,'Comment agir ? Comment aimer ?').issues.some(issue=>issue.code==='chapter_question_limit_exceeded'));
 for(const text of ['Une question utile serait : comment agir ?','Les éléments méthodologiques transmis ne permettent pas de développer cette lecture.'])assert.ok(result(evidence,section,text).issues.some(issue=>issue.code==='internal_editorial_scaffolding'));
});
test('the writer allows an optional question in one block only, across the chapter',async()=>{
 const evidence=fixture(),plan=planOf(evidence),section=plan.sections.find(section=>section.sectionId==='identity');const budgets=[];
 await writeStructuredSectionWithLlm({dossierEvidence:evidence,sectionPlan:section,options:{structuredWriterFn:async({sectionPlan})=>{budgets.push(sectionPlan.blockPlans[0].maxQuestions);return {sectionId:sectionPlan.sectionId,blocks:sectionPlan.blockPlans.map(block=>({blockId:block.blockId,text:'Une lecture ouverte.'}))};}}});
 assert.equal(budgets.reduce((a,b)=>a+b,0),1);
});
test('the conclusion receives prior text only when all block evidence is in scope',async()=>{
 const evidence=fixture(),plan=planOf(evidence);let recap;
 await writeStructuredSectionsWithLlm({dossierEvidence:evidence,fullDossierPlan:plan,options:{structuredWriterFn:async(payload)=>{
  if(payload.sectionPlan.sectionId==='conclusion')recap=JSON.parse(buildStructuredUserPrompt(payload)).chapterRecaps;
  return {sectionId:payload.sectionPlan.sectionId,blocks:payload.sectionPlan.blockPlans.map(block=>({blockId:block.blockId,text:payload.sectionPlan.sectionId==='relationships'?'Le lien demande de préserver une place pour l’initiative personnelle.':'Une lecture symbolique ouverte.'}))};
 },logger:{warn(){}}}});
 assert.ok(recap?.some(item=>item.sectionId==='relationships'&&item.text.includes('initiative personnelle')));
 assert.ok(!recap.some(item=>item.sectionId==='internal_tensions'));
});


test('a removed aspect is never reconstructed by the shared-body network',()=>{
 const evidence=fixture();evidence.evidence=evidence.evidence.filter(item=>item.evidenceId!=='aspect.sun.venus.conjunction');
 const material=composeEditorialMaterial({dossierEvidence:evidence,rulesForEvidence});
 assert.equal(material.linkedGroups[0].evidenceRefs.length,2);
 assert.ok(!material.configurations.some(config=>config.aspectType==='conjunction'));
 const section=planOf(evidence).sections.find(section=>section.sectionId==='general_synthesis');
 assert.ok(result(evidence,section,'Le Soleil forme une conjonction avec Vénus.').issues.some(issue=>issue.code==='undeclared_text_fact'));
});
test('a network with unknown houses cannot license a numbered house',()=>{
 const evidence=fixture({houses:false}),section=planOf(evidence).sections.find(section=>section.sectionId==='general_synthesis');
 assert.ok(result(evidence,section,'Le Soleil en maison 7.').issues.some(issue=>issue.code==='undeclared_text_fact'));
});


test('transitive membership never licenses an interaction between disjoint aspect endpoints',()=>{
 const evidence=fixture();evidence.evidence=evidence.evidence.filter(item=>!['aspect.sun.mars.sextile','aspect.venus.mars.sextile'].includes(item.evidenceId));
 evidence.evidence.push({evidenceId:'aspect.mercury.venus.sextile',type:'NATAL_ASPECT',value:{bodyA:'Mercury',bodyB:'Venus',aspectType:'sextile',orb:1,orbLimit:6}});
 const material=composeEditorialMaterial({dossierEvidence:evidence,rulesForEvidence});assert.equal(material.linkedGroups[0].evidenceRefs.length,3);
 const section=planOf(evidence).sections.find(section=>section.sectionId==='general_synthesis');
 const bad=result(evidence,section,'Le Soleil forme une conjonction avec Vénus. La Lune forme un carré avec Mercure. Ces deux aspects se répondent.');
 assert.ok(bad.issues.some(issue=>issue.code==='crossed_claim_not_licensed'));
});


test('the relationship chapter is the sole primary owner of its three linked aspects',()=>{
 const plan=planOf(fixture());
 for(const ref of ['aspect.sun.venus.conjunction','aspect.sun.mars.sextile','aspect.venus.mars.sextile']) {
  assert.deepEqual(plan.sections.filter(section=>section.primaryEvidenceRefs.includes(ref)).map(section=>section.sectionId),['relationships']);
  assert.equal(plan.ownerByEvidenceRef[ref],'relationships');
 }
});
