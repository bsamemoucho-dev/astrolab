// Aperçu du dossier PAYANT réel (createFullPublicReading), sans réseau ni coût.
//
// tools/preview-document.mjs montre l'ancien parcours (publicReadingService).
// Le parcours vendu passe par fullDossierService : même plan éditorial, mêmes
// validateurs, même rendu, chapitre Regards croisés compris. Seul le rédacteur
// IA est remplacé par un texte neutre, pour juger la mise en page et les parties
// calculées (couverture, carte, Regards croisés, annexe).
//
//   node tools/preview-full-dossier.mjs                     # /tmp/apercu-dossier.html
//   node tools/preview-full-dossier.mjs --out apercu.html --precision exact --time 16:30
//   node tools/preview-full-dossier.mjs --precision unknown

import { writeFileSync } from "node:fs";

import { createFullPublicReading } from "../src/models/fullDossierService.mjs";

const TEXTE_SIMULE =
  "Texte de remplacement : ici le rédacteur développe une idée autorisée par le plan éditorial, en quelques phrases sobres et spécifiques.";

function parseArgs(argv) {
  const args = { out: "/tmp/apercu-dossier.html", precision: "approximate", time: "16:45", margin: 30, birthDate: "1986-01-02", firstName: "Camille" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") args.out = String(argv[++i]);
    else if (argv[i] === "--precision") args.precision = String(argv[++i]);
    else if (argv[i] === "--time") args.time = String(argv[++i]);
    else if (argv[i] === "--margin") args.margin = Number(argv[++i]);
    else if (argv[i] === "--date") args.birthDate = String(argv[++i]);
    else if (argv[i] === "--firstName") args.firstName = String(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const input = {
  firstName: args.firstName,
  language: "fr",
  birthDate: args.birthDate,
  timePrecision: args.precision,
  ...(args.precision === "unknown" ? {} : { timeValue: args.time }),
  ...(args.precision === "approximate" ? { timeMarginMinutes: args.margin } : {}),
  deliveryEmail: "apercu@example.test",
  resolvedPlace: {
    selectedName: "Paris, France",
    country: "France",
    normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
  }
};

const structuredWriterFn = async (prompt) => ({
  sectionId: prompt?.sectionPlan?.sectionId,
  blocks: (prompt?.sectionPlan?.blockPlans ?? []).map((block) => ({ blockId: block.blockId, text: TEXTE_SIMULE }))
});

const reading = await createFullPublicReading(input, { structuredWriterFn, failFast: true, config: null });
writeFileSync(args.out, reading.html);
console.log(`Aperçu écrit : ${args.out} (${reading.sections.length} sections rédigées)`);
