// Client dossier service — asynchronous generation with progress.
//
// POST starts a background job (fast response) that writes each dossier section
// one by one (LLM or template), updates the deliverable progress, validates every
// section, and finally stores the full versioned artefact (HTML + Markdown).
// The client polls GET /api/deliverables/:id while status is "generating".

import { dossierSectionsInOrder } from "../deliverables/plan.mjs";
import { estimateUsageCost } from "../deliverables/cost.mjs";
import { aiReviewNote } from "../deliverables/i18n.mjs";
import { annexSections, renderDossierHtml, renderDossierMarkdown } from "../deliverables/render.mjs";
import { buildSocle } from "../deliverables/socle.mjs";
import { validateSectionText } from "../deliverables/validator.mjs";
import { writeSection } from "../deliverables/writers.mjs";
import { hasConvergentIndicators } from "./publicReadingService.mjs";
import { calculateWesternNatalForUser } from "./natalCalculationService.mjs";

const GENERATION_STALE_AFTER_MS = 10 * 60 * 1000;
const TOTAL_STEPS = dossierSectionsInOrder().length + 1; // sections + annexe socle

function nowIso() {
  return new Date().toISOString();
}

function requirePerson(state, userId, personId) {
  const person = personId
    ? state.persons.find((entry) => entry.ownerUserId === userId && entry.id === personId)
    : state.persons.find((entry) => entry.ownerUserId === userId && entry.isPrimary);
  if (!person) {
    const error = new Error("Person not found");
    error.status = 404;
    throw error;
  }
  return person;
}

function findDeliverable(state, userId, deliverableId) {
  const deliverable = (state.deliverables ?? []).find(
    (entry) => entry.ownerUserId === userId && entry.id === deliverableId
  );
  if (!deliverable) {
    const error = new Error("Deliverable not found");
    error.status = 404;
    throw error;
  }
  return deliverable;
}

function normalizeParents(input = {}) {
  const candidates = Array.isArray(input.parents) ? input.parents : [];
  return candidates
    .filter((entry) => entry && (entry.label || entry.role))
    .map((entry, index) => ({
      role: String(entry.role ?? (index === 0 ? "mother" : "father")),
      label: String(entry.label ?? "").trim() || null,
      birthDate: String(entry.birthDate ?? "").trim() || null,
      birthPlace: String(entry.birthPlace ?? "").trim() || null,
      note: String(entry.note ?? "").trim() || null
    }));
}

function sectionStatusFor(provider, validation) {
  if (provider === "template") {
    return "template_draft";
  }
  return validation.ok ? "ok" : "needs_review";
}

function overallStatus(sections, writerMode) {
  if (sections.some((section) => section.status === "needs_review")) {
    return "needs_review";
  }
  if (writerMode === "template") {
    return "template_draft";
  }
  return "ready_for_human_review";
}

function audit(state, store, userId, action, subjectId, before, after) {
  state.auditLogs ??= [];
  state.auditLogs.push({
    id: store.id("audit"),
    actorUserId: userId,
    ownerUserId: userId,
    action,
    subjectType: "Deliverable",
    subjectId,
    before,
    after,
    createdAt: nowIso()
  });
}

function publicDeliverable(deliverable, version) {
  return {
    deliverable: {
      id: deliverable.id,
      personId: deliverable.personId,
      personLabel: deliverable.personLabel,
      status: deliverable.status,
      writerMode: deliverable.writerMode ?? null,
      progress: deliverable.progress ?? null,
      error: deliverable.error ?? null,
      costEstimate: deliverable.costEstimate ?? null,
      createdAt: deliverable.createdAt,
      updatedAt: deliverable.updatedAt,
      reviewedByHuman: deliverable.reviewedByHuman ?? false,
      reviewedAt: deliverable.reviewedAt ?? null,
      reviewNote: deliverable.reviewNote ?? null,
      calculationRunId: deliverable.calculationRunId ?? null,
      currentVersionId: deliverable.currentVersionId ?? null
    },
    version: version
      ? {
          id: version.id,
          versionNumber: version.versionNumber,
          createdAt: version.createdAt,
          title: version.title,
          resultHash: version.resultHash,
          costEstimate: version.costEstimate ?? null,
          sections: version.sections.map((section) => ({
            id: section.id,
            title: section.title,
            badgeCode: section.badgeCode,
            badgeLabel: section.badgeLabel,
            status: section.status,
            provider: section.provider,
            validation: section.validation
          }))
        }
      : null
  };
}

export async function startDeliverableGeneration(store, userId, input = {}, options = {}) {
  const calculation = await calculateWesternNatalForUser(store, userId, { personId: input.personId });

  const { person, personInfo, personLabel, context, createdAt } = await store.transact((state) => {
    const existingGenerating = (state.deliverables ?? []).find(
      (entry) => entry.ownerUserId === userId && entry.personId === input.personId && entry.status === "generating"
    );
    if (existingGenerating) {
      const error = new Error("Une génération de dossier est déjà en cours pour cette personne. Patientez ou supprimez-la.");
      error.status = 409;
      throw error;
    }
    const person = requirePerson(state, userId, input.personId);
    const personInfo = { firstName: person.firstName ?? null, lastName: person.lastName ?? null };
    const personLabel = [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.id;
    const socle = buildSocle(calculation.result);
    socle.person = personInfo;
    const context = {
      person: personInfo,
      parents: normalizeParents(input),
      intention: String(input.intention ?? "").trim() || null,
      socle,
      uncertainty: {
        timeKnown: calculation.result.uncertainty?.timePrecision !== "unknown",
        indeterminable: calculation.result.uncertainty?.indeterminable ?? [],
        warnings: calculation.result.uncertainty?.warnings ?? [],
        languageCap: socle.timeLanguageCap ?? null
      }
    };
    return { person, personInfo, personLabel, context, createdAt: nowIso() };
  });

  const deliverableId = store.id("dlv");
  const deliverable = {
    id: deliverableId,
    ownerUserId: userId,
    personId: person.id,
    personLabel,
    status: "generating",
    writerMode: null,
    progress: {
      phase: "writing",
      completedSteps: 0,
      totalSteps: TOTAL_STEPS,
      currentSection: null
    },
    error: null,
    costEstimate: null,
    createdAt,
    updatedAt: createdAt,
    currentVersionId: null,
    calculationRunId: calculation.calculationRun.id,
    reviewedByHuman: false,
    reviewedAt: null,
    reviewNote: null
  };

  await store.transact((state) => {
    state.deliverables ??= [];
    state.deliverables.push(deliverable);
    audit(state, store, userId, "deliverable.dossier.started", deliverableId, null, { personId: person.id });
  });

  // Génération en arrière-plan (jamais bloquante pour la réponse HTTP).
  finishDeliverableGeneration(store, userId, deliverableId, {
    person,
    personInfo,
    personLabel,
    context,
    createdAt,
    calculationRunHash: calculation.calculationRun.resultHash,
    options
  }).catch(() => {});

  return publicDeliverable(deliverable, null);
}

async function finishDeliverableGeneration(store, userId, deliverableId, payload) {
  const { person, personInfo, context, createdAt } = payload;
  try {
    const sections = [];
    // Sections réellement rédigées, pour l'anti-répétition d'une section à l'autre.
    const writtenSections = [];
    const currentStep = { completed: 0 };
    const usage = { promptTokens: 0, completionTokens: 0, model: null };

    const publishProgress = async (completedSteps, currentSection) => {
      currentStep.completed = completedSteps;
      await store.transact((state) => {
        const deliverable = (state.deliverables ?? []).find(
          (entry) => entry.ownerUserId === userId && entry.id === deliverableId
        );
        if (!deliverable) {
          const stop = new Error("cancelled");
          stop.code = "CANCELLED";
          throw stop;
        }
        if (deliverable.status !== "generating") {
          const stop = new Error("cancelled");
          stop.code = "CANCELLED";
          throw stop;
        }
        deliverable.progress = {
          phase: "writing",
          completedSteps,
          totalSteps: TOTAL_STEPS,
          currentSection: currentSection ? { id: currentSection.id, title: currentSection.title } : null
        };
        deliverable.updatedAt = nowIso();
      });
    };

    // Les parents normalisés sont déjà dans le contexte : `input` n'existe plus
    // à ce niveau (la génération tourne en arrière-plan).
    const proParents = Array.isArray(context.parents) ? context.parents : [];
    const proHasFamily = proParents.some((entry) =>
      ["label", "birthDate", "birthPlace"].some((key) => String(entry?.[key] ?? "").trim() !== "")
    );

    for (const planSection of dossierSectionsInOrder()) {
      // Mêmes règles que la lecture publique : sans données familiales, la
      // section transgénérationnelle disparaît au lieu d'inventer des ancêtres.
      if (planSection.id === "transgenerationnel" && !proHasFamily) {
        continue;
      }
      // Section conditionnelle : pas d'indicateurs robustes, pas de section.
      if (
        planSection.requiresConvergence &&
        !hasConvergentIndicators(context.socle?.bodies, context.socle)
      ) {
        continue;
      }
      context.previousSections = writtenSections.map((written) => ({
        title: written.title,
        excerpt: String(written.text ?? "").slice(0, 240)
      }));
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
          text: `${planSection.note}\n\nAucune prédiction d'événement n'est produite : ce module livrera des fenêtres larges, des thèmes de maturation et des postures intérieures (0–1 an, 1–3 ans, 3–5 ans).`,
          validation: { ok: true, issues: [] }
        };
      } else {
        const written = await writeSection(planSection, context, payload.options);
        if (written.usage) {
          usage.model = usage.model ?? written.model ?? null;
          usage.promptTokens += written.usage.promptTokens ?? 0;
          usage.completionTokens += written.usage.completionTokens ?? 0;
        }
        const validation =
          payload.options.validate === false
            ? { ok: true, issues: [] }
            : validateSectionText({ sectionId: planSection.id, text: written.text, socle: context.socle });
        section = {
          id: planSection.id,
          title: planSection.title,
          rank: planSection.rank,
          badgeCode: planSection.badge.code,
          badgeLabel: planSection.badge.label,
          kind: planSection.kind,
          provider: written.provider,
          model: written.model ?? null,
          status: sectionStatusFor(written.provider, validation),
          text: written.text,
          validation
        };
      }
      sections.push(section);
      // Les sections « non disponibles » ne comptent pas comme déjà écrites.
      if (planSection.writer !== "none") {
        writtenSections.push(section);
      }
      await publishProgress(currentStep.completed + 1, null);
    }

    const fullSections = [...sections, ...annexSections(context.socle)];
    const writerMode = fullSections.some((section) => section.provider === "llm") ? "llm" : "template";
    const status = overallStatus(sections, writerMode);
    const title = `Dossier de lecture — ${payload.personLabel}`;
    const author = process.env.ASTROLAB_AUTHOR_LINE?.trim() || null;
    const markdown = renderDossierMarkdown({ title, personLabel: payload.personLabel, createdAt, sections: fullSections, author });
    const html = renderDossierHtml({ title, personLabel: payload.personLabel, createdAt, writerMode, sections: fullSections, author });
    const costEstimate =
      usage.promptTokens > 0 || usage.completionTokens > 0
        ? estimateUsageCost(usage.model, usage.promptTokens, usage.completionTokens)
        : null;

    await store.transact((state) => {
      state.deliverableVersions ??= [];
      const deliverable = (state.deliverables ?? []).find(
        (entry) => entry.ownerUserId === userId && entry.id === deliverableId
      );
      if (!deliverable) {
        const stop = new Error("cancelled");
        stop.code = "CANCELLED";
        throw stop;
      }
      const versionId = store.id("dlvver");
      const version = {
        id: versionId,
        deliverableId,
        versionNumber: 1,
        createdAt,
        title,
        person: personInfo,
        resultHash: payload.calculationRunHash ?? null,
        intention: context.intention,
        parents: context.parents,
        costEstimate,
        sections: fullSections,
        markdown,
        html,
        reviewedByHuman: false
      };
      state.deliverableVersions.push(version);
      deliverable.status = status;
      deliverable.writerMode = writerMode;
      deliverable.currentVersionId = versionId;
      deliverable.costEstimate = costEstimate;
      deliverable.progress = { phase: "done", completedSteps: TOTAL_STEPS, totalSteps: TOTAL_STEPS, currentSection: null };
      deliverable.updatedAt = nowIso();
      audit(state, store, userId, "deliverable.dossier.created", deliverableId, null, {
        personId: person.id,
        status,
        writerMode,
        versionId
      });
    });
  } catch (error) {
    if (error.code === "CANCELLED") {
      return;
    }
    try {
      await store.transact((state) => {
        const deliverable = (state.deliverables ?? []).find(
          (entry) => entry.ownerUserId === userId && entry.id === deliverableId
        );
        if (!deliverable) {
          return;
        }
        deliverable.status = "failed";
        deliverable.error = error.message;
        deliverable.updatedAt = nowIso();
        audit(state, store, userId, "deliverable.dossier.failed", deliverableId, null, { error: error.message });
      });
    } catch {
      // dernier recours : ne pas faire planter le process
    }
  }
}

function markStaleIfNeeded(state, deliverable) {
  if (deliverable.status === "generating") {
    const updatedAt = Date.parse(deliverable.updatedAt ?? deliverable.createdAt) || 0;
    if (Date.now() - updatedAt > GENERATION_STALE_AFTER_MS) {
      deliverable.status = "failed";
      deliverable.error = "Génération interrompue (serveur redémarré). Relancez la génération.";
      deliverable.updatedAt = nowIso();
    }
  }
}

export function listDeliverables(store, userId) {
  return store.transact((state) => {
    const deliverables = (state.deliverables ?? [])
      .filter((entry) => entry.ownerUserId === userId)
      .map((entry) => {
        markStaleIfNeeded(state, entry);
        const version = entry.currentVersionId
          ? (state.deliverableVersions ?? []).find((candidate) => candidate.id === entry.currentVersionId)
          : null;
        return {
          id: entry.id,
          personId: entry.personId,
          personLabel: entry.personLabel,
          title: version?.title ?? `Dossier de lecture — ${entry.personLabel}`,
          status: entry.status,
          writerMode: entry.writerMode ?? null,
          progress: entry.progress ?? null,
          error: entry.error ?? null,
          costEstimate: entry.costEstimate ?? null,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          reviewedByHuman: entry.reviewedByHuman ?? false,
          reviewedAt: entry.reviewedAt ?? null,
          reviewNote: entry.reviewNote ?? null
        };
      })
      .sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt)));
    return { deliverables };
  });
}

export function markDeliverableReviewed(store, userId, deliverableId, input = {}) {
  return store.transact((state) => {
    const deliverable = findDeliverable(state, userId, deliverableId);
    if (deliverable.status === "generating") {
      const error = new Error("Impossible de relire un dossier encore en cours de génération.");
      error.status = 409;
      throw error;
    }
    if (deliverable.status === "failed" || !deliverable.currentVersionId) {
      const error = new Error("Impossible de relire un dossier en échec. Régénérez-le.");
      error.status = 409;
      throw error;
    }
    deliverable.reviewedByHuman = input.reviewed !== false;
    deliverable.reviewedAt = nowIso();
    deliverable.reviewNote = String(input.note ?? "").trim() || null;
    deliverable.updatedAt = nowIso();
    audit(
      state,
      store,
      userId,
      deliverable.reviewedByHuman ? "deliverable.dossier.reviewed" : "deliverable.dossier.review_unmarked",
      deliverableId,
      null,
      { reviewedByHuman: deliverable.reviewedByHuman, reviewNote: deliverable.reviewNote }
    );
    const version = (state.deliverableVersions ?? []).find((entry) => entry.id === deliverable.currentVersionId);
    if (version) {
      const aiReview = aiReviewNote("fr", 2, deliverable.reviewedByHuman);
      version.aiReview = aiReview;
      version.markdown = renderDossierMarkdown({
        title: version.title,
        personLabel: deliverable.personLabel,
        createdAt: version.createdAt,
        sections: version.sections,
        aiReview
      });
      version.html = renderDossierHtml({
        title: version.title,
        personLabel: deliverable.personLabel,
        createdAt: version.createdAt,
        writerMode: deliverable.writerMode ?? "llm",
        sections: version.sections,
        aiReview
      });
    }
    return publicDeliverable(deliverable, version);
  });
}

export function getDeliverable(store, userId, deliverableId) {
  return store.transact((state) => {
    const deliverable = findDeliverable(state, userId, deliverableId);
    markStaleIfNeeded(state, deliverable);
    const version = deliverable.currentVersionId
      ? (state.deliverableVersions ?? []).find((entry) => entry.id === deliverable.currentVersionId)
      : null;
    return publicDeliverable(deliverable, version);
  });
}

export function getDeliverableContent(store, userId, deliverableId) {
  return store.transact((state) => {
    const deliverable = findDeliverable(state, userId, deliverableId);
    markStaleIfNeeded(state, deliverable);
    if (deliverable.status === "generating") {
      const error = new Error("Le dossier est encore en cours de génération. Patientez quelques secondes puis réessayez.");
      error.status = 409;
      throw error;
    }
    if (deliverable.status === "failed" || !deliverable.currentVersionId) {
      const error = new Error(deliverable.error ?? "La génération du dossier a échoué. Relancez-la.");
      error.status = 409;
      throw error;
    }
    const version = (state.deliverableVersions ?? []).find((entry) => entry.id === deliverable.currentVersionId);
    return { deliverable, version };
  });
}

export function deleteDeliverable(store, userId, deliverableId) {
  return store.transact((state) => {
    const index = (state.deliverables ?? []).findIndex(
      (entry) => entry.ownerUserId === userId && entry.id === deliverableId
    );
    if (index === -1) {
      const error = new Error("Deliverable not found");
      error.status = 404;
      throw error;
    }
    const [removed] = state.deliverables.splice(index, 1);
    state.deliverableVersions = (state.deliverableVersions ?? []).filter(
      (entry) => entry.deliverableId !== deliverableId
    );
    audit(state, store, userId, "deliverable.dossier.deleted", deliverableId, { personId: removed.personId }, null);
    return { ok: true, id: deliverableId };
  });
}
