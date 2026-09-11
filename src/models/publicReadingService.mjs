// Public "no account" reading service.
//
// Purpose: let a visitor receive a full reading from birth data alone, without
// creating an account, without an e-mail, and WITHOUT persisting any personal
// data server-side. The calculation is local; the narrative sections call the
// configured LLM; the result (HTML/Markdown) is returned immediately to the
// visitor, who can download it. Nothing about the person is stored.

import { calculateWesternNatalChart } from "../astro/westernNatal.mjs";
import { estimateUsageCost } from "../deliverables/cost.mjs";
import { crossCheckReading } from "../deliverables/crossCheck.mjs";
import { aiReviewNote, docStrings, englishNameFor, normalizeLanguage } from "../deliverables/i18n.mjs";
import { DOSSIER_SECTIONS } from "../deliverables/plan.mjs";
import { annexSections, renderDossierHtml, renderDossierMarkdown } from "../deliverables/render.mjs";
import { buildSocle } from "../deliverables/socle.mjs";
import { provenanceSummary } from "../deliverables/provenance.mjs";
import {
  findBiographicalInvention,
  findSignContradictions,
  findUnfilledPlaceholders
} from "../deliverables/validator.mjs";
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

// Une entrée « parent » sans aucun contenu (rôle seul) ne constitue pas une
// donnée familiale : la section transgénérationnelle ne doit pas exister pour
// un dossier où les parents sont vides.
// « Forces et tensions » n'a de matière que si des indicateurs convergent
// réellement. Aujourd'hui : plusieurs corps dans un même signe (les aspects
// restent inactifs). Sans convergence, la section disparaît.
export function hasConvergentIndicators(bodies = []) {
  const counts = new Map();
  for (const entry of Array.isArray(bodies) ? bodies : []) {
    const sign = entry?.sign ?? null;
    if (!sign) {
      continue;
    }
    counts.set(sign, (counts.get(sign) ?? 0) + 1);
  }
  return [...counts.values()].some((count) => count >= 2);
}

function hasFamilyData(parents) {
  return (Array.isArray(parents) ? parents : []).some((entry) =>
    ["label", "birthDate", "birthPlace"].some((key) => String(entry?.[key] ?? "").trim() !== "")
  );
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
  const language = normalizeLanguage(input.language);
  const strings = docStrings(language);
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
  const socle = buildSocle(calculation.result, strings);
  socle.person = personInfo;
  const context = {
    person: personInfo,
    parents: normalizeParents(input),
    intention: cleanString(input.intention),
    languageName: englishNameFor(language),
    styleGuide: strings.styleGuide ?? null,
    socle,
    // Ce que le calcul n'a pas pu établir : le rédacteur doit le savoir, sinon
    // il invente un ascendant ou des maisons.
    uncertainty: {
      timeKnown: calculation.result.uncertainty?.timePrecision !== "unknown",
      indeterminable: calculation.result.uncertainty?.indeterminable ?? [],
      warnings: calculation.result.uncertainty?.warnings ?? []
    }
  };

  const sections = [];
  const usage = { promptTokens: 0, completionTokens: 0, model: null };

  const parents = normalizeParents(input);

  for (const planSection of DOSSIER_SECTIONS) {
    // Pas de données familiales : la section transgénérationnelle disparaît au
    // lieu d'inventer une histoire d'ancêtres.
    if (planSection.id === "transgenerationnel" && !hasFamilyData(parents)) {
      continue;
    }
    // Section conditionnelle : pas de convergence calculée, pas de section.
    if (
      planSection.requiresConvergence &&
      !hasConvergentIndicators(calculation.result.astronomicalCalculation?.bodies)
    ) {
      continue;
    }
    // Ce qui a déjà été écrit, pour ne pas se répéter d'une section à l'autre.
    context.previousSections = sections.map((written) => ({
      title: written.title,
      excerpt: String(written.text ?? "").slice(0, 240)
    }));
    let section;
    if (planSection.writer === "none") {
      section = {
        id: planSection.id,
        title: strings.sectionTitles[planSection.id] ?? planSection.title,
        rank: planSection.rank,
        badgeCode: planSection.badge.code,
        badgeLabel: strings.badgeUnavailable,
        kind: planSection.kind,
        provider: "none",
        status: "not_available",
        text: strings.unavailableText,
        validation: { ok: true, issues: [] }
      };
    } else {
      let written = await writeSection(planSection, context, options);

      // Une erreur factuelle (« ta Lune en Balance » alors qu'elle est en
      // Cancer) fait perdre confiance définitivement : on réécrit la section,
      // puis on retire les phrases fautives si la réécriture échoue.
      const defauts = (texte) => [
        ...findSignContradictions(texte, context.socle),
        ...findUnfilledPlaceholders(texte),
        ...findBiographicalInvention(texte)
      ];
      let contradictions = defauts(written.text);
      if (contradictions.length > 0) {
        const raisons = contradictions.map((entry) => `« ${entry.sentence.trim()} »`).join(" ");
        console.warn(`[Lastro] texte fautif dans « ${planSection.id} » — réécriture demandée`);
        context.correctionNote = `Ta version précédente contenait des passages à ne jamais livrer : ${raisons} Réécris la section. N'attribue jamais à une planète un signe qui n'est pas le sien, n'invente aucune biographie (pas de responsabilités précoces, de renoncements, de sacrifices, de pression familiale : tu parles de dynamiques symboliques, jamais d'une histoire vécue), et n'écris aucun texte entre crochets, accolades ou chevrons : si tu signes la lettre, utilise le prénom fourni, ou termine sans signature inventée.`;
        written = await writeSection(planSection, context, options);
        context.correctionNote = null;
        contradictions = defauts(written.text);
        if (contradictions.length > 0) {
          const fautives = contradictions.map((entry) => entry.sentence.trim());
          written = {
            ...written,
            text: String(written.text)
              .split(/(?<=[.!?])\s+/)
              .filter((sentence) => !fautives.includes(sentence.trim()))
              .join(" ")
              .trim()
          };
          console.warn(`[Lastro] phrases contradictoires retirées de « ${planSection.id} »`);
        }
      }
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
        title: strings.sectionTitles[planSection.id] ?? planSection.title,
        rank: planSection.rank,
        badgeCode: planSection.badge.code,
        badgeLabel: strings.badgeSymbolic,
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

  // Vérification croisée par un second modèle (Google Gemini), si une clé est configurée.
  const crossCheckFn = options.crossCheckFn ?? crossCheckReading;
  const verification =
    options.crossCheck === false
      ? { status: "skipped", reason: "disabled", provider: null, model: null, issues: [], corrections: {} }
      : await crossCheckFn({ sections, socle, language });
  // Garde-fous : une correction n'est appliquée que si elle est (1) signalée comme
  // une erreur factuelle, (2) une retouche ciblée et non une réécriture, et
  // (3) validée contre les faits calculés. Sinon le texte d'origine est conservé.
  let correctedCount = 0;
  let rejectedCount = 0;
  const similarity = (a, b) => {
    const words = (text) => new Set(String(text).toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []);
    const first = words(a);
    const second = words(b);
    if (first.size === 0 && second.size === 0) return 1;
    let common = 0;
    for (const word of first) {
      if (second.has(word)) common += 1;
    }
    return common / (first.size + second.size - common);
  };

  if (verification.status === "checked" && verification.corrections) {
    for (const [sectionId, correctedText] of Object.entries(verification.corrections)) {
      const target = sections.find((entry) => entry.id === sectionId);
      if (!target || typeof correctedText !== "string") {
        continue;
      }
      const clean = correctedText.trim();
      if (!clean || clean === target.text.trim()) {
        continue;
      }
      const issue = (verification.issues ?? []).find((entry) => entry.section === sectionId);
      const isFactualError = String(issue?.severity ?? "").toLowerCase() === "error";
      const targetedEdit = similarity(target.text, clean) >= 0.6;
      const stillValid =
        options.validate === false
          ? true
          : validateSectionText({ sectionId, text: clean, socle }).ok;
      if (isFactualError && targetedEdit && stillValid) {
        target.text = clean;
        target.crossCheckStatus = "corrected";
        correctedCount += 1;
      } else {
        target.crossCheckStatus = "flagged";
        rejectedCount += 1;
      }
    }
  }
  // Passe finale : le texte définitif (éventuellement corrigé) est re-contrôlé,
  // et le statut de chaque section est recalculé.
  for (const section of sections) {
    if (section.provider === "llm") {
      const finalCheck =
        options.validate === false ? { ok: true, issues: [] } : validateSectionText({ sectionId: section.id, text: section.text, socle });
      section.validation = finalCheck;
      section.status = finalCheck.ok ? "ok" : "needs_review";
    }
    if (!section.crossCheckStatus) {
      section.crossCheckStatus = verification.status === "checked" ? "confirmed" : "not_checked";
    }
  }
  const reviewPasses = 1 + (verification.status === "checked" ? 1 : 0) + 1;

  const fullSections = [...sections, ...annexSections(socle, strings)];
  const writerMode = fullSections.some((section) => section.provider === "llm") ? "llm" : "template";
  const costEstimate =
    usage.promptTokens > 0 || usage.completionTokens > 0
      ? estimateUsageCost(usage.model, usage.promptTokens, usage.completionTokens)
      : null;
  const personLabel = personInfo.firstName ? personInfo.firstName : null;
  const title = personInfo.firstName ? `${strings.titlePrefix} — ${personInfo.firstName}` : strings.titlePrefix;
  const createdAt = new Date().toISOString();
  const author = process.env.ASTROLAB_AUTHOR_LINE?.trim() || null;
  const verificationNote =
    verification.status === "checked"
      ? `Vérification croisée automatique (${verification.model}) : ${verification.issues.length} remarque(s), ${correctedCount} correction(s) appliquée(s)${rejectedCount > 0 ? `, ${rejectedCount} correction(s) écartée(s) par les garde-fous` : ""}. Les données calculées n'ont pas été modifiées.`
      : verification.status === "failed"
        ? "Vérification croisée indisponible pour cette lecture."
        : null;
  const aiReview = aiReviewNote(language, reviewPasses, false);
  const markdown = renderDossierMarkdown({ title, personLabel, createdAt, sections: fullSections, author, strings, verificationNote, aiReview });
  const html = renderDossierHtml({ title, personLabel, createdAt, writerMode, sections: fullSections, author, strings, verificationNote, aiReview });

  return {
    schema: "astrolab.public_reading",
    provenance: provenanceSummary(),
    status: writerMode === "llm" ? "ready_for_human_review" : "template_draft",
    writerMode,
    language,
    aiReview: { passes: reviewPasses, humanReviewed: false, note: aiReview },
    verification: {
      status: verification.status,
      provider: verification.provider ?? null,
      model: verification.model ?? null,
      issues: verification.issues ?? [],
      correctedCount,
      rejectedCount
    },
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
