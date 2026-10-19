// Génération réelle des trois chapitres d'aspects — expérimentation autorisée
// du 18/10/2026, sur un thème FICTIF, avec plafonds durs.
//
// Ce que ce script garantit, par construction :
//   - au plus N appels (4 par défaut) : le transport refuse le suivant ;
//   - au plus M dollars (0,05 USD par défaut) : le cumul est vérifié avant
//     chaque appel, pas après ;
//   - UN SEUL appel par bloc : aucune tentative de correction n'est lancée, même
//     si la validation refuse un texte (l'autorisation l'interdit) ;
//   - aucun e-mail, aucune livraison, aucun paiement, aucune écriture en base :
//     le script n'imprime que des fichiers d'analyse dans le dossier de sortie.
//
// Il écrit les chapitres produits, le rapport de validation et le journal des
// appels (modèle, tokens, coût estimé) pour que le texte reste auditable.
//
//   node tools/generate-aspect-chapters.mjs                    # plan seul, 0 appel
//   node tools/generate-aspect-chapters.mjs --yes              # 4 appels max
//
// Sans `--yes`, le script affiche ce qu'il ferait et s'arrête : aucun réseau.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { estimateUsageCost, priceForModel } from "../src/deliverables/cost.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { blockLengthBudget, maxTokensForBlock, worstCaseOutputTokens } from "../src/deliverables/generationLimits.mjs";
import {
  buildStructuredSystemPrompt,
  scopedSectionPlanForBlock,
  writeStructuredSectionWithLlm
} from "../src/deliverables/structuredSectionWriter.mjs";
import { loadDotEnv } from "../src/env.mjs";

const CHAPITRES = ["internal_tensions", "supporting_resources", "major_aspects"];

const TITRES = {
  internal_tensions: "Tensions intérieures",
  supporting_resources: "Ressources complémentaires",
  major_aspects: "Aspects majeurs"
};

// Thème FICTIF — aucune donnée client. 14/03/1979 ≈ 09 h 00 ± 30 min, Lyon.
const THEME = {
  personId: "experimentation_aspects",
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
  coordinateSource: "experimentation_fixture",
  coordinateConfidence: "unverified"
};

function parseArgs(argv) {
  const args = {
    yes: false,
    out: "docs/experiments/2026-10-18-chapitres-aspects",
    maxCalls: 4,
    maxUsd: 0.05,
    provider: "openai",
    model: null,
    engine: "composition",
    aspectChapterMode: "reference",
    sections: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--yes") args.yes = true;
    else if (arg === "--out") args.out = String(argv[++index]);
    else if (arg === "--max-calls") args.maxCalls = Number(argv[++index]);
    else if (arg === "--max-usd") args.maxUsd = Number(argv[++index]);
    else if (arg === "--provider") args.provider = String(argv[++index]).trim().toLowerCase();
    else if (arg === "--model") args.model = String(argv[++index]).trim();
    else if (arg === "--engine") args.engine = String(argv[++index]).trim().toLowerCase();
    else if (arg === "--sections") args.sections = String(argv[++index]).split(",").map((id) => id.trim()).filter(Boolean);
    else if (arg === "--aspect-chapter") {
      const mode = String(argv[++index]).trim().toLowerCase();
      if (!["narrative", "reference", "absent"].includes(mode)) {
        throw new Error(`--aspect-chapter : valeurs acceptées — narrative, reference, absent (reçu : ${mode})`);
      }
      args.aspectChapterMode = mode;
    }
    else if (arg === "--suffix") args.suffix = String(argv[++index]).trim();
  }
  return args;
}

function construirePlan(args = { engine: "composition", aspectChapterMode: "reference" }) {
  const calculation = calculateWesternNatalChart(THEME, {
    calculatedAt: new Date().toISOString(),
    runId: "calc_experimentation_aspects"
  });
  const dossierEvidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: new Date().toISOString()
  });
  const fullDossierPlan = buildFullDossierPlan(dossierEvidence, {
    editorialEngine: args.engine,
    aspectChapterMode: args.aspectChapterMode
  });
  return { calculation, dossierEvidence, fullDossierPlan };
}

function blocsDuPlan(plan, sectionsChoisies = CHAPITRES) {
  return sectionsChoisies.flatMap((sectionId) => {
    const section = plan.sections.find((item) => item.sectionId === sectionId);
    return (section?.blockPlans ?? []).map((blockPlan) => ({ section, blockPlan }));
  });
}

// Transport réel, avec plafonds. Toute tentative au-delà lève AVANT le réseau.
function transportGarde({ maxCalls, maxUsd, ledger }) {
  const dejaVus = new Set();
  return async function fetchGarde(url, init) {
    if (ledger.calls.length >= maxCalls) {
      const error = new Error(
        `Plafond d'appels atteint (${maxCalls}) : aucune génération supplémentaire n'est lancée sans autorisation.`
      );
      error.code = "CALL_BUDGET_EXHAUSTED";
      throw error;
    }
    const corps = JSON.parse(init.body);
    const charge = JSON.parse(corps.messages.find((message) => message.role === "user").content);
    const sectionId = charge.sectionPlan.sectionId;
    const blockId = charge.sectionPlan.blockPlans?.[0]?.blockId ?? "?";
    const cle = `${sectionId}.${blockId}`;
    if (dejaVus.has(cle)) {
      const error = new Error(
        `Une correction a été demandée pour ${cle} : refusée, l'autorisation ne couvre qu'un appel par bloc.`
      );
      error.code = "NO_RETRY_AUTHORIZED";
      throw error;
    }
    dejaVus.add(cle);

    // Vérification PROJETÉE, pas seulement cumulée : on refuse un appel dont le
    // pire cas ferait dépasser le plafond, sinon un dernier appel « raisonnable »
    // pourrait faire exploser la facture finale.
    const depense = ledger.calls.reduce((total, appel) => total + appel.costUsd, 0);
    const tarif = priceForModel(corps.model);
    const charsEntree = (corps.messages ?? []).reduce(
      (total, message) => total + String(message.content ?? "").length,
      0
    );
    const pireEntree = Math.ceil(charsEntree / 3.5);
    const pireSortie = Number(corps.max_tokens ?? 0);
    const pireCout = (pireEntree / 1e6) * tarif.in + (pireSortie / 1e6) * tarif.out;
    if (depense >= maxUsd || depense + pireCout > maxUsd) {
      const error = new Error(
        `Plafond de dépense : ${depense.toFixed(4)} USD déjà engagés, pire cas de cet appel ${pireCout.toFixed(4)} USD, plafond ${maxUsd} USD. Appel refusé.`
      );
      error.code = "SPEND_CEILING_REACHED";
      throw error;
    }

    const debut = Date.now();
    const reponse = await globalThis.fetch(url, init);
    const duree = Date.now() - debut;
    let data = null;
    try {
      data = await reponse.clone().json();
    } catch {
      data = null;
    }
    const usage = data?.usage ?? {};
    const modelRepondu = data?.model ?? corps.model ?? null;
    const cout = estimateUsageCost(
      corps.model,
      usage.prompt_tokens ?? 0,
      usage.completion_tokens ?? 0
    );
    ledger.calls.push({
      sectionId,
      blockId,
      requestedModel: corps.model,
      respondedModel: modelRepondu,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      finishReason: data?.choices?.[0]?.finish_reason ?? null,
      durationMs: duree,
      httpStatus: reponse.status,
      costUsd: cout?.usd ?? 0,
      raw: data?.choices?.[0]?.message?.content ?? null
    });
    return reponse;
  };
}

function texteDesBlocs(section) {
  return (section?.blocks ?? []).map((block) => block.text ?? "").join("\n\n").trim();
}

function enteteChapitre(sectionId, sectionPlan, ecrit) {
  const faits = (sectionPlan.primaryEvidenceRefs ?? [])
    .map((ref) => sectionPlan.evidencePackets.find((packet) => packet.evidenceRefs.includes(ref)))
    .filter(Boolean)
    .map((packet) => {
      const claim = packet.claims[0];
      return `${claim.bodyA} – ${claim.bodyB} (${claim.aspectType}, orbe ${claim.orb}°)`;
    });
  return [
    `# ${TITRES[sectionId]}`,
    "",
    `- Thème : fictif, 14/03/1979 ≈ 09 h 00 ± 30 min, Lyon (France) — aucun client réel.`,
    `- Faits utilisés (${faits.length}) : ${faits.join(" ; ")}`,
    `- Règles appliquées : ${[...new Set((sectionPlan.allowedInterpretationRuleRefs ?? []))].join(", ")}`,
    `- Modèle : ${ecrit.model ?? "—"}`,
    `- Appels : ${ecrit.llmCalls} — tokens entrée ${ecrit.usage?.promptTokens ?? 0}, sortie ${ecrit.usage?.completionTokens ?? 0}`,
    `- Longueur produite : ${ecrit.words} mots (repère ${ecrit.length?.targetWords}, plafond ${ecrit.length?.maxWords}) — statut ${ecrit.length?.status}`,
    `- Validation : ${ecrit.validation?.ok ? "acceptée" : "REFUSÉE"}`
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  loadDotEnv();
  // Deux fournisseurs, un seul protocole : Anthropic expose une couche de
  // compatibilité OpenAI sur `/v1`, donc les mêmes prompts et le même client
  // peuvent servir. La clé vient de la variable du fournisseur, jamais de la
  // ligne de commande (elle finirait dans l'historique du shell).
  const FOURNISSEURS = {
    openai: {
      variable: "ASTROLAB_LLM_API_KEY",
      baseUrl: process.env.ASTROLAB_LLM_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: process.env.ASTROLAB_LLM_MODEL?.trim() || "gpt-4o-mini"
    },
    anthropic: {
      variable: "ANTHROPIC_API_KEY",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-5-5",
      // La couche de compatibilité n'accepte que `json_schema` : on n'envoie
      // pas `response_format` du tout, et le JSON reste exigé par la consigne.
      jsonMode: false,
      // `temperature` est déprécié pour ce modèle : la requête l'omet.
      temperatureSupported: false
    }
  };
  const fournisseur = FOURNISSEURS[args.provider];
  if (!fournisseur) {
    throw new Error(`Fournisseur inconnu : ${args.provider} (attendu : ${Object.keys(FOURNISSEURS).join(" ou ")})`);
  }
  const apiKey = process.env[fournisseur.variable]?.trim();
  const baseUrl = fournisseur.baseUrl;
  const model = args.model || fournisseur.model;

  const { dossierEvidence, fullDossierPlan } = construirePlan(args);
  const sectionsChoisies = Array.isArray(args.sections) && args.sections.length > 0 ? args.sections : CHAPITRES;
  const cibles = blocsDuPlan(fullDossierPlan, sectionsChoisies);

  console.log("THÈME     : fictif 14/03/1979 ≈ 09 h 00 ± 30 min, Lyon");
  console.log(`FOURNISS. : ${args.provider}`);
  console.log(`MOTEUR    : ${args.engine} (aspects : ${args.aspectChapterMode})`);
  console.log(`MODÈLE    : ${model} via ${baseUrl}`);
  console.log(`CLÉ       : ${apiKey ? `${fournisseur.variable} présente (non affichée)` : `${fournisseur.variable} ABSENTE`}`);
  console.log(`APPELS  : ${cibles.length} (plafond ${args.maxCalls})`);
  console.log(`BUDGET  : ${args.maxUsd} USD (plafond dur)`);
  for (const { section, blockPlan } of cibles) {
    const budget = blockLengthBudget({ sectionPlan: section, blockPlan });
    console.log(
      `  ${section.sectionId}.${blockPlan.blockId} — repère ${budget.targetWords} mots, plafond ${budget.maxWords} mots, ${worstCaseOutputTokens({ blockPlans: [blockPlan], targetWords: section.targetWords, maxWords: section.maxWords })} tokens max`
    );
  }

  if (!args.yes) {
    // Borne haute théorique, annoncée avant toute dépense : 6 000 tokens
    // d'entrée et 2 000 de sortie par appel, au tarif du modèle réellement
    // demandé (le tarif est public, pas mesuré — la facture tranche).
    const tarif = priceForModel(model);
    const borneHaute = cibles.reduce((total, { section, blockPlan }) => {
      const budget = blockLengthBudget({ sectionPlan: section, blockPlan });
      const pireSortie = maxTokensForBlock(budget);
      const pireEntree = 3000; // borne d'entrée observée (1 280 à 1 670 réels)
      return total + (pireEntree / 1e6) * tarif.in + (pireSortie / 1e6) * tarif.out;
    }, 0);
    console.log(
      `\nTarif retenu : ${tarif.in} / ${tarif.out} USD par million (entrée / sortie).`
    );
    console.log(`Borne haute théorique : ${borneHaute.toFixed(4)} USD pour ${cibles.length} appels.`);
    console.log("Plan seul : aucun appel effectué (ajoutez --yes pour lancer).");
    return;
  }
  if (!apiKey) {
    throw new Error("ASTROLAB_LLM_API_KEY absente : aucun appel ne peut être lancé.");
  }

  mkdirSync(args.out, { recursive: true });
  const ledger = { calls: [] };
  const fetchFn = transportGarde({ maxCalls: args.maxCalls, maxUsd: args.maxUsd, ledger });
  const config = {
    apiKey,
    baseUrl,
    model,
    fetchFn,
    jsonMode: fournisseur.jsonMode !== false,
    temperatureSupported: fournisseur.temperatureSupported !== false
  };
  const logger = { warn: (...parts) => console.warn("[validation]", ...parts) };

  const resultats = [];
  for (const sectionId of sectionsChoisies) {
    const sectionPlan = fullDossierPlan.sections.find((section) => section.sectionId === sectionId);
    try {
      const ecrit = await writeStructuredSectionWithLlm({
        dossierEvidence,
        sectionPlan,
        options: { config, logger, failFast: true }
      });
      resultats.push({ sectionId, ecrit, echec: null });
      console.log(`\n✔ ${sectionId} — ${ecrit.words} mots, validation ${ecrit.validation.ok ? "OK" : "KO"}`);
    } catch (error) {
      // Une erreur 4xx ne se corrige pas en réessayant : on arrête la série
      // immédiatement au lieu de reproduire la même requête refusée.
      const statut = Number(error.providerStatus ?? 0);
      const arretImmediat = statut >= 400 && statut < 500;
      // Aucune correction relancée : on conserve ce qui a été produit et le motif.
      const dernierAppel = ledger.calls.filter((appel) => appel.sectionId === sectionId).at(-1) ?? null;
      resultats.push({
        sectionId,
        ecrit: null,
        echec: {
          code: error.code ?? "unknown",
          message: error.message,
          validation: error.validation ?? null,
          brut: dernierAppel?.raw ?? null
        }
      });
      console.log(`\n✖ ${sectionId} — ${error.code ?? "erreur"} : ${String(error.message).slice(0, 160)}`);
      if (arretImmediat) {
        console.log("Arrêt de la série : erreur de requête (4xx), rien à corriger côté contenu.");
        break;
      }
    }
  }

  // --- Écriture des artefacts -------------------------------------------------
  const total = ledger.calls.reduce((somme, appel) => somme + appel.costUsd, 0);
  const complete = [];

  for (const resultat of resultats) {
    const { sectionId } = resultat;
    const sectionPlan = fullDossierPlan.sections.find((section) => section.sectionId === sectionId);
    const fichier = {
      internal_tensions: "01-tensions-interieures.md",
      supporting_resources: "02-ressources-complementaires.md",
      major_aspects: "03-aspects-majeurs.md",
      general_synthesis: "00-synthese.md",
      conclusion: "04-conclusion.md"
    }[sectionId] ?? `${sectionId}.md`;

    let corps;
    if (resultat.ecrit) {
      corps = [
        enteteChapitre(sectionId, sectionPlan, resultat.ecrit),
        "",
        "## Texte généré",
        "",
        texteDesBlocs(resultat.ecrit.section),
        "",
        "## Rapport de validation",
        "",
        "```json",
        JSON.stringify(
          { ok: resultat.ecrit.validation.ok, issues: resultat.ecrit.validation.issues ?? [], warnings: resultat.ecrit.validation.warnings ?? [] },
          null,
          1
        ),
        "```"
      ].join("\n");
      complete.push(`# ${TITRES[sectionId]}\n\n${texteDesBlocs(resultat.ecrit.section)}`);
    } else {
      corps = [
        `# ${TITRES[sectionId]}`,
        "",
        `- Statut : **non produit**`,
        `- Motif : \`${resultat.echec.code}\` — ${resultat.echec.message}`,
        "",
        "## Texte brut reçu (refusé, conservé pour analyse)",
        "",
        "```",
        resultat.echec.brut ?? "(aucun texte)",
        "```",
        "",
        "## Rapport de validation",
        "",
        "```json",
        JSON.stringify(resultat.echec.validation ?? null, null, 1),
        "```"
      ].join("\n");
      complete.push(`# ${TITRES[sectionId]}\n\n_(non produit : ${resultat.echec.code})_`);
    }
    writeFileSync(join(args.out, fichier), `${corps}\n`);
  }

  writeFileSync(join(args.out, "lecture-complete.md"), `${complete.join("\n\n---\n\n")}\n`);
  writeFileSync(
    join(args.out, "rapport-validation.json"),
    JSON.stringify(
      {
        theme: THEME,
        generatedAt: new Date().toISOString(),
        model,
        chapters: resultats.map((resultat) => ({
          sectionId: resultat.sectionId,
          status: resultat.ecrit ? "produced" : "failed",
          failure: resultat.echec,
          model: resultat.ecrit?.model ?? null,
          llmCalls: resultat.ecrit?.llmCalls ?? null,
          usage: resultat.ecrit?.usage ?? null,
          words: resultat.ecrit?.words ?? null,
          length: resultat.ecrit?.length ?? null,
          validation: resultat.ecrit?.validation ?? resultat.echec?.validation ?? null,
          facts: (fullDossierPlan.sections.find((section) => section.sectionId === resultat.sectionId)?.evidencePackets ?? []).map(
            (packet) => packet.claims[0]
          ),
          rules: fullDossierPlan.sections.find((section) => section.sectionId === resultat.sectionId)?.allowedInterpretationRuleRefs ?? []
        }))
      },
      null,
      1
    )
  );
  writeFileSync(
    join(args.out, "appels.json"),
    JSON.stringify(
      {
        ceilingCalls: args.maxCalls,
        ceilingUsd: args.maxUsd,
        calls: ledger.calls.map(({ raw, ...appel }) => appel),
        totalCalls: ledger.calls.length,
        totalCostUsd: Math.round(total * 1e6) / 1e6
      },
      null,
      1
    )
  );

  console.log(`\n=== BILAN ===`);
  console.log(`appels : ${ledger.calls.length}/${args.maxCalls} | coût estimé : ${total.toFixed(4)} USD`);
  for (const appel of ledger.calls) {
    console.log(
      `  ${appel.sectionId}.${appel.blockId} — ${appel.respondedModel} — in ${appel.promptTokens}, out ${appel.completionTokens}, ${appel.costUsd.toFixed(5)} USD, finish=${appel.finishReason}`
    );
  }
  console.log(`\nArtefacts écrits dans ${args.out}`);
}

await main();
