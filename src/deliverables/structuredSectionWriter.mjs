import { evidenceById } from "./dossierEvidence.mjs";
import { interpretationRuleById, ruleMatchesEvidence } from "./interpretationRules.mjs";
import { sectionPlanById } from "./fullDossierPlan.mjs";
import { callChatCompletions, llmConfiguration } from "./writers.mjs";
import { validateStructuredSection } from "./factualClaimsValidator.mjs";

export const STRUCTURED_WRITER_CONTRACT_VERSION = "structured-section-writer@0.1.0";
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
      text: `Ciel calculé le ${snapshot.value.nowUtc}, horizon ${snapshot.value.horizonDays} jours. Cette partie du PDF est un instantané daté, pas une page dynamique.`,
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
        text: `${BODY_FR[value.transitBody] ?? value.transitBody} forme un ${ASPECT_FR[value.aspectType] ?? value.aspectType} à votre ${BODY_FR[value.natalPoint] ?? value.natalPoint}, exact le ${value.exactAt}. Le thème autorisé est ${firstTheme(ruleId)}.`,
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
      text: String(block?.text ?? "").trim(),
      evidenceRefs: normalizeArray(block?.evidenceRefs).map(String),
      interpretationRuleRefs: normalizeArray(block?.interpretationRuleRefs).map(String),
      interpretationDepth: String(block?.interpretationDepth ?? "primary"),
      claims: normalizeArray(block?.claims).map((claim, claimIndex) => ({
        claimId: String(claim?.claimId ?? `${sectionPlan.sectionId}.${index + 1}.${claimIndex + 1}`),
        ...claim,
        evidenceRefs: normalizeArray(claim?.evidenceRefs).map(String)
      }))
    }))
  };
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
  if (issue?.code === "distribution_key_mismatch" || issue?.code === "distribution_count_mismatch") {
    return "DISTRIBUTION_COUNT claims must place element or modality and count at the claim root, for example { type, evidenceRefs, element: 'earth', count: 3 }.";
  }
  if (issue?.code === "unsupported_claim_type") {
    return "Use the supported claim type names exactly: NATAL_BODY_SIGN, NATAL_BODY_HOUSE, ANGLE_SIGN, NATAL_ASPECT, NATAL_ASPECT_ORB, NATAL_BODY_RETROGRADE, DISTRIBUTION_COUNT, PERSONAL_TRANSIT.";
  }
  if (issue?.code === "unknown_evidence_ref") {
    return "Evidence refs are opaque IDs: copy an evidenceId exactly from the provided evidence list; never translate, pluralize or reconstruct one.";
  }
  return null;
}

function correctionIssuesForPrompt({ validation, section, sectionPlan }) {
  const allowedEvidenceRefs = [...new Set([...(sectionPlan.primaryEvidenceRefs ?? []), ...(sectionPlan.secondaryEvidenceRefs ?? [])])];
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
      expectedHint: claimShapeHelp(issue),
      allowedEvidenceRefs,
      allowedInterpretationRuleRefs: sectionPlan.allowedInterpretationRuleRefs ?? [],
      block: block
        ? {
            textFragment: block.text.slice(0, 320),
            evidenceRefs: block.evidenceRefs ?? [],
            interpretationRuleRefs: block.interpretationRuleRefs ?? [],
            interpretationDepth: block.interpretationDepth ?? null,
            claims: block.claims ?? []
          }
        : null,
      claim: claim ?? null
    };
  });
}

function validationErrorCodes(validation) {
  return [...new Set((validation?.issues ?? []).map((issue) => issue.code).filter(Boolean))];
}

function logStructuredValidationFailure({ logger, sectionId, attempt, validation }) {
  if (!logger?.warn) return;
  logger.warn("[Lastro] structured section validation failed", {
    sectionId,
    attempt,
    validationErrorCodes: validationErrorCodes(validation)
  });
}

function hasWritableMaterial(sectionPlan) {
  return (sectionPlan?.allowedInterpretationRuleRefs ?? []).length > 0 &&
    ((sectionPlan?.primaryEvidenceRefs ?? []).length > 0 || (sectionPlan?.secondaryEvidenceRefs ?? []).length > 0);
}

function buildStructuredSystemPrompt(sectionPlan) {
  return [
    "Tu rédiges un chapitre du dossier astrologique Lastro.",
    "Tu dois produire UNIQUEMENT un objet JSON valide, sans Markdown autour.",
    "Tu n'as pas le droit d'inventer un fait astrologique, biographique, psychologique ou prédictif.",
    "Toute affirmation concrète doit être déclarée dans claims et référencer une preuve fournie.",
    "Toute interprétation doit référencer au moins une règle d'interprétation fournie.",
    "N'utilise pas de preuve interdite. N'utilise pas de règle absente de la liste autorisée.",
    "Les evidenceId sont des identifiants opaques : copie-les exactement depuis la liste evidence, sans les traduire, les compléter ni les reconstruire.",
    "Pour un claim DISTRIBUTION_COUNT, écris element ou modality et count directement au niveau racine du claim.",
    "Si la matière méthodologique est insuffisante, écris un bloc court qui dit que cette partie reste limitée aux faits disponibles.",
    "Respecte le vouvoiement, un ton sobre, humain et non fataliste.",
    `Section: ${sectionPlan.sectionId}. Objectif: ${sectionPlan.objective}.`,
    `Longueur cible: environ ${sectionPlan.targetWords} mots, jamais plus de ${sectionPlan.maxWords}.`,
    "Schéma attendu: {\"sectionId\":\"...\",\"contractVersion\":\"structured-section-writer@0.1.0\",\"blocks\":[{\"blockId\":\"...\",\"text\":\"...\",\"evidenceRefs\":[\"...\"],\"interpretationRuleRefs\":[\"...\"],\"interpretationDepth\":\"primary|reference\",\"claims\":[...]}]}"
  ].join("\n");
}

function buildStructuredUserPrompt({ dossierEvidence, sectionPlan, previousSections = [], correctionIssues = [] }) {
  const allowedRefs = [...new Set([...(sectionPlan.primaryEvidenceRefs ?? []), ...(sectionPlan.secondaryEvidenceRefs ?? [])])];
  return JSON.stringify(
    {
      sectionPlan: {
        sectionId: sectionPlan.sectionId,
        objective: sectionPlan.objective,
        primaryEvidenceRefs: sectionPlan.primaryEvidenceRefs,
        secondaryEvidenceRefs: sectionPlan.secondaryEvidenceRefs,
        alreadyInterpretedEvidenceRefs: sectionPlan.alreadyInterpretedEvidenceRefs,
        forbiddenEvidenceRefs: sectionPlan.forbiddenEvidenceRefs,
        allowedInterpretationRuleRefs: sectionPlan.allowedInterpretationRuleRefs,
        preconditions: sectionPlan.preconditions
      },
      evidence: compactEvidenceForPrompt(dossierEvidence, allowedRefs),
      interpretationRules: rulesForPrompt(sectionPlan.allowedInterpretationRuleRefs),
      previousSections,
      correctionIssues,
      constraints: {
        evidenceRefsMustBeCopiedExactly: true,
        doNotInventEvidenceRefs: true,
        claimShapes: {
          DISTRIBUTION_COUNT: {
            element: "required for DISTRIBUTION_ELEMENT_COUNT evidence",
            modality: "required for DISTRIBUTION_MODALITY_COUNT evidence",
            count: "required number at claim root"
          }
        },
        claimTypesSupported: [
          "NATAL_BODY_SIGN",
          "NATAL_BODY_HOUSE",
          "ANGLE_SIGN",
          "NATAL_ASPECT",
          "NATAL_ASPECT_ORB",
          "NATAL_BODY_RETROGRADE",
          "DISTRIBUTION_COUNT",
          "PERSONAL_TRANSIT"
        ],
        noUndeclaredAstrologicalFactsInText: true,
        noLoveWorkScoring: true
      }
    },
    null,
    2
  );
}

export async function writeStructuredSectionWithLlm({ dossierEvidence, sectionPlan, previousSections = [], options = {} }) {
  if (!hasWritableMaterial(sectionPlan)) {
    return {
      section: {
        sectionId: sectionPlan.sectionId,
        contractVersion: STRUCTURED_WRITER_CONTRACT_VERSION,
        blocks: []
      },
      skipped: true,
      reason: "no_authorized_interpretation_rules",
      llmCalls: 0,
      usage: { promptTokens: 0, completionTokens: 0 },
      model: null,
      validation: { ok: true, issues: [] }
    };
  }

  const writerFn = options.structuredWriterFn ?? null;
  const config = options.config ?? llmConfiguration();
  const logger = options.logger ?? console;
  if (!writerFn && !config) {
    const error = new Error("Le générateur complet nécessite ASTROLAB_LLM_API_KEY.");
    error.status = 503;
    error.code = "full_dossier_writer_unavailable";
    throw error;
  }

  let correctionIssues = [];
  let lastSection = null;
  let lastValidation = null;
  let llmCalls = 0;
  let usage = { promptTokens: 0, completionTokens: 0 };
  let model = null;

  for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt += 1) {
    const payload = {
      dossierEvidence,
      sectionPlan,
      previousSections,
      correctionIssues
    };
    let raw;
    if (writerFn) {
      raw = await writerFn(payload);
      raw = typeof raw === "string" ? raw : JSON.stringify(raw);
    } else {
      const result = await callChatCompletions(config, {
        temperature: attempt === 0 ? 0.35 : 0.2,
        responseFormat: { type: "json_object" },
        maxTokens: 1800,
        system: buildStructuredSystemPrompt(sectionPlan),
        user: buildStructuredUserPrompt(payload)
      });
      raw = result.text;
      model = result.model;
      llmCalls += 1;
      usage.promptTokens += result.usage?.promptTokens ?? 0;
      usage.completionTokens += result.usage?.completionTokens ?? 0;
    }
    const parsed = parseJsonObject(raw);
    const section = sanitizeStructuredSection(parsed, sectionPlan);
    const validation = validateStructuredSection({ dossierEvidence, sectionPlan, section });
    lastSection = section;
    lastValidation = validation;
    if (validation.ok) {
      return {
        section,
        skipped: false,
        reason: null,
        llmCalls,
        usage,
        model,
        validation
      };
    }
    logStructuredValidationFailure({ logger, sectionId: sectionPlan.sectionId, attempt: attempt + 1, validation });
    correctionIssues = correctionIssuesForPrompt({ validation, section, sectionPlan });
  }

  const error = new Error(`Section ${sectionPlan.sectionId} rejected after ${MAX_CORRECTION_ATTEMPTS} correction attempts`);
  error.status = 502;
  error.code = "structured_section_validation_failed";
  error.sectionId = sectionPlan.sectionId;
  error.validation = lastValidation;
  error.section = lastSection;
  throw error;
}

export async function writeStructuredSectionsWithLlm({ dossierEvidence, fullDossierPlan, options = {} }) {
  const sections = [];
  const rejected = [];
  const skipped = [];
  const metrics = { llmCalls: 0, promptTokens: 0, completionTokens: 0, model: null };

  for (const sectionPlan of fullDossierPlan?.sections ?? []) {
    const previousSections = sections.map((section) => ({
      sectionId: section.sectionId,
      excerpt: section.blocks.map((block) => block.text).join(" ").slice(0, 360)
    }));
    try {
      const written = await writeStructuredSectionWithLlm({ dossierEvidence, sectionPlan, previousSections, options });
      metrics.llmCalls += written.llmCalls ?? 0;
      metrics.promptTokens += written.usage?.promptTokens ?? 0;
      metrics.completionTokens += written.usage?.completionTokens ?? 0;
      metrics.model = metrics.model ?? written.model ?? null;
      if (written.skipped) {
        skipped.push({ sectionId: sectionPlan.sectionId, reason: written.reason });
        continue;
      }
      sections.push(written.section);
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
