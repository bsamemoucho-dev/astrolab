import { evidenceById } from "./dossierEvidence.mjs";
import { interpretationRuleById, ruleMatchesEvidence } from "./interpretationRules.mjs";

export const CLAIM_VALIDATOR_VERSION = "dossier-factual-claims@0.1.0";

function norm(value) {
  return String(value ?? "").trim().toLowerCase();
}

function sameInstant(left, right) {
  if (!left || !right) return false;
  const a = new Date(left);
  const b = new Date(right);
  return !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && a.getTime() === b.getTime();
}

function numberClose(left, right, tolerance = 0.01) {
  return Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.abs(Number(left) - Number(right)) <= tolerance;
}

function error(claim, code, message, extra = {}) {
  return {
    severity: "error",
    code,
    claimId: claim?.claimId ?? null,
    type: claim?.type ?? null,
    message,
    ...extra
  };
}

const BODY_WORDS = Object.freeze({
  Sun: ["soleil", "sun"],
  Moon: ["lune", "moon"],
  Mercury: ["mercure", "mercury"],
  Venus: ["vénus", "venus"],
  Mars: ["mars"],
  Jupiter: ["jupiter"],
  Saturn: ["saturne", "saturn"]
});

const SIGN_WORDS = Object.freeze({
  Aries: ["bélier", "belier", "aries"],
  Taurus: ["taureau", "taurus"],
  Gemini: ["gémeaux", "gemeaux", "gemini"],
  Cancer: ["cancer"],
  Leo: ["lion", "leo"],
  Virgo: ["vierge", "virgo"],
  Libra: ["balance", "libra"],
  Scorpio: ["scorpion", "scorpio"],
  Sagittarius: ["sagittaire", "sagittarius"],
  Capricorn: ["capricorne", "capricorn"],
  Aquarius: ["verseau", "aquarius"],
  Pisces: ["poissons", "pisces"]
});

const ASPECT_WORDS = Object.freeze({
  conjunction: ["conjonction", "conjoint", "conjointe", "conjunct", "conjunction"],
  opposition: ["opposition", "opposé", "opposée", "oppose", "opposed"],
  square: ["carré", "carre", "square"],
  trine: ["trigone", "trine"],
  sextile: ["sextile"]
});

const ANGLE_WORDS = Object.freeze({
  ascendant: ["ascendant"],
  midheaven: ["milieu du ciel", "mc", "midheaven"],
  descendant: ["descendant"],
  imumCoeli: ["fond du ciel", "ic", "imum coeli"]
});

const ROMAN_HOUSES = Object.freeze({
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12
});

function hasAny(text, words) {
  const source = norm(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return words.some((word) => source.includes(norm(word).normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

function normalizedText(value) {
  return norm(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mentionedKeys(text, vocabulary) {
  return Object.entries(vocabulary).filter(([, words]) => hasAny(text, words)).map(([key]) => key);
}

function wordAlternatives(words) {
  return words.map((word) => normalizedText(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

function hasBodySignClaim(text, body, sign) {
  const source = normalizedText(text);
  const bodyWords = wordAlternatives(BODY_WORDS[body] ?? []);
  const signWords = wordAlternatives(SIGN_WORDS[sign] ?? []);
  if (!bodyWords || !signWords) return false;
  const bodyThenSign = new RegExp(`\\b(?:${bodyWords})\\b.{0,32}\\b(?:en|in|dans|signe de)?\\s*\\b(?:${signWords})\\b`, "iu");
  return bodyThenSign.test(source);
}

function hasAngleSignClaim(text, angle, sign) {
  const source = normalizedText(text);
  const angleWords = wordAlternatives(ANGLE_WORDS[angle] ?? []);
  const signWords = wordAlternatives(SIGN_WORDS[sign] ?? []);
  if (!angleWords || !signWords) return false;
  const angleThenSign = new RegExp(`\\b(?:${angleWords})\\b.{0,32}\\b(?:en|in|dans|signe de)?\\s*\\b(?:${signWords})\\b`, "iu");
  return angleThenSign.test(source);
}

function parseHouse(text) {
  const match = norm(text).match(/\bmaison\s*(?:n[°o]\s*)?([0-9]{1,2}|i{1,3}|iv|v|vi{0,3}|ix|x|xi|xii)\b/iu);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  return ROMAN_HOUSES[raw] ?? Number(raw);
}

function sortedBodies(a, b) {
  return [a, b].map(norm).sort().join("|");
}

function refSupportsBodySign(ref, body, sign) {
  return ref?.type === "NATAL_BODY_SIGN" && norm(ref.value?.body) === norm(body) && norm(ref.value?.sign) === norm(sign);
}

function refSupportsBodyHouse(ref, body, house) {
  return ref?.type === "NATAL_BODY_HOUSE" && norm(ref.value?.body) === norm(body) && Number(ref.value?.house) === Number(house);
}

function refSupportsAngleSign(ref, angle, sign) {
  return ref?.type === "ANGLE_SIGN" && norm(ref.value?.angle) === norm(angle) && norm(ref.value?.sign) === norm(sign);
}

function refSupportsAspect(ref, bodyA, bodyB, aspectType) {
  if (ref?.type !== "NATAL_ASPECT" && ref?.type !== "PERSONAL_TRANSIT") return false;
  if (ref.type === "NATAL_ASPECT") {
    return sortedBodies(ref.value?.bodyA, ref.value?.bodyB) === sortedBodies(bodyA, bodyB) && norm(ref.value?.aspectType) === norm(aspectType);
  }
  return sortedBodies(ref.value?.transitBody, ref.value?.natalPoint) === sortedBodies(bodyA, bodyB) && norm(ref.value?.aspectType) === norm(aspectType);
}

export function detectAstrologicalTextFacts(text) {
  const bodies = mentionedKeys(text, BODY_WORDS);
  const aspects = mentionedKeys(text, ASPECT_WORDS);
  const house = parseHouse(text);
  const facts = [];
  for (const body of Object.keys(BODY_WORDS)) {
    for (const sign of Object.keys(SIGN_WORDS)) {
      if (!hasBodySignClaim(text, body, sign)) continue;
      facts.push({ type: "NATAL_BODY_SIGN", body, sign });
    }
  }
  for (const body of bodies) {
    if (house) {
      facts.push({ type: "NATAL_BODY_HOUSE", body, house });
    }
  }
  for (const angle of Object.keys(ANGLE_WORDS)) {
    for (const sign of Object.keys(SIGN_WORDS)) {
      if (!hasAngleSignClaim(text, angle, sign)) continue;
      facts.push({ type: "ANGLE_SIGN", angle, sign });
    }
  }
  if (bodies.length >= 2 && aspects.length > 0) {
    for (const aspectType of aspects) {
      facts.push({ type: "ASPECT", bodyA: bodies[0], bodyB: bodies[1], aspectType });
    }
  }
  return facts;
}

function textFactSupported(fact, refs) {
  if (fact.type === "NATAL_BODY_SIGN") return refs.some((ref) => refSupportsBodySign(ref, fact.body, fact.sign));
  if (fact.type === "NATAL_BODY_HOUSE") return refs.some((ref) => refSupportsBodyHouse(ref, fact.body, fact.house));
  if (fact.type === "ANGLE_SIGN") return refs.some((ref) => refSupportsAngleSign(ref, fact.angle, fact.sign));
  if (fact.type === "ASPECT") return refs.some((ref) => refSupportsAspect(ref, fact.bodyA, fact.bodyB, fact.aspectType));
  return false;
}

function claimlikeForBlock(block, code, message, extra = {}) {
  return {
    severity: "error",
    code,
    claimId: null,
    type: "BLOCK",
    blockId: block?.blockId ?? null,
    message,
    ...extra
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter((entry) => entry !== null && entry !== undefined) : [];
}

function packetById(sectionPlan) {
  return new Map((sectionPlan?.evidencePackets ?? []).map((packet) => [packet.packetId, packet]));
}

function expandBlockFromPackets({ block, sectionPlan, issues }) {
  const packetRefs = normalizeArray(block?.packetRefs).map(String);
  if (packetRefs.length === 0) {
    return block;
  }
  const packets = packetById(sectionPlan);
  const resolved = [];
  for (const packetRef of packetRefs) {
    const packet = packets.get(packetRef);
    if (!packet) {
      issues.push(claimlikeForBlock(block, "unknown_packet_ref", `Packet non autorisé ou introuvable : ${packetRef}.`, { packetRef }));
      continue;
    }
    resolved.push(packet);
  }
  const evidenceRefs = [...new Set(resolved.flatMap((packet) => packet.evidenceRefs ?? []))];
  const interpretationRuleRefs = [...new Set(resolved.flatMap((packet) => packet.interpretationRuleRefs ?? []))];
  const claims = resolved.flatMap((packet) => packet.claims ?? []);
  const interpretationDepth = resolved.some((packet) => packet.interpretationDepth === "reference") ? "reference" : "primary";
  return {
    ...block,
    packetRefs,
    evidenceRefs,
    interpretationRuleRefs,
    interpretationDepth,
    claims
  };
}

function requireEvidence(claim, byId) {
  const refs = Array.isArray(claim?.evidenceRefs) ? claim.evidenceRefs : [];
  if (refs.length === 0) {
    return { issues: [error(claim, "missing_evidence_refs", "Le claim factuel ne référence aucune preuve.")], refs: [] };
  }
  const found = [];
  const issues = [];
  for (const ref of refs) {
    const item = byId.get(ref);
    if (!item) {
      issues.push(error(claim, "unknown_evidence_ref", `Preuve introuvable : ${ref}.`, { evidenceRef: ref }));
    } else {
      found.push(item);
    }
  }
  return { issues, refs: found };
}

function firstOfType(refs, type) {
  return refs.find((item) => item.type === type) ?? null;
}

function validateAgainstEvidence(claim, refs) {
  switch (claim.type) {
    case "NATAL_BODY_SIGN": {
      const item = firstOfType(refs, "NATAL_BODY_SIGN");
      if (!item) return [error(claim, "wrong_evidence_type", "Le claim planète-signe ne référence pas une preuve NATAL_BODY_SIGN.")];
      const value = item.value ?? {};
      const issues = [];
      if (norm(claim.body) !== norm(value.body)) issues.push(error(claim, "body_mismatch", `Corps attendu ${value.body}, reçu ${claim.body}.`));
      if (norm(claim.sign) !== norm(value.sign)) issues.push(error(claim, "sign_mismatch", `Signe attendu ${value.sign}, reçu ${claim.sign}.`));
      return issues;
    }
    case "NATAL_BODY_HOUSE": {
      const item = firstOfType(refs, "NATAL_BODY_HOUSE");
      if (!item) return [error(claim, "wrong_evidence_type", "Le claim planète-maison ne référence pas une preuve NATAL_BODY_HOUSE.")];
      const value = item.value ?? {};
      const issues = [];
      if (norm(claim.body) !== norm(value.body)) issues.push(error(claim, "body_mismatch", `Corps attendu ${value.body}, reçu ${claim.body}.`));
      if (Number(claim.house) !== Number(value.house)) issues.push(error(claim, "house_mismatch", `Maison attendue ${value.house}, reçue ${claim.house}.`));
      if (value.houseSystem && claim.houseSystem && norm(claim.houseSystem) !== norm(value.houseSystem)) {
        issues.push(error(claim, "house_system_mismatch", `Système attendu ${value.houseSystem}, reçu ${claim.houseSystem}.`));
      }
      return issues;
    }
    case "ANGLE_SIGN": {
      const item = firstOfType(refs, "ANGLE_SIGN");
      if (!item) return [error(claim, "wrong_evidence_type", "Le claim angle-signe ne référence pas une preuve ANGLE_SIGN.")];
      const value = item.value ?? {};
      const issues = [];
      if (norm(claim.angle) !== norm(value.angle)) issues.push(error(claim, "angle_mismatch", `Angle attendu ${value.angle}, reçu ${claim.angle}.`));
      if (norm(claim.sign) !== norm(value.sign)) issues.push(error(claim, "sign_mismatch", `Signe attendu ${value.sign}, reçu ${claim.sign}.`));
      return issues;
    }
    case "NATAL_ASPECT": {
      const item = firstOfType(refs, "NATAL_ASPECT");
      if (!item) return [error(claim, "wrong_evidence_type", "Le claim d'aspect natal ne référence pas une preuve NATAL_ASPECT.")];
      const value = item.value ?? {};
      const claimBodies = [claim.bodyA, claim.bodyB].map(norm).sort();
      const evidenceBodies = [value.bodyA, value.bodyB].map(norm).sort();
      const issues = [];
      if (claimBodies.join("|") !== evidenceBodies.join("|")) {
        issues.push(error(claim, "aspect_bodies_mismatch", `Corps attendus ${value.bodyA}-${value.bodyB}, reçus ${claim.bodyA}-${claim.bodyB}.`));
      }
      if (norm(claim.aspectType) !== norm(value.aspectType)) {
        issues.push(error(claim, "aspect_type_mismatch", `Aspect attendu ${value.aspectType}, reçu ${claim.aspectType}.`));
      }
      if (claim.orb !== undefined && !numberClose(claim.orb, value.orb, claim.orbTolerance ?? 0.05)) {
        issues.push(error(claim, "orb_mismatch", `Orbe attendu ${value.orb}, reçu ${claim.orb}.`));
      }
      return issues;
    }
    case "NATAL_ASPECT_ORB": {
      const item = firstOfType(refs, "NATAL_ASPECT");
      if (!item) return [error(claim, "wrong_evidence_type", "Le claim d'orbe ne référence pas une preuve NATAL_ASPECT.")];
      return numberClose(claim.orb, item.value?.orb, claim.orbTolerance ?? 0.05)
        ? []
        : [error(claim, "orb_mismatch", `Orbe attendu ${item.value?.orb}, reçu ${claim.orb}.`)];
    }
    case "NATAL_BODY_RETROGRADE": {
      const item = firstOfType(refs, "NATAL_BODY_RETROGRADE");
      if (!item) return [error(claim, "wrong_evidence_type", "Le claim de rétrogradation ne référence pas une preuve NATAL_BODY_RETROGRADE.")];
      const issues = [];
      if (norm(claim.body) !== norm(item.value?.body)) issues.push(error(claim, "body_mismatch", `Corps attendu ${item.value?.body}, reçu ${claim.body}.`));
      if (Boolean(claim.retrograde) !== Boolean(item.value?.retrograde)) {
        issues.push(error(claim, "retrograde_mismatch", `Rétrogradation attendue ${item.value?.retrograde}, reçue ${claim.retrograde}.`));
      }
      return issues;
    }
    case "DISTRIBUTION_COUNT": {
      const item = refs.find((entry) => entry.type === "DISTRIBUTION_ELEMENT_COUNT" || entry.type === "DISTRIBUTION_MODALITY_COUNT");
      if (!item) return [error(claim, "wrong_evidence_type", "Le claim de distribution ne référence pas une preuve de distribution.")];
      const field = item.type === "DISTRIBUTION_ELEMENT_COUNT" ? "element" : "modality";
      const issues = [];
      if (norm(claim[field]) !== norm(item.value?.[field])) issues.push(error(claim, "distribution_key_mismatch", `${field} attendu ${item.value?.[field]}, reçu ${claim[field]}.`));
      if (Number(claim.count) !== Number(item.value?.count)) issues.push(error(claim, "distribution_count_mismatch", `Compte attendu ${item.value?.count}, reçu ${claim.count}.`));
      return issues;
    }
    case "PERSONAL_TRANSIT": {
      const item = firstOfType(refs, "PERSONAL_TRANSIT");
      if (!item) return [error(claim, "wrong_evidence_type", "Le claim de transit ne référence pas une preuve PERSONAL_TRANSIT.")];
      const value = item.value ?? {};
      const issues = [];
      if (norm(claim.transitBody) !== norm(value.transitBody)) issues.push(error(claim, "transit_body_mismatch", `Planète transitante attendue ${value.transitBody}, reçue ${claim.transitBody}.`));
      if (norm(claim.natalPoint) !== norm(value.natalPoint)) issues.push(error(claim, "natal_point_mismatch", `Point natal attendu ${value.natalPoint}, reçu ${claim.natalPoint}.`));
      if (norm(claim.aspectType) !== norm(value.aspectType)) issues.push(error(claim, "transit_aspect_mismatch", `Aspect attendu ${value.aspectType}, reçu ${claim.aspectType}.`));
      if (claim.exactAt !== undefined && !sameInstant(claim.exactAt, value.exactAt)) issues.push(error(claim, "exact_at_mismatch", `exactAt attendu ${value.exactAt}, reçu ${claim.exactAt}.`));
      if (claim.startsAt !== undefined && !sameInstant(claim.startsAt, value.startsAt)) issues.push(error(claim, "orb_window_start_mismatch", `startsAt attendu ${value.startsAt}, reçu ${claim.startsAt}.`));
      if (claim.endsAt !== undefined && !sameInstant(claim.endsAt, value.endsAt)) issues.push(error(claim, "orb_window_end_mismatch", `endsAt attendu ${value.endsAt}, reçu ${claim.endsAt}.`));
      if (claim.phase !== undefined && norm(claim.phase) !== norm(value.phase)) issues.push(error(claim, "phase_mismatch", `Phase attendue ${value.phase}, reçue ${claim.phase}.`));
      if (claim.natalHouse !== undefined && Number(claim.natalHouse) !== Number(value.natalHouse)) issues.push(error(claim, "transit_house_mismatch", `Maison attendue ${value.natalHouse}, reçue ${claim.natalHouse}.`));
      if (claim.orb !== undefined && !numberClose(claim.orb, value.orb, claim.orbTolerance ?? 0.05)) issues.push(error(claim, "transit_orb_mismatch", `Orbe attendu ${value.orb}, reçu ${claim.orb}.`));
      return issues;
    }
    default:
      return [error(claim, "unsupported_claim_type", `Type de claim non supporté : ${claim.type}.`)];
  }
}

export function validateDossierClaims({ dossierEvidence, claims = [] } = {}) {
  const byId = evidenceById(dossierEvidence);
  const issues = [];
  for (const claim of claims) {
    const { issues: refIssues, refs } = requireEvidence(claim, byId);
    issues.push(...refIssues);
    if (refIssues.length > 0) continue;
    issues.push(...validateAgainstEvidence(claim, refs));
  }
  return {
    ok: issues.length === 0,
    validatorVersion: CLAIM_VALIDATOR_VERSION,
    issues
  };
}

export function validateGeneratedSection({ dossierEvidence, section } = {}) {
  return validateDossierClaims({ dossierEvidence, claims: section?.claims ?? [] });
}

export function validateStructuredSection({ dossierEvidence, sectionPlan, section } = {}) {
  const byId = evidenceById(dossierEvidence);
  const issues = [];
  if (!section || section.sectionId !== sectionPlan?.sectionId) {
    issues.push(claimlikeForBlock(null, "section_id_mismatch", `Section attendue ${sectionPlan?.sectionId}, reçue ${section?.sectionId}.`));
    return { ok: false, validatorVersion: CLAIM_VALIDATOR_VERSION, issues };
  }
  const allowedEvidence = new Set([...(sectionPlan.primaryEvidenceRefs ?? []), ...(sectionPlan.secondaryEvidenceRefs ?? [])]);
  const allowedRules = new Set(sectionPlan.allowedInterpretationRuleRefs ?? []);
  const alreadyInterpreted = new Set(sectionPlan.alreadyInterpretedEvidenceRefs ?? []);
  const allClaims = [];

  for (const rawBlock of section.blocks ?? []) {
    const block = expandBlockFromPackets({ block: rawBlock, sectionPlan, issues });
    const blockRefs = Array.isArray(block.evidenceRefs) ? block.evidenceRefs : [];
    const resolvedRefs = [];
    for (const ref of blockRefs) {
      const evidence = byId.get(ref);
      if (!evidence) {
        issues.push(claimlikeForBlock(block, "unknown_evidence_ref", `Preuve introuvable : ${ref}.`, { evidenceRef: ref }));
        continue;
      }
      resolvedRefs.push(evidence);
      if (!allowedEvidence.has(ref)) {
        issues.push(claimlikeForBlock(block, "evidence_not_allowed_in_section", `Preuve non autorisée dans ${section.sectionId} : ${ref}.`, { evidenceRef: ref }));
      }
      if (alreadyInterpreted.has(ref) && block.interpretationDepth === "primary") {
        issues.push(claimlikeForBlock(block, "evidence_reuse_as_primary", `Preuve déjà interprétée ailleurs réutilisée comme interprétation principale : ${ref}.`, { evidenceRef: ref }));
      }
    }
    for (const ruleId of block.interpretationRuleRefs ?? []) {
      const rule = interpretationRuleById(ruleId);
      if (!rule) {
        issues.push(claimlikeForBlock(block, "unknown_interpretation_rule", `Règle d'interprétation inconnue : ${ruleId}.`, { ruleId }));
        continue;
      }
      if (!allowedRules.has(ruleId)) {
        issues.push(claimlikeForBlock(block, "interpretation_rule_not_allowed", `Règle non autorisée dans ${section.sectionId} : ${ruleId}.`, { ruleId }));
      }
      if (!resolvedRefs.some((ref) => ruleMatchesEvidence(rule, ref))) {
        issues.push(claimlikeForBlock(block, "interpretation_rule_without_matching_evidence", `Règle ${ruleId} sans preuve compatible dans le bloc.`, { ruleId }));
      }
    }
    for (const fact of detectAstrologicalTextFacts(block.text)) {
      if (!textFactSupported(fact, resolvedRefs)) {
        issues.push(claimlikeForBlock(block, "undeclared_text_fact", "Le texte contient un fait astrologique concret non couvert par les evidenceRefs du bloc.", { fact }));
      }
    }
    allClaims.push(...(block.claims ?? []));
  }

  const claimResult = validateDossierClaims({ dossierEvidence, claims: allClaims });
  issues.push(...claimResult.issues);
  return {
    ok: issues.length === 0,
    validatorVersion: CLAIM_VALIDATOR_VERSION,
    issues
  };
}

export function validateStructuredSections({ dossierEvidence, fullDossierPlan, sections = [] } = {}) {
  const issues = [];
  for (const section of sections) {
    const plan = (fullDossierPlan?.sections ?? []).find((entry) => entry.sectionId === section.sectionId);
    if (!plan) {
      issues.push(claimlikeForBlock(null, "unknown_section_plan", `Aucun plan pour ${section.sectionId}.`));
      continue;
    }
    const result = validateStructuredSection({ dossierEvidence, sectionPlan: plan, section });
    issues.push(...result.issues);
  }
  return { ok: issues.length === 0, validatorVersion: CLAIM_VALIDATOR_VERSION, issues };
}
