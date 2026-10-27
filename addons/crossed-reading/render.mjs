// Standalone local presentation only. Does not import any writer, store, route,
// provider configuration or payment module, and never requests remote assets.
import { zodiacWheelSvg, signDistribution } from "../../src/deliverables/chart.mjs";
import { docStrings } from "../../src/deliverables/i18n.mjs";

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
  return `<section aria-labelledby="annual-title"><span class="tag">Repère calendaire calculé</span><h2 id="annual-title">L’année chinoise de naissance</h2><div class="card"><p class="annual-label">${escape(annual.animalFr)} · ${escape(annual.elementFr)}</p><p>Année associée : <strong>${escape(annual.relatedYear)}</strong>.</p><p class="annual-meta">Calendrier luni-solaire chinois · frontière au Nouvel An lunaire · fuseau Asia/Shanghai.</p><p class="note">L’animal et l’élément nomment le cycle annuel dans cette convention calendaire. Ils ne décrivent pas une personnalité. Ce repère annuel ne calcule pas les quatre piliers du BaZi, dont les conventions doivent être définies séparément.</p></div></section>`;
}

export function renderIndependentReading(report) {
  assertSupported(report);
  const { socle, frame } = report.tropical;
  const birth = report.birth ?? {};
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
  const entries = list(report.symbolic.entries);
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
  const notes = [...list(socle.uncertaintyNotes), ...list(socle.warnings)];
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Lastro · aperçu indépendant · ${escape(report.personLabel ?? "Lecture")}</title><style>${CSS}</style></head>
<body><main>
<header><div class="brand">Lastro</div><p class="eyebrow">Aperçu local · complément indépendant</p><h1>Une carte, des repères distincts</h1>${report.personLabel ? `<p class="person">${escape(report.personLabel)}</p>` : ""}<p class="birth">${escape(date(birth.birthDate ?? socle.birth?.date))} · ${escape(timeLabel(birth, socle))}<br>${escape(birth.placeName ?? socle.birth?.placeName ?? "lieu non fourni")} · ${escape(birth.timeZone ?? socle.birth?.timeZone ?? "fuseau non fourni")}</p></header>
<div class="callout"><strong>Base de préparation locale</strong><p>Les positions ci-dessous viennent du moteur de calcul existant. Les repères symboliques présentent le vocabulaire des règles disponibles ; une lecture personnalisée complète reste à rédiger et à contrôler. Aucun texte IA nouveau n’est produit par cet aperçu.</p></div>
<section aria-labelledby="tropical-title"><span class="tag">Calcul tropical occidental</span><h2 id="tropical-title">Votre carte de naissance</h2><p>Zodiaque <strong>tropical</strong> · <strong>maisons entières (Whole Sign)</strong> · sept corps traditionnels. Chaque signe constitue une maison entière ; un autre système de maisons peut donner des numéros différents.</p><div class="chart-grid"><div class="wheel-box">${zodiacWheelSvg(socle, T, { size: 480 })}<p class="legend">Repères et traits : longitudes et aspects réellement calculés. Bleu continu : sextile ou trigone ; rouge tireté : carré ou opposition ; gris pointillé : conjonction, sans classement automatique.<br>AC : Ascendant · DS : Descendant · MC : Milieu du Ciel · FC : Fond du Ciel. R : mouvement rétrograde apparent. Les arcs et « ? » signalent une position incertaine.</p></div><div>${table(["Corps", "Position", "Maison entière", "Mouvement"], positionRows)}<div class="angles">${[["Ascendant", socle.ascendant], ["Milieu du Ciel", socle.midheaven]].map(([label, angle]) => `<p><strong>${label}</strong>${escape(angle?.degreeLabel ?? "non établi avec les données fournies")}</p>`).join("")}</div></div></div>${notes.length ? `<div class="callout precision"><strong>Précision et limites du calcul</strong><ul>${notes.map((note) => `<li>${escape(note)}</li>`).join("")}</ul></div>` : ""}</section>
<section aria-labelledby="aspects-title"><span class="tag">Géométrie et convention d’orbes</span><h2 id="aspects-title">Les aspects retenus</h2><p>L’orbe réel est l’écart entre l’angle mesuré et l’angle exact de l’aspect. L’orbe maximal est le seuil choisi par Lastro pour le retenir : il s’agit d’une convention astrologique documentée.</p>${aspectRows.length ? table(["Couple", "Aspect", "Orbe réel", "Orbe maximal"], aspectRows) : `<p>Aucun aspect retenu n’est fourni pour cette fenêtre de naissance.</p>`}${orbRows.length ? `<h3>Seuils de la convention ${escape(socle.aspectConvention?.ruleVersionId ?? frame.aspectRuleVersion)}</h3>${table(["Aspect", "Orbe standard", "Avec Soleil ou Lune"], orbRows)}` : ""}<div class="summary-grid"><div class="card"><h3>Les quatre éléments</h3>${measures(distribution.byElement, {fire:"Feu",earth:"Terre",air:"Air",water:"Eau"})}</div><div class="card"><h3>Les trois modalités</h3>${measures(distribution.byModality, {cardinal:"Cardinal",fixed:"Fixe",mutable:"Mutable"})}</div></div><p class="note">Décompte sans pondération des sept corps traditionnels : ${escape(distribution.classified)} signe(s) établi(s), ${escape(distribution.notEstablished.length)} non établi(s). Ce décompte ne mesure pas la force d’une planète ni une qualité personnelle.</p></section>
<section aria-labelledby="symbolic-title"><span class="tag">Vocabulaire symbolique · catalogue uniquement</span><h2 id="symbolic-title">Des pistes documentées pour la lecture</h2><p>Chaque entrée renvoie à un placement calculé et à sa règle Lastro. Ces mots sont une matière de rédaction ; ils ne constituent pas un portrait psychologique, une prédiction ni une nouvelle interaction entre configurations.</p><div class="catalogue">${catalogue}</div></section>
${annualSection(report.chineseAnnual)}
<section aria-labelledby="limits-title"><span class="tag">Périmètre de cet aperçu</span><h2 id="limits-title">Ce qui reste à préparer</h2><div class="unavailable">${unavailable || `<p>Aucun autre module n’est déclaré dans cet aperçu.</p>`}</div><div class="callout"><strong>Traditions présentées séparément</strong><p>Aucune synthèse croisée n’est licenciée ici. Une ressemblance entre des vocabulaires occidentaux et chinois n’apporte pas une preuve indépendante sur une personne. Les positions sidérales, nakshatras, dashas et piliers BaZi ne sont jamais déduits du texte d’exemple.</p></div></section>
<details open><summary>Références du calcul et de la préparation</summary><div class="method-details">${table(["Repère", "Valeur"], metadata)}<h3>Traçabilité des repères symboliques</h3>${table(["Placement", "Règle", "Preuve"], entries.map((entry) => [proofLabel(byEvidence.get(entry.evidenceId), byBody), entry.ruleId, entry.evidenceId]))}<p>Schéma ${escape(report.schema)} · préparation ${escape(report.generatedAt ?? "non datée")}${report.chineseAnnual?.frame?.runtimeIcu ? ` · calendrier calculé avec ICU ${escape(report.chineseAnnual.frame.runtimeIcu)}` : ""}.</p></div></details>
<footer>Complément autonome en aperçu local. Le parcours Lastro existant demeure séparé. Les calculs décrivent des positions et des conventions ; les significations astrologiques relèvent d’une lecture symbolique. Aucun diagnostic, événement biographique ou résultat futur n’est établi par cet aperçu.</footer>
</main></body></html>`;
}
