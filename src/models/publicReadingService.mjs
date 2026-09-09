// Public "no account" reading service.
//
// Purpose: let a visitor receive a full reading from birth data alone, without
// creating an account, without an e-mail, and WITHOUT persisting any personal
// data server-side. The calculation is local; the narrative sections call the
// configured LLM; the result (HTML/Markdown) is returned immediately to the
// visitor, who can download it. Nothing about the person is stored.

import { calculateWesternNatalChart } from "../astro/westernNatal.mjs";
import { estimateUsageCost } from "../deliverables/cost.mjs";
import { DOSSIER_SECTIONS } from "../deliverables/plan.mjs";
import { annexSections, renderDossierHtml, renderDossierMarkdown } from "../deliverables/render.mjs";
import { buildSocle } from "../deliverables/socle.mjs";
import { validateSectionText } from "../deliverables/validator.mjs";
import { writeSection } from "../deliverables/writers.mjs";

function cleanString(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
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

export async function createPublicReading(input = {}, options = {}) {
  const startedAt = Date.now();
  const birthDate = cleanString(input.birthDate);
  if (!birthDate) {
    const error = new Error("La date de naissance est requise.");
    error.status = 400;
    throw error;
  }
  const place = normalizePlace(input);

  const calculation = calculateWesternNatalChart({
    personId: null,
    birthDate,
    timePrecision: input.timePrecision ?? "unknown",
    timeValue: cleanString(input.timeValue),
    timeStart: cleanString(input.timeStart),
    timeEnd: cleanString(input.timeEnd),
    placeName: place.placeName,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    timeZone: place.timeZone,
    resolvedPlace: place.resolvedPlace,
    coordinateSource: input.coordinateSource ?? place.resolvedPlace?.resolutionSource ?? "user_provided",
    coordinateConfidence: input.coordinateConfidence ?? place.resolvedPlace?.confidence ?? "unverified"
  });

  const personInfo = { firstName: cleanString(input.firstName) ?? null, lastName: null };
  const socle = buildSocle(calculation.result);
  socle.person = personInfo;
  const context = {
    person: personInfo,
    parents: normalizeParents(input),
    intention: cleanString(input.intention),
    socle
  };

  const sections = [];
  const usage = { promptTokens: 0, completionTokens: 0, model: null };

  for (const planSection of DOSSIER_SECTIONS) {
    let section;
    if (planSection.writer === "none") {
      section = {
        id: planSection.id,
        title: planSection.title,
        rank: planSection.rank,
        badgeCode: planSection.badge.code,
        badgeLabel: planSection.badge.label,
        kind: planSection.kind,
        provider: "none",
        status: "not_available",
        text: `${planSection.note}\n\nAucune prédiction d'événement n'est produite.`,
        validation: { ok: true, issues: [] }
      };
    } else {
      const written = await writeSection(planSection, context, options);
      if (written.usage) {
        usage.model = usage.model ?? written.model ?? null;
        usage.promptTokens += written.usage.promptTokens ?? 0;
        usage.completionTokens += written.usage.completionTokens ?? 0;
      }
      const validation =
        options.validate === false
          ? { ok: true, issues: [] }
          : validateSectionText({ sectionId: planSection.id, text: written.text, socle });
      section = {
        id: planSection.id,
        title: planSection.title,
        rank: planSection.rank,
        badgeCode: planSection.badge.code,
        badgeLabel: planSection.badge.label,
        kind: planSection.kind,
        provider: written.provider,
        model: written.model ?? null,
        status: written.provider === "template" ? "template_draft" : validation.ok ? "ok" : "needs_review",
        text: written.text,
        validation
      };
    }
    sections.push(section);
  }

  const fullSections = [...sections, ...annexSections(socle)];
  const writerMode = fullSections.some((section) => section.provider === "llm") ? "llm" : "template";
  const costEstimate =
    usage.promptTokens > 0 || usage.completionTokens > 0
      ? estimateUsageCost(usage.model, usage.promptTokens, usage.completionTokens)
      : null;
  const personLabel = personInfo.firstName ? `pour ${personInfo.firstName}` : "";
  const title = `Lecture symbolique ${personLabel}`.trim();
  const createdAt = new Date().toISOString();
  const markdown = renderDossierMarkdown({ title, personLabel: personInfo.firstName ?? null, createdAt, sections: fullSections });
  const html = renderDossierHtml({ title, personLabel: personInfo.firstName ?? null, createdAt, writerMode, sections: fullSections });

  return {
    schema: "astrolab.public_reading",
    status: writerMode === "llm" ? "ready_for_human_review" : "template_draft",
    writerMode,
    personLabel: personInfo.firstName ?? null,
    costEstimate,
    generationMs: Date.now() - startedAt,
    method: {
      methodId: calculation.result.methodId,
      methodVersion: calculation.result.methodVersion,
      productionEligible: false
    },
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      status: section.status,
      provider: section.provider
    })),
    html,
    markdown
  };
}
