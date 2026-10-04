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

function evidencePriority(ref) {
  if (ref === "distribution.element.earth") return 1;
  if (ref === "natal.sun.sign") return 2;
  if (ref === "natal.moon.sign") return 3;
  if (ref === "natal.mercury.sign") return 4;
  if (ref.startsWith("aspect.")) return 5;
  if (ref === "natal.venus.sign") return 6;
  if (ref === "natal.mars.sign") return 7;
  if (ref.startsWith("distribution.")) return 8;
  if (ref === "transits.snapshot") return 8;
  if (ref.startsWith("transit.")) return 9;
  return 50;
}

function capSectionEvidence(section) {
  if (section.sectionId === "general_synthesis") {
    const selected = new Set(
      [...section.primaryEvidenceRefs, ...section.secondaryEvidenceRefs]
        .sort((a, b) => evidencePriority(a) - evidencePriority(b) || a.localeCompare(b))
        .slice(0, 5)
    );
    section.primaryEvidenceRefs = section.primaryEvidenceRefs.filter((ref) => selected.has(ref));
    section.secondaryEvidenceRefs = section.secondaryEvidenceRefs.filter((ref) => selected.has(ref));
  }
  if (section.sectionId === "next_weeks") {
    section.primaryEvidenceRefs = section.primaryEvidenceRefs.slice(0, 8);
    section.secondaryEvidenceRefs = section.secondaryEvidenceRefs.slice(0, 4);
  }
}

function packetKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function claimsForEvidence(evidence) {
  const value = evidence?.value ?? {};
  if (evidence?.type === "NATAL_BODY_SIGN") {
    return [{ type: "NATAL_BODY_SIGN", body: value.body, sign: value.sign, evidenceRefs: [evidence.evidenceId] }];
  }
  if (evidence?.type === "NATAL_BODY_HOUSE") {
    return [{ type: "NATAL_BODY_HOUSE", body: value.body, house: value.house, houseSystem: value.houseSystem, evidenceRefs: [evidence.evidenceId] }];
  }
  if (evidence?.type === "ANGLE_SIGN") {
    return [{ type: "ANGLE_SIGN", angle: value.angle, sign: value.sign, evidenceRefs: [evidence.evidenceId] }];
  }
  if (evidence?.type === "NATAL_ASPECT") {
    return [{ type: "NATAL_ASPECT", bodyA: value.bodyA, bodyB: value.bodyB, aspectType: value.aspectType, orb: value.orb, evidenceRefs: [evidence.evidenceId] }];
  }
  if (evidence?.type === "NATAL_BODY_RETROGRADE") {
    return [{ type: "NATAL_BODY_RETROGRADE", body: value.body, retrograde: value.retrograde, evidenceRefs: [evidence.evidenceId] }];
  }
  if (evidence?.type === "DISTRIBUTION_ELEMENT_COUNT") {
    return [{ type: "DISTRIBUTION_COUNT", element: value.element, count: value.count, evidenceRefs: [evidence.evidenceId] }];
  }
  if (evidence?.type === "DISTRIBUTION_MODALITY_COUNT") {
    return [{ type: "DISTRIBUTION_COUNT", modality: value.modality, count: value.count, evidenceRefs: [evidence.evidenceId] }];
  }
  if (evidence?.type === "PERSONAL_TRANSIT") {
    return [
      {
        type: "PERSONAL_TRANSIT",
        transitBody: value.transitBody,
        natalPoint: value.natalPoint,
        aspectType: value.aspectType,
        exactAt: value.exactAt,
        startsAt: value.startsAt,
        endsAt: value.endsAt,
        phase: value.phase,
        natalHouse: value.natalHouse,
        orb: value.orb,
        evidenceRefs: [evidence.evidenceId]
      }
    ];
  }
  return [];
}

function packetForEvidence({ section, evidence, ruleIds, ownerByEvidenceRef }) {
  const evidenceOwner = ownerByEvidenceRef[evidence.evidenceId] ?? null;
  const interpretationDepth = evidenceOwner && evidenceOwner !== section.sectionId ? "reference" : "primary";
  return {
    packetId: `${section.sectionId}.${packetKey(evidence.evidenceId)}`,
    evidenceRefs: [evidence.evidenceId],
    interpretationRuleRefs: ruleIds,
    claims: claimsForEvidence(evidence).map((claim, index) => ({
      claimId: `${section.sectionId}.${packetKey(evidence.evidenceId)}.${index + 1}`,
      ...claim
    })),
    interpretationDepth,
    themes: ruleIds.flatMap((ruleId) => rulesForEvidence(evidence).filter((rule) => rule.ruleId === ruleId).flatMap((rule) => rule.themes ?? []))
  };
}

function buildEvidencePackets({ section, byId, ownerByEvidenceRef }) {
  const refs = [...new Set([...(section.primaryEvidenceRefs ?? []), ...(section.secondaryEvidenceRefs ?? [])])];
  return refs
    .map((ref) => {
      const evidence = byId.get(ref);
      if (!evidence) return null;
      const ruleIds = rulesForEvidence(evidence)
        .map((rule) => rule.ruleId)
        .filter((ruleId) => (section.allowedInterpretationRuleRefs ?? []).includes(ruleId));
      return packetForEvidence({ section, evidence, ruleIds, ownerByEvidenceRef });
    })
    .filter(Boolean);
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
    capSectionEvidence(section);
    section.allowedInterpretationRuleRefs = [
      ...new Set(
        [...section.primaryEvidenceRefs, ...section.secondaryEvidenceRefs].flatMap((ref) => rulesForEvidence(byId.get(ref)).map((rule) => rule.ruleId))
      )
    ];
    const allowed = new Set([...section.primaryEvidenceRefs, ...section.secondaryEvidenceRefs]);
    section.forbiddenEvidenceRefs = allRefs.filter((ref) => !allowed.has(ref));
    section.alreadyInterpretedEvidenceRefs = section.secondaryEvidenceRefs.filter((ref) => ownerByEvidenceRef[ref] && ownerByEvidenceRef[ref] !== section.sectionId);
    if (section.sectionId === "houses" && !allRefs.some((ref) => /\.house$/.test(ref))) {
      section.preconditions.push({ status: "unavailable", reason: "houses_unavailable_for_birth_time" });
    }
    if (section.sectionId === "current_sky") {
      section.preconditions.push({ status: "snapshot", label: "Calculé le", evidenceRef: "transits.snapshot" });
    }
    section.evidencePackets = buildEvidencePackets({ section, byId, ownerByEvidenceRef });
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
