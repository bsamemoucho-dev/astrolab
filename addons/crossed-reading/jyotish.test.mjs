import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateJyotish,lahiriAyanamsha,meanLunarNodeTropical,classifySiderealLongitude,classifyNakshatra,LONGITUDE_TOLERANCE_DEGREES } from './jyotish.mjs';
const refs=JSON.parse(readFileSync(new URL('./fixtures/jyotish-reference.json',import.meta.url)));
const gap=(a,b)=>Math.abs(((a-b+540)%360)-180);
const BIRTH={birthDate:'1990-01-15',timePrecision:'exact',timeValue:'16:30',latitude:48.8566,longitude:2.3522,timeZone:'Europe/Paris'};
test('390 true Lahiri reference ayanamshas over 1901–2030 agree within one arcsecond',()=>{
 assert.equal(refs.ayanamshas.length,390);
 for(const [utc,reference] of refs.ayanamshas) assert.ok(gap(lahiriAyanamsha(utc),reference)*3600<1,utc);
 assert.ok(Math.abs(lahiriAyanamsha('1901-01-01T00:00:00Z')-lahiriAyanamsha('2030-12-31T12:00:00Z'))>1,'not a fixed offset');
});
for(const ref of refs.positions) test(`independent nine-point and angle sidereal reference ${ref.utc}`,()=>{
 const r=calculateJyotish({birth:{birthDate:ref.utc.slice(0,10),timePrecision:'exact',timeValue:ref.utc.slice(11,19),latitude:ref.latitude,longitude:ref.longitude,timeZone:'UTC'}});
 assert.equal(r.positions.length,9);
 for(const [body,longitude] of Object.entries(ref.siderealLongitudes)) assert.ok(gap(r.positions.find(p=>p.body===body).longitude,longitude)<LONGITUDE_TOLERANCE_DEGREES,`${body}: ${ref.utc}`);
 for(const key of ['ascendant','midheaven']) assert.ok(gap(r.angles[key].longitude,ref[key])<LONGITUDE_TOLERANCE_DEGREES,`${key}: ${ref.utc}`);
 const rahu=r.positions.find(p=>p.body==='Rahu'),ketu=r.positions.find(p=>p.body==='Ketu');
 assert.ok(Math.abs(gap(rahu.longitude,ketu.longitude)-180)<1e-8);
 assert.equal(rahu.kind,'mean_lunar_node'); assert.equal(ketu.kind,'mean_lunar_node');
 assert.equal(r.frame.zodiac,'sidereal'); assert.equal(r.interpretationStatus,'not_licensed');
 assert.ok(gap(meanLunarNodeTropical(ref.utc)-r.ayanamsha.start,rahu.longitude)<1e-7);
});
test('sidereal whole-sign houses are recalculated from sidereal Ascendant and proofs never use tropical claim types',()=>{
 const r=calculateJyotish({birth:BIRTH}),a=r.angles.ascendant.signIndex;
 assert.equal(r.positions.find(p=>p.body==='Sun').house,((r.positions.find(p=>p.body==='Sun').signIndex-a+12)%12)+1);
 assert.ok(r.evidence.every(p=>p.evidenceId.startsWith('jyotish.lahiri.')&&p.type.startsWith('JYOTISH_')&&p.frame==='jyotish-sidereal-lahiri'));
 assert.ok(r.evidence.every(p=>p.provenance.zodiac==='sidereal'));
});
for(const [longitude,name,pada,lord] of [[5,'Ashwini',2,'Ketu'],[45,'Rohini',2,'Moon'],[205,'Vishakha',2,'Jupiter'],[355,'Revati',3,'Mercury']]) test(`nakshatra/pada reference sector ${name}`,()=>{
 const n=classifyNakshatra(longitude);assert.equal(n.name,name);assert.equal(n.pada,pada);assert.equal(n.lord,lord);assert.equal(n.status,'calculated');
});
test('sign, nakshatra and pada boundaries remain uncertain within the complete numerical tolerance',()=>{
 for(const lon of [0,30,60,359.999])assert.equal(classifySiderealLongitude(lon).status,'uncertain');
 for(const lon of [0,40/3,10/3,360-0.001])assert.equal(classifyNakshatra(lon).status,'uncertain');
 assert.equal(classifyNakshatra(40/3).name,null);assert.equal(classifyNakshatra(10/3).pada,null);
 assert.throws(()=>classifyNakshatra(5,0)); assert.throws(()=>classifySiderealLongitude(30,0));
});
for(const precision of ['unknown','approximate','interval']) test(`${precision} birth has no fabricated sidereal angle, house or precise degree`,()=>{
 const birth={...BIRTH,timePrecision:precision,...(precision==='interval'?{timeStart:'16:00',timeEnd:'17:00'}:{})};
 const before=structuredClone(birth),r=calculateJyotish({birth});
 assert.equal(r.status,'uncertain');assert.equal(r.angles.ascendant.longitude,null);
 assert.equal(r.nakshatra.status,'uncertain'); assert.equal(r.nakshatra.pada,null);
 assert.ok(r.positions.every(p=>p.longitude===null&&p.house===null&&p.sign===null));
 assert.ok(r.positions.every(p=>Number.isFinite(p.endpointLongitudes.start)&&Number.isFinite(p.endpointLongitudes.end)));
 assert.deepEqual(birth,before);
});
test('range and input failures are explicit and do not become a different ayanamsha or zodiac',()=>{
 assert.equal(calculateJyotish({birth:{...BIRTH,birthDate:'1890-01-01'}}).status,'unavailable');
 assert.throws(()=>calculateJyotish({birth:{...BIRTH,zodiac:'tropical'}}));
 assert.throws(()=>calculateJyotish({birth:{...BIRTH,houseSystem:'PLACIDUS'}}));
 for(const value of [null,'2000-01-01','2000-02-30T00:00:00Z','2031-01-01T00:00:00Z'])assert.throws(()=>lahiriAyanamsha(value));
 for(const value of [-1,360,NaN,Infinity,'5'])assert.throws(()=>classifyNakshatra(value));
});
test('high-latitude sidereal angles are explicitly withheld without losing the nine grahas',()=>{
 const r=calculateJyotish({birth:{...BIRTH,latitude:67}});
 assert.equal(r.angles.ascendant.status,'unavailable');assert.equal(r.angles.ascendant.longitude,null);
 assert.ok(r.positions.every(p=>Number.isFinite(p.longitude)&&p.house===null));
 assert.equal(r.positions.length,9);
});
