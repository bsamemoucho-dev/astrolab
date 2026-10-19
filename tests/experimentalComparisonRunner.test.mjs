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
  assert.equal(b.max_tokens,input.originalSections?30000:url.includes('anthropic')?1600:900);
  if(input.originalSections){text=JSON.stringify({sections:input.originalSections.map(s=>({sectionId:s.sectionId,blocks:s.blocks.map(x=>({blockId:x.blockId,text:'Une piste symbolique invite à réfléchir avec nuance.'}))}))});}
  else {assert.ok(input.sectionPlan);if(url.includes('anthropic'))assert.equal(user.content.includes('REPERE_REFERENCE_A'),false);text=JSON.stringify({sectionId:input.sectionPlan.sectionId,blocks:input.sectionPlan.blockPlans.map(x=>({blockId:x.blockId,text:url.includes('anthropic')?'Une piste symbolique indépendante invite à réfléchir avec nuance.':'Une piste symbolique REPERE_REFERENCE_A invite à réfléchir avec nuance.'}))});}
  return {ok:true,json:async()=>url.includes('anthropic')?{model:CLAUDE_MODEL,content:[{type:'text',text}],usage:{input_tokens:100,output_tokens:30},stop_reason:'end_turn'}:{model:b.model,choices:[{message:{content:text},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:30}}};
 };
 const planned=await runExperiment({out,mode:'plan',fetchFn});assert.equal(planned.maximumTotalUsd,2);assert.equal(planned.firstCallMaximumUsd,0.06);assert.equal(planned.firstOutputLimit,1600);assert.equal(planned.paidCalls,0);assert.equal(calls.length,0);
 const first=await runExperiment({out,mode:'first',approved:true,fetchFn});assert.equal(first.status,'first_call_complete');assert.equal(calls.filter(c=>c.url.endsWith('/messages')).length,1);
 const finished=await runExperiment({out,mode:'compare',approved:true,fetchFn});assert.equal(finished.status,'comparison_complete');assert.ok(finished.budget.spentUsd<2);
 const mapping=JSON.parse(await readFile(join(out,'correspondance-secrete.json'),'utf8'));assert.deepEqual(Object.values(mapping).sort(),['A','B','C']);
 for(const label of ['X','Y','Z']){const html=await readFile(join(out,`Version-${label}.html`),'utf8');assert.ok(html.includes('<svg'));assert.equal(/gpt-|claude-sonnet|simulated-anthropic|simulated-openai/.test(html),false);}
 const metrics=JSON.parse(await readFile(join(out,'rapport-technique.json'),'utf8'));assert.equal(metrics.variants.C.calls,30);assert.equal(metrics.variants.B.calls,metrics.variants.A.calls+1);assert.ok(metrics.variants.B.words<=metrics.variants.A.words);
 const before=calls.filter(c=>c.url.endsWith('/messages')||c.url.endsWith('/chat/completions')).length;
 await runExperiment({out,mode:'compare',approved:true,fetchFn});assert.equal(calls.filter(c=>c.url.endsWith('/messages')||c.url.endsWith('/chat/completions')).length,before,'completed stages must not be regenerated');
});

for(const scenario of ['truncated','interrupted'])test(`comparison runner: ${scenario} saves known costs without retry or unsafe resume`,async t=>{
 const out=await mkdtemp(join(tmpdir(),'lastro-first-failure-'));t.after(()=>rm(out,{recursive:true,force:true}));
 const old=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY='simulated-key';t.after(()=>{if(old===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=old;});
 let messages=0;const fetchFn=async(url,request)=>{
  if(url.includes('/models/'))return {ok:true,json:async()=>({id:CLAUDE_MODEL})};
  if(url.endsWith('count_tokens'))return {ok:true,json:async()=>({input_tokens:2573})};
  messages++;const body=JSON.parse(request.body);assert.equal(body.max_tokens,1600);
  if(scenario==='interrupted')throw Error('network interruption');
  return {ok:true,json:async()=>({model:CLAUDE_MODEL,content:[{type:'text',text:'{"sections": [unfinished private content'}],usage:{input_tokens:2573,output_tokens:1600},stop_reason:'max_tokens'})};
 };
 await assert.rejects(runExperiment({out,mode:'first',approved:true,fetchFn}),e=>e.code===(scenario==='truncated'?'TRUNCATED_RESPONSE':'PROVIDER_REQUEST_INTERRUPTED'));assert.equal(messages,1);
 const budget=JSON.parse(await readFile(join(out,'budget.json'),'utf8'));assert.equal(budget.calls.length,1);const id=budget.calls[0].id;
 if(scenario==='truncated'){
  assert.equal(budget.calls[0].status,'settled');assert.equal(budget.calls[0].actualNano,'21146000');
  const saved=JSON.parse(await readFile(join(out,id+'.json'),'utf8'));assert.equal(saved.outcome,'truncated');assert.equal(saved.response.text,'{"sections": [unfinished private content');assert.equal(saved.accounting.actualUsd,0.021146);
  const metrics=JSON.parse(await readFile(join(out,'calls.json'),'utf8'));assert.equal(metrics.length,1);assert.equal(metrics[0].outcome,'truncated');assert.equal(metrics[0].costUsd,0.021146);
  await assert.rejects(readFile(join(out,'inflight.json')),e=>e.code==='ENOENT');await assert.rejects(readFile(join(out,'C-progress.json')),e=>e.code==='ENOENT');
 }else {
  assert.equal(budget.calls[0].status,'uncertain');assert.ok(await readFile(join(out,'inflight.json')));
  await assert.rejects(runExperiment({out,mode:'first',approved:true,fetchFn}),e=>e.code==='INTERRUPTED_OPERATION_REQUIRES_REVIEW');assert.equal(messages,1);
 }
});
