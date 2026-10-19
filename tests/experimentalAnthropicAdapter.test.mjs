import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {BudgetLedger} from '../experiments/openai-claude/budgetGuard.mjs';
import {anthropicAdapter,CLAUDE_MODEL,FIRST_CALL_MAX_USD,meteredProvider} from '../experiments/openai-claude/providers.mjs';
const payload={system:'Répondre en JSON.',messages:[{role:'user',content:'Thème entièrement fictif.'}]};
async function setup(t,scenario='ok',ceilingUsd=2) {
  const prior=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY='synthetic-test-key';t.after(()=>{if(prior===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=prior;});
  const directory=await mkdtemp(join(tmpdir(),'lastro-anthropic-'));t.after(()=>rm(directory,{recursive:true,force:true}));const path=join(directory,'ledger.json');const calls=[];
  const fetchFn=async(url,options)=>{const body=options.body?JSON.parse(options.body):null;calls.push({url,body});assert.equal(options.headers['x-api-key'],'synthetic-test-key');assert.equal(options.redirect,'error');
    if(url.endsWith('/'+CLAUDE_MODEL))return {ok:true,json:async()=>({id:CLAUDE_MODEL})};
    if(url.endsWith('count_tokens'))return {ok:true,json:async()=>({input_tokens:scenario==='huge'?50000:100})};
    assert.equal(body.thinking.type,'between_tools');assert.equal(body.output_config.effort,'high');assert.equal(body.max_tokens,900);assert.equal('temperature' in body,false);
    if(scenario==='failed')return {ok:false,status:429};if(scenario==='interrupted')throw Error('secret-provider-detail');
    return {ok:true,json:async()=>scenario==='broken-json'?Promise.reject(Error('body truncated')):({model:CLAUDE_MODEL,content:[{type:'text',text:'{}'}],usage:scenario==='no-usage'?null:{input_tokens:100,output_tokens:scenario==='truncated'?900:30},stop_reason:scenario==='truncated'?'max_tokens':'end_turn'})};
  };
  const ledger=new BudgetLedger(path,{approved:true,ceilingUsd});const adapter=anthropicAdapter({approved:true,fetchFn});return {ledger,path,adapter,calls,invoke:()=>meteredProvider({ledger,adapter,model:CLAUDE_MODEL,id:'first',payload,outputLimit:900,maximumCallUsd:FIRST_CALL_MAX_USD})};
}
test('Anthropic: official count and Messages endpoints, measured successful call',async t=>{const f=await setup(t);assert.equal((await f.adapter.availability()).id,CLAUDE_MODEL);const r=await f.invoke();assert.equal(r.accounting.actualUsd,0.0005);assert.equal((await f.ledger.snapshot()).calls,1);assert.equal(f.calls.filter(c=>c.url.endsWith('/messages')).length,1);});
test('Anthropic: anticipated global budget overrun makes zero generation requests',async t=>{const f=await setup(t,'ok',0.001);await assert.rejects(f.invoke(),e=>e.code==='BUDGET_INSUFFICIENT');assert.equal(f.calls.some(c=>c.url.endsWith('/messages')),false);});
test('Anthropic: first single-call ceiling is checked before generating',async t=>{const f=await setup(t,'huge');await assert.rejects(f.invoke(),e=>e.code==='CALL_MAXIMUM_EXCEEDED');assert.equal(f.calls.some(c=>c.url.endsWith('/messages')),false);});
for(const scenario of ['interrupted','failed','no-usage','broken-json'])test(`Anthropic: ${scenario} freezes reservation without retry`,async t=>{const f=await setup(t,scenario);await assert.rejects(f.invoke());assert.equal(f.calls.filter(c=>c.url.endsWith('/messages')).length,1);assert.equal((await f.ledger.snapshot()).unresolved,1);const restart=new BudgetLedger(f.path,{approved:true});await assert.rejects(restart.reserve({id:'retry',model:CLAUDE_MODEL,inputLimit:100,outputLimit:900}),e=>e.code==='UNRESOLVED_CALL_BLOCKS_SPENDING');});
test('Anthropic: interrupted output with trustworthy usage is charged and rejected',async t=>{const f=await setup(t,'truncated');await assert.rejects(f.invoke(),e=>e.code==='TRUNCATED_RESPONSE');assert.equal((await f.ledger.snapshot()).spentUsd,0.0092);});
test('Anthropic: no authorization means no real or simulated request',async()=>{let calls=0;const adapter=anthropicAdapter({fetchFn:async()=>{calls++;}});await assert.rejects(adapter.countInput({model:CLAUDE_MODEL,payload}),e=>e.code==='EXPLICIT_APPROVAL_REQUIRED');assert.equal(calls,0);});
