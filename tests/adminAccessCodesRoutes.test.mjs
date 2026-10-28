import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createApp } from '../src/http/app.mjs';
import { JsonStore } from '../src/db/jsonStore.mjs';

const BATCH='c96aad32-33ca-46b2-ae65-cd1449f3d7b6';
const hash=code=>createHash('sha256').update(code.toLowerCase()).digest('hex');
const codes=Array.from('ABCDEFGHJKLMNPQRSTUVWX').slice(0,20).map(c=>'A2B3C'+c);
const payload=()=>({batchId:BATCH,label:'Lot fictif',codeLength:6,codes:codes.map(hash)});
const HEADERS={'x-astrolab-admin-action':'create-access-codes'};
async function start(options = {}) {
  const store=new JsonStore(null);
  await store.transact(state=>{
    for(const [id,role] of [['admin','admin'],['member','user']]){
      state.users.push({id,email:id+'@example.test',emailVerifiedAt:new Date().toISOString(),primaryRole:role,deletedAt:null});
      state.sessions.push({id:'session-'+id,userId:id,token:'token-'+id,expiresAt:new Date(Date.now()+3600000).toISOString()});
    }
    state.accessCodes.push({id:'code-short',hash:hash('ZX7Q2K'),createdAt:new Date().toISOString(),usedAt:null,expiresAt:null,revokedAt:null});
    state.accessCodes.push({id:'code-long',hash:hash('ABCDEFGH23456789'),createdAt:new Date().toISOString(),usedAt:null,expiresAt:null,revokedAt:null});
  });
  const {server}=createApp({store,outboxMaintenance:false,backgroundReadingJobs:false,...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {store,base:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
async function post(app,path,body,{actor='admin',headers={}}={}) {
  const res=await fetch(app.base+path,{method:'POST',headers:{'content-type':'application/json',...(actor?{cookie:'astrolab_session=token-'+actor}:{}),...headers},body:JSON.stringify(body)});
  return {status:res.status,headers:res.headers,data:await res.json()};
}
async function withNoSharedCode(run){
  const keys=['ASTROLAB_TEST_CODE','STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','ASTROLAB_LLM_API_KEY','ASTROLAB_LLM_BASE_URL'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));keys.forEach(k=>delete process.env[k]);
  try{await run()}finally{for(const k of keys)previous[k]===undefined?delete process.env[k]:process.env[k]=previous[k];}
}

test('admin batch route requires a live admin session and explicit action header',async()=>{
 const app=await start();try{
  const before=JSON.stringify(await app.store.load());
  assert.equal((await post(app,'/api/admin/access-codes',payload(),{actor:null,headers:HEADERS})).status,401);
  assert.equal((await post(app,'/api/admin/access-codes',payload(),{actor:'member',headers:HEADERS})).status,403);
  assert.equal((await post(app,'/api/admin/access-codes',payload())).status,403);
  assert.equal((await post(app,'/api/admin/access-codes',payload(),{headers:{...HEADERS,origin:'https://elsewhere.example'}})).status,403);
  assert.equal(JSON.stringify(await app.store.load()),before);
 }finally{await app.close()}
});
test('twenty imported six-character invitations are verifiable and replay never revives one',async()=>{
 const app=await start();try{
  const result=await post(app,'/api/admin/access-codes',payload(),{headers:HEADERS});
  assert.equal(result.status,201);assert.equal(result.data.createdCount,20);assert.equal(result.data.totalCount,20);
  assert.equal(result.data.usageLimit,1);assert.equal(result.data.codeLength,6);
  assert.equal(result.data.states.available,20);assert.match(result.headers.get('cache-control'),/no-store/);
  for(const code of codes)assert.ok(!JSON.stringify(result.data).includes(code));
  for(const value of payload().codes)assert.ok(!JSON.stringify(result.data).includes(value));
  await app.store.transact(state=>{state.accessCodes.find(c=>c.batchId===BATCH).usedAt='2026-10-27T12:00:00Z'});
  const replay=await post(app,'/api/admin/access-codes',payload(),{headers:HEADERS});
  assert.equal(replay.status,200);assert.equal(replay.data.createdCount,0);assert.equal(replay.data.states.used,1);
  const res=await fetch(app.base+'/api/admin/access-codes?batchId='+BATCH,{headers:{cookie:'astrolab_session=token-admin'}});
  const summary=await res.json();assert.equal(res.status,200);assert.equal(summary.states.available,19);assert.equal(summary.states.used,1);
  const state=await app.store.load();assert.equal(state.publicReadings.length,0);assert.equal(state.outbox.length,0);assert.equal(state.orders.length,0);
 }finally{await app.close()}
});
test('GET summaries and invalid creation reveal no batch to unauthenticated or regular users',async()=>{
 const app=await start();try{
  for(const actor of [null,'member']){
   const res=await fetch(app.base+'/api/admin/access-codes?batchId='+BATCH,{headers:actor?{cookie:'astrolab_session=token-'+actor}:{}});
   assert.equal(res.status,actor?403:401);
  }
  const before=JSON.stringify(await app.store.load());
  const result=await post(app,'/api/admin/access-codes',{...payload(),usedAt:'injected'},{headers:HEADERS});
  assert.equal(result.status,400);assert.equal(JSON.stringify(await app.store.load()),before);
 }finally{await app.close()}
});
test('short-code attempts are bounded before recognition even with no shared test code',async()=>withNoSharedCode(async()=>{
 const app=await start();try{
  for(let i=0;i<30;i++)assert.equal((await post(app,'/api/public/readings',{deliveryEmail:'reader@example.test',accessCode:'ZZZZZZ'},{actor:null})).status,403);
  const valid=await post(app,'/api/public/readings',{deliveryEmail:'reader@example.test',accessCode:'zX-7Q 2k'},{actor:null});
  assert.equal(valid.status,429);assert.ok(Number(valid.headers.get('retry-after'))>0);
  const state=await app.store.load();assert.equal(state.publicReadings.length,0);assert.equal(state.accessCodes.find(c=>c.id==='code-short').usedAt,null);
  // Long codes keep their previous path; missing birth details still fail
  // validation before any use, rather than inheriting the short-code quota.
  const long=await post(app,'/api/public/readings',{deliveryEmail:'reader@example.test',accessCode:'ABCDEFGH23456789'},{actor:null});
  assert.equal(long.status,400);
 }finally{await app.close()}
}));
test('service limit also bounds guesses from changing client addresses',async()=>withNoSharedCode(async()=>{
 const app=await start();try{
  for(let i=0;i<100;i++){
   const result=await post(app,'/api/public/readings',{deliveryEmail:'reader@example.test',accessCode:'ZZZZZZ'},{actor:null,headers:{'x-forwarded-for':'192.0.2.'+(Math.floor(i/25)+1)}});
   assert.equal(result.status,403);
  }
  const result=await post(app,'/api/public/readings',{deliveryEmail:'reader@example.test',accessCode:'ZX7Q2K'},{actor:null,headers:{'x-forwarded-for':'192.0.2.99'}});
  assert.equal(result.status,429);assert.equal((await app.store.load()).publicReadings.length,0);
 }finally{await app.close()}
}));

test('disabling only the complement preserves pricing and administrative invitations',async()=>withNoSharedCode(async()=>{
 const previous=process.env.ASTROLAB_PRICE_CENTS;process.env.ASTROLAB_PRICE_CENTS='1800';
 const app=await start({complementEnabled:false});try{
  assert.equal((await fetch(app.base+'/complement')).status,404);
  assert.equal((await fetch(app.base+'/healthz')).status,200);
  const config=await fetch(app.base+'/api/config').then(r=>r.json());
  assert.equal(config.pricing.baseCents,1800);assert.equal(config.pricing.version,'lastro-pricing@1.1.0');
  assert.equal((await post(app,'/api/admin/access-codes',payload(),{headers:HEADERS})).status,201);
 }finally{await app.close();previous===undefined?delete process.env.ASTROLAB_PRICE_CENTS:process.env.ASTROLAB_PRICE_CENTS=previous;}
}));

test('fifty long invitations are imported through the authenticated route and replay preserves use without customer actions',async()=>{
 const app=await start();try{
  const longCodes=Array.from({length:50},(_,index)=>'FICTIF'+String(index).padStart(6,'0'));
  const request={...payload(),codeLength:12,codes:longCodes.map(hash)};
  for(const actor of [null,'member']){
   const rejected=await post(app,'/api/admin/access-codes',request,{actor,headers:HEADERS});
   assert.equal(rejected.status,actor?403:401);
  }
  const created=await post(app,'/api/admin/access-codes',request,{headers:HEADERS});
  assert.equal(created.status,201);assert.equal(created.data.createdCount,50);assert.equal(created.data.codeLength,12);
  assert.equal(created.data.states.available,50);assert.equal(created.data.usageLimit,1);
  assert.ok(longCodes.every(code=>!JSON.stringify(created.data).includes(code)));
  await app.store.transact(state=>{state.accessCodes.find(entry=>entry.batchId===BATCH).usedAt='2026-10-28T12:00:00Z'});
  const before=JSON.stringify(await app.store.load());
  const replay=await post(app,'/api/admin/access-codes',request,{headers:HEADERS});
  assert.equal(replay.status,200);assert.equal(replay.data.createdCount,0);assert.equal(replay.data.codeLength,12);assert.equal(replay.data.states.used,1);
  const res=await fetch(app.base+'/api/admin/access-codes?batchId='+BATCH,{headers:{cookie:'astrolab_session=token-admin'}});
  const summary=await res.json();assert.equal(res.status,200);assert.equal(summary.codeLength,12);assert.equal(summary.states.available,49);
  assert.equal(JSON.stringify(await app.store.load()),before);
  const state=await app.store.load();assert.equal(state.publicReadings.length,0);assert.equal(state.outbox.length,0);assert.equal(state.orders.length,0);
 }finally{await app.close()}
});

test('the protected replacement route retires only its unused old batch and cannot revive it on replay',async()=>{
 const app=await start();try{
  assert.equal((await post(app,'/api/admin/access-codes',payload(),{headers:HEADERS})).status,201);
  const replacementId='00000000-0000-4000-8000-000000000099';
  const request={batchId:replacementId,label:'Long replacement test',codeLength:12,supersedesBatchId:BATCH,
   codes:Array.from({length:50},(_,index)=>hash('FICTIF'+String(index).padStart(6,'0')))};
  assert.equal((await post(app,'/api/admin/access-codes',request,{actor:'member',headers:HEADERS})).status,403);
  const result=await post(app,'/api/admin/access-codes',request,{headers:HEADERS});
  assert.equal(result.status,201);assert.equal(result.data.createdCount,50);assert.equal(result.data.states.available,50);
  const state=await app.store.load();assert.equal(state.accessCodes.filter(entry=>entry.batchId===BATCH&&entry.revokedAt).length,20);
  assert.equal(state.accessCodes.find(entry=>entry.id==='code-short').revokedAt,null);
  assert.equal(state.accessCodes.find(entry=>entry.id==='code-long').revokedAt,null);
  const before=JSON.stringify(state);
  const replay=await post(app,'/api/admin/access-codes',request,{headers:HEADERS});
  assert.equal(replay.status,200);assert.equal(replay.data.createdCount,0);assert.equal(JSON.stringify(await app.store.load()),before);
 }finally{await app.close()}
});
