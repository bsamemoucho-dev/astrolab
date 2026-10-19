import { referenceTimeZone, formatFrenchCalendarDate } from "./calendarDates.mjs";
import { evidenceById } from "./dossierEvidence.mjs";
import { rulesForEvidence, LASTRO_INTERPRETATION_CONVENTIONS } from "./interpretationRules.mjs";
import { buildEditorialPlan, crossReferenceAdditions } from "./editorialPlan.mjs";
import { lengthForHypotheses } from "./readingHypotheses.mjs";

export const FULL_DOSSIER_PLAN_VERSION = "full-dossier-plan@0.2.0";

// Mode du chapitre « Aspects majeurs » (voir docs/doctrine/aspects-chapter-modes.md) :
//   - "narrative"  : comportement historique, le chapitre décrit chaque aspect ;
//   - "reference"  : le chapitre sort de la narration, la table des aspects de
//                    l'annexe suffit ; aucun appel LLM, aucune répétition ;
//   - "absent"     : le chapitre disparaît du plan.
export const ASPECT_CHAPTER_MODES = Object.freeze(["narrative", "reference", "absent"]);

// Deux moteurs, un seul code : "composition" (le nouveau) et "legacy" (le
// précédent, conservé pour les comparaisons à modèle identique). Le mode legacy
// ne construit ni plan éditorial, ni croisements, et n'envoie pas de sémantique
// structurée : il reproduit exactement l'ancien dispositif.
export const EDITORIAL_ENGINES = Object.freeze(["composition", "legacy"]);

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

// À la place d'objet, le français exige l'article pour les luminaires :
// « une opposition avec la Lune », « un trigone avec le Soleil ». Les planètes
// nommées (Mars, Vénus, Jupiter…) restent sans article en usage astrologique.
const BODY_OBJECT_FR = Object.freeze({
  Sun: "le Soleil",
  Moon: "la Lune"
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

// Chapitres « de catégorie » : ils reçoivent l'aspect en DÉVELOPPEMENT, pas en
// rappel. `major_aspects` reçoit tous les aspects ; les deux autres reçoivent
// seulement leur catégorie, telle que la fixent les conventions versionnées
// (`LASTRO_INTERPRETATION_CONVENTIONS`) — aucune catégorie inventée ici.
function aspectCategoryChaptersFor(evidence) {
  if (evidence?.type !== "NATAL_ASPECT") return [];
  const aspectType = evidence.value?.aspectType;
  const chapters = ["major_aspects"];
  const { aspectTensionV1, aspectSupportV1 } = LASTRO_INTERPRETATION_CONVENTIONS;
  if (aspectTensionV1.aspectTypes.includes(aspectType)) chapters.push("internal_tensions");
  else if (aspectSupportV1.aspectTypes.includes(aspectType)) chapters.push("supporting_resources");
  return chapters;
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

// Les preuves qui portent une idée possédée par le chapitre ne peuvent pas être
// évincées par un plafond : sans elles, la thèse ou la figure ne serait plus
// démontrable.
function capSectionEvidence(section, protectedRefs = new Set()) {
  const retenir = (refs, limite) => {
    const proteges = refs.filter((ref) => protectedRefs.has(ref));
    const complement = refs
      .filter((ref) => !protectedRefs.has(ref))
      .sort((a, b) => evidencePriority(a) - evidencePriority(b) || a.localeCompare(b));
    return new Set([...proteges, ...complement].slice(0, Math.max(limite, proteges.length)));
  };
  if (section.sectionId === "general_synthesis") {
    const selected = retenir([...section.primaryEvidenceRefs, ...section.secondaryEvidenceRefs], 5);
    section.primaryEvidenceRefs = section.primaryEvidenceRefs.filter((ref) => selected.has(ref));
    section.secondaryEvidenceRefs = section.secondaryEvidenceRefs.filter((ref) => selected.has(ref));
  }
  if (section.sectionId === "next_weeks") {
    section.primaryEvidenceRefs = section.primaryEvidenceRefs.slice(0, 8);
    section.secondaryEvidenceRefs = section.secondaryEvidenceRefs.slice(0, 4);
  }
  if (section.sectionId === "conclusion") {
    const selected = retenir([...section.primaryEvidenceRefs, ...section.secondaryEvidenceRefs], 7);
    section.primaryEvidenceRefs = section.primaryEvidenceRefs.filter((ref) => selected.has(ref));
    section.secondaryEvidenceRefs = section.secondaryEvidenceRefs.filter((ref) => selected.has(ref));
  }
  if (["internal_tensions", "supporting_resources", "major_aspects"].includes(section.sectionId)) {
    // Ces trois chapitres sont bâtis sur des aspects : ils en sont propriétaires
    // (développement) et non simples rappelants, donc les deux listes sont
    // plafonnées. `major_aspects` garde une limite plus large : c'est le chapitre
    // qui doit montrer la carte complète, le plafonner à 8 lui retirait un aspect
    // que le thème avait réellement calculé.
    const limite = section.sectionId === "major_aspects" ? 12 : 5;
    const trier = (refs) =>
      refs
        .filter((ref) => ref.startsWith("aspect."))
        .sort((a, b) => evidencePriority(a) - evidencePriority(b) || a.localeCompare(b))
        .slice(0, limite);
    section.primaryEvidenceRefs = trier(section.primaryEvidenceRefs);
    section.secondaryEvidenceRefs = trier(section.secondaryEvidenceRefs);
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

function packetForEvidence({ section, evidence, ruleIds, primaryRefs }) {
  // La profondeur suit l'appartenance à la liste PRIMAIRE de la section, et non
  // plus un propriétaire unique. Un aspect peut être développé par le chapitre
  // du corps ET par le chapitre de sa catégorie (tensions, soutiens, aspects
  // majeurs) : ce sont deux angles différents, pas une redite.
  const interpretationDepth = primaryRefs?.has(evidence.evidenceId) ? "primary" : "reference";
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

function buildEvidencePackets({ section, byId }) {
  const refs = [...new Set([...(section.primaryEvidenceRefs ?? []), ...(section.secondaryEvidenceRefs ?? [])])];
  const primaryRefs = new Set(section.primaryEvidenceRefs ?? []);
  return refs
    .map((ref) => {
      const evidence = byId.get(ref);
      if (!evidence) return null;
      const ruleIds = rulesForEvidence(evidence)
        .map((rule) => rule.ruleId)
        .filter((ruleId) => (section.allowedInterpretationRuleRefs ?? []).includes(ruleId));
      if (evidence.type === "NATAL_BODY_RETROGRADE") return null;
      return packetForEvidence({ section, evidence, ruleIds, primaryRefs });
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

function formatFrenchDate(date, timeZone) {
  return date ? formatFrenchCalendarDate(date, timeZone) : null;
}

function sameFrenchDate(left, right, timeZone) {
  const leftFormatted = formatFrenchDate(left, timeZone);
  return leftFormatted !== null && leftFormatted === formatFrenchDate(right, timeZone);
}

function exactSentence(exactAt, nowUtc, timeZone) {
  if (!exactAt) return null;
  const exact = formatFrenchDate(exactAt, timeZone);
  if (!exact) return null;
  if (!nowUtc || Math.abs(exactAt.getTime() - nowUtc.getTime()) <= EXACT_NOW_TOLERANCE_MS) return `L'aspect est exact le ${exact}.`;
  if (exactAt.getTime() < nowUtc.getTime()) return `L'aspect a été exact le ${exact}.`;
  return `L'aspect sera exact le ${exact}.`;
}

function aspectWithArticle(aspectType) {
  return ASPECT_WITH_ARTICLE_FR[aspectType] ?? `un ${ASPECT_FR[aspectType] ?? aspectType}`;
}

function transitWindowSentence(claim, { includeSubject = true, timeZone = "UTC" } = {}) {
  if (!claim) return null;
  const aspect = aspectWithArticle(claim.aspectType);
  const body = BODY_SUBJECT_FR[claim.transitBody] ?? BODY_FR[claim.transitBody] ?? claim.transitBody;
  const point = BODY_FR[claim.natalPoint] ?? claim.natalPoint;
  const startsAt = validDate(claim.startsAt);
  const endsAt = validDate(claim.endsAt);
  const subject = includeSubject ? `${body} forme ${aspect} à votre ${point}` : "passage";
  if (startsAt && endsAt) {
    if (sameFrenchDate(startsAt, endsAt, timeZone)) {
      return `${subject} le ${formatFrenchDate(startsAt, timeZone)}.`;
    }
    return `${subject} entre le ${formatFrenchDate(startsAt, timeZone)} et le ${formatFrenchDate(endsAt, timeZone)}.`;
  }
  return `${subject}.`;
}

function transitTimingPrefix(packetOrPackets, { nowUtc = null, timeZone = "UTC" } = {}) {
  const packets = Array.isArray(packetOrPackets) ? packetOrPackets : [packetOrPackets];
  const claims = packets.map(personalTransitClaim).filter(Boolean);
  if (claims.length === 0) return null;
  const now = validDate(nowUtc);
  if (claims.length === 1) {
    const claim = claims[0];
    const window = transitWindowSentence(claim, { timeZone });
    const exact = exactSentence(validDate(claim.exactAt), now, timeZone);
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
          ? sameFrenchDate(startsAt, endsAt, timeZone)
            ? `le ${formatFrenchDate(startsAt, timeZone)}`
            : `du ${formatFrenchDate(startsAt, timeZone)} au ${formatFrenchDate(endsAt, timeZone)}`
          : null;
      const exact = exactAt ? `exact ${formatFrenchDate(exactAt, timeZone)}` : null;
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

function transitBlockPlans({ packets, nowUtc, blockPrefix, timeZone }) {
  return groupTransitPacketsByStory(packets).map((group, index) => ({
    blockId: `${blockPrefix}.transit_${String(index + 1).padStart(2, "0")}`,
    packetRefs: group.map((packet) => packet.packetId),
    deterministicPrefix: transitTimingPrefix(group, { nowUtc, timeZone }),
    forbidAspectVocabulary: true
  }));
}

function aspectLeadSentence(claim) {
  if (claim?.type !== "NATAL_ASPECT") return null;
  const aspect = aspectWithArticle(claim.aspectType);
  const bodyA = BODY_SUBJECT_FR[claim.bodyA] ?? BODY_FR[claim.bodyA] ?? claim.bodyA;
  const bodyB = BODY_OBJECT_FR[claim.bodyB] ?? BODY_FR[claim.bodyB] ?? claim.bodyB;
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
  const timeZone = section.referenceTimeZone;
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
      ...transitBlockPlans({ packets: transitPackets, nowUtc, timeZone, blockPrefix: "current_sky" })
    ];
  }
  if (section.sectionId === "next_weeks") {
    return transitBlockPlans({ packets, nowUtc, timeZone, blockPrefix: "next_weeks" });
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

export function buildFullDossierPlan(dossierEvidence, options = {}) {
  const timeZone = options.referenceTimeZone ?? referenceTimeZone(dossierEvidence);
  const editorialEngine = EDITORIAL_ENGINES.includes(options.editorialEngine)
    ? options.editorialEngine
    : "composition";
  // Le mode par défaut reste « narrative » pour ne rien changer aux appelants
  // existants (expériences, tests, moteur historique). C'est le PRODUIT qui
  // choisit « reference » (voir fullDossierService) ; un mode inconnu lève au
  // lieu de retomber silencieusement sur un autre comportement.
  if (options.aspectChapterMode !== undefined && !ASPECT_CHAPTER_MODES.includes(options.aspectChapterMode)) {
    throw new Error(
      `aspectChapterMode inconnu : ${options.aspectChapterMode} (attendu : ${ASPECT_CHAPTER_MODES.join(", ")})`
    );
  }
  const aspectChapterMode = options.aspectChapterMode ?? "narrative";
  // Validate the declared zone; never silently replace an invalid zone.
  new Intl.DateTimeFormat("fr-FR", { timeZone });
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
    // Un aspect appartient aussi au chapitre de sa CATÉGORIE. Sans cela, le
    // chapitre « tensions » recevait ses deux oppositions avec la consigne
    // « rappelle brièvement, ne développe pas » — le seul chapitre dont c'est
    // le sujet était le seul à qui l'on interdisait de le traiter.
    for (const categoryChapter of aspectCategoryChaptersFor(evidence)) {
      if (sections.has(categoryChapter)) {
        sections.get(categoryChapter).primaryEvidenceRefs.push(evidence.evidenceId);
      }
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
    section.referenceTimeZone = timeZone;
    section.primaryEvidenceRefs = [...new Set(section.primaryEvidenceRefs)];
    // Une preuve ne peut pas être à la fois primaire et secondaire dans le même
    // chapitre : le validateur refuserait la réutilisation comme interprétation
    // principale. Les doublons venaient du cumul « propriétaire + catégorie ».
    section.secondaryEvidenceRefs = [...new Set(section.secondaryEvidenceRefs)].filter(
      (ref) => !section.primaryEvidenceRefs.includes(ref)
    );
    capSectionEvidence(section);
  }

  // 1. Plan éditorial global : thèse, idées, propriétaires, missions, mémoire.
  //    Construit AVANT les paquets, parce qu'il décide quelles configurations un
  //    chapitre a le droit de nommer.
  const editorialPlan = editorialEngine === "legacy"
    ? null
    : buildEditorialPlan({
        dossierEvidence,
        rulesForEvidence,
        sections: [...sections.values()],
        ownerByEvidenceRef,
        aspectChapterMode
      });

  // 2. Références de rappel : un chapitre qui croise deux configurations doit
  //    pouvoir les NOMMER (sinon le validateur refuserait la mention). Elles
  //    entrent en secondaire, donc en profondeur « reference ».
  const additions = editorialPlan
    ? crossReferenceAdditions({ editorialPlan, sections: [...sections.values()] })
    : new Map();
  for (const [sectionId, refs] of additions) {
    const section = sections.get(sectionId);
    if (!section) continue;
    for (const ref of refs) {
      if (!section.primaryEvidenceRefs.includes(ref)) section.secondaryEvidenceRefs.push(ref);
    }
    section.secondaryEvidenceRefs = [...new Set(section.secondaryEvidenceRefs)].filter(
      (ref) => !section.primaryEvidenceRefs.includes(ref)
    );
  }

  // 2 bis. Plafonds réappliqués, en protégeant les preuves qui portent une idée
  //       possédée : les références de rappel ne doivent pas faire grossir les
  //       prompts (un bloc de plus = un appel de plus).
  for (const section of sections.values()) {
    const protegees = new Set(
      (editorialPlan?.ideas ?? [])
        .filter((idea) => idea.owner === section.sectionId)
        .flatMap((idea) => idea.evidenceRefs ?? [])
    );
    for (const relation of section.allowedRelations ?? []) {
      for (const ref of relation.evidenceRefs ?? []) protegees.add(ref);
    }
    capSectionEvidence(section, protegees);
  }

  // 3. Mode du chapitre « Aspects majeurs » avant la fabrication des blocs.
  const aspectsSection = sections.get("major_aspects");
  if (aspectsSection) {
    if (aspectChapterMode === "reference") {
      aspectsSection.editorialMode = "reference";
      aspectsSection.writer = "none";
      aspectsSection.kind = "reference";
      aspectsSection.preconditions.push({
        status: "reference_only",
        reason: "aspects_read_in_category_chapters",
        message: "Les aspects sont lus dans les chapitres de catégorie ; leur table reste dans l'annexe."
      });
      // La table de référence est produite par le serveur : c'est elle que
      // l'annexe publie, pas une interprétation.
      aspectsSection.referenceTable = allRefs
        .filter((ref) => ref.startsWith("aspect."))
        .map((ref) => {
          const item = byId.get(ref)?.value ?? {};
          return {
            evidenceRef: ref,
            bodyA: item.bodyA ?? null,
            bodyB: item.bodyB ?? null,
            aspectType: item.aspectType ?? null,
            orb: item.orb ?? null,
            orbLimit: item.orbLimit ?? null
          };
        })
        .sort((gauche, droite) => (gauche.orb ?? 99) - (droite.orb ?? 99));
    } else if (aspectChapterMode === "absent") {
      sections.delete("major_aspects");
    }
  }

  for (const section of sections.values()) {
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
    // Ce que le rédacteur reçoit de la couche éditoriale.
    const chapitre = editorialPlan?.chapters.find((entree) => entree.sectionId === section.sectionId) ?? null;
    const parId = new Map((editorialPlan?.ideas ?? []).map((idea) => [idea.ideaId, idea]));
    const resumer = (ideaId) => {
      const idea = parId.get(ideaId);
      return idea
        ? { ideaId, label: idea.label, kind: idea.kind, owner: idea.owner }
        : { ideaId, label: ideaId, kind: "unknown", owner: null };
    };
    section.editorialEngine = editorialEngine;
    section.editorialThesis = editorialPlan?.thesis ?? null;
    // Le chapitre qui explore une figure reçoit ses hypothèses de lecture.
    section.readingHypotheses = (editorialPlan?.chapters ?? [])
      .find((entree) => entree.sectionId === section.sectionId)?.hypotheses ?? [];
    section.editorialPlan = chapitre
      ? {
          mission: chapitre.mission,
          owns: chapitre.owns.map(resumer),
          mayRecall: chapitre.mayRecall.map(resumer),
          reserved: chapitre.reserved.map(resumer),
          relationRefs: chapitre.relations
        }
      : null;
    section.allowedRelations = (editorialPlan?.relations ?? []).filter((relation) =>
      (chapitre?.relations ?? []).includes(relation.relationId)
    );
    // La longueur suit la matière : une hypothèse = un paragraphe, pas un quota.
    if (section.readingHypotheses.length > 0) {
      const longueur = lengthForHypotheses(section.readingHypotheses.length);
      section.targetWords = longueur.targetWords;
      section.maxWords = longueur.maxWords;
    }
    section.evidencePackets = buildEvidencePackets({ section, byId });
    section.blockPlans = buildBlockPlans(section, byId);
    // Un chapitre qui explore une figure ne récite pas les positions : les faits
    // sont dans la licence des hypothèses et dans l'annexe. Le préfixe factuel
    // du serveur ouvrirait le chapitre sur « Mars forme une opposition… ».
    if (section.readingHypotheses.length > 0) {
      section.blockPlans = section.blockPlans.map((blockPlan) => {
        const { deterministicPrefix, forbidAspectVocabulary, ...reste } = blockPlan;
        return reste;
      });
    }
    // Une section de référence ne produit aucun bloc narratif.
    if (section.editorialMode === "reference") {
      section.blockPlans = [];
    }
  }

  return {
    schema: "astrolab.full_dossier_plan",
    version: FULL_DOSSIER_PLAN_VERSION,
    referenceTimeZone: timeZone,
    interpretationConventions: LASTRO_INTERPRETATION_CONVENTIONS,
    aspectChapterMode,
    editorialEngine,
    editorialPlan,
    ownerByEvidenceRef,
    sections: [...sections.values()]
  };
}

export function sectionPlanById(fullDossierPlan, sectionId) {
  return (fullDossierPlan?.sections ?? []).find((section) => section.sectionId === sectionId) ?? null;
}
