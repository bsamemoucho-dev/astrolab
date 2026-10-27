import { buildIndependentReading } from './build.mjs';
import { calculateChineseAnnual } from './chineseAnnual.mjs';
import { calculateJyotish, LONGITUDE_TOLERANCE_DEGREES } from './jyotish.mjs';
import { calculateVimshottari, VIMSHOTTARI_VERSION, VIMSHOTTARI_YEAR_DAYS } from './vimshottari.mjs';
import { calculateBazi } from './bazi.mjs';

function dashaFacts(jyotish, report) {
  const moon = jyotish.positions.find(point => point.body === 'Moon');
  if (jyotish.status === 'unavailable' || !moon) return {
    status:'unavailable',reason:'SOURCE_SIDEREAL_MOON_UNAVAILABLE',
    frame:{method:VIMSHOTTARI_VERSION,system:'Vimshottari',zodiac:'sidereal',yearDays:VIMSHOTTARI_YEAR_DAYS,cycleYears:120,periodBoundary:'start_inclusive_end_exclusive'},
    periods:[],current:null,interpretationStatus:'not_licensed',evidence:[]
  };
  const utcRange = report.tropical.frame.utcRange;
  const nonzeroWindow = utcRange.start !== utcRange.end;
  const result = calculateVimshottari({
    utcRange, moonSiderealLongitude:nonzeroWindow?moon.endpointLongitudes.start:moon.longitude,
    ...(nonzeroWindow?{moonLongitudeRange:{...moon.endpointLongitudes}}:{}),
    longitudeToleranceDegrees:LONGITUDE_TOLERANCE_DEGREES,
    timeZone:report.tropical.frame.timeZone,asOfUtc:report.generatedAt,horizonYears:120
  });
  return {...result,sourceMoonEvidenceRef:moon.evidenceId,evidence:[{
    evidenceId:'jyotish.vimshottari.timeline',type:'JYOTISH_DASHA_TIMELINE',frame:'jyotish-vimshottari',
    sourceEvidenceRefs:[moon.evidenceId],value:{status:result.status,birthNakshatra:result.birthNakshatra??null,birthBalance:result.birthBalance??null,periods:result.periods},
    provenance:{method:VIMSHOTTARI_VERSION,ayanamsha:jyotish.frame.ayanamshaVersion,yearDays:VIMSHOTTARI_YEAR_DAYS,utcRange:{...utcRange},interpretationStatus:'not_licensed'}
  }]};
}
export function buildComplementPreview(input) {
  const report = buildIndependentReading(input);
  const chineseAnnual = calculateChineseAnnual({utcRange:report.tropical.frame.utcRange});
  const jyotish = calculateJyotish({birth:report.birth});
  const dashas = dashaFacts(jyotish,report);
  const bazi = calculateBazi({birth:report.birth,utcRange:report.tropical.frame.utcRange});
  const provided = new Map([
    ['jyotisha-natal',jyotish],['jyotisha-nakshatras',jyotish],['jyotisha-dashas',dashas],['chinese-bazi',bazi]
  ]);
  const unavailable = report.unavailable.flatMap(item=>{
    const module=provided.get(item.id);
    if (!module) return [item];
    if (module.status!=='unavailable') return [];
    return [{...item,reason:module.reason==='SOURCE_SIDEREAL_MOON_UNAVAILABLE'
      ?'La Lune sidérale n’est pas disponible dans la plage de référence ; aucun calendrier de dashas n’est attribué.'
      :'La fenêtre de naissance sort de la plage de référence 1901–2030 de ce module ; aucun résultat de remplacement n’est attribué.'}];
  });
  return {...report,chineseAnnual,jyotish,dashas,bazi,unavailable};
}
