// Aperçu du document livré, sans réseau et sans coût.
//
// Pourquoi : la mise en page ne se juge qu'à l'œil, et un tirage réel coûte des
// appels au rédacteur IA. Ce script fabrique un document complet et représentatif
// (couverture, sections, annexe, tableau des positions) avec des textes de
// remplacement, écrit le HTML sur disque, et laisse l'impression au navigateur —
// c'est elle qui produit le PDF du client.
//
//   node tools/preview-document.mjs                        # /tmp/apercu-lastro.html, français
//   node tools/preview-document.mjs --out apercu.html --language nl
//   node tools/preview-document.mjs --precision exact --margin 0
//   node tools/preview-document.mjs --precision unknown    # heure inconnue
//
// Ouvrir le fichier dans un navigateur, puis imprimer (c'est l'impression qui
// applique les marges de 2 cm, la répétition des en-têtes de tableau et
// l'ouverture de l'annexe).

import { writeFileSync } from "node:fs";

import { docStrings, normalizeLanguage } from "../src/deliverables/i18n.mjs";
import { createPublicReading } from "../src/models/publicReadingService.mjs";

function parseArgs(argv) {
  const args = {
    out: "/tmp/apercu-lastro.html",
    language: "fr",
    precision: "approximate",
    margin: 30,
    firstName: "Caro",
    birthDate: "1990-01-15",
    timeValue: "12:30"
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") args.out = String(argv[++i]);
    else if (argv[i] === "--language") args.language = String(argv[++i]);
    else if (argv[i] === "--precision") args.precision = String(argv[++i]);
    else if (argv[i] === "--margin") args.margin = Number(argv[++i]);
    else if (argv[i] === "--firstName") args.firstName = String(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const language = normalizeLanguage(args.language);
const strings = docStrings(language);

// Textes de remplacement : assez longs pour juger l'aération, jamais présentés
// comme une lecture réelle (le script le dit dans le document).
const PARAGRAPHES = {
  fr: [
    "Vous avancez avec une prudence qui n'a rien d'une réserve : elle vous permet de mesurer avant de vous engager, et de tenir ce que vous avez commencé. Cette qualité se lit dans la manière dont vous organisez votre quotidien, avec des repères stables et une préférence pour ce qui dure.",
    "Ce qui vous met en tension, ce sont les moments où l'on attend de vous une réaction immédiate. Vous avez besoin d'un temps de maturation que les autres ne vous accordent pas toujours, et il vous arrive de confondre ce besoin de recul avec un manque d'élan.",
    "Votre énergie se déploie mieux dans les projets au long cours que dans les élans soudains. Vous savez porter une intention pendant des mois sans vous décourager, ce qui vous distingue de ceux qui s'épuisent au premier obstacle."
  ],
  en: [
    "You move forward with a caution that is not reserve: it lets you measure before committing, and to hold on to what you have started. This quality shows in the way you organise your daily life, with steady landmarks and a preference for what lasts.",
    "What puts you under tension is the moment when people expect an immediate reaction. You need a maturation time that others do not always grant you, and you sometimes mistake that need for distance for a lack of momentum.",
    "Your energy unfolds better in long projects than in sudden impulses. You can carry an intention for months without losing heart, which sets you apart from those who give up at the first obstacle."
  ]
};
const textes = PARAGRAPHES[language] ?? PARAGRAPHES.en;

// Un rédacteur de remplacement : aucun appel réseau, texte déterministe.
let index = 0;
const writerFn = () => {
  const texte = textes.map((paragraphe) => `<p>${paragraphe}</p>`).join(" ");
  index += 1;
  return `${texte}\n\n<p><em>(aperçu ${index} — texte de remplacement, aucune lecture réelle)</em></p>`;
};

const reading = await createPublicReading(
  {
    firstName: args.firstName,
    language,
    birthDate: args.birthDate,
    timePrecision: args.precision,
    timeValue: args.precision === "unknown" ? null : args.timeValue,
    timeMarginMinutes: args.precision === "approximate" ? args.margin : null,
    resolvedPlace: {
      selectedName: "Courbevoie, France",
      country: "France",
      normalizedForCalculation: { latitude: 48.89672, longitude: 2.25666, timeZone: "Europe/Paris" }
    }
  },
  { writerFn, crossCheck: false }
);

writeFileSync(args.out, reading.html);
console.log(`Aperçu écrit dans ${args.out}`);
console.log(`  langue ${language} · heure ${args.precision}${args.precision === "approximate" ? ` (±${args.margin} min)` : ""} · ${reading.sections.length} sections`);
console.log(`  en-tête de document : ${strings.brand}`);
console.log("  Ouvrez-le dans un navigateur puis imprimez : les marges de 2 cm, la");
console.log("  répétition des en-têtes de tableau et l'ouverture de l'annexe ne");
console.log("  s'appliquent qu'à l'impression.");
