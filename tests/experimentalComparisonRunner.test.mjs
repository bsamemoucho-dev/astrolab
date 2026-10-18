import assert from 'node:assert/strict';import test from 'node:test';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {runExperiment} from '../experiments/openai-claude/run.mjs';import {CLAUDE_MODEL} from '../experiments/openai-claude/providers.mjs';
test('comparison runner: refuses any request before human GO',async()=>{let calls=0;await assert.rejects(runExperiment({mode:'compare',approved:false,out:'/private/tmp/unused',fetchFn:()=>{calls++;}}),e=>e.code==='EXPLICIT_APPROVAL_REQUIRED');assert.equal(calls,0);});
test('comparison runner: interrupted operation blocks resume before provider contact',async t=>{const out=await mkdtemp(join(tmpdir(),'lastro-resume-'));t.after(()=>rm(out,{recursive:true,force:true}));await writeFile(join(out,'inflight.json'),'{"id":"unfinished"}');let calls=0;await assert.rejects(runExperiment({out,mode:'compare',approved:true,fetchFn:()=>{calls++;}}),e=>e.code==='INTERRUPTED_OPERATION_REQUIRES_REVIEW');assert.equal(calls,0);});
test('comparison runner: complete A/B/C simulation, shared evidence, blind HTML and safe resume',async t=>{
 const out=await mkdtemp(join(tmpdir(),'lastro-comparison-'));t.after(()=>rm(out,{recursive:true,force:true}));
 const previous={anthropic:process.env.ANTHROPIC_API_KEY,openai:process.env.ASTROLAB_LLM_API_KEY};process.env.ANTHROPIC_API_KEY='simulated-anthropic';process.env.ASTROLAB_LLM_API_KEY='simulated-openai';
 t.after(()=>{for(const [name,value] of [['ANTHROPIC_API_KEY',previous.anthropic],['ASTROLAB_LLM_API_KEY',previous.openai]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
 const calls=[];const fetchFn=async(url,request)=>{
  const b=request.body?JSON.parse(request.body):null;calls.push({url,body:b});
  if(url.includes('/models/'))return {ok:true,json:async()=>({id:CLAUDE_MODEL})};
  if(url.endsWith('count_tokens')||url.endsWith('input_tokens'))return {ok:true,json:async()=>({input_tokens:100})};
  const user=b.messages.find(m=>m.role==='user');const input=JSON.parse(user.content);let text;
  if(input.originalSections){text=JSON.stringify({sections:input.originalSections.map(s=>({sectionId:s.sectionId,blocks:s.blocks.map(x=>({blockId:x.blockId,text:'Une piste symbolique invite à réfléchir avec nuance.'}))}))});}
  else {assert.ok(input.sectionPlan);if(url.includes('anthropic'))assert.equal(user.content.includes('REPERE_REFERENCE_A'),false);text=JSON.stringify({sectionId:input.sectionPlan.sectionId,blocks:input.sectionPlan.blockPlans.map(x=>({blockId:x.blockId,text:url.includes('anthropic')?'Une piste symbolique indépendante invite à réfléchir avec nuance.':'Une piste symbolique REPERE_REFERENCE_A invite à réfléchir avec nuance.'}))});}
  return {ok:true,json:async()=>url.includes('anthropic')?{model:CLAUDE_MODEL,content:[{type:'text',text}],usage:{input_tokens:100,output_tokens:30},stop_reason:'end_turn'}:{model:b.model,choices:[{message:{content:text},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:30}}};
 };
 const planned=await runExperiment({out,mode:'plan',fetchFn});assert.equal(planned.paidCalls,0);assert.equal(calls.length,0);
 const first=await runExperiment({out,mode:'first',approved:true,fetchFn});assert.equal(first.status,'first_call_complete');assert.equal(calls.filter(c=>c.url.endsWith('/messages')).length,1);
 const finished=await runExperiment({out,mode:'compare',approved:true,fetchFn});assert.equal(finished.status,'comparison_complete');assert.ok(finished.budget.spentUsd<5);
 const mapping=JSON.parse(await readFile(join(out,'correspondance-secrete.json'),'utf8'));assert.deepEqual(Object.values(mapping).sort(),['A','B','C']);
 for(const label of ['X','Y','Z']){const html=await readFile(join(out,`Version-${label}.html`),'utf8');assert.ok(html.includes('<svg'));assert.equal(/gpt-|claude-sonnet|simulated-anthropic|simulated-openai/.test(html),false);}
 const metrics=JSON.parse(await readFile(join(out,'rapport-technique.json'),'utf8'));assert.equal(metrics.variants.C.calls,30);assert.equal(metrics.variants.B.calls,metrics.variants.A.calls+1);assert.ok(metrics.variants.B.words<=metrics.variants.A.words);
 const before=calls.filter(c=>c.url.endsWith('/messages')||c.url.endsWith('/chat/completions')).length;
 await runExperiment({out,mode:'compare',approved:true,fetchFn});assert.equal(calls.filter(c=>c.url.endsWith('/messages')||c.url.endsWith('/chat/completions')).length,before,'completed stages must not be regenerated');
});
