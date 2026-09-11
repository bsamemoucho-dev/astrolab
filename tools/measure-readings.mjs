// Mesure du taux de réécriture des détecteurs, sur un tirage de lectures RÉELLES.
//
// Pourquoi cet outil : la calibration n'était mesurée que sur UNE lecture. On sait
// qu'une lecture a coûté 13 appels LLM pour 11 sections, mais pas si c'est le cas
// général, ni ce que ça donne dans les neuf langues. Régler les détecteurs sur une
// intuition, c'est exactement l'erreur que le projet s'interdit ailleurs.
//
// Il écrit RIEN en production : magasin en mémoire, aucune livraison, aucun
// e-mail. Il consomme en revanche des appels au rédacteur IA configuré (donc de
// l'argent) : il refuse donc de tourner sans `--yes`, et affiche d'abord son plan.
//
//   node tools/measure-readings.mjs                      # plan seulement, aucun appel
//   node tools/measure-readings.mjs --yes --count 9      # 9 lectures (≈ 130 appels LLM)
//   node tools/measure-readings.mjs --yes --count 18 --json mesure.json
//   node tools/measure-readings.mjs --yes --languages fr,nl --count 4
//
// Sortie : un tableau par lecture, un bilan par langue, un bilan global, et un
// code de sortie non nul si un signal de régression apparaît (une contradiction
// planète ↔ signe signalée, un placeholder livré, une fuite de langage interne).

import { LANGUAGES, docStrings } from "../src/deliverables/i18n.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { loadDotEnv } from "../src/env.mjs";
import { createPublicReading } from "../src/models/publicReadingService.mjs";

const LIEUX = {
  paris: { selectedName: "Paris, France", country: "France", normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" } },
  courbevoie: { selectedName: "Courbevoie, France", country: "France", normalizedForCalculation: { latitude: 48.89672, longitude: 2.25666, timeZone: "Europe/Paris" } },
  lyon: { selectedName: "Lyon, France", country: "France", normalizedForCalculation: { latitude: 45.7640, longitude: 4.8357, timeZone: "Europe/Paris" } }
};

// Chaque cas vise un chemin de code précis, pas un thème « joli ».
const CAS = [
  { id: "caroline", birthDate: "1986-01-02", timeValue: "16:45", timePrecision: "approximate", timeMarginMinutes: 30, resolvedPlace: LIEUX.courbevoie },
  { id: "frontiere-ascendant", birthDate: "1990-01-15", timeValue: "12:30", timePrecision: "approximate", timeMarginMinutes: 30, resolvedPlace: LIEUX.paris },
  { id: "heure-inconnue", birthDate: "1970-06-15", timePrecision: "unknown", resolvedPlace: LIEUX.paris },
  { id: "lever-de-soleil", birthDate: "2000-06-21", timeValue: "06:00", timePrecision: "approximate", timeMarginMinutes: 30, resolvedPlace: LIEUX.lyon }
];

function parseArgs(argv) {
  const args = { yes: false, count: 4, languages: null, cases: null, json: null, crossCheck: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--yes") args.yes = true;
    else if (arg === "--cross-check") args.crossCheck = true;
    else if (arg === "--count") args.count = Number(argv[++i]);
    else if (arg === "--languages") args.languages = String(argv[++i] ?? "").split(",").map((code) => code.trim()).filter(Boolean);
    else if (arg === "--cases") args.cases = String(argv[++i] ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    else if (arg === "--json") args.json = argv[++i];
  }
  if (!Number.isInteger(args.count) || args.count < 1) {
    throw new Error("--count doit être un entier positif");
  }
  return args;
}

function plan(args) {
  const langues = args.languages ?? LANGUAGES.map((entry) => entry.code);
  // Produit CARTÉSIEN cas × langues : une simple rotation répétait les mêmes
  // couples et ne couvrait pas, par exemple, « heure inconnue » en anglais.
  const casRetenus = args.cases ? CAS.filter((cas) => args.cases.includes(cas.id)) : CAS;
  if (casRetenus.length === 0) {
    throw new Error(`--cases ne correspond à aucun cas connu (${CAS.map((cas) => cas.id).join(", ")})`);
  }
  const couples = [];
  for (const cas of casRetenus) {
    for (const language of langues) {
      couples.push({ cas, language });
    }
  }
  const lectures = [];
  for (let index = 0; index < args.count; index += 1) {
    lectures.push(couples[index % couples.length]);
  }
  return lectures;
}

function decouperLeJournal(lignes) {
  const evenements = { reecritures: [], retraits: [], styleConserve: [] };
  for (const ligne of lignes) {
    const reecriture = ligne.match(/texte fautif dans « (.+?) » \((.*?)\)/);
    if (reecriture) {
      evenements.reecritures.push({ section: reecriture[1], motifs: reecriture[2].split(",").map((motif) => motif.trim()) });
      continue;
    }
    const retrait = ligne.match(/phrases fautives retirées de « (.+?) » \((.*?)\)/);
    if (retrait) {
      evenements.retraits.push({ section: retrait[1], motifs: retrait[2].split(",").map((motif) => motif.trim()).filter(Boolean) });
      continue;
    }
    const style = ligne.match(/défauts de style persistants dans « (.+?) » \((.*?), conservés/);
    if (style) {
      evenements.styleConserve.push({ section: style[1], motifs: style[2].split(",").map((motif) => motif.trim()) });
    }
  }
  return evenements;
}

async function mesurerUneLecture({ cas, language }, options) {
  const journaux = [];
  const warnOriginal = console.warn;
  const fetchOriginal = globalThis.fetch;
  let appelsLlm = 0;
  console.warn = (...morceaux) => journaux.push(morceaux.join(" "));
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/chat/completions")) {
      appelsLlm += 1;
    }
    return fetchOriginal(url, init);
  };
  const debut = Date.now();
  try {
    const reading = await createPublicReading(
      {
        firstName: "Test",
        language,
        birthDate: cas.birthDate,
        timeValue: cas.timeValue ?? null,
        timePrecision: cas.timePrecision,
        timeMarginMinutes: cas.timeMarginMinutes ?? null,
        resolvedPlace: cas.resolvedPlace
      },
      { crossCheck: options.crossCheck }
    );
    const evenements = decouperLeJournal(journaux);
    const html = reading.html ?? "";
    // Le libellé de la marge est traduit : chercher la chaîne française donnait un
    // faux « signal de régression » sur les huit autres langues.
    const libelleMarge = docStrings(language).labels.margin;
    return {
      cas: cas.id,
      language,
      sections: reading.sections.length,
      appelsLlm,
      reecritures: evenements.reecritures.length,
      retraits: evenements.retraits.length,
      styleConserve: evenements.styleConserve.length,
      motifs: [...evenements.reecritures, ...evenements.retraits, ...evenements.styleConserve].flatMap((entree) => entree.motifs),
      dureeSecondes: Number(((Date.now() - debut) / 1000).toFixed(1)),
      signalements: {
        placeholderLivre: /\{[a-z]+\}|\[[^\]]{1,40}\]/.test(html),
        fuiteInterne: /calculated_development_not_production|JPL Horizons|inactive structures/.test(html),
        margePubliee: cas.timePrecision !== "approximate" || html.includes(libelleMarge),
        conventionPubliee: /lastro-aspects@1\.0\.0/.test(html)
      }
    };
  } finally {
    console.warn = warnOriginal;
    globalThis.fetch = fetchOriginal;
  }
}

function bilan(lectures, cle) {
  const parCle = new Map();
  for (const lecture of lectures) {
    const groupe = cle(lecture);
    const entree = parCle.get(groupe) ?? { lectures: 0, sections: 0, appelsLlm: 0, reecritures: 0, retraits: 0, motifs: new Map() };
    entree.lectures += 1;
    entree.sections += lecture.sections;
    entree.appelsLlm += lecture.appelsLlm;
    entree.reecritures += lecture.reecritures;
    entree.retraits += lecture.retraits;
    for (const motif of lecture.motifs) {
      entree.motifs.set(motif, (entree.motifs.get(motif) ?? 0) + 1);
    }
    parCle.set(groupe, entree);
  }
  return parCle;
}

function afficherBilan(titre, parCle) {
  console.log(`\n=== ${titre} ===`);
  for (const [groupe, entree] of [...parCle.entries()].sort()) {
    const surcout = entree.sections > 0 ? Math.round(((entree.appelsLlm - entree.sections) / entree.sections) * 100) : 0;
    const motifs = [...entree.motifs.entries()].sort((a, b) => b[1] - a[1]).map(([motif, n]) => `${motif}×${n}`).join(", ") || "aucun";
    console.log(
      `${String(groupe).padEnd(12)} ${entree.lectures} lecture(s) · ${entree.sections} sections · ${entree.appelsLlm} appels LLM (+${surcout} %) · ${entree.reecritures} réécriture(s) · ${entree.retraits} retrait(s)`
    );
    console.log(`${"".padEnd(12)} motifs : ${motifs}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const lectures = plan(args);

if (!args.yes) {
  console.log("PLAN (aucun appel LLM ne sera fait sans --yes)");
  console.log(`  lectures prévues : ${lectures.length}`);
  console.log(`  langues          : ${[...new Set(lectures.map((entree) => entree.language))].join(", ")}`);
  console.log(`  cas              : ${[...new Set(lectures.map((entree) => entree.cas.id))].join(", ")}`);
  console.log(`  couples uniques  : ${new Set(lectures.map((entree) => `${entree.cas.id}/${entree.language}`)).size} sur ${lectures.length}`);
  console.log(`  relecture croisée: ${args.crossCheck ? "activée" : "désactivée"}`);
  console.log(`  coût estimé      : ≈ ${lectures.length * 11} appels au rédacteur IA configuré (gpt-4o-mini par défaut)`);
  console.log("\nRelancez avec --yes pour exécuter.");
  process.exit(0);
}

loadDotEnv();
if (!process.env.ASTROLAB_LLM_API_KEY) {
  console.error("Aucune clé de rédacteur IA (ASTROLAB_LLM_API_KEY) : rien à mesurer.");
  process.exit(1);
}

const resultats = [];
for (const [index, lecture] of lectures.entries()) {
  console.log(`\n[${index + 1}/${lectures.length}] ${lecture.cas.id} · ${lecture.language}`);
  const resultat = await mesurerUneLecture(lecture, args);
  resultats.push(resultat);
  console.log(
    `  sections ${resultat.sections} · appels LLM ${resultat.appelsLlm} · réécritures ${resultat.reecritures} · retraits ${resultat.retraits} · ${resultat.dureeSecondes} s`
  );
}

afficherBilan("Bilan par langue", bilan(resultats, (lecture) => lecture.language));
afficherBilan("Bilan global", bilan(resultats, () => "toutes"));

const problemes = [];
for (const resultat of resultats) {
  if (resultat.signalements.placeholderLivre) problemes.push(`${resultat.cas}/${resultat.language} : placeholder livré`);
  if (resultat.signalements.fuiteInterne) problemes.push(`${resultat.cas}/${resultat.language} : langage interne livré`);
  if (!resultat.signalements.margePubliee) problemes.push(`${resultat.cas}/${resultat.language} : marge d'incertitude absente de l'annexe`);
  if (!resultat.signalements.conventionPubliee) problemes.push(`${resultat.cas}/${resultat.language} : convention d'aspects absente de l'annexe`);
  const contradictions = resultat.motifs.filter((motif) => motif === "contradiction_with_socle").length;
  if (contradictions > 0) problemes.push(`${resultat.cas}/${resultat.language} : ${contradictions} contradiction(s) planète ↔ signe signalée(s)`);
}

console.log("");
if (args.json) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(args.json, JSON.stringify({ date: new Date().toISOString(), resultats, problemes }, null, 2));
  console.log(`Détail écrit dans ${args.json}`);
}

if (problemes.length > 0) {
  console.log("SIGNAL DE RÉGRESSION :");
  for (const probleme of problemes) {
    console.log(`  - ${probleme}`);
  }
  process.exit(1);
}
console.log("Aucun signal de régression sur ce tirage.");
