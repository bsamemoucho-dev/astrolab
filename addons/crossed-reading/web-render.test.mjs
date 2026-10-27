import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildComplementPreview} from './index.mjs';
import {renderIndependentReading} from './render.mjs';
import {releaseFingerprint} from '../../src/http/release.mjs';
const example=()=>buildComplementPreview({birth:{birthDate:'1990-01-15',timePrecision:'exact',timeValue:'16:30',latitude:48.8566,longitude:2.3522,timeZone:'Europe/Paris',placeName:'Paris',country:'France'},personLabel:'Exemple fictif',generatedAt:'2026-10-27T12:00:00Z'});
test('web presentation is explicit and never mutates proofs or grants interpretation licences',()=>{
 const r=example(),before=JSON.stringify(r),html=renderIndependentReading(r,{presentation:'web'});
 assert.equal(JSON.stringify(r),before);
 assert.equal(r.jyotish.interpretationStatus,'not_licensed');
 assert.equal(r.bazi.interpretationStatus,'not_licensed');
 assert.equal(r.crossTraditionSynthesis.status,'not_licensed');
 assert.match(html,/id="documented-reading-title"/);
 assert.doesNotMatch(html,/Base de préparation locale|id="symbolic-title"/);
 assert.match(renderIndependentReading(r),/Aperçu local ·/);
 assert.throws(()=>renderIndependentReading(r,{presentation:'unverified'}),/UNSUPPORTED_COMPLEMENT_PRESENTATION/);
});
test('web presentation preserves blocking provenance checks',()=>{
 const r=example();r.jyotish.positions.find(p=>p.body==='Moon').sign='Aries';
 assert.throws(()=>renderIndependentReading(r,{presentation:'web'}),/COMPLEMENT_READING_PROOF_MISMATCH/);
});
test('release fingerprint covers independent calculator and web changes',()=>{
 const root=mkdtempSync(join(tmpdir(),'lastro-complement-release-'));
 try{
  for(const d of ['src','public','addons/crossed-reading'])mkdirSync(join(root,d),{recursive:true});
  writeFileSync(join(root,'src/server.mjs'),'// server');writeFileSync(join(root,'public/index.html'),'<title>Lastro</title>');
  const p=join(root,'addons/crossed-reading/jyotish.mjs');writeFileSync(p,'// one');const before=releaseFingerprint({racine:root});
  writeFileSync(p,'// two');const after=releaseFingerprint({racine:root});assert.notEqual(after,before);
  writeFileSync(join(root,'addons/crossed-reading/web-page.mjs'),'// page');assert.notEqual(releaseFingerprint({racine:root}),after);
 }finally{rmSync(root,{recursive:true,force:true});}
});
