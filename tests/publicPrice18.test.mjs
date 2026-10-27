import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const ROOT=new URL('../',import.meta.url);
const read=relative=>readFileSync(new URL(relative,ROOT),'utf8');
function listHtmlFiles(directory){
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()
    ?listHtmlFiles(join(directory,entry.name)):entry.name.endsWith('.html')?[join(directory,entry.name)]:[]);
}
const HTML_FILES=listHtmlFiles(fileURLToPath(new URL('public',ROOT))).map(path=>path.slice(fileURLToPath(ROOT).length));
const app=read('public/app.js');
const pricingSource=read('public/pricing-ui.js');
const LANGUAGES=['fr','en','de','es','it','pt','no','da','nl'];
const oldPrice=/(?:^|[^\d])5(?:[,.]00)?(?:\s|&nbsp;|&#160;)*(?:€|EUR|euros?)/im;
const pricing=(amount=1800)=>({version:'lastro-pricing@1.1.0',currency:'eur',baseCents:amount,totalCents:amount,promoCode:null,promoDiscountCents:0});

function declaration(name){
  const start=app.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,name);
  const end=app.indexOf('\n}',start);
  assert.notEqual(end,-1,name);
  return app.slice(start,end+2);
}
function harness({language='fr',config={pricing:pricing(),payments:{pricing:{...pricing(500),currency:'usd'}}},quote}={}){
  const nodes=new Map();
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',hidden:false});return nodes.get(selector)};
  const response=quote??{...pricing(),discountCents:0,valid:false,reason:'empty'};
  const context=vm.createContext({Intl,$,__config:config,__language:language,api:async()=>({quote:response})});
  vm.runInContext(pricingSource.replaceAll('export function ','function '),context);
  const prefix=app.slice(app.indexOf('const state ='),app.indexOf('const PLACE_STRINGS'));
  vm.runInContext(prefix,context);
  for(const name of ['currentLanguage','uiStrings','setNodeText','formatMoney','formatEuros','renderPricingCopy','renderQuote','refreshQuote','applyPricing']){
    let source=declaration(name);
    if(name==='refreshQuote')source='async '+source;
    vm.runInContext(source,context);
  }
  vm.runInContext('state.config=__config;state.language=__language;',context);
  return {run:expression=>vm.runInContext(expression,context),text:selector=>$(selector).textContent,node:$,context};
}

test('all public HTML pages advertise eighteen euros and no obsolete five-euro offer',()=>{
  assert.ok(HTML_FILES.length>=28,'homepage and every guide must be examined');
  for(const name of HTML_FILES){
    const html=read(name);
    assert.doesNotMatch(html,oldPrice,name);
    assert.match(html,/\b18\s*€/,name);
  }
  assert.doesNotMatch(app,oldPrice);
  // Price replacement must not alter unrelated waiting or birth-time values.
  assert.match(app,/setTimeout\(\(\) => printWindow\.print\(\), 500\)/);
  assert.match(read('public/index.html'),/<option value="15">± 15 min<\/option>/);
});

test('public pricing comes from the actual top-level API field, never payment credentials',()=>{
  const h=harness();
  assert.equal(h.run('publicPricingFromConfig(__config)'),h.context.__config.pricing);
  assert.equal(h.run('publicPricingFromConfig({payments:{pricing:__config.pricing}})'),null);
  assert.doesNotMatch(app,/state\.config\?\.payments\?\.pricing/);
});

for(const language of LANGUAGES){
  test(`server price is consistent in payment, offer and translated text (${language})`,async()=>{
    const h=harness({language});
    h.run('applyPricing()');
    await h.run('refreshQuote()');
    for(const selector of ['#pay-price-total','#offre-base','#offre-total','#pay-text','#offre-texte']){
      assert.match(h.text(selector),/18[,.]00\s*€/u,selector);
      assert.doesNotMatch(h.text(selector),/\{total\}|undefined|\$|\b5\s*€/u,selector);
    }
    assert.equal(h.node('#pay-price-base').hidden,true);
    assert.equal(h.node('#offre-remise-line').hidden,true);
    assert.equal(h.run(`UI_STRINGS[__language].payText===UI_EXTRA[__language].payText`),true);
    assert.equal(h.run(`UI_STRINGS[__language].payNote===UI_EXTRA[__language].payNote`),true);
    const text=h.run('UI_STRINGS[__language].payText');
    assert.match(text,/\{total\}/);
    assert.doesNotMatch(text,/pré.rempli|pre.filled|eingetragen|rellenado|inserito|preenchido|fylt|udfyldt|ingevuld/i);
  });
}

test('a server quote is displayed as received instead of hardcoding the new normal price',async()=>{
  const h=harness({quote:{...pricing(),totalCents:100,discountCents:1700,valid:true,reason:'applied'}});
  await h.run('refreshQuote()');
  assert.match(h.text('#pay-price-total'),/1[,.]00\s*€/u);
  assert.match(h.text('#pay-text'),/1[,.]00\s*€/u);
  assert.equal(h.node('#pay-price-base').hidden,false);
  const changed=harness({config:{pricing:pricing(2500)},quote:{...pricing(2500),discountCents:0,valid:false,reason:'empty'}});
  changed.run('applyPricing()');await changed.run('refreshQuote()');
  assert.match(changed.text('#pay-text'),/25[,.]00\s*€/u);
  assert.match(changed.text('#offre-total'),/25[,.]00\s*€/u);
});

test('missing or malformed public prices do not invent a zero-euro payment',()=>{
  const h=harness({config:{payments:{pricing:pricing(500)}}});
  h.run('renderPricingCopy()');
  assert.match(h.text('#pay-text'),/confirmé avant le paiement/);
  assert.doesNotMatch(h.text('#pay-text'),/\d|\{total\}|undefined/);
  const values=[null,{},[],{...pricing(),baseCents:-1},{...pricing(),totalCents:1800.5},{...pricing(),totalCents:1},{...pricing(),currency:'invalid'}];
  for(const value of values){
    h.context.__candidate=value;
    assert.equal(h.run('publicPricingFromConfig({pricing:__candidate})'),null);
  }
});

test('price configuration examples use 1800 cents and the cost estimator follows the server default',()=>{
  const example=read('.env.example');
  assert.match(example,/#ASTROLAB_PRICE_CENTS=1800/);
  assert.doesNotMatch(example,/#ASTROLAB_PRICE_CENTS=500/);
  const estimator=read('tools/estimate-cost.mjs');
  assert.match(estimator,/import \{ DEFAULT_PRICE_CENTS \} from "\.\.\/src\/payments\/pricing\.mjs"/);
  assert.match(estimator,/DEFAULT_PRICE_CENTS \/ 100/);
  assert.doesNotMatch(estimator,/Prix public constaté dans le dépôt : 5,00 EUR/);
});
