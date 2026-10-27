import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { calculateWesternNatalChart } from '../../src/astro/westernNatal.mjs';
import { calculateChineseAnnual } from './chineseAnnual.mjs';
import { calculateBazi, baziSolarTerms, BAZI_METHOD_VERSION, BAZI_SOLAR_BOUNDARY_GUARD_SECONDS } from './bazi.mjs';

const point = (value, timeZone='Asia/Shanghai') => calculateBazi({ birth:{timeZone,timePrecision:'exact'}, utcRange:{start:value,end:value} });
const pair = result => Object.fromEntries(Object.entries(result.pillars).map(([key,value]) => [key,value?.ganZhi]));
const changed = (iso, delta) => new Date(Date.parse(iso) + delta).toISOString();
const around = (value, span, timeZone='Asia/Shanghai') => calculateBazi({birth:{timeZone,timePrecision:'approximate'},utcRange:{start:changed(value,-span),end:changed(value,span)}});

// External facts: HKO Almanacs, daily calendrical labels, not this implementation.
// 2024 January p.5-6: Jan1 甲子, Jan2乙丑. 2025 January p.5-6: Jan1庚午,
// Jan18丁亥, Jan29戊戌. 2025 February p.7-8: Feb4甲辰.
for (const [date, expected] of [
  ['2024-01-01T04:00:00Z','Jia-Zi'], ['2024-01-02T04:00:00Z','Yi-Chou'],
  ['2025-01-01T04:00:00Z','Geng-Wu'], ['2025-01-18T04:00:00Z','Ding-Hai'],
  ['2025-01-29T04:00:00Z','Wu-Xu'], ['2025-02-04T04:00:00Z','Jia-Chen']
]) test(`civil day pillar agrees with the published HKO calendar on ${date.slice(0,10)}`, () => {
  const actual = point(date);
  assert.equal(actual.pillars.day.ganZhi, expected);
  assert.equal(actual.pillars.day.status, 'calculated');
  assert.equal(actual.frame.dayReference.civilDate, '2024-01-01');
});

// Published HKO times are rounded to a minute, Hong Kong UTC+8. Use a one-minute
// tolerance to compare an astronomical UTC root, never the printed civil date.
for (const [year, expected] of [[2024,'2024-02-04T08:27:00Z'],[2025,'2025-02-03T14:10:00Z']]) {
  test(`Li Chun ${year} agrees with HKO to its minute resolution`, () => {
    const actual = baziSolarTerms(year)[0];
    assert.equal(actual.name,'Li Chun'); assert.equal(actual.longitude,315);
    assert.ok(Math.abs(Date.parse(actual.utc) - Date.parse(expected)) <= 60000);
  });
}

test('all twelve Jie create strictly ordered original UTC boundaries across longitude wrap', () => {
  const terms = baziSolarTerms(2024);
  assert.equal(terms.length,13);
  assert.deepEqual(terms.slice(0,12).map(t => t.longitude),[315,345,15,45,75,105,135,165,195,225,255,285]);
  for (let i=1;i<terms.length;i++) {
    const days=(Date.parse(terms[i].utc)-Date.parse(terms[i-1].utc))/86400000;
    assert.ok(days>28 && days<33);
  }
  const before=structuredClone(terms);terms[0].utc='forged';terms.splice(2,1);
  assert.deepEqual(baziSolarTerms(2024),before,'a caller cannot mutate the root cache');
});

test('BaZi year changes at Li Chun and stays separate from the popular lunar-new-year label', () => {
  const before = point('2024-02-03T12:00:00Z');
  const after = point('2024-02-05T12:00:00Z');
  assert.equal(before.pillars.year.ganZhi,'Gui-Mao');
  assert.equal(before.pillars.month.ganZhi,'Yi-Chou');
  assert.equal(after.pillars.year.ganZhi,'Jia-Chen');
  assert.equal(after.pillars.month.ganZhi,'Bing-Yin');
  const popular=calculateChineseAnnual({utcRange:{start:'2024-02-05T12:00:00Z',end:'2024-02-05T12:00:00Z'}});
  assert.equal(popular.relatedYear,2023); assert.equal(popular.branch,'Mao');
  assert.equal(after.frame.yearBoundary,'li_chun');
  assert.equal(popular.frame.yearBoundary,'lunar_new_year');
});

test('solar month changes at Jie rather than at Gregorian or lunar midnight', () => {
  const term=baziSolarTerms(2024)[1];
  const before=point(changed(term.utc,-5*60000)), after=point(changed(term.utc,5*60000));
  assert.equal(before.pillars.month.ganZhi,'Bing-Yin');
  assert.equal(after.pillars.month.ganZhi,'Ding-Mao');
  assert.equal(after.pillars.month.startsAtUtc,term.utc);
  assert.equal(after.pillars.month.jie,'Jing Zhe');
  assert.equal(before.pillars.year.ganZhi,after.pillars.year.ganZhi);
});

test('birth exactly or nearly at the solar boundary has no false unique year or month', () => {
  const term=baziSolarTerms(2024)[0];
  for(const delta of [0,-10000,10000]) {
    const actual=point(changed(term.utc,delta));
    assert.equal(actual.status,'uncertain');
    for(const role of ['year','month']) {
      assert.equal(actual.pillars[role].status,'uncertain');
      assert.equal(actual.pillars[role].ganZhi,null); assert.equal(actual.pillars[role].stem,null);
      assert.equal(actual.pillars[role].candidates.length,2);
    }
    assert.equal(actual.frame.solarBoundaryGuardSeconds,BAZI_SOLAR_BOUNDARY_GUARD_SECONDS);
  }
});

test('the same astronomical Li Chun instant is not shifted by the birthplace time zone', () => {
  const instant='2025-02-03T16:00:00Z';
  const china=point(instant,'Asia/Shanghai'), paris=point(instant,'Europe/Paris'), newYork=point(instant,'America/New_York');
  for(const other of [paris,newYork]) {
    assert.equal(other.pillars.year.ganZhi,china.pillars.year.ganZhi);
    assert.equal(other.pillars.month.ganZhi,china.pillars.month.ganZhi);
    assert.equal(other.pillars.month.startsAtUtc,china.pillars.month.startsAtUtc);
  }
  assert.equal(china.pillars.day.ganZhi,'Jia-Chen');
  assert.equal(paris.pillars.day.ganZhi,'Gui-Mao');
});

// Primary HKO stem tables: Jia/Ji year -> Bing Yin first month; then +1 each
// Jie. Jia/Ji day -> Jia Zi first double-hour; then +1 each branch.
for(const [hour,expected] of [[0,'Jia-Zi'],[1,'Yi-Chou'],[3,'Bing-Yin'],[5,'Ding-Mao'],[7,'Wu-Chen'],[9,'Ji-Si'],[11,'Geng-Wu'],[13,'Xin-Wei'],[15,'Ren-Shen'],[17,'Gui-You'],[19,'Jia-Xu'],[21,'Yi-Hai'],[23,'Jia-Zi']]) {
  test(`HKO double-hour stem table at local ${String(hour).padStart(2,'0')}:00 on a Jia day`, () => {
    const iso=new Date(Date.UTC(2024,0,1,hour)-8*3600000).toISOString();
    assert.equal(point(iso).pillars.hour.ganZhi,expected);
  });
}

test('Zi is explicitly split by civil midnight, never a hidden next-day-at-23 convention', () => {
  const late=point('2024-01-01T15:30:00Z'); // Jan1 23:30 Shanghai
  const early=point('2024-01-01T16:30:00Z'); // Jan2 00:30 Shanghai
  assert.equal(late.pillars.day.ganZhi,'Jia-Zi'); assert.equal(late.pillars.hour.ganZhi,'Jia-Zi');
  assert.equal(early.pillars.day.ganZhi,'Yi-Chou'); assert.equal(early.pillars.hour.ganZhi,'Bing-Zi');
  assert.equal(late.frame.dayBoundary,'local_midnight');
  assert.equal(late.frame.ziHourConvention,'split_at_local_midnight');
  const midnight=around('2024-01-01T16:00:00Z',1000);
  assert.equal(midnight.pillars.day.status,'uncertain');
  assert.equal(midnight.pillars.hour.status,'uncertain');
  assert.deepEqual(midnight.pillars.day.candidates.map(p=>p.ganZhi),['Jia-Zi','Yi-Chou']);
});

test('an approximate interval straddling a double-hour does not pick a midpoint hour', () => {
  const actual=around('2024-01-01T17:00:00Z',30*60000); // Jan2 01:00
  assert.equal(actual.pillars.day.status,'calculated');
  assert.equal(actual.pillars.hour.status,'uncertain');
  assert.equal(actual.pillars.hour.ganZhi,null);
  assert.deepEqual(actual.pillars.hour.candidates.map(p=>p.ganZhi),['Bing-Zi','Ding-Chou']);
});

test('unknown birth time retains a stable day but enumerates every double-hour, even with Zi at both ends', () => {
  const natal=calculateWesternNatalChart({birthDate:'2024-01-01',timePrecision:'unknown',latitude:22.3,longitude:114.2,timeZone:'Asia/Shanghai'}).result;
  const before=structuredClone(natal);
  const actual=calculateBazi({birth:natal.normalizedInput,utcRange:natal.time.utcRange});
  assert.equal(actual.status,'uncertain'); assert.equal(actual.pillars.day.ganZhi,'Jia-Zi');
  assert.equal(actual.pillars.hour.ganZhi,null); assert.equal(actual.pillars.hour.candidates.length,12);
  assert.equal(actual.pillars.year.status,'calculated'); assert.equal(actual.pillars.month.status,'calculated');
  assert.deepEqual(natal,before);
});

test('a fabricated point cannot turn a declared unknown birth time into a certain hour', () => {
  const actual=calculateBazi({birth:{timeZone:'UTC',timePrecision:'unknown'},utcRange:{start:'2024-01-01T12:00:00Z',end:'2024-01-01T12:00:00Z'}});
  assert.equal(actual.pillars.hour.status,'uncertain'); assert.equal(actual.pillars.hour.ganZhi,null);
  assert.equal(actual.pillars.hour.reason,'BIRTH_TIME_UNKNOWN_REQUIRES_COMPLETE_WINDOW');
});

test('DST spring jump and autumn repeated hour use actual IANA civil time, with no invented solar correction', () => {
  const before=point('2024-03-31T00:59:59Z','Europe/Paris');
  const after=point('2024-03-31T01:00:00Z','Europe/Paris');
  assert.equal(before.pillars.hour.branch,'Chou'); assert.equal(after.pillars.hour.branch,'Yin');
  const crossing=around('2024-03-31T01:00:00Z',60000,'Europe/Paris');
  assert.equal(crossing.pillars.hour.status,'uncertain');
  assert.deepEqual(crossing.pillars.hour.candidates.map(p=>p.branch),['Chou','Yin']);
  const foldA=point('2024-10-27T00:30:00Z','Europe/Paris'), foldB=point('2024-10-27T01:30:00Z','Europe/Paris');
  assert.equal(foldA.pillars.hour.ganZhi,foldB.pillars.hour.ganZhi);
  assert.equal(foldA.frame.hourBasis,'local_civil'); assert.equal(foldA.frame.solarTimeCorrectionApplied,false);
});

test('civil-date interpretation survives date-line zones without transferring Hong Kong dates', () => {
  const date='2024-01-01T12:30:00Z';
  const a=point(date,'Pacific/Kiritimati'),b=point(date,'Pacific/Honolulu');
  assert.equal(a.pillars.day.ganZhi,'Yi-Chou'); assert.equal(b.pillars.day.ganZhi,'Jia-Zi');
  assert.equal(a.pillars.year.ganZhi,b.pillars.year.ganZhi);
  assert.equal(a.pillars.month.ganZhi,b.pillars.month.ganZhi);
});

test('all values retain their own BaZi proof namespace and no interpretation licence', () => {
  const input={birth:{timeZone:'Asia/Shanghai',timePrecision:'exact'},utcRange:{start:'2025-02-04T04:00:00Z',end:'2025-02-04T04:00:00Z'}};
  const original=structuredClone(input),actual=calculateBazi(input);
  assert.equal(actual.frame.methodVersion,BAZI_METHOD_VERSION);
  assert.equal(actual.interpretationStatus,'not_licensed'); assert.equal(actual.evidence.length,4);
  for(const proof of actual.evidence) {
    assert.equal(proof.type,'BAZI_PILLAR'); assert.equal(proof.frame,'bazi-civil-jie');
    assert.equal(proof.interpretationStatus,'not_licensed'); assert.ok(proof.evidenceId.startsWith('bazi.pillar.'));
    assert.ok(!('interpretationRuleRefs' in proof)); assert.ok(!('zodiac' in proof));
    assert.deepEqual(proof.utcRange,{start:'2025-02-04T04:00:00.000Z',end:'2025-02-04T04:00:00.000Z'});
  }
  assert.deepEqual(input,original);
});

test('invalid inputs and unsupported dates cannot yield fabricated pillars or a silent current-date fallback', () => {
  for(const value of [null,'','2024-01-01','2024-01-01T12:00:00','2024-02-30T00:00:00Z']) assert.throws(()=>point(value));
  assert.throws(()=>point('2024-01-01T12:00:00Z','not/a-zone'));
  assert.throws(()=>calculateBazi({birth:{},utcRange:{start:'2024-01-01T12:00:00Z',end:'2024-01-01T12:00:00Z'}}));
  assert.throws(()=>calculateBazi({birth:{timeZone:'UTC'},utcRange:{start:'2024-01-02T00:00:00Z',end:'2024-01-01T00:00:00Z'}}));
  assert.throws(()=>calculateBazi({birth:{timeZone:'UTC'},utcRange:{start:'2024-01-01T00:00:00Z',end:'2024-01-04T00:00:00Z'}}));
  for(const date of ['1900-12-31T12:00:00Z','2031-01-01T12:00:00Z']) {
    const actual=point(date); assert.equal(actual.status,'unavailable');
    assert.equal(actual.reason,'BAZI_DATE_OUTSIDE_SUPPORTED_RANGE'); assert.deepEqual(actual.evidence,[]);
    assert.ok(Object.values(actual.pillars).every(p=>p===null));
  }
});

test('the BaZi module imports no route, store, payment, mailer, model or provider', () => {
  const source=readFileSync(new URL('./bazi.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from\s+['"][^'"]*(?:models\/|server|db\/|payments\/|notifications\/|writers|openai|anthropic|gemini)/iu);
  assert.doesNotMatch(source,/process\.env|\bfetch\s*\(|https?\.request/u);
});

test('the complete named profile reproduces a published year/month/day plus the HKO hour table', () => {
  assert.deepEqual(pair(point('2024-01-01T04:00:00Z')), { year:'Gui-Mao',month:'Jia-Zi',day:'Jia-Zi',hour:'Geng-Wu' });
  assert.deepEqual(pair(point('2025-02-04T04:00:00Z')), { year:'Yi-Si',month:'Wu-Yin',day:'Jia-Chen',hour:'Geng-Wu' });
});

for (const [year, firstMonthStem] of [[1984,'Bing'],[1985,'Wu'],[1986,'Geng'],[1987,'Ren'],[1988,'Jia'],[1989,'Bing'],[1990,'Wu'],[1991,'Geng'],[1992,'Ren'],[1993,'Jia']]) {
  test(`HKO first-month stem mapping for the sexagenary year ${year}`, () => {
    const actual=point(`${year}-03-01T04:00:00Z`);
    assert.equal(actual.pillars.month.branch,'Yin');
    assert.equal(actual.pillars.month.stem,firstMonthStem);
  });
}
for (const [localDay, firstHourStem] of [[1,'Jia'],[2,'Bing'],[3,'Wu'],[4,'Geng'],[5,'Ren']]) {
  test(`HKO first-hour stem mapping for day ${localDay} in the independently anchored sequence`, () => {
    const utc=new Date(Date.UTC(2024,0,localDay)-8*3600000).toISOString();
    const actual=point(utc);
    assert.equal(actual.pillars.hour.branch,'Zi'); assert.equal(actual.pillars.hour.stem,firstHourStem);
  });
}

test('an approximate birth interval can retain a certain pillar classification when no boundary is crossed', () => {
  const actual=around('2024-01-01T04:00:00Z',10*60000);
  assert.equal(actual.status,'calculated');
  assert.deepEqual(pair(actual),{year:'Gui-Mao',month:'Jia-Zi',day:'Jia-Zi',hour:'Geng-Wu'});
  assert.notEqual(actual.utcRange.start,actual.utcRange.end,'classification stability must not erase the input time window');
});
