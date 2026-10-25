import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFullDossierPlan } from '../src/deliverables/fullDossierPlan.mjs';
import { editorialStyleCounters, editorialStyleFindings } from '../src/deliverables/editorialStyle.mjs';
import { buildStructuredUserPrompt, writeStructuredSectionWithLlm, writeStructuredSectionsWithLlm } from '../src/deliverables/structuredSectionWriter.mjs';

const evidence = {schema:'astrolab.dossier_evidence',evidence:[{evidenceId:'natal.sun.sign',type:'NATAL_BODY_SIGN',value:{body:'Sun',sign:'Capricorn'}}]};
const identity = () => buildFullDossierPlan(evidence,{aspectChapterMode:'reference'}).sections.find(section=>section.sectionId==='identity');
const output = (plan,text) => ({sectionId:plan.sectionId,blocks:plan.blockPlans.map(block=>({blockId:block.blockId,text}))});
const plain = 'Définir les étapes d’un engagement choisi donne une forme concrète à la construction dans la durée, sans présumer de la décision du lecteur.';
const lead = 'Par exemple, préciser les étapes d’un engagement choisi permet d’envisager la construction dans la durée sans attribuer une expérience au lecteur.';
const packets = plan => JSON.parse(buildStructuredUserPrompt({sectionPlan:plan})).sectionPlan.blockPlans[0].packets;

function promptPlan(ruleRefs, {narrativeRole=null,engine='composition'}={}) {
 const packet={packetId:'licensed',evidenceRefs:['aspect.sun.venus.conjunction'],interpretationRuleRefs:ruleRefs,interpretationDepth:'primary',themes:['Premier thème autorisé.','Deuxième thème autorisé.'],claims:[{claimId:'one',type:'NATAL_ASPECT',bodyA:'Sun',bodyB:'Venus',aspectType:'conjunction',evidenceRefs:['aspect.sun.venus.conjunction']}],...(narrativeRole?{narrativeRole}:{})};
 return {sectionId:'relationships',editorialEngine:engine,aspectChapterMode:'reference',evidencePackets:[packet],blockPlans:[{blockId:'one',packetRefs:['licensed']}],preconditions:[]};
}

test('one complete structured rule replaces its prewritten themes without changing facts or authority',()=>{
 const p=promptPlan(['western.natal.aspect.sun_venus.conjunction@1']);const copy=structuredClone(p);const sent=packets(p)[0];
 assert.ok(sent.semantics);assert.deepEqual(sent.themes,[]);assert.equal(sent.canInterpret,true);
 assert.deepEqual(sent.facts,[{type:'NATAL_ASPECT',bodyA:'Sun',bodyB:'Venus',aspectType:'conjunction'}]);
 assert.deepEqual(p,copy);
});

test('a legacy rule, mixed rule packet and role-specific subset retain their exact source themes',()=>{
 for(const p of [promptPlan(['western.body.sun.house.7@1']),promptPlan(['western.natal.aspect.sun_venus.conjunction@1','western.natal.aspect.sun_mars.sextile@1']),promptPlan(['western.natal.aspect.sun_venus.conjunction@1'],{narrativeRole:'resource'}),promptPlan(['western.natal.aspect.sun_venus.conjunction@1'],{engine:'legacy'})]) {
  const packet=packets(p)[0];assert.deepEqual(packet.themes,p.evidencePackets[0].themes);
 }
 const role=packets(promptPlan(['western.natal.aspect.sun_venus.conjunction@1'],{narrativeRole:'resource'}))[0];
 assert.equal(role.semantics,undefined,'a narrowed role must not receive the rule-wide semantic object');
});

test('an isolated secondary packet never receives semantics or themes from a structured rule',()=>{
 const p=promptPlan(['western.natal.aspect.sun_venus.conjunction@1']);p.evidencePackets[0].interpretationDepth='reference';
 const packet=packets(p)[0];assert.equal(packet.semantics,undefined);assert.deepEqual(packet.themes,[]);
});

test('style counters are numeric only and one concise illustration is not treated as a local tic',()=>{
 assert.deepEqual(editorialStyleCounters('PRIVATE_PERSON private@example.invalid. '+lead),{illustrationLeadCount:1});
 assert.equal(editorialStyleFindings(lead).length,0);
 const prompt=JSON.parse(buildStructuredUserPrompt({sectionPlan:{...identity(),editorialStyleMemory:{illustrationLeadCount:2,privateText:'HIDDEN_PRIVATE_FACT'}}}));
 assert.deepEqual(prompt.editorialStyleMemory,{illustrationLeadCount:2});
 assert.doesNotMatch(JSON.stringify(prompt),/HIDDEN_PRIVATE_FACT/);
});

test('a reused lead is measured across chapters without copying their prose or inventing a semantic score',()=>{
 const finding=editorialStyleFindings(lead,{previousIllustrationLeadCount:2}).find(f=>f.code==='editorial_repeated_illustration_lead');
 assert.deepEqual(finding.counts,{illustrationLeads:1,previousIllustrationLeads:2});
 assert.deepEqual(Object.keys(finding).sort(),['code','counts','message']);
 assert.doesNotMatch(JSON.stringify(finding),/engagement choisi|construction dans la durée/);
});

for(const text of ['Une manière possible de l’illustrer serait de préciser les étapes d’un engagement.','Dans un engagement hypothétique, le choix de ses étapes reste ouvert.','Une situation possible serait de distinguer deux choix.'])test('overexplained illustration framing is diagnosed: '+text,()=>{
 assert.ok(editorialStyleFindings(text).some(f=>f.code==='editorial_overexplained_illustration'));
});

for(const text of ['Dans votre dossier, cette lecture présente une distinction.','Donner une forme personnelle à cette attention est une ressource possible à explorer.'])test('process language is a stylistic diagnosis, never automatic deletion: '+text,async()=>{
 const before=text;let calls=0;
 const written=await writeStructuredSectionWithLlm({dossierEvidence:evidence,sectionPlan:identity(),options:{logger:{warn(){}},structuredWriterFn:({sectionPlan})=>{calls++;return output(sectionPlan,text);}}});
 assert.equal(calls,2);assert.equal(written.section.blocks[0].text,text);assert.equal(text,before);
});

test('the third repeated lead across chapters gets the existing bounded revision with the same facts',async()=>{
 const seen=[];const base=identity();
 const plans=['identity','communication','affectivity'].map(sectionId=>({...structuredClone(base),sectionId}));
 const written=await writeStructuredSectionsWithLlm({dossierEvidence:evidence,fullDossierPlan:{sections:plans},options:{logger:{warn(){}},structuredWriterFn:payload=>{
  seen.push({sectionId:payload.sectionPlan.sectionId,memory:JSON.parse(buildStructuredUserPrompt(payload)).editorialStyleMemory,refs:payload.sectionPlan.evidencePackets.flatMap(p=>p.evidenceRefs),issues:payload.correctionIssues});
  return output(payload.sectionPlan,payload.correctionIssues.length?plain:lead);
 }}});
 assert.equal(seen.length,4);assert.deepEqual(seen.map(s=>s.memory.illustrationLeadCount),[0,1,2,2]);
 assert.ok(seen[3].issues.some(i=>i.code==='editorial_repeated_illustration_lead'));
 assert.deepEqual(seen[2].refs,seen[3].refs);assert.equal(written.sections[2].blocks[0].text,plain);
});

test('a style rewrite cannot smuggle an unauthorized house and still has at most three attempts',async()=>{
 let calls=0;
 await assert.rejects(writeStructuredSectionWithLlm({dossierEvidence:evidence,sectionPlan:{...identity(),editorialStyleMemory:{illustrationLeadCount:2}},options:{logger:{warn(){}},structuredWriterFn:({sectionPlan})=>{calls++;return output(sectionPlan,calls===1?lead:'Le Soleil est en maison 5.');}}}),error=>error.validation?.issues.some(issue=>issue.code==='undeclared_text_fact'));
 assert.equal(calls,3);
});
