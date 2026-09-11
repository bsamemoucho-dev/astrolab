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

const BODY_GLYPHS = Object.freeze({
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄"
});

const PLACEMENT_MIN_DEGREES = 7;

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

function round(value) {
  return Math.round(value * 100) / 100;
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

// Angle à l'écran (degrés, sens trigonométrique) pour une longitude écliptique.
// - Ascendant décidable : il est placé à gauche (180°) et le zodiaque tourne dans
//   le sens inverse des aiguilles, comme sur une carte classique.
// - Sinon : 0° Bélier en haut, faute de pouvoir orienter la roue sur l'axe.
function angleFor(longitude, anchor) {
  return anchor === null || anchor === undefined ? 90 + longitude : 180 + (longitude - anchor);
}

function point(cx, cy, radius, angleDegrees) {
  const radians = (angleDegrees * Math.PI) / 180;
  return { x: round(cx + radius * Math.cos(radians)), y: round(cy - radius * Math.sin(radians)) };
}

// Secteur annulaire entre deux longitudes, du rayon intérieur au rayon extérieur.
function annularSector(cx, cy, rInner, rOuter, fromLongitude, toLongitude, anchor, fill, opacity = 1) {
  const start = angleFor(fromLongitude, anchor);
  const end = angleFor(toLongitude, anchor);
  const sweep = end - start;
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  const outerSweep = sweep >= 0 ? 0 : 1;
  const innerSweep = sweep >= 0 ? 1 : 0;
  const outerStart = point(cx, cy, rOuter, start);
  const outerEnd = point(cx, cy, rOuter, end);
  const innerEnd = point(cx, cy, rInner, end);
  const innerStart = point(cx, cy, rInner, start);
  // Rayons arrondis : les rayons relatifs produisent sinon des flottants du type
  // 150.39999999999998 dans chaque tracé.
  const rayonExterieur = round(rOuter);
  const rayonInterieur = round(rInner);
  return (
    `<path d="M ${outerStart.x} ${outerStart.y} A ${rayonExterieur} ${rayonExterieur} 0 ${large} ${outerSweep} ${outerEnd.x} ${outerEnd.y} ` +
    `L ${innerEnd.x} ${innerEnd.y} A ${rayonInterieur} ${rayonInterieur} 0 ${large} ${innerSweep} ${innerStart.x} ${innerStart.y} Z" ` +
    `fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}/>`
  );
}

// La roue : couronne zodiacale colorée par élément, glyphes des signes, maisons
// entières, positions calculées, axes, et l'incertitude rendue visible.
export function zodiacWheelSvg(socle, strings = null, options = {}) {
  const t = strings ?? docStrings(socle?.language ?? "fr");
  const size = options.size ?? 320;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.47;
  const rSignIn = size * 0.4;
  const rPlanet = size * 0.32;
  const rPlanetAlt = size * 0.255;
  const rHouse = size * 0.205;
  const rCentre = size * 0.15;

  const ascendant = socle?.ascendant ?? null;
  const ascendantDecidable = Boolean(ascendant) && ascendant.decidableWithinMargin !== false;
  const housesDecidable = socle?.housesDecidableWithinMargin !== false;
  const anchor = ascendantDecidable ? ascendant.longitude : null;

  const parts = [
    `<svg viewBox="0 0 ${size} ${size}" role="img" class="wheel" xmlns="http://www.w3.org/2000/svg">`,
    `<title>${escapeXml(t.chartTitle ?? "Votre carte du ciel")}</title>`
  ];

  // Couronne : un secteur par signe, coloré par son élément (ordre du zodiaque).
  SIGNS.forEach((sign, index) => {
    parts.push(
      annularSector(cx, cy, rSignIn, rOuter, index * 30, index * 30 + 30, anchor, ELEMENT_COLOURS[ELEMENT_BY_SIGN[sign]], 0.16)
    );
  });
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${round(rOuter)}" fill="none" stroke="#e0d6c8"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${round(rSignIn)}" fill="none" stroke="#e0d6c8"/>`);
  SIGNS.forEach((sign, index) => {
    const position = point(cx, cy, (rOuter + rSignIn) / 2, angleFor(index * 30 + 15, anchor));
    parts.push(
      `<text x="${position.x}" y="${position.y + 4.5}" text-anchor="middle" font-size="14" fill="#8a7f8e">${SIGN_GLYPHS[index]}</text>`
    );
  });

  // Maisons entières : un numéro par secteur, seulement si elles sont décidables.
  const ascendantSignIndex = ascendant ? SIGNS.indexOf(ascendant.sign) : -1;
  if (housesDecidable && ascendantSignIndex >= 0) {
    for (let house = 0; house < 12; house += 1) {
      const longitude = ((ascendantSignIndex + house) % 12) * 30 + 15;
      const position = point(cx, cy, rHouse, angleFor(longitude, anchor));
      parts.push(
        `<text x="${position.x}" y="${position.y + 3.5}" text-anchor="middle" font-size="10" fill="#9a8f9d">${house + 1}</text>`
      );
    }
  }

  // Axe de l'Ascendant, ou zone balayée quand il n'est pas décidable.
  if (Number.isFinite(ascendant?.longitude)) {
    if (ascendantDecidable) {
      const tip = point(cx, cy, rOuter, angleFor(ascendant.longitude, anchor));
      parts.push(
        `<line x1="${cx}" y1="${cy}" x2="${tip.x}" y2="${tip.y}" stroke="#5a447f" stroke-width="2.2"/>`,
        `<text x="${tip.x}" y="${tip.y - 6}" text-anchor="middle" font-size="10" font-weight="700" fill="#5a447f">AC</text>`
      );
    } else if (Number.isFinite(ascendant.longitudeAtWindowStart) && Number.isFinite(ascendant.longitudeAtWindowEnd)) {
      parts.push(
        annularSector(cx, cy, rCentre, rOuter, ascendant.longitudeAtWindowStart, ascendant.longitudeAtWindowEnd, anchor, "#5a447f", 0.18)
      );
      const milieu = (ascendant.longitudeAtWindowStart + ascendant.longitudeAtWindowEnd) / 2;
      const label = point(cx, cy, rOuter - 11, angleFor(milieu, anchor));
      parts.push(
        `<text x="${label.x}" y="${label.y}" text-anchor="middle" font-size="9" font-weight="700" fill="#5a447f">AC ?</text>`
      );
    }
  }
  if (Number.isFinite(socle?.midheaven?.longitude)) {
    const tip = point(cx, cy, rOuter, angleFor(socle.midheaven.longitude, anchor));
    parts.push(
      `<line x1="${cx}" y1="${cy}" x2="${tip.x}" y2="${tip.y}" stroke="#8b6aae" stroke-width="1.4" stroke-dasharray="4 3"/>`,
      `<text x="${tip.x}" y="${tip.y - 6}" text-anchor="middle" font-size="9" fill="#8b6aae">MC</text>`
    );
  }

  // Corps : un jeton au degré calculé, décalé sur un second rayon en cas de
  // proximité, ou un arc quand la position balaie plusieurs signes (heure inconnue).
  const placables = (socle?.bodies ?? []).filter(
    (body) =>
      Number.isFinite(body.longitude) ||
      (Number.isFinite(body.longitudeRange?.start) && Number.isFinite(body.longitudeRange?.end))
  );
  const milieuDe = (body) =>
    Number.isFinite(body.longitude) ? body.longitude : (body.longitudeRange.start + body.longitudeRange.end) / 2;
  const placed = [];
  for (const body of [...placables].sort((first, second) => milieuDe(first) - milieuDe(second))) {
    const milieu = milieuDe(body);
    const voisin = placed.find((entry) => angularGap(entry.longitude, milieu) < PLACEMENT_MIN_DEGREES);
    const rayon = voisin ? (voisin.rayon === rPlanet ? rPlanetAlt : rPlanet) : rPlanet;
    placed.push({ longitude: milieu, rayon });
    const position = point(cx, cy, rayon, angleFor(milieu, anchor));
    if (Number.isFinite(body.longitude)) {
      parts.push(
        `<circle cx="${position.x}" cy="${position.y}" r="11.5" fill="#ffffff" stroke="#d6cbd9"/>`,
        `<text x="${position.x}" y="${position.y + 4.5}" text-anchor="middle" font-size="13" fill="#292534">${BODY_GLYPHS[body.body] ?? "•"}</text>`
      );
      if (body.retrograde) {
        parts.push(
          `<text x="${position.x + 10}" y="${position.y + 10}" text-anchor="middle" font-size="8" fill="#8a7f8e">℞</text>`
        );
      }
    } else {
      parts.push(
        annularSector(cx, cy, rayon - 3, rayon + 3, body.longitudeRange.start, body.longitudeRange.end, anchor, "#8b6aae", 0.5),
        `<text x="${position.x}" y="${position.y - 7}" text-anchor="middle" font-size="12" fill="#5a447f">${BODY_GLYPHS[body.body] ?? "•"}</text>`
      );
    }
  }

  // Centre : le titre, réparti sur au plus trois lignes ÉQUILIBRÉES. Aucun mot n'est
  // coupé : « Votre carte du ciel » réduit à « VOTRE CARTE DU » serait un titre
  // tronqué dans les neuf langues (le français, l'espagnol, l'italien et le portugais
  // font quatre mots ou plus).
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${round(rCentre)}" fill="#ded3e8"/>`);
  centreLines(t.chartTitle ?? "Votre carte du ciel").forEach((ligne, index, lignes) => {
    parts.push(
      `<text x="${cx}" y="${round(cy + (index - (lignes.length - 1) / 2) * 11 + 3)}" text-anchor="middle" ` +
        `font-size="9.5" letter-spacing="0.6" fill="#4b3f57">${escapeXml(ligne)}</text>`
    );
  });

  parts.push("</svg>");
  return parts.join("");
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
        `<div class="bar-track"><div class="bar" style="width:${pourcentage}%;background:${colourOf(key)}"></div></div>` +
        `<b>${count}</b></div>`
      );
    })
    .join("");
}

const MODALITY_COLOURS = Object.freeze({ cardinal: "#5d4a86", fixed: "#c89c4a", mutable: "#8d78a8" });

function donut(counts, order, total) {
  if (total === 0) {
    return "";
  }
  let curseur = 0;
  const segments = order.map((key) => {
    const debut = curseur;
    curseur += share(counts[key] ?? 0, total);
    return `${MODALITY_COLOURS[key]} ${debut}% ${curseur}%`;
  });
  // Le dernier segment est fermé sur 100 % : les arrondis ne doivent pas laisser
  // un trou blanc dans l'anneau.
  segments[segments.length - 1] = segments[segments.length - 1].replace(/%[\d.]+%$/, "% 100%");
  return `<div class="donut" style="background:conic-gradient(${segments.join(", ")})"></div>`;
}

// Bloc « carte du ciel » pour le document HTML : la roue calculée et les deux
// répartitions. Rien n'y est décoratif : tout vient du socle.
export function chartBlockHtml(socle, strings = null, options = {}) {
  const t = strings ?? docStrings(socle?.language ?? "fr");
  const { distribution, orientation } = chartFacts(socle, t);
  const total = distribution.classified;
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

  const notes = [];
  if (distribution.notEstablished.length > 0 && t.chartBodiesNotEstablished) {
    notes.push(String(t.chartBodiesNotEstablished).replace("{n}", String(distribution.notEstablished.length)));
  }
  const marge = socle?.timeLanguageCap?.marginMinutes;
  if (socle?.ascendant && socle.ascendant.decidableWithinMargin === false && marge && t.chartAscendantUndecided) {
    notes.push(String(t.chartAscendantUndecided).replace("{n}", String(marge)));
  }

  return [
    `<div class="header-line"></div>`,
    `<div class="kicker">${escapeXml(t.chartHouses ?? "")}</div>`,
    `<h2>${escapeXml(t.chartTitle ?? "")}</h2>`,
    `<p class="chart-intro">${escapeXml(t.chartIntro ?? "")} ${escapeXml(orientation)}</p>`,
    `<div class="two-col">`,
    `  <div class="card chart-wheel">${zodiacWheelSvg(socle, t, options)}`,
    `    <p class="footer-note">${escapeXml(t.chartLegendAngles ?? "")} · ${escapeXml(t.chartLegendPlanets ?? "")}</p>`,
    `  </div>`,
    `  <div class="chart-wrap">`,
    `    <div class="card"><h3>${escapeXml(t.chartElements ?? "")}</h3>`,
    barRows(distribution.byElement, ELEMENT_ORDER, libelle, (cle) => ELEMENT_COLOURS[cle], total),
    `    </div>`,
    `    <div class="card"><h3>${escapeXml(t.chartModalities ?? "")}</h3>`,
    donut(distribution.byModality, MODALITY_ORDER, total),
    `      <div class="legend">`,
    MODALITY_ORDER.map(
      (cle) =>
        `<span><i class="dot" style="background:${MODALITY_COLOURS[cle]}"></i>${escapeXml(libelle(cle))} · ${distribution.byModality[cle]}</span>`
    ).join(""),
    `      </div>`,
    `    </div>`,
    `  </div>`,
    `</div>`,
    `<p class="footer-note">${escapeXml(t.chartDistributionIntro ?? "")}${notes.length ? ` ${escapeXml(notes.join(" "))}` : ""}</p>`
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
