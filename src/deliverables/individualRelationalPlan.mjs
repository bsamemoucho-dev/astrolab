import { evidenceById } from "./dossierEvidence.mjs";
import { RELATIONAL_AFFECTION_SCOPE, RELATIONAL_COMMUNICATION_SCOPE, rulesForEvidence } from "./interpretationRules.mjs";
import { RELATIONAL_AFFECTION_SELECTION_POLICY } from "./relationalAffectionRules.mjs";

export const INDIVIDUAL_RELATIONAL_PLAN_VERSION = "individual-relational-plan@0.1.0";
export const INDIVIDUAL_RELATIONAL_AXIS_RULE_VERSION = "lastro.individual_relational.communication@0.1.0";
export const INDIVIDUAL_RELATIONAL_AFFECTION_AXIS_RULE_VERSION = "lastro.individual_relational.affection@0.1.0";

const SECTION_ID = "relational_communication";
const AFFECTION_SECTION_ID = "relational_affection";
const MAX_ASPECT_RULES_IN_PROSE = 2;
const MAX_AFFECTION_ASPECT_RULES_IN_PROSE = RELATIONAL_AFFECTION_SELECTION_POLICY.maxAspectRulesInProse;
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

function affectionRulesForEvidence(evidence) {
  return rulesForEvidence(evidence, { scope: RELATIONAL_AFFECTION_SCOPE })
    .filter((rule) => Array.isArray(rule.scope) && rule.scope.includes(RELATIONAL_AFFECTION_SCOPE));
}

function aspectPairKey(evidence) {
  const bodies = [evidence?.value?.bodyA, evidence?.value?.bodyB].map((body) => key(body)).sort();
  return bodies.join("_");
}

function isAllowedCommunicationAspect(evidence) {
  if (evidence?.type !== "NATAL_ASPECT") return false;
  return communicationRulesForEvidence(evidence).length > 0;
}

function isCertainAcrossApplicableWindow(evidence) {
  return evidence?.certainty?.stableAcrossApplicableWindow === true;
}

function isAllowedAffectionAspect(evidence) {
  if (evidence?.type !== "NATAL_ASPECT") return false;
  if (!isCertainAcrossApplicableWindow(evidence)) return false;
  return affectionRulesForEvidence(evidence).length > 0;
}

function isStableAffectionVenusSign(evidence) {
  if (evidence?.type !== "NATAL_BODY_SIGN") return false;
  if (key(evidence?.value?.body) !== "venus") return false;
  if (!isCertainAcrossApplicableWindow(evidence)) return false;
  return affectionRulesForEvidence(evidence).length > 0;
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

function affectionRuleThemesForBlock(rule, blockRole) {
  if (blockRole === "resource") return rule?.relationalAffection?.resourceThemes ?? [];
  if (blockRole === "attention_point") return rule?.relationalAffection?.attentionThemes ?? [];
  return rule?.relationalAffection?.spontaneousThemes ?? rule?.themes ?? [];
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

function packetForAffectionEvidence(evidence, { rule = null, blockRole = "spontaneous_dynamic", interpretationDepth = "primary", sourceRole = "primary_interpretation", maxSentences = null, openingAllowed = true } = {}) {
  const rules = rule ? [rule] : affectionRulesForEvidence(evidence);
  const ruleIds = rules.map((item) => item.ruleId);
  const themes = rules.flatMap((item) => affectionRuleThemesForBlock(item, blockRole));
  return {
    packetId: `${AFFECTION_SECTION_ID}.${key(evidence.evidenceId)}.${blockRole}`,
    evidenceRefs: [evidence.evidenceId],
    interpretationRuleRefs: ruleIds,
    claims: claimForEvidence(evidence).map((claim, index) => ({
      claimId: `${AFFECTION_SECTION_ID}.${key(evidence.evidenceId)}.${blockRole}.${index + 1}`,
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

function normalizedExactness(evidence) {
  if (Number.isFinite(Number(evidence?.certainty?.normalizedExactness))) {
    return Math.abs(Number(evidence.certainty.normalizedExactness));
  }
  const orb = Math.abs(Number(evidence?.value?.orb));
  const orbLimit = Math.abs(Number(evidence?.value?.orbLimit));
  if (!Number.isFinite(orb) || !Number.isFinite(orbLimit) || orbLimit <= 0) return 99;
  return orb / orbLimit;
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

function affectionAspectCandidate(evidence) {
  const rules = affectionRulesForEvidence(evidence);
  const rule = rules[0] ?? null;
  if (!rule) return null;
  const orb = Number.isFinite(Number(evidence.value?.orb)) ? Math.abs(Number(evidence.value.orb)) : 99;
  return {
    evidence,
    rule,
    normalizedExactness: normalizedExactness(evidence),
    orb
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

function selectAffectionAspectCandidates(items) {
  return items
    .map(affectionAspectCandidate)
    .filter(Boolean)
    .sort((left, right) =>
      left.normalizedExactness - right.normalizedExactness ||
      left.orb - right.orb ||
      String(left.rule.ruleId).localeCompare(String(right.rule.ruleId))
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

export function selectAffectionRelationalEvidence(dossierEvidence) {
  const byId = evidenceById(dossierEvidence);
  const allItems = [...byId.values()];
  const aspectCandidates = selectAffectionAspectCandidates(allItems.filter(isAllowedAffectionAspect));
  const selectedAspectCandidates = aspectCandidates.slice(0, MAX_AFFECTION_ASPECT_RULES_IN_PROSE);
  const fallbackVenusSign = selectedAspectCandidates.length === 0
    ? allItems.find(isStableAffectionVenusSign) ?? null
    : null;
  const selectedFallbackRule = fallbackVenusSign ? affectionRulesForEvidence(fallbackVenusSign)[0] ?? null : null;
  const selected = selectedAspectCandidates.length > 0
    ? selectedAspectCandidates.map((candidate) => candidate.evidence)
    : (fallbackVenusSign ? [fallbackVenusSign] : []);

  return {
    guaranteed: [],
    conditional: selected,
    aspectCandidates,
    selectedAspectCandidates,
    fallbackVenusSign,
    selectedFallbackRule,
    selected,
    omitted: allItems.filter((item) =>
      (item.type === "NATAL_BODY_SIGN" || item.type === "NATAL_ASPECT") &&
      !selected.some((selectedItem) => selectedItem.evidenceId === item.evidenceId)
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

export function buildIndividualRelationalAffectionPlan(dossierEvidence) {
  const selection = selectAffectionRelationalEvidence(dossierEvidence);
  const selectedCandidates = selection.selectedAspectCandidates.length > 0
    ? selection.selectedAspectCandidates
    : (selection.fallbackVenusSign && selection.selectedFallbackRule
        ? [{ evidence: selection.fallbackVenusSign, rule: selection.selectedFallbackRule, normalizedExactness: null, orb: null }]
        : []);
  const spontaneousPackets = selectedCandidates
    .map((candidate) => packetForAffectionEvidence(candidate.evidence, { rule: candidate.rule, blockRole: "spontaneous_dynamic" }))
    .filter((packet) => packet.themes.length > 0);
  const resourcePackets = selectedCandidates
    .map((candidate) => packetForAffectionEvidence(candidate.evidence, { rule: candidate.rule, blockRole: "resource" }))
    .filter((packet) => packet.themes.length > 0);
  const attentionCandidate = selection.selectedAspectCandidates.find((candidate) =>
    (candidate.rule?.relationalAffection?.attentionThemes ?? []).length > 0
  ) ?? null;
  const attentionPackets = attentionCandidate
    ? [packetForAffectionEvidence(attentionCandidate.evidence, { rule: attentionCandidate.rule, blockRole: "attention_point" })].filter((packet) => packet.themes.length > 0)
    : [];
  const evidencePackets = [...spontaneousPackets, ...resourcePackets, ...attentionPackets];
  const evidenceRefs = selection.selected.map((item) => item.evidenceId);
  const allowedInterpretationRuleRefs = [...new Set(evidencePackets.flatMap((packet) => packet.interpretationRuleRefs ?? []))];
  const blockPlans = [];
  if (spontaneousPackets.length > 0) {
    blockPlans.push({
      blockId: "spontaneous_dynamic",
      packetRefs: spontaneousPackets.map((packet) => packet.packetId),
      narrativeRole: "spontaneous_dynamic",
      maxSentences: maxSentencesForPackets(spontaneousPackets),
      sentenceLimitMode: "warning"
    });
  }
  if (resourcePackets.length > 0) {
    blockPlans.push({
      blockId: "resource",
      packetRefs: resourcePackets.map((packet) => packet.packetId),
      narrativeRole: "resource",
      maxSentences: maxSentencesForPackets(resourcePackets),
      sentenceLimitMode: "warning"
    });
  }
  if (attentionPackets.length > 0) {
    blockPlans.push({
      blockId: "attention_point",
      packetRefs: attentionPackets.map((packet) => packet.packetId),
      narrativeRole: "attention_point",
      maxSentences: maxSentencesForPackets(attentionPackets),
      sentenceLimitMode: "warning"
    });
  }

  const section = {
    sectionId: AFFECTION_SECTION_ID,
    title: "Manière d'exprimer son affection",
    objective: "Décrire comment la personne donne et manifeste son affection, sans traiter la réception de l'affection, la séduction, le désir ou les besoins relationnels.",
    minWords: 100,
    targetWords: 220,
    maxWords: 420,
    primaryEvidenceRefs: evidenceRefs,
    secondaryEvidenceRefs: [],
    forbiddenEvidenceRefs: selection.omitted.map((item) => item.evidenceId),
    alreadyInterpretedEvidenceRefs: [],
    allowedInterpretationRuleRefs,
    evidencePackets,
    blockPlans,
    preconditions: [
      ...(evidencePackets.length > 0 ? [] : [{ status: "not_available", blockId: "relational_affection", reason: "no_certain_affection_evidence" }]),
      ...(attentionPackets.length > 0 ? [] : [{ status: "not_available", blockId: "attention_point", reason: "no_authorized_attention_theme" }])
    ],
    lastroInterpretiveMapping: {
      ruleVersion: INDIVIDUAL_RELATIONAL_AFFECTION_AXIS_RULE_VERSION,
      nature: "LASTRO_RULE",
      subtype: "RELATIONAL_INTERPRETATION",
      axisId: "relational_affection",
      description: "Affection V1 uses explicit Lastro relational rules. Aspects are prioritized; Venus sign is fallback only when no certain eligible aspect remains and Venus sign is stable."
    },
    writerGuidance: [
      "Verticale : Moi en relation.",
      "Section unique : Manière d'exprimer son affection.",
      "Angle : comment la personne donne et manifeste son affection.",
      "Ne traite pas la manière de recevoir l'affection, les besoins affectifs, la séduction, le désir, la communication ou la synastrie.",
      "N'interprète jamais librement un aspect ou un signe : utilise seulement les thèmes Lastro transmis dans les packets.",
      "Si des aspects sont transmis, le signe de Vénus ne doit pas être développé.",
      "Si le fallback Venus sign est transmis, il remplace seulement l'absence d'aspect certain.",
      "Ne déduis jamais l'inverse de l'absence d'un aspect.",
      "Ne développe jamais plus de deux règles aspectuelles dans la prose finale.",
      "Nomme la dynamique, pas le mécanisme astrologique : évite conjonction, trigone, sextile, carré, opposition, ainsi que les formulations comme grâce à la conjonction de ou facilité par le trigone entre.",
      "Respect sémantique strict : reformulation stylistique autorisée, élargissement du sens interdit.",
      "Reformule le thème transmis de façon proche et concise.",
      "Reformule uniquement les thèmes transmis au bloc courant.",
      "Écris une seule phrase maximum par thème transmis au bloc courant ; un dépassement reste un avertissement éditorial, pas un motif de retry.",
      "Chaque phrase doit reformuler un seul thème du bloc courant.",
      "N'ajoute ni introduction générale, ni transition, ni synthèse, ni conclusion.",
      "Ne reprends pas dans un bloc un thème réservé à un autre bloc.",
      "Ne pas ajouter une capacité, une motivation, une faiblesse, une conséquence ou un résultat relationnel absent du thème transmis.",
      "Ne pas ajouter d'intention ou de motivation.",
      "Ne pas ajouter de qualité morale ou psychologique.",
      "Ne pas ajouter d'adverbe qui intensifie une capacité.",
      "Ne pas prolonger la phrase par une conséquence, une justification ou un résultat relationnel.",
      "Arrête la phrase dès que le thème transmis est reformulé.",
      "Ne transforme pas plusieurs formes d'expression en alternance, sauf si le thème transmis contient explicitement cette alternance.",
      "Dans le bloc resource, exprime uniquement la ressource transmise sans répéter la dynamique spontanée.",
      "Ne commence pas les blocs resource ou attention_point par : Vous manifestez votre affection…",
      "Ne commence pas les blocs resource ou attention_point par : Vous exprimez votre affection…",
      "Ne pas inventer de point d'attention pour équilibrer le texte.",
      "Si aucun packet attention_point n'est transmis, n'invente pas de vigilance.",
      "Reste concis : aucun remplissage ni longueur minimale.",
      "Ne pas employer de vocabulaire clinique.",
      "Structure narrative attendue : dynamique spontanée, ressource, point d'attention seulement si disponible.",
      "Évite les introductions scolaires ou injonctives : Il est important de, Il est essentiel de, Il est nécessaire de, il faut, vous devez.",
      "Ne jamais écrire 'vous devez'."
    ],
    rules: {
      maxAspectRulesInProse: MAX_AFFECTION_ASPECT_RULES_IN_PROSE,
      maxAttentionPoints: RELATIONAL_AFFECTION_SELECTION_POLICY.maxAttentionPoints,
      selectedAspectRuleRefs: selection.selectedAspectCandidates.map((candidate) => candidate.rule.ruleId),
      candidateAspectRuleRefs: selection.aspectCandidates.map((candidate) => candidate.rule.ruleId),
      nonSelectedAspectRuleRefs: selection.aspectCandidates.slice(MAX_AFFECTION_ASPECT_RULES_IN_PROSE).map((candidate) => candidate.rule.ruleId),
      fallbackRuleRef: selection.selectedFallbackRule?.ruleId ?? null,
      selectedRuleRefs: allowedInterpretationRuleRefs,
      attentionPoint: attentionPackets.length > 0 ? "available" : "not_available",
      selectionPolicy: RELATIONAL_AFFECTION_SELECTION_POLICY
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
      nonSelectedAspectRuleRefs: selection.aspectCandidates.slice(MAX_AFFECTION_ASPECT_RULES_IN_PROSE).map((candidate) => candidate.rule.ruleId),
      fallbackRuleRef: selection.selectedFallbackRule?.ruleId ?? null
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

export function relationalAffectionSectionForRender(section) {
  return {
    id: AFFECTION_SECTION_ID,
    title: "Manière d'exprimer son affection",
    badgeCode: "symbolic",
    badgeLabel: "Interprétation Lastro",
    status: "ok",
    validation: { ok: true, issues: [] },
    text: (section?.blocks ?? []).map((block) => block.text).filter(Boolean).join("\n\n")
  };
}
