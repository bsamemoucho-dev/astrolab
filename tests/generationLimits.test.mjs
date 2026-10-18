// Limites de génération : ce que le rédacteur reçoit, ce qu'il peut dépenser,
// et ce qu'on fait d'une réponse coupée.
//
// Trois défauts mesurés avant ces tests :
//   1. `maxTokens: 900` était écrit en dur pour toutes les sections, alors que
//      plusieurs déclarent un plafond de 620 à 920 mots. Une section plafonnée à
//      920 mots ne tient pas dans 900 tokens : la réponse revenait coupée au
//      milieu du JSON, le parsing échouait, et le dossier entier était perdu.
//   2. Le budget de la SECTION était répété à chaque appel de BLOC (8 blocs de
//      `next_weeks` recevaient chacun « environ 320 mots, jamais plus de 620 »),
//      ce qui autorisait 8 × 620 mots et poussait au remplissage.
//   3. Une troncature n'était vue qu'au parsing, sous le code trompeur
//      `structured_parse_error`, et rien ne distinguait « le modèle a déraillé »
//      de « on lui a coupé la parole ».
//
// Aucun test ici n'exige une longueur : la règle éditoriale est que la matière
// commande, pas le quota.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import {
  blockLengthBudget,
  countWords,
  isTruncatedCompletion,
  lengthReport,
  maxTokensForBlock,
  MAX_BLOCK_OUTPUT_TOKENS,
  MIN_BLOCK_OUTPUT_TOKENS,
  worstCaseOutputTokens
} from "../src/deliverables/generationLimits.mjs";
import {
  buildStructuredSystemPrompt,
  writeStructuredSectionWithLlm
} from "../src/deliverables/structuredSectionWriter.mjs";

const LIEU = {
  birthPlace: "Lyon, France",
  placeName: "Lyon, France",
  country: "FR",
  latitude: 45.764,
  longitude: 4.8357,
  timeZone: "Europe/Paris",
  coordinateSource: "user_provided",
  coordinateConfidence: "unverified"
};

function planDuThemes() {
  const calculation = calculateWesternNatalChart(
    {
      personId: "demo-limites",
      birthDate: "1979-03-14",
      timePrecision: "approximate",
      timeValue: "09:00",
      timeMarginMinutes: 30,
      ...LIEU
    },
    { calculatedAt: "2026-10-18T00:00:00.000Z", runId: "calc_limites" }
  );
  const dossierEvidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
  return { dossierEvidence, plan: buildFullDossierPlan(dossierEvidence) };
}

function sectionDuPlan(plan, sectionId) {
  return plan.sections.find((section) => section.sectionId === sectionId);
}

// ---------------------------------------------------------------------------
// 1. Budget d'un bloc : la part, pas le tout
// ---------------------------------------------------------------------------

test("le budget d'un bloc est la part de la section, jamais la section entière", () => {
  const monoBloc = { targetWords: 380, maxWords: 680, blockPlans: [{ blockId: "block1" }] };
  const huitBlocs = {
    targetWords: 320,
    maxWords: 620,
    blockPlans: Array.from({ length: 8 }, (_, index) => ({ blockId: `block${index + 1}` }))
  };

  const budgetMono = blockLengthBudget({ sectionPlan: monoBloc, blockPlan: monoBloc.blockPlans[0] });
  assert.equal(budgetMono.blockCount, 1);
  assert.equal(budgetMono.targetWords, 380);
  assert.equal(budgetMono.maxWords, 680);

  const budgetHuit = blockLengthBudget({ sectionPlan: huitBlocs, blockPlan: huitBlocs.blockPlans[0] });
  assert.equal(budgetHuit.blockCount, 8);
  assert.equal(budgetHuit.targetWords, 40);
  assert.equal(budgetHuit.maxWords, 78);
  // La somme des plafonds de blocs reste dans l'ordre de grandeur de la section.
  assert.ok(budgetHuit.maxWords * 8 <= huitBlocs.maxWords + 8);
});

test("la phrase que le serveur ajoute est retirée du budget du bloc", () => {
  const section = { targetWords: 420, maxWords: 760, blockPlans: [{ blockId: "block1" }] };
  const avecPrefixe = {
    blockId: "block1",
    deterministicPrefix: "La Lune forme une opposition avec Saturne. Cette configuration se lit comme un point d'appui."
  };
  const budget = blockLengthBudget({ sectionPlan: section, blockPlan: avecPrefixe });
  assert.ok(budget.prefixWords >= 12, `préfixe compté (${budget.prefixWords} mots)`);
  assert.equal(budget.targetWords, 420 - budget.prefixWords);
  assert.equal(budget.maxWords, 760 - budget.prefixWords);
});

// ---------------------------------------------------------------------------
// 2. Plafond de tokens : dérivé, borné, jamais 900 par défaut
// ---------------------------------------------------------------------------

test("le plafond de tokens est dérivé du budget du bloc et borné", () => {
  assert.equal(maxTokensForBlock({ maxWords: 0 }), MIN_BLOCK_OUTPUT_TOKENS);
  assert.equal(maxTokensForBlock({ maxWords: 40 }), MIN_BLOCK_OUTPUT_TOKENS);
  assert.equal(maxTokensForBlock({ maxWords: 680 }), 1560);
  assert.equal(maxTokensForBlock({ maxWords: 100000 }), MAX_BLOCK_OUTPUT_TOKENS);
});

test("sur le thème de référence, les sections longues dépassent l'ancien plafond de 900", () => {
  const { plan } = planDuThemes();
  const communication = sectionDuPlan(plan, "communication");
  const budget = blockLengthBudget({
    sectionPlan: communication,
    blockPlan: communication.blockPlans[0]
  });
  const plafond = maxTokensForBlock(budget);
  assert.ok(plafond > 900, `un plafond de 900 tokens ne suffisait pas (${plafond} requis)`);
  assert.ok(plafond <= MAX_BLOCK_OUTPUT_TOKENS);
});

test("la dépense théorique d'un dossier est bornée par le nombre de blocs", () => {
  const { plan } = planDuThemes();
  const blocsEcrivables = plan.sections.reduce((total, section) => {
    const ecrit = (section.blockPlans ?? []).length > 0;
    return total + (ecrit ? (section.blockPlans ?? []).length : 0);
  }, 0);
  const total = plan.sections.reduce((somme, section) => somme + worstCaseOutputTokens(section), 0);
  assert.ok(blocsEcrivables > 0);
  assert.ok(total > 0);
  assert.ok(
    total <= blocsEcrivables * MAX_BLOCK_OUTPUT_TOKENS,
    `dépense théorique ${total} au-delà du plafond dur`
  );
});

// ---------------------------------------------------------------------------
// 3. Le prompt : un plafond, pas un quota
// ---------------------------------------------------------------------------

test("le prompt ne répète plus l'objectif de la section à chaque bloc", () => {
  const { plan } = planDuThemes();
  const identity = sectionDuPlan(plan, "identity");
  assert.equal(identity.blockPlans.length, 2, "identité doit avoir deux blocs sur ce thème");

  const prompt = buildStructuredSystemPrompt(identity, {
    blockCount: 2,
    blockPlan: identity.blockPlans[0]
  });
  // « environ 480 mots » était la cible de la SECTION ; elle ne doit plus
  // apparaître telle quelle dans un prompt de bloc.
  assert.doesNotMatch(prompt, /environ 480 mots/i);
  assert.doesNotMatch(prompt, /jamais plus de 820/i);
  assert.match(prompt, /Budget de longueur pour ce bloc : au plus 410 mots/i);
});

test("le prompt fait dépendre la longueur des preuves, pas d'un quota", () => {
  const { plan } = planDuThemes();
  const communication = sectionDuPlan(plan, "communication");
  const prompt = buildStructuredSystemPrompt(communication, {
    blockCount: 1,
    blockPlan: communication.blockPlans[0]
  });
  assert.match(prompt, /Ce budget est un plafond, jamais un objectif à atteindre/i);
  assert.match(prompt, /La richesse du contenu dépend des preuves transmises, pas d'un quota de mots/i);
  assert.match(prompt, /arrête-toi plus tôt/i);
  assert.match(prompt, /N'ajoute jamais un fait, une généralité, une transition ni une phrase de remplissage/i);
});

test("la consigne relationnelle de concision ne contredit plus un objectif de mots", () => {
  // Les sections relationnelles portent « Aucune longueur minimale : une phrase
  // courte suffit » ; la consigne générique disait « Longueur cible : environ 260
  // mots ». Les deux ne pouvaient pas être vrais ensemble.
  const planRelationnel = {
    sectionId: "relational_communication",
    objective: "Décrire la communication en relation.",
    targetWords: 260,
    maxWords: 460,
    blockPlans: [{ blockId: "spontaneous_dynamic" }],
    writerGuidance: [
      "Aucune longueur minimale : une phrase courte suffit lorsqu'elle couvre correctement le thème transmis.",
      "N'ajoute jamais une phrase uniquement pour remplir."
    ]
  };
  const prompt = buildStructuredSystemPrompt(planRelationnel, {
    blockCount: 1,
    blockPlan: planRelationnel.blockPlans[0]
  });
  assert.match(prompt, /Aucune longueur minimale/i);
  assert.match(prompt, /au plus 460 mots \(repère indicatif : 260\)/i);
  assert.match(prompt, /plafond, jamais un objectif/i);
  assert.doesNotMatch(prompt, /Longueur cible : environ/i);
});

// ---------------------------------------------------------------------------
// 4. Réponse coupée : reconnue avant le parsing, une seule tentative
// ---------------------------------------------------------------------------

function fausseReponse({ contenu, finishReason = "stop", maxTokensVus = null, appels = { n: 0 } }) {
  return async (url, init) => {
    appels.n += 1;
    if (maxTokensVus) maxTokensVus.push(JSON.parse(init.body).max_tokens);
    return {
      ok: true,
      headers: { get: () => "req-test" },
      json: async () => ({
        choices: [{ message: { content: contenu }, finish_reason: finishReason }],
        usage: { prompt_tokens: 100, completion_tokens: 42, total_tokens: 142 }
      })
    };
  };
}

const CONFIG = (fetchFn) => ({
  apiKey: "test-only-key",
  baseUrl: "https://example.invalid",
  model: "modele-de-test",
  fetchFn
});

const sectionValide = (sectionId, blockId, text, contractVersion = "structured-section-writer@0.1.0") =>
  JSON.stringify({
    sectionId,
    contractVersion,
    blocks: [{ blockId, text }]
  });

test("une réponse marquée coupée par le fournisseur est refusée avant tout parsing", async () => {
  const { dossierEvidence, plan } = planDuThemes();
  const communication = sectionDuPlan(plan, "communication");
  const appels = { n: 0 };
  // JSON parfaitement valide : seul `finish_reason` dit qu'il est incomplet.
  const fetchFn = fausseReponse({
    contenu: sectionValide("communication", "block1", "Un texte court et complet."),
    finishReason: "length",
    appels
  });

  await assert.rejects(
    writeStructuredSectionWithLlm({
      dossierEvidence,
      sectionPlan: communication,
      options: { config: CONFIG(fetchFn), logger: { warn() {} } }
    }),
    (error) => {
      assert.equal(error.code, "structured_response_truncated");
      assert.equal(error.sectionId, "communication");
      assert.equal(error.blockId, "block1");
      assert.equal(error.finishReason, "length");
      assert.ok(error.maxTokens >= 300);
      return true;
    }
  );
  // Aucune boucle de correction sur une coupure : rejouer donnerait la même.
  assert.equal(appels.n, 1, "une réponse coupée ne doit pas être rejouée");
});

test("un JSON laissé ouvert est reconnu comme tronqué sans parsing", async () => {
  const { dossierEvidence, plan } = planDuThemes();
  const communication = sectionDuPlan(plan, "communication");
  const appels = { n: 0 };
  const fetchFn = fausseReponse({
    contenu: '{"sectionId":"communication","contractVersion":"structured-section-writer@0.1.0","blocks":[{"blockId":"block1","text":"Votre Mercure',
    finishReason: null,
    appels
  });

  await assert.rejects(
    writeStructuredSectionWithLlm({
      dossierEvidence,
      sectionPlan: communication,
      options: { config: CONFIG(fetchFn), logger: { warn() {} } }
    }),
    (error) => error.code === "structured_response_truncated"
  );
  assert.equal(appels.n, 1);
});

test("le même diagnostic vaut pour un rédacteur injecté renvoyant un JSON coupé", async () => {
  const { dossierEvidence, plan } = planDuThemes();
  const communication = sectionDuPlan(plan, "communication");
  let appels = 0;
  await assert.rejects(
    writeStructuredSectionWithLlm({
      dossierEvidence,
      sectionPlan: communication,
      options: {
        logger: { warn() {} },
        structuredWriterFn: async () => {
          appels += 1;
          return '{"sectionId":"communication","blocks":[{"blockId":"block1","text":"Votre Mercure en Bélier';
        }
      }
    }),
    (error) => error.code === "structured_response_truncated"
  );
  assert.equal(appels, 1);
});

// ---------------------------------------------------------------------------
// 5. Réponses courtes, longues, complètes : mesurées, jamais punies
// ---------------------------------------------------------------------------

test("une réponse courte et complète est acceptée, et sa longueur est mesurée", async () => {
  const { dossierEvidence, plan } = planDuThemes();
  const communication = sectionDuPlan(plan, "communication");
  const fetchFn = fausseReponse({
    contenu: sectionValide("communication", "block1", "Cette partie reste brève, faute de matière transmise.")
  });
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan: communication,
    options: { config: CONFIG(fetchFn), logger: { warn() {} } }
  });
  assert.equal(written.validation.ok, true);
  assert.ok(written.words >= 8 && written.words <= 12, `${written.words} mots comptés`);
  assert.equal(written.length.status, "short");
  assert.equal(written.length.targetWords, 380);
});

test("une réponse plus longue que le plafond est acceptée et signalée, pas rejetée", async () => {
  const { dossierEvidence, plan } = planDuThemes();
  const communication = sectionDuPlan(plan, "communication");
  const texteLong = Array.from({ length: 700 }, (_, index) => `mot${index}`).join(" ");
  const fetchFn = fausseReponse({
    contenu: sectionValide("communication", "block1", texteLong)
  });
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan: communication,
    options: { config: CONFIG(fetchFn), logger: { warn() {} } }
  });
  assert.equal(written.validation.ok, true);
  assert.equal(written.words, 700);
  assert.equal(written.length.status, "over");
});

test("chaque appel envoie le plafond calculé pour SON bloc", async () => {
  const { dossierEvidence, plan } = planDuThemes();
  const identity = sectionDuPlan(plan, "identity");
  const plafonds = [];
  let bloc = 0;
  const fetchFn = async (url, init) => {
    plafonds.push(JSON.parse(init.body).max_tokens);
    const blockPlan = identity.blockPlans[bloc] ?? identity.blockPlans[0];
    bloc += 1;
    return {
      ok: true,
      headers: { get: () => null },
      json: async () => ({
        choices: [
          {
            message: {
              content: sectionValide("identity", blockPlan.blockId, "Ce bloc reste bref.")
            },
            finish_reason: "stop"
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      })
    };
  };

  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan: identity,
    options: { config: CONFIG(fetchFn), logger: { warn() {} } }
  });

  assert.equal(written.validation.ok, true);
  assert.equal(plafonds.length, identity.blockPlans.length);
  for (const plafond of plafonds) {
    assert.ok(plafond < 1840, `plafond non divisé : ${plafond}`);
    assert.ok(plafond >= MIN_BLOCK_OUTPUT_TOKENS);
    assert.ok(plafond <= MAX_BLOCK_OUTPUT_TOKENS);
  }
});

// ---------------------------------------------------------------------------
// 6. Primitives
// ---------------------------------------------------------------------------

test("countWords ignore la ponctuation isolée", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("  trois   mots  "), 2);
  assert.equal(countWords("Un mot — et un autre."), 5);
});

test("la détection de troncature ne confond pas un texte libre avec une coupure", () => {
  assert.equal(isTruncatedCompletion({ finishReason: "stop", text: "Texte libre." }), false);
  assert.equal(isTruncatedCompletion({ finishReason: "stop", text: '{"a":1}' }), false);
  assert.equal(isTruncatedCompletion({ finishReason: "length", text: '{"a":1}' }), true);
  assert.equal(isTruncatedCompletion({ finishReason: null, text: '{"a":1' }), true);
  assert.equal(isTruncatedCompletion({ finishReason: null, text: '```json\n{"a":1}\n```' }), false);
  assert.equal(isTruncatedCompletion({ finishReason: null, text: '{"a":"guillemet \\" échappé"}' }), false);
});

test("le rapport de longueur ne classe pas une section sans repère comme courte", () => {
  assert.equal(lengthReport({ text: "Un.", targetWords: 0, maxWords: 0 }).status, "in_range");
  assert.equal(lengthReport({ text: "Un deux.", targetWords: 200, maxWords: 400 }).status, "short");
  assert.equal(lengthReport({ text: Array.from({ length: 60 }, () => "mot").join(" "), targetWords: 20, maxWords: 40 }).status, "over");
});
