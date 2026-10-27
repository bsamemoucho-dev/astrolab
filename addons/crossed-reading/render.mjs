// Standalone local presentation only. Does not import any writer, store, route,
// provider configuration or payment module, and never requests remote assets.
import { zodiacWheelSvg, signDistribution } from "../../src/deliverables/chart.mjs";
import { docStrings } from "../../src/deliverables/i18n.mjs";
import { renderSymbolicReading } from "./symbolicReading.mjs";

const SCHEMA = "lastro.independent_reading@0.1.0";
const BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const T = docStrings("fr");
const CSS = `
:root{color-scheme:light;--ink:#282d36;--muted:#62666c;--line:#dedbd5;--paper:#faf8f4;--gold:#886237}
*{box-sizing:border-box}.person,.birth,p,li,td,h3{overflow-wrap:anywhere}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.65 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:1100px;margin:40px auto;padding:0 28px 35px}header{border-bottom:1px solid var(--line);padding:18px 0 30px}.brand{font:700 25px Georgia,serif}.eyebrow{color:var(--gold);font-size:11px;letter-spacing:.15em;font-weight:700;text-transform:uppercase;margin:15px 0 5px}
h1,h2,h3{font-family:Georgia,"Times New Roman",serif;line-height:1.2}h1{font-size:clamp(30px,5vw,48px);margin:8px 0 12px;font-weight:500}h2{font-size:29px;margin:0 0 12px}h3{font-size:20px;margin:0 0 8px}.person{font:500 25px Georgia,serif;margin:8px 0}.birth{color:var(--muted);margin:8px 0}.note{font-size:13px;color:var(--muted)}.callout{border:1px solid var(--line);border-left:3px solid #9a815e;background:#fff;padding:13px 18px;margin:22px 0}
section{margin-top:38px}.tag{display:inline-block;border:1px solid var(--line);border-radius:20px;padding:3px 10px;margin-bottom:12px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.chart-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:center}.wheel{width:100%;height:auto;max-width:480px;display:block;margin:auto}.wheel-box,.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px}.wheel-box{padding:12px}.angle-label[data-angle="AC"]{text-anchor:end}.angle-label[data-angle="DS"]{text-anchor:start}.legend{font-size:11px;color:var(--muted);line-height:1.5;margin:10px 8px}.angles{display:flex;flex-wrap:wrap;gap:10px;margin:15px 0}.angles p{flex:1;min-width:180px;border-top:1px solid var(--line);padding-top:10px;margin:0}.angles strong{display:block;font-size:12px}.precision{margin-top:20px}
table{border-collapse:collapse;width:100%;font-size:13px;margin:14px 0}th,td{text-align:left;border-bottom:1px solid var(--line);padding:8px 7px;vertical-align:top}th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}td:first-child{font-weight:600}thead{display:table-header-group}tr{break-inside:avoid}code{font-size:10px;overflow-wrap:anywhere;color:var(--muted)}.table-wrap{overflow-x:auto}
.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}.measure{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:5px 0}.measure span:last-child{font-variant-numeric:tabular-nums;font-weight:600}.catalogue{display:grid;grid-template-columns:1fr 1fr;gap:16px}.catalogue article,.unavailable article{padding:15px 0;border-top:1px solid var(--line);break-inside:avoid}.catalogue h3{font-size:19px}.catalogue ul{padding-left:18px;margin:6px 0}.catalogue li{margin:4px 0}.unavailable{display:grid;grid-template-columns:1fr 1fr;gap:0 25px}.unavailable h3{font-size:18px}.unavailable p{font-size:13px;color:var(--muted);margin:0}.small-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.annual-label{font:500 29px Georgia,serif;margin:5px 0}.annual-meta{font-size:12px;color:var(--muted)}details{margin-top:25px;border-top:1px solid var(--line);padding-top:15px}summary{font-weight:600;cursor:pointer}.method-details{font-size:12px;overflow-wrap:anywhere}footer{margin-top:35px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
@media screen and (max-width:740px){main{margin:15px auto;padding:0 18px 25px}.chart-grid,.summary-grid,.catalogue,.unavailable,.small-grid{grid-template-columns:1fr}.wheel{max-width:420px}.card{padding:16px}h2{font-size:25px}}
@page{size:A4;margin:17mm} @media print{body{background:#fff;font-size:10.5pt;line-height:1.5}main{max-width:none;margin:0;padding:0}header{padding:0 0 15px}h1{font-size:29pt}h2{font-size:21pt}h3{font-size:14pt}section{margin-top:23px}h1,h2,h3{break-after:avoid}p{orphans:3;widows:3}.chart-grid{grid-template-columns:1fr 1fr;gap:15px}.wheel-box{padding:6px}.wheel{max-width:80mm}.chart-grid,.summary-grid,.card,.callout,footer{break-inside:avoid}.summary-grid,.small-grid{gap:14px}.catalogue,.unavailable{gap:0 18px}.catalogue article{padding:10px 0}details{display:block}details>*{display:block}details>summary{list-style:none}.table-wrap{overflow:visible}table{font-size:9pt}th,td{padding:5px}a{color:inherit;text-decoration:none}code{font-size:7pt}.tag{font-size:7pt}.legend{font-size:7pt}.note{font-size:9pt}}
`;

function escape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function list(value) { return Array.isArray(value) ? value : []; }
function number(value, digits = 2) {
  return Number.isFinite(value) ? value.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "indéterminé";
}
function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(value ?? ""))) return String(value ?? "date non fournie");
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}
function assertSupported(report) {
  if (report?.schema !== SCHEMA || report.status !== "local_preview") throw new TypeError("INDEPENDENT_READING_LOCAL_PREVIEW_REQUIRED");
  const frame = report.tropical?.frame;
  if (frame?.method !== "western-natal" || frame.zodiac !== "tropical" || frame.houseSystem !== "WHOLE_SIGN") throw new TypeError("INDEPENDENT_READING_TROPICAL_FRAME_REQUIRED");
  if (!report.tropical?.socle || report.symbolic?.status !== "catalogue_only") throw new TypeError("INDEPENDENT_READING_CATALOGUE_REQUIRED");
  if (list(report.symbolic.entries).some((entry) => entry.frame !== "western-tropical")) throw new TypeError("INDEPENDENT_READING_SYMBOLIC_FRAME_MISMATCH");
  if (report.crossTraditionSynthesis?.status !== "not_licensed") throw new TypeError("CROSS_TRADITION_SYNTHESIS_NOT_SUPPORTED");
  assertAdditionalFrames(report);
  const annual = report.chineseAnnual;
  if (annual?.status === "calculated" && (annual.frame?.calendar !== "chinese-lunisolar" || annual.frame.yearBoundary !== "lunar_new_year" || annual.frame.timeZone !== "Asia/Shanghai")) throw new TypeError("CHINESE_ANNUAL_FRAME_REQUIRED");
}
function timeLabel(birth, socle) {
  if (birth.timePrecision === "unknown") return "heure inconnue";
  if (birth.timePrecision === "interval") return `entre ${birth.timeStart ?? "?"} et ${birth.timeEnd ?? "?"}`;
  const time = birth.timeValue ?? socle.birth?.timeValue ?? "heure non fournie";
  if (birth.timePrecision === "approximate") {
    const margin = socle.timeLanguageCap?.marginMinutes ?? birth.timeMarginMinutes;
    return `${time} (heure approximative${Number.isFinite(margin) ? `, marge ±${margin} min` : ""})`;
  }
  return `${time} (heure déclarée précise)`;
}
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th scope="col">${escape(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function proofLabel(ref, byBody) {
  const value = ref?.value ?? {};
  const planet = (body) => byBody.get(body)?.label ?? T.planets?.[body] ?? body ?? "corps non précisé";
  if (ref?.type === "NATAL_BODY_SIGN") return `${planet(value.body)} en ${T.signs?.[value.sign] ?? value.sign}`;
  if (ref?.type === "NATAL_BODY_HOUSE") return `${planet(value.body)} en maison ${value.house}`;
  if (ref?.type === "ANGLE_SIGN") return `${value.angle === "ascendant" ? "Ascendant" : value.angle === "descendant" ? "Descendant" : value.angle} en ${T.signs?.[value.sign] ?? value.sign}`;
  if (ref?.type === "NATAL_ASPECT") return `${planet(value.bodyA)} – ${planet(value.bodyB)} : ${T.aspects?.[value.aspectType] ?? value.aspectType}`;
  return ref?.evidenceId ?? "Repère du catalogue";
}
function annualReason(reason) {
  const labels = {
    DATE_OUTSIDE_LOCAL_PREVIEW_RANGE: "Cette date dépasse la plage de référence de l’aperçu local (1901–2030).",
    CHINESE_CALENDAR_RUNTIME_UNAVAILABLE: "Le calendrier chinois n’est pas disponible dans le moteur local utilisé.",
    CHINESE_CALENDAR_COUNTER_UNAVAILABLE: "Le moteur local ne fournit pas l’année associée nécessaire à ce repère.",
    ANNUAL_YEAR_UNCERTAIN_WITHIN_BIRTH_WINDOW: "La fenêtre de naissance traverse un changement d’année chinoise ; aucun animal unique n’est attribué."
  };
  return labels[reason] ?? reason ?? "Le calcul de l’année chinoise n’est pas fourni dans cet aperçu.";
}
function annualSection(annual) {
  if (annual?.status !== "calculated") return `<section aria-labelledby="annual-title"><span class="tag">Module distinct</span><h2 id="annual-title">Repère annuel chinois</h2><div class="callout"><p>Repère indisponible.</p><p class="note">${escape(annualReason(annual?.reason))}</p></div></section>`;
  return `<section aria-labelledby="annual-title"><span class="tag">Repère calendaire calculé</span><h2 id="annual-title">L’année chinoise de naissance</h2><div class="card"><p class="annual-label">${escape(annual.animalFr)} · ${escape(annual.elementFr)}</p><p>Année associée : <strong>${escape(annual.relatedYear)}</strong>.</p><p class="annual-meta">Calendrier luni-solaire chinois · frontière au Nouvel An lunaire · fuseau Asia/Shanghai.</p><p class="note">L’animal et l’élément nomment le cycle annuel dans cette convention calendaire. Ils ne décrivent pas une personnalité. Ce repère annuel ne calcule pas les quatre piliers du BaZi ; ceux-ci sont présentés séparément lorsqu’ils sont calculables.</p></div></section>`;
}


function assertAdditionalFrames(report) {
  const j = report.jyotish;
  if (j && (j.frame?.zodiac !== 'sidereal' || j.frame.houseSystem !== 'WHOLE_SIGN' || j.frame.ayanamshaId !== 'lahiri_iae1985'
      || j.frame.numericalLongitudeToleranceDegrees !== 61 / 3600 || j.frame.coordinateSystem !== 'geocentric_apparent_true_ecliptic_of_date'
      || j.frame.methodVersion !== 'lastro-jyotish-calculation@1.0.0' || j.frame.meanNodeConvention !== 'IERS2003_mean_node_plus_nutation'
      || j.interpretationStatus !== 'not_licensed' || !['calculated', 'uncertain', 'unavailable'].includes(j.status))) throw new TypeError('JYOTISH_SIDEREAL_LAHIRI_FRAME_REQUIRED');
  const d = report.dashas;
  if (d && (d.frame?.method !== 'lastro-vimshottari@0.1.0' || d.frame.system !== 'Vimshottari' || d.frame.zodiac !== 'sidereal'
      || d.frame.yearDays !== 365.25 || d.frame.cycleYears !== 120 || d.frame.periodBoundary !== 'start_inclusive_end_exclusive'
      || d.interpretationStatus !== 'not_licensed' || !['calculated', 'uncertain', 'unavailable'].includes(d.status))) throw new TypeError('VIMSHOTTARI_FRAME_REQUIRED');
  if (d?.status === 'calculated') {
    const moon = list(j?.evidence).find(proof => proof.evidenceId === d.sourceMoonEvidenceRef);
    if (!moon || !Number.isFinite(d.frame.moonLongitudeToleranceDegrees) || d.frame.moonLongitudeToleranceDegrees < j.frame.numericalLongitudeToleranceDegrees || moon.type !== 'JYOTISH_BODY_POSITION' || moon.frame !== 'jyotish-sidereal-lahiri' || moon.value?.body !== 'Moon') throw new TypeError('VIMSHOTTARI_SIDEREAL_MOON_SOURCE_REQUIRED');
  }
  const b = report.bazi;
  if (b && (b.frame?.method !== 'bazi-four-pillars' || b.frame.methodVersion !== 'lastro-bazi-civil-jie@1.0.0'
      || b.frame.calendar !== 'gregorian-civil-plus-solar-jie' || b.frame.yearBoundary !== 'li_chun' || b.frame.monthBoundary !== 'jie_solar_terms'
      || b.frame.dayBoundary !== 'local_midnight' || b.frame.ziHourConvention !== 'split_at_local_midnight'
      || b.frame.hourBasis !== 'local_civil' || b.frame.solarTimeCorrectionApplied !== false || b.frame.solarBoundaryGuardSeconds !== 120
      || b.interpretationStatus !== 'not_licensed' || !['calculated', 'uncertain', 'unavailable'].includes(b.status))) throw new TypeError('BAZI_CIVIL_JIE_FRAME_REQUIRED');
}
function methodReason(reason) {
  const known = {
    JYOTISH_DATE_OUTSIDE_VERIFIED_RANGE: 'Cette naissance se situe hors de la plage de référence vérifiée (1901–2030).',
    BAZI_DATE_OUTSIDE_SUPPORTED_RANGE: 'Cette naissance se situe hors de la plage de référence des quatre piliers (1901–2030).',
    NONZERO_BIRTH_WINDOW: 'La fenêtre de naissance ne permet pas d’attribuer une position unique.',
    MOON_RANGE_REQUIRED_FOR_BIRTH_WINDOW: 'La fenêtre de naissance nécessite aussi une plage lunaire calculée ; aucun calendrier de périodes précis n’est attribué.',
    BIRTH_NAKSHATRA_UNCERTAIN: 'La fenêtre de naissance ou la marge numérique traverse une limite de nakshatra ; aucun calendrier de périodes unique n’est attribué.',
    BIRTH_TIME_OR_LONGITUDE_UNCERTAIN: 'L’heure ou la longitude lunaire reste une plage ; aucun calendrier de périodes précis n’est attribué.',
    JYOTISH_MOON_UNAVAILABLE: 'La position lunaire sidérale ne permet pas de calculer un calendrier de périodes unique.',
    SOURCE_SIDEREAL_MOON_UNAVAILABLE: 'La position lunaire sidérale ne permet pas de calculer un calendrier de périodes unique.',
    EXACT_BIRTH_TIME_REQUIRED_FOR_SIDEREAL_ANGLE: 'L’heure de naissance ne permet pas d’attribuer un angle sidéral unique.'
  };
  return known[reason] ?? 'Les données ou leurs marges ne permettent pas d’attribuer un résultat unique dans ce cadre.';
}
function jyotishPosition(value) {
  if (value?.status === 'calculated' && value.signFr && Number.isFinite(value.degreeInSign)) return `${value.signFr} ${number(value.degreeInSign)}°`;
  const choices = list(value?.candidates).map(candidate => candidate.signFr).filter(Boolean);
  return choices.length ? `Signe indéterminé : ${choices.join(' / ')}` : 'position non établie';
}
function jyotishSection(j) {
  if (!j) return '';
  const head = '<section aria-labelledby="jyotish-title"><span class="tag">Calcul sidéral · Lahiri</span><h2 id="jyotish-title">Votre carte sidérale / Jyotish</h2>';
  if (j.status === 'unavailable') return `${head}<div class="callout"><p>${escape(methodReason(j.reason))}</p></div></section>`;
  const rows = list(j.positions).map(position => [position.label ?? T.planets?.[position.body] ?? position.body,
    jyotishPosition(position), position.status === 'calculated' && Number.isInteger(position.house) ? `Maison ${position.house}` : 'non établie']);
  const n = j.nakshatra;
  const nak = n?.name ? `${n.name}${Number.isInteger(n.pada) ? ` · pada ${n.pada}` : ' · pada indéterminé'}`
    : list(n?.candidates).length ? `Nakshatra indéterminé : ${n.candidates.map(value => value.name).join(' / ')}` : 'nakshatra non établi avec cette fenêtre de naissance';
  const angles = [['Ascendant sidéral', j.angles?.ascendant], ['Milieu du Ciel sidéral', j.angles?.midheaven]];
  return `${head}<p>Zodiaque <strong>sidéral</strong>, variante <strong>Lahiri IAE 1985</strong> · maisons entières. Les positions sont exprimées dans ce cadre, distinct du zodiaque tropical présenté plus haut.</p>
  ${table(['Corps ou nœud', 'Position sidérale', 'Maison entière'], rows)}
  <div class="angles">${angles.map(([label, value]) => `<p><strong>${escape(label)}</strong>${escape(jyotishPosition(value))}</p>`).join('')}</div>
  <div class="card"><h3>Le nakshatra de la Lune</h3><p>${escape(nak)}</p><p class="note">Un nakshatra est un secteur sidéral de 13°20′ ; un pada en est le quart. ${n?.lord ? `Maître traditionnel du secteur : ${escape(T.planets?.[n.lord] ?? n.lord)}. ` : ''}Ce classement n’établit pas une qualité ou un événement personnel.</p></div>
  <p class="note">Rahu et Ketu désignent ici les nœuds lunaires <strong>moyens</strong>, pas des planètes physiques. La marge numérique est de 1′01″ : elle protège les frontières de signes et de secteurs. Une maison ou un degré non établi n’est pas remplacé par une valeur fictive.</p>
  ${list(j.warnings).length ? `<div class="callout precision"><ul>${j.warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul></div>` : ''}</section>`;
}
function calendarDate(value, timeZone) {
  if (typeof value !== 'string' || !value.endsWith('Z') || !Number.isFinite(Date.parse(value))) throw new TypeError('TRADITIONAL_CALENDAR_UTC_REQUIRED');
  let text;
  try { text = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(value)); }
  catch { throw new TypeError('TRADITIONAL_CALENDAR_TIME_ZONE_REQUIRED'); }
  return text.replace(/^1 /u, '1er ');
}
function boundedCalendar(range, zone) {
  if (!range?.earliest || !range?.latest || Date.parse(range.earliest) > Date.parse(range.latest)) throw new TypeError('DASHA_DATE_RANGE_REQUIRED');
  const first = calendarDate(range.earliest, zone), last = calendarDate(range.latest, zone);
  return first === last ? first : `du ${first} au ${last}`;
}
const lordLabel = lord => T.planets?.[lord] ?? lord;
function dashaSection(d) {
  if (!d) return '';
  const head = '<section aria-labelledby="dasha-title"><span class="tag">Calendrier traditionnel · calcul de durées</span><h2 id="dasha-title">Les périodes Vimshottari</h2>';
  if (d.status !== 'calculated') {
    const choices = list(d.possibleBirthLords).map(lordLabel).join(' / ');
    return `${head}<div class="callout"><p>${escape(methodReason(d.reason))}</p>${choices ? `<p>Maîtres de départ possibles : ${escape(choices)}.</p>` : ''}</div><p class="note">Aucune date précise de mahadasha ou d’antardasha n’est attribuée tant que les données ne permettent pas un calendrier unique.</p></section>`;
  }
  const zone = d.frame.timeZone;
  const balance = d.birthBalance;
  const remaining = balance?.remainingYearsRange;
  const balanceText = Number.isFinite(remaining?.min) && Number.isFinite(remaining?.max)
    ? `${number(remaining.min, 3)} à ${number(remaining.max, 3)} ans de cette convention`
    : `${number(balance?.remainingYears, 3)} ans de cette convention`;
  const rows = list(d.periods).map(period => [lordLabel(period.lord), boundedCalendar(period.startRangeUtc, zone), boundedCalendar(period.endRangeUtc, zone)]);
  let current = '';
  if (d.current?.status === 'calculated') {
    const maha = d.current.mahadasha, antar = d.current.antardasha;
    current = `<div class="callout"><strong>À la date du ${escape(calendarDate(d.asOfUtc, zone))}</strong><p>Mahadasha : ${escape(lordLabel(maha?.lord))} · antardasha : ${escape(lordLabel(antar?.lord))}.</p></div>
    <h3>Les neuf sous-périodes de cette mahadasha</h3>${table(['Antardasha', 'Fenêtre du début', 'Fenêtre de la fin'], list(maha?.antardashas).map(period => [lordLabel(period.lord), boundedCalendar(period.startRangeUtc, zone), boundedCalendar(period.endRangeUtc, zone)]))}`;
  } else if (d.current?.status === 'uncertain') {
    const candidates = list(d.current.candidates).map(entry => `${lordLabel(entry.mahadashaLord)} / ${lordLabel(entry.antardashaLord)}`).join(' ; ');
    current = `<div class="callout"><strong>Jonction de périodes incertaine à cette date</strong><p>La marge numérique ne permet pas de choisir une seule paire de maîtres.${candidates ? ` Possibilités : ${escape(candidates)}.` : ''}</p></div>`;
  } else if (d.current?.status === 'outside_horizon') current = '<p class="note">La date de consultation est hors de l’horizon calculé ; aucune période courante n’est attribuée.</p>';
  return `${head}<p>Le système répartit un cycle de 120 ans entre neuf maîtres traditionnels à partir du nakshatra lunaire. Une année est ici une <strong>durée fixe de 365,25 jours</strong>. Ce calendrier conventionnel ne prédit pas des événements.</p>
    <p>À la naissance, le solde de la période « ${escape(lordLabel(balance?.lord))} » est de ${escape(balanceText)}. Son début théorique peut être antérieur à la naissance ; ses sous-périodes ne sont pas redémarrées à cette date.</p>
    <p class="note">Dates présentées dans le fuseau ${escape(zone)}. Les plages ci-dessous propagent la marge lunaire ; les millisecondes internes ne constituent pas une précision de naissance. Les débuts sont inclus, les fins exclues.</p>
    ${table(['Mahadasha', 'Fenêtre du début', 'Fenêtre de la fin'], rows)}${current}</section>`;
}
function baziSection(b) {
  if (!b) return '';
  const head = '<section aria-labelledby="bazi-title"><span class="tag">Quatre piliers · calendrier solaire et civil</span><h2 id="bazi-title">Les quatre piliers du BaZi</h2>';
  if (b.status === 'unavailable') return `${head}<div class="callout"><p>${escape(methodReason(b.reason))}</p></div></section>`;
  const rows = [['year', 'Année'], ['month', 'Mois'], ['day', 'Jour'], ['hour', 'Heure']].map(([key, label]) => {
    const pillar = b.pillars?.[key];
    if (pillar?.status === 'calculated') return [label, pillar.stem, pillar.branch, `${pillar.ganZhi}${pillar.hanzi ? ` · ${pillar.hanzi}` : ''}`];
    const candidates = list(pillar?.candidates).map(value => `${value.ganZhi}${value.hanzi ? ` · ${value.hanzi}` : ''}`);
    return [label, 'non unique', 'non unique', candidates.length ? `Possibilités : ${candidates.join(' / ')}` : 'non établi avec les données fournies'];
  });
  return `${head}<p>Chaque pilier associe un tronc et une branche du cycle traditionnel. Dans cette méthode, l’année change à <strong>Li Chun</strong> et les mois aux termes solaires <strong>Jie</strong> : la frontière diffère de l’année populaire au Nouvel An lunaire.</p>
  ${table(['Pilier', 'Tronc', 'Branche', 'Désignation'], rows)}
  <p class="note">Convention locale : fuseau ${escape(b.frame.timeZone)}, jour à minuit civil et heure civile incluant l’éventuelle heure d’été. L’heure Zi est partagée à minuit ; aucune correction en heure solaire vraie n’est appliquée. Une naissance proche d’une frontière solaire conserve ses possibilités au lieu de choisir silencieusement un pilier.</p>
  <p class="note">Ces désignations sont calculées selon les conventions annoncées. Aucun caractère, événement familial ou résultat futur n’en est déduit.</p></section>`;
}
function additionalMetadata(report) {
  const rows = [];
  if (report.jyotish) {
    const j = report.jyotish;
    rows.push(['Méthode sidérale', j.frame.methodVersion], ['Variante d’ayanamsha', j.frame.ayanamshaVersion], ['Référence sidérale', j.frame.ayanamshaId],
      ['Ayanamsha aux bornes', j.ayanamsha ? `${number(j.ayanamsha.start, 6)}° / ${number(j.ayanamsha.end, 6)}°` : 'non établi'], ['Tolérance des longitudes sidérales', `${number(j.frame.numericalLongitudeToleranceDegrees, 6)}°`]);
  }
  if (report.dashas) rows.push(['Méthode de périodes', report.dashas.frame.method], ['Année Vimshottari', `${number(report.dashas.frame.yearDays, 2)} jours`], ['Preuve de la Lune utilisée', report.dashas.sourceMoonEvidenceRef ?? 'calendrier non attribué']);
  if (report.bazi) rows.push(['Méthode des quatre piliers', report.bazi.frame.methodVersion], ['Fuseau civil du BaZi', report.bazi.frame.timeZone], ['Ancrage du cycle journalier', report.bazi.frame.dayReference?.civilDate ?? 'non fourni'], ['Précision numérique de la recherche solaire', `${number(report.bazi.frame.solarRootSearchPrecisionSeconds, 2)} s`], ['Marge conservatrice de classement aux frontières solaires', `${number(report.bazi.frame.solarBoundaryGuardSeconds, 0)} s`]);
  return rows.length ? `<h3>Conventions des modules complémentaires</h3>${table(['Repère', 'Valeur'], rows)}` : '';
}

export function renderIndependentReading(report, { presentation = 'local' } = {}) {
  if (!['local', 'web'].includes(presentation)) throw new TypeError('UNSUPPORTED_COMPLEMENT_PRESENTATION');
  assertSupported(report);
  const web = presentation === 'web';
  const readingHtml = web ? renderSymbolicReading(report) : '';
  const { frame } = report.tropical;
  const birth = report.birth ?? {};
  const highLatitude = Number.isFinite(birth.latitude) && Math.abs(birth.latitude) >= 65;
  // Presentation-only restriction of this add-on. The legacy result, socle,
  // proofs, planet longitudes and retained aspects remain untouched.
  const socle = highLatitude ? {
    ...report.tropical.socle, ascendant: null, midheaven: null,
    housesAvailable: false, housesDecidableWithinMargin: false,
    bodies: list(report.tropical.socle.bodies).map(body => ({ ...body, house: null }))
  } : report.tropical.socle;
  const bodies = list(socle.bodies).filter((body) => BODIES.includes(body.body));
  const byBody = new Map(bodies.map((body) => [body.body, body]));
  const byEvidence = new Map(list(report.tropical.evidence?.evidence).map((item) => [item.evidenceId, item]));
  const positionRows = BODIES.map((name) => {
    const body = byBody.get(name);
    const houseAllowed = socle.housesAvailable !== false && socle.housesDecidableWithinMargin !== false && body?.signStableWithinMargin !== false && Number.isInteger(body?.house);
    return [body?.label ?? T.planets?.[name] ?? name, body?.degreeLabel ?? "position non établie", houseAllowed ? `Maison ${body.house}` : "non établie", body?.retrograde ? "rétrograde apparent" : "—"];
  });
  const aspects = list(socle.retainedAspects ?? socle.aspectGeometry);
  const aspectRows = aspects.map((aspect) => [
    `${byBody.get(aspect.bodyA)?.label ?? T.planets?.[aspect.bodyA] ?? aspect.bodyA} – ${byBody.get(aspect.bodyB)?.label ?? T.planets?.[aspect.bodyB] ?? aspect.bodyB}`,
    aspect.aspectLabel ?? T.aspects?.[aspect.type] ?? aspect.type,
    `${number(aspect.exactness)}°`, `${number(aspect.orbUsed)}°`
  ]);
  const orbRows = list(socle.aspectConvention?.orbTable).map((orb) => [T.aspects?.[orb.type] ?? orb.type, `${number(orb.orbDegrees, 0)}°`, `${number(orb.orbDegreesWithLuminary, 0)}°`]);
  const distribution = signDistribution(bodies);
  const measures = (values, names) => Object.entries(names).map(([key, label]) => `<div class="measure"><span>${escape(label)}</span><span>${escape(values[key] ?? 0)} / ${escape(distribution.classified)}</span></div>`).join("");
  const entries = list(report.symbolic.entries).filter(entry => !highLatitude
    || !["ANGLE_SIGN", "NATAL_BODY_HOUSE"].includes(byEvidence.get(entry.evidenceId)?.type));
  const catalogue = entries.length ? entries.map((entry) => `<article><h3>${escape(proofLabel(byEvidence.get(entry.evidenceId), byBody))}</h3><ul>${list(entry.themes).map((theme) => `<li>${escape(theme)}</li>`).join("")}</ul></article>`).join("") : `<p>Aucun repère interprétatif licencié n’est fourni dans cet aperçu.</p>`;
  const unavailable = list(report.unavailable).map((item) => `<article><h3>${escape(item.title)}</h3><p>${escape(item.reason)}</p></article>`).join("");
  const metadata = [
    ["Instant astronomique UTC", frame.utc ?? "non établi"], ["Fuseau de naissance", frame.timeZone ?? birth.timeZone ?? "non fourni"],
    ["Méthode", frame.methodVersion ?? "non fournie"], ["Moteur astronomique", frame.astronomyEngineVersion ?? "non fourni"],
    ["Éphémérides", frame.ephemerisVersion ?? "non fournies"], ["Convention d’aspects", frame.aspectRuleVersion ?? socle.aspectConvention?.ruleVersionId ?? "non fournie"],
    ["Bibliothèque symbolique", frame.interpretationLibraryVersion ?? "non fournie"], ["Version des preuves", frame.evidenceVersion ?? "non fournie"],
    ["Coordonnées utilisées", `${number(birth.latitude, 5)} ; ${number(birth.longitude, 5)}`], ["Origine déclarée des coordonnées", birth.coordinateSource ?? "non précisée"],
    ["Précision géographique déclarée", birth.coordinateConfidence ?? "non précisée"]
  ];
  const notes = [
    ...(highLatitude ? ["Angles et maisons non restitués à ces latitudes dans ce complément ; positions planétaires conservées."] : []),
    ...list(socle.uncertaintyNotes), ...(web ? [] : list(socle.warnings))
  ];
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Lastro · aperçu indépendant · ${escape(report.personLabel ?? "Lecture")}</title><style>${CSS}</style></head>
<body><main>
<header><div class="brand">Lastro</div><p class="eyebrow">Aperçu local · complément indépendant</p><h1>Une carte, des repères distincts</h1>${report.personLabel ? `<p class="person">${escape(report.personLabel)}</p>` : ""}<p class="birth">${escape(date(birth.birthDate ?? socle.birth?.date))} · ${escape(timeLabel(birth, socle))}<br>${escape(birth.placeName ?? socle.birth?.placeName ?? "lieu non fourni")} · ${escape(birth.timeZone ?? socle.birth?.timeZone ?? "fuseau non fourni")}</p></header>
<div class="callout"><strong>Base de préparation locale</strong><p>Les positions et calendriers ci-dessous sont calculés selon les méthodes indiquées dans chaque section. Les repères symboliques présentent le vocabulaire des règles disponibles ; une lecture personnalisée complète reste à rédiger et à contrôler. Aucun texte IA nouveau n’est produit par cet aperçu.</p></div>
<section aria-labelledby="tropical-title"><span class="tag">Calcul tropical occidental</span><h2 id="tropical-title">Votre carte de naissance</h2><p>Zodiaque <strong>tropical</strong> · <strong>maisons entières (Whole Sign)</strong> · sept corps traditionnels. Chaque signe constitue une maison entière ; un autre système de maisons peut donner des numéros différents.</p><div class="chart-grid"><div class="wheel-box">${zodiacWheelSvg(socle, T, { size: 480 })}<p class="legend">Repères et traits : longitudes et aspects réellement calculés. Bleu continu : sextile ou trigone ; rouge tireté : carré ou opposition ; gris pointillé : conjonction, sans classement automatique.<br>AC : Ascendant · DS : Descendant · MC : Milieu du Ciel · FC : Fond du Ciel. R : mouvement rétrograde apparent. Les arcs et « ? » signalent une position incertaine.</p></div><div>${table(["Corps", "Position", "Maison entière", "Mouvement"], positionRows)}<div class="angles">${[["Ascendant", socle.ascendant], ["Milieu du Ciel", socle.midheaven]].map(([label, angle]) => `<p><strong>${label}</strong>${escape(angle?.degreeLabel ?? "non établi avec les données fournies")}</p>`).join("")}</div></div></div>${notes.length ? `<div class="callout precision"><strong>Précision et limites du calcul</strong><ul>${notes.map((note) => `<li>${escape(note)}</li>`).join("")}</ul></div>` : ""}</section>
<section aria-labelledby="aspects-title"><span class="tag">Géométrie et convention d’orbes</span><h2 id="aspects-title">Les aspects retenus</h2><p>L’orbe réel est l’écart entre l’angle mesuré et l’angle exact de l’aspect. L’orbe maximal est le seuil choisi par Lastro pour le retenir : il s’agit d’une convention astrologique documentée.</p>${aspectRows.length ? table(["Couple", "Aspect", "Orbe réel", "Orbe maximal"], aspectRows) : `<p>Aucun aspect retenu n’est fourni pour cette fenêtre de naissance.</p>`}${orbRows.length ? `<h3>Seuils de la convention ${escape(socle.aspectConvention?.ruleVersionId ?? frame.aspectRuleVersion)}</h3>${table(["Aspect", "Orbe standard", "Avec Soleil ou Lune"], orbRows)}` : ""}<div class="summary-grid"><div class="card"><h3>Les quatre éléments</h3>${measures(distribution.byElement, {fire:"Feu",earth:"Terre",air:"Air",water:"Eau"})}</div><div class="card"><h3>Les trois modalités</h3>${measures(distribution.byModality, {cardinal:"Cardinal",fixed:"Fixe",mutable:"Mutable"})}</div></div><p class="note">Décompte sans pondération des sept corps traditionnels : ${escape(distribution.classified)} signe(s) établi(s), ${escape(distribution.notEstablished.length)} non établi(s). Ce décompte ne mesure pas la force d’une planète ni une qualité personnelle.</p></section>
<section aria-labelledby="symbolic-title"><span class="tag">Vocabulaire symbolique · catalogue uniquement</span><h2 id="symbolic-title">Des pistes documentées pour la lecture</h2><p>Chaque entrée renvoie à un placement calculé et à sa règle Lastro. Ces mots sont une matière de rédaction ; ils ne constituent pas un portrait psychologique, une prédiction ni une nouvelle interaction entre configurations.</p><div class="catalogue">${catalogue}</div></section>
${jyotishSection(report.jyotish)}
${dashaSection(report.dashas)}
${annualSection(report.chineseAnnual)}
${baziSection(report.bazi)}
<section aria-labelledby="limits-title"><span class="tag">Périmètre de cet aperçu</span><h2 id="limits-title">Ce qui reste à préparer</h2><div class="unavailable">${unavailable || `<p>Aucun autre module n’est déclaré dans cet aperçu.</p>`}</div><div class="callout"><strong>Traditions présentées séparément</strong><p>Aucune synthèse croisée n’est licenciée ici. Une ressemblance entre des vocabulaires occidentaux et chinois n’apporte pas une preuve indépendante sur une personne. Les positions sidérales, nakshatras, dashas et piliers BaZi ne sont jamais déduits du texte d’exemple.</p></div></section>
<details open><summary>Références du calcul et de la préparation</summary><div class="method-details">${table(["Repère", "Valeur"], metadata)}${additionalMetadata(report)}<h3>Traçabilité des repères symboliques</h3>${table(["Placement", "Règle", "Preuve"], entries.map((entry) => [proofLabel(byEvidence.get(entry.evidenceId), byBody), entry.ruleId, entry.evidenceId]))}<p>Schéma ${escape(report.schema)} · préparation ${escape(report.generatedAt ?? "non datée")}${report.chineseAnnual?.frame?.runtimeIcu ? ` · calendrier calculé avec ICU ${escape(report.chineseAnnual.frame.runtimeIcu)}` : ""}.</p></div></details>
<footer>Complément autonome en aperçu local. Le parcours Lastro existant demeure séparé. Les calculs décrivent des positions et des conventions ; les significations astrologiques relèvent d’une lecture symbolique. Aucun diagnostic, événement biographique ou résultat futur n’est établi par cet aperçu.</footer>
</main></body></html>`;
  if (!web) return html;
  // The factual report and its validation contract remain unchanged. Only this
  // separate presentation is offered by the independent, stateless web tool.
  const intro = '<strong>Vos repères de naissance</strong><p>Ce complément réunit des calculs tropicaux, sidéraux et calendaires, avec des explications documentées. Les traditions restent distinctes : les résultats ne constituent ni une prédiction ni un portrait psychologique. Ce document a été calculé sans génération IA.</p>';
  return html
    .replace('Aperçu local · complément indépendant', 'Complément indépendant')
    .replace('Lastro · aperçu indépendant', 'Lastro · complément indépendant')
    .replace('Une carte, des repères distincts', 'Votre complément de naissance')
    .replace(/<div class="callout"><strong>Base de préparation locale<\/strong>[\s\S]*?<\/div>/, `<div class="callout">${intro}</div>`)
    .replace(/<section aria-labelledby="symbolic-title">[\s\S]*?<\/section>/, readingHtml)
    .replace(/<h2 id="limits-title">Ce qui reste à préparer<\/h2><div class="unavailable">[\s\S]*?<\/div>/, '<h2 id="limits-title">Le périmètre de votre complément</h2><p>Ce complément couvre les positions et maisons calculables, les aspects tropicaux, le secteur lunaire sidéral, les périodes Vimshottari et les quatre piliers civils. Il n’inclut pas de consultation complète de Jyotish ou de BaZi, de progressions ni de lecture transgénérationnelle.</p>')
    .replace('<details open><summary>Références', '<details><summary>Références')
    .replace(/<h3>Traçabilité des repères symboliques<\/h3>[\s\S]*?<\/table><\/div>/, '')
    .replace('Complément autonome en aperçu local.', 'Complément autonome de calculs et de repères documentés.')
    .replace('Aucune synthèse croisée n’est licenciée ici.', 'Chaque tradition conserve son propre cadre de lecture.')
    .replace('Périmètre de cet aperçu', 'Périmètre du complément')
    .replace('</style>', '@media print{header{padding-bottom:8px}.brand{font-size:16pt}.eyebrow{font-size:7pt;margin:6px 0 4px}h1{font-size:23pt;margin:4px 0 7px}.person{font-size:16pt;margin:4px 0}.birth{font-size:9pt;line-height:1.35;margin:4px 0}.callout{margin:12px 0;padding:8px 12px}.callout p{margin:6px 0}section{margin-top:16px}.tag{display:table;break-after:avoid}.documented-reading article{break-inside:avoid}section[aria-labelledby="limits-title"]{font-size:8pt;margin-top:12px}#limits-title{font-size:13pt}section[aria-labelledby="limits-title"] .callout{border:0;margin:6px 0;padding:0}.chart-grid{gap:12px}.wheel{max-width:70mm}.chart-grid table{font-size:8pt}.chart-grid th,.chart-grid td{padding:4px}.chart-grid th:first-child,.chart-grid td:first-child{white-space:nowrap}.angles{display:block}.angles p{min-width:0;display:inline-block;width:48%;font-size:8pt}.legend{line-height:1.35}.documented-reading article{padding:9px 0}.documented-reading details{font-size:8pt}}' + '</style>')
    .replace('<h3>Conventions des modules complémentaires</h3>', `${list(socle.warnings).length ? `<h3>Notes techniques du moteur</h3><ul>${socle.warnings.map(note => `<li>${escape(note)}</li>`).join('')}</ul>` : ''}<h3>Conventions des modules complémentaires</h3>`)
    .replace('<title>', '<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; base-uri \'none\'; form-action \'none\'"><title>')
    .replace('"Segoe UI",sans-serif', '"Segoe UI","Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif')
    .replace('section{margin-top:38px}', '.chart-grid>*,.summary-grid>*,.small-grid>*{min-width:0}.table-wrap{max-width:100%}th{overflow-wrap:anywhere}.documented-reading article{padding:14px 0;border-top:1px solid var(--line)}.documented-reading article p{max-width:78ch;margin:10px 0}section{margin-top:38px}')
    .replace('@media print{body{', '@media print{*{print-color-adjust:exact;-webkit-print-color-adjust:exact}body{');
}
