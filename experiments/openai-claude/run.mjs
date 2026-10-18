// Local-only comparison. Default mode plans offline; --allow-paid requires prior human GO.
import { readFile,writeFile,mkdir,open,unlink,rename } from 'node:fs/promises';
import { resolve,join,relative } from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { createHash,randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildSyntheticFixture,syntheticInput,nowUtc } from './fixture.mjs';
import { BudgetLedger } from './budgetGuard.mjs';
import { anthropicAdapter,openaiAdapter,CLAUDE_MODEL,FIRST_CALL_MAX_USD,meteredProvider,toAnthropicPayload } from './providers.mjs';
import { reviewRevision,blindAssignment,wordCount } from './editorialProtocol.mjs';
import { writeStructuredSectionWithLlm } from '../../src/deliverables/structuredSectionWriter.mjs';
import { validateStructuredSections } from '../../src/deliverables/factualClaimsValidator.mjs';
import { renderDossierHtml,annexSections } from '../../src/deliverables/render.mjs';
import { buildSocle } from '../../src/deliverables/socle.mjs';
import { chartSection } from '../../src/deliverables/chart.mjs';
import { docStrings } from '../../src/deliverables/i18n.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const fail=code=>Object.assign(new Error(code),{code});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function load(path) {try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function save(path,value) {const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,path);}
function validated(fixture,sections){const fullDossierPlan={sections:[...fixture.fullDossierPlan.sections,...fixture.relationalPlans.flatMap(p=>p.sections)]};const v=validateStructuredSections({dossierEvidence:fixture.dossierEvidence,fullDossierPlan,sections});if(!v.ok)throw Object.assign(fail('COMPARISON_VALIDATION_FAILED'),{validation:v});return fullDossierPlan;}
function repetitions(sections,plans){const phrases=new Map();for(const s of sections)for(const b of s.blocks){const plan=plans.find(p=>p.sectionId===s.sectionId)?.blockPlans.find(p=>p.blockId===b.blockId);if(plan?.deterministic)continue;const text=plan?.deterministicPrefix&&b.text.startsWith(plan.deterministicPrefix)?b.text.slice(plan.deterministicPrefix.length):b.text;for(const sentence of text.split(/[.!?]\s+/u)){const key=sentence.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim();if(key){if(!phrases.has(key))phrases.set(key,new Set());phrases.get(key).add(s.sectionId);}}}return [...phrases.values()].filter(ids=>ids.size>1).length;}
export async function runExperiment({out,mode='plan',approved=false,fetchFn=globalThis.fetch,onEstimate=()=>{}}={}) {
  if(!['plan','first','compare'].includes(mode))throw fail('UNKNOWN_EXPERIMENT_MODE');
  if(mode!=='plan'&&!approved)throw fail('EXPLICIT_APPROVAL_REQUIRED');
  if(!out)throw fail('EXPLICIT_OUTPUT_DIRECTORY_REQUIRED');
  out=resolve(out);if(!relative(repo,out).startsWith('..'))throw fail('OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
  await mkdir(out,{recursive:true,mode:0o700});let lock;
  try{lock=await open(join(out,'run.lock'),'wx',0o600);}catch(e){if(e.code==='EEXIST')throw fail('EXPERIMENT_LOCKED_REVIEW_INTERRUPTION');throw e;}
  try {
    if(await load(join(out,'inflight.json')))throw fail('INTERRUPTED_OPERATION_REQUIRES_REVIEW');
    let envelope=await load(join(out,'fixture.json'));
    if(!envelope){const fixture=await buildSyntheticFixture();envelope={schema:'lastro.synthetic-comparison.v1',input:syntheticInput,fixture};envelope.hash=hash({input:envelope.input,fixture});await save(join(out,'fixture.json'),envelope);}
    if(envelope.schema!=='lastro.synthetic-comparison.v1'||hash(envelope.input)!==hash(syntheticInput)||envelope.hash!==hash({input:envelope.input,fixture:envelope.fixture}))throw fail('SYNTHETIC_FIXTURE_MISMATCH');
    const fixture=envelope.fixture;const plans=[...fixture.fullDossierPlan.sections,...fixture.relationalPlans.flatMap(p=>p.sections)];
    const plan={fixtureHash:envelope.hash,model:CLAUDE_MODEL,maximumTotalUsd:5,firstCallMaximumUsd:FIRST_CALL_MAX_USD,firstOutputLimit:900,mode:'offline_preparation',paidCalls:0};
    if(mode==='plan'){await save(join(out,'plan.json'),plan);return plan;}
    const ledger=new BudgetLedger(join(out,'budget.json'),{approved:true});if((await ledger.snapshot()).unresolved)throw fail('UNRESOLVED_CALL_BLOCKS_SPENDING');
    const claude=anthropicAdapter({approved:true,fetchFn});const openai=openaiAdapter({approved:true,fetchFn});await claude.availability();
    let metrics=await load(join(out,'calls.json'))??[];let warnings=await load(join(out,'validation.json'))??[];
    let pending=true;let stage='C';let firstOnly=mode==='first';let paidCallsThisRun=0;
    async function invoke(adapter,model,payload,outputLimit,maximumCallUsd,details={}){
      if(firstOnly&&paidCallsThisRun>=1)throw fail('SINGLE_CALL_LIMIT_REACHED');
      const id='call_'+randomUUID().replaceAll('-','');await save(join(out,'inflight.json'),{id,stage});const start=Date.now();
      try{
        const result=await meteredProvider({ledger,adapter,model,id,payload,outputLimit,maximumCallUsd,onEstimate});paidCallsThisRun++;
        await save(join(out,id+'.json'),{stage,...result});
        metrics.push({id,stage,...details,model:result.response.billedModel,inputTokens:result.response.usage.inputTokens,outputTokens:result.response.usage.outputTokens,costUsd:result.accounting.actualUsd,durationMs:Date.now()-start});await save(join(out,'calls.json'),metrics);
        await unlink(join(out,'inflight.json'));return result.response;
      }catch(error){await save(join(out,'failure.json'),{id,stage,code:error.code??'EXPERIMENT_CALL_FAILED',budget:await ledger.snapshot()});throw error;}
    }
    function writerConfig(target,first=false){return {apiKey:'experimental-transport-only',baseUrl:'https://experimental.invalid/v1',model:'gpt-4o-mini',fetchFn:async(_url,request)=>{
      const body=JSON.parse(request.body);const model=target==='C'?CLAUDE_MODEL:body.model;
      const payload=target==='C'?toAnthropicPayload(body):{messages:body.messages,temperature:body.temperature,response_format:body.response_format};
      const prompt=JSON.parse(body.messages.find(m=>m.role==='user').content);
      const response=await invoke(target==='C'?claude:openai,model,payload,900,first&&pending?FIRST_CALL_MAX_USD:0.15,{logicalKey:prompt.sectionPlan.sectionId+'.'+prompt.sectionPlan.blockPlans[0].blockId,isCorrection:Boolean(prompt.correctionIssues?.length)});pending=false;
      return {ok:true,headers:new Headers(),json:async()=>({choices:[{message:{content:response.text}}],usage:{prompt_tokens:response.usage.inputTokens,completion_tokens:response.usage.outputTokens,total_tokens:response.usage.inputTokens+response.usage.outputTokens}})};
    }};}
    async function generate(target,onlyFirst=false){
      stage=target;let state=await load(join(out,target+'-progress.json'))??{fixtureHash:envelope.hash,sections:[],skipped:[]};if(state.fixtureHash!==envelope.hash)throw fail('CHECKPOINT_FIXTURE_MISMATCH');
      const selected=onlyFirst?[plans.find(p=>p.sectionId==='general_synthesis')]:plans;
      for(const sectionPlan of selected){
        if(state.sections.some(s=>s.sectionId===sectionPlan.sectionId)||state.skipped.includes(sectionPlan.sectionId))continue;
        const written=await writeStructuredSectionWithLlm({dossierEvidence:fixture.dossierEvidence,sectionPlan,options:{config:writerConfig(target,onlyFirst),logger:{warn:(_message,data)=>{warnings.push({stage:target,...data});}},failFast:true}});
        if(written.skipped)state.skipped.push(sectionPlan.sectionId);else state.sections.push(written.section);
        await save(join(out,target+'-progress.json'),state);await save(join(out,'validation.json'),warnings);
      }
      validated(fixture,state.sections);return state.sections;
    }
    // First paid message is a single C synthesis block, capped at $0.04 and reused.
    if(!(await load(join(out,'C-progress.json')))?.sections?.some(s=>s.sectionId==='general_synthesis'))await generate('C',true);
    firstOnly=false;
    if(mode==='first')return {status:'first_call_complete',budget:await ledger.snapshot()};
    const A=await generate('A');const fullDossierPlan=validated(fixture,A);
    let B=await load(join(out,'B.json'));
    if(!B){
      stage='B';
      const payload={system:'Vous relisez globalement un dossier symbolique. Réduisez répétitions et tournures scolaires, gardez nuances et voix chaleureuse. Aucun nouveau fait astrologique ou personnel. Respectez les preuves propres à chaque bloc et le vouvoiement. Les préfixes et annexes sont immuables. Ne dépassez pas les mots du dossier initial. Répondez seulement en JSON {"sections":[{"sectionId":"...","blocks":[{"blockId":"...","text":"interprétation seule, sans préfixe"}]}]}.',messages:[{role:'user',content:JSON.stringify({originalSections:A,dossierEvidence:fixture.dossierEvidence,fullDossierPlan})}]};
      const response=await invoke(claude,CLAUDE_MODEL,payload,30000,1.5);let proposals;
      try{proposals=JSON.parse(response.text).sections;if(!Array.isArray(proposals))throw Error();}catch{throw fail('INVALID_EDITORIAL_JSON');}
      B=reviewRevision({dossierEvidence:fixture.dossierEvidence,fullDossierPlan,originalSections:A,proposals});await save(join(out,'B.json'),B);
    }
    const C=await generate('C');
    const signature=sections=>sections.map(s=>[s.sectionId,s.blocks.map(b=>b.blockId)]);
    if(hash(signature(A))!==hash(signature(C)))throw fail('COMPARISON_STRUCTURE_MISMATCH');
    const words=sections=>sections.reduce((n,s)=>n+s.blocks.reduce((m,b)=>m+wordCount(b.text),0),0);
    if(words(C)<words(A)*0.75||words(C)>words(A)*1.25)throw fail('COMPARISON_VOLUME_MISMATCH');
    validated(fixture,B.sections);
    let mapping=await load(join(out,'correspondance-secrete.json'));if(!mapping){mapping=blindAssignment();await save(join(out,'correspondance-secrete.json'),mapping);}
    const strings=docStrings('fr');const socle=buildSocle(fixture.calculation.result,strings);const variants={A,B:B.sections,C};
    for(const [label,key] of Object.entries(mapping)){
      const narrative=variants[key].map(s=>({id:s.sectionId,title:strings.sectionTitles?.[s.sectionId]??s.sectionId.replaceAll('_',' '),text:s.blocks.map(b=>b.text).join('\n\n'),kind:'symbolic'}));
      const html=renderDossierHtml({title:`Version ${label}`,personLabel:null,createdAt:nowUtc,writerMode:'llm',strings,cover:socle.cover,sections:[chartSection(socle,strings),...narrative,...annexSections(socle,strings)]});await save(join(out,`Version-${label}.html`),html);
    }
    const variantMetrics={};
    for(const key of ['A','B','C']){
      const ownCalls=metrics.filter(m=>m.stage===key);
      const calls=key==='B'?[...metrics.filter(m=>m.stage==='A'),...ownCalls]:ownCalls;
      const costUsd=calls.reduce((n,c)=>n+c.costUsd,0);
      variantMetrics[key]={models:[...new Set(calls.map(c=>c.model))],calls:calls.length,marginalCalls:ownCalls.length,inputTokens:calls.reduce((n,c)=>n+c.inputTokens,0),outputTokens:calls.reduce((n,c)=>n+c.outputTokens,0),costUsd,durationMs:calls.reduce((n,c)=>n+c.durationMs,0),correctionAttempts:calls.filter(c=>c.isCorrection).length,validatorRejections:warnings.filter(w=>w.stage===key&&w.validationErrorCodes?.length).length,words:words(variants[key]),exactRepeatedSentences:repetitions(variants[key],plans),estimatedFor10:costUsd*10,estimatedFor100:costUsd*100,estimatedFor1000:costUsd*1000};
    }
    await save(join(out,'grille-aveugle.csv'),'Critère,Version X (/10),Version Y (/10),Version Z (/10),Commentaire\n'+['Personnalisation','Profondeur','Français naturel','Absence de répétitions','Croisement des faits','Nuances','Cohérence','Intérêt','Fidélité aux preuves','Qualité perçue'].map(c=>c+',,,,').join('\n')+'\n');

    const result={status:'comparison_complete',fixtureHash:envelope.hash,variants:variantMetrics,editorialDecisions:B.reports,budget:await ledger.snapshot(),note:'B cost includes A; experiment budget counts A only once. Mapping private until user scores.'};await save(join(out,'rapport-technique.json'),result);return {status:result.status,budget:result.budget};
  }finally{await lock.close();await unlink(join(out,'run.lock'));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);const value=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
  try{if(execFileSync('git',['branch','--show-current'],{cwd:repo,encoding:'utf8'}).trim()!=='experiment/openai-claude-comparison')throw fail('WRONG_EXPERIMENT_BRANCH');
    const result=await runExperiment({out:value('--out'),mode:value('--mode')??'plan',approved:args.includes('--allow-paid'),onEstimate:data=>process.stdout.write(JSON.stringify({event:'maximum_call_estimate',...data})+'\n')});process.stdout.write(JSON.stringify(result)+'\n');
  }catch(error){process.stderr.write(JSON.stringify({code:error.code??'EXPERIMENT_FAILED'})+'\n');process.exitCode=1;}
}
