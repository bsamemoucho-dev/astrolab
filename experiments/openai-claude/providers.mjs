// Isolated adapters for the official Anthropic REST API and the reference OpenAI API.
// No credentials are accepted as arguments or read from files. No automatic retry.
import { budgetedCall } from './budgetGuard.mjs';
export const CLAUDE_MODEL = 'claude-sonnet-5-5';
// Borne du premier appel payant. L'estimation est volontairement pessimiste
// (octets du payload + 4 Ko). La couche éditoriale (plan, missions, relations)
// ajoute ~1,8 Ko au premier appel de « general_synthesis » : 0,04 USD devenait
// une fausse barrière (0,043 estimés pour un appel réel ~0,02 USD).
export const FIRST_CALL_MAX_USD = 0.06;
export const CLAUDE_BLOCK_OUTPUT_LIMIT = 1600;
export const FIRST_CALL_OUTPUT_LIMIT = CLAUDE_BLOCK_OUTPUT_LIMIT;
const fail = code => Object.assign(new Error(code), {code});
function tokens(value) { if(!Number.isSafeInteger(value)||value<0)throw fail('UNRELIABLE_USAGE');return value; }
async function request(fetchFn,url,headers,body) {
  let response;
  try {response=await fetchFn(url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});}catch{throw fail('PROVIDER_REQUEST_INTERRUPTED');}
  if(!response.ok)throw fail(`PROVIDER_HTTP_${response.status}`);
  try{return await response.json();}catch{throw fail('PROVIDER_RESPONSE_INTERRUPTED');}
}
function credential(name,approved) {
  if(!approved)throw fail('EXPLICIT_APPROVAL_REQUIRED');
  const value=process.env[name]?.trim();if(!value)throw fail(`MISSING_${name}`);return value;
}
function conservativeCount(inputTokens,payload) {
  tokens(inputTokens);
  // Metered provider count plus a conservative text-byte bound for wire-format overhead.
  // This is not a byte-ratio approximation substituted for real token counting.
  const upper=Math.max(inputTokens+1024,Buffer.byteLength(JSON.stringify(payload),'utf8')+4096);
  return {inputTokens,allowanceTokens:upper-inputTokens,source:'provider_count'};
}
export function anthropicAdapter({approved=false,fetchFn=globalThis.fetch}={}) {
  const headers=()=>({'content-type':'application/json','anthropic-version':'2023-06-01','x-api-key':credential('ANTHROPIC_API_KEY',approved)});
  const wire=(model,payload)=>({model,system:payload.system,messages:payload.messages,thinking:{type:'between_tools'},output_config:{effort:'high'}});
  return {
    async availability() {
      const info=await request(fetchFn,`https://api.anthropic.com/v1/models/${CLAUDE_MODEL}`,headers());
      if(info.id!==CLAUDE_MODEL||info.lifecycle==='retired')throw fail('CLAUDE_MODEL_UNAVAILABLE');return {id:info.id};
    },
    async countInput({model,payload}) {
      if(model!==CLAUDE_MODEL)throw fail('UNEXPECTED_CLAUDE_MODEL');
      const result=await request(fetchFn,'https://api.anthropic.com/v1/messages/count_tokens',headers(),wire(model,payload));
      return conservativeCount(result.input_tokens,wire(model,payload));
    },
    async transport({model,payload,maxOutputTokens}) {
      if(model!==CLAUDE_MODEL)throw fail('UNEXPECTED_CLAUDE_MODEL');
      const result=await request(fetchFn,'https://api.anthropic.com/v1/messages',headers(),{...wire(model,payload),max_tokens:maxOutputTokens,stream:false});
      if(result.model!==model)throw fail('RESPONSE_MODEL_MISMATCH');
      if(!result.usage||result.usage.cache_creation_input_tokens)throw fail('UNRELIABLE_OR_UNSUPPORTED_USAGE');
      const cachedInputTokens=tokens(result.usage.cache_read_input_tokens??0);
      const inputTokens=tokens(result.usage.input_tokens)+cachedInputTokens,outputTokens=tokens(result.usage.output_tokens);
      return {model,billedModel:result.model,text:(result.content??[]).filter(b=>b.type==='text').map(b=>b.text).join(''),usage:{inputTokens,outputTokens,cachedInputTokens},stopReason:result.stop_reason,truncated:result.stop_reason!=='end_turn'};
    }
  };
}
const OPENAI_SNAPSHOTS={'gpt-4o-mini':'gpt-4o-mini-2024-07-18','gpt-4.1-mini':'gpt-4.1-mini-2025-04-14'};
export function openaiAdapter({approved=false,fetchFn=globalThis.fetch}={}) {
  const headers=()=>({'content-type':'application/json',authorization:`Bearer ${credential('ASTROLAB_LLM_API_KEY',approved)}`});
  return {
    async countInput({model,payload}) {
      if(!OPENAI_SNAPSHOTS[model])throw fail('UNEXPECTED_OPENAI_MODEL');
      const counted=await request(fetchFn,'https://api.openai.com/v1/responses/input_tokens',headers(),{model,input:payload.messages});
      return conservativeCount(counted.input_tokens,payload);
    },
    async transport({model,payload,maxOutputTokens}) {
      const result=await request(fetchFn,'https://api.openai.com/v1/chat/completions',headers(),{model,...payload,max_tokens:maxOutputTokens,stream:false});
      if(result.model!==model&&result.model!==OPENAI_SNAPSHOTS[model])throw fail('RESPONSE_MODEL_MISMATCH');
      const u=result.usage;if(!u)throw fail('UNRELIABLE_USAGE');
      return {model,billedModel:result.model,text:result.choices?.[0]?.message?.content??'',usage:{inputTokens:tokens(u.prompt_tokens),outputTokens:tokens(u.completion_tokens),cachedInputTokens:tokens(u.prompt_tokens_details?.cached_tokens??0)},stopReason:result.choices?.[0]?.finish_reason,truncated:result.choices?.[0]?.finish_reason!=='stop'};
    }
  };
}
export function toAnthropicPayload(body) {
  const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  const messages=body.messages.filter(m=>m.role!=='system').map(m=>({role:m.role,content:m.content}));
  return {system,messages};
}
export function meteredProvider({ledger,adapter,model,id,payload,outputLimit=900,maximumCallUsd,onEstimate}) {
  return budgetedCall({ledger,id,model,payload,outputLimit,maximumCallUsd,countInput:adapter.countInput,transport:adapter.transport,onEstimate});
}
