// Offline invariants for the future comparison; no provider transport or secrets.
import { randomInt } from 'node:crypto';
import { validateStructuredSection, validateStructuredSections } from '../../src/deliverables/factualClaimsValidator.mjs';
export function wordCount(text) {return (String(text??'').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)??[]).length;}
const words=sections=>sections.reduce((n,s)=>n+s.blocks.reduce((m,b)=>m+wordCount(b.text),0),0);
export function reviewRevision({dossierEvidence,fullDossierPlan,originalSections,proposals}) {
  const baseline=validateStructuredSections({dossierEvidence,fullDossierPlan,sections:originalSections});
  if(!baseline.ok)throw Object.assign(Error('INVALID_REFERENCE_A'),{validation:baseline});
  const reports=[];const proposedMap=new Map(proposals.map(p=>[p.sectionId,p]));
  if(proposedMap.size!==proposals.length || proposals.some(p=>!originalSections.some(s=>s.sectionId===p.sectionId)))throw Error('UNEXPECTED_REVISION_SECTION');
  const sections=originalSections.map(original=>{
    const proposal=proposedMap.get(original.sectionId);
    if(!proposal)return structuredClone(original);
    const plan=fullDossierPlan.sections.find(p=>p.sectionId===original.sectionId);
    const expected=new Set(original.blocks.map(b=>b.blockId));
    const proposedIds=new Set(proposal.blocks.map(b=>b.blockId));
    if(proposedIds.size!==proposal.blocks.length||proposedIds.size!==expected.size||proposal.blocks.some(b=>!expected.has(b.blockId))){reports.push({sectionId:original.sectionId,status:'kept_A',reason:'revision_block_set_mismatch'});return structuredClone(original);}
    // Reattach only the production plan's immutable lead; proposals contain just
    // editable interpretation fields. Calculated annexes never enter this API.
    const edited={sectionId:original.sectionId,blocks:proposal.blocks.map(b=>{
      const bp=plan.blockPlans.find(p=>p.blockId===b.blockId);
      if(bp?.deterministic)return structuredClone(original.blocks.find(x=>x.blockId===b.blockId));
      const prefix=bp?.deterministicPrefix;
      return {blockId:b.blockId,text:[prefix,b.text].filter(Boolean).join('\n\n')};
    })};
    const checked=validateStructuredSection({dossierEvidence,sectionPlan:plan,section:edited});
    if(!checked.ok){reports.push({sectionId:original.sectionId,status:'kept_A',reason:'validation_failed',codes:[...new Set(checked.issues.map(i=>i.code))]});return structuredClone(original);}
    reports.push({sectionId:original.sectionId,status:'revised'});return edited;
  });
  if(words(sections)>words(originalSections))return {sections:structuredClone(originalSections),reports:[...reports,{status:'kept_A_all',reason:'global_word_limit_exceeded'}],originalWords:words(originalSections),finalWords:words(originalSections)};
  const final=validateStructuredSections({dossierEvidence,fullDossierPlan,sections});
  if(!final.ok)return {sections:structuredClone(originalSections),reports:[...reports,{status:'kept_A_all',reason:'global_validation_failed',codes:[...new Set(final.issues.map(i=>i.code))]}],originalWords:words(originalSections),finalWords:words(originalSections)};
  return {sections,reports,originalWords:words(originalSections),finalWords:words(sections)};
}
export function blindAssignment() {
  const names=['A','B','C'];for(let i=names.length-1;i>0;i--){const j=randomInt(i+1);[names[i],names[j]]=[names[j],names[i]];}
  return Object.fromEntries(['X','Y','Z'].map((label,i)=>[label,names[i]]));
}
