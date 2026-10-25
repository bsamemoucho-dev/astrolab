// Presentation only: longitudes, houses and retained aspects come from the socle.
// Label positions may move to remain legible; the small markers, aspect endpoints
// and their data-longitude attributes always retain the calculated position.
import { docStrings } from "./i18n.mjs";

const SIGNS = Object.freeze([
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]);
const SIGN_GLYPHS = Object.freeze(["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"]);
const BODIES = Object.freeze(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);
const GLYPHS = Object.freeze({ Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄" });
export const NATAL_ASPECT_STYLES = Object.freeze({
  sextile: Object.freeze({ colour: "#527b9d", dash: null }),
  trine: Object.freeze({ colour: "#527b9d", dash: null }),
  square: Object.freeze({ colour: "#b56d6b", dash: "4 3" }),
  opposition: Object.freeze({ colour: "#b56d6b", dash: "4 3" }),
  conjunction: Object.freeze({ colour: "#81748a", dash: "1 2" })
});
const normal = (value) => { const result = value % 360; return result < 0 ? result + 360 : (result === 0 ? 0 : result); };
const round = (value) => Math.round(value * 1000) / 1000;
const xml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const angleFor = (longitude, anchor) => anchor === null ? 90 + longitude : 180 + longitude - anchor;
const position = (cx, cy, radius, angle) => ({
  x: round(cx + radius * Math.cos(angle * Math.PI / 180)),
  y: round(cy - radius * Math.sin(angle * Math.PI / 180))
});
const signedGap = (from, to) => ((to - from + 540) % 360) - 180;

function rangeFor(body) {
  if (Number.isFinite(body?.longitude)) return null;
  const { start, end } = body?.longitudeRange ?? {};
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end, sweep: signedGap(start, end) };
}

// Isotonic least-squares spacing on a circular ring. Cutting the largest empty
// gap avoids the 0°/360° seam. Only labels are displaced, never astronomical data.
function spacedLabels(entries, minimumDegrees) {
  if (entries.length < 2) return entries.map((entry) => ({ ...entry, labelLongitude: entry.longitude }));
  const sorted = [...entries].sort((a, b) => normal(a.longitude) - normal(b.longitude) || a.body.localeCompare(b.body));
  let cut = 0;
  let largestGap = -1;
  sorted.forEach((entry, index) => {
    const gap = normal(sorted[(index + 1) % sorted.length].longitude - entry.longitude);
    if (gap > largestGap) { largestGap = gap; cut = (index + 1) % sorted.length; }
  });
  const rotated = [...sorted.slice(cut), ...sorted.slice(0, cut)];
  const unwrapped = rotated.map((entry, index) => {
    let value = normal(entry.longitude);
    if (index > 0) while (value < normal(rotated[0].longitude)) value += 360;
    return value;
  });
  const blocks = [];
  unwrapped.forEach((value, index) => {
    blocks.push({ sum: value - index * minimumDegrees, count: 1, from: index, to: index });
    while (blocks.length > 1) {
      const b = blocks.at(-1);
      const a = blocks.at(-2);
      if (a.sum / a.count <= b.sum / b.count) break;
      blocks.splice(-2, 2, { sum: a.sum + b.sum, count: a.count + b.count, from: a.from, to: b.to });
    }
  });
  const assigned = [];
  blocks.forEach((block) => {
    for (let i = block.from; i <= block.to; i += 1) assigned[i] = block.sum / block.count + i * minimumDegrees;
  });
  return rotated.map((entry, index) => ({ ...entry, labelLongitude: normal(assigned[index]) }));
}

export function natalWheelLayout(socle, options = {}) {
  const size = Number.isFinite(options.size) && options.size >= 240 ? options.size : 480;
  const cx = size / 2;
  const cy = size / 2;
  const ascendant = socle?.ascendant;
  const ascendantDecidable = Number.isFinite(ascendant?.longitude) && ascendant.decidableWithinMargin !== false;
  const anchor = ascendantDecidable ? ascendant.longitude : null;
  const radius = { outer: size * .445, signInner: size * .375, signLabel: size * .410, house: size * .270,
    label: size * .315, aspect: size * .245, angleLabel: size * .475 };
  const entries = (Array.isArray(socle?.bodies) ? socle.bodies : [])
    .filter((body) => BODIES.includes(body?.body))
    .flatMap((body) => {
      const range = rangeFor(body);
      if (!Number.isFinite(body.longitude) && !range) return [];
      return [{ body: body.body, source: body, range, longitude: Number.isFinite(body.longitude) ? body.longitude : normal(range.start + range.sweep / 2) }];
    });
  // The glyph discs have radius 12/480 of the canvas. Thirteen degrees gives
  // >34px between centres at the default size, including a retrograde marker.
  const bodies = spacedLabels(entries, 13).map((entry) => ({
    ...entry,
    point: position(cx, cy, radius.aspect, angleFor(entry.longitude, anchor)),
    label: position(cx, cy, radius.label, angleFor(entry.labelLongitude, anchor))
  }));
  const byBody = new Map(bodies.filter((entry) => !entry.range).map((entry) => [entry.body, entry]));
  const suppliedAspects = Array.isArray(socle?.retainedAspects) ? socle.retainedAspects : (socle?.aspectGeometry ?? []);
  const aspects = suppliedAspects.filter((aspect) =>
    NATAL_ASPECT_STYLES[aspect?.type] && aspect.marginStable !== false && byBody.has(aspect.bodyA) && byBody.has(aspect.bodyB)
  ).map((aspect) => ({ source: aspect, start: byBody.get(aspect.bodyA).point, end: byBody.get(aspect.bodyB).point }));
  const angleEntries = [];
  for (const [source, direct, opposite] of [[socle?.ascendant, "AC", "DS"], [socle?.midheaven, "MC", "FC"]]) {
    if (!Number.isFinite(source?.longitude)) continue;
    let longitude = source.longitude;
    if (source.decidableWithinMargin === false) {
      if (!Number.isFinite(source.longitudeAtWindowStart) || !Number.isFinite(source.longitudeAtWindowEnd)) continue;
      longitude = normal(source.longitudeAtWindowStart + signedGap(source.longitudeAtWindowStart, source.longitudeAtWindowEnd) / 2);
    }
    angleEntries.push({ body: direct, longitude }, { body: opposite, longitude: normal(longitude + 180) });
  }
  const angleLabels = spacedLabels(angleEntries, 9).map((entry) => ({
    ...entry, point: position(cx, cy, radius.angleLabel, angleFor(entry.labelLongitude, anchor))
  }));
  return { size, cx, cy, radius, anchor, ascendantDecidable, bodies, aspects, angleLabels };
}

function arc(cx, cy, radius, start, sweep, anchor) {
  const first = position(cx, cy, radius, angleFor(start, anchor));
  const last = position(cx, cy, radius, angleFor(start + sweep, anchor));
  return `M ${first.x} ${first.y} A ${round(radius)} ${round(radius)} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep >= 0 ? 0 : 1} ${last.x} ${last.y}`;
}

export function zodiacWheelSvg(socle, strings = null, options = {}) {
  const t = strings ?? docStrings(socle?.language ?? "fr");
  const layout = natalWheelLayout(socle, options);
  const { size, cx, cy, radius: r, anchor } = layout;
  const u = size / 480;
  const at = (radius, longitude) => position(cx, cy, radius, angleFor(longitude, anchor));
  const parts = [
    `<svg viewBox="0 0 ${size} ${size}" role="img" class="wheel" xmlns="http://www.w3.org/2000/svg" font-family="'DejaVu Sans', 'Arial Unicode MS', 'Apple Symbols', sans-serif">`,
    `<title>${xml(t.chartTitle ?? "Votre carte du ciel")}</title>`,
    `<desc>${xml(t.chartIntro ?? "Positions astronomiques calculées")}</desc>`,
    `<circle cx="${cx}" cy="${cy}" r="${round(r.outer)}" fill="#fcfbf8" stroke="#cec6ba" stroke-width="${round(u)}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${round(r.signInner)}" fill="#ffffff" stroke="#d7d0c7" stroke-width="${round(u)}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${round(r.aspect)}" fill="none" stroke="#e2ddd5" stroke-width="${round(u)}"/>`
  ];
  SIGNS.forEach((sign, index) => {
    const first = at(r.signInner, index * 30);
    const last = at(r.outer, index * 30);
    const label = at(r.signLabel, index * 30 + 15);
    parts.push(`<line class="sign-boundary" data-longitude="${index * 30}" x1="${first.x}" y1="${first.y}" x2="${last.x}" y2="${last.y}" stroke="#cec6ba" stroke-width="${round(u)}"/>`);
    parts.push(`<g class="sign-label" data-sign="${sign}"><text x="${label.x}" y="${round(label.y - 2 * u)}" text-anchor="middle" font-size="${round(18 * u)}" fill="#58515e">${SIGN_GLYPHS[index]}</text><text x="${label.x}" y="${round(label.y + 11 * u)}" text-anchor="middle" font-size="${round(12 * u)}" fill="#655e68">${xml(t.signs?.[sign] ?? sign)}</text></g>`);
    // Degree marks are actual ecliptic longitudes. Longer marks every 5°.
    for (let degree = 1; degree < 30; degree += 1) {
      const longitude = index * 30 + degree;
      const a = at(r.signInner, longitude);
      const b = at(r.signInner + (degree % 5 === 0 ? 4 : 2) * u, longitude);
      parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#c7bfb6" stroke-width="${round(.6 * u)}"/>`);
    }
  });
  const ascSign = SIGNS.indexOf(socle?.ascendant?.sign);
  if (layout.ascendantDecidable && socle?.housesAvailable !== false && socle?.housesDecidableWithinMargin !== false && ascSign >= 0) {
    for (let house = 1; house <= 12; house += 1) {
      const longitude = ((ascSign + house - 1) % 12) * 30;
      const start = at(r.aspect, longitude);
      const end = at(r.signInner, longitude);
      const number = at(r.house, longitude + 15);
      parts.push(`<line class="house-cusp" data-house="${house}" data-longitude="${longitude}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#ded8d0" stroke-width="${round(.8 * u)}"/>`,
        `<circle class="house-number-backdrop" data-house="${house}" cx="${number.x}" cy="${number.y}" r="${round(6.8 * u)}" fill="#ffffff"/><text class="house-number" data-house="${house}" x="${number.x}" y="${round(number.y + 3 * u)}" text-anchor="middle" font-size="${round(10 * u)}" fill="#807681">${house}</text>`);
    }
  }
  for (const { source: aspect, start, end } of layout.aspects) {
    const style = NATAL_ASPECT_STYLES[aspect.type];
    parts.push(`<line class="aspect-line" data-aspect="${xml(aspect.type)}" data-body-a="${xml(aspect.bodyA)}" data-body-b="${xml(aspect.bodyB)}" data-orb="${xml(aspect.exactness)}" data-orb-max="${xml(aspect.orbUsed)}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${style.colour}" stroke-width="${round((aspect.type === "conjunction" ? 1.5 : 1.25) * u)}"${style.dash ? ` stroke-dasharray="${style.dash.split(" ").map((n) => round(Number(n) * u)).join(" ")}"` : ""} stroke-opacity="0.9"><title>${xml(`${t.planets?.[aspect.bodyA] ?? aspect.bodyA} – ${t.planets?.[aspect.bodyB] ?? aspect.bodyB} : ${aspect.aspectLabel ?? aspect.type}`)}</title></line>`);
  }
  const angleLabel = (name, longitude, uncertain = false) => {
    const entry = layout.angleLabels.find((candidate) => candidate.body === name);
    const label = entry?.point ?? at(r.angleLabel, longitude);
    // Closely spaced angles get separate labels, with a short leader pointing
    // back to the actual degree. The angle itself never moves.
    if (entry && Math.abs(signedGap(longitude, entry.labelLongitude)) > .01) {
      const exact = at(r.outer + 5 * u, longitude);
      const d = Math.hypot(label.x - exact.x, label.y - exact.y);
      const to = { x: round(label.x - (label.x - exact.x) / d * 10 * u), y: round(label.y - (label.y - exact.y) / d * 10 * u) };
      parts.push(`<line class="angle-label-leader" data-angle="${name}" x1="${exact.x}" y1="${exact.y}" x2="${to.x}" y2="${to.y}" stroke="#9a899f" stroke-width="${round(.7 * u)}"/>`);
    }
    parts.push(`<text class="angle-label" data-angle="${name}" data-label-longitude="${entry?.labelLongitude ?? longitude}" x="${label.x}" y="${round(label.y + 3 * u)}" text-anchor="middle" font-size="${round(10 * u)}" font-weight="600" fill="#66546d">${name}${uncertain ? " ?" : ""}</text>`);
  };
  const anglePair = (source, direct, opposite) => {
    if (!Number.isFinite(source?.longitude)) return;
    if (source.decidableWithinMargin === false) {
      if (Number.isFinite(source.longitudeAtWindowStart) && Number.isFinite(source.longitudeAtWindowEnd)) {
        const sweep = signedGap(source.longitudeAtWindowStart, source.longitudeAtWindowEnd);
        for (const offset of [0, 180]) {
          const name = offset === 0 ? direct : opposite;
          const mid = normal(source.longitudeAtWindowStart + sweep / 2 + offset);
          parts.push(`<path class="angle-range" data-angle="${name}" data-longitude-start="${source.longitudeAtWindowStart + offset}" data-longitude-end="${source.longitudeAtWindowEnd + offset}" d="${arc(cx, cy, r.outer + 4 * u, source.longitudeAtWindowStart + offset, sweep, anchor)}" fill="none" stroke="#9a899f" stroke-width="${round(5 * u)}" stroke-opacity="0.35"/>`);
          angleLabel(name, mid, true);
        }
      }
      return;
    }
    for (const offset of [0, 180]) {
      const name = offset === 0 ? direct : opposite;
      const longitude = normal(source.longitude + offset);
      const start = at(r.signInner - 6 * u, longitude);
      const end = at(r.outer + 5 * u, longitude);
      parts.push(`<line class="chart-angle" data-angle="${name}" data-longitude="${longitude}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#77627c" stroke-width="${round((direct === "AC" ? 1.7 : 1.1) * u)}"${direct === "MC" ? ` stroke-dasharray="${round(3 * u)} ${round(2 * u)}"` : ""}/>`);
      angleLabel(name, longitude);
    }
  };
  anglePair(socle?.ascendant, "AC", "DS");
  anglePair(socle?.midheaven, "MC", "FC");
  layout.bodies.forEach((entry, index) => {
    const { source: body, point: exact, label, range } = entry;
    const attrs = `data-body="${xml(body.body)}"${range ? ` data-longitude-start="${range.start}" data-longitude-end="${range.end}"` : ` data-longitude="${body.longitude}"`}`;
    const radius = range ? r.aspect + (index % 3) * 5 * u : r.aspect;
    if (range) {
      parts.push(`<path class="planet-range" ${attrs} d="${arc(cx, cy, radius, range.start, range.sweep, anchor)}" fill="none" stroke="#81748a" stroke-width="${round(5 * u)}" stroke-opacity="0.5"/>`);
    } else {
      parts.push(`<circle class="planet-point" ${attrs} cx="${exact.x}" cy="${exact.y}" r="${round(2.5 * u)}" fill="#62526b" stroke="#fff" stroke-width="${round(.65 * u)}"/>`);
    }
    const from = range ? at(radius, entry.longitude) : exact;
    const distance = Math.hypot(label.x - from.x, label.y - from.y);
    const leaderEnd = { x: round(label.x - (label.x - from.x) / distance * 13 * u), y: round(label.y - (label.y - from.y) / distance * 13 * u) };
    parts.push(`<line class="planet-leader" ${attrs} x1="${from.x}" y1="${from.y}" x2="${leaderEnd.x}" y2="${leaderEnd.y}" stroke="#b7aebc" stroke-width="${round(.8 * u)}"/>`,
      `<g class="planet-label" ${attrs} data-label-longitude="${entry.labelLongitude}"><title>${xml(`${body.label ?? t.planets?.[body.body] ?? body.body} — ${body.degreeLabel ?? body.signFr ?? ""}`)}</title><circle cx="${label.x}" cy="${label.y}" r="${round(12 * u)}" fill="#ffffff" stroke="#e4ded5" stroke-width="${round(.75 * u)}"/><text x="${label.x}" y="${round(label.y + 6 * u)}" text-anchor="middle" font-size="${round(20 * u)}" fill="#38313e">${GLYPHS[body.body]}</text>${range ? `<text x="${round(label.x + 9 * u)}" y="${round(label.y - 8 * u)}" font-size="${round(8 * u)}" fill="#77627c">?</text>` : ""}${body.retrograde ? `<circle cx="${round(label.x + 6 * u)}" cy="${round(label.y + 7 * u)}" r="${round(4 * u)}" fill="#ffffff" stroke="#d8cfda" stroke-width="${round(.5 * u)}"/><text class="retrograde-mark" x="${round(label.x + 6 * u)}" y="${round(label.y + 9.3 * u)}" text-anchor="middle" font-size="${round(6 * u)}" font-weight="600" fill="#66546d">R</text>` : ""}</g>`);
  });
  parts.push("</svg>");
  return parts.join("");
}
