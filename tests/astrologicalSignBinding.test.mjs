import assert from 'node:assert/strict';
import test from 'node:test';
import {detectAstrologicalTextFacts,validateStructuredSection} from '../src/deliverables/factualClaimsValidator.mjs';
const bodies={Sun:'Soleil',Moon:'Lune',Mercury:'Mercure',Venus:'Vénus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturne',Uranus:'Uranus',Neptune:'Neptune',Pluto:'Pluton'};
const signs={Aries:'Bélier',Taurus:'Taureau',Gemini:'Gémeaux',Cancer:'Cancer',Leo:'Lion',Virgo:'Vierge',Libra:'Balance',Scorpio:'Scorpion',Sagittarius:'Sagittaire',Capricorn:'Capricorne',Aquarius:'Verseau',Pisces:'Poissons'};
const angles={ascendant:'Ascendant',descendant:'Descendant',midheaven:'Milieu du Ciel',imumCoeli:'Fond du Ciel'};
const evidence=(body,sign)=>({evidenceId:`${body}.${sign}`,type:'NATAL_BODY_SIGN',value:{body,sign}});
function validate(refs,text){const ids=refs.map(e=>e.evidenceId);return validateStructuredSection({dossierEvidence:{evidence:refs},sectionPlan:{sectionId:'relationships',primaryEvidenceRefs:ids,secondaryEvidenceRefs:[],allowedInterpretationRuleRefs:[],evidencePackets:[{packetId:'p',evidenceRefs:ids,claims:[]}],blockPlans:[{blockId:'block1',packetRefs:['p']}]},section:{sectionId:'relationships',blocks:[{blockId:'block1',text}]}});}
const placements=text=>detectAstrologicalTextFacts(text).filter(f=>['NATAL_BODY_SIGN','ANGLE_SIGN'].includes(f.type));
for(const [body,name] of Object.entries(bodies))test(`sign binding: ${body} retains all 12 genuine placements and rejects wrong proofs`,()=>{
 for(const [sign,word] of Object.entries(signs))for(const text of [`${name} en ${word}.`,`${name} est dans le signe de ${word}.`,`${name}, situé en ${word}, invite à réfléchir.`,`${name} is in ${sign}.`]){
  assert.ok(placements(text).some(f=>f.body===body&&f.sign===sign),text);
  assert.equal(validate([evidence(body,sign)],text).ok,true,text);
  const wrong=sign==='Libra'?'Aquarius':'Libra';const result=validate([evidence(body,wrong)],text);assert.ok(result.issues.some(i=>i.code==='undeclared_text_fact'&&i.fact?.body===body&&i.fact?.sign===sign),text);
 }
});
test('sign binding: exact Claude relationships sentence contains only the two evidenced facts',()=>{
 const text='Sur le plan relationnel, votre dossier s’appuie ici sur deux repères seulement : une Lune en Balance et une Vénus en Verseau.';
 assert.deepEqual(placements(text),[{type:'NATAL_BODY_SIGN',body:'Moon',sign:'Libra'},{type:'NATAL_BODY_SIGN',body:'Venus',sign:'Aquarius'}]);
 assert.equal(validate([evidence('Moon','Libra'),evidence('Venus','Aquarius')],text).ok,true);
 assert.equal(validate([evidence('Moon','Libra')],text).ok,false);
});
test('sign binding: distinct subjects and sentence boundaries never borrow a subsequent sign',()=>{
 for(const separator of [' et une ','. Une ','; une ','! Une ','? Une ','\nUne ','.\nUne ', ', tandis que ']){
  const text=`Une Lune en Balance${separator}Vénus en Verseau.`;
  assert.deepEqual(placements(text),[{type:'NATAL_BODY_SIGN',body:'Moon',sign:'Libra'},{type:'NATAL_BODY_SIGN',body:'Venus',sign:'Aquarius'}],text);
 }
 assert.deepEqual(placements('La Lune soutient Vénus en Verseau.'),[{type:'NATAL_BODY_SIGN',body:'Venus',sign:'Aquarius'}]);
 assert.deepEqual(placements('La Lune est importante. En Verseau, une autre piste.'),[]);
});
test('sign binding: a genuine unauthorized Moon in Aquarius remains blocking beside authorized Venus',()=>{
 for(const text of ['La Lune est en Verseau. Vénus est en Verseau.','La Lune en Verseau et Vénus en Verseau.','La Lune et Vénus sont en Verseau.','La Lune, Vénus et Mars sont en Verseau.']){
  const result=validate([evidence('Moon','Libra'),evidence('Venus','Aquarius'),evidence('Mars','Aquarius')],text);
  assert.ok(result.issues.some(i=>i.code==='undeclared_text_fact'&&i.fact?.body==='Moon'&&i.fact?.sign==='Aquarius'),text);
 }
});
for(const [angle,name] of Object.entries(angles))test(`sign binding: ${angle} keeps genuine placements separate from nearby planets`,()=>{
 for(const [sign,word] of Object.entries(signs))assert.ok(placements(`${name} est en ${word}.`).some(f=>f.angle===angle&&f.sign===sign));
 assert.deepEqual(placements(`${name} en Balance et Vénus en Verseau.`),[{type:'NATAL_BODY_SIGN',body:'Venus',sign:'Aquarius'},{type:'ANGLE_SIGN',angle,sign:'Libra'}]);
 assert.ok(!placements(`Lune en Balance et ${name} en Verseau.`).some(f=>f.body==='Moon'&&f.sign==='Aquarius'));
});
test('sign binding: shared coordinated placement still detects each subject, including angles',()=>{
 for(const text of ['La Lune et Vénus en Balance.','La Lune et votre Vénus sont en Balance.','Moon and Venus in Libra.','La Lune ainsi que Vénus sont en Balance.'])assert.deepEqual(placements(text),[{type:'NATAL_BODY_SIGN',body:'Moon',sign:'Libra'},{type:'NATAL_BODY_SIGN',body:'Venus',sign:'Libra'}]);
 const facts=placements('La Lune et l’Ascendant sont en Balance.');
 // An elided determiner must not turn a shared placement into a false negative.
 assert.ok(facts.some(f=>f.body==='Moon'&&f.sign==='Libra'));
 assert.ok(facts.some(f=>f.angle==='ascendant'&&f.sign==='Libra'));
});
test('sign binding: calendar mars does not hide a real Mars placement or another subject',()=>{
 assert.ok(placements('La Lune le 9 mars est en Balance.').some(f=>f.body==='Moon'&&f.sign==='Libra'));
 assert.deepEqual(placements('Mars en Balance le 9 mars, et Vénus en Verseau.'),[{type:'NATAL_BODY_SIGN',body:'Venus',sign:'Aquarius'},{type:'NATAL_BODY_SIGN',body:'Mars',sign:'Libra'}]);
});
