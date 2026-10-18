// Read existing artifacts only; never reconstruct missing evidence or call a model.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateStructuredSections, detectAstrologicalTextFacts } from '../../src/deliverables/factualClaimsValidator.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');
export function compareStoredReading(reading,{before,after=validateStructuredSections,detectBefore=()=>[]}={}) {
  const sections = reading.structuredSections ?? reading.sections;
  const evidence=reading.dossierEvidence;
  const plan=reading.fullDossierPlan;
  const textSections=Array.isArray(sections)?sections.filter(s=>s.text||s.blocks?.some(b=>b.text)):[];
  const result={reference:hash(String(reading.id ?? reading.readingId ?? 'unknown')).slice(0,12),hasOriginalText:textSections.length>0,sectionCount:textSections.length,verifiable:false,beforeAccepted:null,afterAccepted:null,classification:'indeterminate',newIssues:[],detectorChanges:[]};
  for(const section of textSections){const text=section.text ?? section.blocks.map(b=>b.text).join('\n');const old=detectBefore(text),next=detectAstrologicalTextFacts(text);const oldSet=new Set(old.map(f=>JSON.stringify(f)));const changes=next.filter(f=>!oldSet.has(JSON.stringify(f)));if(changes.length)result.detectorChanges.push({section:section.sectionId ?? section.id,additionalFacts:changes});}
  if(!evidence?.evidence?.length||!plan?.sections?.length||!Array.isArray(sections)||!sections.every(s=>s.sectionId&&Array.isArray(s.blocks))){result.reason='original_section_scoped_evidence_or_structured_plan_missing';return result;}
  if(!sections.every(s=>plan.sections.some(p=>p.sectionId===s.sectionId))){result.reason='original_plan_incomplete';return result;}
  result.verifiable=true;
  const args={dossierEvidence:evidence,fullDossierPlan:plan,sections};
  const old=before(args),next=after(args);
  result.beforeAccepted=old.ok;result.afterAccepted=next.ok;
  const previous=new Set(old.issues.map(i=>JSON.stringify([i.blockId,i.code,i.fact])));
  result.newIssues=next.issues.filter(i=>!previous.has(JSON.stringify([i.blockId,i.code,i.fact]))).map(i=>({code:i.code,blockId:i.blockId,fact:i.fact??null}));
  // New rejection is a signal for review, never proof of a historical error.
  result.classification=old.ok&&!next.ok?'new_rejection_requires_review':old.ok&&next.ok?'accepted_by_both':'other_validation_result';
  return result;
}
export async function auditLocalStore({storePath,baselinePath,outputPath}) {
  globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN_IN_REGRESSION_AUDIT');};
  const original=await readFile(storePath);const state=JSON.parse(original);
  const baseline=await import(pathToFileURL(resolve(baselinePath)).href);
  const candidates=[...(state.deliverableVersions??[]),...(state.publicReadings??[]).filter(r=>r.reading||r.result).map(r=>({...r.reading??r.result,id:r.id}))];
  const records=candidates.map(r=>compareStoredReading(r,{before:baseline.validateStructuredSections,detectBefore:baseline.detectAstrologicalTextFacts}));
  const verified=records.filter(r=>r.verifiable);
  const report={baselineVersion:baseline.CLAIM_VALIDATOR_VERSION,records,counts:{analysed:records.length,verifiable:verified.length,acceptedByBoth:verified.filter(r=>r.beforeAccepted&&r.afterAccepted).length,newlyRejected:verified.filter(r=>r.beforeAccepted&&!r.afterAccepted).length,justifiedRejections:0,falsePositives:0,indeterminate:records.filter(r=>!r.verifiable||r.classification==='new_rejection_requires_review').length},caveats:['Counts of justified rejections and false positives are established cases only; zero is not evidence of absence with missing proofs.','Detector deltas on unverified dossiers are not validation verdicts.','No original proof, no invented replacement; no remote or production corpus retrieved.'],storeSha256Before:hash(original),storeSha256After:hash(await readFile(storePath))};
  if(report.storeSha256Before!==report.storeSha256After)throw Error('STORE_CHANGED_DURING_READ_ONLY_AUDIT');
  await mkdir(resolve(outputPath,'..'),{recursive:true,mode:0o700});await writeFile(outputPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({counts:report.counts,storeUnchanged:true,personallyIdentifyingTextLogged:false}));
  return report;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [storePath,baselinePath,outputPath]=process.argv.slice(2);if(!storePath||!baselinePath||!outputPath)throw Error('Usage: regressionAudit.mjs <local-store> <baseline-validator> <private-output>');await auditLocalStore({storePath,baselinePath,outputPath});}
