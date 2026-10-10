import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildIndividualRelationalCommunicationPlan, relationalCommunicationSectionForRender } from "../src/deliverables/individualRelationalPlan.mjs";
import { INTERPRETATION_LIBRARY_VERSION, interpretationRuleById, rulesForEvidence } from "../src/deliverables/interpretationRules.mjs";
import { renderDossierHtml, renderDossierMarkdown } from "../src/deliverables/render.mjs";
import { buildStructuredSystemPrompt, structuredSectionLlmConfiguration, writeStructuredSectionWithLlm } from "../src/deliverables/structuredSectionWriter.mjs";
import { llmConfiguration, writeSection } from "../src/deliverables/writers.mjs";
import { expandStructuredSectionFromPackets, validateStructuredSection } from "../src/deliverables/factualClaimsValidator.mjs";

function natalSign(body, sign) {
  return {
    evidenceId: `natal.${body.toLowerCase()}.sign`,
    type: "NATAL_BODY_SIGN",
    value: { body, sign, degreeInSign: 10, longitude: 10 },
    provenance: { reliability: "HIGH", methodVersion: "test", ruleVersion: null }
  };
}

function natalAspect(bodyA, bodyB, aspectType, orb = 1) {
  const ordered = [bodyA, bodyB].sort((left, right) => left.localeCompare(right));
  return {
    evidenceId: `aspect.${ordered[0].toLowerCase()}.${ordered[1].toLowerCase()}.${aspectType}`,
    type: "NATAL_ASPECT",
    value: { bodyA, bodyB, aspectType, orb, orbLimit: 8, exactness: orb, ruleVersion: "lastro-aspects@1.0.0" },
    provenance: { reliability: "HIGH", methodVersion: "western-natal@test", ruleVersion: "lastro-aspects@1.0.0" }
  };
}

function dossier(items = []) {
  return {
    schema: "astrolab.dossier_evidence",
    version: "test",
    evidence: [natalSign("Mercury", "Cancer"), natalSign("Moon", "Leo"), ...items]
  };
}

function planFor(items = []) {
  const dossierEvidence = dossier(items);
  const plan = buildIndividualRelationalCommunicationPlan(dossierEvidence);
  return { dossierEvidence, plan, sectionPlan: plan.sections[0] };
}

function contrastFixturePlan() {
  const generatedAt = "2026-10-09T00:00:00.000Z";
  const { result, calculationRun } = calculateWesternNatalChart({
    birthDate: "1900-10-08",
    timeValue: "12:00",
    timePrecision: "exact",
    birthPlace: "Paris",
    latitude: 48.8566,
    longitude: 2.3522,
    timeZone: "Europe/Paris"
  }, { calculatedAt: generatedAt });
  const dossierEvidence = buildDossierEvidence({ natalResult: result, natalRun: calculationRun, generatedAt });
  const plan = buildIndividualRelationalCommunicationPlan(dossierEvidence);
  return { dossierEvidence, plan, sectionPlan: plan.sections[0] };
}

function packetThemes(sectionPlan, ruleId, role = null) {
  return sectionPlan.evidencePackets
    .filter((packet) => packet.interpretationRuleRefs.includes(ruleId) && (!role || packet.narrativeRole === role))
    .flatMap((packet) => packet.themes);
}

function selectedRules(sectionPlan) {
  return sectionPlan.rules.selectedAspectRuleRefs;
}

function packetById(sectionPlan) {
  return new Map(sectionPlan.evidencePackets.map((packet) => [packet.packetId, packet]));
}

function themeMatrix(sectionPlan) {
  const packets = packetById(sectionPlan);
  return sectionPlan.blockPlans.flatMap((block) => block.packetRefs.flatMap((packetRef) => {
    const packet = packets.get(packetRef);
    return (packet?.themes ?? []).map((theme, themeIndex) => ({
      blockId: block.blockId,
      packetRef,
      interpretationRuleRef: packet.interpretationRuleRefs[Math.min(themeIndex, packet.interpretationRuleRefs.length - 1)] ?? null,
      themeType: packet.narrativeRole,
      themeIndex,
      theme
    }));
  }));
}

function blockPlan(sectionPlan, blockId) {
  return sectionPlan.blockPlans.find((block) => block.blockId === blockId);
}

function sectionWithText(sectionPlan, textByBlock) {
  return {
    sectionId: sectionPlan.sectionId,
    contractVersion: "structured-section-writer@0.1.0",
    blocks: sectionPlan.blockPlans.map((plan) => ({
      blockId: plan.blockId,
      text: textByBlock[plan.blockId] ?? "La formulation reste limitée au thème transmis."
    }))
  };
}

function assertRuleSelected({ bodyA, bodyB, aspectType, ruleId, expectedTheme }) {
  const { sectionPlan } = planFor([natalAspect(bodyA, bodyB, aspectType)]);
  assert.ok(selectedRules(sectionPlan).includes(ruleId));
  assert.ok(packetThemes(sectionPlan, ruleId).includes(expectedTheme));
  assert.ok(sectionPlan.allowedInterpretationRuleRefs.includes(ruleId));
}

async function withEnv(patch, fn) {
  const old = {};
  for (const key of Object.keys(patch)) {
    old[key] = process.env[key];
    if (patch[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = patch[key];
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("Mercury-Mars conjunction produit sa règle relationnelle", () => {
  assertRuleSelected({
    bodyA: "Mercury",
    bodyB: "Mars",
    aspectType: "conjunction",
    ruleId: "western.natal.mercury_mars.conjunction@1",
    expectedTheme: "pensée, parole et réaction tendent à partir ensemble"
  });
});

test("Mercury-Mars trine produit sa règle relationnelle", () => {
  assertRuleSelected({
    bodyA: "Mercury",
    bodyB: "Mars",
    aspectType: "trine",
    ruleId: "western.natal.mercury_mars.trine@1",
    expectedTheme: "circulation fluide entre idée, parole et prise de position"
  });
});

test("Mercury-Mars sextile peut produire attention_point = not_available", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "sextile")]);
  assert.ok(selectedRules(sectionPlan).includes("western.natal.mercury_mars.sextile@1"));
  assert.equal(sectionPlan.rules.attentionPoint, "not_available");
  assert.ok(!sectionPlan.blockPlans.some((block) => block.blockId === "attention_point"));
});

test("Mercury-Mars square produit une vigilance non déterministe", () => {
  const ruleId = "western.natal.mercury_mars.square@1";
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "square")]);
  assert.ok(packetThemes(sectionPlan, ruleId, "attention_point").includes("sous tension, le rythme ou le ton de l'échange peut se durcir"));
  assert.ok(interpretationRuleById(ruleId).forbidden.includes("personne agressive"));
});

test("Mercury-Mars opposition produit sa règle relationnelle", () => {
  assertRuleSelected({
    bodyA: "Mercury",
    bodyB: "Mars",
    aspectType: "opposition",
    ruleId: "western.natal.mercury_mars.opposition@1",
    expectedTheme: "polarité entre raisonnement et affirmation de positions"
  });
});

test("Mercury-Venus conjunction produit sa règle relationnelle", () => {
  assertRuleSelected({
    bodyA: "Mercury",
    bodyB: "Venus",
    aspectType: "conjunction",
    ruleId: "western.natal.mercury_venus.conjunction@1",
    expectedTheme: "parole et recherche d'harmonie relationnelle sont fortement associées"
  });
});

test("Mercury-Venus sextile produit sa règle relationnelle", () => {
  assertRuleSelected({
    bodyA: "Mercury",
    bodyB: "Venus",
    aspectType: "sextile",
    ruleId: "western.natal.mercury_venus.sextile@1",
    expectedTheme: "facilité disponible pour ajuster la manière de dire au contexte relationnel"
  });
});

test("Sun-Mercury conjunction produit une règle secondaire", () => {
  const ruleId = "western.natal.sun_mercury.conjunction@1";
  assertRuleSelected({
    bodyA: "Sun",
    bodyB: "Mercury",
    aspectType: "conjunction",
    ruleId,
    expectedTheme: "pensée, parole et position personnelle sont étroitement associées"
  });
  assert.equal(interpretationRuleById(ruleId).relationalCommunication.editorialWeight, "secondary");
});

test("aucune règle natale Mercury-Venus trine/square/opposition n'existe", () => {
  for (const aspectType of ["trine", "square", "opposition"]) {
    assert.equal(interpretationRuleById(`western.natal.mercury_venus.${aspectType}@1`), null);
    assert.deepEqual(rulesForEvidence(natalAspect("Mercury", "Venus", aspectType), { scope: "individual_relational.communication" }), []);
  }
});

test("aucune règle natale Sun-Mercury autre que conjunction n'existe", () => {
  for (const aspectType of ["sextile", "square", "trine", "opposition"]) {
    assert.equal(interpretationRuleById(`western.natal.sun_mercury.${aspectType}@1`), null);
    assert.deepEqual(rulesForEvidence(natalAspect("Sun", "Mercury", aspectType), { scope: "individual_relational.communication" }), []);
  }
});

test("Moon sign et Mercury sign seuls ne sont pas transmis au writer", () => {
  const { sectionPlan } = planFor([]);
  const refs = new Set(sectionPlan.evidencePackets.flatMap((packet) => packet.evidenceRefs));
  assert.ok(!refs.has("natal.mercury.sign"));
  assert.ok(!refs.has("natal.moon.sign"));
  assert.ok(sectionPlan.forbiddenEvidenceRefs.includes("natal.mercury.sign"));
  assert.ok(sectionPlan.forbiddenEvidenceRefs.includes("natal.moon.sign"));
  assert.equal(sectionPlan.allowedInterpretationRuleRefs.some((ruleId) => ruleId.startsWith("western.body.mercury.sign.")), false);
});

test("absence de Sun-Mercury conjunction ne produit aucune interprétation inverse", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  assert.ok(!sectionPlan.allowedInterpretationRuleRefs.includes("western.natal.sun_mercury.conjunction@1"));
  assert.ok(!sectionPlan.rules.candidateAspectRuleRefs.includes("western.natal.sun_mercury.conjunction@1"));
});

test("aspect hors whitelist ne fournit aucun thème", () => {
  const { sectionPlan } = planFor([natalAspect("Venus", "Mars", "trine")]);
  assert.ok(!sectionPlan.primaryEvidenceRefs.includes("aspect.mars.venus.trine"));
  assert.ok(sectionPlan.forbiddenEvidenceRefs.includes("aspect.mars.venus.trine"));
});

test("Moon-Mercury square reste hors scope Communication relationnelle", () => {
  const { plan, sectionPlan } = planFor([natalAspect("Moon", "Mercury", "square")]);
  assert.deepEqual(plan.selection.candidateAspectRuleRefs, []);
  assert.deepEqual(plan.selection.selectedAspectRuleRefs, []);
  assert.deepEqual(sectionPlan.primaryEvidenceRefs, []);
  assert.deepEqual(sectionPlan.allowedInterpretationRuleRefs, []);
  assert.deepEqual(sectionPlan.evidencePackets, []);
  assert.deepEqual(sectionPlan.blockPlans, []);
  assert.ok(sectionPlan.forbiddenEvidenceRefs.includes("aspect.mercury.moon.square"));
});

test("les règles sans scope explicite sont rejetées par Communication relationnelle", () => {
  const { sectionPlan } = planFor([natalAspect("Moon", "Mercury", "square")]);
  assert.equal(interpretationRuleById("western.aspect.moon_mercury.square@1").scope, undefined);
  assert.equal(sectionPlan.allowedInterpretationRuleRefs.includes("western.aspect.moon_mercury.square@1"), false);
});

test("les règles d'un autre scope sont rejetées par Communication relationnelle", () => {
  const { sectionPlan } = planFor([natalAspect("Sun", "Venus", "conjunction")]);
  assert.deepEqual(interpretationRuleById("western.relational.affection.sun_venus.conjunction@1").scope, [
    "individual_relational.affection"
  ]);
  assert.deepEqual(sectionPlan.allowedInterpretationRuleRefs, []);
  assert.deepEqual(sectionPlan.evidencePackets, []);
  assert.deepEqual(sectionPlan.blockPlans, []);
});

test("le thème de reading_3764 n'alimente pas Communication relationnelle", () => {
  const { sectionPlan } = planFor([
    natalAspect("Venus", "Mars", "sextile"),
    natalAspect("Moon", "Mercury", "square"),
    natalAspect("Sun", "Mars", "sextile"),
    natalAspect("Sun", "Venus", "conjunction")
  ]);
  assert.deepEqual(sectionPlan.primaryEvidenceRefs, []);
  assert.deepEqual(sectionPlan.allowedInterpretationRuleRefs, []);
  assert.deepEqual(sectionPlan.evidencePackets, []);
  assert.deepEqual(sectionPlan.blockPlans, []);
  for (const ref of [
    "aspect.mars.venus.sextile",
    "aspect.mercury.moon.square",
    "aspect.mars.sun.sextile",
    "aspect.sun.venus.conjunction"
  ]) {
    assert.ok(sectionPlan.forbiddenEvidenceRefs.includes(ref), ref);
  }
});

test("fact réel sans règle reste calculé mais non interprété", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Saturn", "opposition")]);
  assert.ok(sectionPlan.forbiddenEvidenceRefs.includes("aspect.mercury.saturn.opposition"));
  assert.ok(!sectionPlan.allowedInterpretationRuleRefs.some((ruleId) => ruleId.includes("mercury_saturn")));
});

test("chaque thème produit possède un interpretationRuleRef", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine"), natalAspect("Mercury", "Venus", "conjunction")]);
  for (const packet of sectionPlan.evidencePackets) {
    for (const themeRef of packet.themeRefs) {
      assert.ok(themeRef.theme);
      assert.ok(themeRef.interpretationRuleRef);
      assert.ok(packet.interpretationRuleRefs.includes(themeRef.interpretationRuleRef));
    }
  }
});

test("maximum 2 aspects sont sélectionnés pour la prose", () => {
  const { sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine", 6.9),
    natalAspect("Mercury", "Venus", "conjunction", 5.5),
    natalAspect("Sun", "Mercury", "conjunction", 1)
  ]);
  assert.equal(sectionPlan.rules.selectedAspectRuleRefs.length, 2);
  assert.deepEqual(sectionPlan.rules.selectedAspectRuleRefs, [
    "western.natal.mercury_venus.conjunction@1",
    "western.natal.mercury_mars.trine@1"
  ]);
  assert.deepEqual(sectionPlan.rules.nonSelectedAspectRuleRefs, ["western.natal.sun_mercury.conjunction@1"]);
});

test("la fixture Communication relationnelle V1 retient uniquement les deux aspects attendus", () => {
  const { sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine", 6.9),
    natalAspect("Mercury", "Venus", "conjunction", 5.5),
    natalAspect("Sun", "Mercury", "conjunction", 1),
    natalSign("Sun", "Cancer"),
    natalSign("Venus", "Leo"),
    natalSign("Mars", "Scorpio"),
    natalSign("Jupiter", "Capricorn"),
    natalSign("Saturn", "Scorpio")
  ]);

  assert.deepEqual(sectionPlan.primaryEvidenceRefs, [
    "aspect.mercury.venus.conjunction",
    "aspect.mars.mercury.trine"
  ]);
  assert.deepEqual(sectionPlan.rules.selectedAspectRuleRefs, [
    "western.natal.mercury_venus.conjunction@1",
    "western.natal.mercury_mars.trine@1"
  ]);
  assert.deepEqual(sectionPlan.rules.nonSelectedAspectRuleRefs, ["western.natal.sun_mercury.conjunction@1"]);
  for (const ref of [
    "natal.mercury.sign",
    "natal.moon.sign",
    "natal.sun.sign",
    "natal.venus.sign",
    "natal.mars.sign",
    "natal.jupiter.sign",
    "natal.saturn.sign",
    "aspect.mercury.sun.conjunction"
  ]) {
    assert.ok(sectionPlan.forbiddenEvidenceRefs.includes(ref), ref);
  }
  assert.equal(sectionPlan.allowedInterpretationRuleRefs.includes("western.body.mercury.sign.cancer@1"), false);
});

test("les blocs reçoivent seulement leurs thèmes autorisés", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "square")]);
  assert.ok(packetThemes(sectionPlan, "western.natal.mercury_mars.square@1", "spontaneous_dynamic").includes("friction entre formulation et impulsion d'affirmation"));
  assert.ok(packetThemes(sectionPlan, "western.natal.mercury_mars.square@1", "resource").includes("énergie pour confronter les idées et clarifier un désaccord"));
  assert.ok(packetThemes(sectionPlan, "western.natal.mercury_mars.square@1", "attention_point").includes("sous tension, le rythme ou le ton de l'échange peut se durcir"));
});

test("chaque bloc ne reçoit que son themeType et chaque identité thème est unique", () => {
  const { sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  const identities = new Set();
  for (const row of themeMatrix(sectionPlan)) {
    assert.equal(row.themeType, row.blockId);
    const identity = `${row.interpretationRuleRef}:${row.themeType}:${row.themeIndex}`;
    assert.equal(identities.has(identity), false, identity);
    identities.add(identity);
  }
  assert.ok([...identities].some((identity) => identity.includes(":attention_point:")));
});

test("les références conservées par bloc correspondent uniquement aux packets du bloc", () => {
  const { sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  const packets = packetById(sectionPlan);
  for (const block of sectionPlan.blockPlans) {
    for (const packetRef of block.packetRefs) {
      const packet = packets.get(packetRef);
      assert.ok(packet, packetRef);
      assert.equal(packet.narrativeRole, block.narrativeRole);
      assert.equal(packet.evidenceRefs.includes("natal.mercury.sign"), false);
      assert.equal(packet.claims.some((claim) => claim.type === "NATAL_BODY_SIGN" && claim.body === "Mercury"), false);
    }
  }
});

test("un point d'attention absent reste absent", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Venus", "sextile")]);
  assert.equal(sectionPlan.rules.attentionPoint, "not_available");
  assert.ok(!sectionPlan.blockPlans.some((block) => block.blockId === "attention_point"));
});

test("attention_point existe uniquement avec des attentionThemes explicites", () => {
  const { sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  const attention = sectionPlan.blockPlans.find((block) => block.blockId === "attention_point");
  assert.ok(attention);
  const packets = packetById(sectionPlan);
  for (const packetRef of attention.packetRefs) {
    const packet = packets.get(packetRef);
    assert.ok(packet.themes.length > 0);
    for (const ruleId of packet.interpretationRuleRefs) {
      assert.ok((interpretationRuleById(ruleId).relationalCommunication.attentionThemes ?? []).length > 0);
    }
  }
});

test("maxSentences de Communication suit les plafonds éditoriaux non bloquants", () => {
  const { sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  for (const block of sectionPlan.blockPlans) {
    assert.equal(block.sentenceLimitMode, "warning");
  }
  assert.equal(blockPlan(sectionPlan, "spontaneous_dynamic").maxSentences, 2);
  assert.equal(blockPlan(sectionPlan, "resource").maxSentences, 3);
  assert.equal(blockPlan(sectionPlan, "attention_point").maxSentences, 2);
});

test("les plafonds Communication ne deviennent jamais une longueur minimale", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  assert.equal(blockPlan(sectionPlan, "spontaneous_dynamic").maxSentences, 2);
  assert.equal(blockPlan(sectionPlan, "resource").maxSentences, 3);
  assert.equal(blockPlan(sectionPlan, "attention_point").maxSentences, 2);
});

test("un bloc respectant la limite de phrases est accepté", () => {
  const { dossierEvidence, sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  const section = sectionWithText(sectionPlan, {
    spontaneous_dynamic: "La parole cherche une harmonie relationnelle. L'idée circule vers la prise de position.",
    resource: "Le ton et le tact rendent le message plus recevable. Une idée peut devenir un échange concret.",
    attention_point: "Un désaccord peut être adouci par une formulation agréable. Le rythme peut dépasser celui de l'interlocuteur."
  });
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test("une troisième phrase resource Communication reste acceptée sans warning de longueur", () => {
  const { dossierEvidence, sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  const section = sectionWithText(sectionPlan, {
    resource: "Le ton et le tact rendent le message plus recevable. Une idée peut devenir un échange concret. Le rythme de parole peut aider à clarifier le désaccord."
  });
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.warnings.some((warning) => warning.code === "block_sentence_limit_exceeded"), false);
});

test("un dépassement de phrases Communication est un warning non bloquant", () => {
  const { dossierEvidence, sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  const section = sectionWithText(sectionPlan, {
    resource: "Le ton et le tact rendent le message plus recevable. Une idée peut devenir un échange concret. Le rythme de parole peut aider à clarifier le désaccord. Cette phrase reste un dépassement éditorial."
  });
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true);
  assert.equal(result.issues.some((issue) => issue.code === "block_sentence_limit_exceeded"), false);
  const warning = result.warnings.find((entry) => entry.code === "block_sentence_limit_exceeded" && entry.blockId === "resource");
  assert.ok(warning);
  assert.equal(warning.sentenceCount, 4);
  assert.equal(warning.maxSentences, 3);
});

test("un dépassement dans les autres blocs Communication reste un warning", () => {
  const { dossierEvidence, sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  const section = sectionWithText(sectionPlan, {
    spontaneous_dynamic: "La parole cherche une harmonie relationnelle. L'idée circule vers la prise de position. Cette phrase dépasse la cible.",
    attention_point: "Un désaccord peut être adouci par une formulation agréable. Le rythme peut dépasser celui de l'interlocuteur. Cette phrase dépasse la cible."
  });
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true);
  assert.equal(result.issues.some((issue) => issue.code === "block_sentence_limit_exceeded"), false);
  assert.equal(result.warnings.filter((warning) => warning.code === "block_sentence_limit_exceeded").length, 2);
  assert.ok(result.warnings.some((warning) => warning.blockId === "spontaneous_dynamic" && warning.sentenceCount === 3 && warning.maxSentences === 2));
  assert.ok(result.warnings.some((warning) => warning.blockId === "attention_point" && warning.sentenceCount === 3 && warning.maxSentences === 2));
});

test("les vraies erreurs bloquantes Communication restent bloquantes", () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  const section = sectionWithText(sectionPlan, { resource: "" });
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "missing_block_text"));
});

test("le planner est testable sans LLM et utilise la provenance canonique", () => {
  const { plan, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "conjunction")]);
  assert.equal(plan.product.publicName, "Moi en relation");
  assert.equal(sectionPlan.lastroInterpretiveMapping.nature, "LASTRO_RULE");
  assert.equal(sectionPlan.lastroInterpretiveMapping.subtype, "RELATIONAL_INTERPRETATION");
  assert.equal(INTERPRETATION_LIBRARY_VERSION, "lastro-interpretation-library@0.2.0");
});

test("npm test ne déclenche pas le LLM réel si seule la clé locale est présente", async () => {
  await withEnv(
    {
      ASTROLAB_LLM_API_KEY: "cle-de-test",
      ASTROLAB_LLM_BASE_URL: undefined,
      ASTROLAB_LLM_MODEL: undefined,
      ASTROLAB_RUN_LLM_TESTS: undefined
    },
    async () => {
      assert.equal(llmConfiguration(), null);
      let calls = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        calls += 1;
        throw new Error("fetch should not be called");
      };
      try {
        const written = await writeSection({ title: "Test", directives: [] }, {});
        assert.equal(written.provider, "template");
        assert.equal(calls, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});

test("l'opt-in explicite est requis pour exposer une vraie configuration LLM en test", async () => {
  await withEnv(
    {
      ASTROLAB_LLM_API_KEY: "cle-de-test",
      ASTROLAB_LLM_BASE_URL: undefined,
      ASTROLAB_RUN_LLM_TESTS: undefined
    },
    async () => {
      assert.equal(llmConfiguration(), null);
    }
  );
  await withEnv(
    {
      ASTROLAB_LLM_API_KEY: "cle-de-test",
      ASTROLAB_LLM_BASE_URL: undefined,
      ASTROLAB_LLM_MODEL: undefined,
      ASTROLAB_RUN_LLM_TESTS: "1"
    },
    async () => {
      assert.equal(llmConfiguration()?.model, "gpt-4o-mini");
    }
  );
});

test("Communication relationnelle utilise gpt-4.1-mini sans changer les autres sections", async () => {
  await withEnv(
    {
      ASTROLAB_LLM_API_KEY: "cle-de-test",
      ASTROLAB_LLM_BASE_URL: undefined,
      ASTROLAB_LLM_MODEL: undefined,
      ASTROLAB_RUN_LLM_TESTS: "1"
    },
    async () => {
      const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "square")]);
      assert.equal(llmConfiguration()?.model, "gpt-4o-mini");
      assert.equal(structuredSectionLlmConfiguration(sectionPlan)?.model, "gpt-4.1-mini");
      assert.equal(structuredSectionLlmConfiguration({ sectionId: "identity" })?.model, "gpt-4o-mini");
    }
  );
});

test("le writer reçoit les consignes anti-jargon et anti-élargissement sémantique", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine"), natalAspect("Mercury", "Venus", "conjunction")]);
  const guidance = sectionPlan.writerGuidance.join("\n");
  assert.match(guidance, /évite conjonction, trigone, sextile, carré, opposition/i);
  assert.match(guidance, /élargissement du sens interdit/i);
  assert.match(guidance, /échange concret ne devient pas transformer les idées en actions concrètes/i);
  assert.match(guidance, /adoucir un désaccord ne devient pas atténuer les conflits/i);
});

test("les consignes de resserrement Affection ne modifient pas Communication relationnelle", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine"), natalAspect("Mercury", "Venus", "conjunction")]);
  const guidance = sectionPlan.writerGuidance.join("\n");

  assert.doesNotMatch(guidance, /Reformule le thème transmis de façon proche et concise/);
  assert.doesNotMatch(guidance, /Ne pas ajouter d'intention ou de motivation/);
  assert.doesNotMatch(guidance, /Ne pas ajouter de qualité morale ou psychologique/);
  assert.doesNotMatch(guidance, /Ne pas ajouter d'adverbe qui intensifie une capacité/);
  assert.doesNotMatch(guidance, /Ne transforme pas plusieurs formes d'expression en alternance/);
  assert.doesNotMatch(guidance, /Ne commence pas les blocs resource ou attention_point par : Vous manifestez votre affection/);
});

test("Mercury sign est retiré de Communication relationnelle V1 quand des règles aspectuelles existent", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine"), natalAspect("Mercury", "Venus", "conjunction")]);
  const mercuryPackets = sectionPlan.evidencePackets.filter((packet) => packet.evidenceRefs.includes("natal.mercury.sign"));
  const aspectPackets = sectionPlan.evidencePackets.filter((packet) => packet.evidenceRefs.some((ref) => ref.startsWith("aspect.")));
  assert.equal(mercuryPackets.length, 0);
  assert.ok(aspectPackets.length > 0);
  assert.equal(sectionPlan.primaryEvidenceRefs.includes("natal.mercury.sign"), false);
  assert.equal(sectionPlan.allowedInterpretationRuleRefs.some((ruleId) => ruleId.startsWith("western.body.mercury.sign.")), false);
});

test("les aspects sont les seuls faits transmis dans le plan et le bloc spontané", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine"), natalAspect("Mercury", "Venus", "conjunction")]);
  assert.deepEqual(sectionPlan.primaryEvidenceRefs, [
    "aspect.mars.mercury.trine",
    "aspect.mercury.venus.conjunction"
  ]);
  assert.equal(sectionPlan.evidencePackets.some((packet) => packet.evidenceRefs.includes("natal.mercury.sign")), false);
  const spontaneous = sectionPlan.blockPlans.find((block) => block.blockId === "spontaneous_dynamic");
  assert.deepEqual(spontaneous.packetRefs, [
    "relational_communication.aspect_mars_mercury_trine.spontaneous_dynamic",
    "relational_communication.aspect_mercury_venus_conjunction.spontaneous_dynamic"
  ]);
});

test("le prompt demande l'isolation des thèmes et la concision", () => {
  const { sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  const prompt = buildStructuredSystemPrompt(sectionPlan);
  assert.match(prompt, /Reformule uniquement les thèmes transmis au bloc courant/i);
  assert.match(prompt, /Aucune longueur minimale/i);
  assert.match(prompt, /Pour resource, vise habituellement deux phrases/i);
  assert.match(prompt, /une troisième phrase est permise seulement/i);
  assert.match(prompt, /jamais une phrase uniquement pour remplir/i);
  assert.match(prompt, /ni introduction générale, ni transition, ni synthèse, ni conclusion/i);
  assert.match(prompt, /Ne reprends pas dans un bloc un thème réservé à un autre bloc/i);
  assert.match(prompt, /Il est important de, Il est essentiel de, Il est nécessaire de/i);
  assert.match(prompt, /Formule le point d'attention directement/i);
  assert.doesNotMatch(prompt, /Mercury sign est un contexte secondaire/i);
});

test("le writer reçoit seulement les packets du bloc courant sans Mercury sign", async () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  const seen = [];
  await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: ({ sectionPlan: scopedPlan }) => {
        seen.push(scopedPlan.evidencePackets.map((packet) => ({
          evidenceRefs: packet.evidenceRefs,
          sourceRole: packet.sourceRole,
          maxSentences: packet.maxSentences,
          openingAllowed: packet.openingAllowed
        })));
        return {
          sectionId: scopedPlan.sectionId,
          contractVersion: "structured-section-writer@0.1.0",
          blocks: scopedPlan.blockPlans.map((blockPlan) => ({
            blockId: blockPlan.blockId,
            text: "Dans la relation, la formulation reste ancrée dans les thèmes autorisés par le serveur."
          }))
        };
      }
    }
  });
  const spontaneousPackets = seen[0];
  assert.equal(spontaneousPackets.some((packet) => packet.evidenceRefs.includes("natal.mercury.sign")), false);
  assert.ok(spontaneousPackets.every((packet) => packet.sourceRole === "primary_interpretation"));
  assert.deepEqual(sectionPlan.primaryEvidenceRefs, ["aspect.mars.mercury.trine"]);
  assert.equal(sectionPlan.allowedInterpretationRuleRefs.includes("western.body.mercury.sign.cancer@1"), false);
  assert.ok(sectionPlan.allowedInterpretationRuleRefs.includes("western.natal.mercury_mars.trine@1"));
});

test("aucune modification de doctrine V1 n'a été introduite", () => {
  const expectedRules = [
    "western.natal.mercury_mars.conjunction@1",
    "western.natal.mercury_mars.trine@1",
    "western.natal.mercury_mars.sextile@1",
    "western.natal.mercury_mars.square@1",
    "western.natal.mercury_mars.opposition@1",
    "western.natal.mercury_venus.conjunction@1",
    "western.natal.mercury_venus.sextile@1",
    "western.natal.sun_mercury.conjunction@1"
  ];
  for (const ruleId of expectedRules) {
    assert.ok(interpretationRuleById(ruleId), ruleId);
  }
  assert.equal(interpretationRuleById("western.natal.mercury_venus.trine@1"), null);
  assert.equal(interpretationRuleById("western.natal.sun_mercury.trine@1"), null);
});

test("structured writer can render the one-axis prototype without LLM", async () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: ({ sectionPlan: scopedPlan }) => ({
        sectionId: scopedPlan.sectionId,
        contractVersion: "structured-section-writer@0.1.0",
        blocks: scopedPlan.blockPlans.map((blockPlan) => ({
          blockId: blockPlan.blockId,
          text: "Dans la relation, cette partie reste volontairement limitée aux thèmes transmis par le serveur."
        }))
      })
    }
  });

  assert.equal(written.llmCalls, 0);
  assert.equal(written.validation.ok, true);

  const renderedSection = relationalCommunicationSectionForRender(written.section);
  const html = renderDossierHtml({
    title: "Moi en relation",
    personLabel: "Fixture",
    createdAt: "2026-10-07T00:00:00.000Z",
    writerMode: "template",
    sections: [renderedSection]
  });
  const markdown = renderDossierMarkdown({
    title: "Moi en relation",
    personLabel: "Fixture",
    createdAt: "2026-10-07T00:00:00.000Z",
    sections: [renderedSection]
  });

  assert.match(html, /Moi en relation/);
  assert.match(html, /Communication relationnelle/);
  assert.match(markdown, /## Communication relationnelle/);
});

test("un warning de longueur Communication ne déclenche aucun retry", async () => {
  const { dossierEvidence, sectionPlan } = planFor([
    natalAspect("Mercury", "Mars", "trine"),
    natalAspect("Mercury", "Venus", "conjunction")
  ]);
  const callsByBlock = new Map();
  const logs = [];
  const textByBlock = {
    spontaneous_dynamic: "La parole cherche une harmonie relationnelle. L'idée circule vers la prise de position.",
    resource: "Le ton et le tact rendent le message plus recevable. Une idée peut devenir un échange concret. Le rythme de parole peut aider à clarifier le désaccord. Cette phrase reste un dépassement éditorial.",
    attention_point: "Un désaccord peut être adouci par une formulation agréable. Le rythme peut dépasser celui de l'interlocuteur."
  };
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      logger: { warn: (message, payload) => logs.push({ message, payload }) },
      structuredWriterFn: ({ sectionPlan: scopedPlan }) => {
        const blockId = scopedPlan.blockPlans[0].blockId;
        callsByBlock.set(blockId, (callsByBlock.get(blockId) ?? 0) + 1);
        return {
          sectionId: scopedPlan.sectionId,
          contractVersion: "structured-section-writer@0.1.0",
          blocks: [{ blockId, text: textByBlock[blockId] }]
        };
      }
    }
  });

  assert.equal(written.validation.ok, true);
  assert.equal(written.validation.issues.length, 0);
  assert.equal(callsByBlock.get("resource"), 1);
  const warning = written.validation.warnings.find((entry) => entry.code === "block_sentence_limit_exceeded" && entry.blockId === "resource");
  assert.ok(warning);
  assert.equal(warning.sentenceCount, 4);
  assert.equal(warning.maxSentences, 3);
  assert.ok(logs.some((entry) =>
    entry.message.includes("validation warning") &&
    entry.payload.sectionId === "relational_communication" &&
    entry.payload.blockId === "resource" &&
    entry.payload.sentenceCount === 4 &&
    entry.payload.maxSentences === 3
  ));
});

test("la sortie brute sans références est enrichie depuis les packets déterministes", async () => {
  const { dossierEvidence, sectionPlan } = contrastFixturePlan();
  const textByBlock = {
    spontaneous_dynamic: "Vous disposez d'une facilité pour ajuster votre manière de dire en fonction du contexte relationnel. Cependant, une friction peut exister entre la formulation de vos idées et votre impulsion à vous affirmer.",
    resource: "Vous faites preuve de diplomatie et cherchez à formuler vos propos de manière à être acceptable pour l'autre. Vous mobilisez aussi une énergie certaine pour confronter les idées et clarifier un désaccord.",
    attention_point: "Sous tension, le rythme ou le ton de l'échange peut se durcir."
  };
  const rawBlocks = [];
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: ({ sectionPlan: scopedPlan }) => {
        const blockId = scopedPlan.blockPlans[0].blockId;
        const block = { blockId, text: textByBlock[blockId] };
        rawBlocks.push(block);
        return {
          sectionId: scopedPlan.sectionId,
          contractVersion: "structured-section-writer@0.1.0",
          blocks: [block]
        };
      }
    }
  });

  assert.ok(rawBlocks.every((block) =>
    !("claims" in block) &&
    !("evidenceRefs" in block) &&
    !("interpretationRuleRefs" in block)
  ));
  assert.equal(written.validation.ok, true);
  for (const block of written.section.blocks) {
    assert.ok(block.claims.length > 0);
    assert.ok(block.evidenceRefs.length > 0);
    assert.ok(block.interpretationRuleRefs.length > 0);
    assert.equal(block.evidenceRefs.includes("natal.mercury.sign"), false);
    assert.equal(block.claims.some((claim) => claim.type === "NATAL_BODY_SIGN" && claim.body === "Mercury"), false);
  }
  assert.deepEqual([...new Set(written.section.blocks.flatMap((block) => block.evidenceRefs))], [
    "aspect.mercury.venus.sextile",
    "aspect.mercury.mars.square"
  ]);
  assert.deepEqual([...new Set(written.section.blocks.flatMap((block) => block.interpretationRuleRefs))], [
    "western.natal.mercury_venus.sextile@1",
    "western.natal.mercury_mars.square@1"
  ]);
  assert.deepEqual([...new Set(written.section.blocks.flatMap((block) => block.claims.map((claim) => claim.type)))], ["NATAL_ASPECT"]);
});

test("expandStructuredSectionFromPackets expose l'objet persistable sans inventer de références", () => {
  const { sectionPlan } = contrastFixturePlan();
  const rawSection = {
    sectionId: sectionPlan.sectionId,
    contractVersion: "structured-section-writer@0.1.0",
    blocks: sectionPlan.blockPlans.map((block) => ({
      blockId: block.blockId,
      text: "Texte validé limité au bloc courant."
    }))
  };
  const { section, issues } = expandStructuredSectionFromPackets({ section: rawSection, sectionPlan });

  assert.deepEqual(issues, []);
  assert.deepEqual([...new Set(section.blocks.flatMap((block) => block.evidenceRefs))], [
    "aspect.mercury.venus.sextile",
    "aspect.mercury.mars.square"
  ]);
  assert.deepEqual([...new Set(section.blocks.flatMap((block) => block.interpretationRuleRefs))], [
    "western.natal.mercury_venus.sextile@1",
    "western.natal.mercury_mars.square@1"
  ]);
  assert.equal(section.blocks.flatMap((block) => block.claims).length, 5);
  assert.equal(section.blocks.some((block) => block.evidenceRefs.includes("natal.mercury.sign")), false);
});

test("le renderer relationnel masque les métadonnées sans modifier la section source", async () => {
  const { dossierEvidence, sectionPlan } = contrastFixturePlan();
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: ({ sectionPlan: scopedPlan }) => ({
        sectionId: scopedPlan.sectionId,
        contractVersion: "structured-section-writer@0.1.0",
        blocks: scopedPlan.blockPlans.map((blockPlan) => ({
          blockId: blockPlan.blockId,
          text: "Texte validé limité au bloc courant."
        }))
      })
    }
  });
  const before = JSON.stringify(written.section);
  const rendered = relationalCommunicationSectionForRender(written.section);
  const after = JSON.stringify(written.section);

  assert.equal(before, after);
  assert.equal("claims" in rendered, false);
  assert.equal("evidenceRefs" in rendered, false);
  assert.equal("interpretationRuleRefs" in rendered, false);
  assert.ok(written.section.blocks.every((block) => block.claims.length > 0));
});

test("les amorces scolaires produisent des avertissements non bloquants", () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  const section = {
    sectionId: sectionPlan.sectionId,
    contractVersion: "structured-section-writer@0.1.0",
    blocks: sectionPlan.blockPlans.map((blockPlan) => ({
      blockId: blockPlan.blockId,
      text: "Il est important de rester attentif à la manière dont le message arrive dans la relation."
    }))
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
  assert.ok(result.warnings.some((warning) => warning.code === "style_school_or_injunctive_opener"));
});

test("les absolus et le vocabulaire natal générique produisent des avertissements non bloquants", () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  const section = {
    sectionId: sectionPlan.sectionId,
    contractVersion: "structured-section-writer@0.1.0",
    blocks: sectionPlan.blockPlans.map((blockPlan) => ({
      blockId: blockPlan.blockId,
      text: "La recherche d'harmonie est essentielle et revient toujours avec des souvenirs affectifs dans un climat intime."
    }))
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
  assert.ok(result.warnings.some((warning) => warning.code === "style_absolute_wording"));
  assert.ok(result.warnings.some((warning) => warning.code === "style_generic_natal_wording"));
});

test("pas toujours et ne pas toujours ne déclenchent pas l'avertissement d'absolu", () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  const section = {
    sectionId: sectionPlan.sectionId,
    contractVersion: "structured-section-writer@0.1.0",
    blocks: sectionPlan.blockPlans.map((blockPlan) => ({
      blockId: blockPlan.blockId,
      text: "Le rythme relationnel n'est pas toujours le même chez l'autre, et le désaccord ne se formule pas toujours immédiatement."
    }))
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
  assert.ok(!result.warnings.some((warning) => warning.phrase === "toujours"));
});

test("un avertissement stylistique ne déclenche aucun retry", async () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  let calls = 0;
  const written = await writeStructuredSectionWithLlm({
    dossierEvidence,
    sectionPlan,
    options: {
      structuredWriterFn: ({ sectionPlan: scopedPlan }) => {
        calls += 1;
        return {
          sectionId: scopedPlan.sectionId,
          contractVersion: "structured-section-writer@0.1.0",
          blocks: scopedPlan.blockPlans.map((blockPlan) => ({
            blockId: blockPlan.blockId,
            text: "Il est important de rester attentif au ton relationnel."
          }))
        };
      }
    }
  });
  assert.equal(calls, sectionPlan.blockPlans.length);
  assert.equal(written.validation.ok, true);
  assert.equal(written.validation.issues.length, 0);
  assert.ok(written.validation.warnings.some((warning) => warning.code === "style_school_or_injunctive_opener"));
});

test("real but non-whitelisted facts are rejected by the existing structured validator", () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  const section = {
    sectionId: sectionPlan.sectionId,
    contractVersion: "structured-section-writer@0.1.0",
    blocks: sectionPlan.blockPlans.map((blockPlan) => ({
      blockId: blockPlan.blockId,
      text: "Vénus en Lion devient ici le centre de l'analyse relationnelle."
    }))
  };

  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});

test("les erreurs structurelles et de traçabilité restent bloquantes", () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Mercury", "Mars", "trine")]);
  const unknownBlock = validateStructuredSection({
    dossierEvidence,
    sectionPlan,
    section: {
      sectionId: sectionPlan.sectionId,
      contractVersion: "structured-section-writer@0.1.0",
      blocks: [{ blockId: "bloc_invente", text: "Texte." }]
    }
  });
  assert.equal(unknownBlock.ok, false);
  assert.ok(unknownBlock.issues.some((issue) => issue.code === "unknown_block_id"));

  const noRulesPlan = { ...sectionPlan, allowedInterpretationRuleRefs: [] };
  const missingRuleTrace = validateStructuredSection({
    dossierEvidence,
    sectionPlan: noRulesPlan,
    section: {
      sectionId: sectionPlan.sectionId,
      contractVersion: "structured-section-writer@0.1.0",
      blocks: sectionPlan.blockPlans.map((blockPlan) => ({ blockId: blockPlan.blockId, text: "Texte." }))
    }
  });
  assert.equal(missingRuleTrace.ok, false);
  assert.ok(missingRuleTrace.issues.some((issue) => issue.code === "interpretation_rule_not_allowed"));
});
