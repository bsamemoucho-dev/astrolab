// Graphiques du document : la roue du ciel et les répartitions.
//
// Tout est CALCULÉ à partir du socle vérifié — aucune position décorative. La roue
// place chaque corps à sa longitude réelle et dessine l'axe de l'Ascendant ; quand
// l'heure de naissance ne permet pas de trancher, elle trace l'arc d'incertitude au
// lieu d'un axe inventé, et sans instant de référence elle trace les arcs balayés
// par les corps rapides.
//
// La répartition par élément et par modalité suit une convention versionnée
// (`lastro-distribution@1.0.0`) : les sept corps traditionnels, sans pondération.
// Un corps dont le signe n'est pas établi est EXCLU du décompte et compté à part —
// un pourcentage calculé sur des signes inconnus serait un chiffre inventé.

import { docStrings } from "./i18n.mjs";
import { natalChartLabels } from "./chartLabels.mjs";
import { zodiacWheelSvg } from "./natalWheel.mjs";

export { zodiacWheelSvg };

export const LASTRO_DISTRIBUTION_RULE_VERSION = "lastro-distribution@1.0.0";

export const SIGNS = Object.freeze([
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]);

export const SIGN_GLYPHS = Object.freeze(["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"]);

export const ELEMENT_BY_SIGN = Object.freeze({
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water"
});

export const MODALITY_BY_SIGN = Object.freeze({
  Aries: "cardinal", Cancer: "cardinal", Libra: "cardinal", Capricorn: "cardinal",
  Taurus: "fixed", Leo: "fixed", Scorpio: "fixed", Aquarius: "fixed",
  Gemini: "mutable", Virgo: "mutable", Sagittarius: "mutable", Pisces: "mutable"
});

export const ELEMENT_ORDER = Object.freeze(["fire", "earth", "air", "water"]);
export const MODALITY_ORDER = Object.freeze(["cardinal", "fixed", "mutable"]);

export const ELEMENT_COLOURS = Object.freeze({
  fire: "#d98a56",
  earth: "#a68c45",
  air: "#766db6",
  water: "#5f9fc0"
});

// Répartition des sept corps. `notEstablished` sort du décompte : le document dit
// combien de corps sont concernés au lieu de les ranger dans un signe au hasard.
export function signDistribution(bodies = []) {
  const liste = Array.isArray(bodies) ? bodies : [];
  const byElement = Object.fromEntries(ELEMENT_ORDER.map((key) => [key, 0]));
  const byModality = Object.fromEntries(MODALITY_ORDER.map((key) => [key, 0]));
  const notEstablished = [];
  let classified = 0;
  for (const body of liste) {
    const element = ELEMENT_BY_SIGN[body?.sign];
    const modality = MODALITY_BY_SIGN[body?.sign];
    if (!element || !modality) {
      notEstablished.push(body?.body ?? null);
      continue;
    }
    byElement[element] += 1;
    byModality[modality] += 1;
    classified += 1;
  }
  return {
    ruleVersionId: LASTRO_DISTRIBUTION_RULE_VERSION,
    total: liste.length,
    classified,
    notEstablished,
    byElement,
    byModality
  };
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Écart le plus court entre deux longitudes, en degrés (0 à 180).
export function angularGap(first, second) {
  return Math.abs((((first - second) % 360) + 540) % 360 - 180);
}

// Ce que la roue et les répartitions supposent, pour que l'annexe le dise.
export function chartFacts(socle, strings = null) {
  const t = strings ?? docStrings(socle?.language ?? "fr");
  const distribution = signDistribution(socle?.bodies ?? []);
  const orientation =
    socle?.ascendant && socle.ascendant.decidableWithinMargin !== false
      ? t.chartOrientedOnAscendant ?? "Roue orientée sur l'Ascendant."
      : t.chartOrientedOnAries ?? "Roue orientée sur 0° Bélier : l'Ascendant n'est pas décidable.";
  return { distribution, orientation };
}

function share(count, total) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

// Découpe le titre en au plus `maxLignes` lignes, sans perdre un seul mot, en
// minimisant la largeur de la plus longue. Aucune dépendance à la langue : le
// résultat est calculé sur le titre réellement fourni.
export function centreLines(title, maxLignes = 3, largeurMax = 14) {
  const mots = String(title ?? "").trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) {
    return [];
  }
  let repli = null;
  for (let lignes = 1; lignes <= Math.min(maxLignes, mots.length); lignes += 1) {
    let meilleur = null;
    const explorer = (depart, restantes, accumule) => {
      if (restantes === 1) {
        const groupe = [...accumule, mots.slice(depart).join(" ")];
        const largeur = Math.max(...groupe.map((ligne) => ligne.length));
        if (!meilleur || largeur < meilleur.largeur) {
          meilleur = { groupe, largeur };
        }
        return;
      }
      for (let fin = depart + 1; fin <= mots.length - restantes + 1; fin += 1) {
        explorer(fin, restantes - 1, [...accumule, mots.slice(depart, fin).join(" ")]);
      }
    };
    explorer(0, lignes, []);
    if (!meilleur) {
      continue;
    }
    if (meilleur.largeur <= largeurMax) {
      return meilleur.groupe.map((ligne) => ligne.toUpperCase());
    }
    if (!repli || meilleur.largeur < repli.largeur) {
      repli = meilleur;
    }
  }
  return (repli?.groupe ?? [mots.join(" ")]).map((ligne) => ligne.toUpperCase());
}

function barRows(counts, order, labelOf, colourOf, total) {
  return order
    .map((key) => {
      const count = counts[key] ?? 0;
      const pourcentage = share(count, total);
      return (
        `<div class="bar-row"><span>${escapeXml(labelOf(key))}</span>` +
        `<div class="bar-track" aria-hidden="true"><div class="bar" style="width:${pourcentage}%;background:${colourOf(key)}"></div></div>` +
        `<b>${count}</b></div>`
      );
    })
    .join("");
}

const MODALITY_COLOURS = Object.freeze({ cardinal: "#5d4a86", fixed: "#c89c4a", mutable: "#8d78a8" });

const TRADITIONAL_BODIES = Object.freeze(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);

function birthLabel(socle, t, labels) {
  const birth = socle?.birth ?? {};
  const identity = new Map((socle?.facts ?? []).map((fact) => [fact.id, fact.value]));
  const rawDate = birth.date ?? identity.get("identity.date");
  let date = rawDate ?? "—";
  // A civil birth date is not a UTC instant: formatting at UTC prevents a
  // negative local offset from moving the displayed date to the previous day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate))) {
    const instant = new Date(`${rawDate}T12:00:00Z`);
    if (Number.isFinite(instant.getTime())) {
      date = new Intl.DateTimeFormat(labels.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(instant);
    }
  }
  let time = labels.unknownTime;
  if (birth.timePrecision === "exact" && birth.timeValue) time = birth.timeValue;
  else if (birth.timePrecision === "approximate" && birth.timeValue) time = `${birth.timeValue} (${labels.approximate}${socle?.timeLanguageCap?.marginMinutes ? ` ±${socle.timeLanguageCap.marginMinutes} ${labels.minute}` : ""})`;
  else if (birth.timePrecision === "interval" && birth.timeStart && birth.timeEnd) time = `${birth.timeStart} – ${birth.timeEnd}`;
  // Older socles may lack birth metadata. Reuse an existing formatted fact,
  // never invent a time or a place from chart geometry.
  else if (!birth.timePrecision && identity.get("identity.time")) time = identity.get("identity.time");
  const place = identity.get("identity.place") ?? birth.placeName ?? "—";
  const zone = birth.timeZone ?? identity.get("identity.timezone");
  return `<p class="natal-birth"><span>${escapeXml(date)} · ${escapeXml(time)}</span><br><span>${escapeXml(place)}</span>${zone ? `<br><span class="natal-timezone">${escapeXml(zone)}</span>` : ""}</p>`;
}

function planetaryPositions(socle, t, labels) {
  const byBody = new Map((socle?.bodies ?? []).map((body) => [body.body, body]));
  const canShowHouses = socle?.housesAvailable !== false && socle?.housesDecidableWithinMargin !== false;
  const rows = TRADITIONAL_BODIES.map((key) => {
    const body = byBody.get(key);
    const name = body?.label ?? t.planets?.[key] ?? key;
    const degree = body?.degreeLabel ?? t.values?.unknown ?? "—";
    const house = canShowHouses && Number.isInteger(body?.house) ? `<span class="natal-house">${escapeXml(t.labels?.house ?? "")} ${body.house}</span>` : "";
    const retrograde = body?.retrograde ? ` <span class="natal-retrograde" title="${escapeXml(t.labels?.retro ?? "R")}">R</span>` : "";
    return `<div class="natal-position-row" data-body="${key}"><dt>${escapeXml(name)}</dt><dd>${escapeXml(degree)}${retrograde}${house}</dd></div>`;
  });
  const note = socle?.timeLanguageCap?.marginMinutes ? `<p class="natal-position-note">${escapeXml(labels.indicativePositions)}</p>` : "";
  return `<dl class="natal-position-list" aria-label="${escapeXml(labels.positions)}">${rows.join("")}</dl>${note}`;
}

// The chart panel only formats the verified socle. Geometry comes from the
// native SVG renderer; the model never supplies a position or an aspect.
export function chartBlockHtml(socle, strings = null, options = {}) {
  const t = strings ?? docStrings(socle?.language ?? "fr");
  const labels = natalChartLabels(t.lang ?? socle?.language);
  const { distribution, orientation } = chartFacts(socle, t);
  const total = distribution.classified;
  const uncertain = Boolean(
    (socle?.birth?.timePrecision && socle.birth.timePrecision !== "exact") ||
    (socle?.bodies ?? []).some((body) => body.longitudeRange) ||
    [socle?.ascendant, socle?.midheaven].some((angle) => angle?.decidableWithinMargin === false)
  );
  const libelle = (cle) =>
    ({
      fire: t.elementFire, earth: t.elementEarth, air: t.elementAir, water: t.elementWater,
      cardinal: t.modalityCardinal, fixed: t.modalityFixed, mutable: t.modalityMutable
    })[cle] ?? cle;

  const notes = [];
  if (distribution.notEstablished.length > 0 && t.chartBodiesNotEstablished) {
    notes.push(String(t.chartBodiesNotEstablished).replace("{n}", String(distribution.notEstablished.length)));
  }
  const marge = socle?.timeLanguageCap?.marginMinutes;
  if (socle?.ascendant && socle.ascendant.decidableWithinMargin === false && marge && t.chartAscendantUndecided) {
    notes.push(String(t.chartAscendantUndecided).replace("{n}", String(marge)));
  }

  return [
    `<div class="natal-panel">`,
    `  <div class="chart-wheel">${zodiacWheelSvg(socle, t, options)}</div>`,
    `  <div class="natal-positions">`,
    `    <div class="kicker">${escapeXml(t.chartHouses ?? "")}</div>`,
    `    <h2>${escapeXml(labels.title)}</h2>`,
    birthLabel(socle, t, labels),
    planetaryPositions(socle, t, labels),
    `  </div>`,
    `</div>`,
    `<div class="natal-legend" aria-label="${escapeXml(labels.legend)}">`,
    `  <h3>${escapeXml(labels.legend)}</h3>`,
    `  <div class="natal-legend-aspects">`,
    ...[["harmony", labels.harmony], ["tension", labels.tension], ["conjunction", labels.conjunction]].map(([kind, label]) => `<span class="legend-item"><i class="legend-line ${kind}" aria-hidden="true"></i>${escapeXml(label)}</span>`),
    `  </div>`,
    `  <p>${escapeXml(labels.aspects)}</p>`,
    `  <p>${escapeXml(labels.points)} ${escapeXml(labels.angles)}</p>`,
    ...(uncertain ? [`  <p class="natal-uncertainty-legend">${escapeXml(labels.uncertainty)}</p>`] : []),
    `  <p>${escapeXml(orientation)} ${escapeXml(labels.limits)}</p>`,
    `</div>`,
    `<div class="chart-distributions">`,
    `  <div class="card"><h3>${escapeXml(t.chartElements ?? "")}</h3>`,
    barRows(distribution.byElement, ELEMENT_ORDER, libelle, (cle) => ELEMENT_COLOURS[cle], total),
    `  </div>`,
    `  <div class="card"><h3>${escapeXml(t.chartModalities ?? "")}</h3>`,
    barRows(distribution.byModality, MODALITY_ORDER, libelle, (cle) => MODALITY_COLOURS[cle], total),
    `  </div>`,
    `</div>`,
    `<p class="footer-note chart-distribution-note">${escapeXml(t.chartDistributionIntro ?? "")}${notes.length ? ` ${escapeXml(notes.join(" "))}` : ""}</p>`
  ].join("\n");
}

// Équivalent Markdown : les mêmes chiffres, sans graphique (l'export .md ne rend
// pas le SVG).
export function chartMarkdown(socle, strings = null) {
  const t = strings ?? docStrings(socle?.language ?? "fr");
  const { distribution, orientation } = chartFacts(socle, t);
  const libelle = (cle) =>
    ({
      fire: t.elementFire,
      earth: t.elementEarth,
      air: t.elementAir,
      water: t.elementWater,
      cardinal: t.modalityCardinal,
      fixed: t.modalityFixed,
      mutable: t.modalityMutable
    })[cle] ?? cle;
  const lignes = [
    t.chartIntro ?? "",
    orientation,
    "",
    `- ${ELEMENT_ORDER.map((cle) => `${libelle(cle)} ${distribution.byElement[cle]}`).join(" · ")}`,
    `- ${MODALITY_ORDER.map((cle) => `${libelle(cle)} ${distribution.byModality[cle]}`).join(" · ")}`,
    "",
    t.chartDistributionIntro ?? ""
  ];
  if (distribution.notEstablished.length > 0 && t.chartBodiesNotEstablished) {
    lignes.push(String(t.chartBodiesNotEstablished).replace("{n}", String(distribution.notEstablished.length)));
  }
  return lignes.filter((ligne) => ligne !== undefined).join("\n");
}

// Section du document : la carte du ciel se place après la couverture, avant le
// texte, et commence sur sa propre page.
export function chartSection(socle, strings = null, options = {}) {
  const t = strings ?? docStrings(socle?.language ?? "fr");
  return {
    id: "carte-du-ciel",
    kind: "chart",
    title: t.chartTitle ?? "Votre carte du ciel",
    badgeCode: "calculated",
    badgeLabel: t.badgeCalculated ?? "",
    status: "ok",
    provider: "calculated",
    text: chartMarkdown(socle, t),
    html: chartBlockHtml(socle, t, options),
    validation: { ok: true, issues: [] }
  };
}
