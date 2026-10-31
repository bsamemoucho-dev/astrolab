import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { invitationNavigation, createEmailInvitationController, INVITATION_STORAGE_KEY, invitationStrings } from "../public/email-invitations.js";
import { createPromoQuoteController } from "../public/promo-checkout.js";
import { createInvitationSendController, invitationAdminRow } from "../public/admin-invitations.js";
import { renderAdminInvitationsPage } from "../src/http/adminInvitationsPage.mjs";

const token = "A".repeat(43);
const token2 = "B".repeat(43);
const origin = "https://fixture.invalid";
const quote = (kind = "free") => ({ version: "lastro-pricing@1.1.0", baseCents: 1800, totalCents: kind === "free" ? 0 : 800, discountCents: kind === "free" ? 1800 : 1000, currency: "eur", valid: true, reason: "applied" });
const invitation = (kind = "free", extra = {}) => ({ id: "inv_fixture", kind, recipientEmail: "reader@example.invalid", status: "available", quote: quote(kind), ...extra });
function storage(initial = {}) { const values = new Map(Object.entries(initial)); return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k), values }; }
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return { promise, resolve, reject }; }

test("the invitation fragment is removed before a resolve request and retained only for this tab", async () => {
  const saved = storage(); const events = [];
  const c = createEmailInvitationController({ href: `${origin}/#invitation=${token}`, storage: saved,
    replaceUrl: path => events.push(["replace",path]), requestResolve: async t => { events.push(["request",t]); return { invitation: invitation() }; } });
  assert.deepEqual(events, [["replace","/"]]);
  assert.equal(saved.getItem(INVITATION_STORAGE_KEY), token);
  await c.resolve();
  assert.deepEqual(events[1], ["request", token]);
  assert.equal(c.snapshot().invitation.quote.totalCents, 0);
  assert.equal(c.snapshot().status, "available");
});

test("a reload restores the same token and resolving it does not create or consume a reading", async () => {
  const saved = storage({ [INVITATION_STORAGE_KEY]: token }); const calls=[];
  const c = createEmailInvitationController({ href: origin + "/", storage: saved, replaceUrl: () => assert.fail("no new fragment"), requestResolve: async t => { calls.push(t); return { invitation: invitation("discount10") }; } });
  await c.resolve(); await c.resolve();
  assert.deepEqual(calls,[token,token]);
  assert.equal(c.snapshot().invitation.quote.totalCents,800);
  assert.equal(saved.getItem(INVITATION_STORAGE_KEY),token);
});

for (const fragment of ["short", "A".repeat(44), `${token}&invitation=${token2}`, `${token}&extra=1`, "%3Cscript%3E"]) {
  test(`malformed or ambiguous invitation stays blocked: ${fragment.slice(0,20)}`, async () => {
    const saved = storage({ [INVITATION_STORAGE_KEY]: token2 }); let requests=0; let removed=false;
    const c = createEmailInvitationController({ href: `${origin}/#invitation=${fragment}`, storage: saved, replaceUrl: () => { removed=true; }, requestResolve: async () => { requests++; } });
    await c.resolve();
    assert.equal(c.snapshot().active,true);
    assert.equal(c.snapshot().status,"unavailable");
    assert.equal(c.snapshot().token,null);
    assert.equal(requests,0);
    assert.equal(removed,true);
    assert.equal(saved.getItem(INVITATION_STORAGE_KEY),null);
  });
}

test("query-string invitation tokens are scrubbed and refused instead of accepted from logged URLs", () => {
  const seen=[];
  const n=invitationNavigation({ href:`${origin}/?invitation=${token}&language=fr`, storage:storage(), replaceUrl:p=>seen.push(p) });
  assert.equal(n.status,"unavailable"); assert.deepEqual(seen,["/?language=fr"]);
});

test("unrelated fragments and a corrupt stored token do not activate an invitation", () => {
  const saved=storage({[INVITATION_STORAGE_KEY]:"corrupt"});
  assert.equal(invitationNavigation({href:origin+"/#guide",storage:saved}).active,false);
  assert.equal(saved.getItem(INVITATION_STORAGE_KEY),null);
});

test("disabled sessionStorage does not fall back to persistent storage", async () => {
  const broken={getItem(){throw Error("disabled")},setItem(){throw Error("disabled")},removeItem(){throw Error("disabled")}};
  const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:broken,requestResolve:async()=>({invitation:invitation()})});
  await c.resolve();assert.equal(c.snapshot().status,"available");c.clear();assert.equal(c.snapshot().active,false);
});

test("bad responses and provider failures never fall back to a full-price purchase", async () => {
  const replies=[null,{}, {invitation:invitation("other")}, {invitation:invitation("discount10",{quote:{...quote("discount10"),totalCents:1800}})}, {invitation:invitation("free",{quote:{...quote(),currency:"usd"}})}, {invitation:invitation("free",{recipientEmail:"\"<script>"})}];
  for(const reply of replies){
    const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:storage(),requestResolve:async()=>reply});
    await c.resolve();assert.equal(c.snapshot().active,true);assert.equal(c.snapshot().status,"unavailable");assert.equal(c.snapshot().invitation,null);
  }
  const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:storage(),requestResolve:async()=>{throw Error("private provider text")}});
  await c.resolve();assert.equal(c.snapshot().status,"unavailable");assert.equal("error" in c.snapshot(),false);
});

test("used invitations expose only a same-origin reading recovery link", async () => {
  for(const link of ["https://hostile.invalid/r/private", "javascript:alert(1)", origin+"/r/private?secret=1", origin+"/api/admin/clients"]){
    const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:storage(),requestResolve:async()=>({invitation:invitation("free",{status:"used",quote:null,delivery:{reference:"fixture_reference",link,status:"ready"}})})});
    await c.resolve();assert.equal(c.snapshot().status,"used");assert.equal(c.snapshot().invitation.delivery,null);
  }
  const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:storage(),requestResolve:async()=>({invitation:invitation("free",{status:"used",quote:null,delivery:{reference:"fixture_reference",link:origin+"/r/fixture_token",status:"failed"}})})});
  await c.resolve();assert.equal(c.snapshot().invitation.delivery.link,origin+"/r/fixture_token");
});

test("clearing an invitation invalidates a late resolve response", async () => {
  const pending=deferred();const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:storage(),requestResolve:()=>pending.promise});
  const resolving=c.resolve();c.clear();pending.resolve({invitation:invitation()});await resolving;
  assert.equal(c.snapshot().active,false);assert.equal(c.snapshot().token,null);
});

test("the newest resolve result wins, including an unavailable invitation", async () => {
  const first=deferred(),second=deferred();let count=0;
  const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:storage(),requestResolve:()=>++count===1?first.promise:second.promise});
  const a=c.resolve(),b=c.resolve();second.reject(Error("offline"));await b;first.resolve({invitation:invitation()});await a;
  assert.equal(c.snapshot().status,"unavailable");
});

test("a new fragment in an already open tab replaces an idle invitation and invalidates its late response",async()=>{
  const saved=storage(),first=deferred(),requests=[];
  const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:saved,requestResolve:async t=>{requests.push(t);return t===token?first.promise:{invitation:invitation("discount10")}}});
  const old=c.resolve();assert.equal(c.navigate(`${origin}/#invitation=${token2}`),true);await c.resolve();first.resolve({invitation:invitation()});await old;
  assert.deepEqual(requests,[token,token2]);assert.equal(c.snapshot().token,token2);assert.equal(c.snapshot().invitation.kind,"discount10");assert.equal(saved.getItem(INVITATION_STORAGE_KEY),token2);
});

test("a new invitation cannot replace an order already in progress, but its incoming fragment is scrubbed",()=>{
  const saved=storage(),removed=[];
  const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:saved,replaceUrl:p=>removed.push(p),requestResolve:async()=>({invitation:invitation()})});
  assert.equal(c.navigate(`${origin}/#invitation=${token2}`,{preserveCurrent:true}),false);
  assert.equal(c.snapshot().token,token);assert.equal(saved.getItem(INVITATION_STORAGE_KEY),token);assert.equal(removed.length,2);
  assert.equal(c.navigate(origin+"/#guide"),false);assert.equal(c.snapshot().token,token);
});

for(const lang of ["fr","en","de","es","it","pt","no","da","nl"]){
  test(`invitation instructions are present in ${lang}`,()=>{
    const t=invitationStrings(lang);for(const key of ["title","free","discount","loading","invalid","used","open","oneUse","exit","paid","freeNote"])assert.ok(t[key].trim());
    assert.match(t.discount,/8/);assert.match(t.discount,/18/);
    assert.match(t.freeNote,/30/);assert.doesNotMatch(t.freeNote,/Stripe/);
  });
}

test("the invitation price context confirms eight euros and invalidates its ticket when removed", async () => {
  const c=createPromoQuoteController({requestQuote:async()=>quote("discount10")});
  c.setInvitationContext(true);const ticket=await c.prepareCheckout();
  assert.equal(ticket.promoCode,"");assert.equal(ticket.invitation,true);assert.equal(ticket.quote.totalCents,800);assert.equal(c.isCurrent(ticket),true);
  c.setInvitationContext(false);assert.equal(c.isCurrent(ticket),false);
});

test("an invitation price context rejects a full-price empty quote", async () => {
  const c=createPromoQuoteController({requestQuote:async()=>({...quote("discount10"),valid:false,reason:"empty",discountCents:0,totalCents:1800})});
  c.setInvitationContext(true);await assert.rejects(c.prepareCheckout(),{code:"PRICE_QUOTE_REQUIRED"});
});

test("admin send double-clicks and uncertain retries retain a single request identity", async () => {
  let ids=0;const pending=deferred(),calls=[];
  const c=createInvitationSendController({makeRequestId:()=>`fixture_${++ids}`,request:async body=>{calls.push(body);return pending.promise}});
  const a=c.send({email:" READER@example.invalid ",kind:"free"});
  assert.equal(await c.send({email:"reader@example.invalid",kind:"free"}),null);
  pending.reject(Error("offline"));await assert.rejects(a);
  await assert.rejects(c.send({email:"reader@example.invalid",kind:"free"}));
  assert.equal(ids,1);assert.equal(calls[0].requestId,calls[1].requestId);assert.equal(calls[0].email,"reader@example.invalid");
});

test("admin requests get a new identity only when recipient, kind or language changes", async () => {
  let count=0;const calls=[];const c=createInvitationSendController({makeRequestId:()=>`fixture_${++count}`,request:async body=>{calls.push(body);return {created:true}}});
  await c.send({email:"a@example.invalid",kind:"free"});await c.send({email:"a@example.invalid",kind:"free"});await c.send({email:"a@example.invalid",kind:"discount10"});await c.send({email:"b@example.invalid",kind:"discount10"});
  assert.equal(calls[0].requestId,calls[1].requestId);assert.notEqual(calls[1].requestId,calls[2].requestId);assert.notEqual(calls[2].requestId,calls[3].requestId);
});

test("admin send rejects malformed recipients and benefits without a network request", async () => {
  let calls=0;const c=createInvitationSendController({makeRequestId:()=>"fixture",request:async()=>{calls++}});
  for(const input of [{email:"invalid",kind:"free"},{email:"a@example.invalid",kind:"unlimited"}])await assert.rejects(c.send(input));
  assert.equal(calls,0);
});

test("admin rows distinguish supplier acceptance, attempts, unknown delivery and actual use",()=>{
  const sent=invitationAdminRow({id:"fixture",recipientEmail:"a@example.invalid",kind:"free",mail:{status:"sent",attempts:1,acceptedAt:"2026-10-31T12:00:00Z"},usage:{status:"available"}});
  assert.equal(sent.sendLabel,"Accepté par Brevo");assert.equal(sent.used,false);
  const unknown=invitationAdminRow({mail:{status:"unknown",attempts:1,manualReviewRequired:true},usage:{status:"used",reference:"fixture_reference",readingStatus:"failed"}});
  assert.equal(unknown.sendLabel,"Envoi à vérifier");assert.equal(unknown.used,true);assert.equal(unknown.reference,"fixture_reference");assert.equal(unknown.reading,"Échec de génération");
  assert.equal("token" in sent,false);assert.equal("link" in sent,false);
});

test("an externally unavailable discount is flagged without attributing its use or another order to the recipient",()=>{
  const row=invitationAdminRow({kind:"discount10",status:"unavailable",mail:{status:"sent"},usage:{status:"unavailable",reference:"foreign_fixture_order",readingStatus:"ready"}});
  assert.equal(row.used,false);assert.equal(row.usageStatus,"unavailable");assert.equal(row.usageLabel,"Avantage indisponible — à vérifier");assert.equal(row.reference,null);assert.equal(row.reading,null);
});

test("an unavailable Stripe inventory shows an unknown use rather than claiming the discount is unused",()=>{
  const row=invitationAdminRow({kind:"discount10",status:"available",mail:{status:"sent"},usage:{status:"unknown",reference:"unverified_fixture_order"}});
  assert.equal(row.used,false);assert.equal(row.usageStatus,"unknown");assert.equal(row.usageLabel,"Utilisation à vérifier");assert.equal(row.reference,null);
});

test("a recorded use remains authoritative when provider availability cannot be checked",()=>{
  const row=invitationAdminRow({kind:"discount10",status:"unavailable",usedAt:"2026-10-31T12:00:00Z",deliveryReference:"trusted_fixture_order",readingStatus:"ready",usage:{status:"unknown"}});
  assert.equal(row.used,true);assert.equal(row.usageStatus,"used");assert.equal(row.usageLabel,"Utilisée");assert.equal(row.reference,"trusted_fixture_order");assert.equal(row.reading,"Prête");
});

test("confirmed payment without a dossier remains distinct from an actual recorded invitation use",()=>{
  const row=invitationAdminRow({kind:"discount10",status:"available",usedAt:null,mail:{status:"sent"},usage:{status:"payment_confirmed",reference:null}});
  assert.equal(row.used,false);assert.equal(row.usedAt,null);assert.equal(row.usageStatus,"payment_confirmed");assert.equal(row.usageLabel,"Payé — lecture à créer");assert.equal(row.reference,null);assert.equal(row.reading,null);
});

test("the admin shell has no inline client data, a protected navigation target and an honest delivery notice",()=>{
  const html=renderAdminInvitationsPage();
  assert.match(html,/noindex,nofollow/);assert.match(html,/no-referrer/);assert.match(html,/\/admin-invitations\.js/);assert.match(html,/pas l’arrivée dans la boîte de réception/);assert.match(html,/8 € à payer/);
  const source=readFileSync(new URL("../public/admin-invitations.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/\.innerHTML\s*=/);assert.match(source,/credentials: "same-origin"/);assert.match(source,/send-email-invitation/);
});

const app=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
function invitationNoteHarness(language="fr"){
  const nodes=new Map();
  const node=()=>({hidden:false,value:"",readOnly:false,textContent:"",append(){},replaceChildren(){},setAttribute(){},addEventListener(){}});
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector)};
  $("#express-form").querySelector=()=>$("#fixture-email");
  $("#express-form").before=()=>{};
  $("#pay-promo").closest=()=>$("#fixture-promo-box");
  const legacy="Fixture Stripe payment. Kept for 30 days.";
  const ctx=vm.createContext({$,state:{emailInvitation:{active:true,status:"available",invitation:invitation("free")},promoQuote:null,config:{codesEnabled:true}},document:{createElement:node},invitationStrings,currentLanguage:()=>language,uiStrings:()=>({payNote:legacy}),renderQuote:()=>{},setNodeText:(selector,value)=>{$(selector).textContent=value}});
  const start=app.indexOf("function renderEmailInvitation(");const end=app.indexOf("\n}",start)+2;
  vm.runInContext(app.slice(start,end)+"\nglobalThis.renderInvitation=renderEmailInvitation",ctx);
  return {ctx,node:$,legacy,render:()=>ctx.renderInvitation()};
}

for(const language of ["fr","en","de","es","it","pt","no","da","nl"]){
  test(`the actual free e-mail invitation note avoids Stripe and keeps retention (${language})`,()=>{
    const h=invitationNoteHarness(language);h.render();
    assert.equal(h.node("#pay-note").textContent,invitationStrings(language).freeNote);
    assert.match(h.node("#pay-note").textContent,/30/);assert.doesNotMatch(h.node("#pay-note").textContent,/Stripe/);
    vm.runInContext('state.emailInvitation.invitation.kind="discount10";state.emailInvitation.invitation.quote={baseCents:1800,totalCents:800,discountCents:1000,currency:"eur"}',h.ctx);h.render();
    assert.equal(h.node("#pay-note").textContent,h.legacy);
    vm.runInContext('state.emailInvitation.active=false',h.ctx);h.node("#test-code").value="fixture_legacy_code";h.render();
    assert.equal(h.node("#pay-note").textContent,h.legacy);
  });
}

function paymentHarness(kind="free",status="available"){
  const nodes=new Map();const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:"",hidden:false,disabled:false,checked:selector==="#ai-consent",textContent:""});return nodes.get(selector)};
  $("#test-code").value="fixture_gift_must_be_ignored";
  const calls=[],generations=[],messages=[],stripe=[];
  const ctx=vm.createContext({$,state:{config:{payments:{publishableKey:"fixture_public"}},emailInvitation:{active:true,status,invitation:invitation(kind)},emailInvitationToken:token,pendingReadingBody:{deliveryEmail:"reader@example.invalid"},promoQuote:null},uiStrings:()=>({submit:"Launch",payStart:"Pay",payPreparing:"Wait",payPaymentError:"Payment unavailable",payPromoUnavailable:"Quote unavailable"}),createPromoQuoteController,
    api:async(path,options)=>{calls.push({path,body:options.body});if(path==="/api/public/price-quote")return {quote:quote("discount10")};if(path==="/api/public/checkout-session")return {sessionId:"fixture_session",clientSecret:"fixture_secret"};throw Error("Unexpected")},
    renderPromoQuote:()=>{},renderEmailInvitation:()=>{},setPayStatus:()=>{},showMessage:(...a)=>messages.push(a),testCodeInput:$("#test-code"),runGeneration:async(...a)=>generations.push(a),embeddedCheckout:null,
    loadStripeJs:async()=>()=>({initEmbeddedCheckout:async options=>{stripe.push(options);return {mount(){},destroy(){}}}})});
  vm.runInContext(app.slice(app.indexOf("const promoQuotes ="),app.indexOf("\nfunction syncPaymentAvailability")),ctx);
  const startSync=app.indexOf("function syncPaymentAvailability(");const endSync=app.indexOf("\n}",startSync)+2;vm.runInContext(app.slice(startSync,endSync),ctx);
  vm.runInContext('promoQuotes.setInvitationContext(state.emailInvitation.invitation.kind === "discount10")',ctx);
  const start=app.indexOf("  const startPayment = async () => {");const end=app.indexOf("\n  // Accès gratuit de test",start);vm.runInContext(app.slice(start,end)+"\nglobalThis.startPayment=startPayment",ctx);
  return {calls,generations,messages,stripe,node:$,start:()=>ctx.startPayment(),ctx};
}

test("the actual free invitation payment handler starts generation without Stripe or code stacking",async()=>{
  const h=paymentHarness("free");await h.start();assert.deepEqual(h.calls,[]);assert.deepEqual(h.generations,[[null,null]]);assert.deepEqual(h.stripe,[]);
});

test("the actual discount invitation handler transports only its token and server quote guard",async()=>{
  const h=paymentHarness("discount10");await h.start();
  assert.equal(h.calls.length,2);assert.equal(h.calls[0].body.invitationToken,token);assert.equal("promoCode" in h.calls[0].body,false);
  assert.equal(h.calls[1].body.invitationToken,token);assert.equal(h.calls[1].body.expectedTotalCents,800);assert.equal("promoCode" in h.calls[1].body,false);assert.equal(h.stripe.length,1);
});

test("a confirmed invitation payment resumes its existing session without creating checkout or calling Stripe",async()=>{
  const h=paymentHarness("discount10");
  vm.runInContext('state.emailInvitation.invitation.paymentConfirmed=true;state.emailInvitation.invitation.checkoutSessionId="cs_test_fixture_paid"',h.ctx);
  await h.start();
  assert.equal(h.calls.length,0);assert.equal(h.stripe.length,0);assert.deepEqual(h.generations,[["cs_test_fixture_paid"]]);
});

test("a paid recovery response requires a valid Stripe session and the discount benefit",async()=>{
  for(const bad of [invitation("discount10",{paymentConfirmed:true,checkoutSessionId:"https://hostile.invalid"}),invitation("free",{paymentConfirmed:true,checkoutSessionId:"cs_test_fixture_paid"})]){
    const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:storage(),requestResolve:async()=>({invitation:bad})});
    await c.resolve();assert.equal(c.snapshot().status,"unavailable");
  }
  const c=createEmailInvitationController({href:`${origin}/#invitation=${token}`,storage:storage(),requestResolve:async()=>({invitation:invitation("discount10",{paymentConfirmed:true,checkoutSessionId:"cs_test_fixture_paid"})})});
  await c.resolve();assert.equal(c.snapshot().invitation.paymentConfirmed,true);assert.equal(c.snapshot().invitation.checkoutSessionId,"cs_test_fixture_paid");
});

for(const status of ["loading","unresolved","used","unavailable"]){
  test(`the actual payment handler blocks an invitation in status ${status}`,async()=>{
    const h=paymentHarness("discount10",status);await h.start();assert.equal(h.calls.length,0);assert.equal(h.generations.length,0);assert.equal(h.stripe.length,0);
  });
}

test("the actual reading request includes the invitation token without a raw code and clears it only after success",async()=>{
  for(const fails of [false,true]){
    const calls=[];let completed=0;const nodes=new Map();const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:"",hidden:false,disabled:false});return nodes.get(selector)};
    const button={textContent:"Launch",disabled:false};$("#express-form").querySelector=()=>button;
    const ctx=vm.createContext({$,state:{pendingReadingBody:{deliveryEmail:"reader@example.invalid",birthDate:"2000-01-01"},emailInvitationToken:token},uiStrings:()=>({submit:"Launch",testCodeApplied:"Free",recoveryFailed:"Failed"}),api:async(path,options)=>{calls.push({path,body:options.body});if(fails)throw Error("fixture failure");return {html:"<p>Fixture</p>",markdown:"Fixture",freeAccess:true}},showMessage:()=>{},tokenFromDeliveryLink:()=>null,completePaymentAttempt:()=>{completed++},syncPaymentAvailability:()=>{}});
    const start=app.indexOf('  const runGeneration = async (paymentSessionId');const end=app.indexOf('\n  form.addEventListener("submit"',start);
    vm.runInContext(app.slice(start,end)+'\nglobalThis.generate=runGeneration',ctx);
    await ctx.generate(null);
    assert.equal(calls[0].path,"/api/public/readings");assert.equal(calls[0].body.invitationToken,token);assert.equal("accessCode" in calls[0].body,false);assert.equal("testCode" in calls[0].body,false);assert.equal(completed,fails?0:1);
  }
});

test("invalid invitations are blocked before a birth form can create an order and tokens never enter localStorage",()=>{
  const submitStart=app.indexOf('form.addEventListener("submit", async (event)');const submit=app.slice(submitStart,app.indexOf('\n  $("#guest-download-html")',submitStart));
  assert.match(submit,/state\.emailInvitation\.status !== "available"/);
  assert.doesNotMatch(readFileSync(new URL("../public/email-invitations.js",import.meta.url),"utf8"),/localStorage\.(setItem|getItem)/);
});
