import { formatFrenchCalendarDate } from "./calendarDates.mjs";
import { evidenceById } from "./dossierEvidence.mjs";
import {
  blockCountOf,
  blockLengthBudget,
  isTruncatedCompletion,
  lengthReport,
  maxTokensForBlock,
  worstCaseOutputTokens
} from "./generationLimits.mjs";
import { interpretationRuleById, ruleMatchesEvidence } from "./interpretationRules.mjs";
import { sectionPlanById } from "./fullDossierPlan.mjs";
import { callChatCompletions, llmConfiguration } from "./writers.mjs";
import { expandStructuredSectionFromPackets, validateStructuredSection } from "./factualClaimsValidator.mjs";

export const STRUCTURED_WRITER_CONTRACT_VERSION = "structured-section-writer@0.1.0";
// All narrative sections use the configured production model. No hidden tier.
export const STRUCTURED_SECTION_MODEL_OVERRIDES = Object.freeze({});
const MAX_CORRECTION_ATTEMPTS = 2;

const BODY_FR = Object.freeze({
  Sun: "Soleil",
  Moon: "Lune",
  Mercury: "Mercure",
  Venus: "Vénus",
  Mars: "Mars",
  Jupiter: "Jupiter",
  Saturn: "Saturne"
});

const BODY_SUBJECT_FR = Object.freeze({
  Sun: "Le Soleil",
  Moon: "La Lune",
  Mercury: "Mercure",
  Venus: "Vénus",
  Mars: "Mars",
  Jupiter: "Jupiter",
  Saturn: "Saturne"
});

const SIGN_FR = Object.freeze({
  Aries: "Bélier",
  Taurus: "Taureau",
  Gemini: "Gémeaux",
  Cancer: "Cancer",
  Leo: "Lion",
  Virgo: "Vierge",
  Libra: "Balance",
  Scorpio: "Scorpion",
  Sagittarius: "Sagittaire",
  Capricorn: "Capricorne",
  Aquarius: "Verseau",
  Pisces: "Poissons"
});

const ASPECT_FR = Object.freeze({
  conjunction: "conjonction",
  opposition: "opposition",
  square: "carré",
  trine: "trigone",
  sextile: "sextile"
});

const ASPECT_WITH_ARTICLE_FR = Object.freeze({
  conjunction: "une conjonction",
  opposition: "une opposition",
  square: "un carré",
  trine: "un trigone",
  sextile: "un sextile"
});

function formatFrenchDate(dateLike) {
  const date = dateLike ? new Date(dateLike) : null;
  if (!date || Number.isNaN(date.getTime())) return "l'instant de référence";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function block({ blockId, text, evidenceRefs, interpretationRuleRefs, claims = [], interpretationDepth = "primary" }) {
  return { blockId, text, evidenceRefs, interpretationRuleRefs, claims, interpretationDepth };
}

function findEvidence(dossierEvidence, id) {
  return evidenceById(dossierEvidence).get(id) ?? null;
}

function firstTheme(ruleId) {
  return interpretationRuleById(ruleId)?.themes?.[0] ?? "";
}

function claimForEvidence(evidence, claimId) {
  const value = evidence?.value ?? {};
  if (evidence?.type === "NATAL_BODY_SIGN") {
    return { claimId, type: "NATAL_BODY_SIGN", body: value.body, sign: value.sign, evidenceRefs: [evidence.evidenceId] };
  }
  if (evidence?.type === "NATAL_ASPECT") {
    return { claimId, type: "NATAL_ASPECT", bodyA: value.bodyA, bodyB: value.bodyB, aspectType: value.aspectType, evidenceRefs: [evidence.evidenceId] };
  }
  if (evidence?.type === "PERSONAL_TRANSIT") {
    return {
      claimId,
      type: "PERSONAL_TRANSIT",
      transitBody: value.transitBody,
      natalPoint: value.natalPoint,
      aspectType: value.aspectType,
      exactAt: value.exactAt,
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      phase: value.phase,
      evidenceRefs: [evidence.evidenceId]
    };
  }
  return null;
}

function ruleRefForEvidence(evidence, preferred = null) {
  if (preferred) return preferred;
  return null;
}

function makeIdentity(dossierEvidence) {
  const sun = findEvidence(dossierEvidence, "natal.sun.sign");
  const ruleId = ruleRefForEvidence(sun, `western.body.sun.sign.${String(sun?.value?.sign ?? "").toLowerCase()}@1`);
  return {
    sectionId: "identity",
    contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
    blocks: [
      block({
        blockId: "identity.sun",
        text: `Votre Soleil en ${SIGN_FR[sun.value.sign]} donne un axe d'identité orienté vers ${firstTheme(ruleId)}. Cette lecture reste attachée au fait calculé, sans en faire une définition fermée de votre personnalité.`,
        evidenceRefs: [sun.evidenceId],
        interpretationRuleRefs: [ruleId],
        claims: [claimForEvidence(sun, "identity.sun.sign")]
      })
    ]
  };
}

function makeEmotionalWorld(dossierEvidence) {
  const moon = findEvidence(dossierEvidence, "natal.moon.sign");
  const aspect = findEvidence(dossierEvidence, "aspect.moon.mercury.square");
  const moonRule = `western.body.moon.sign.${String(moon?.value?.sign ?? "").toLowerCase()}@1`;
  const aspectRule = "western.aspect.moon_mercury.square@1";
  return {
    sectionId: "emotional_world",
    contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
    blocks: [
      block({
        blockId: "emotional.moon",
        text: `Votre Lune en ${SIGN_FR[moon.value.sign]} indique un monde émotionnel sensible à ${firstTheme(moonRule)}.`,
        evidenceRefs: [moon.evidenceId],
        interpretationRuleRefs: [moonRule],
        claims: [claimForEvidence(moon, "emotional.moon.sign")]
      }),
      block({
        blockId: "emotional.moon-mercury",
        text: `Le carré entre votre Lune et Mercure décrit ${firstTheme(aspectRule)}. Le texte ne transforme pas cet aspect en diagnostic : il indique seulement une dynamique symbolique à articuler.`,
        evidenceRefs: [aspect.evidenceId],
        interpretationRuleRefs: [aspectRule],
        claims: [claimForEvidence(aspect, "emotional.aspect.moon_mercury")]
      })
    ]
  };
}

function makeGeneralSynthesis(dossierEvidence) {
  const sun = findEvidence(dossierEvidence, "natal.sun.sign");
  const moon = findEvidence(dossierEvidence, "natal.moon.sign");
  return {
    sectionId: "general_synthesis",
    contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
    blocks: [
      block({
        blockId: "synthesis.sun-reference",
        text: `La synthèse retient votre Soleil en ${SIGN_FR[sun.value.sign]} comme repère global, sans reprendre ici son interprétation principale.`,
        evidenceRefs: [sun.evidenceId],
        interpretationRuleRefs: ["western.body.sun.sign.capricorn@1"],
        interpretationDepth: "reference",
        claims: [claimForEvidence(sun, "synthesis.sun.sign")]
      }),
      block({
        blockId: "synthesis.moon-reference",
        text: `La synthèse retient aussi votre Lune en ${SIGN_FR[moon.value.sign]} comme second repère global, son interprétation détaillée restant dans le chapitre Monde émotionnel.`,
        evidenceRefs: [moon.evidenceId],
        interpretationRuleRefs: ["western.body.moon.sign.libra@1"],
        interpretationDepth: "reference",
        claims: [claimForEvidence(moon, "synthesis.moon.sign")]
      })
    ]
  };
}

function makeCurrentSky(dossierEvidence) {
  const byId = evidenceById(dossierEvidence);
  const snapshot = byId.get("transits.snapshot");
  const transit = [...byId.values()].find((item) => item.type === "PERSONAL_TRANSIT");
  const value = transit?.value ?? {};
  const ruleId = value.transitBody === "Jupiter" && value.natalPoint === "Sun" && value.aspectType === "square"
    ? "western.transit.jupiter_sun.square@1"
    : null;
  const blocks = [
    block({
      blockId: "current-sky.snapshot",
      text: `Ciel calculé le ${formatFrenchDate(snapshot.value.nowUtc)}, horizon ${snapshot.value.horizonDays} jours. Les transits présentés sont une sélection de repères calculés sur cette fenêtre, non une prévision exhaustive. Cette partie du PDF est un instantané daté, pas une page dynamique.`,
      evidenceRefs: [snapshot.evidenceId],
      interpretationRuleRefs: ["western.current_sky.snapshot@1"],
      interpretationDepth: "reference",
      claims: []
    })
  ];
  if (transit && ruleId) {
    blocks.push(
      block({
        blockId: "current-sky.transit",
        text: `${BODY_SUBJECT_FR[value.transitBody] ?? BODY_FR[value.transitBody] ?? value.transitBody} forme ${ASPECT_WITH_ARTICLE_FR[value.aspectType] ?? `un ${ASPECT_FR[value.aspectType] ?? value.aspectType}`} à votre ${BODY_FR[value.natalPoint] ?? value.natalPoint}, exact le ${formatFrenchDate(value.exactAt)}. Le thème autorisé est ${firstTheme(ruleId)}.`,
        evidenceRefs: [transit.evidenceId],
        interpretationRuleRefs: [ruleId],
        claims: [claimForEvidence(transit, "current_sky.jupiter_sun")]
      })
    );
  }
  return {
    sectionId: "current_sky",
    contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
    blocks
  };
}

export function generatePilotSections({ dossierEvidence, fullDossierPlan }) {
  const sections = [makeGeneralSynthesis(dossierEvidence), makeIdentity(dossierEvidence), makeEmotionalWorld(dossierEvidence), makeCurrentSky(dossierEvidence)];
  // Cheap internal guard: every rule emitted by the deterministic prototype must
  // be allowed by the plan and match at least one referenced evidence item.
  const byId = evidenceById(dossierEvidence);
  for (const section of sections) {
    const plan = sectionPlanById(fullDossierPlan, section.sectionId);
    for (const item of section.blocks) {
      for (const ruleId of item.interpretationRuleRefs ?? []) {
        const rule = interpretationRuleById(ruleId);
        const allowed = plan?.allowedInterpretationRuleRefs?.includes(ruleId);
        const matches = (item.evidenceRefs ?? []).some((ref) => ruleMatchesEvidence(rule, byId.get(ref)));
        if (!allowed || !matches) {
          throw new Error(`Pilot writer emitted unauthorized rule ${ruleId} in ${section.sectionId}`);
        }
      }
    }
  }
  return {
    schema: "astrolab.full_dossier.pilot_sections",
    contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
    llmCalls: 0,
    sections
  };
}

function compactEvidenceForPrompt(dossierEvidence, refs = []) {
  const byId = evidenceById(dossierEvidence);
  return refs
    .map((ref) => byId.get(ref))
    .filter(Boolean)
    .map((item) => ({
      evidenceId: item.evidenceId,
      type: item.type,
      value: item.value,
      provenance: {
        methodVersion: item.provenance?.methodVersion ?? null,
        ruleVersion: item.provenance?.ruleVersion ?? null,
        reliability: item.provenance?.reliability ?? null
      }
    }));
}

function rulesForPrompt(ruleIds = []) {
  return ruleIds
    .map((ruleId) => interpretationRuleById(ruleId))
    .filter(Boolean)
    .map((rule) => ({
      ruleId: rule.ruleId,
      evidenceType: rule.evidenceType,
      match: rule.match,
      themes: rule.themes,
      forbidden: rule.forbidden
    }));
}

function stripJsonFences(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseJsonObject(text) {
  try {
    return JSON.parse(stripJsonFences(text));
  } catch (error) {
    const wrapped = new Error(`Structured writer returned invalid JSON: ${error.message}`);
    wrapped.status = 502;
    wrapped.cause = error;
    throw wrapped;
  }
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter((entry) => entry !== null && entry !== undefined) : [];
}

function sanitizeStructuredSection(section, sectionPlan) {
  return {
    sectionId: String(section?.sectionId ?? sectionPlan.sectionId),
    contractVersion: String(section?.contractVersion ?? STRUCTURED_WRITER_CONTRACT_VERSION),
    blocks: normalizeArray(section?.blocks).map((block, index) => ({
      blockId: String(block?.blockId ?? `${sectionPlan.sectionId}.${index + 1}`),
      text: String(block?.text ?? "").trim()
    }))
  };
}

const TEMPORAL_REWORDING_PATTERN =
  /\b(?:prévu|prevu|à venir|a venir|se produira|sera exact|va être exact|va etre exact|deviendra exact|a été exact|a ete exact|était exact|etait exact|est exact|exactitude|fenêtre d'orbe|fenetre d'orbe|applying|separating|stationary|indeterminate)\b/i;

const DATE_REWORDING_PATTERN =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+\d{4})?)\b/i;

function splitSentences(text) {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function sanitizeTemporalRewording(text) {
  return splitSentences(text)
    .filter((sentence) => !TEMPORAL_REWORDING_PATTERN.test(sentence) && !DATE_REWORDING_PATTERN.test(sentence))
    .join(" ")
    .trim();
}

function applyDeterministicPrefix(section, blockPlan) {
  const prefix = String(blockPlan?.deterministicPrefix ?? "").trim();
  if (!prefix) return section;
  return {
    ...section,
    blocks: (section.blocks ?? []).map((item) => {
      if (item.blockId !== blockPlan.blockId) return item;
      const text = sanitizeTemporalRewording(item.text);
      if (!text) return { ...item, text: prefix };
      if (text.startsWith(prefix)) return item;
      return { ...item, text: `${prefix}\n\n${text}` };
    })
  };
}

function mergeSectionBlocks(baseSection, patchSection, sectionPlan) {
  if (!baseSection) return patchSection;
  const patchById = new Map((patchSection?.blocks ?? []).map((block) => [block.blockId, block]));
  const knownIds = new Set((sectionPlan.blockPlans ?? []).map((blockPlan) => blockPlan.blockId));
  const mergedKnown = (baseSection.blocks ?? []).map((block) => (patchById.has(block.blockId) ? patchById.get(block.blockId) : block));
  const extra = (patchSection?.blocks ?? []).filter((block) => !knownIds.has(block.blockId) && !(baseSection.blocks ?? []).some((oldBlock) => oldBlock.blockId === block.blockId));
  return {
    ...baseSection,
    blocks: [...mergedKnown, ...extra]
  };
}

function unique(values = []) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

// Exportés pour l'outil d'estimation de coût : il doit composer EXACTEMENT les
// mêmes invites que le rédacteur, sinon l'estimation ne vaut rien.
export function scopedSectionPlanForBlock(sectionPlan, blockPlan) {
  const packetRefs = new Set(blockPlan?.packetRefs ?? []);
  const evidencePackets = (sectionPlan?.evidencePackets ?? []).filter((packet) => packetRefs.has(packet.packetId));
  const evidenceRefs = unique(evidencePackets.flatMap((packet) => packet.evidenceRefs ?? []));
  const ruleRefs = unique(evidencePackets.flatMap((packet) => packet.interpretationRuleRefs ?? []));
  return {
    ...sectionPlan,
    // Numerical budget metadata only: no packets from other blocks.
    recallBudget: sectionPlan.recallBudget ?? {
      count: (sectionPlan.blockPlans ?? []).filter((block) => block.blockId === "brief_recall").length,
      targetWords: (sectionPlan.blockPlans ?? []).filter((block) => block.blockId === "brief_recall").reduce((n, block) => n + block.targetWords, 0),
      maxWords: (sectionPlan.blockPlans ?? []).filter((block) => block.blockId === "brief_recall").reduce((n, block) => n + block.maxWords, 0)
    },
    primaryEvidenceRefs: (sectionPlan?.primaryEvidenceRefs ?? []).filter((ref) => evidenceRefs.includes(ref)),
    secondaryEvidenceRefs: (sectionPlan?.secondaryEvidenceRefs ?? []).filter((ref) => evidenceRefs.includes(ref)),
    forbiddenEvidenceRefs: [],
    allowedInterpretationRuleRefs: ruleRefs,
    alreadyInterpretedEvidenceRefs: (sectionPlan?.alreadyInterpretedEvidenceRefs ?? []).filter((ref) => evidenceRefs.includes(ref)),
    evidencePackets,
    blockPlans: [blockPlan],
    preconditions: sectionPlan?.preconditions ?? []
  };
}

function deterministicTextForBlock(scopedPlan, blockPlan) {
  const packet = (scopedPlan.evidencePackets ?? []).find((entry) => (blockPlan.packetRefs ?? []).includes(entry.packetId));
  const snapshot = (packet?.claims ?? []).find((claim) => claim.type === "TRANSIT_SNAPSHOT");
  if (snapshot) {
    const nowUtc = snapshot.nowUtc
      ? formatFrenchCalendarDate(snapshot.nowUtc, scopedPlan.referenceTimeZone ?? "UTC")
      : "l'instant de référence";
    const horizonDays = Number.isFinite(Number(snapshot.horizonDays)) ? Number(snapshot.horizonDays) : 42;
    return `Ciel calculé le ${nowUtc}, horizon ${horizonDays} jours. Les transits présentés sont une sélection de repères calculés sur cette fenêtre, non une prévision exhaustive.`;
  }
  return "Ce bloc est calculé automatiquement à partir des faits disponibles.";
}

function blockById(section, blockId) {
  if (!blockId) return null;
  return (section?.blocks ?? []).find((block) => block.blockId === blockId) ?? null;
}

function claimById(section, claimId) {
  if (!claimId) return null;
  for (const block of section?.blocks ?? []) {
    const claim = (block.claims ?? []).find((item) => item.claimId === claimId);
    if (claim) return claim;
  }
  return null;
}

function blockForIssue(section, issue) {
  const direct = blockById(section, issue?.blockId);
  if (direct || !issue?.claimId) return direct;
  return (section?.blocks ?? []).find((block) => (block.claims ?? []).some((claim) => claim.claimId === issue.claimId)) ?? null;
}

function claimShapeHelp(issue) {
  if (issue?.code === "unknown_packet_ref") {
    return "Use only blockId values copied exactly from the authorized BlockPlan.";
  }
  if (issue?.code === "undeclared_text_fact") {
    return "Remove the unsupported factual phrase from the text; packets are fixed by the server BlockPlan.";
  }
  return null;
}

function correctionIssuesForPrompt({ validation, section, sectionPlan }) {
  const authorizedBlockPlans = blockPlansForPrompt(sectionPlan);
  return (validation?.issues ?? []).map((issue) => {
    const block = blockForIssue(section, issue);
    const claim = claimById(section, issue.claimId);
    return {
      code: issue.code,
      message: issue.message,
      blockId: issue.blockId ?? block?.blockId ?? null,
      claimId: issue.claimId ?? null,
      evidenceRef: issue.evidenceRef ?? null,
      ruleId: issue.ruleId ?? null,
      fact: issue.fact ?? null,
      factText: factDescription(issue.fact),
      expectedHint: claimShapeHelp(issue),
      authorizedBlockPlans,
      block: block
        ? {
            textFragment: block.text.slice(0, 320),
            blockId: block.blockId
          }
        : null,
      claim: claim ?? null
    };
  });
}

function validationErrorCodes(validation) {
  return [...new Set((validation?.issues ?? []).map((issue) => issue.code).filter(Boolean))];
}

function sentenceLimitWarnings(validation) {
  return (validation?.warnings ?? []).filter((warning) => warning.code === "block_sentence_limit_exceeded");
}

// Deliberately exclude prose, messages, dates, evidence IDs and input data.
// --- Faits refusés, en français -------------------------------------------
// Le journal affichait `fact: [Object]` : impossible de savoir QUEL fait avait
// été refusé, donc impossible de corriger la cause. Ces deux fonctions donnent
// une forme lisible, utilisée dans les journaux ET dans la consigne de
// correction envoyée au modèle.

const FACT_BODY_FR = {
  Sun: "le Soleil", Moon: "la Lune", Mercury: "Mercure", Venus: "Vénus", Mars: "Mars",
  Jupiter: "Jupiter", Saturn: "Saturne", Uranus: "Uranus", Neptune: "Neptune", Pluto: "Pluton",
  Chiron: "Chiron", NorthNode: "le Nœud Nord", SouthNode: "le Nœud Sud"
};
const FACT_SIGN_FR = {
  Aries: "Bélier", Taurus: "Taureau", Gemini: "Gémeaux", Cancer: "Cancer", Leo: "Lion", Virgo: "Vierge",
  Libra: "Balance", Scorpio: "Scorpion", Sagittarius: "Sagittaire", Capricorn: "Capricorne",
  Aquarius: "Verseau", Pisces: "Poissons"
};
const FACT_ANGLE_FR = { ascendant: "l'Ascendant", descendant: "le Descendant", midheaven: "le Milieu du ciel" };
const FACT_ASPECT_FR = {
  conjunction: "en conjonction", opposition: "en opposition", trine: "en trigone",
  square: "en carré", sextile: "en sextile", quincunx: "en quinconce"
};

function factDescription(fact) {
  if (!fact) return null;
  const body = (value) => FACT_BODY_FR[value] ?? String(value);
  const sign = (value) => FACT_SIGN_FR[value] ?? String(value);
  if (fact.type === "NATAL_BODY_SIGN") return `${body(fact.body)} en ${sign(fact.sign)}`;
  if (fact.type === "NATAL_BODY_HOUSE") {
    return fact.body ? `${body(fact.body)} en maison ${fact.house}` : `la maison ${fact.house}`;
  }
  if (fact.type === "ANGLE_SIGN") return `${FACT_ANGLE_FR[fact.angle] ?? String(fact.angle)} en ${sign(fact.sign)}`;
  if (fact.type === "ASPECT") {
    return `${body(fact.bodyA)} ${FACT_ASPECT_FR[fact.aspectType] ?? `en ${String(fact.aspectType)}`} ${body(fact.bodyB)}`;
  }
  // Type inconnu : on ne renvoie RIEN plutôt que de sérialiser l'objet brut.
  // Le journal a déjà montré qu'un fait brut pouvait transporter des valeurs
  // (dates, orbes) que rien n'oblige à recopier dans les journaux.
  return null;
}

function refusedFactTexts(validation) {
  return [...new Set(
    (validation?.issues ?? [])
      .filter((issue) => issue.severity !== "warning" && issue.fact)
      .map((issue) => factDescription(issue.fact))
      .filter(Boolean)
  )];
}

function stableFactKey(fact) {
  if (!fact) return "";
  return Object.keys(fact).sort().map((key) => `${key}=${String(fact[key])}`).join(",");
}

// Un refus identique d'un essai au suivant ne guérira pas : la consigne envoyée
// est la même, et le fait vient du contexte du bloc, pas d'une formulation
// maladroite. On s'en sert pour arrêter avant un troisième appel payant.
function refusalSignature(validation) {
  const entries = (validation?.issues ?? [])
    .filter((issue) => issue.severity !== "warning")
    .map((issue) => `${issue.code}|${stableFactKey(issue.fact)}`)
    .sort();
  return entries.length > 0 ? entries.join(" · ") : null;
}

function safeValidationFindings(validation, provenance) {
  const safeKeys = ["type", "body", "bodyA", "bodyB", "transitBody", "natalPoint", "aspectType", "sign", "house", "angle", "role"];
  return (validation?.issues ?? []).map((issue) => ({
    code: issue.code,
    provenance,
    ...(issue.rejectedAspects ? {
      detection: issue.provenance,
      aspects: issue.rejectedAspects.map((aspect) => Object.fromEntries(["bodyA", "bodyB", "aspectType"].map((key) => [key, aspect[key]])))
    } : {}),
    fact: issue.fact ? Object.fromEntries(safeKeys.filter((key) => issue.fact[key] !== undefined).map((key) => [key, issue.fact[key]])) : null,
    // Sans cette ligne, le journal d'exploitation affichait `fact: [Object]`.
    factText: factDescription(issue.fact)
  }));
}

function logStructuredValidationFailure({ logger, sectionId, blockId = null, attempt, validation, provenance = "combined_text" }) {
  if (!logger?.warn) return;
  logger.warn("[Lastro] structured section validation failed", {
    sectionId,
    blockId,
    attempt,
    validationErrorCodes: validationErrorCodes(validation),
    findings: safeValidationFindings(validation, provenance)
  });
}

function logStructuredValidationWarnings({ logger, sectionId, blockId = null, attempt, validation }) {
  if (!logger?.warn) return;
  for (const warning of sentenceLimitWarnings(validation)) {
    logger.warn("[Lastro] structured section validation warning", {
      sectionId,
      blockId: warning.blockId ?? blockId,
      attempt,
      validationWarningCode: warning.code,
      sentenceCount: warning.sentenceCount,
      maxSentences: warning.maxSentences
    });
  }
}

function enrichedStructuredSection(section, sectionPlan) {
  const expanded = expandStructuredSectionFromPackets({ section, sectionPlan });
  return expanded.section;
}

function hasWritableMaterial(sectionPlan) {
  // Une section sans bloc n'est pas « écrivable » : c'est le cas des chapitres
  // transformés en annexe de référence. Sans cette garde, le rédacteur
  // retournait une section vide, comptée comme générée.
  if ((sectionPlan?.blockPlans ?? []).length === 0) return false;
  if ((sectionPlan?.blockPlans ?? []).some((blockPlan) => blockPlan.deterministic)) return true;
  return (sectionPlan?.allowedInterpretationRuleRefs ?? []).length > 0 &&
    ((sectionPlan?.primaryEvidenceRefs ?? []).length > 0 || (sectionPlan?.secondaryEvidenceRefs ?? []).length > 0);
}

// La consigne de longueur est un PLAFOND de bloc, jamais un quota de section.
//
// Avant : « Longueur cible: environ 480 mots, jamais plus de 820 » était répété à
// chaque appel de bloc. `next_weeks` (8 blocs) recevait donc huit fois le budget
// de la section entière — et une section courte mais juste était relue comme un
// échec, ce qui poussait au remplissage. Ici : la part du bloc, et une règle
// explicite qui fait dépendre la longueur des preuves disponibles.
function lengthDirective(budget) {
  const lines = [];
  if (budget.maxWords > 0) {
    lines.push(
      `Budget de longueur pour ce bloc : au plus ${budget.maxWords} mots${budget.targetWords > 0 ? ` (repère indicatif : ${budget.targetWords})` : ""}.`
    );
  }
  lines.push("Ce budget est un plafond, jamais un objectif à atteindre.");
  lines.push(
    "La richesse du contenu dépend des preuves transmises, pas d'un quota de mots : si les faits de ce bloc ne suffisent pas, arrête-toi plus tôt."
  );
  lines.push(
    "N'ajoute jamais un fait, une généralité, une transition ni une phrase de remplissage pour atteindre un nombre de mots."
  );
  return lines.join(" ");
}

export function buildStructuredSystemPrompt(sectionPlan, options = {}) {
  const blockIds = (sectionPlan.blockPlans ?? []).map((blockPlan) => blockPlan.blockId).join(", ");
  const blockCount = blockCountOf(sectionPlan, options.blockCount ?? null);
  const blockPlan = options.blockPlan ?? (blockCount === 1 ? sectionPlan.blockPlans?.[0] ?? null : null);
  const budget = blockLengthBudget({ sectionPlan, blockPlan, blockCount });
  return [
    "Tu rédiges un bloc isolé du dossier astrologique Lastro.",
    "Tu dois produire UNIQUEMENT un objet JSON valide, sans Markdown autour.",
    "Tu n'as pas le droit d'inventer un fait astrologique, biographique, psychologique ou prédictif.",
    "Tu ne connais que les packets transmis pour ce bloc. N'utilise aucun autre placement natal, transit, aspect, maison ou angle.",
    "Tu n'écris jamais packetRefs, evidenceRefs, interpretationRuleRefs, claims ni claim.type : le serveur les déduit depuis le BlockPlan.",
    "Tu dois seulement remplir le texte du ou des blockId prévus par ce BlockPlan isolé.",
    "N'invente jamais de blockId.",
    "Développe uniquement la matière interprétable autorisée. N'ajoute jamais de phrase sur un manque de preuves ou de règles : ce diagnostic appartient au serveur.",
    "N'écris pas d'introduction générique ni de mini-conclusion automatique. Chaque phrase doit ajouter une information utile.",
    "Si plusieurs packets décrivent la même dynamique, fusionne-les en un passage cohérent au lieu de les commenter un par un.",
    "Un packet interpretationDepth=reference sert de rappel bref. Exception explicite : sourceRole=licensed_composition_context autorise sa mise en perspective selon la mission du chapitre et les seules relations calculées, sans redévelopper chaque placement séparément.",
    "Les faits canInterpret=false restent des repères factuels ; ils ne demandent ni interprétation sans règle ni commentaire sur le fonctionnement du moteur. Ne parle pas au lecteur des éléments méthodologiques transmis, de packets, de règles disponibles ou de tes données de travail.",
    "Si le BlockPlan fournit deterministicLead, cette phrase factuelle sera ajoutée par le serveur avant ton texte.",
    "Pour ces blocs, n'écris aucune date, ne répète pas la fenêtre temporelle, ne qualifie pas le transit de futur/passé/en cours et n'utilise pas prévu, à venir, sera exact, a été exact, est exact, applying ou separating.",
    "Si deterministicLead contient un aspect, n'emploie aucun vocabulaire géométrique d'aspect dans ton texte : pas de conjonction, opposition, carré, trigone, sextile, aspect exact ou forme un aspect. Cite les planètes seulement pour leur fonction symbolique.",
    "Respecte le vouvoiement, un ton sobre, humain et non fataliste.",
    "Pour une idée dont ce chapitre est propriétaire, explore un dilemme concret et plusieurs façons possibles de le vivre. La prudence porte sur la lecture symbolique, pas sur une répétition du conditionnel : alterne description des symboles, possibilités et situations envisagées ; ne conclus jamais à un trait établi de la personne. Une liste de qualités reformulées ne suffit pas ; précise les limites sans inventer son histoire ; une question n'est jamais obligatoire.",
    "Une interaction reste interdite lorsqu’elle est formulée indirectement : cette harmonie, ces tensions, les dynamiques précédentes. Un pronom ou un renvoi ne crée aucune relation calculée.",
    // Contrat éditorial : ce que le rédacteur reçoit est un matériau, pas un texte.
    "Contrat éditorial : tu reçois des CONCEPTS, une RELATION et des NUANCES — ce sont des matériaux de raisonnement, jamais des phrases à recopier. Construis tes propres formulations à partir d'eux.",
    "Les croisements autorisés figurent dans `editorial.relationsAllowed` : ce sont les seuls. Tu n'en inventes aucun autre ; si un croisement te semble manquer, ne le fabrique pas.",
    "Dans un chapitre de composition, les idées réservées gardent leur développement détaillé dans leur chapitre propriétaire ; cela n’interdit pas d’en dégager le fil conducteur avec les packets licensed_composition_context. Cette composition n’est pas limitée à un rappel d’une phrase.",
    "`editorial.mayRecall` : idées déjà développées dans un chapitre précédent. Tu peux les nommer en une clause au maximum, jamais les redévelopper.",
    "`editorial.reserved` : idées réservées à un chapitre ultérieur. Tu ne les développes pas, même si les faits sont disponibles.",
    "Écris des paragraphes courts, séparés par une ligne vide, chacun centré sur une seule idée. Explique les termes astrologiques indispensables en mots courants. Ne coupe pas artificiellement une idée pour allonger le document.",
    "Adresse-toi au lecteur. N'ouvre pas un paragraphe par « La dynamique entre… », « Cette configuration indique… », « Par ailleurs » ou « Enfin » : chaque paragraphe porte une idée, pas un placement.",
    "Arrête-toi lorsque les idées autorisées sont épuisées, sans ajouter de constat méthodologique, de remplissage ou d'excuse au lecteur.",
    // Chapitre qui explore une figure : plusieurs lectures, jamais un verdict.
    ...(Array.isArray(sectionPlan.readingHypotheses) && sectionPlan.readingHypotheses.length > 0
      ? [
          "Tu explores UNE figure calculée : expose au moins deux lectures possibles de CETTE MÊME figure, et montre ce qui les distingue par un fait du thème — pas par un commentaire de méthode. Ne tranche pas entre elles : laisse-les en tension.",
          "Chaque lecture est licenciée par les faits calculés fournis. Tu ne peux ni en ajouter, ni étendre une ressource à une configuration qui n'appartient pas à la figure.",
          "Interdit explicite : dire qu'un aspect compense, équilibre ou éclaire une configuration que rien ne relie. Si les faits ne le portent pas, tu ne l'écris pas.",
          "Si `editorial.isolation` fournit un décompte, tu peux dire qu'aucun des aspects retenus ne relie la figure aux autres configurations — ce fait est calculé sur l'ensemble, pas sur un échantillon.",
          "N'annonce pas les positions planétaires en ouverture : elles figurent dans l'annexe. Ouvre sur ce que la structure a de particulier.",
          "Signale qu'il s'agit d'une lecture par la formulation elle-même (« une lecture serait… », « on peut aussi lire… »), jamais par un commentaire sur ta méthode.",
          "Ne hiérarchise pas les deux lectures et ne conclus pas : laisse-les ouvertes.",
          "N'écris aucun méta-commentaire sur tes preuves, tes mesures, tes conventions ou tes limites : cela appartient à l'annexe, pas au chapitre.",
          "Une question au lecteur est facultative, jamais une fin de paragraphe automatique. Respecte le budget du bloc et le maximum d’une question sur le chapitre entier."
        ]
      : []),
    `Section: ${sectionPlan.sectionId}. Objectif: ${sectionPlan.objective}.`,
    ...(Array.isArray(sectionPlan.writerGuidance) && sectionPlan.writerGuidance.length > 0
      ? ["Consignes spécifiques:", ...sectionPlan.writerGuidance.map((line) => `- ${line}`)]
      : []),
    `Questions autorisées pour ce bloc : ${blockPlan?.maxQuestions ?? 0}. Maximum une sur le chapitre entier ; aucune question obligatoire.`,
    "N’écris pas « Une question utile serait ». Varie les fins de paragraphe et limite les reprises de pourriez/pourrait ; une phrase descriptive sur un symbole reste prudente sans attribuer un trait au lecteur.",
    `BlockId autorisé: ${blockIds}.`,
    lengthDirective(budget),
    "Schéma attendu: {\"sectionId\":\"...\",\"contractVersion\":\"structured-section-writer@0.1.0\",\"blocks\":[{\"blockId\":\"...\",\"text\":\"...\"}]}"
  ].join("\n");
}

// Sémantique structurée : concepts + relation + nuances quand la règle en
// fournit. Les `themes` (phrases déjà rédigées) ne sont transmis que pour les
// règles anciennes qui n'ont pas encore de sémantique.
function semanticsForPacket(packet) {
  for (const ruleId of packet.interpretationRuleRefs ?? []) {
    const rule = interpretationRuleById(ruleId);
    if (rule?.semantics) return rule.semantics;
  }
  return null;
}

function packetsForPrompt(sectionPlan) {
  return (sectionPlan.evidencePackets ?? []).map((packet) => ({
    packetId: packet.packetId,
    evidenceRefs: packet.evidenceRefs,
    interpretationDepth: packet.interpretationDepth,
    sourceRole: packet.sourceRole ?? (packet.interpretationDepth === "reference" ? "secondary_recall" : "primary_interpretation"),
    maxSentences: packet.maxSentences ?? null,
    openingAllowed: packet.openingAllowed !== false,
    ...(sectionPlan.editorialEngine !== "legacy" && (sectionPlan.aspectChapterMode !== "reference" || (packet.interpretationDepth !== "reference" || packet.sourceRole === "licensed_composition_context")) && semanticsForPacket(packet)
      ? { semantics: semanticsForPacket(packet) }
      : {}),
    themes: packet.interpretationDepth === "reference" && packet.sourceRole !== "licensed_composition_context" ? [] : packet.themes,
    canInterpret: packet.interpretationRuleRefs.length > 0,
    facts: packet.claims.map((claim) => {
      const { claimId, evidenceRefs, ...fact } = claim;
      return fact;
    })
  }));
}

function blockPlansForPrompt(sectionPlan) {
  const packets = new Map(packetsForPrompt(sectionPlan).map((packet) => [packet.packetId, packet]));
  return (sectionPlan.blockPlans ?? []).map((blockPlan) => ({
    blockId: blockPlan.blockId,
    narrativeRole: blockPlan.narrativeRole ?? null,
    maxSentences: Number.isInteger(blockPlan.maxSentences) ? blockPlan.maxSentences : null,
    maxQuestions: blockPlan.maxQuestions ?? 0,
    deterministicLead: blockPlan.deterministicPrefix ?? null,
    llmTask: blockPlan.forbidAspectVocabulary
      ? "Interpréter symboliquement ces faits sans reformuler les aspects, leur vocabulaire géométrique, la temporalité, les dates, l'exactitude ou la phase."
      : blockPlan.deterministicPrefix
        ? "Interpréter symboliquement ce transit sans reformuler sa temporalité, ses dates, son exactitude ou sa phase."
        : null,
    packets: (blockPlan.packetRefs ?? []).map((packetRef) => packets.get(packetRef)).filter(Boolean)
  }));
}

function editorialForPrompt(sectionPlan) {
  const editorial = sectionPlan.editorialPlan ?? null;
  const thesis = sectionPlan.editorialThesis ?? null;
  if (!editorial && !thesis) return null;
  return {
    thesis: thesis?.statement ?? null,
    mission: editorial?.mission ?? null,
    owns: (editorial?.owns ?? []).map((idea) => ({ label: idea.label, kind: idea.kind })),
    mayRecall: (editorial?.mayRecall ?? []).map((idea) => ({ label: idea.label, ownerSection: idea.owner })),
    reserved: (editorial?.reserved ?? []).map((idea) => ({ label: idea.label, ownerSection: idea.owner })),
    hypotheses: (sectionPlan.readingHypotheses ?? []).map((hypothese) => ({
      hypothesisId: hypothese.hypothesisId,
      kind: hypothese.kind,
      conventionId: hypothese.conventionId,
      title: hypothese.title,
      statement: hypothese.statement,
      discriminator: hypothese.discriminator,
      computedFacts: hypothese.licence?.computedFacts ?? [],
      questions: hypothese.questions ?? [],
      limits: hypothese.limits ?? []
    })),
    // Isolation calculée sur TOUS les aspects retenus : ce que le chapitre peut
    // affirmer sur ce qui ne relie pas la figure.
    isolation: (sectionPlan.editorialPlan?.isolation ?? []).map((entree) => ({
      figureId: entree.figureId,
      examinedAspects: entree.examinedAspects,
      statement: entree.statement
    })),
    relationsAllowed: (sectionPlan.allowedRelations ?? []).map((relation) => ({
      relationId: relation.relationId,
      kind: relation.kind,
      conventionId: relation.conventionId,
      articulation: relation.articulation,
      evidenceRefs: relation.evidenceRefs
    }))
  };
}

export function buildStructuredUserPrompt({ sectionPlan, correctionIssues = [] }) {
  const editorial = editorialForPrompt(sectionPlan);
  return JSON.stringify(
    {
      sectionPlan: {
        sectionId: sectionPlan.sectionId,
        objective: sectionPlan.objective,
        blockPlans: blockPlansForPrompt(sectionPlan),
        preconditions: sectionPlan.preconditions
      },
      ...(editorial ? { editorial } : {}),
      correctionIssues,
      ...(sectionPlan.sectionId === "conclusion" && sectionPlan.validatedChapterRecaps?.length ? { chapterRecaps: sectionPlan.validatedChapterRecaps, recapInstruction: "Textes déjà produits, faits contrôlés ; dégager leur apport sans les recopier et sans créer de nouvelle interaction." } : {}),
      constraints: {
        closedContextPerBlock: true,
        outputOnlyTextForPlannedBlocks: true,
        forbiddenOutputKeys: ["packetRefs", "evidenceRefs", "interpretationRuleRefs", "claims", "claim", "claimType", "claim.type"],
        blockIdsMustBeCopiedExactly: true,
        noUndeclaredAstrologicalFactsInText: true,
        noTemporalRewordingWhenDeterministicLeadExists: true,
        noDatesWhenDeterministicLeadExists: true,
        noAspectVocabularyWhenDeterministicLeadHasAspects: true,
        noLoveWorkScoring: true
      }
    },
    null,
    2
  );
}

async function writeStructuredBlockWithLlm({ dossierEvidence, sectionPlan, blockPlan, writerFn, config, logger }) {
  const scopedPlan = scopedSectionPlanForBlock(sectionPlan, blockPlan);
  // Budget du bloc : la part de la section qui lui revient (et non le budget
  // entier répété à chaque appel), traduit en plafond de tokens.
  const blockCount = blockCountOf(sectionPlan);
  const budget = blockLengthBudget({ sectionPlan, blockPlan, blockCount });
  // Plafond technique : `maxTokensOverride` ne peut que RELEVER la limite de
  // sécurité, jamais la réduire. Le budget de mots transmis au modèle, lui,
  // reste celui du plan.
  const outputTokenLimit = config?.maxTokensOverride
    ? Math.max(maxTokensForBlock(budget), Math.round(Number(config.maxTokensOverride)))
    : maxTokensForBlock(budget);
  if (blockPlan.deterministic) {
    const section = {
      sectionId: scopedPlan.sectionId,
      contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
      blocks: [{ blockId: blockPlan.blockId, text: deterministicTextForBlock(scopedPlan, blockPlan) }]
    };
    const validation = validateStructuredSection({ dossierEvidence, sectionPlan: scopedPlan, section });
    if (!validation.ok) {
      const error = new Error(`Deterministic block ${blockPlan.blockId} rejected`);
      error.status = 502;
      error.code = "structured_deterministic_block_validation_failed";
      error.sectionId = sectionPlan.sectionId;
      error.validation = validation;
      error.section = section;
      throw error;
    }
    return {
      section: enrichedStructuredSection(section, scopedPlan),
      llmCalls: 0,
      usage: { promptTokens: 0, completionTokens: 0 },
      model: null,
      validation
    };
  }

  // Validate the server-owned prefix independently before spending any LLM call.
  // A later failure in combined text must not be attributed to this prefix.
  const prefix = String(blockPlan.deterministicPrefix ?? "").trim();
  if (prefix) {
    const section = {
      sectionId: scopedPlan.sectionId,
      contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
      blocks: [{ blockId: blockPlan.blockId, text: prefix }]
    };
    const validation = validateStructuredSection({ dossierEvidence, sectionPlan: scopedPlan, section });
    if (!validation.ok) {
      logStructuredValidationFailure({ logger, sectionId: scopedPlan.sectionId, blockId: blockPlan.blockId, attempt: 0, validation, provenance: "server_prefix" });
      const error = new Error(`Server prefix validation failed for block ${blockPlan.blockId}`);
      error.status = 500;
      error.code = "SERVER_PREFIX_VALIDATION_FAILED";
      error.sectionId = scopedPlan.sectionId;
      error.blockId = blockPlan.blockId;
      error.provenance = "server_prefix";
      error.validation = validation;
      throw error;
    }
  }

  let correctionIssues = [];
  let previousRefusalSignature = null;
  let lastSection = null;
  let lastValidation = null;
  let llmCalls = 0;
  let usage = { promptTokens: 0, completionTokens: 0 };
  let model = null;
  const instrumentation = config?.instrumentation ?? null;
  const logicalCallId = !writerFn && instrumentation
    ? instrumentation.startLogicalCall({ sectionId: sectionPlan.sectionId, blockId: blockPlan.blockId })
    : null;

  // Une réponse coupée n'est pas une réponse invalide : c'est une réponse
  // interrompue. Elle est donc reconnue AVANT le parsing JSON, elle reçoit son
  // propre code d'erreur, et elle n'est PAS rejouée — relancer avec le même
  // plafond produirait la même coupure en repayant un appel.
  const rejectTruncated = ({ rawText, finishReason, attempt, startedAt, startedAtMs, providerModel, providerUsage, requestId }) => {
    if (!isTruncatedCompletion({ finishReason, text: rawText })) return;
    const motif = finishReason ? `finish_reason=${finishReason}` : "réponse JSON non refermée";
    const error = new Error(
      `Réponse interrompue sur le bloc ${sectionPlan.sectionId}.${blockPlan.blockId} : plafond de ${outputTokenLimit} tokens atteint (${motif}).`
    );
    error.status = 502;
    error.code = "structured_response_truncated";
    error.sectionId = sectionPlan.sectionId;
    error.blockId = blockPlan.blockId;
    error.maxTokens = outputTokenLimit;
    error.finishReason = finishReason ?? null;
    instrumentation?.recordApplicationAttempt({
      sectionId: sectionPlan.sectionId,
      blockId: blockPlan.blockId,
      logicalCallId,
      applicationAttempt: attempt + 1,
      isRetry: attempt > 0,
      retryReason: attempt === 0 ? "initial" : "validation_correction",
      model: providerModel ?? config?.model ?? null,
      startedAt,
      durationMs: Date.now() - startedAtMs,
      inputTokens: providerUsage?.promptTokens ?? 0,
      outputTokens: providerUsage?.completionTokens ?? 0,
      totalTokens: providerUsage?.totalTokens ?? null,
      requestId: requestId ?? null,
      status: "error",
      errorType: "truncated"
    });
    throw error;
  };

  try {
    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt += 1) {
    const payload = {
      sectionPlan: scopedPlan,
      correctionIssues
    };
    let raw;
    let result = null;
    const attemptStartedAtMs = Date.now();
    const attemptStartedAt = new Date(attemptStartedAtMs).toISOString();
    const retryReason = attempt === 0 ? "initial" : "validation_correction";
    if (writerFn) {
      raw = await writerFn(payload);
      raw = typeof raw === "string" ? raw : JSON.stringify(raw);
    } else {
      try {
        result = await callChatCompletions(config, {
          temperature: config?.temperatureSupported === false ? null : attempt === 0 ? 0.35 : 0.2,
          // Certains fournisseurs refusent `json_object` (Anthropic n'accepte
          // que `json_schema` sur sa couche de compatibilité). Le format JSON
          // reste exigé par la consigne système ; on n'envoie le paramètre que
          // si le fournisseur le supporte.
          responseFormat: config?.jsonMode === false ? null : { type: "json_object" },
          maxTokens: outputTokenLimit,
          system: buildStructuredSystemPrompt(scopedPlan, { blockCount, blockPlan }),
          user: buildStructuredUserPrompt(payload)
        });
        raw = result.text;
        model = result.model;
        llmCalls += 1;
        usage.promptTokens += result.usage?.promptTokens ?? 0;
        usage.completionTokens += result.usage?.completionTokens ?? 0;
      } catch (error) {
        instrumentation?.recordApplicationAttempt({
          sectionId: sectionPlan.sectionId,
          blockId: blockPlan.blockId,
          logicalCallId,
          applicationAttempt: attempt + 1,
          isRetry: attempt > 0,
          retryReason,
          model: config?.model ?? null,
          startedAt: attemptStartedAt,
          durationMs: Date.now() - attemptStartedAtMs,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: null,
          requestId: error.requestId ?? null,
          status: "error",
          errorType: instrumentation?.errorTypeFor?.(error) ?? error.name ?? "other"
        });
        instrumentation?.finishLogicalCall({ logicalCallId, status: "failed" });
        throw error;
      }
      rejectTruncated({
        rawText: raw,
        finishReason: result?.finishReason ?? null,
        attempt,
        startedAt: attemptStartedAt,
        startedAtMs: attemptStartedAtMs,
        providerModel: result?.model ?? null,
        providerUsage: result?.usage ?? null,
        requestId: result?.requestId ?? null
      });
      let parsed;
      let section;
      let validation;
      try {
        parsed = parseJsonObject(raw);
        section = applyDeterministicPrefix(sanitizeStructuredSection(parsed, scopedPlan), blockPlan);
        validation = validateStructuredSection({ dossierEvidence, sectionPlan: scopedPlan, section });
      } catch (error) {
        error.code ??= "structured_parse_error";
        instrumentation?.recordApplicationAttempt({
          sectionId: sectionPlan.sectionId,
          blockId: blockPlan.blockId,
          logicalCallId,
          applicationAttempt: attempt + 1,
          isRetry: attempt > 0,
          retryReason,
          model: result?.model ?? config?.model ?? null,
          startedAt: attemptStartedAt,
          durationMs: Date.now() - attemptStartedAtMs,
          inputTokens: result?.usage?.promptTokens ?? 0,
          outputTokens: result?.usage?.completionTokens ?? 0,
          totalTokens: result?.usage?.totalTokens ?? null,
          requestId: result?.requestId ?? null,
          status: "error",
          errorType: instrumentation?.errorTypeFor?.(error) ?? "parse_error"
        });
        instrumentation?.finishLogicalCall({ logicalCallId, status: "failed" });
        throw error;
      }
      lastSection = section;
      lastValidation = validation;
      if (validation.ok) {
        logStructuredValidationWarnings({ logger, sectionId: sectionPlan.sectionId, blockId: blockPlan.blockId, attempt: attempt + 1, validation });
        instrumentation?.recordApplicationAttempt({
          sectionId: sectionPlan.sectionId,
          blockId: blockPlan.blockId,
          logicalCallId,
          applicationAttempt: attempt + 1,
          isRetry: attempt > 0,
          retryReason,
          model: result?.model ?? config?.model ?? null,
          startedAt: attemptStartedAt,
          durationMs: Date.now() - attemptStartedAtMs,
          inputTokens: result?.usage?.promptTokens ?? 0,
          outputTokens: result?.usage?.completionTokens ?? 0,
          totalTokens: result?.usage?.totalTokens ?? null,
          requestId: result?.requestId ?? null,
          status: "success",
          errorType: null
        });
        instrumentation?.finishLogicalCall({ logicalCallId, status: "success" });
        return {
          section: enrichedStructuredSection(section, scopedPlan),
          llmCalls,
          usage,
          model,
          validation
        };
      }
      instrumentation?.recordApplicationAttempt({
        sectionId: sectionPlan.sectionId,
        blockId: blockPlan.blockId,
        logicalCallId,
        applicationAttempt: attempt + 1,
        isRetry: attempt > 0,
        retryReason,
        model: result?.model ?? config?.model ?? null,
        startedAt: attemptStartedAt,
        durationMs: Date.now() - attemptStartedAtMs,
        inputTokens: result?.usage?.promptTokens ?? 0,
        outputTokens: result?.usage?.completionTokens ?? 0,
        totalTokens: result?.usage?.totalTokens ?? null,
        requestId: result?.requestId ?? null,
        status: "error",
        errorType: "validation_correction"
      });
      logStructuredValidationFailure({ logger, sectionId: sectionPlan.sectionId, blockId: blockPlan.blockId, attempt: attempt + 1, validation });
      // Refus identique au précédent : la deuxième correction ne peut pas
      // aboutir, puisque le contexte n'a pas changé. On s'arrête là plutôt que
      // de payer un troisième appel pour le même constat.
      const signature = refusalSignature(validation);
      if (attempt > 0 && signature !== null && signature === previousRefusalSignature) {
        const refusedFacts = refusedFactTexts(validation);
        const stalled = new Error(
          `Bloc ${sectionPlan.sectionId}.${blockPlan.blockId} : le même refus s'est reproduit à ${attempt + 1} essais` +
            (refusedFacts.length ? ` (${refusedFacts.join(" ; ")})` : "") +
            ". La correction automatique ne peut pas le lever : arrêt avant un appel supplémentaire."
        );
        stalled.status = 502;
        stalled.code = "structured_section_validation_stalled";
        stalled.sectionId = sectionPlan.sectionId;
        stalled.blockId = blockPlan.blockId;
        stalled.refusedFacts = refusedFacts;
        stalled.validation = validation;
        stalled.llmCalls = llmCalls;
        stalled.attempts = attempt + 1;
        instrumentation?.finishLogicalCall({ logicalCallId, status: "failed" });
        throw stalled;
      }
      previousRefusalSignature = signature;
      correctionIssues = correctionIssuesForPrompt({ validation, section, sectionPlan: scopedPlan });
      continue;
    }
    rejectTruncated({
      rawText: raw,
      finishReason: null,
      attempt,
      startedAt: attemptStartedAt,
      startedAtMs: attemptStartedAtMs,
      providerModel: null,
      providerUsage: null,
      requestId: null
    });
    const parsed = parseJsonObject(raw);
    const section = applyDeterministicPrefix(sanitizeStructuredSection(parsed, scopedPlan), blockPlan);
    const validation = validateStructuredSection({ dossierEvidence, sectionPlan: scopedPlan, section });
    lastSection = section;
    lastValidation = validation;
    if (validation.ok) {
      logStructuredValidationWarnings({ logger, sectionId: sectionPlan.sectionId, blockId: blockPlan.blockId, attempt: attempt + 1, validation });
      return {
        section: enrichedStructuredSection(section, scopedPlan),
        llmCalls,
        usage,
        model,
        validation
      };
    }
    logStructuredValidationFailure({ logger, sectionId: sectionPlan.sectionId, blockId: blockPlan.blockId, attempt: attempt + 1, validation });
    const signature = refusalSignature(validation);
    if (attempt > 0 && signature !== null && signature === previousRefusalSignature) {
      const refusedFacts = refusedFactTexts(validation);
      const stalled = new Error(
        `Bloc ${sectionPlan.sectionId}.${blockPlan.blockId} : le même refus s'est reproduit à ${attempt + 1} essais` +
          (refusedFacts.length ? ` (${refusedFacts.join(" ; ")})` : "") +
          ". La correction automatique ne peut pas le lever : arrêt avant un appel supplémentaire."
      );
      stalled.status = 502;
      stalled.code = "structured_section_validation_stalled";
      stalled.sectionId = sectionPlan.sectionId;
      stalled.blockId = blockPlan.blockId;
      stalled.refusedFacts = refusedFacts;
      stalled.validation = validation;
      stalled.llmCalls = llmCalls;
      stalled.attempts = attempt + 1;
      instrumentation?.finishLogicalCall({ logicalCallId, status: "failed" });
      throw stalled;
    }
    previousRefusalSignature = signature;
    correctionIssues = correctionIssuesForPrompt({ validation, section, sectionPlan: scopedPlan });
  }

  const error = new Error(`Block ${sectionPlan.sectionId}.${blockPlan.blockId} rejected after ${MAX_CORRECTION_ATTEMPTS} correction attempts`);
  error.status = 502;
  error.code = "structured_block_validation_failed";
  error.sectionId = sectionPlan.sectionId;
  error.blockId = blockPlan.blockId;
  error.validation = lastValidation;
  error.section = lastSection;
  instrumentation?.finishLogicalCall({ logicalCallId, status: "failed" });
  throw error;
  } catch (error) {
    if (logicalCallId) {
      instrumentation?.finishLogicalCall({ logicalCallId, status: "failed" });
    }
    throw error;
  }
}

export function structuredSectionLlmConfiguration(sectionPlan, baseConfig = llmConfiguration()) {
  if (!baseConfig) return null;
  const model = STRUCTURED_SECTION_MODEL_OVERRIDES[sectionPlan?.sectionId];
  return model ? { ...baseConfig, model } : baseConfig;
}

export async function writeStructuredSectionWithLlm({ dossierEvidence, sectionPlan, options = {} }) {
  const eligibleQuestions = (sectionPlan.blockPlans ?? []).filter((block) => !block.deterministic && block.blockId !== "brief_recall");
  const questionBlock = ["general_synthesis", "conclusion"].includes(sectionPlan.sectionId) ? null : eligibleQuestions.at(-1)?.blockId;
  sectionPlan = { ...sectionPlan, maxQuestions: 1, blockPlans: (sectionPlan.blockPlans ?? []).map((block) => ({ ...block, maxQuestions: block.blockId === questionBlock ? 1 : 0 })) };
  if (!hasWritableMaterial(sectionPlan)) {
    return {
      section: {
        sectionId: sectionPlan.sectionId,
        contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
        blocks: []
      },
      skipped: true,
      reason: sectionPlan.unavailableReason ?? (
        sectionPlan.editorialMode === "reference"
          ? "reference_only"
          : "no_authorized_interpretation_rules"),
      llmCalls: 0,
      usage: { promptTokens: 0, completionTokens: 0 },
      model: null,
      validation: { ok: true, issues: [] }
    };
  }

  const writerFn = options.structuredWriterFn ?? null;
  const configured = structuredSectionLlmConfiguration(sectionPlan, options.config ?? llmConfiguration());
  const config = configured && options.llmInstrumentation
    ? { ...configured, instrumentation: options.llmInstrumentation }
    : configured;
  const logger = options.logger ?? console;
  if (!writerFn && !config) {
    const error = new Error("Le générateur complet nécessite ASTROLAB_LLM_API_KEY.");
    error.status = 503;
    error.code = "full_dossier_writer_unavailable";
    throw error;
  }

  let llmCalls = 0;
  let usage = { promptTokens: 0, completionTokens: 0 };
  let model = null;
  const section = {
    sectionId: sectionPlan.sectionId,
    contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
    blocks: []
  };

  for (const blockPlan of sectionPlan.blockPlans ?? []) {
    const written = await writeStructuredBlockWithLlm({
      dossierEvidence,
      sectionPlan,
      blockPlan,
      writerFn,
      config,
      logger
    });
    section.blocks.push(...(written.section.blocks ?? []));
    llmCalls += written.llmCalls ?? 0;
    usage.promptTokens += written.usage?.promptTokens ?? 0;
    usage.completionTokens += written.usage?.completionTokens ?? 0;
    model = model ?? written.model ?? null;
  }

  const validation = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  if (!validation.ok) {
    const error = new Error(`Section ${sectionPlan.sectionId} rejected after block generation`);
    error.status = 502;
    error.code = "structured_section_validation_failed";
    error.sectionId = sectionPlan.sectionId;
    error.validation = validation;
    error.section = section;
    throw error;
  }
  // Mesure réelle de la longueur produite. Elle est journalisée, jamais imposée :
  // une section plus courte que son repère n'est ni réécrite, ni complétée.
  const report = lengthReport({
    text: (section.blocks ?? []).map((block) => block.text ?? "").join("\n\n"),
    targetWords: sectionPlan.targetWords,
    maxWords: sectionPlan.maxWords
  });
  return {
    section: enrichedStructuredSection(section, sectionPlan),
    skipped: false,
    reason: null,
    llmCalls,
    usage,
    model,
    validation,
    words: report.words,
    length: report
  };
}

export async function writeStructuredSectionsWithLlm({ dossierEvidence, fullDossierPlan, options = {} }) {
  const sections = [];
  const rejected = [];
  const skipped = [];
  const metrics = {
    llmCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    model: null,
    words: 0,
    plannedOutputTokens: 0,
    shortSections: []
  };
  const sectionPlans = fullDossierPlan?.sections ?? [];
  const writableTotal = sectionPlans.filter(hasWritableMaterial).length;

  options.onProgress?.({
    completedSections: 0,
    totalSections: writableTotal,
    currentSection: null
  });

  for (const sectionPlan of sectionPlans) {
    try {
      const writable = hasWritableMaterial(sectionPlan);
      if (writable) {
        options.onProgress?.({
          completedSections: sections.length,
          totalSections: writableTotal,
          currentSection: sectionPlan.sectionId
        });
      }
      const conclusionRefs = new Set([...(sectionPlan.primaryEvidenceRefs ?? []), ...(sectionPlan.secondaryEvidenceRefs ?? [])]);
      const recaps = sectionPlan.sectionId === "conclusion" ? sections.filter((previous) => previous.sectionId !== "general_synthesis").flatMap((previous) => {
        const blocks = (previous.blocks ?? []).filter((block) => block.evidenceRefs?.length && block.evidenceRefs.every((ref) => conclusionRefs.has(ref)));
        const text = blocks.map((block) => block.text).join(" ");
        const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/gu) ?? [];
        let excerpt = "";
        for (const sentence of sentences) { if (excerpt.length + sentence.length > 1600) break; excerpt += sentence; }
        return excerpt.trim() ? [{ sectionId: previous.sectionId, text: excerpt.trim() }] : [];
      }).sort((a, b) => {
        const weight = (id) => (sectionPlans.find((plan) => plan.sectionId === id)?.primaryEvidenceRefs ?? []).filter((ref) => conclusionRefs.has(ref)).length;
        return weight(b.sectionId) - weight(a.sectionId);
      }).slice(0, 4) : [];
      const written = await writeStructuredSectionWithLlm({
        dossierEvidence, sectionPlan: { ...sectionPlan, validatedChapterRecaps: recaps }, options });
      metrics.llmCalls += written.llmCalls ?? 0;
      metrics.promptTokens += written.usage?.promptTokens ?? 0;
      metrics.completionTokens += written.usage?.completionTokens ?? 0;
      metrics.model = metrics.model ?? written.model ?? null;
      if (written.skipped) {
        skipped.push({ sectionId: sectionPlan.sectionId, reason: written.reason });
        continue;
      }
      metrics.words += written.words ?? 0;
      metrics.plannedOutputTokens += worstCaseOutputTokens(sectionPlan);
      if (written.length?.status === "short") {
        metrics.shortSections.push({ sectionId: sectionPlan.sectionId, ...written.length });
      }
      sections.push(written.section);
      options.onProgress?.({
        completedSections: sections.length,
        totalSections: writableTotal,
        currentSection: null
      });
    } catch (error) {
      if (options.failFast === false) {
        rejected.push({ sectionId: sectionPlan.sectionId, message: error.message, issues: error.validation?.issues ?? [] });
        continue;
      }
      throw error;
    }
  }

  return {
    schema: "astrolab.full_dossier.structured_sections",
    contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
    llmCalls: metrics.llmCalls,
    words: metrics.words,
    plannedOutputTokens: metrics.plannedOutputTokens,
    shortSections: metrics.shortSections,
    usage: {
      promptTokens: metrics.promptTokens,
      completionTokens: metrics.completionTokens,
      model: metrics.model
    },
    sections,
    skipped,
    rejected
  };
}
