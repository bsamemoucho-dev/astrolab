import assert from 'node:assert/strict';
import test from 'node:test';
import {compareStoredReading} from '../experiments/openai-claude/regressionAudit.mjs';
const ok=()=>({ok:true,issues:[]});
const stored={id:'synthetic',dossierEvidence:{evidence:[{evidenceId:'e',type:'NATAL_BODY_SIGN',value:{body:'Sun',sign:'Aries'}}]},fullDossierPlan:{sections:[{sectionId:'identity'}]},sections:[{sectionId:'identity',blocks:[{blockId:'b',text:'Piste symbolique.'}]}]};
test('regression audit: missing original evidence cannot be replaced by a calculation id',()=>{const r=compareStoredReading({id:'a',calculationRunId:'exists',sections:[{id:'identity',text:'Le Soleil en Bélier.'}]},{before:()=>{throw Error('must not validate');}});assert.equal(r.verifiable,false);assert.equal(r.beforeAccepted,null);assert.equal(r.afterAccepted,null);});
test('regression audit: same original proofs and texts passed to both validators',()=>{let first;const r=compareStoredReading(stored,{before:args=>{first=args;return ok();},after:args=>{assert.equal(args,first);return ok();}});assert.equal(r.verifiable,true);assert.equal(r.classification,'accepted_by_both');});
test('regression audit: new rejection requires review, never automatic blame',()=>{const r=compareStoredReading(stored,{before:ok,after:()=>({ok:false,issues:[{blockId:'b',code:'undeclared_text_fact',fact:{type:'ASPECT'}}]})});assert.equal(r.classification,'new_rejection_requires_review');assert.equal(r.newIssues.length,1);});
