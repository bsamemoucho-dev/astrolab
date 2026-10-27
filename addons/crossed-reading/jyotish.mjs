// Independent sidereal facts, never passed through tropical interpretation rules.
// No Swiss Ephemeris code or binary is a runtime dependency. The vector method
// uses the existing MIT Astronomy Engine and the published Lahiri epoch.
import * as Astronomy from 'astronomy-engine';
import { calculateWesternNatalChart } from '../../src/astro/westernNatal.mjs';
import { positionAt } from '../../src/astro/westernTransits.mjs';

export const JYOTISH_VERSION = 'lastro-jyotish-calculation@1.0.0';
export const LAHIRI_VERSION = 'lastro-lahiri-iae1985-ae@1.0.0';
export const LONGITUDE_TOLERANCE_DEGREES = 61 / 3600;
const MIN = Date.parse('1901-01-01T00:00:00Z'), MAX = Date.parse('2030-12-31T23:59:59.999Z');
const DAY = 86400000;
const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const SIGN_FR = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];
const NAKSHATRAS = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const LORDS = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
const BODIES = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Rahu','Ketu'];
const LABELS = { Sun:'Soleil',Moon:'Lune',Mercury:'Mercure',Venus:'Vénus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturne',Rahu:'Rahu · nœud moyen ascendant',Ketu:'Ketu · nœud moyen descendant' };
const normal = n => ((n % 360) + 360) % 360;
const gap = n => normal(n + 180) - 180;
const round = n => Math.round(n * 1e9) / 1e9;
function utcDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)) throw new TypeError('JYOTISH_UTC_REQUIRED');
  const d = new Date(value);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,19) !== value.slice(0,19)) throw new TypeError('JYOTISH_INVALID_UTC');
  return d;
}
const epoch = Astronomy.AstroTime.FromTerrestrialTime(2435553.5 - 2451545);
const anchorDegrees = 23 + 15 / 60 + 0.658 / 3600;
const anchorVector = Astronomy.RotateVector(Astronomy.Rotation_ECT_EQJ(epoch), Astronomy.VectorFromSphere(new Astronomy.Spherical(0,anchorDegrees,1),epoch));
export function lahiriAyanamsha(utc) {
  const date = utcDate(utc);
  if (date.getTime() < MIN || date.getTime() > MAX) throw new RangeError('JYOTISH_DATE_OUTSIDE_VERIFIED_RANGE');
  return normal(Astronomy.SphereFromVector(Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECT(date),anchorVector)).lon);
}

// IERS Conventions 2003 / Simon et al. 1994 mean ascending-node polynomial.
// TT in place of TDB is explicitly suitable for this fundamental argument.
// Add nutation longitude to express it in the same TRUE ecliptic as the planets.
export function meanLunarNodeTropical(utc) {
  const d = utcDate(utc), t = new Astronomy.AstroTime(d), c = t.tt / 36525;
  if (d.getTime() < MIN || d.getTime() > MAX) throw new RangeError('JYOTISH_DATE_OUTSIDE_VERIFIED_RANGE');
  if (typeof Astronomy.e_tilt !== 'function') throw new Error('JYOTISH_ENGINE_NUTATION_UNAVAILABLE');
  const nutation = Astronomy.e_tilt(t).dpsi;
  if (!Number.isFinite(nutation)) throw new Error('JYOTISH_ENGINE_NUTATION_UNAVAILABLE');
  const coefficients = [450160.398036, -6962890.5431, 7.4722, 0.007702, -0.00005939];
  const arcseconds = coefficients.reduceRight((sum,value) => sum * c + value,0);
  return normal((arcseconds + nutation) / 3600);
}
function sectors(start,end,width,tolerance) {
  const a = normal(start), b = a + gap(end - start);
  const low = Math.min(a,b) - tolerance, high = Math.max(a,b) + tolerance;
  const count = Math.round(360 / width), indices = new Set();
  for (let i = Math.floor(low / width); i <= Math.floor(high / width); i++) indices.add(((i % count) + count) % count);
  return [...indices].sort((x,y) => x-y);
}
export function classifySiderealLongitude(longitude, tolerance = LONGITUDE_TOLERANCE_DEGREES) {
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360 || !Number.isFinite(tolerance) || tolerance < LONGITUDE_TOLERANCE_DEGREES || tolerance > 1) throw new RangeError('JYOTISH_INVALID_LONGITUDE');
  const indices = sectors(longitude,longitude,30,tolerance);
  return { status:indices.length===1?'calculated':'uncertain', sign:indices.length===1?SIGNS[indices[0]]:null, signFr:indices.length===1?SIGN_FR[indices[0]]:null, signIndex:indices.length===1?indices[0]:null, candidates:indices.map(index=>({sign:SIGNS[index],signFr:SIGN_FR[index],signIndex:index})), degreeInSign:indices.length===1?round(normal(longitude)%30):null };
}
export function classifyNakshatra(longitude, tolerance = LONGITUDE_TOLERANCE_DEGREES) {
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360 || !Number.isFinite(tolerance) || tolerance < LONGITUDE_TOLERANCE_DEGREES || tolerance > 1) throw new RangeError('JYOTISH_INVALID_LONGITUDE');
  const n = sectors(longitude,longitude,40/3,tolerance), p = sectors(longitude,longitude,10/3,tolerance);
  const stable = n.length===1 && p.length===1;
  return { status:stable?'calculated':'uncertain', index:n.length===1?n[0]:null, name:n.length===1?NAKSHATRAS[n[0]]:null, lord:n.length===1?LORDS[n[0]%9]:null, pada:stable?(p[0]%4)+1:null, candidates:n.map(index=>({index,name:NAKSHATRAS[index],lord:LORDS[index%9]})), padaCandidates:p.map(index=>({nakshatraIndex:Math.floor(index/4),pada:(index%4)+1})), longitudeToleranceDegrees:tolerance };
}
// New-module geometry only: true sidereal time, true obliquity, eastern
// horizon selection. The existing tropical angle implementation is untouched.
export function siderealAngles(utc, latitude, longitude) {
  const date = utcDate(utc);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) throw new RangeError('JYOTISH_INVALID_COORDINATES');
  if (Math.abs(latitude)>=65) return {status:'unavailable',reason:'SIDEREAL_ANGLES_OUTSIDE_VERIFIED_LATITUDE_RANGE'};
  const rad=Math.PI/180,theta=(15*Astronomy.SiderealTime(date)+longitude)*rad;
  const epsilon=Astronomy.e_tilt(new Astronomy.AstroTime(date)).tobl*rad,phi=latitude*rad;
  const a=Math.cos(phi)*Math.cos(theta),b=Math.cos(phi)*Math.sin(theta)*Math.cos(epsilon)+Math.sin(phi)*Math.sin(epsilon);
  if (Math.hypot(a,b)<1e-8) return {status:'unavailable',reason:'SIDEREAL_HORIZON_GEOMETRY_SINGULAR'};
  let asc=Math.atan2(a,-b);
  const east=-Math.sin(theta)*Math.cos(asc)+Math.cos(theta)*Math.sin(asc)*Math.cos(epsilon);
  if (Math.abs(east)<1e-8) return {status:'unavailable',reason:'SIDEREAL_HORIZON_GEOMETRY_SINGULAR'};
  if (east<0) asc+=Math.PI;
  const mc=Math.atan2(Math.sin(theta)/Math.cos(epsilon),Math.cos(theta));
  const aya=lahiriAyanamsha(utc);
  return {status:'calculated',ascendant:normal(asc/rad-aya),midheaven:normal(mc/rad-aya)};
}
function position(body,utc,ayanamsha) {
  const tropicalLongitude = body==='Rahu'||body==='Ketu' ? normal(meanLunarNodeTropical(utc)+(body==='Ketu'?180:0)) : positionAt(body,new Date(utc)).longitude;
  return { tropicalLongitude, longitude:normal(tropicalLongitude-ayanamsha) };
}
function proof(id,type,value,frame,utcRange) {
  return { evidenceId:`jyotish.lahiri.${id}`,type,frame:'jyotish-sidereal-lahiri',value,provenance:{method:JYOTISH_VERSION,ayanamsha:LAHIRI_VERSION,zodiac:'sidereal',houseSystem:frame.houseSystem,utcRange:{...utcRange},engineVersion:frame.engineVersion,interpretationStatus:'not_licensed'} };
}
export function calculateJyotish({birth}={}) {
  if (!birth || typeof birth!=='object' || Array.isArray(birth) || ['zodiac','houseSystem','result','evidence','claims'].some(key=>Object.hasOwn(birth,key))) throw new TypeError('JYOTISH_BIRTH_INPUT_REQUIRED');
  const {result} = calculateWesternNatalChart(birth);
  const range = {...result.time.utcRange};
  const start = utcDate(range.start), end = utcDate(range.end);
  if (end<start || end-start>2*DAY) throw new RangeError('JYOTISH_INVALID_BIRTH_WINDOW');
  const frame = {methodVersion:JYOTISH_VERSION,zodiac:'sidereal',houseSystem:'WHOLE_SIGN',ayanamshaId:'lahiri_iae1985',ayanamshaVersion:LAHIRI_VERSION,ayanamshaReference:{julianDayTt:2435553.5,longitudeDegrees:anchorDegrees,referenceEquinox:'true_ecliptic_of_date'},coordinateSystem:'geocentric_apparent_true_ecliptic_of_date',engineVersion:result.parameters.astronomyEngineVersion,angleMethod:'AE_GAST_true_obliquity_eastern_horizon@1',angleLatitudeRangeExclusive:[-65,65],referenceRange:[1901,2030],numericalLongitudeToleranceDegrees:LONGITUDE_TOLERANCE_DEGREES,meanNodeConvention:'IERS2003_mean_node_plus_nutation',timeZone:result.time.timeZone,utcRange:range,interpretationStatus:'not_licensed'};
  if(start.getTime()<MIN||end.getTime()>MAX) return {status:'unavailable',reason:'JYOTISH_DATE_OUTSIDE_VERIFIED_RANGE',frame,positions:[],angles:{},nakshatra:null,evidence:[],interpretationStatus:'not_licensed'};
  const exact = start.getTime()===end.getTime();
  const a0 = lahiriAyanamsha(range.start), a1 = lahiriAyanamsha(range.end);
  const angles = {};
  if(exact) {
    const calc = siderealAngles(range.start,result.normalizedInput.latitude,result.normalizedInput.longitude);
    for(const key of ['ascendant','midheaven']) {
      if(calc.status==='unavailable') angles[key]={status:'unavailable',reason:calc.reason,longitude:null,sign:null,signIndex:null,evidenceId:`jyotish.lahiri.angle.${key}`};
      else { const lon=calc[key]; angles[key]={longitude:normal(round(lon)),...classifySiderealLongitude(lon),evidenceId:`jyotish.lahiri.angle.${key}`}; }
    }
  } else {
    for(const key of ['ascendant','midheaven']) angles[key]={status:'unavailable',reason:'EXACT_BIRTH_TIME_REQUIRED_FOR_SIDEREAL_ANGLE',longitude:null,sign:null,signIndex:null,evidenceId:`jyotish.lahiri.angle.${key}`};
  }
  const ascIndex = angles.ascendant?.status==='calculated'?angles.ascendant.signIndex:null;
  const positions = BODIES.map(body=>{
    const p0=position(body,range.start,a0),p1=position(body,range.end,a1);
    const classification = exact ? classifySiderealLongitude(p0.longitude) : {status:'uncertain',sign:null,signFr:null,signIndex:null,degreeInSign:null,candidates:[]};
    return {body,label:LABELS[body],kind:body==='Rahu'||body==='Ketu'?'mean_lunar_node':'traditional_body',...classification,
      longitude:exact?normal(round(p0.longitude)):null,tropicalLongitude:exact?round(p0.tropicalLongitude):null,
      endpointLongitudes:{start:normal(round(p0.longitude)),end:normal(round(p1.longitude))},
      house:classification.signIndex!==null&&ascIndex!==null?((classification.signIndex-ascIndex+12)%12)+1:null,
      uncertainty:exact?{longitudeToleranceDegrees:LONGITUDE_TOLERANCE_DEGREES}:{reason:'NONZERO_BIRTH_WINDOW',utcRange:range,endpointValuesAreNotACompleteEnclosure:true,longitudeToleranceDegrees:LONGITUDE_TOLERANCE_DEGREES},
      evidenceId:`jyotish.lahiri.body.${body.toLowerCase()}`};
  });
  const moon=positions.find(p=>p.body==='Moon');
  const moonNakshatra = exact ? classifyNakshatra(moon.longitude) : {status:'uncertain',reason:'NONZERO_BIRTH_WINDOW',name:null,index:null,pada:null,lord:null,candidates:[],padaCandidates:[],longitudeToleranceDegrees:LONGITUDE_TOLERANCE_DEGREES};
  const evidence = positions.map(p=>proof(`body.${p.body.toLowerCase()}`,'JYOTISH_BODY_POSITION',structuredClone(p),frame,range));
  for(const [key,value] of Object.entries(angles)) evidence.push(proof(`angle.${key}`,'JYOTISH_ANGLE_POSITION',structuredClone(value),frame,range));
  evidence.push(proof('moon.nakshatra','JYOTISH_NAKSHATRA',moonNakshatra,frame,range));
  return {status:exact&&positions.every(p=>p.status==='calculated')&&moonNakshatra.status==='calculated'&&angles.ascendant.status==='calculated'&&angles.midheaven.status==='calculated'?'calculated':'uncertain',frame,
    ayanamsha:{start:round(a0),end:round(a1),unit:'degree',version:LAHIRI_VERSION},positions,angles,nakshatra:moonNakshatra,evidence,
    interpretationStatus:'not_licensed',warnings:exact?['Une marge numérique de 1 minute et 1 seconde d’arc protège les frontières ; les données de naissance et du lieu restent déclaratives.']:['Une fenêtre de naissance non ponctuelle ne fournit pas de degré, de maison ou d’angle sidéral unique. Les bornes planétaires sont des échantillons, pas une certification de tout l’intervalle.']};
}
