import { evidenceById } from "./dossierEvidence.mjs";
import { rulesForEvidence, LASTRO_INTERPRETATION_CONVENTIONS } from "./interpretationRules.mjs";

export const FULL_DOSSIER_PLAN_VERSION = "full-dossier-plan@0.1.0";

export const FULL_DOSSIER_SECTIONS = Object.freeze([
  { sectionId: "general_synthesis", objective: "Identifier les dynamiques centrales sans tout interpréter en détail.", minWords: 350, targetWords: 650, maxWords: 900 },
  { sectionId: "identity", objective: "Traiter l'identité consciente et l'axe solaire.", minWords: 500, targetWords: 900, maxWords: 1300 },
  { sectionId: "emotional_world", objective: "Traiter la vie émotionnelle et les aspects lunaires.", minWords: 500, targetWords: 900, maxWords: 1300 },
  { sectionId: "communication", objective: "Traiter pensée, langage et circulation mentale.", minWords: 450, targetWords: 800, maxWords: 1100 },
  { sectionId: "affectivity", objective: "Traiter l'affectivité à partir des faits vénusiens disponibles.", minWords: 450, targetWords: 800, maxWords: 1100 },
  { sectionId: "action", objective: "Traiter désir, action, défense et élan à partir de Mars.", minWords: 450, targetWords: 800, maxWords: 1100 },
  { sectionId: "relationships", objective: "Relier les faits relationnels exploitables sans inventer de relation réelle.", minWords: 450, targetWords: 850, maxWords: 1200 },
  { sectionId: "creativity", objective: "Décrire les modes d'expression créative uniquement depuis des preuves autorisées.", minWords: 350, targetWords: 650, maxWords: 950 },
  { sectionId: "work_realization", objective: "Décrire réalisation et travail sans prédire de métier.", minWords: 450, targetWords: 850, maxWords: 1200 },
  { sectionId: "security_resources", objective: "Décrire sécurité, ressources et ancrage depuis les preuves disponibles.", minWords: 400, targetWords: 750, maxWords: 1050 },
  { sectionId: "internal_tensions", objective: "Traiter les tensions structurantes définies par convention Lastro.", minWords: 450, targetWords: 850, maxWords: 1200 },
  { sectionId: "supporting_resources", objective: "Traiter les soutiens structurants définis par convention Lastro.", minWords: 400, targetWords: 750, maxWords: 1050 },
  { sectionId: "houses", objective: "Lire les maisons Whole Sign seulement lorsqu'elles sont exploitables.", minWords: 450, targetWords: 900, maxWords: 1300 },
  { sectionId: "major_aspects", objective: "Présenter les grands aspects sans reclasser librement leur portée.", minWords: 550, targetWords: 1000, maxWords: 1500 },
  { sectionId: "current_sky", objective: "Présenter l'instantané daté des transits CURRENT.", minWords: 300, targetWords: 600, maxWords: 900 },
  { sectionId: "next_weeks", objective: "Présenter l'instantané daté des transits UPCOMING sur l'horizon disponible.", minWords: 300, targetWords: 650, maxWords: 950 },
  { sectionId: "conclusion", objective: "Conclure par dynamiques, tensions, ressources et questions ouvertes.", minWords: 450, targetWords: 850, maxWords: 1200 }
]);

function keyBody(value) {
  return String(value ?? "").toLowerCase();
}

function sectionOwnerForEvidence(evidence) {
  if (!evidence) return null;
  const value = evidence.value ?? {};
  if (evidence.type === "TRANSIT_SNAPSHOT") return "current_sky";
  if (evidence.type === "PERSONAL_TRANSIT") return value.status === "UPCOMING" ? "next_weeks" : "current_sky";
  if (evidence.type === "NATAL_ASPECT") {
    const bodies = [value.bodyA, value.bodyB].map(keyBody);
    if (bodies.includes("moon")) return "emotional_world";
    if (bodies.includes("sun")) return "identity";
    return "major_aspects";
  }
  if (evidence.type === "NATAL_BODY_SIGN" || evidence.type === "NATAL_BODY_RETROGRADE" || evidence.type === "NATAL_BODY_HOUSE") {
    const body = keyBody(value.body);
    if (body === "sun") return "identity";
    if (body === "moon") return "emotional_world";
    if (body === "mercury") return "communication";
    if (body === "venus") return "affectivity";
    if (body === "mars") return "action";
    if (body === "saturn") return "work_realization";
  }
  if (evidence.type === "ANGLE_SIGN") return "identity";
  if (evidence.type.startsWith("DISTRIBUTION_")) return "general_synthesis";
  return null;
}

function secondarySectionsForEvidence(evidence) {
  if (!evidence) return [];
  const value = evidence.value ?? {};
  if (evidence.type === "NATAL_BODY_SIGN" && value.body === "Venus") return ["relationships", "security_resources"];
  if (evidence.type === "NATAL_BODY_SIGN" && value.body === "Sun") return ["general_synthesis", "work_realization", "conclusion"];
  if (evidence.type === "NATAL_BODY_SIGN" && value.body === "Moon") return ["general_synthesis", "relationships", "conclusion"];
  if (evidence.type === "NATAL_ASPECT") return ["general_synthesis", "internal_tensions", "major_aspects", "conclusion"];
  if (evidence.type === "PERSONAL_TRANSIT") return ["general_synthesis"];
  return ["general_synthesis", "conclusion"];
}

function sectionsMap() {
  return new Map(FULL_DOSSIER_SECTIONS.map((section) => [section.sectionId, { ...section, primaryEvidenceRefs: [], secondaryEvidenceRefs: [], forbiddenEvidenceRefs: [], allowedInterpretationRuleRefs: [], preconditions: [] }]));
}

export function buildFullDossierPlan(dossierEvidence) {
  const byId = evidenceById(dossierEvidence);
  const sections = sectionsMap();
  const ownerByEvidenceRef = {};

  for (const evidence of byId.values()) {
    const owner = sectionOwnerForEvidence(evidence);
    if (owner && sections.has(owner)) {
      sections.get(owner).primaryEvidenceRefs.push(evidence.evidenceId);
      ownerByEvidenceRef[evidence.evidenceId] = owner;
    }
    for (const secondary of secondarySectionsForEvidence(evidence)) {
      if (secondary !== owner && sections.has(secondary)) {
        sections.get(secondary).secondaryEvidenceRefs.push(evidence.evidenceId);
      }
    }
    const ruleIds = rulesForEvidence(evidence).map((rule) => rule.ruleId);
    for (const section of sections.values()) {
      if (section.primaryEvidenceRefs.includes(evidence.evidenceId) || section.secondaryEvidenceRefs.includes(evidence.evidenceId)) {
        section.allowedInterpretationRuleRefs.push(...ruleIds);
      }
    }
  }

  const allRefs = [...byId.keys()];
  for (const section of sections.values()) {
    section.primaryEvidenceRefs = [...new Set(section.primaryEvidenceRefs)];
    section.secondaryEvidenceRefs = [...new Set(section.secondaryEvidenceRefs)];
    section.allowedInterpretationRuleRefs = [...new Set(section.allowedInterpretationRuleRefs)];
    const allowed = new Set([...section.primaryEvidenceRefs, ...section.secondaryEvidenceRefs]);
    section.forbiddenEvidenceRefs = allRefs.filter((ref) => !allowed.has(ref));
    section.alreadyInterpretedEvidenceRefs = section.secondaryEvidenceRefs.filter((ref) => ownerByEvidenceRef[ref] && ownerByEvidenceRef[ref] !== section.sectionId);
    if (section.sectionId === "houses" && !allRefs.some((ref) => /\.house$/.test(ref))) {
      section.preconditions.push({ status: "unavailable", reason: "houses_unavailable_for_birth_time" });
    }
    if (section.sectionId === "current_sky") {
      section.preconditions.push({ status: "snapshot", label: "Calculé le", evidenceRef: "transits.snapshot" });
    }
  }

  return {
    schema: "astrolab.full_dossier_plan",
    version: FULL_DOSSIER_PLAN_VERSION,
    interpretationConventions: LASTRO_INTERPRETATION_CONVENTIONS,
    ownerByEvidenceRef,
    sections: [...sections.values()]
  };
}

export function sectionPlanById(fullDossierPlan, sectionId) {
  return (fullDossierPlan?.sections ?? []).find((section) => section.sectionId === sectionId) ?? null;
}
