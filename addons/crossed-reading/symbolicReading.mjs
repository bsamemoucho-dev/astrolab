// Bounded documentary reading of calculated evidence. No writer, transport,
// storage, amended calculation, or cross-tradition interpretation licence.
import { classifySiderealLongitude, classifyNakshatra, JYOTISH_VERSION, LONGITUDE_TOLERANCE_DEGREES } from './jyotish.mjs';
import { BAZI_METHOD_VERSION } from './bazi.mjs';
import { VIMSHOTTARI_VERSION } from './vimshottari.mjs';

export const DOCUMENTED_READING_VERSION = 'lastro-bounded-documented-reading@1.0.0';
const SOURCES = Object.freeze([
  Object.freeze({ id:'rao-basics', title:'P. V. R. Narasimha Rao — Vedic Astrology: An Integrated Approach',
    url:'https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf', locator:'§ 1.3 ; § 2.3 ; § 3.2.3 ; § 7.3.2',
    role:'Lexique traditionnel, sans validation scientifique de ses significations.' }),
  Object.freeze({ id:'rao-dashas', title:'P. V. R. Narasimha Rao — Vimshottari, chapitre 16',
    url:'https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf', locator:'§ 16.1–16.3 et 16.7',
    role:'Structure du calendrier et précautions de datation ; 365,25 jours reste le profil explicite de Lastro.' }),
  Object.freeze({ id:'hko-ganzhi', title:'Hong Kong Observatory — Heavenly Stems and Earthly Branches',
    url:'https://www.hko.gov.hk/en/gts/time/stemsandbranches.htm', locator:'Tables 2–5',
    role:'Noms des troncs, branches et huit caractères calendaires, sans portrait individuel.' }),
  Object.freeze({ id:'hko-boundaries', title:'Hong Kong Observatory — What year is it today?',
    url:'https://www.hko.gov.hk/en/education/astronomy-and-time/time-service/00506-what-year-is-it-today.html', locator:'Hui Tai-wai, avril 2018',
    role:'Différence entre la frontière du Nouvel An lunaire et la convention astrologique Li Chun.' })
]);
// Short vocabulary from Rao §2.3. Physical, medical, caste, gender, moral and
// biographical characterisations are deliberately excluded.
const SIGNS = Object.freeze({
  Aries:{fr:'Bélier',words:'initiative et mouvement'}, Taurus:{fr:'Taureau',words:'stabilité et fidélité'},
  Gemini:{fr:'Gémeaux',words:'étude et communication'}, Cancer:{fr:'Cancer',words:'sensibilité et attachement'},
  Leo:{fr:'Lion',words:'affirmation et fierté'}, Virgo:{fr:'Vierge',words:'discernement et discrétion'},
  Libra:{fr:'Balance',words:'équilibre et dialogue'}, Scorpio:{fr:'Scorpion',words:'réserve et recherche de ce qui demeure caché'},
  Sagittarius:{fr:'Sagittaire',words:'franchise et rectitude'}, Capricorn:{fr:'Capricorne',words:'patience et organisation'},
  Aquarius:{fr:'Verseau',words:'réflexion et persévérance'}, Pisces:{fr:'Poissons',words:'intuition et sensibilité'}
});
const LORDS = Object.freeze({Sun:'Soleil',Moon:'Lune',Mercury:'Mercure',Venus:'Vénus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturne',Rahu:'Rahu',Ketu:'Ketu'});
const STEMS = ['Jia','Yi','Bing','Ding','Wu','Ji','Geng','Xin','Ren','Gui'];
const BRANCHES = ['Zi','Chou','Yin','Mao','Chen','Si','Wu','Wei','Shen','You','Xu','Hai'];
const list = value => Array.isArray(value) ? value : [];
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function fail(code) { throw Object.assign(new TypeError(code), {code}); }
function requireFrame(condition) { if (!condition) fail('COMPLEMENT_READING_FRAME_MISMATCH'); }
function requireProof(condition) { if (!condition) fail('COMPLEMENT_READING_PROOF_MISMATCH'); }
function para(kind,text,proofRefs=[],sourceRefs=[]) { return {kind,text,proofRefs:[...proofRefs],sourceRefs:[...sourceRefs]}; }
function section(id,title,frame,paragraphs,ruleIds=[]) {
  return {id,title,frame,paragraphs,ruleIds:[...ruleIds],
    proofRefs:[...new Set(paragraphs.flatMap(p=>p.proofRefs))],
    sourceRefs:[...new Set(paragraphs.flatMap(p=>p.sourceRefs))]};
}
function checkReport(report) {
  requireFrame(report?.schema === 'lastro.independent_reading@0.1.0' && report.status === 'local_preview');
  requireFrame(report.crossTraditionSynthesis?.status === 'not_licensed');
  requireFrame(report.tropical?.frame?.method === 'western-natal' && report.tropical.frame.zodiac === 'tropical' && report.tropical.frame.houseSystem === 'WHOLE_SIGN');
  const j=report.jyotish;
  if(j) requireFrame(['calculated','uncertain','unavailable'].includes(j.status) && j.frame?.methodVersion===JYOTISH_VERSION && j.frame.zodiac==='sidereal'
    && j.frame.houseSystem==='WHOLE_SIGN' && j.frame.ayanamshaId==='lahiri_iae1985'
    && j.frame.numericalLongitudeToleranceDegrees===LONGITUDE_TOLERANCE_DEGREES && j.interpretationStatus==='not_licensed');
  const d=report.dashas;
  if(d) requireFrame(['calculated','uncertain','unavailable'].includes(d.status) && d.frame?.method===VIMSHOTTARI_VERSION && d.frame.system==='Vimshottari'
    && d.frame.zodiac==='sidereal' && d.frame.yearDays===365.25 && d.interpretationStatus==='not_licensed');
  const b=report.bazi;
  if(b) requireFrame(['calculated','uncertain','unavailable'].includes(b.status) && b.frame?.methodVersion===BAZI_METHOD_VERSION && b.frame.hourBasis==='local_civil'
    && b.frame.yearBoundary==='li_chun' && b.frame.monthBoundary==='jie_solar_terms' && b.frame.dayBoundary==='local_midnight'
    && b.frame.solarTimeCorrectionApplied===false && b.interpretationStatus==='not_licensed');
}
function pointProof(j,point) {
  const proof=list(j.evidence).find(item=>item.evidenceId===point.evidenceId);
  requireProof(proof?.type==='JYOTISH_BODY_POSITION' && proof.frame==='jyotish-sidereal-lahiri'
    && proof.provenance?.method===JYOTISH_VERSION && proof.provenance.zodiac==='sidereal'
    && ['body','status','sign','longitude','house'].every(key=>same(proof.value?.[key],point[key])));
  return point.evidenceId;
}
function lunarSections(report) {
  const j=report.jyotish;
  if(!j || j.status==='unavailable') return [];
  const moon=list(j.positions).find(point=>point.body==='Moon');
  if(!moon || moon.status!=='calculated') return [];
  requireProof(j.frame.utcRange?.start===j.frame.utcRange?.end && typeof j.frame.utcRange?.start==='string');
  const classification=classifySiderealLongitude(moon.longitude,LONGITUDE_TOLERANCE_DEGREES);
  requireProof(classification.status==='calculated' && classification.sign===moon.sign && SIGNS[moon.sign]);
  const ref=pointProof(j,moon), item=SIGNS[moon.sign];
  const sections=[section('sidereal-moon','Une entrée par la Lune','jyotish-sidereal-lahiri',[
    para('calculated',`Dans le zodiaque sidéral Lahiri, votre Lune se situe en ${item.fr}.`,[ref]),
    para('traditional_vocabulary',`Le Jyotish emploie la Lune comme symbole de l’esprit. Pour ce signe, le lexique retenu propose les mots « ${item.words} ». Ils ouvrent une piste de réflexion, sans établir une manière de penser ou de ressentir.`,[ref],['rao-basics'])
  ],[`complement.documented.moon.sign.${moon.sign.toLowerCase()}@1`])];
  const nak=j.nakshatra;
  if(nak?.status==='calculated') {
    const derived=classifyNakshatra(moon.longitude,LONGITUDE_TOLERANCE_DEGREES);
    requireProof(derived.status==='calculated' && ['name','index','lord','pada'].every(key=>derived[key]===nak[key]));
    const proof=list(j.evidence).find(item=>item.type==='JYOTISH_NAKSHATRA' && item.frame==='jyotish-sidereal-lahiri');
    requireProof(proof && ['name','index','lord','pada','status'].every(key=>proof.value?.[key]===nak[key]));
    sections.push(section('lunar-sector','Votre repère lunaire','jyotish-sidereal-lahiri',[
      para('calculated',`La Lune appartient à ${nak.name}, pada ${nak.pada}. Le maître associé à ce secteur est ${LORDS[nak.lord]}.`,[ref,proof.evidenceId]),
      para('method','Un nakshatra est une division du zodiaque en 27 secteurs égaux ; le pada en désigne un quart. Cette position sert ici de point de départ au calendrier Vimshottari.',[ref,proof.evidenceId],['rao-basics','rao-dashas'])
    ],['complement.documented.nakshatra.explanation@1']));
  }
  return sections;
}
function dashaSections(report) {
  const d=report.dashas;
  if(!d || d.status!=='calculated') return [];
  const j=report.jyotish, moon=list(j?.positions).find(point=>point.body==='Moon');
  requireProof(moon?.status==='calculated' && d.sourceMoonEvidenceRef===pointProof(j,moon)
    && d.frame.moonLongitudeToleranceDegrees>=LONGITUDE_TOLERANCE_DEGREES);
  const proof=list(d.evidence).find(item=>item.type==='JYOTISH_DASHA_TIMELINE' && item.frame==='jyotish-vimshottari');
  requireProof(proof && proof.value?.status===d.status && same(proof.value.periods,d.periods)
    && list(proof.sourceEvidenceRefs).includes(moon.evidenceId));
  const refs=[moon.evidenceId,proof.evidenceId];
  const paragraphs=[para('method','Les mahadashas sont les grandes périodes du calendrier ; les antardashas en sont les subdivisions. Leur point de départ dépend de la position lunaire à la naissance. Lastro retient ici une année de 365,25 jours. Les dates affichées gardent leur marge d’incertitude.',refs,['rao-dashas'])];
  const current=d.current;
  if(current?.status==='calculated') {
    const parent=list(d.periods).find(period=>period.lord===current.mahadasha?.lord && period.startUtc===current.mahadasha?.startUtc);
    const child=list(parent?.antardashas).find(period=>period.lord===current.antardasha?.lord && period.startUtc===current.antardasha?.startUtc);
    requireProof(parent && child && same(parent,current.mahadasha) && same(child,current.antardasha)
      && LORDS[parent.lord] && LORDS[child.lord] && d.asOfUtc===report.generatedAt);
    paragraphs.unshift(para('calculated',`À la date de préparation du complément, le calendrier place le repère courant dans la mahadasha de ${LORDS[parent.lord]} et l’antardasha de ${LORDS[child.lord]}.`,refs));
  } else if(current?.status==='uncertain') paragraphs.unshift(para('uncertainty','La date de préparation se trouve près d’un changement de période : aucun maître courant unique n’est retenu.',refs));
  return [section('periods-reading','Comprendre le calendrier des périodes','jyotish-vimshottari',paragraphs,['complement.documented.vimshottari.explanation@1'])];
}
function baziSections(report) {
  const b=report.bazi;
  if(!b || b.status==='unavailable') return [];
  const stable=new Map();
  for(const role of ['year','month','day','hour']) {
    const value=b.pillars?.[role];
    if(value?.status!=='calculated') continue;
    requireProof(Number.isInteger(value.stemIndex) && Number.isInteger(value.branchIndex)
      && STEMS[value.stemIndex]===value.stem && BRANCHES[value.branchIndex]===value.branch
      && value.stemIndex%2===value.branchIndex%2 && value.ganZhi===`${value.stem}-${value.branch}`);
    const proof=list(b.evidence).find(item=>item.evidenceId===value.evidenceId);
    requireProof(proof?.type==='BAZI_PILLAR' && proof.frame==='bazi-civil-jie' && proof.role===role
      && proof.methodVersion===BAZI_METHOD_VERSION && proof.status==='calculated'
      && ['stem','branch','stemIndex','branchIndex','ganZhi'].every(key=>same(proof.value?.[key],value[key])));
    stable.set(role,{...value,proofRef:proof.evidenceId});
  }
  if(!stable.size) return [];
  const paragraphs=[];
  if(stable.has('month')) {
    const p=stable.get('month');
    paragraphs.push(para('calculated',`Votre pilier du mois est ${p.ganZhi}. Il suit les jalons solaires du calendrier, plutôt que les premiers jours des mois civils.`,[p.proofRef],['hko-ganzhi','hko-boundaries']));
  }
  if(stable.has('day')) {
    const p=stable.get('day');
    paragraphs.push(para('calculated',`Le pilier du jour est ${p.ganZhi} : ${p.stem} est le tronc et ${p.branch} la branche. Les quatre piliers réunissent de cette manière huit caractères, chacun rattaché à l’année, au mois, au jour ou à l’heure.`,[p.proofRef],['hko-ganzhi']));
  }
  if(!stable.has('hour')) paragraphs.push(para('uncertainty','Le pilier de l’heure reste indéterminé avec les données fournies ; les autres repères certains sont conservés.'));
  paragraphs.push(para('method','La convention de ce complément emploie l’heure civile locale, avec son éventuelle heure d’été. Elle ne corrige pas l’heure en temps solaire vrai ; un autre choix peut modifier le pilier horaire.'));
  return [section('four-pillars-reading','Lire les quatre piliers','bazi-civil-jie',paragraphs,['complement.documented.bazi.explanation@1'])];
}
export function buildSymbolicReading(report) {
  checkReport(report);
  const sections=[...lunarSections(report),...dashaSections(report),...baziSections(report)];
  if(!sections.length) sections.push(section('uncertain-reading','La précision avant l’interprétation','independent',[
    para('uncertainty','Les données disponibles ne permettent pas de retenir ici un repère unique pour la lecture. Les tableaux conservent les résultats calculables et leurs incertitudes, sans choisir arbitrairement un signe, un secteur ou une période.')
  ]));
  const used=new Set(sections.flatMap(item=>item.sourceRefs));
  return {
    version:DOCUMENTED_READING_VERSION,status:'bounded_documented_reading',scope:'documented_explanations_and_lunar_vocabulary',
    notice:'Cette lecture explique les repères calculés et quelques mots du vocabulaire traditionnel. Elle ne constitue ni une consultation complète de Jyotish ou de BaZi, ni un portrait psychologique, ni une prévision. Les traditions demeurent séparées.',
    sections,sources:SOURCES.filter(source=>used.has(source.id)).map(source=>({...source})),
    proofRefs:[...new Set(sections.flatMap(item=>item.proofRefs))],crossTraditionSynthesis:'not_licensed'
  };
}
function escape(value) { return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
export function renderSymbolicReading(report) {
  const reading=buildSymbolicReading(report);
  const byUrl=new Map();
  for(const source of reading.sources) {
    const existing=byUrl.get(source.url);
    if(existing) existing.locator += ` ; ${source.locator}`;
    else byUrl.set(source.url,{...source});
  }
  const sources=[...byUrl.values()];
  return `<section aria-labelledby="documented-reading-title" class="documented-reading"><span class="tag">Repères de lecture documentés</span><h2 id="documented-reading-title">Lire votre complément</h2><p class="note">${escape(reading.notice)}</p>${reading.sections.map(item=>`<article id="documented-${escape(item.id)}"><h3>${escape(item.title)}</h3>${item.paragraphs.map(p=>`<p data-reading-kind="${escape(p.kind)}">${escape(p.text)}</p>`).join('')}</article>`).join('')}${sources.length?`<details open><summary>Sources de cette lecture</summary><ul>${sources.map(source=>`<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)}</a> · ${escape(source.locator)}. ${escape(source.role)}</li>`).join('')}</ul></details>`:''}</section>`;
}
