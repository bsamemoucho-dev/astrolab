// Chapitre « Regards croisés » du dossier payant (convention lastro-regards-croises@1.0.0).
//
// Trois traditions lisent le même instant de naissance : l'astrologie occidentale
// tropicale (le reste du dossier), le Jyotish sidéral (Lahiri) et le BaZi chinois.
// Chaque tradition garde sa voix, ses calculs et ses limites. Le chapitre est
// entièrement CALCULÉ et rédigé par des gabarits fixes : aucun modèle de langage,
// aucune règle d'interprétation nouvelle, aucune synthèse qui ferait d'une
// ressemblance une preuve.
//
// Ce qui est montré :
// - le décalage entre les deux zodiaques, chiffré à la naissance (ayanamsha) ;
// - les mêmes repères dans les deux zodiaques, côte à côte ;
// - la Lune védique, son nakshatra et la période Vimshottari en cours, avec le
//   seul vocabulaire documenté du complément (Rao) ;
// - les quatre piliers du BaZi et l'élément du tronc du jour (table des cinq
//   phases, appliquée aux dix troncs célestes) ;
// - des « échos » : uniquement quand un même mot apparaît dans deux traditions,
//   présentés comme une coïncidence de vocabulaire et jamais comme une preuve.
//
// Toute erreur de calcul retire le chapitre au lieu de bloquer le dossier : il
// complète la lecture, il ne la conditionne pas.

import { buildComplementPreview } from "../../addons/crossed-reading/index.mjs";
import { buildSymbolicReading } from "../../addons/crossed-reading/symbolicReading.mjs";
import { classifySiderealLongitude, lahiriAyanamsha, LONGITUDE_TOLERANCE_DEGREES } from "../../addons/crossed-reading/jyotish.mjs";
import { ELEMENT_ORDER, signDistribution } from "./chart.mjs";

export const CROSSED_TRADITIONS_VERSION = "lastro-regards-croises@1.0.0";
export const CROSSED_TRADITIONS_SECTION_ID = "regards-croises";

const BIRTH_KEYS = [
  "birthDate", "timePrecision", "timeValue", "timeStart", "timeEnd", "timeMarginMinutes",
  "latitude", "longitude", "timeZone", "placeName", "country", "coordinateSource", "coordinateConfidence"
];

const SIGN_FR = Object.freeze({
  Aries: "Bélier", Taurus: "Taureau", Gemini: "Gémeaux", Cancer: "Cancer", Leo: "Lion", Virgo: "Vierge",
  Libra: "Balance", Scorpio: "Scorpion", Sagittarius: "Sagittaire", Capricorn: "Capricorne",
  Aquarius: "Verseau", Pisces: "Poissons"
});

const BODY_FR = Object.freeze({ Sun: "Soleil", Moon: "Lune", Mercury: "Mercure", Venus: "Vénus", Mars: "Mars", Jupiter: "Jupiter", Saturn: "Saturne" });
const LORD_FR = Object.freeze({ ...BODY_FR, Rahu: "Rahu", Ketu: "Ketu" });

// Les cinq phases (wu xing) des dix troncs célestes, par paires yang/yin.
const STEM_PHASE = Object.freeze({
  Jia: "Bois", Yi: "Bois", Bing: "Feu", Ding: "Feu", Wu: "Terre",
  Ji: "Terre", Geng: "Métal", Xin: "Métal", Ren: "Eau", Gui: "Eau"
});
const YANG_STEMS = new Set(["Jia", "Bing", "Wu", "Geng", "Ren"]);
const WESTERN_ELEMENT_FR = Object.freeze({ fire: "Feu", earth: "Terre", air: "Air", water: "Eau" });
const PILLAR_FR = Object.freeze({ year: "Année", month: "Mois", day: "Jour", hour: "Heure" });

function signLabel(sign) {
  return SIGN_FR[sign] ?? null;
}

// Heure non ponctuelle : le complément ne certifie aucun signe sidéral. Comme
// pour le tropical, un signe identique aux deux bornes de la fenêtre (tolérance
// numérique comprise) est donné comme « probable », jamais comme exact ; des
// signes différents aux deux bornes restent « non décidable ».
function siderealLabel(point) {
  if (!point) return null;
  if (point.status === "calculated") return signLabel(point.sign);
  const ends = point.endpointLongitudes;
  if (!ends || !Number.isFinite(ends.start) || !Number.isFinite(ends.end)) return null;
  const signs = new Set();
  for (const longitude of [ends.start, ends.end]) {
    const classification = classifySiderealLongitude(normalizeDegrees(longitude), LONGITUDE_TOLERANCE_DEGREES);
    for (const candidate of classification.candidates) signs.add(candidate.sign);
  }
  const labels = [...signs].map(signLabel).filter(Boolean);
  if (labels.length === 1) return `${labels[0]} (probable)`;
  return labels.length > 1 ? `${labels.join(" ou ")} (non décidable)` : null;
}

function tropicalBodyLabel(body) {
  if (!body || !signLabel(body.sign)) return null;
  return body.signStableWithinMargin === false ? `${signLabel(body.sign)} (non décidable)` : signLabel(body.sign);
}

function tropicalAscendantLabel(socle) {
  const asc = socle?.ascendant;
  if (!asc || !signLabel(asc.sign)) return null;
  if (asc.decidableWithinMargin === false || asc.signStableWithinMargin === false) return null;
  return asc.marginMinutes ? `${signLabel(asc.sign)} (probable)` : signLabel(asc.sign);
}

function year(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function formatDegrees(value) {
  const whole = Math.floor(value);
  const minutes = Math.round((value - whole) * 60);
  return minutes === 60 ? `${whole + 1}°00′` : `${whole}°${String(minutes).padStart(2, "0")}′`;
}

function birthFromNatalInput(natalInput) {
  const birth = {};
  for (const key of BIRTH_KEYS) {
    const value = natalInput?.[key];
    if (value === undefined || value === null || value === "") continue;
    birth[key] = value;
  }
  return birth;
}

// Le texte documenté du complément parle « du complément » : dans le dossier, il
// parle de ce dossier.
function adaptComplementWording(text) {
  return String(text ?? "")
    .replaceAll("de préparation du complément", "de préparation de ce dossier")
    .replaceAll("de ce complément", "de ce chapitre")
    .replaceAll("ce complément", "ce chapitre");
}

function readingParagraphs(reading, sectionId) {
  const section = reading.sections.find((entry) => entry.id === sectionId);
  return section ? section.paragraphs.map((paragraph) => adaptComplementWording(paragraph.text)) : [];
}

function dominantWesternElements(socle) {
  const distribution = signDistribution(socle?.bodies ?? []);
  if (distribution.classified === 0) return [];
  const max = Math.max(...ELEMENT_ORDER.map((key) => distribution.byElement[key]));
  return ELEMENT_ORDER.filter((key) => distribution.byElement[key] === max).map((key) => WESTERN_ELEMENT_FR[key]);
}

// Construit les faits du chapitre. Exporté pour les tests.
export function crossedTraditionsFacts({ natalInput, socle, generatedAt }) {
  const report = buildComplementPreview({ birth: birthFromNatalInput(natalInput), generatedAt });
  const reading = buildSymbolicReading(report);
  const jyotish = report.jyotish?.status === "unavailable" ? null : report.jyotish;
  const siderealBody = (name) => (jyotish?.positions ?? []).find((point) => point.body === name) ?? null;
  const tropicalBody = (name) => (socle?.bodies ?? []).find((body) => body.body === name) ?? null;

  const utcStart = jyotish?.frame?.utcRange?.start ?? null;
  const ayanamsha = utcStart ? lahiriAyanamsha(utcStart) : null;

  const comparisons = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].map((name) => ({
    label: BODY_FR[name],
    tropical: tropicalBodyLabel(tropicalBody(name)),
    sidereal: siderealLabel(siderealBody(name))
  }));
  const siderealAsc = jyotish?.angles?.ascendant ?? null;
  comparisons.push({
    label: "Ascendant",
    tropical: tropicalAscendantLabel(socle),
    sidereal: siderealAsc?.status === "calculated" ? signLabel(siderealAsc.sign) : null
  });

  const bazi = report.bazi?.status === "unavailable" ? null : report.bazi;
  const pillars = ["year", "month", "day", "hour"].map((role) => {
    const pillar = bazi?.pillars?.[role];
    return pillar?.status === "calculated"
      ? { role, label: PILLAR_FR[role], ganZhi: pillar.ganZhi, hanzi: pillar.hanzi ?? null, phase: STEM_PHASE[pillar.stem] ?? null }
      : { role, label: PILLAR_FR[role], ganZhi: null, hanzi: null, phase: null };
  });
  const dayPillar = bazi?.pillars?.day?.status === "calculated" ? bazi.pillars.day : null;
  const dayMaster = dayPillar && STEM_PHASE[dayPillar.stem]
    ? { stem: dayPillar.stem, phase: STEM_PHASE[dayPillar.stem], polarity: YANG_STEMS.has(dayPillar.stem) ? "yang" : "yin" }
    : null;

  const current = report.dashas?.current?.status === "calculated" ? report.dashas.current : null;
  const dasha = current
    ? {
        mahadasha: LORD_FR[current.mahadasha?.lord] ?? null,
        antardasha: LORD_FR[current.antardasha?.lord] ?? null,
        since: year(current.mahadasha?.startUtc)
      }
    : null;

  const westernDominant = dominantWesternElements(socle);
  return {
    version: CROSSED_TRADITIONS_VERSION,
    ayanamsha,
    comparisons,
    pillars,
    dayMaster,
    dasha,
    westernDominant,
    lunarParagraphs: [...readingParagraphs(reading, "sidereal-moon"), ...readingParagraphs(reading, "lunar-sector")],
    periodParagraphs: readingParagraphs(reading, "periods-reading"),
    baziParagraphs: readingParagraphs(reading, "four-pillars-reading"),
    sources: reading.sources.map((source) => ({ title: source.title, locator: source.locator }))
  };
}

function echoes(facts) {
  const lines = [];
  const bare = (label) => String(label).replace(/ \((probable|non décidable)\)$/, "");
  const decided = facts.comparisons.filter((row) => row.tropical && row.sidereal && !/non décidable/.test(`${row.tropical}${row.sidereal}`));
  const same = decided.filter((row) => bare(row.tropical) === bare(row.sidereal)).map((row) => row.label);
  const moved = decided.filter((row) => bare(row.tropical) !== bare(row.sidereal)).map((row) => row.label);
  if (same.length > 0) {
    lines.push(`- **Même signe dans les deux zodiaques** : ${same.join(", ")}. Ce repère se trouve assez loin dans son signe pour résister au décalage entre les deux calendriers.`);
  }
  if (moved.length > 0) {
    lines.push(`- **Signe différent d'un zodiaque à l'autre** : ${moved.join(", ")}. Ce n'est pas une contradiction : les deux traditions ne font pas commencer le zodiaque au même point du ciel.`);
  }
  if (facts.dayMaster && facts.westernDominant.length > 0) {
    if (facts.westernDominant.includes(facts.dayMaster.phase)) {
      lines.push(`- **Un même mot, deux systèmes** : le tronc de votre jour relève de la phase ${facts.dayMaster.phase} dans le BaZi, et l'élément ${facts.dayMaster.phase} est aussi le plus représenté parmi vos sept planètes occidentales. C'est un écho de vocabulaire : les quatre éléments grecs et les cinq phases chinoises ne décrivent pas la même chose.`);
    } else {
      lines.push(`- **Deux façons de découper le monde** : la phase de votre tronc du jour (${facts.dayMaster.phase}) ne coïncide pas avec l'élément occidental le plus représenté (${facts.westernDominant.join(", ")}). Les quatre éléments grecs et les cinq phases chinoises ne se traduisent pas l'un dans l'autre ; leur désaccord n'annule ni l'une ni l'autre lecture.`);
    }
  }
  return lines;
}

export function renderCrossedTraditionsText(facts) {
  const parts = [];
  parts.push(
    "Votre naissance a eu lieu sous un seul ciel, et plusieurs traditions ont appris à le lire. Ce chapitre ouvre deux autres fenêtres sur le même instant : le Jyotish, l'astrologie de l'Inde, et le BaZi, les « quatre piliers » de la tradition chinoise. Chacune garde ici ses propres calculs et sa propre voix."
  );

  parts.push("### Deux zodiaques pour un même ciel");
  if (facts.ayanamsha !== null) {
    parts.push(
      `L'astrologie occidentale fait commencer le zodiaque à l'équinoxe de printemps ; le Jyotish l'accroche aux étoiles fixes. À votre naissance, l'écart entre les deux (l'ayanamsha de Lahiri) valait ${formatDegrees(facts.ayanamsha)}. Une même planète peut donc changer de signe d'une tradition à l'autre.`
    );
  }
  const rows = facts.comparisons.filter((row) => row.tropical || row.sidereal);
  if (rows.length > 0) {
    parts.push(
      ["| Repère | Occidental (tropical) | Védique (sidéral) |", "|---|---|---|", ...rows.map((row) => `| ${row.label} | ${row.tropical ?? "—"} | ${row.sidereal ?? "—"} |`)].join("\n")
    );
  }

  if (facts.lunarParagraphs.length > 0 || facts.periodParagraphs.length > 0) {
    parts.push("### Le regard védique : la Lune d'abord");
    parts.push(...facts.lunarParagraphs);
    if (facts.dasha?.mahadasha && facts.dasha?.antardasha) {
      parts.push(
        `Votre calendrier Vimshottari se trouve dans la grande période (mahadasha) de ${facts.dasha.mahadasha}${facts.dasha.since ? `, ouverte en ${facts.dasha.since}` : ""}, et dans la sous-période (antardasha) de ${facts.dasha.antardasha}. C'est un repère de calendrier : il n'annonce aucun événement.`
      );
    }
    parts.push(...facts.periodParagraphs.filter((text) => !text.startsWith("À la date de préparation")));
  }

  const knownPillars = facts.pillars.filter((pillar) => pillar.ganZhi);
  if (knownPillars.length > 0) {
    parts.push("### Le regard chinois : quatre piliers");
    parts.push(
      ["| Pilier | Caractères | Phase du tronc |", "|---|---|---|", ...facts.pillars.map((pillar) => `| ${pillar.label} | ${pillar.ganZhi ? `${pillar.ganZhi}${pillar.hanzi ? ` (${pillar.hanzi})` : ""}` : "indéterminé"} | ${pillar.phase ?? "—"} |`)].join("\n")
    );
    if (facts.dayMaster) {
      parts.push(
        `Dans le BaZi, le tronc du pilier du jour sert de point de référence à toute la lecture. Le vôtre, ${facts.dayMaster.stem}, appartient à la phase ${facts.dayMaster.phase}, dans sa forme ${facts.dayMaster.polarity}.`
      );
    }
    parts.push(...facts.baziParagraphs);
  }

  const echoLines = echoes(facts);
  if (echoLines.length > 0) {
    parts.push("### Échos entre les traditions");
    parts.push(...echoLines);
    parts.push(
      "Ces échos sont des rencontres de calendrier et de vocabulaire. Ils ne renforcent aucune interprétation : quand deux traditions disent un mot semblable, elles ne le disent pas pour les mêmes raisons."
    );
  }

  if (facts.sources.length > 0) {
    parts.push(
      `*Sources du vocabulaire traditionnel : ${facts.sources.map((source) => `${source.title} (${source.locator})`).join(" ; ")}. Conventions : Lahiri, Vimshottari en années de 365,25 jours, BaZi en heure civile locale avec frontières solaires (Li Chun, Jie) ; ${CROSSED_TRADITIONS_VERSION}.*`
    );
  }
  return parts.join("\n\n");
}

// Section prête pour le rendu, ou null si le chapitre ne peut pas être produit.
export function crossedTraditionsSection({ natalInput, socle, generatedAt, language = "fr", logger = null }) {
  // Le vocabulaire documenté du complément n'existe qu'en français.
  if (language !== "fr") return null;
  try {
    const facts = crossedTraditionsFacts({ natalInput, socle, generatedAt });
    const hasMaterial = facts.comparisons.some((row) => row.sidereal) || facts.pillars.some((pillar) => pillar.ganZhi);
    if (!hasMaterial) return null;
    return {
      id: CROSSED_TRADITIONS_SECTION_ID,
      title: "Regards croisés : l'Inde et la Chine sur votre naissance",
      badgeCode: "calculated",
      badgeLabel: "Calculs documentés",
      kind: "crossed",
      provider: "calculated",
      text: renderCrossedTraditionsText(facts),
      status: "ok",
      validation: { ok: true, issues: [] },
      methodVersion: CROSSED_TRADITIONS_VERSION
    };
  } catch (error) {
    logger?.warn?.("crossed_traditions_unavailable", { code: error?.code ?? null });
    return null;
  }
}
