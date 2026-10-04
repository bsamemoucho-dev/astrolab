import { evidenceById } from "./dossierEvidence.mjs";
import { rulesForEvidence, LASTRO_INTERPRETATION_CONVENTIONS } from "./interpretationRules.mjs";

export const FULL_DOSSIER_PLAN_VERSION = "full-dossier-plan@0.1.0";

const BODY_FR = Object.freeze({
  Sun: "Soleil",
  Moon: "Lune",
  Mercury: "Mercure",
  Venus: "Vénus",
  Mars: "Mars",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Uranus: "Uranus",
  Neptune: "Neptune",
  Pluto: "Pluton",
  ASC: "Ascendant",
  DSC: "Descendant",
  MC: "Milieu du Ciel",
  IC: "Fond du Ciel"
});

const BODY_SUBJECT_FR = Object.freeze({
  Sun: "Le Soleil",
  Moon: "La Lune",
  Mercury: "Mercure",
  Venus: "Vénus",
  Mars: "Mars",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Uranus: "Uranus",
  Neptune: "Neptune",
  Pluto: "Pluton",
  ASC: "L'Ascendant",
  DSC: "Le Descendant",
  MC: "Le Milieu du Ciel",
  IC: "Le Fond du Ciel"
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

export const FULL_DOSSIER_SECTIONS = Object.freeze([
  { sectionId: "general_synthesis", objective: "Synthétiser les 3 à 5 dynamiques centrales sans refaire les chapitres.", minWords: 180, targetWords: 360, maxWords: 620 },
  { sectionId: "identity", objective: "Traiter l'identité consciente et l'axe solaire dans un texte cohérent.", minWords: 220, targetWords: 480, maxWords: 820 },
  { sectionId: "emotional_world", objective: "Traiter la vie émotionnelle et les aspects lunaires sans répétition.", minWords: 220, targetWords: 500, maxWords: 860 },
  { sectionId: "communication", objective: "Traiter pensée, langage et circulation mentale à partir des preuves utiles.", minWords: 180, targetWords: 380, maxWords: 680 },
  { sectionId: "affectivity", objective: "Traiter l'affectivité à partir des faits vénusiens utiles.", minWords: 180, targetWords: 380, maxWords: 680 },
  { sectionId: "action", objective: "Traiter désir, action, défense et élan à partir de Mars.", minWords: 180, targetWords: 380, maxWords: 680 },
  { sectionId: "relationships", objective: "Relier les faits relationnels exploitables sans inventer de relation réelle.", minWords: 160, targetWords: 340, maxWords: 620 },
  { sectionId: "creativity", objective: "Décrire les modes d'expression créative uniquement depuis des preuves autorisées.", minWords: 140, targetWords: 300, maxWords: 560 },
  { sectionId: "work_realization", objective: "Décrire réalisation et travail sans prédire de métier.", minWords: 180, targetWords: 400, maxWords: 720 },
  { sectionId: "security_resources", objective: "Décrire sécurité, ressources et ancrage depuis les preuves disponibles.", minWords: 160, targetWords: 340, maxWords: 620 },
  { sectionId: "internal_tensions", objective: "Traiter les tensions structurantes en les regroupant par dynamique.", minWords: 180, targetWords: 420, maxWords: 760 },
  { sectionId: "supporting_resources", objective: "Traiter les soutiens structurants sans remplir artificiellement.", minWords: 160, targetWords: 340, maxWords: 620 },
  { sectionId: "houses", objective: "Lire les maisons Whole Sign seulement lorsqu'elles sont exploitables.", minWords: 160, targetWords: 360, maxWords: 680 },
  { sectionId: "major_aspects", objective: "Présenter les grands aspects par familles de dynamiques.", minWords: 220, targetWords: 520, maxWords: 920 },
  { sectionId: "current_sky", objective: "Présenter l'instantané daté des transits CURRENT.", minWords: 140, targetWords: 300, maxWords: 560 },
  { sectionId: "next_weeks", objective: "Présenter les transits UPCOMING sur l'horizon disponible.", minWords: 140, targetWords: 320, maxWords: 620 },
  { sectionId: "conclusion", objective: "Relier les grandes dynamiques, tensions, ressources et questions ouvertes sans réinterpréter chaque fait.", minWords: 180, targetWords: 420, maxWords: 760 }
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

function transitStoryKeyFromValue(value = {}) {
  if (!value.transitBody || !value.natalPoint || !value.aspectType) return null;
  return [value.transitBody, value.natalPoint, value.aspectType].join("|");
}

function transitOccurrenceKeyFromClaim(claim = {}) {
  if (!claim.transitBody || !claim.natalPoint || !claim.aspectType || !claim.exactAt) return null;
  return [claim.transitBody, claim.natalPoint, claim.aspectType, claim.exactAt].join("|");
}

function personalTransitClaim(packet) {
  return (packet?.claims ?? []).find((item) => item.type === "PERSONAL_TRANSIT") ?? null;
}

function transitStoryKeyFromPacket(packet) {
  const claim = personalTransitClaim(packet);
  return claim ? transitStoryKeyFromValue(claim) : null;
}

function transitOccurrenceKeyFromPacket(packet) {
  const claim = personalTransitClaim(packet);
  return claim ? transitOccurrenceKeyFromClaim(claim) : null;
}

function precomputeTransitStoryOwners(byId) {
  const priority = { current_sky: 2, next_weeks: 1 };
  const owners = new Map();
  for (const evidence of byId.values()) {
    if (evidence?.type !== "PERSONAL_TRANSIT") continue;
    const key = transitStoryKeyFromValue(evidence.value);
    if (!key) continue;
    const status = evidence.value?.status;
    const owner = status === "UPCOMING" ? "next_weeks" : "current_sky";
    const previous = owners.get(key);
    if (!previous || priority[owner] > priority[previous]) {
      owners.set(key, owner);
    }
  }
  return owners;
}

function ownerForEvidence(evidence, transitStoryOwners) {
  if (evidence?.type === "PERSONAL_TRANSIT") {
    const storyKey = transitStoryKeyFromValue(evidence.value);
    return transitStoryOwners.get(storyKey) ?? sectionOwnerForEvidence(evidence);
  }
  return sectionOwnerForEvidence(evidence);
}

function secondarySectionsForEvidence(evidence) {
  if (!evidence) return [];
  const value = evidence.value ?? {};
  if (evidence.type === "NATAL_BODY_SIGN" && value.body === "Venus") return ["relationships", "security_resources", "conclusion"];
  if (evidence.type === "NATAL_BODY_SIGN" && value.body === "Sun") return ["general_synthesis", "work_realization", "conclusion"];
  if (evidence.type === "NATAL_BODY_SIGN" && value.body === "Moon") return ["general_synthesis", "relationships", "conclusion"];
  if (evidence.type === "NATAL_ASPECT") {
    const tension = ["conjunction", "square", "opposition"].includes(value.aspectType);
    return ["general_synthesis", tension ? "internal_tensions" : "supporting_resources", "major_aspects", "conclusion"];
  }
  if (evidence.type?.startsWith("DISTRIBUTION_")) return ["general_synthesis", "conclusion"];
  return [];
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
  if (section.sectionId === "conclusion") {
    const selected = new Set(
      [...section.primaryEvidenceRefs, ...section.secondaryEvidenceRefs]
        .sort((a, b) => evidencePriority(a) - evidencePriority(b) || a.localeCompare(b))
        .slice(0, 7)
    );
    section.primaryEvidenceRefs = section.primaryEvidenceRefs.filter((ref) => selected.has(ref));
    section.secondaryEvidenceRefs = section.secondaryEvidenceRefs.filter((ref) => selected.has(ref));
  }
  if (["internal_tensions", "supporting_resources", "major_aspects"].includes(section.sectionId)) {
    section.secondaryEvidenceRefs = section.secondaryEvidenceRefs
      .filter((ref) => ref.startsWith("aspect."))
      .sort((a, b) => evidencePriority(a) - evidencePriority(b) || a.localeCompare(b))
      .slice(0, section.sectionId === "major_aspects" ? 8 : 5);
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
  if (evidence?.type === "TRANSIT_SNAPSHOT") {
    return [{ type: "TRANSIT_SNAPSHOT", nowUtc: value.nowUtc, horizonDays: value.horizonDays, evidenceRefs: [evidence.evidenceId] }];
  }
  if (evidence?.type === "PERSONAL_TRANSIT") {
    const claim = {
      type: "PERSONAL_TRANSIT",
      transitBody: value.transitBody,
      natalPoint: value.natalPoint,
      aspectType: value.aspectType,
      exactAt: value.exactAt,
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      phase: value.phase,
      orb: value.orb,
      evidenceRefs: [evidence.evidenceId]
    };
    if (value.natalHouse !== null && value.natalHouse !== undefined) {
      claim.natalHouse = value.natalHouse;
    }
    return [claim];
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
      if (evidence.type === "NATAL_BODY_RETROGRADE") return null;
      return packetForEvidence({ section, evidence, ruleIds, ownerByEvidenceRef });
    })
    .filter(Boolean);
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

const EXACT_NOW_TOLERANCE_MS = 60 * 1000;

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatFrenchDate(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function sameFrenchDate(left, right) {
  const leftFormatted = formatFrenchDate(left);
  return leftFormatted !== null && leftFormatted === formatFrenchDate(right);
}

function exactSentence(exactAt, nowUtc) {
  if (!exactAt) return null;
  const exact = formatFrenchDate(exactAt);
  if (!exact) return null;
  if (!nowUtc || Math.abs(exactAt.getTime() - nowUtc.getTime()) <= EXACT_NOW_TOLERANCE_MS) {
    return `L'aspect est exact le ${exact}.`;
  }
  if (exactAt.getTime() < nowUtc.getTime()) {
    return `L'aspect a été exact le ${exact}.`;
  }
  return `L'aspect sera exact le ${exact}.`;
}

function aspectWithArticle(aspectType) {
  return ASPECT_WITH_ARTICLE_FR[aspectType] ?? `un ${ASPECT_FR[aspectType] ?? aspectType}`;
}

function transitWindowSentence(claim, { includeSubject = true } = {}) {
  if (!claim) return null;
  const aspect = aspectWithArticle(claim.aspectType);
  const body = BODY_SUBJECT_FR[claim.transitBody] ?? BODY_FR[claim.transitBody] ?? claim.transitBody;
  const point = BODY_FR[claim.natalPoint] ?? claim.natalPoint;
  const startsAt = validDate(claim.startsAt);
  const endsAt = validDate(claim.endsAt);
  const subject = includeSubject ? `${body} forme ${aspect} à votre ${point}` : "passage";
  if (startsAt && endsAt) {
    if (sameFrenchDate(startsAt, endsAt)) {
      return `${subject} le ${formatFrenchDate(startsAt)}.`;
    }
    return `${subject} entre le ${formatFrenchDate(startsAt)} et le ${formatFrenchDate(endsAt)}.`;
  }
  return `${subject}.`;
}

function transitTimingPrefix(packetOrPackets, { nowUtc = null } = {}) {
  const packets = Array.isArray(packetOrPackets) ? packetOrPackets : [packetOrPackets];
  const claims = packets.map(personalTransitClaim).filter(Boolean);
  if (claims.length === 0) return null;
  const now = validDate(nowUtc);
  if (claims.length === 1) {
    const claim = claims[0];
    const window = transitWindowSentence(claim);
    const exact = exactSentence(validDate(claim.exactAt), now);
    return [window, exact].filter(Boolean).join(" ");
  }
  const first = claims[0];
  const aspect = aspectWithArticle(first.aspectType);
  const body = BODY_SUBJECT_FR[first.transitBody] ?? BODY_FR[first.transitBody] ?? first.transitBody;
  const point = BODY_FR[first.natalPoint] ?? first.natalPoint;
  const passages = claims
    .map((claim) => {
      const startsAt = validDate(claim.startsAt);
      const endsAt = validDate(claim.endsAt);
      const exactAt = validDate(claim.exactAt);
      const window =
        startsAt && endsAt
          ? sameFrenchDate(startsAt, endsAt)
            ? `le ${formatFrenchDate(startsAt)}`
            : `du ${formatFrenchDate(startsAt)} au ${formatFrenchDate(endsAt)}`
          : null;
      const exact = exactAt ? `exact ${formatFrenchDate(exactAt)}` : null;
      return [window, exact].filter(Boolean).join(", ");
    })
    .filter(Boolean)
    .join(" ; ");
  const lead = `${body} forme ${aspect} à votre ${point}.`;
  return passages ? `${lead} Passages retenus : ${passages}.` : lead;
}

function dedupeTransitPacketsByOccurrence(packets) {
  const seen = new Set();
  const unique = [];
  for (const packet of packets) {
    const occurrenceKey = transitOccurrenceKeyFromPacket(packet) ?? packet.packetId;
    if (seen.has(occurrenceKey)) continue;
    seen.add(occurrenceKey);
    unique.push(packet);
  }
  return unique;
}

function groupTransitPacketsByStory(packets) {
  const groups = [];
  const byStory = new Map();
  for (const packet of packets) {
    const storyKey = transitStoryKeyFromPacket(packet) ?? packet.packetId;
    if (!byStory.has(storyKey)) {
      const group = [];
      byStory.set(storyKey, group);
      groups.push(group);
    }
    byStory.get(storyKey).push(packet);
  }
  return groups.map(dedupeTransitPacketsByOccurrence).filter((group) => group.length > 0);
}

function transitBlockPlans({ packets, nowUtc, blockPrefix }) {
  return groupTransitPacketsByStory(packets).map((group, index) => ({
    blockId: `${blockPrefix}.transit_${String(index + 1).padStart(2, "0")}`,
    packetRefs: group.map((packet) => packet.packetId),
    deterministicPrefix: transitTimingPrefix(group, { nowUtc }),
    forbidAspectVocabulary: true
  }));
}

function aspectLeadSentence(claim) {
  if (claim?.type !== "NATAL_ASPECT") return null;
  const aspect = aspectWithArticle(claim.aspectType);
  const bodyA = BODY_SUBJECT_FR[claim.bodyA] ?? BODY_FR[claim.bodyA] ?? claim.bodyA;
  const bodyB = BODY_FR[claim.bodyB] ?? claim.bodyB;
  return `${bodyA} forme ${aspect} avec ${bodyB}.`;
}

function aspectPrefixForPackets(packets = []) {
  return packets
    .flatMap((packet) => packet.claims ?? [])
    .map(aspectLeadSentence)
    .filter(Boolean)
    .join(" ");
}

function blockPlanForPacketGroup(group, blockId) {
  const aspectPrefix = aspectPrefixForPackets(group);
  return {
    blockId,
    packetRefs: group.map((packet) => packet.packetId),
    ...(aspectPrefix ? { deterministicPrefix: aspectPrefix, forbidAspectVocabulary: true } : {})
  };
}

function compactBlockPlans(section, packets, { blockPrefix = "block", chunkSize = 4 } = {}) {
  return chunk(packets, chunkSize).map((group, index) => blockPlanForPacketGroup(group, `${blockPrefix}${index + 1}`));
}

function nowUtcForSection(byId) {
  return byId?.get("transits.snapshot")?.value?.nowUtc ?? null;
}

function buildBlockPlans(section, byId = null) {
  const packets = section.evidencePackets ?? [];
  const nowUtc = nowUtcForSection(byId);
  if (packets.length === 0) return [];
  if (section.sectionId === "current_sky") {
    const introPackets = packets.filter((packet) => packet.evidenceRefs?.includes("transits.snapshot"));
    const transitPackets = packets.filter((packet) => !packet.evidenceRefs?.includes("transits.snapshot"));
    return [
      ...introPackets.map((packet) => ({
        blockId: "current_sky.intro",
        packetRefs: [packet.packetId],
        deterministic: true
      })),
      ...transitBlockPlans({ packets: transitPackets, nowUtc, blockPrefix: "current_sky" })
    ];
  }
  if (section.sectionId === "next_weeks") {
    return transitBlockPlans({ packets, nowUtc, blockPrefix: "next_weeks" });
  }
  if (section.sectionId === "general_synthesis" || section.sectionId === "conclusion") {
    const aspectPrefix = aspectPrefixForPackets(packets);
    return [
      {
        blockId: "block1",
        packetRefs: packets.map((packet) => packet.packetId),
        ...(aspectPrefix ? { deterministicPrefix: aspectPrefix, forbidAspectVocabulary: true } : {})
      }
    ];
  }
  if (["internal_tensions", "supporting_resources", "major_aspects"].includes(section.sectionId)) {
    return compactBlockPlans(section, packets, { chunkSize: 4 });
  }
  return compactBlockPlans(section, packets, { chunkSize: 6 });
}

export function buildFullDossierPlan(dossierEvidence) {
  const byId = evidenceById(dossierEvidence);
  const sections = sectionsMap();
  const ownerByEvidenceRef = {};
  const transitStoryOwners = precomputeTransitStoryOwners(byId);

  for (const evidence of byId.values()) {
    const owner = ownerForEvidence(evidence, transitStoryOwners);
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
    section.blockPlans = buildBlockPlans(section, byId);
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
