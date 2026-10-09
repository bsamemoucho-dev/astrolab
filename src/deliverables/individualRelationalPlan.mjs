import { evidenceById } from "./dossierEvidence.mjs";
import { RELATIONAL_COMMUNICATION_SCOPE, rulesForEvidence } from "./interpretationRules.mjs";

export const INDIVIDUAL_RELATIONAL_PLAN_VERSION = "individual-relational-plan@0.1.0";
export const INDIVIDUAL_RELATIONAL_AXIS_RULE_VERSION = "lastro.individual_relational.communication@0.1.0";

const SECTION_ID = "relational_communication";
const MAX_ASPECT_RULES_IN_PROSE = 2;
const ASPECT_PAIR_PRIORITY = Object.freeze({
  mars_mercury: 1,
  mercury_venus: 1,
  mercury_sun: 2
});

function key(value) {
  return String(value ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function communicationRulesForEvidence(evidence) {
  return rulesForEvidence(evidence, { scope: RELATIONAL_COMMUNICATION_SCOPE });
}

function aspectPairKey(evidence) {
  const bodies = [evidence?.value?.bodyA, evidence?.value?.bodyB].map((body) => key(body)).sort();
  return bodies.join("_");
}

function isAllowedCommunicationAspect(evidence) {
  if (evidence?.type !== "NATAL_ASPECT") return false;
  return communicationRulesForEvidence(evidence).length > 0;
}

function claimForEvidence(evidence) {
  const value = evidence?.value ?? {};
  if (evidence?.type === "NATAL_BODY_SIGN") {
    return [{ type: "NATAL_BODY_SIGN", body: value.body, sign: value.sign, evidenceRefs: [evidence.evidenceId] }];
  }
  if (evidence?.type === "NATAL_ASPECT") {
    return [{ type: "NATAL_ASPECT", bodyA: value.bodyA, bodyB: value.bodyB, aspectType: value.aspectType, orb: value.orb, evidenceRefs: [evidence.evidenceId] }];
  }
  return [];
}

function ruleThemesForBlock(rule, blockRole) {
  if (blockRole === "resource") return rule?.relationalCommunication?.resourceThemes ?? [];
  if (blockRole === "attention_point") return rule?.relationalCommunication?.attentionThemes ?? [];
  return rule?.relationalCommunication?.spontaneousThemes ?? rule?.themes ?? [];
}

function packetForEvidence(evidence, { rule = null, blockRole = "spontaneous_dynamic", interpretationDepth = "primary", sourceRole = "primary_interpretation", maxSentences = null, openingAllowed = true } = {}) {
  const rules = rule ? [rule] : communicationRulesForEvidence(evidence);
  const ruleIds = rules.map((item) => item.ruleId);
  const themes = rules.flatMap((item) => ruleThemesForBlock(item, blockRole));
  return {
    packetId: `${SECTION_ID}.${key(evidence.evidenceId)}.${blockRole}`,
    evidenceRefs: [evidence.evidenceId],
    interpretationRuleRefs: ruleIds,
    claims: claimForEvidence(evidence).map((claim, index) => ({
      claimId: `${SECTION_ID}.${key(evidence.evidenceId)}.${blockRole}.${index + 1}`,
      ...claim
    })),
    interpretationDepth,
    sourceRole,
    maxSentences,
    openingAllowed,
    themes,
    narrativeRole: blockRole,
    themeRefs: themes.map((theme, index) => ({
      theme,
      interpretationRuleRef: ruleIds[Math.min(index, ruleIds.length - 1)] ?? null
    }))
  };
}

function maxSentencesForPackets(packets = []) {
  return packets.reduce((sum, packet) => sum + (packet.themes?.length ?? 0), 0);
}

function aspectCandidate(evidence) {
  const rules = communicationRulesForEvidence(evidence);
  const rule = rules[0] ?? null;
  if (!rule) return null;
  const pairKey = aspectPairKey(evidence);
  return {
    evidence,
    rule,
    pairKey,
    priority: ASPECT_PAIR_PRIORITY[pairKey] ?? 99,
    orb: Number.isFinite(Number(evidence.value?.orb)) ? Number(evidence.value.orb) : 99
  };
}

function selectAspectCandidates(items) {
  return items
    .map(aspectCandidate)
    .filter(Boolean)
    .sort((left, right) =>
      left.priority - right.priority ||
      left.orb - right.orb ||
      String(left.evidence.evidenceId).localeCompare(String(right.evidence.evidenceId))
    );
}

export function selectCommunicationRelationalEvidence(dossierEvidence) {
  const byId = evidenceById(dossierEvidence);
  const aspectCandidates = selectAspectCandidates([...byId.values()]
    .filter(isAllowedCommunicationAspect)
  );
  const selectedAspectCandidates = aspectCandidates.slice(0, MAX_ASPECT_RULES_IN_PROSE);
  const conditional = selectedAspectCandidates.map((candidate) => candidate.evidence);

  return {
    guaranteed: [],
    conditional,
    aspectCandidates,
    selectedAspectCandidates,
    selected: conditional,
    omitted: [...byId.values()].filter((item) =>
      (item.type === "NATAL_BODY_SIGN" || item.type === "NATAL_ASPECT") &&
      !conditional.some((selected) => selected.evidenceId === item.evidenceId)
    )
  };
}

export function buildIndividualRelationalCommunicationPlan(dossierEvidence) {
  const selection = selectCommunicationRelationalEvidence(dossierEvidence);
  const spontaneousPackets = selection.selectedAspectCandidates
    .map((candidate) => packetForEvidence(candidate.evidence, { rule: candidate.rule, blockRole: "spontaneous_dynamic" }))
    .filter((packet) => packet.themes.length > 0);
  const resourcePackets = selection.selectedAspectCandidates
    .map((candidate) => packetForEvidence(candidate.evidence, { rule: candidate.rule, blockRole: "resource" }))
    .filter((packet) => packet.themes.length > 0);
  const attentionPackets = selection.selectedAspectCandidates
    .map((candidate) => packetForEvidence(candidate.evidence, { rule: candidate.rule, blockRole: "attention_point" }))
    .filter((packet) => packet.themes.length > 0);
  const evidencePackets = [...spontaneousPackets, ...resourcePackets, ...attentionPackets];
  const evidenceRefs = selection.selected.map((item) => item.evidenceId);
  const allowedInterpretationRuleRefs = [...new Set(evidencePackets.flatMap((packet) => packet.interpretationRuleRefs ?? []))];
  const blockPlans = [
    {
      blockId: "spontaneous_dynamic",
      packetRefs: spontaneousPackets.map((packet) => packet.packetId),
      narrativeRole: "spontaneous_dynamic",
      maxSentences: maxSentencesForPackets(spontaneousPackets)
    },
    {
      blockId: "resource",
      packetRefs: resourcePackets.map((packet) => packet.packetId),
      narrativeRole: "resource",
      maxSentences: maxSentencesForPackets(resourcePackets)
    }
  ];
  if (attentionPackets.length > 0) {
    blockPlans.push({
      blockId: "attention_point",
      packetRefs: attentionPackets.map((packet) => packet.packetId),
      narrativeRole: "attention_point",
      maxSentences: maxSentencesForPackets(attentionPackets)
    });
  }

  const section = {
    sectionId: SECTION_ID,
    title: "Communication relationnelle",
    objective: "Décrire comment la personne formule, verbalise et échange dans la relation, sans refaire le chapitre natal Communication.",
    minWords: 120,
    targetWords: 260,
    maxWords: 460,
    primaryEvidenceRefs: evidenceRefs,
    secondaryEvidenceRefs: [],
    forbiddenEvidenceRefs: selection.omitted.map((item) => item.evidenceId),
    alreadyInterpretedEvidenceRefs: [],
    allowedInterpretationRuleRefs,
    evidencePackets,
    blockPlans,
    preconditions: attentionPackets.length > 0 ? [] : [{ status: "not_available", blockId: "attention_point", reason: "no_authorized_attention_theme" }],
    lastroInterpretiveMapping: {
      ruleVersion: INDIVIDUAL_RELATIONAL_AXIS_RULE_VERSION,
      nature: "LASTRO_RULE",
      subtype: "RELATIONAL_INTERPRETATION",
      axisId: "relational_communication",
      description: "Communication relationnelle V1 uses only explicit Lastro relational rules for selected Mercury aspects. Mercury sign is deferred for this axis."
    },
    writerGuidance: [
      "Verticale : Moi en relation.",
      "Section unique : Communication relationnelle.",
      "Angle : comment la personne formule, verbalise et échange dans une relation.",
      "Ne pas refaire le chapitre natal Communication.",
      "N'interprète jamais librement un aspect : utilise seulement les thèmes Lastro transmis dans les packets.",
      "Moon sign et Mercury sign seuls sont exclus de cette V1 d'axe.",
      "Ne déduis jamais l'inverse de l'absence d'un aspect.",
      "Ne développe jamais plus de deux règles aspectuelles dans la prose finale.",
      "Nomme la dynamique, pas le mécanisme astrologique : évite conjonction, trigone, sextile, carré, opposition, ainsi que les formulations comme grâce à la conjonction de ou facilité par le trigone entre.",
      "Respect sémantique strict : reformulation stylistique autorisée, élargissement du sens interdit. Par exemple, transformer une idée en échange concret ne devient pas transformer les idées en actions concrètes, et adoucir un désaccord ne devient pas atténuer les conflits.",
      "Reformule uniquement les thèmes transmis au bloc courant.",
      "Écris une seule phrase maximum par thème transmis au bloc courant.",
      "Chaque phrase doit reformuler un seul thème du bloc courant.",
      "N'ajoute ni introduction générale, ni transition, ni synthèse, ni conclusion.",
      "Ne reprends pas dans un bloc un thème réservé à un autre bloc.",
      "Ne pas ajouter une capacité, une motivation, une faiblesse, une conséquence ou un résultat relationnel absent du thème transmis.",
      "Ne pas ajouter de bénéfice relationnel global après un thème.",
      "Ne répète pas un thème déjà exprimé dans le même bloc.",
      "Ne pas compléter une idée par ce qu'elle pourrait logiquement produire.",
      "Ne pas inventer de point d'attention pour équilibrer le texte.",
      "Reste concis : aucun remplissage ni longueur minimale.",
      "Si aucun packet attention_point n'est transmis, n'invente pas de vigilance.",
      "Évite les formulations génériques non ancrées comme créer des liens profonds, renforcer la connexion, belle énergie, beau potentiel, relation enrichissante, connexion naturelle, échanges de qualité, belle complicité, favoriser des interactions plus fluides.",
      "Ne pas employer de vocabulaire clinique.",
      "Structure narrative attendue : dynamique spontanée, ressource, point d'attention seulement si disponible.",
      "Évite les introductions scolaires ou injonctives : Il est important de, Il est essentiel de, Il est nécessaire de, il faut, vous devez.",
      "Formule le point d'attention directement, sans amorce scolaire ni détour moral.",
      "Ne jamais écrire 'vous devez'."
    ],
    rules: {
      maxAspectRulesInProse: MAX_ASPECT_RULES_IN_PROSE,
      selectedAspectRuleRefs: selection.selectedAspectCandidates.map((candidate) => candidate.rule.ruleId),
      candidateAspectRuleRefs: selection.aspectCandidates.map((candidate) => candidate.rule.ruleId),
      nonSelectedAspectRuleRefs: selection.aspectCandidates.slice(MAX_ASPECT_RULES_IN_PROSE).map((candidate) => candidate.rule.ruleId),
      attentionPoint: attentionPackets.length > 0 ? "available" : "not_available"
    }
  };

  return {
    schema: "astrolab.individual_relational_plan",
    version: INDIVIDUAL_RELATIONAL_PLAN_VERSION,
    product: {
      id: "individual_relational",
      publicName: "Moi en relation"
    },
    sections: [section],
    selection: {
      guaranteedEvidenceRefs: selection.guaranteed.map((item) => item.evidenceId),
      conditionalEvidenceRefs: selection.conditional.map((item) => item.evidenceId),
      omittedEvidenceRefs: selection.omitted.map((item) => item.evidenceId),
      candidateAspectRuleRefs: selection.aspectCandidates.map((candidate) => candidate.rule.ruleId),
      selectedAspectRuleRefs: selection.selectedAspectCandidates.map((candidate) => candidate.rule.ruleId),
      nonSelectedAspectRuleRefs: selection.aspectCandidates.slice(MAX_ASPECT_RULES_IN_PROSE).map((candidate) => candidate.rule.ruleId)
    }
  };
}

export function relationalCommunicationSectionForRender(section) {
  return {
    id: SECTION_ID,
    title: "Communication relationnelle",
    badgeCode: "symbolic",
    badgeLabel: "Interprétation Lastro",
    status: "ok",
    validation: { ok: true, issues: [] },
    text: (section?.blocks ?? []).map((block) => block.text).filter(Boolean).join("\n\n")
  };
}
