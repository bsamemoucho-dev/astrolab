// Estimation du coût d'un dossier — entrée, sortie, modèles réellement routés,
// et tentatives de correction. Hors ligne : aucun appel, aucune clé, aucun coût.
//
// Pourquoi cet outil : le coût était estimé sur les seuls tokens de SORTIE. Or
// l'entrée pèse lourd (le plan sérialisé et les faits sont renvoyés à chaque
// bloc), deux sections utilisent un modèle plus cher (gpt-4.1-mini), et un bloc
// rejeté est rejoué avec un correctif plus long. Une estimation qui ignore ces
// trois termes sous-estime la facture réelle.
//
// Ce que l'outil mesure :
//   - les invites EXACTES que le rédacteur enverrait (mêmes fonctions) ;
//   - les caractères, convertis en tokens par un ratio DOCUMENTÉ (estimation,
//     pas une tokenisation : le tokenizer du fournisseur n'est pas embarqué) ;
//   - le modèle par section, tel que le routeur le choisit ;
//   - les plafonds de sortie calculés par `generationLimits`.
//
//   node tools/estimate-cost.mjs
//   node tools/estimate-cost.mjs --json /tmp/cout.json

import { writeFileSync } from "node:fs";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { priceForModel } from "../src/deliverables/cost.mjs";
import { DEFAULT_PRICE_CENTS } from "../src/payments/pricing.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { blockLengthBudget, maxTokensForBlock } from "../src/deliverables/generationLimits.mjs";
import { buildIndividualRelationalAffectionPlan, buildIndividualRelationalCommunicationPlan } from "../src/deliverables/individualRelationalPlan.mjs";
import {
  STRUCTURED_SECTION_MODEL_OVERRIDES,
  buildStructuredSystemPrompt,
  buildStructuredUserPrompt,
  scopedSectionPlanForBlock
} from "../src/deliverables/structuredSectionWriter.mjs";
import { getPersonalCurrentSky } from "../src/models/currentSkyService.mjs";

// Ratio caractères → tokens. Mesuré empiriquement sur du français accentué et du
// JSON à clés ASCII : ~3,5 à 3,9. On retient 3,7. À remplacer par le tokenizer du
// fournisseur le jour où il est disponible hors ligne.
const CHARS_PER_TOKEN = 3.7;

// Un bloc repris renvoie la même entrée PLUS le correctif (`correctionIssues` :
// code, message, extrait de 320 caractères, plans autorisés) : +15 % d'entrée.
const CORRECTION_INPUT_GROWTH = 1.15;

// Un bloc rejeté peut être rejoué jusqu'à 2 fois (MAX_CORRECTION_ATTEMPTS).
// Les scénarios ci-dessous supposent UNE reprise par bloc en échec : c'est
// l'hypothèse basse, celle qui sous-estime le moins.
const CORRECTION_RATES = [0, 0.1, 0.25];

const MODELE_PAR_DEFAUT = process.env.ASTROLAB_LLM_MODEL?.trim() || "gpt-4o-mini";
const TAUX_EUR_PAR_USD = 0.92; // hypothèse explicite, à vérifier

const THEME = {
  personId: "estimation",
  birthDate: "1979-03-14",
  timePrecision: "approximate",
  timeValue: "09:00",
  timeMarginMinutes: 30,
  birthPlace: "Lyon, France",
  placeName: "Lyon, France",
  country: "FR",
  latitude: 45.764,
  longitude: 4.8357,
  timeZone: "Europe/Paris",
  coordinateSource: "user_provided",
  coordinateConfidence: "unverified"
};

function parseArgs(argv) {
  const args = { json: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--json") args.json = argv[++index] ?? null;
  }
  return args;
}

function modelePourSection(sectionId) {
  return STRUCTURED_SECTION_MODEL_OVERRIDES[sectionId] ?? MODELE_PAR_DEFAUT;
}

function tokensEstimes(chars) {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

async function construirePlan() {
  const calculation = calculateWesternNatalChart(THEME, {
    calculatedAt: new Date().toISOString(),
    runId: "calc_estimation"
  });
  const artefact = calculation.calculationArtifacts.find((item) => item.type === "structured_result");
  const userId = "u_estimation";
  const state = {
    persons: [{ id: THEME.personId, ownerUserId: userId, isPrimary: true, createdAt: new Date().toISOString() }],
    calculationRuns: [{ ...calculation.calculationRun, ownerUserId: userId, createdAt: new Date().toISOString() }],
    calculationArtifacts: [
      {
        ...artefact,
        ownerUserId: userId,
        calculationRunId: calculation.calculationRun.id,
        createdAt: new Date().toISOString()
      }
    ]
  };
  const store = { async transact(fn) { return fn(state); } };
  const currentSky = await getPersonalCurrentSky(store, userId, {
    personId: THEME.personId,
    nowUtc: new Date().toISOString(),
    horizonDays: 42
  });
  const dossierEvidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    currentSky,
    generatedAt: new Date().toISOString()
  });
  const fullDossierPlan = buildFullDossierPlan(dossierEvidence);
  const relational = [
    buildIndividualRelationalCommunicationPlan(dossierEvidence),
    buildIndividualRelationalAffectionPlan(dossierEvidence)
  ].flatMap((plan) => plan.sections);
  return { sections: [...fullDossierPlan.sections, ...relational] };
}

function coutUsd(ligne, { entree, sortie }) {
  const prix = priceForModel(ligne.modele);
  return (entree / 1e6) * prix.in + (sortie / 1e6) * prix.out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { sections } = await construirePlan();
  const lignes = [];

  for (const section of sections) {
    const sectionId = section.sectionId ?? section.id;
    const blocks = section.blockPlans ?? [];
    if (blocks.length === 0) {
      lignes.push({ sectionId, blocs: 0, etat: "écartée", detail: [] });
      continue;
    }
    const modele = modelePourSection(sectionId);
    const detail = blocks.map((blockPlan) => {
      const scoped = scopedSectionPlanForBlock(section, blockPlan);
      const system = buildStructuredSystemPrompt(scoped, { blockCount: blocks.length, blockPlan });
      const user = buildStructuredUserPrompt({ sectionPlan: scoped });
      const budget = blockLengthBudget({ sectionPlan: section, blockPlan });
      const charsEntree = system.length + user.length;
      return {
        charsEntree,
        tokensEntree: tokensEstimes(charsEntree),
        tokensSortieCible: Math.ceil(budget.targetWords * 1.6),
        tokensSortieMax: maxTokensForBlock(budget)
      };
    });
    const somme = (champ) => detail.reduce((total, item) => total + item[champ], 0);
    lignes.push({
      sectionId,
      blocs: blocks.length,
      modele,
      detail,
      charsEntree: somme("charsEntree"),
      tokensEntree: somme("tokensEntree"),
      tokensSortieCible: somme("tokensSortieCible"),
      tokensSortieMax: somme("tokensSortieMax"),
      etat: "écrite"
    });
  }

  const ecrites = lignes.filter((ligne) => ligne.etat === "écrite");
  const coutPlafond = ecrites.reduce((total, ligne) => total + coutUsd(ligne, { entree: ligne.tokensEntree, sortie: ligne.tokensSortieMax }), 0);
  const coutCible = ecrites.reduce((total, ligne) => total + coutUsd(ligne, { entree: ligne.tokensEntree, sortie: ligne.tokensSortieCible }), 0);

  console.log("SECTION".padEnd(24), "blocs", "modèle".padEnd(13), "entrée", "sortie cible", "sortie max", "coût $ au plafond");
  for (const ligne of lignes) {
    if (ligne.etat !== "écrite") {
      console.log(ligne.sectionId.padEnd(24), "  0", "—".padEnd(14), "—", "—", "—", "—");
      continue;
    }
    console.log(
      ligne.sectionId.padEnd(24),
      String(ligne.blocs).padStart(5),
      ligne.modele.padEnd(13),
      String(ligne.tokensEntree).padStart(6),
      String(ligne.tokensSortieCible).padStart(12),
      String(ligne.tokensSortieMax).padStart(10),
      coutUsd(ligne, { entree: ligne.tokensEntree, sortie: ligne.tokensSortieMax }).toFixed(5).padStart(9)
    );
  }

  const totaux = {
    sections: ecrites.length,
    blocs: ecrites.reduce((total, ligne) => total + ligne.blocs, 0),
    tokensEntree: ecrites.reduce((total, ligne) => total + ligne.tokensEntree, 0),
    tokensSortieCible: ecrites.reduce((total, ligne) => total + ligne.tokensSortieCible, 0),
    tokensSortieMax: ecrites.reduce((total, ligne) => total + ligne.tokensSortieMax, 0)
  };

  console.log(`\nTOTAL ${totaux.sections} sections écrites, ${lignes.length - totaux.sections} écartée(s), ${totaux.blocs} blocs`);
  console.log(`  entrée estimée   : ${totaux.tokensEntree} tokens`);
  console.log(`  sortie à la cible: ${totaux.tokensSortieCible} tokens`);
  console.log(`  sortie au plafond: ${totaux.tokensSortieMax} tokens`);
  console.log(`  coût au plafond  : ${coutPlafond.toFixed(4)} USD  (${(coutPlafond * TAUX_EUR_PAR_USD).toFixed(4)} EUR — hypothèse ${TAUX_EUR_PAR_USD} EUR/USD)`);
  console.log(`  coût à la cible  : ${coutCible.toFixed(4)} USD  (${(coutCible * TAUX_EUR_PAR_USD).toFixed(4)} EUR)`);

  console.log("\nScénarios de correction (entrée × 1,15 pour chaque bloc repris, une reprise) :");
  const scenarios = [];
  for (const taux of CORRECTION_RATES) {
    let entree = 0;
    let sortie = 0;
    let cout = 0;
    for (const ligne of ecrites) {
      // Espérance linéaire : `taux` des blocs est repris, chacun une fois.
      const entreeReprise = ligne.tokensEntree * taux * CORRECTION_INPUT_GROWTH;
      const sortieReprise = ligne.tokensSortieCible * taux;
      const entreeLigne = ligne.tokensEntree + entreeReprise;
      const sortieLigne = ligne.tokensSortieMax + sortieReprise;
      entree += entreeLigne;
      sortie += sortieLigne;
      cout += coutUsd(ligne, { entree: entreeLigne, sortie: sortieLigne });
    }
    scenarios.push({ taux, entree, sortie, cout });
    console.log(
      `  ${(taux * 100).toFixed(0).padStart(2)} % de blocs repris : ${Math.round(entree)} tokens d'entrée, ${Math.round(sortie)} de sortie, ${cout.toFixed(4)} USD/dossier`
    );
  }

  console.log(`\nPrix public par défaut du dépôt : ${(DEFAULT_PRICE_CENTS / 100).toFixed(2).replace(".", ",")} EUR → part du coût modèle au plafond ≈ ${((coutPlafond * TAUX_EUR_PAR_USD) / (DEFAULT_PRICE_CENTS / 100) * 100).toFixed(1)} %`);
  console.log("Estimation : ratio caractères/tokens documenté, pas une tokenisation fournisseur — marge ±15 %.");

  if (args.json) {
    writeFileSync(args.json, JSON.stringify({ lignes, totaux, scenarios, tauxEurParUsd: TAUX_EUR_PAR_USD }, null, 1));
    console.log(`\nDétail écrit dans ${args.json}`);
  }
}

await main();
