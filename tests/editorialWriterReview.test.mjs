import assert from "node:assert/strict";
import test from "node:test";
import {buildFullDossierPlan} from "../src/deliverables/fullDossierPlan.mjs";
import {buildStructuredSystemPrompt,buildStructuredUserPrompt,writeStructuredSectionWithLlm} from "../src/deliverables/structuredSectionWriter.mjs";

const evidence={schema:"astrolab.dossier_evidence",evidence:[{evidenceId:"natal.sun.sign",type:"NATAL_BODY_SIGN",value:{body:"Sun",sign:"Capricorn"}}]};
function plan(){return buildFullDossierPlan(evidence,{aspectChapterMode:"reference"}).sections.find(s=>s.sectionId==="identity");}
const tic="Vous pourriez réfléchir à ce qui vous importe. Vous pourriez considérer cette possibilité. Vous pourriez faire une place à cette nuance.";
const clear="Le symbole met l'accent sur la construction dans la durée.\n\nCette lecture laisse ouverte la manière dont le lecteur s'y reconnaît.";
const output=(p,text)=>({sectionId:p.sectionId,blocks:p.blockPlans.map(b=>({blockId:b.blockId,text}))});

test("editorial prompt does not manufacture a dilemma or duplicate every caveat",()=>{
 const system=buildStructuredSystemPrompt(plan());
 assert.doesNotMatch(system,/explore un dilemme concret|plusieurs façons possibles de le vivre/);
 assert.match(system,/N'impose ni dilemme ni conflit/);
 assert.match(system,/contraintes internes à appliquer/);
 assert.match(system,/Une explication courte et spécifique suffit/);
});
test("a single licensed hypothesis never requires inventing a second reading or a reader question",()=>{
 const p={...plan(),editorialPlan:{mission:"Test"},readingHypotheses:[{hypothesisId:"one",statement:"Lecture unique",questions:["Question préfabriquée ?"]}],blockPlans:plan().blockPlans.map(b=>({...b,maxQuestions:0}))};
 const system=buildStructuredSystemPrompt(p),user=JSON.parse(buildStructuredUserPrompt({sectionPlan:p}));
 assert.match(system,/Une seule hypothèse est transmise/);
 assert.doesNotMatch(system,/expose au moins deux lectures/);
 assert.deepEqual(user.editorial.hypotheses[0].questions,[]);
});
test("a measured stylistic tic gets one targeted correction and keeps the same closed evidence",async()=>{
 const p=plan(),seen=[],logs=[];
 const result=await writeStructuredSectionWithLlm({dossierEvidence:evidence,sectionPlan:p,options:{logger:{warn:(...x)=>logs.push(x)},structuredWriterFn:({sectionPlan,correctionIssues})=>{seen.push({sectionPlan,correctionIssues});return output(sectionPlan,seen.length===1?tic:clear);}}});
 assert.equal(seen.length,2);assert.ok(seen[1].correctionIssues.some(i=>i.source==="editorial_style" && i.textToRevise===tic));
 assert.deepEqual(seen[0].sectionPlan,seen[1].sectionPlan);
 assert.equal(result.validation.ok,true);assert.equal(result.section.blocks[0].text,clear);
 assert.doesNotMatch(JSON.stringify(logs),/réfléchir à ce qui|s'y reconnaît/);
});
test("a style issue is retained as a diagnostic after one revision, never amputated or looped",async()=>{
 const p=plan();let calls=0;const logs=[];
 const result=await writeStructuredSectionWithLlm({dossierEvidence:evidence,sectionPlan:p,options:{logger:{warn:(...x)=>logs.push(x)},structuredWriterFn:({sectionPlan})=>{calls++;return output(sectionPlan,tic);}}});
 assert.equal(calls,2);assert.equal(result.section.blocks[0].text,tic);
 assert.ok(logs.some(([,d])=>d?.action==="diagnostic_retained"));
});
test("an unauthorized fact in an editorial rewrite remains blocking and total attempts stay bounded",async()=>{
 let calls=0;
 await assert.rejects(writeStructuredSectionWithLlm({dossierEvidence:evidence,sectionPlan:plan(),options:{logger:{warn(){}},structuredWriterFn:({sectionPlan})=>{calls++;return output(sectionPlan,calls===1?tic:"Vénus en Lion est une donnée du thème.");}}}),e=>e.validation?.issues.some(i=>i.code==="undeclared_text_fact"));
 assert.equal(calls,3);
});
test("the real transport counts a stylistic correction in usage without another full dossier review",async()=>{
 let calls=0;const p=plan();
 const result=await writeStructuredSectionWithLlm({dossierEvidence:evidence,sectionPlan:p,options:{logger:{warn(){}},config:{apiKey:"fake-key",baseUrl:"https://offline.invalid/v1",model:"fake-model",fetchFn:async(_url,options)=>{calls++;const user=JSON.parse(JSON.parse(options.body).messages.find(m=>m.role==="user").content);return {ok:true,status:200,json:async()=>({model:"fake-model",choices:[{finish_reason:"stop",message:{content:JSON.stringify({sectionId:p.sectionId,blocks:[{blockId:user.sectionPlan.blockPlans[0].blockId,text:calls===1?tic:clear}]})}}],usage:{prompt_tokens:10,completion_tokens:20}})};}}}});
 assert.equal(calls,2);assert.equal(result.llmCalls,2);assert.equal(result.usage.promptTokens,20);assert.equal(result.usage.completionTokens,40);
});

test("server prefixes preserve the generated paragraph breaks",async()=>{
 const p=plan();p.blockPlans=p.blockPlans.map(b=>({...b,deterministicPrefix:"Le Soleil est en Capricorne."}));
 const result=await writeStructuredSectionWithLlm({dossierEvidence:evidence,sectionPlan:p,options:{structuredWriterFn:({sectionPlan})=>output(sectionPlan,clear)}});
 assert.equal(result.section.blocks[0].text,"Le Soleil est en Capricorne.\n\n"+clear);
});
