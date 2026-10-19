import assert from 'node:assert/strict';
import test from 'node:test';
import { callChatCompletions, completionTokenLimit, DEFAULT_MODEL } from '../src/deliverables/writers.mjs';
import { structuredSectionLlmConfiguration } from '../src/deliverables/structuredSectionWriter.mjs';
import { estimateUsageCost, priceForModel } from '../src/deliverables/cost.mjs';
import { isTruncatedCompletion } from '../src/deliverables/generationLimits.mjs';
import { estimateCallCostUsd } from '../src/deliverables/llmBudget.mjs';
const response = (overrides={}) => ({model:DEFAULT_MODEL,choices:[{message:{content:'{"sectionId":"identity","blocks":[]}'},finish_reason:'stop'}],usage:{prompt_tokens:1200,completion_tokens:900,total_tokens:2100,completion_tokens_details:{reasoning_tokens:700}},...overrides});
function config(fetchFn){return {model:DEFAULT_MODEL,baseUrl:'https://example.invalid/v1',apiKey:'test-only',fetchFn};}

test('Sol: every narrative chapter uses the same configured model',()=>{
 for(const sectionId of ['identity','current_sky','next_weeks','general_synthesis','relational_communication','relational_affection']) assert.equal(structuredSectionLlmConfiguration({sectionId},config(()=>{})).model,DEFAULT_MODEL);
 assert.equal(DEFAULT_MODEL,'gpt-6.1-sol');
});
test('Sol: compatible request, JSON mode, bounded reasoning headroom, no temperature',async()=>{
 let calls=0;
 const result=await callChatCompletions(config(async(url,request)=>{
  calls++;assert.equal(url,'https://example.invalid/v1/chat/completions');const body=JSON.parse(request.body);
  assert.equal(body.model,DEFAULT_MODEL);assert.equal(body.reasoning_effort,'low');assert.equal(body.temperature,undefined);assert.equal(body.max_tokens,undefined);assert.equal(body.max_completion_tokens,9392);assert.equal(body.store,false);assert.deepEqual(body.response_format,{type:'json_object'});
  return {ok:true,json:async()=>response()};
 }),{system:'Write JSON',user:'Fictive facts only',maxTokens:1200,responseFormat:{type:'json_object'},temperature:0.35});
 assert.equal(calls,1);assert.equal(result.usage.completionTokens,900);assert.equal(result.usage.reasoningTokens,700);assert.equal(result.finishReason,'stop');assert.deepEqual(JSON.parse(result.text).blocks,[]);
 assert.equal(estimateUsageCost(DEFAULT_MODEL,1200,900).usd,0.0114);
});
test('Sol: a reasoning-only truncated response remains identifiable and accounted for',async()=>{
 const result=await callChatCompletions(config(async()=>({ok:true,json:async()=>response({choices:[{message:{content:''},finish_reason:'length'}]})})),{system:'JSON',user:'fixture',maxTokens:900});
 assert.equal(result.usage.completionTokens,900);assert.equal(isTruncatedCompletion({text:result.text,finishReason:result.finishReason}),true);
});
for(const [name,data,code] of [
 ['wrong model',response({model:'gpt-4o-mini'}),'llm_model_mismatch'],
 ['unconfirmed model',response({model:undefined}),'llm_model_mismatch'],
 ['missing usage',response({usage:null}),'llm_usage_unavailable'],
 ['refusal',response({choices:[{message:{content:'',refusal:'refused'},finish_reason:'stop'}]}),'llm_refusal'],
 ['empty answer',response({choices:[{message:{content:''},finish_reason:'stop'}]}),'llm_empty_response']
])test(`Sol: ${name} fails explicitly without retry or fallback`,async()=>{
 let calls=0;await assert.rejects(callChatCompletions(config(async()=>{calls++;return {ok:true,json:async()=>data};}),{system:'JSON',user:'fixture',maxTokens:900}),e=>e.code===code);assert.equal(calls,1);
});
test('Sol: unavailable model is explicit and never retried on another model',async()=>{
 let calls=0;await assert.rejects(callChatCompletions(config(async()=>{calls++;return {ok:false,status:404,text:async()=>'model unavailable'};}),{system:'JSON',user:'fixture'}),e=>e.code==='llm_model_unavailable');assert.equal(calls,1);
});
test('Sol: interrupted transport makes one request only',async()=>{
 let calls=0;await assert.rejects(callChatCompletions(config(async()=>{calls++;throw Object.assign(new Error('interrupted'),{code:'ECONNRESET'});}),{system:'JSON',user:'fixture'}),e=>e.code==='ECONNRESET');assert.equal(calls,1);
});
test('Sol: spend estimate includes reasoning reserve at the official output price',()=>{
 assert.deepEqual(priceForModel(DEFAULT_MODEL),{in:2,out:10});
 assert.equal(completionTokenLimit(DEFAULT_MODEL,2000),10192);
 const estimate=estimateCallCostUsd({model:DEFAULT_MODEL,promptChars:4000,promptTokensUpperBound:4064,outputTokens:10192});
 assert.equal(estimate.promptTokens,4064);assert.equal(estimate.usd,0.110048);
});
