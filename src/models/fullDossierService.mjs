import { calculateWesternNatalChart } from "../astro/westernNatal.mjs";
import { buildDossierEvidence } from "../deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../deliverables/fullDossierPlan.mjs";
import { writeStructuredSectionWithLlm, writeStructuredSectionsWithLlm } from "../deliverables/structuredSectionWriter.mjs";
import { validateStructuredSections } from "../deliverables/factualClaimsValidator.mjs";
import { chartSection } from "../deliverables/chart.mjs";
import { estimateUsageCost } from "../deliverables/cost.mjs";
import { aiNotice, docStrings, normalizeLanguage } from "../deliverables/i18n.mjs";
import { annexSections, renderDossierHtml, renderDossierMarkdown } from "../deliverables/render.mjs";
import { buildSocle } from "../deliverables/socle.mjs";
import {
  buildIndividualRelationalAffectionPlan,
  buildIndividualRelationalCommunicationPlan,
  relationalAffectionSectionForRender,
  relationalCommunicationSectionForRender
} from "../deliverables/individualRelationalPlan.mjs";
import { provenanceSummary } from "../deliverables/provenance.mjs";
import { llmConfiguration } from "../deliverables/writers.mjs";
import { getPersonalCurrentSky } from "./currentSkyService.mjs";
import { assertPublicReadingInput } from "./publicReadingService.mjs";

const FULL_DOSSIER_SERVICE_VERSION = "full-dossier-service@0.1.0";
const PUBLIC_USER_ID = "public_full_dossier_user";
const PUBLIC_PERSON_ID = "public_full_dossier_person";

const SECTION_TITLES_FR = Object.freeze({
  general_synthesis: "Synthèse générale",
  identity: "Identité",
  emotional_world: "Monde émotionnel",
  communication: "Communication",
  affectivity: "Affectivité",
  action: "Action",
  relationships: "Relations",
  creativity: "Créativité",
  work_realization: "Travail et réalisation",
  security_resources: "Sécurité et ressources",
  internal_tensions: "Tensions intérieures",
  supporting_resources: "Ressources de soutien",
  houses: "Maisons",
  major_aspects: "Aspects majeurs",
  current_sky: "Votre ciel actuellement",
  next_weeks: "Mes prochaines semaines",
  conclusion: "Conclusion",
  relational_communication: "Communication relationnelle",
  relational_affection: "Manière d'exprimer son affection"
});

const RELATIONAL_DOSSIER_SCHEMA = "astrolab.individual_relational_public_v1";
const RELATIONAL_AXIS_RENDERERS = Object.freeze({
  relational_communication: relationalCommunicationSectionForRender,
  relational_affection: relationalAffectionSectionForRender
});

function hasWritableSectionPlan(sectionPlan) {
  return (
    (sectionPlan?.blockPlans ?? []).length > 0 &&
    (sectionPlan?.allowedInterpretationRuleRefs ?? []).length > 0 &&
    (sectionPlan?.evidencePackets ?? []).length > 0
  );
}

function cleanString(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizePlace(input) {
  const resolvedPlace = input.resolvedPlace ?? null;
  if (resolvedPlace?.normalizedForCalculation) {
    return {
      placeName: resolvedPlace.selectedName ?? resolvedPlace.normalizedForCalculation.placeName ?? null,
      country: resolvedPlace.country ?? null,
      latitude: resolvedPlace.normalizedForCalculation.latitude,
      longitude: resolvedPlace.normalizedForCalculation.longitude,
      timeZone: resolvedPlace.normalizedForCalculation.timeZone,
      resolvedPlace
    };
  }
  return {
    placeName: cleanString(input.birthPlace) ?? cleanString(input.placeName),
    country: cleanString(input.country),
    latitude: input.latitude,
    longitude: input.longitude,
    timeZone: input.timeZone,
    resolvedPlace: null
  };
}

function normalizeParents(input = {}) {
  const candidates = Array.isArray(input.parents) ? input.parents : [];
  return candidates
    .filter((entry) => entry && (entry.label || entry.role))
    .map((entry, index) => ({
      role: String(entry.role ?? (index === 0 ? "mother" : "father")),
      label: cleanString(entry.label),
      birthDate: cleanString(entry.birthDate),
      birthPlace: cleanString(entry.birthPlace)
    }));
}

function publicNatalInput(input, place) {
  return {
    personId: PUBLIC_PERSON_ID,
    birthDate: cleanString(input.birthDate),
    timePrecision: input.timePrecision ?? "unknown",
    timeValue: cleanString(input.timeValue),
    timeMarginMinutes: input.timeMarginMinutes ?? null,
    timeStart: cleanString(input.timeStart),
    timeEnd: cleanString(input.timeEnd),
    placeName: place.placeName,
    birthPlace: place.placeName,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    timeZone: place.timeZone,
    resolvedPlace: place.resolvedPlace,
    coordinateSource: input.coordinateSource ?? place.resolvedPlace?.resolutionSource ?? "user_provided",
    coordinateConfidence: input.coordinateConfidence ?? place.resolvedPlace?.confidence ?? "unverified"
  };
}

function memoryStoreForCurrentSky(calculation, generatedAt) {
  const resultArtifact = calculation.calculationArtifacts.find((artifact) => artifact.type === "structured_result");
  const state = {
    persons: [{ id: PUBLIC_PERSON_ID, ownerUserId: PUBLIC_USER_ID, isPrimary: true, createdAt: generatedAt }],
    calculationRuns: [{ ...calculation.calculationRun, ownerUserId: PUBLIC_USER_ID, createdAt: generatedAt }],
    calculationArtifacts: [
      {
        ...resultArtifact,
        ownerUserId: PUBLIC_USER_ID,
        calculationRunId: calculation.calculationRun.id,
        createdAt: generatedAt
      }
    ]
  };
  return {
    async transact(fn) {
      return fn(state);
    }
  };
}

async function currentSkyForPublicReading({ calculation, generatedAt, options }) {
  if (options.currentSky !== undefined) {
    return options.currentSky;
  }
  const store = memoryStoreForCurrentSky(calculation, generatedAt);
  return getPersonalCurrentSky(store, PUBLIC_USER_ID, {
    personId: PUBLIC_PERSON_ID,
    nowUtc: options.nowUtc ?? generatedAt,
    horizonDays: 42
  });
}

function blockText(section) {
  return (section.blocks ?? []).map((block) => block.text).filter(Boolean).join("\n\n");
}

function renderableSection(section, strings) {
  return {
    id: section.sectionId,
    title: strings.sectionTitles?.[section.sectionId] ?? SECTION_TITLES_FR[section.sectionId] ?? section.sectionId,
    rank: null,
    badgeCode: "symbolic",
    badgeLabel: strings.badgeSymbolic,
    kind: "symbolic",
    provider: "llm",
    status: "ok",
    text: blockText(section),
    validation: { ok: true, issues: [] }
  };
}

function publicSectionSummary(section) {
  return {
    id: section.sectionId,
    title: SECTION_TITLES_FR[section.sectionId] ?? section.sectionId,
    status: "ok",
    provider: "llm",
    blocks: (section.blocks ?? []).length
  };
}

function usageSummary(parts = []) {
  return parts.reduce((summary, usage) => {
    summary.promptTokens += usage?.promptTokens ?? 0;
    summary.completionTokens += usage?.completionTokens ?? 0;
    summary.model = summary.model ?? usage?.model ?? null;
    return summary;
  }, { promptTokens: 0, completionTokens: 0, model: null });
}

function buildRelationalPlans(dossierEvidence) {
  return [
    buildIndividualRelationalCommunicationPlan(dossierEvidence),
    buildIndividualRelationalAffectionPlan(dossierEvidence)
  ];
}

function progressOptions({ options, fullDossierPlan, relationalPlans }) {
  if (!options.onProgress) return options;
  const fullWritable = (fullDossierPlan.sections ?? []).filter(hasWritableSectionPlan).length;
  const relationalWritable = relationalPlans
    .flatMap((plan) => plan.sections ?? [])
    .filter(hasWritableSectionPlan).length;
  const totalSections = fullWritable + relationalWritable;
  return {
    ...options,
    onProgress: (progress) => options.onProgress({
      ...progress,
      totalSections,
      completedSections: Math.min(Number(progress?.completedSections ?? 0), totalSections)
    })
  };
}

async function writeRelationalSections({ dossierEvidence, plans, options, config, completedOffset = 0 }) {
  const sectionPlans = plans.flatMap((plan) => plan.sections ?? []);
  const sections = [];
  const skipped = [];
  const rejected = [];
  const metrics = { llmCalls: 0, promptTokens: 0, completionTokens: 0, model: null };
  const writableTotal = sectionPlans.filter(hasWritableSectionPlan).length;

  for (const sectionPlan of sectionPlans) {
    try {
      const writable = hasWritableSectionPlan(sectionPlan);
      if (writable) {
        options.onProgress?.({
          completedSections: completedOffset + sections.length,
          totalSections: completedOffset + writableTotal,
          currentSection: sectionPlan.sectionId
        });
      }
      const written = await writeStructuredSectionWithLlm({
        dossierEvidence,
        sectionPlan,
        options: {
          ...options,
          config,
          failFast: options.failFast ?? true
        }
      });
      metrics.llmCalls += written.llmCalls ?? 0;
      metrics.promptTokens += written.usage?.promptTokens ?? 0;
      metrics.completionTokens += written.usage?.completionTokens ?? 0;
      metrics.model = metrics.model ?? written.model ?? null;
      if (written.skipped) {
        skipped.push({ sectionId: sectionPlan.sectionId, reason: written.reason });
        continue;
      }
      sections.push(written.section);
      options.onProgress?.({
        completedSections: completedOffset + sections.length,
        totalSections: completedOffset + writableTotal,
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
    schema: "astrolab.individual_relational.structured_sections",
    version: plans[0]?.version ?? null,
    plan: {
      schema: "astrolab.individual_relational_public_plan",
      version: plans[0]?.version ?? null,
      sections: sectionPlans
    },
    sections,
    skipped,
    rejected,
    llmCalls: metrics.llmCalls,
    usage: {
      promptTokens: metrics.promptTokens,
      completionTokens: metrics.completionTokens,
      model: metrics.model
    }
  };
}

function renderRelationalSection(section) {
  const renderer = RELATIONAL_AXIS_RENDERERS[section.sectionId];
  return renderer ? renderer(section) : null;
}

function logFullDossier({ startedAt, generated, relationalGenerated, dossierEvidence, fullDossierPlan, validation, reading }) {
  const line = {
    event: "full_dossier.generated",
    serviceVersion: FULL_DOSSIER_SERVICE_VERSION,
    generationMs: Date.now() - startedAt,
    writerMode: reading.writerMode,
    status: reading.status,
    sectionsGenerated: generated.sections.length + relationalGenerated.sections.length,
    sectionsSkipped: generated.skipped.length + relationalGenerated.skipped.length,
    sectionsRejected: generated.rejected.length + relationalGenerated.rejected.length,
    llmCalls: generated.llmCalls + relationalGenerated.llmCalls,
    promptTokens: reading.observability.promptTokens,
    completionTokens: reading.observability.completionTokens,
    model: reading.observability.model,
    evidenceCount: dossierEvidence.evidence.length,
    planSections: fullDossierPlan.sections.length + relationalGenerated.plan.sections.length,
    validationOk: validation.ok,
    validationIssues: validation.issues.length
  };
  console.log(`[Lastro] ${JSON.stringify(line)}`);
}

export async function createFullPublicReading(input = {}, options = {}) {
  const startedAt = Date.now();
  const generatedAt = new Date(options.nowUtc ?? Date.now()).toISOString();
  const language = normalizeLanguage(input.language);
  const strings = docStrings(language);
  assertPublicReadingInput(input);
  const place = normalizePlace(input);
  const calculation = calculateWesternNatalChart(publicNatalInput(input, place), {
    calculatedAt: generatedAt,
    runId: "calc_public_full_dossier"
  });
  const currentSky = await currentSkyForPublicReading({ calculation, generatedAt, options });
  const dossierEvidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    currentSky,
    parentContext: { parents: normalizeParents(input) },
    generatedAt
  });
  const fullDossierPlan = buildFullDossierPlan(dossierEvidence);
  const relationalPlans = buildRelationalPlans(dossierEvidence);
  const config = options.config ?? llmConfiguration();
  const writerOptions = progressOptions({ options, fullDossierPlan, relationalPlans });
  const generated = await writeStructuredSectionsWithLlm({
    dossierEvidence,
    fullDossierPlan,
    options: {
      ...writerOptions,
      config,
      failFast: options.failFast ?? true
    }
  });
  const validation = validateStructuredSections({ dossierEvidence, fullDossierPlan, sections: generated.sections });
  if (!validation.ok) {
    const error = new Error("Le dossier généré n'a pas passé la validation factuelle finale.");
    error.status = 502;
    error.code = "full_dossier_validation_failed";
    error.validation = validation;
    throw error;
  }
  const relationalGenerated = await writeRelationalSections({
    dossierEvidence,
    plans: relationalPlans,
    options: writerOptions,
    config,
    completedOffset: generated.sections.length
  });
  const relationalValidation = validateStructuredSections({
    dossierEvidence,
    fullDossierPlan: relationalGenerated.plan,
    sections: relationalGenerated.sections
  });
  if (!relationalValidation.ok) {
    const error = new Error("Les axes relationnels générés n'ont pas passé la validation factuelle finale.");
    error.status = 502;
    error.code = "relational_dossier_validation_failed";
    error.validation = relationalValidation;
    throw error;
  }

  const personInfo = { firstName: cleanString(input.firstName), lastName: null };
  const socle = buildSocle(calculation.result, strings);
  socle.person = personInfo;
  const renderedSymbolicSections = generated.sections.map((section) => renderableSection(section, strings));
  const renderedRelationalSections = relationalGenerated.sections.map(renderRelationalSection).filter(Boolean);
  const fullSections = [chartSection(socle, strings), ...renderedSymbolicSections, ...renderedRelationalSections, ...annexSections(socle, strings)];
  const usage = usageSummary([generated.usage, relationalGenerated.usage]);
  const costEstimate =
    usage.promptTokens > 0 || usage.completionTokens > 0
      ? estimateUsageCost(usage.model, usage.promptTokens, usage.completionTokens)
      : null;
  const personLabel = personInfo.firstName || null;
  const title = personLabel ? `${strings.titlePrefix} — ${personLabel}` : strings.titlePrefix;
  const author = process.env.ASTROLAB_AUTHOR_LINE?.trim() || null;
  const aiReview = aiNotice(language);
  const generatedSectionCount = generated.sections.length + relationalGenerated.sections.length;
  const skippedSections = [...generated.skipped, ...relationalGenerated.skipped];
  const rejectedSections = [...generated.rejected, ...relationalGenerated.rejected];
  const verificationNote = `Validation factuelle structurée : ${generatedSectionCount} chapitre(s) validé(s). Contrôle automatique des faits et des règles documentées activé.`;
  const markdown = renderDossierMarkdown({
    title,
    personLabel,
    createdAt: generatedAt,
    sections: fullSections,
    author,
    strings,
    verificationNote,
    aiReview,
    cover: socle.cover ?? null
  });
  const html = renderDossierHtml({
    title,
    personLabel,
    createdAt: generatedAt,
    writerMode: "llm",
    sections: fullSections,
    author,
    strings,
    verificationNote,
    aiReview,
    cover: socle.cover ?? null
  });

  const reading = {
    schema: "astrolab.public_reading",
    service: FULL_DOSSIER_SERVICE_VERSION,
    dossierSchema: "astrolab.full_dossier",
    provenance: provenanceSummary(),
    status: "ready_for_human_review",
    writerMode: "llm",
    language,
    aiReview: { passes: 1, humanReviewed: false, note: aiReview },
    verification: {
      status: "structured_validated",
      provider: "lastro-factual-claims",
      model: usage.model ?? config?.model ?? null,
      issues: [...validation.issues, ...relationalValidation.issues],
      correctedCount: 0,
      rejectedCount: rejectedSections.length,
      skippedSections
    },
    personLabel,
    costEstimate,
    generationMs: Date.now() - startedAt,
    method: {
      methodId: calculation.result.methodId,
      methodVersion: calculation.result.methodVersion,
      productionEligible: false
    },
    dossier: {
      evidenceVersion: dossierEvidence.version,
      planVersion: fullDossierPlan.version,
      sectionCount: fullDossierPlan.sections.length + relationalGenerated.plan.sections.length,
      generatedSectionCount,
      skippedSections,
      rejectedSections
    },
    relationship: {
      schema: RELATIONAL_DOSSIER_SCHEMA,
      product: "Moi en relation",
      axes: ["relational_communication", "relational_affection"],
      sectionCount: relationalGenerated.plan.sections.length,
      generatedSectionCount: relationalGenerated.sections.length,
      skippedSections: relationalGenerated.skipped,
      rejectedSections: relationalGenerated.rejected,
      sections: relationalGenerated.sections
    },
    observability: {
      llmCalls: generated.llmCalls + relationalGenerated.llmCalls,
      promptTokens: usage.promptTokens ?? 0,
      completionTokens: usage.completionTokens ?? 0,
      model: usage.model ?? config?.model ?? null
    },
    sections: [...generated.sections, ...relationalGenerated.sections].map(publicSectionSummary),
    html,
    markdown
  };
  logFullDossier({ startedAt, generated, relationalGenerated, dossierEvidence, fullDossierPlan, validation, reading });
  return reading;
}
