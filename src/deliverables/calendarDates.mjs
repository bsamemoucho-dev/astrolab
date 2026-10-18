// Calendar presentation only: astronomical timestamps remain untouched UTC instants.
export function referenceTimeZone(dossierEvidence, sectionPlan = {}) {
  return sectionPlan.referenceTimeZone ?? dossierEvidence?.referenceTimeZone ??
    dossierEvidence?.evidence?.find(e => e.type === 'BIRTH_CONTEXT')?.value?.timeZone ?? 'UTC';
}
export function calendarDate(instant, timeZone = 'UTC') {
  const date = new Date(instant);
  if (!instant || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = type => Number(parts.find(p => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}
export function formatFrenchCalendarDate(instant, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(instant));
}
const normalize = text => String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const months = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
const datePattern = new RegExp(`\\b(?:(0?[1-9]|[12][0-9]|3[01])(?:er)?\\s+(${months.join('|')})(?:\\s+([0-9]{4}))?|([0-9]{4})-([0-9]{2})-([0-9]{2})|([0-9]{1,2})/([0-9]{1,2})/([0-9]{4}))\\b`, 'gu');
function parseDate(match) {
  const date = match[4] ? { year:Number(match[4]), month:Number(match[5]), day:Number(match[6]) } : match[7] ? { year:Number(match[9]), month:Number(match[8]), day:Number(match[7]) } : { year: match[3] ? Number(match[3]) : null, month: months.indexOf(match[2])+1, day:Number(match[1]) };
  const probe = new Date(Date.UTC(date.year ?? 2000, date.month-1, date.day));
  return { ...date, valid: probe.getUTCMonth()+1 === date.month && probe.getUTCDate() === date.day };
}
function matchesDate(date, instant, timeZone) {
  const expected = calendarDate(instant, timeZone);
  return date.valid && expected && date.month === expected.month && date.day === expected.day && (date.year === null || date.year === expected.year);
}
function pair(a,b) { return [a,b].map(normalize).sort().join('|'); }
const namedPoint = '(?:soleil|lune|mercure|venus|mars|jupiter|saturne|uranus|neptune|pluton|ascendant|descendant|milieu du ciel|fond du ciel)';
// Only explicitly dated astrological events are blocking. A birthday, appointment,
// general biographical date is not treated as a transit date.
export function validateAstrologicalDates({ text, refs = [], timeZone = 'UTC', aspectFacts = () => [] }) {
  const issues = [];
  const transits = refs.filter(r => r.type === 'PERSONAL_TRANSIT');
  let precedingAspects = [];
  for (const sentence of normalize(text).split(/(?<=[.!?])\s+|\n+/u)) {
    const facts = aspectFacts(sentence).filter(f => f.type === 'ASPECT');
    const directAstro = facts.length > 0 || /\b(?:aspect|transit|passage|passages retenus|fenetre|ciel calcule)\b/u.test(sentence);
    // Continuation sentences may refer to the immediately preceding named aspect.
    const subjects = facts.length ? facts : precedingAspects;
    let candidates = subjects.length ? transits.filter(r => subjects.some(f => pair(f.bodyA,f.bodyB) === pair(r.value.transitBody,r.value.natalPoint) && f.aspectType === r.value.aspectType)) : transits;
    let windowCandidates = null;
    let previousDateEnd = 0;
    for (const match of sentence.matchAll(datePattern)) {
      const before = sentence.slice(0, match.index);
      const boundaries = [...before.matchAll(new RegExp(`(?:;|,\\s*|\\bet\\s+)(?=(?:(?:le|la|votre)\\s+)?${namedPoint}\\b)`, 'gu'))];
      const clauseStart = boundaries.length ? boundaries.at(-1).index + boundaries.at(-1)[0].length : 0;
      const localBefore = before.slice(Math.max(previousDateEnd, before.lastIndexOf(';')+1, clauseStart));
      if (before.slice(previousDateEnd).includes(';') || clauseStart > previousDateEnd) windowCandidates = null;
      const clauseFacts = aspectFacts(before.slice(clauseStart)).filter(f => f.type === 'ASPECT');
      const contextualCandidates = clauseFacts.length ? transits.filter(r => clauseFacts.some(f => pair(f.bodyA,f.bodyB) === pair(r.value.transitBody,r.value.natalPoint) && f.aspectType === r.value.aspectType)) : candidates;
      const date = parseDate(match);
      let role = null;
      if (/\bciel calcule le\s*$/u.test(before)) role = 'nowUtc';
      else if (directAstro && !/\b(?:anniversaire|naissance|rendez-vous|reunion|contrat)[^.!?;]{0,25}$/u.test(localBefore)) {
        const rangeOpening = /\b(?:entre le|du)\s*$/u.test(localBefore) && /^\s+(?:et le|au)\s+/u.test(sentence.slice(match.index + match[0].length));
        if (rangeOpening || /\b(?:debut(?:e)?(?: le| du)?|commence(?: le)?|s'ouvre le|a partir du)\s*$/u.test(localBefore)) role = 'startsAt';
        else if (/\b(?:jusqu'au|se termine le|prend fin le|fin le|fin du)\s*$/u.test(localBefore) || (windowCandidates && /\b(?:et le|au)\s*$/u.test(localBefore))) role = 'endsAt';
        else if (/\b(?:exact(?:e)?|exactitude|culmine|pic)(?:\s+(?:est|sera|a ete|le|du|au)){0,4}\s*$/u.test(localBefore)) role = 'exactAt';
        else if (facts.length && new RegExp(`\\b${namedPoint}\\s+le\\s*$`, 'u').test(localBefore)) role = 'windowDay';
      }
      previousDateEnd = match.index + match[0].length;
      if (!role) continue;
      let supported;
      if (role === 'nowUtc') supported = refs.some(r => r.type === 'TRANSIT_SNAPSHOT' && matchesDate(date,r.value.nowUtc,timeZone));
      else {
        const active = windowCandidates ?? contextualCandidates;
        const matching = active.filter(r => role === 'windowDay'
          ? matchesDate(date,r.value.startsAt,timeZone) && matchesDate(date,r.value.endsAt,timeZone)
          : matchesDate(date,r.value[role],timeZone));
        supported = matching.length > 0;
        if (role === 'startsAt' || role === 'endsAt' || windowCandidates) windowCandidates = matching;
      }
      if (!supported) issues.push({ code: 'transit_text_date_mismatch', fact: { type:'ASTROLOGICAL_DATE', role, year:date.year, month:date.month, day:date.day } });
    }
    precedingAspects = facts;
  }
  return issues;
}
