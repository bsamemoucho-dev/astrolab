import { calculateWesternNatalChart } from "../astro/westernNatal.mjs";
import { buildDossierEvidence } from "../deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../deliverables/fullDossierPlan.mjs";
import { writeStructuredSectionsWithLlm } from "../deliverables/structuredSectionWriter.mjs";
import { validateStructuredSections } from "../deliverables/factualClaimsValidator.mjs";
import { chartSection } from "../deliverables/chart.mjs";
import { estimateUsageCost } from "../deliverables/cost.mjs";
import { aiNotice, docStrings, normalizeLanguage } from "../deliverables/i18n.mjs";
import { annexSections, renderDossierHtml, renderDossierMarkdown } from "../deliverables/render.mjs";
import { buildSocle } from "../deliverables/socle.mjs";
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
  conclusion: "Conclusion"
});

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

function logFullDossier({ startedAt, generated, dossierEvidence, fullDossierPlan, validation, reading }) {
  const line = {
    event: "full_dossier.generated",
    serviceVersion: FULL_DOSSIER_SERVICE_VERSION,
    generationMs: Date.now() - startedAt,
    writerMode: reading.writerMode,
    status: reading.status,
    sectionsGenerated: generated.sections.length,
    sectionsSkipped: generated.skipped.length,
    sectionsRejected: generated.rejected.length,
    llmCalls: generated.llmCalls,
    promptTokens: generated.usage?.promptTokens ?? 0,
    completionTokens: generated.usage?.completionTokens ?? 0,
    model: generated.usage?.model ?? null,
    evidenceCount: dossierEvidence.evidence.length,
    planSections: fullDossierPlan.sections.length,
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
  const config = options.config ?? llmConfiguration();
  const generated = await writeStructuredSectionsWithLlm({
    dossierEvidence,
    fullDossierPlan,
    options: {
      ...options,
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

  const personInfo = { firstName: cleanString(input.firstName), lastName: null };
  const socle = buildSocle(calculation.result, strings);
  socle.person = personInfo;
  const renderedSymbolicSections = generated.sections.map((section) => renderableSection(section, strings));
  const fullSections = [chartSection(socle, strings), ...renderedSymbolicSections, ...annexSections(socle, strings)];
  const usage = generated.usage ?? {};
  const costEstimate =
    usage.promptTokens > 0 || usage.completionTokens > 0
      ? estimateUsageCost(usage.model, usage.promptTokens, usage.completionTokens)
      : null;
  const personLabel = personInfo.firstName || null;
  const title = personLabel ? `${strings.titlePrefix} — ${personLabel}` : strings.titlePrefix;
  const author = process.env.ASTROLAB_AUTHOR_LINE?.trim() || null;
  const aiReview = aiNotice(language);
  const verificationNote = `Validation factuelle structurée : ${generated.sections.length} chapitre(s) validé(s). Contrôle automatique des faits et des règles documentées activé.`;
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
      issues: validation.issues,
      correctedCount: 0,
      rejectedCount: generated.rejected.length,
      skippedSections: generated.skipped
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
      sectionCount: fullDossierPlan.sections.length,
      generatedSectionCount: generated.sections.length,
      skippedSections: generated.skipped,
      rejectedSections: generated.rejected
    },
    observability: {
      llmCalls: generated.llmCalls,
      promptTokens: usage.promptTokens ?? 0,
      completionTokens: usage.completionTokens ?? 0,
      model: usage.model ?? config?.model ?? null
    },
    sections: generated.sections.map(publicSectionSummary),
    html,
    markdown
  };
  logFullDossier({ startedAt, generated, dossierEvidence, fullDossierPlan, validation, reading });
  return reading;
}
