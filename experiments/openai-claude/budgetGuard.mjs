// Experimental only. This module never imports an SDK, loads secrets, or opens a network connection.
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
const NANO_PER_USD = 1_000_000_000n;
const MAX_BUDGET = 5n * NANO_PER_USD;
// USD/M tokens -> nanodollars/token. Standard uncached prices verified 2026-10-18.
const PRICES = Object.freeze({ 'gpt-4o-mini': [150n,600n], 'gpt-4.1-mini': [400n,1600n], 'claude-sonnet-5-5': [2000n,10000n] });
const PRICE_VERSION = '2026-10-18-standard-global-no-tools';
const CACHE_READ = {'gpt-4o-mini':75n,'gpt-4.1-mini':100n,'claude-sonnet-5-5':100n};
function failure(code) { return Object.assign(new Error(code), { code }); }
function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw failure('INVALID_TOKEN_COUNT');
  return BigInt(value);
}
function cost(model,input,output) {
  const rate=PRICES[model];if(!rate)throw failure('UNKNOWN_MODEL_PRICE');
  return count(input)*rate[0]+count(output)*rate[1];
}
function actualCost(model,input,output,cached=0) {
  count(cached);if(cached>input)throw failure('INVALID_CACHED_TOKEN_COUNT');
  return cost(model,input-cached,output)+count(cached)*CACHE_READ[model];
}
function safeId(id) { if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id ?? ''))throw failure('INVALID_CALL_ID'); }
function validateState(state) {
  if(state?.version!==1||state.priceVersion!==PRICE_VERSION||!Array.isArray(state.calls))throw failure('INVALID_BUDGET_LEDGER');
  if(BigInt(state.ceilingNano)<=0n||BigInt(state.ceilingNano)>MAX_BUDGET)throw failure('INVALID_BUDGET_CEILING');
  const ids=new Set();
  for(const call of state.calls){safeId(call.id);if(ids.has(call.id))throw failure('INVALID_BUDGET_LEDGER');ids.add(call.id);
    if(!['reserved','settled','uncertain'].includes(call.status)||BigInt(call.reservedNano)!==cost(call.model,call.inputLimit,call.outputLimit))throw failure('INVALID_BUDGET_LEDGER');
    if(call.status==='settled' && (BigInt(call.actualNano)!==actualCost(call.model,call.actualInput,call.actualOutput,call.actualCached??0)||BigInt(call.actualNano)>BigInt(call.reservedNano)))throw failure('INVALID_BUDGET_LEDGER');
  }
}
function totals(state) {
  let spent=0n,reserved=0n;
  for(const c of state.calls){if(c.status==='settled')spent+=BigInt(c.actualNano);else reserved+=BigInt(c.reservedNano);}
  return {spent,reserved,remaining:BigInt(state.ceilingNano)-spent-reserved};
}
export class BudgetLedger {
  constructor(path,{approved=false,ceilingUsd=5}={}) {
    if(!Number.isFinite(ceilingUsd)||ceilingUsd<=0||ceilingUsd>5||!Number.isSafeInteger(ceilingUsd*1e9))throw failure('INVALID_BUDGET_CEILING');
    this.path=path;this.approved=approved;this.ceilingNano=String(Math.round(ceilingUsd*1e9));
  }
  async transaction(fn) {
    await mkdir(dirname(this.path),{recursive:true,mode:0o700});
    let lock;
    try{lock=await open(this.path+'.lock','wx',0o600);}catch(e){if(e.code==='EEXIST')throw failure('BUDGET_LOCKED');throw e;}
    try {
      let state;
      try {state=JSON.parse(await readFile(this.path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw failure('INVALID_BUDGET_LEDGER');state={version:1,priceVersion:PRICE_VERSION,ceilingNano:this.ceilingNano,calls:[]};}
      validateState(state);
      if(state.ceilingNano!==this.ceilingNano)throw failure('BUDGET_CEILING_CHANGED');
      const value=await fn(state);
      validateState(state);
      const temp=this.path+'.'+randomUUID()+'.tmp';
      const file=await open(temp,'wx',0o600);
      try{await file.writeFile(JSON.stringify(state,null,2)+'\n');await file.sync();}finally{await file.close();}
      await rename(temp,this.path);
      // Persist the rename before any transport can be called.
      const dir=await open(dirname(this.path),'r');try{await dir.sync();}finally{await dir.close();}
      return value;
    }finally{await lock.close();await unlink(this.path+'.lock');}
  }
  async reserve({id,model,inputLimit,outputLimit}) {
    if(!this.approved)throw failure('EXPLICIT_APPROVAL_REQUIRED');safeId(id);
    if(!Number.isSafeInteger(outputLimit)||outputLimit<=0)throw failure('INVALID_OUTPUT_LIMIT');
    const maximum=cost(model,inputLimit,outputLimit);
    return this.transaction(state=>{
      if(state.calls.some(c=>c.id===id))throw failure('CALL_ALREADY_RECORDED');
      if(state.calls.some(c=>c.status!=='settled'))throw failure('UNRESOLVED_CALL_BLOCKS_SPENDING');
      const t=totals(state);if(maximum>t.remaining)throw failure('BUDGET_INSUFFICIENT');
      state.calls.push({id,model,inputLimit,outputLimit,reservedNano:String(maximum),status:'reserved'});
      return {id,maximumUsd:Number(maximum)/1e9,remainingAfterReservationUsd:Number(t.remaining-maximum)/1e9};
    });
  }
  async settle({id,model,inputTokens,outputTokens,cachedInputTokens=0}) {
    safeId(id);
    return this.transaction(state=>{
      const call=state.calls.find(c=>c.id===id);if(!call||call.status==='settled')throw failure('NO_PENDING_RESERVATION');
      if(model!==call.model)throw failure('RESPONSE_MODEL_MISMATCH');
      count(inputTokens);count(outputTokens);
      if(inputTokens>call.inputLimit||outputTokens>call.outputLimit)throw failure('USAGE_EXCEEDS_RESERVATION');
      const actual=actualCost(model,inputTokens,outputTokens,cachedInputTokens);
      Object.assign(call,{status:'settled',actualInput:inputTokens,actualOutput:outputTokens,actualCached:cachedInputTokens,actualNano:String(actual)});
      return {actualUsd:Number(actual)/1e9,remainingUsd:Number(totals(state).remaining)/1e9};
    });
  }
  async uncertain(id) {
    safeId(id);return this.transaction(state=>{const call=state.calls.find(c=>c.id===id);if(!call||call.status==='settled')throw failure('NO_PENDING_RESERVATION');call.status='uncertain';});
  }
  async snapshot() {return this.transaction(state=>{const t=totals(state);return {spentUsd:Number(t.spent)/1e9,reservedUsd:Number(t.reserved)/1e9,remainingUsd:Number(t.remaining)/1e9,calls:state.calls.length,unresolved:state.calls.filter(c=>c.status!=='settled').length};});}
}
// Provider adapters must supply a measured counter and honor outputLimit. No retry
// exists here. An ambiguous failure keeps the full reservation and blocks resume.
export async function budgetedCall({ledger,id,model,payload,outputLimit,countInput,transport,maximumCallUsd=5,onEstimate=()=>{}}) {
  if(!ledger.approved)throw failure('EXPLICIT_APPROVAL_REQUIRED');
  if(typeof countInput!=='function'||typeof transport!=='function')throw failure('MISSING_BUDGET_PROTECTION');
  if(!PRICES[model])throw failure('UNKNOWN_MODEL_PRICE');
  const unbudgeted = new Set(['tools','cache_control','service_tier','inference_geo','speed','thinking','betas']);
  function checkFeatures(value) {
    if(!value || typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){if(unbudgeted.has(key))throw failure('UNBUDGETED_FEATURE');checkFeatures(child);}
  }
  checkFeatures(payload);
  const measured=await countInput({model,payload});
  if(!['provider_count','local_tokenizer'].includes(measured?.source))throw failure('UNVERIFIED_TOKEN_ESTIMATE');
  count(measured.inputTokens);count(measured.allowanceTokens);
  const inputLimit=measured.inputTokens+measured.allowanceTokens;
  count(inputLimit);
  if(!Number.isFinite(maximumCallUsd)||maximumCallUsd<=0||Number(cost(model,inputLimit,outputLimit))/1e9>maximumCallUsd)throw failure('CALL_MAXIMUM_EXCEEDED');
  const reservation=await ledger.reserve({id,model,inputLimit,outputLimit});
  let settled=false;
  try {
    await onEstimate({...reservation,inputLimit,outputLimit,model});
    const response=await transport({model,payload,maxOutputTokens:outputLimit});
    if(!response?.usage)throw failure('UNMETERED_RESPONSE');
    const accounting=await ledger.settle({id,model:response.model,inputTokens:response.usage.inputTokens,outputTokens:response.usage.outputTokens,cachedInputTokens:response.usage.cachedInputTokens??0});
    settled=true;
    if(response.stopReason==='max_tokens'||response.truncated)throw Object.assign(failure('TRUNCATED_RESPONSE'),{accounting});
    return {response,accounting};
  }catch(error){if(!settled)await ledger.uncertain(id);throw error;}
}
