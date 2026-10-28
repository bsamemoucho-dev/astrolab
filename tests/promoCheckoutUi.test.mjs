import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPromoQuoteController} from '../public/promo-checkout.js';

const codeA='TESTCODEABCD';
const codeB='MOCKCODEEFGH';
const unknown='INVALIDABCDE';
const full=()=>({version:'lastro-pricing@1.1.0',currency:'eur',baseCents:1800,discountCents:0,totalCents:1800,valid:false,reason:'empty'});
const discounted=()=>({...full(),discountCents:1000,totalCents:800,valid:true,reason:'applied'});
const rejected=()=>({...full(),reason:'unknown'});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const pricingSource=readFileSync(new URL('../public/pricing-ui.js',import.meta.url),'utf8');

function declaration(name){
  const start=app.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,name);
  const end=app.indexOf('\n}',start);
  assert.notEqual(end,-1,name);
  return app.slice(start,end+2);
}
function harness({quoteRequest=async code=>code?discounted():full(),checkoutRequest=async()=>({sessionId:'fixture_session',clientSecret:'fixture_secret'}),language='fr',realGeneration=false,readingRequest=async()=>({html:'<p>Fixture reading</p>',markdown:'Fixture reading'}),stripeFailures=0,statusRequest=async()=>({status:'failed',reference:'fixture_reference'}),deliveryRequest=async()=>({delivery:{status:'ready',reading:{html:'<p>Fixture reading</p>'}}})}={}){
  const nodes=new Map();
  const $=selector=>{
    if(!nodes.has(selector))nodes.set(selector,{textContent:'',hidden:false,value:'',disabled:false,checked:selector==='#ai-consent'});
    return nodes.get(selector);
  };
  const requests=[],generationCalls=[],messages=[],stripeCalls=[],recoveryStates=[];
  const storage=new Map();
  const submitButton={textContent:'Fixture submit',disabled:false};
  $('#express-form').querySelector=()=>submitButton;
  for(const selector of ['#express-payment'])$(selector).scrollIntoView=()=>{};
  const api=async(path,options={})=>{
    requests.push({path,body:options.body});
    if(path==='/api/public/price-quote')return {quote:await quoteRequest(options.body.promoCode)};
    if(path==='/api/public/checkout-session')return checkoutRequest(options.body);
    if(path==='/api/public/readings')return readingRequest(options.body);
    if(path.includes('/status'))return statusRequest();
    if(path.includes('/deliveries/'))return deliveryRequest();
    throw new Error('Unexpected offline request');
  };
  const embedded={mount:selector=>stripeCalls.push({mount:selector}),destroy:()=>stripeCalls.push({destroy:true})};
  const Stripe=key=>({initEmbeddedCheckout:async options=>{stripeCalls.push({key,options});return embedded}});
  const context=vm.createContext({Intl,$,api,createPromoQuoteController,
    testCodeInput:$('#test-code'),embeddedCheckout:null,
    runGeneration:async(...args)=>{generationCalls.push(args)},setPayStatus:()=>{},
    loadStripeJs:async()=>{if(stripeFailures-->0)throw new Error('offline Stripe.js');return Stripe},showMessage:(text,error)=>messages.push({text,error}),__language:language,
    syncTestCodeAvailability:()=>{},PENDING_READING_STORAGE_KEY:'fixture_pending',localStorage:{setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    renderDeliveryBox:()=>{},renderRecoveryState:status=>recoveryStates.push(status),
    tokenFromDeliveryLink:link=>link?String(link).split('/').at(-1):null,readingPollTimer:null,pollReadingJob:async()=>{},clearTimeout:()=>{},setTimeout:()=>0,
    window:{location:{href:'https://fixture.invalid/',pathname:'/'}},recoveryTokenFromPath:()=>null,
    ensureResolvedPlace:async()=>true,formPayload:()=>({deliveryEmail:'fixture@example.invalid',birthDate:'2000-01-01',timePrecision:'known'}),
    isValidEmail:()=>true,field:()=>({value:''}),deliverableParentsFromForm:()=>null,form:$('#express-form')});
  vm.runInContext(pricingSource.replaceAll('export function ','function '),context);
  vm.runInContext(app.slice(app.indexOf('const state ='),app.indexOf('const PLACE_STRINGS')),context);
  for(const name of ['currentLanguage','uiStrings','setNodeText','formatMoney','formatEuros','renderPricingCopy','renderQuote','syncPaymentAvailability','renderPromoQuote','refreshQuote','applyPricing']){
    const source=declaration(name);
    vm.runInContext(name==='refreshQuote'?'async '+source:source,context);
  }
  vm.runInContext(app.slice(app.indexOf('const promoQuotes ='),app.indexOf('\nfunction syncPaymentAvailability')),context);
  vm.runInContext(`state.config={pricing:{...${JSON.stringify(full())},promoDiscountCents:0,promoCode:null},payments:{publishableKey:'fixture_publishable'}};state.language=__language;state.pendingReadingBody={fixture:true};`,context);
  const helperStart=app.indexOf('  const completePaymentAttempt = () => {');
  const start=app.indexOf('  const startPayment = async () => {');
  vm.runInContext(app.slice(helperStart,start),context);
  if(realGeneration){
    const generationStart=app.indexOf('  const runGeneration = async (paymentSessionId');
    const generationEnd=app.indexOf('\n  form.addEventListener("submit"',generationStart);
    vm.runInContext(app.slice(generationStart,generationEnd),context);
    const deliveryStart=app.indexOf('  const showDelivery = (delivery');
    const deliveryEnd=app.indexOf('\n  pollReadingJob =',deliveryStart);
    vm.runInContext(app.slice(deliveryStart,deliveryEnd)+'\nglobalThis.__delivery=showDelivery;',context);
    const formStart=app.indexOf('  form.addEventListener("submit", async (event)');
    const formEnd=app.indexOf('\n  $("#guest-download-html")',formStart);
    const fragment=app.slice(formStart,formEnd);
    vm.runInContext('globalThis.__submit='+fragment.slice(fragment.indexOf('async (event)'),fragment.lastIndexOf(');'))+';',context);
    const pollStart=app.indexOf('  pollReadingJob = async (readingId');
    const pollEnd=app.indexOf('\n  const loadRecovery =',pollStart);
    vm.runInContext(app.slice(pollStart,pollEnd),context);
    const retryStart=app.indexOf('  $("#recovery-retry")?.addEventListener("click", async ()');
    const retryEnd=app.indexOf('\n  // Affiche une livraison',retryStart);
    const retry=app.slice(retryStart,retryEnd);
    vm.runInContext('globalThis.__retry='+retry.slice(retry.indexOf('async ()'),retry.lastIndexOf(');'))+';',context);
  }
  const end=app.indexOf('\n  // Accès gratuit de test',start);
  vm.runInContext(app.slice(start,end)+'\nglobalThis.__startPayment=startPayment;',context);
  const run=expression=>vm.runInContext(expression,context);
  return {node:$,requests,generationCalls,messages,stripeCalls,recoveryStates,storage,run,
    submit:()=>context.__submit({preventDefault(){}}),
    deliver:delivery=>{context.__deliveryValue=delivery;return run('showDelivery(__deliveryValue,{token:"fixture_token"})')},
    retry:()=>context.__retry(),
    setCode:code=>{$('#pay-promo').value=code;context.__code=code;run('promoQuotes.setCode(__code)')},
    check:()=>run('refreshQuote()'),start:()=>context.__startPayment()};
}

test('fixtures contain only invented twelve-character codes',()=>{
  for(const code of [codeA,codeB,unknown])assert.match(code,/^[A-Z]{12}$/);
});

test('the controller keeps the server quote and strips private response fields',async()=>{
  const calls=[];
  const c=createPromoQuoteController({requestQuote:async code=>{calls.push(code);return {...discounted(),stripePromotionCodeId:'fixture_private',appliedCode:'fixture_hidden'}}});
  c.setCode(codeA);
  const ticket=await c.prepareCheckout();
  assert.deepEqual(calls,[codeA]);
  assert.equal(ticket.quote.totalCents,800);
  assert.equal(c.isCurrent(ticket),true);
  assert.equal('stripePromotionCodeId' in ticket.quote,false);
  assert.equal('appliedCode' in ticket.quote,false);
});

test('an invalid or exhausted code blocks checkout instead of reverting to full price',async()=>{
  const c=createPromoQuoteController({requestQuote:async()=>rejected()});
  c.setCode(unknown);
  await assert.rejects(c.prepareCheckout(),{code:'PRICE_QUOTE_REQUIRED'});
  assert.equal(c.snapshot().status,'rejected');
  assert.equal(c.snapshot().quote,null);
});

test('transport failures and absent or malformed quotes never authorize checkout',async()=>{
  const invalid=[null,{}, {...discounted(),totalCents:801},{...discounted(),totalCents:NaN},{...discounted(),discountCents:0},{...discounted(),currency:'invalid'}, {...discounted(),valid:false}];
  for(const response of invalid){
    const c=createPromoQuoteController({requestQuote:async()=>response});
    c.setCode(codeA);
    await assert.rejects(c.prepareCheckout(),{code:'PRICE_QUOTE_REQUIRED'});
    assert.equal(c.snapshot().quote,null);
  }
  const c=createPromoQuoteController({requestQuote:async()=>{throw new Error('fixture transport error')}});
  c.setCode(codeA);
  await assert.rejects(c.prepareCheckout(),{code:'PRICE_QUOTE_REQUIRED'});
  assert.equal(c.snapshot().status,'error');
});

test('a response for an old code cannot validate the new code',async()=>{
  const first=deferred(),second=deferred();
  const c=createPromoQuoteController({requestQuote:code=>code===codeA?first.promise:second.promise});
  c.setCode(codeA);const a=c.refresh();
  c.setCode(codeB);const b=c.refresh();
  second.resolve(discounted());await b;
  first.resolve({...discounted(),totalCents:100,discountCents:1700});await a;
  assert.equal(c.snapshot().code,codeB);
  assert.equal(c.snapshot().quote.totalCents,800);
});

test('out-of-order responses for the same code cannot overwrite a newer failure',async()=>{
  const first=deferred(),second=deferred();let count=0;
  const c=createPromoQuoteController({requestQuote:()=>++count===1?first.promise:second.promise});
  c.setCode(codeA);const a=c.refresh();const b=c.refresh();
  second.reject(new Error('offline fixture'));await b;
  first.resolve(discounted());await a;
  assert.equal(c.snapshot().status,'error');
  assert.equal(c.snapshot().quote,null);
});

test('changing a code invalidates its payment ticket, including A → B → A',async()=>{
  const c=createPromoQuoteController({requestQuote:async()=>discounted()});
  c.setCode(codeA);const ticket=await c.prepareCheckout();
  c.setCode(codeB);c.setCode(codeA);
  assert.equal(c.isCurrent(ticket),false);
  assert.equal(c.snapshot().status,'unverified');
});

test('removing a code restores a fresh server quote for the normal price',async()=>{
  const c=createPromoQuoteController({requestQuote:async code=>code?discounted():full()});
  c.setCode(codeA);await c.refresh();
  c.setCode('');const ticket=await c.prepareCheckout();
  assert.equal(ticket.promoCode,'');
  assert.equal(ticket.quote.totalCents,1800);
});

test('legacy code lengths remain accepted while punctuation-only input is never accepted as a discount',async()=>{
  const c=createPromoQuoteController({requestQuote:async code=>code==='-'?full():discounted()});
  c.setCode('old');await c.prepareCheckout();
  c.setCode('-');await assert.rejects(c.prepareCheckout(),{code:'PRICE_QUOTE_REQUIRED'});
});

for(const language of ['fr','en','de','es','it','pt','no','da','nl']){
  test(`the actual UI shows 18 − 10 = 8 and separate localized invitations (${language})`,async()=>{
    const h=harness({language});
    h.setCode(codeA);
    assert.equal(h.node('#pay-start').disabled,true);
    assert.doesNotMatch(h.node('#pay-price-total').textContent,/8[,.]00/);
    await h.check();
    assert.equal(h.node('#pay-start').disabled,false);
    assert.match(h.node('#pay-price-total').textContent,/8[,.]00\s*€/u);
    const message=h.node('#pay-promo-status').textContent;
    for(const number of ['18','10','8'])assert.match(message,new RegExp(`${number}[,.]00\\s*€`,'u'));
    assert.doesNotMatch(message,/undefined|\{\w+\}/);
    assert.equal(h.run('uiStrings().payPromoLabel!==uiStrings().testCodeLabel'),true);
    assert.doesNotMatch(message,new RegExp(codeA));
  });
}

test('a typed invalid code or failed quote disables the real payment button and sends no checkout request',async()=>{
  for(const quoteRequest of [async()=>rejected(),async()=>{throw new Error('offline')}]){
    const h=harness({quoteRequest});h.setCode(unknown);
    await h.check();assert.equal(h.node('#pay-start').disabled,true);
    await h.start();
    assert.equal(h.requests.filter(x=>x.path.includes('checkout-session')).length,0);
    assert.equal(h.stripeCalls.length,0);
  }
});

test('the actual payment path sends only code, language and the verified server amount/currency guard',async()=>{
  const h=harness();h.setCode(codeA);await h.check();
  await h.start();
  const checkout=h.requests.find(x=>x.path.endsWith('checkout-session'));
  assert.deepEqual({...checkout.body},{promoCode:codeA,language:'fr',expectedTotalCents:800,expectedCurrency:'eur'});
  assert.equal(h.stripeCalls.filter(x=>x.mount).length,1);
  assert.equal(h.node('#pay-promo').disabled,true);
  assert.equal(h.node('#test-code').disabled,true);
  assert.equal(h.generationCalls.length,0);
});

test('normal payment still uses an empty code and server-confirmed eighteen euros',async()=>{
  const h=harness();await h.start();
  const checkout=h.requests.find(x=>x.path.endsWith('checkout-session'));
  assert.equal(checkout.body.promoCode,'');
  assert.equal(checkout.body.expectedTotalCents,1800);
  assert.equal(h.stripeCalls.filter(x=>x.mount).length,1);
});

test('the existing six-character free invitation bypasses Stripe and the paid quote',async()=>{
  const h=harness();h.node('#test-code').value='GIFTAA';
  await h.start();
  assert.equal(h.requests.length,0);
  assert.deepEqual(h.generationCalls,[[null,'GIFTAA']]);
  assert.equal(h.stripeCalls.length,0);
});

test('using both a paid discount and a free invitation is blocked without any external request',async()=>{
  const h=harness();h.setCode(codeA);h.node('#test-code').value='GIFTAA';
  await h.start();
  assert.equal(h.node('#pay-start').disabled,true);
  assert.equal(h.requests.length,0);
  assert.equal(h.generationCalls.length,0);
});

test('double-clicking during quote confirmation creates at most one checkout',async()=>{
  const q=deferred();const h=harness({quoteRequest:()=>q.promise});h.setCode(codeA);
  const a=h.start();const b=h.start();q.resolve(discounted());await Promise.all([a,b]);
  assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).length,1);
  assert.equal(h.stripeCalls.filter(x=>x.mount).length,1);
});

test('a price-change response revalidates and requires another deliberate click',async()=>{
  let attempts=0;
  const h=harness({checkoutRequest:async()=>{if(++attempts===1){const error=new Error('fixture');error.code='PRICING_CHANGED';throw error}return {sessionId:'fixture_session',clientSecret:'fixture_secret'}}});
  h.setCode(codeA);await h.start();
  assert.equal(attempts,1);
  assert.equal(h.stripeCalls.length,0);
  assert.equal(h.node('#pay-start').disabled,false);
  assert.match(h.messages.at(-1).text,/prix a changé/i);
  await h.start();assert.equal(attempts,2);
  assert.equal(h.stripeCalls.filter(x=>x.mount).length,1);
});

test('a code edited while session creation is pending never mounts stale checkout',async()=>{
  const session=deferred();const h=harness({checkoutRequest:()=>session.promise});h.setCode(codeA);
  const starting=h.start();
  while(!h.requests.some(x=>x.path.endsWith('checkout-session')))await Promise.resolve();
  h.setCode(codeB);session.resolve({sessionId:'fixture_session',clientSecret:'fixture_secret'});await starting;
  assert.equal(h.stripeCalls.length,0);
  assert.equal(h.node('#pay-start').disabled,true);
});

test('clearing a discount immediately removes the old eight-euro display even if the new quote fails',async()=>{
  let fails=false;const h=harness({quoteRequest:async code=>{if(fails)throw new Error('offline');return code?discounted():full()}});
  h.setCode(codeA);await h.check();fails=true;h.setCode('');await h.check();
  assert.match(h.node('#pay-price-total').textContent,/18[,.]00\s*€/u);
  await h.start();assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).length,0);
});

test('the promotional input is accessible, separate and omitted from generation form data',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/<label for="pay-promo" id="pay-promo-label">/);
  assert.match(html,/id="pay-promo-status"[^>]*aria-live="polite"/);
  const input=/<input id="pay-promo"[^>]*>/.exec(html)?.[0];assert.ok(input);
  assert.doesNotMatch(input,/\bname=|\bvalue=|\bpattern=/);
  assert.match(input,/autocomplete="off"/);
  assert.match(html,/id="test-code"/);
  assert.doesNotMatch(app,/allow_promotion_codes|localStorage\.(?:setItem|getItem)\([^\n]*promo|sessionStorage\.(?:setItem|getItem)\([^\n]*promo/);
});


test('the displayed quote and the checkout guard use the server currency, even after a catalogue change',async()=>{
  const h=harness({quoteRequest:async()=>({...discounted(),currency:'usd'})});
  h.setCode(codeA);await h.check();
  assert.match(h.node('#pay-price-total').textContent,/\$US/);
  assert.match(h.node('#pay-text').textContent,/\$US/);
  assert.match(h.node('#pay-promo-status').textContent,/\$US/);
  await h.start();
  const checkout=h.requests.find(x=>x.path.endsWith('checkout-session'));
  assert.equal(checkout.body.expectedCurrency,'usd');
});


test('after a delivered reading, a second normal order can create its own checkout',async()=>{
  const h=harness({realGeneration:true});h.setCode(codeA);await h.start();
  await h.stripeCalls.find(x=>x.options).options.onComplete();
  assert.equal(h.run('state.paymentMounted'),false);
  assert.equal(h.run('state.pendingCheckoutSession'),null);
  assert.equal(h.run('state.paymentSessionId'),null);
  assert.equal(h.node('#pay-start').hidden,false);
  assert.equal(h.node('#pay-continue').hidden,true);
  assert.equal(h.node('#pay-promo').value,'');
  assert.equal(h.node('#ai-consent').checked,false);
  h.run('state.config.payments.configured=true');
  await h.submit();h.node('#ai-consent').checked=true;await h.start();
  assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).length,2);
  assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).at(-1).body.expectedTotalCents,1800);
});

test('after a delivered reading, a free invitation remains usable without another checkout',async()=>{
  const h=harness({realGeneration:true});await h.start();
  await h.stripeCalls.find(x=>x.options).options.onComplete();
  h.run('state.config.payments.configured=true');await h.submit();
  h.node('#test-code').value='GIFTAA';h.node('#ai-consent').checked=true;await h.start();
  const readings=h.requests.filter(x=>x.path==='/api/public/readings');
  assert.equal(readings.length,2);
  assert.equal(readings[1].body.paymentSessionId,null);
  assert.equal(readings[1].body.testCode,'GIFTAA');
  assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).length,1);
});

test('an unfinished payable checkout blocks a new form submission and retains its original body',async()=>{
  const h=harness({realGeneration:true});await h.start();
  assert.equal(h.run('preserveActiveOrder()'),true);
  await h.submit();
  assert.equal(h.run('state.pendingReadingBody.fixture'),true);
  assert.equal(h.run('state.paymentSessionId'),'fixture_session');
  assert.equal(h.run('state.pendingCheckoutSession.session.clientSecret'),'fixture_secret');
  assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).length,1);
});

test('a Stripe.js loading failure retries the same payable session without creating another',async()=>{
  const h=harness({realGeneration:true,stripeFailures:1});h.setCode(codeA);await h.start();
  assert.equal(h.run('state.paymentMounted'),false);
  assert.equal(h.run('state.paymentSessionId'),'fixture_session');
  assert.equal(h.node('#pay-promo').disabled,true);
  assert.equal(h.node('#pay-start').disabled,false);
  await h.start();
  assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).length,1);
  assert.equal(h.stripeCalls.filter(x=>x.mount).length,1);
});

test('a generation error retains the paid session, widget and original body; retry never buys again',async()=>{
  let calls=0;
  const h=harness({realGeneration:true,readingRequest:async()=>{if(++calls===1)throw new Error('offline generation failure');return {html:'<p>Ready fixture</p>'}}});
  await h.start();const callback=h.stripeCalls.find(x=>x.options).options.onComplete;
  await callback();
  assert.equal(h.run('state.paymentMounted'),true);
  assert.equal(h.run('state.paymentSessionId'),'fixture_session');
  assert.equal(h.run('state.pendingCheckoutSession.session.clientSecret'),'fixture_secret');
  await h.submit();assert.equal(h.run('state.pendingReadingBody.fixture'),true);
  await h.start();assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).length,1);
  await h.run('runGeneration(state.paymentSessionId)');assert.equal(h.run('state.paymentMounted'),false);
  assert.equal(h.requests.filter(x=>x.path==='/api/public/readings').length,2);
  assert.equal(h.requests.filter(x=>x.path==='/api/public/readings').every(x=>x.body.paymentSessionId==='fixture_session'),true);
});

test('queued then failed delivery keeps its recovery token and resumes without a new payment',async()=>{
  const h=harness({realGeneration:true,readingRequest:async()=>({readingId:'fixture_reading',reference:'fixture_reference',status:'queued',delivery:{link:'https://fixture.invalid/r/fixture_token'}})});
  await h.start();await h.stripeCalls.find(x=>x.options).options.onComplete();
  assert.equal(h.run('state.paymentMounted'),true);
  assert.equal(h.run('state.pendingReadingJob.status'),'failed');
  assert.equal(h.run('state.readingToken'),'fixture_token');
  assert.ok(h.storage.has('fixture_pending'));
  await h.submit();await h.start();
  assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).length,1);
  await h.retry();
  assert.ok(h.requests.some(x=>x.path==='/api/public/deliveries/fixture_token/regenerate'));
  assert.equal(h.run('state.paymentMounted'),false);
  assert.equal(h.run('state.pendingCheckoutSession'),null);
  assert.equal(h.storage.has('fixture_pending'),false);
});

test('ready without delivered HTML never releases an unfinished payment',async()=>{
  const h=harness({realGeneration:true,readingRequest:async()=>({status:'ready'})});
  await h.start();await h.stripeCalls.find(x=>x.options).options.onComplete();
  assert.equal(h.run('state.paymentMounted'),true);
  h.deliver({status:'ready',reading:{}});
  assert.equal(h.run('state.paymentMounted'),true);
  h.deliver({status:'failed'});
  assert.equal(h.run('state.paymentMounted'),true);
});

test('an explicitly public offer code is prefilled once and remains removed after an explicit edit',async()=>{
  const h=harness({quoteRequest:async code=>code===codeA?discounted():full()});
  h.run(`state.config.pricing={...state.config.pricing,promoCode:'${codeA}',promoDiscountCents:1000,totalCents:800}`);
  h.run('applyPricing()');await h.check();
  assert.equal(h.node('#pay-promo').value,codeA);
  assert.match(h.node('#pay-price-total').textContent,/8[,.]00/);
  h.run('state.promoInputEdited=true');h.setCode('');h.run('applyPricing()');await h.check();
  assert.equal(h.node('#pay-promo').value,'');
  assert.match(h.node('#pay-price-total').textContent,/18[,.]00/);
});


test('a late completion callback from the previous checkout cannot use a new order body',async()=>{
  const h=harness({realGeneration:true});await h.start();
  const oldCallback=h.stripeCalls.find(x=>x.options).options.onComplete;
  await oldCallback();
  h.run('state.config.payments.configured=true');await h.submit();h.node('#ai-consent').checked=true;await h.start();
  const before=h.requests.filter(x=>x.path==='/api/public/readings').length;
  await oldCallback();
  assert.equal(h.requests.filter(x=>x.path==='/api/public/readings').length,before);
  assert.equal(h.run('state.paymentMounted'),true);
});

test('duplicate Stripe completion events never restart a failed generation automatically',async()=>{
  const h=harness({realGeneration:true,readingRequest:async()=>{throw new Error('fixture generation failure')}});
  await h.start();const callback=h.stripeCalls.find(x=>x.options).options.onComplete;
  await callback();await callback();
  assert.equal(h.requests.filter(x=>x.path==='/api/public/readings').length,1);
  assert.equal(h.run('state.paymentMounted'),true);
  await h.run('runGeneration(state.paymentSessionId)');
  assert.equal(h.requests.filter(x=>x.path==='/api/public/readings').length,2);
  assert.equal(h.requests.filter(x=>x.path.endsWith('checkout-session')).length,1);
});
