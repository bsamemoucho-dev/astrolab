import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { uncertainIntervalAnalysis } from "../src/astro/signWindows.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildIndividualRelationalAffectionPlan, relationalAffectionSectionForRender } from "../src/deliverables/individualRelationalPlan.mjs";
import { allInterpretationRuleIds, interpretationRuleById, rulesForEvidence } from "../src/deliverables/interpretationRules.mjs";
import { renderDossierHtml, renderDossierMarkdown } from "../src/deliverables/render.mjs";
import { writeStructuredSectionWithLlm } from "../src/deliverables/structuredSectionWriter.mjs";
import { validateStructuredSection } from "../src/deliverables/factualClaimsValidator.mjs";

function stableCertainty(extra = {}) {
  return { stableAcrossApplicableWindow: true, timePrecision: "exact", basis: "test", ...extra };
}

function unstableCertainty(extra = {}) {
  return { stableAcrossApplicableWindow: false, timePrecision: "unknown", basis: "test", ...extra };
}

function natalSign(body, sign, certainty = stableCertainty()) {
  return {
    evidenceId: `natal.${body.toLowerCase()}.sign`,
    type: "NATAL_BODY_SIGN",
    value: { body, sign, degreeInSign: 10, longitude: 10 },
    certainty,
    provenance: { reliability: "HIGH", methodVersion: "test", ruleVersion: null }
  };
}

function natalAspect(bodyA, bodyB, aspectType, orb = 1, orbLimit = 8, certainty = stableCertainty()) {
  const ordered = [bodyA, bodyB].sort((left, right) => left.localeCompare(right));
  return {
    evidenceId: `aspect.${ordered[0].toLowerCase()}.${ordered[1].toLowerCase()}.${aspectType}`,
    type: "NATAL_ASPECT",
    value: { bodyA, bodyB, aspectType, orb, orbLimit, exactness: orb, ruleVersion: "lastro-aspects@1.0.0" },
    certainty: {
      ...certainty,
      normalizedExactness: Math.abs(orb) / orbLimit
    },
    provenance: { reliability: "HIGH", methodVersion: "western-natal@test", ruleVersion: "lastro-aspects@1.0.0" }
  };
}

function dossier(items = []) {
  return {
    schema: "astrolab.dossier_evidence",
    version: "test",
    evidence: [natalSign("Venus", "Aries"), ...items]
  };
}

function planFor(items = []) {
  const dossierEvidence = dossier(items);
  const plan = buildIndividualRelationalAffectionPlan(dossierEvidence);
  return { dossierEvidence, plan, sectionPlan: plan.sections[0] };
}

function selectedRules(sectionPlan) {
  return sectionPlan.rules.selectedRuleRefs;
}

function packetThemes(sectionPlan, ruleId, role = null) {
  return sectionPlan.evidencePackets
    .filter((packet) => packet.interpretationRuleRefs.includes(ruleId) && (!role || packet.narrativeRole === role))
    .flatMap((packet) => packet.themes);
}

const GENERIC_RUNTIME_FORBIDDEN = new Set([
  "diagnostic psychologique",
  "événement biographique inventé",
  "prédiction",
  "fatalisme",
  "certitude sur un tiers"
]);

function normalizeDoctrineText(value) {
  return String(value ?? "").normalize("NFC").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
}

function doctrineBlockForRule(markdown, ruleId) {
  const escapedRuleId = ruleId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.match(new RegExp(`### \`${escapedRuleId}\`[\\s\\S]*?\`\`\`text\\n([\\s\\S]*?)\\n\`\`\``))?.[1] ?? "";
}

function doctrineField(block, label) {
  const lines = block.split("\n");
  const start = lines.findIndex((line) => line.trim() === `${label}:`);
  if (start < 0) return null;
  const valueLines = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (/^\S.*:$/.test(raw)) break;
    if (line.startsWith("- ")) break;
    if (line) valueLines.push(line);
  }
  return normalizeDoctrineText(valueLines.join(" "));
}

function doctrineForbiddenItems(block) {
  const lines = block.split("\n");
  const start = lines.findIndex((line) => line.trim() === "ne permet pas d'affirmer:");
  if (start < 0) return [];
  const items = [];
  let text = null;
  let note = null;
  const pushCurrent = () => {
    if (!text) return;
    items.push({
      text: normalizeDoctrineText(text),
      note: note ? normalizeDoctrineText(note.replace(/^\(/, "").replace(/\)$/, "")) : null
    });
  };
  for (let index = start + 1; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) continue;
    if (/^```/.test(line) || /^### /.test(line) || /^\S.*:$/.test(raw)) break;
    if (line.startsWith("- ")) {
      pushCurrent();
      text = line.slice(2);
      note = null;
      continue;
    }
    if (note || /^(relève|relèverait)/.test(line.replace(/^\(/, ""))) {
      note = `${note ? `${note} ` : ""}${line}`;
    } else {
      text = `${text} ${line}`;
    }
  }
  pushCurrent();
  return items;
}

function sortedJson(value) {
  return JSON.stringify([...value].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))));
}

test("Affection V1 expose exactement ses 28 règles relationnelles", () => {
  const ids = allInterpretationRuleIds().filter((ruleId) => ruleId.startsWith("western.relational.affection."));
  assert.equal(ids.length, 28);
  assert.equal(new Set(ids).size, 28);
  assert.equal(ids.filter((ruleId) => ruleId.includes("venus.sign.")).length, 12);
  assert.equal(ids.filter((ruleId) => ruleId.includes("moon_venus.")).length, 5);
  assert.equal(ids.filter((ruleId) => ruleId.includes("sun_venus.")).length, 1);
  assert.equal(ids.filter((ruleId) => ruleId.includes("venus_jupiter.")).length, 5);
  assert.equal(ids.filter((ruleId) => ruleId.includes("venus_saturn.")).length, 5);
  assert.equal(interpretationRuleById("western.relational.affection.mercury_venus.conjunction@1"), null);
  assert.equal(interpretationRuleById("western.relational.affection.venus_mars.conjunction@1"), null);
  assert.equal(interpretationRuleById("western.relational.affection.sun_venus.trine@1"), null);
});

test("la doctrine Affection V1 Markdown reste en parité avec le registre runtime", () => {
  const markdown = fs.readFileSync(new URL("../docs/doctrine/affection-v1.md", import.meta.url), "utf8");
  const ids = allInterpretationRuleIds().filter((ruleId) => ruleId.startsWith("western.relational.affection."));
  assert.equal(ids.length, 28);

  for (const ruleId of ids) {
    const rule = interpretationRuleById(ruleId);
    const block = doctrineBlockForRule(markdown, ruleId);
    assert.notEqual(block, "", `règle absente du Markdown: ${ruleId}`);
    assert.equal(rule.provenance, "LASTRO_RULE", ruleId);
    assert.equal(block.match(/^ID: (.+)$/m)?.[1], ruleId);
    assert.equal(doctrineField(block, "sens central"), normalizeDoctrineText(rule.relationalAffection.centralTheme), ruleId);
    assert.equal(doctrineField(block, "dynamique spontanée"), normalizeDoctrineText(rule.relationalAffection.spontaneousThemes[0]), ruleId);
    assert.equal(doctrineField(block, "ressource"), normalizeDoctrineText(rule.relationalAffection.resourceThemes[0]), ruleId);
    assert.equal(doctrineField(block, "point d'attention"), normalizeDoctrineText(rule.relationalAffection.attentionThemes[0] ?? "absent en V1"), ruleId);

    const doctrineForbidden = doctrineForbiddenItems(block);
    const runtimeForbidden = rule.forbidden
      .filter((item) => !GENERIC_RUNTIME_FORBIDDEN.has(item))
      .map(normalizeDoctrineText);
    assert.equal(sortedJson(doctrineForbidden.map((item) => item.text)), sortedJson(runtimeForbidden), ruleId);

    const expectedNotes = doctrineForbidden
      .filter((item) => item.note)
      .map((item) => [item.text, item.note]);
    const runtimeNotes = new Map((rule.forbiddenScopeNotes ?? []).map((item) => [
      normalizeDoctrineText(item.forbidden),
      normalizeDoctrineText(item.note)
    ]));
    const actualNotes = [...runtimeNotes.entries()].filter(([text]) =>
      doctrineForbidden.some((item) => item.text === text)
    );
    assert.equal(sortedJson(expectedNotes), sortedJson(actualNotes), ruleId);
  }
});

test("les règles Affection utilisent la provenance et les champs relationnels canoniques", () => {
  const rule = interpretationRuleById("western.relational.affection.moon_venus.square@1");
  assert.equal(rule.provenance, "LASTRO_RULE");
  assert.equal(rule.subtype, "RELATIONAL_INTERPRETATION");
  assert.equal(rule.relationalAffection.axisId, "affection");
  assert.deepEqual(rule.relationalAffection.spontaneousThemes, [
    "le soin concret et la tendresse explicite occupent tous deux une place dans la manière de manifester son affection"
  ]);
  assert.deepEqual(rule.relationalAffection.resourceThemes, [
    "capacité à réunir une attention concrète et une marque de tendresse explicite dans une même manifestation"
  ]);
  assert.deepEqual(rule.relationalAffection.attentionThemes, [
    "le soin que la personne apporte peut parfois tenir lieu d'expression affective, sans qu'une marque de tendresse distincte soit exprimée au même moment"
  ]);
  assert.ok(rule.forbidden.includes("besoin d'être rassuré ou protégé"));
  assert.ok(rule.forbidden.includes("absence d'affection ou de tendresse"));
});

test("Moon-Venus square distingue tension et attention sans alternance doctrinale", () => {
  const rule = interpretationRuleById("western.relational.affection.moon_venus.square@1");
  const spontaneous = rule.relationalAffection.spontaneousThemes[0];
  const resource = rule.relationalAffection.resourceThemes[0];

  assert.equal(spontaneous, "le soin concret et la tendresse explicite occupent tous deux une place dans la manière de manifester son affection");
  assert.equal(resource, "capacité à réunir une attention concrète et une marque de tendresse explicite dans une même manifestation");
  assert.equal(rule.relationalAffection.attentionThemes[0], "le soin que la personne apporte peut parfois tenir lieu d'expression affective, sans qu'une marque de tendresse distincte soit exprimée au même moment");
  assert.doesNotMatch(spontaneous, /altern|selon le moment|l'un des deux|l’autre|moments différents/i);
  assert.doesNotMatch(resource, /altern|selon le moment|l'un des deux|l’autre|moments différents/i);
});

test("Venus Aquarius fallback reste centré sur les attentions personnalisées sans attentionTheme", () => {
  const rule = interpretationRuleById("western.relational.affection.venus.sign.aquarius@1");

  assert.equal(rule.relationalAffection.spontaneousThemes[0], "manifester son affection par des attentions personnalisées, inspirées par les goûts, les intérêts ou les particularités de l'autre");
  assert.equal(rule.relationalAffection.resourceThemes[0], "capacité à donner à son affection une forme personnelle, même lorsqu'elle ne suit pas les codes habituels");
  assert.deepEqual(rule.relationalAffection.attentionThemes, []);
});

test("les consignes de resserrement du writer sont limitées à Affection", () => {
  const { sectionPlan: affectionSectionPlan } = planFor([natalAspect("Moon", "Venus", "square")]);
  const affectionGuidance = affectionSectionPlan.writerGuidance.join("\n");

  assert.match(affectionGuidance, /Reformule le thème transmis de façon proche et concise/);
  assert.match(affectionGuidance, /Ne pas ajouter d'intention ou de motivation/);
  assert.match(affectionGuidance, /Ne pas ajouter de qualité morale ou psychologique/);
  assert.match(affectionGuidance, /Ne pas ajouter d'adverbe qui intensifie une capacité/);
  assert.match(affectionGuidance, /Arrête la phrase dès que le thème transmis est reformulé/);
  assert.match(affectionGuidance, /Ne transforme pas plusieurs formes d'expression en alternance/);
  assert.match(affectionGuidance, /Dans le bloc resource, exprime uniquement la ressource transmise/);
  assert.match(affectionGuidance, /Ne commence pas les blocs resource ou attention_point par : Vous manifestez votre affection/);
  assert.match(affectionGuidance, /Ne commence pas les blocs resource ou attention_point par : Vous exprimez votre affection/);
});

test("le fallback Venus sign est utilisé uniquement sans aspect certain", () => {
  const { sectionPlan } = planFor([]);
  assert.deepEqual(selectedRules(sectionPlan), ["western.relational.affection.venus.sign.aries@1"]);
  assert.deepEqual(sectionPlan.primaryEvidenceRefs, ["natal.venus.sign"]);
  assert.equal(sectionPlan.rules.fallbackRuleRef, "western.relational.affection.venus.sign.aries@1");
  assert.equal(packetThemes(sectionPlan, "western.relational.affection.venus.sign.aries@1", "spontaneous_dynamic")[0], "manifester son affection rapidement et ouvertement, par un geste concret ou un élan visible");
  assert.equal(sectionPlan.blockPlans.some((block) => block.blockId === "attention_point"), false);
});

test("un aspect Affection certain empêche le fallback Venus sign", () => {
  const { sectionPlan } = planFor([natalAspect("Moon", "Venus", "trine", 1)]);
  assert.deepEqual(selectedRules(sectionPlan), ["western.relational.affection.moon_venus.trine@1"]);
  assert.equal(sectionPlan.primaryEvidenceRefs.includes("natal.venus.sign"), false);
  assert.equal(sectionPlan.rules.fallbackRuleRef, null);
  assert.ok(sectionPlan.forbiddenEvidenceRefs.includes("natal.venus.sign"));
});

test("la sélection retient au maximum deux aspects par exactitude normalisée", () => {
  const { sectionPlan } = planFor([
    natalAspect("Moon", "Venus", "trine", 4, 10),
    natalAspect("Venus", "Saturn", "square", 2, 4),
    natalAspect("Venus", "Jupiter", "opposition", 3, 6)
  ]);
  assert.deepEqual(sectionPlan.rules.selectedAspectRuleRefs, [
    "western.relational.affection.moon_venus.trine@1",
    "western.relational.affection.venus_saturn.square@1"
  ]);
  assert.deepEqual(sectionPlan.rules.nonSelectedAspectRuleRefs, [
    "western.relational.affection.venus_jupiter.opposition@1"
  ]);
});

test("l'égalité de sélection est déterministe par orb puis ruleRef", () => {
  const { sectionPlan } = planFor([
    natalAspect("Venus", "Saturn", "trine", 2, 4),
    natalAspect("Venus", "Jupiter", "trine", 2, 4),
    natalAspect("Sun", "Venus", "conjunction", 2, 4)
  ]);
  assert.deepEqual(sectionPlan.rules.selectedAspectRuleRefs, [
    "western.relational.affection.sun_venus.conjunction@1",
    "western.relational.affection.venus_jupiter.trine@1"
  ]);
});

test("un seul attention_point est produit depuis le premier aspect sélectionné qui en possède un", () => {
  const { sectionPlan } = planFor([
    natalAspect("Venus", "Saturn", "opposition", 1, 8),
    natalAspect("Moon", "Venus", "square", 2, 8)
  ]);
  const attention = sectionPlan.blockPlans.filter((block) => block.blockId === "attention_point");
  assert.equal(attention.length, 1);
  assert.deepEqual(attention[0].packetRefs, ["relational_affection.aspect_saturn_venus_opposition.attention_point"]);
  assert.deepEqual(packetThemes(sectionPlan, "western.relational.affection.venus_saturn.opposition@1", "attention_point"), [
    "l'élan spontané et l'engagement suivi peuvent s'exprimer à des moments différents plutôt que dans un même geste"
  ]);
});

test("un aspect incertain est exclu sans bloquer les autres aspects certains", () => {
  const { sectionPlan } = planFor([
    natalAspect("Moon", "Venus", "trine", 1, 8, unstableCertainty()),
    natalAspect("Venus", "Jupiter", "sextile", 1, 8)
  ]);
  assert.deepEqual(sectionPlan.rules.selectedAspectRuleRefs, ["western.relational.affection.venus_jupiter.sextile@1"]);
  assert.ok(sectionPlan.forbiddenEvidenceRefs.includes("aspect.moon.venus.trine"));
});

test("un signe de Vénus instable ne produit pas de fallback", () => {
  const dossierEvidence = {
    schema: "astrolab.dossier_evidence",
    version: "test",
    evidence: [natalSign("Venus", "Pisces", unstableCertainty())]
  };
  const plan = buildIndividualRelationalAffectionPlan(dossierEvidence);
  const sectionPlan = plan.sections[0];
  assert.deepEqual(sectionPlan.blockPlans, []);
  assert.deepEqual(sectionPlan.evidencePackets, []);
  assert.deepEqual(sectionPlan.allowedInterpretationRuleRefs, []);
  assert.ok(sectionPlan.preconditions.some((entry) => entry.reason === "no_certain_affection_evidence"));
});

test("les règles génériques de Vénus en signe ne sont jamais utilisées par l'axe Affection", () => {
  const evidence = natalSign("Venus", "Aries");
  const scopedRules = rulesForEvidence(evidence, { scope: "individual_relational.affection" });
  assert.ok(scopedRules.some((rule) => rule.ruleId === "western.body.venus.sign.aries@1"));
  const { sectionPlan } = planFor([]);
  assert.equal(sectionPlan.allowedInterpretationRuleRefs.includes("western.body.venus.sign.aries@1"), false);
  assert.equal(sectionPlan.allowedInterpretationRuleRefs.includes("western.relational.affection.venus.sign.aries@1"), true);
});

test("le dépassement de phrases est un warning non bloquant pour Affection", () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Moon", "Venus", "trine")]);
  const section = {
    sectionId: sectionPlan.sectionId,
    contractVersion: "structured-section-writer@0.1.0",
    blocks: sectionPlan.blockPlans.map((blockPlan) => ({
      blockId: blockPlan.blockId,
      text: "Une phrase respecte le thème transmis. Une deuxième phrase dépasse la limite éditoriale."
    }))
  };
  const result = validateStructuredSection({ dossierEvidence, sectionPlan, section });
  assert.equal(result.ok, true);
  assert.equal(result.issues.some((issue) => issue.code === "block_sentence_limit_exceeded"), false);
  assert.equal(result.issues.length, 0);
  assert.equal(result.warnings.filter((warning) => warning.code === "block_sentence_limit_exceeded").length, sectionPlan.blockPlans.length);
});

test("un warning de phrase Affection ne déclenche aucun retry ni appel supplémentaire", async () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Moon", "Venus", "trine")]);
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
            text: "Une phrase respecte le thème transmis. Une deuxième phrase déclenche seulement un warning."
          }))
        };
      }
    }
  });
  assert.equal(calls, sectionPlan.blockPlans.length);
  assert.equal(written.llmCalls, 0);
  assert.equal(written.validation.ok, true);
  assert.equal(written.validation.issues.some((issue) => issue.code === "block_sentence_limit_exceeded"), false);
  assert.ok(written.validation.warnings.some((warning) => warning.code === "block_sentence_limit_exceeded"));
});

test("la sortie brute Affection est enrichie avec claims, evidenceRefs et interpretationRuleRefs", async () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Moon", "Venus", "square")]);
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
  assert.equal(written.validation.ok, true);
  assert.deepEqual([...new Set(written.section.blocks.flatMap((block) => block.evidenceRefs))], ["aspect.moon.venus.square"]);
  assert.deepEqual([...new Set(written.section.blocks.flatMap((block) => block.interpretationRuleRefs))], ["western.relational.affection.moon_venus.square@1"]);
  assert.ok(written.section.blocks.every((block) => block.claims.length > 0));
});

test("le renderer Affection masque les métadonnées sans modifier la section source", async () => {
  const { dossierEvidence, sectionPlan } = planFor([natalAspect("Moon", "Venus", "trine")]);
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
  const rendered = relationalAffectionSectionForRender(written.section);
  const after = JSON.stringify(written.section);
  assert.equal(before, after);
  assert.equal("claims" in rendered, false);
  assert.equal("evidenceRefs" in rendered, false);
  assert.equal("interpretationRuleRefs" in rendered, false);

  const html = renderDossierHtml({
    title: "Moi en relation",
    personLabel: "Fixture",
    createdAt: "2026-10-10T00:00:00.000Z",
    writerMode: "template",
    sections: [rendered]
  });
  const markdown = renderDossierMarkdown({
    title: "Moi en relation",
    personLabel: "Fixture",
    createdAt: "2026-10-10T00:00:00.000Z",
    sections: [rendered]
  });
  assert.match(html, /Manière d&#39;exprimer son affection|Manière d'exprimer son affection/);
  assert.match(markdown, /## Manière d'exprimer son affection/);
});

test("DossierEvidence ajoute seulement des métadonnées de certitude aux preuves existantes", () => {
  const natalResult = {
    methodVersion: "test-method",
    calculatedAt: "2026-10-10T00:00:00.000Z",
    normalizedInput: {
      birthDate: "1984-07-01",
      timePrecision: "exact",
      timeValue: "12:00",
      timeZone: "Europe/Paris",
      placeName: "Paris",
      latitude: 48.8566,
      longitude: 2.3522
    },
    astronomicalCalculation: {
      bodies: [
        {
          body: "Venus",
          sign: "Aries",
          degreeInSign: 12.3456789,
          longitude: 12.3456789,
          signIndex: 0,
          apparentMotion: { retrograde: false }
        }
      ],
      angles: {}
    },
    structuralAstrology: {
      houses: [],
      aspects: {
        ruleVersionId: "lastro-aspects@1.0.0",
        items: [
          {
            bodyA: "Moon",
            bodyB: "Venus",
            type: "trine",
            retained: true,
            exactness: 1.25,
            orbUsed: 8,
            ruleVersionId: "lastro-aspects@1.0.0",
            marginStability: null
          }
        ]
      }
    },
    uncertainty: { timePrecision: "exact", indeterminable: [], warnings: [] }
  };
  const evidence = buildDossierEvidence({ natalResult, generatedAt: "2026-10-10T12:00:00.000Z" });
  const venus = evidence.evidence.find((item) => item.evidenceId === "natal.venus.sign");
  const aspect = evidence.evidence.find((item) => item.evidenceId === "aspect.moon.venus.trine");
  assert.deepEqual(venus.value, { body: "Venus", sign: "Aries", degreeInSign: 12.345679, longitude: 12.345679 });
  assert.deepEqual(aspect.value, {
    bodyA: "Moon",
    bodyB: "Venus",
    aspectType: "trine",
    orb: 1.25,
    orbLimit: 8,
    exactness: 1.25,
    ruleVersion: "lastro-aspects@1.0.0"
  });
  assert.equal(venus.certainty.stableAcrossApplicableWindow, true);
  assert.equal(aspect.certainty.stableAcrossApplicableWindow, true);
  assert.equal(aspect.certainty.normalizedExactness, 0.15625);
});

function natalResultForCertainty({ timePrecision = "exact", body = {}, aspect = {} } = {}) {
  return {
    methodVersion: "test-method",
    calculatedAt: "2026-10-10T00:00:00.000Z",
    normalizedInput: {
      birthDate: "1984-07-01",
      timePrecision,
      timeValue: timePrecision === "unknown" || timePrecision === "interval" ? null : "12:00",
      timeZone: "Europe/Paris",
      placeName: "Paris",
      latitude: 48.8566,
      longitude: 2.3522
    },
    astronomicalCalculation: {
      bodies: [
        {
          body: "Venus",
          sign: "Cancer",
          degreeInSign: 1,
          longitude: 91,
          signIndex: 3,
          apparentMotion: { retrograde: false },
          ...body
        }
      ],
      angles: {}
    },
    structuralAstrology: {
      houses: [],
      aspects: {
        ruleVersionId: "lastro-aspects@1.0.0",
        items: [
          {
            bodyA: "Moon",
            bodyB: "Venus",
            type: "trine",
            retained: true,
            exactness: 2,
            orbUsed: 8,
            ruleVersionId: "lastro-aspects@1.0.0",
            ...aspect
          }
        ]
      }
    },
    uncertainty: { timePrecision, indeterminable: [], warnings: [] }
  };
}

function evidenceForCertainty(options) {
  return buildDossierEvidence({
    natalResult: natalResultForCertainty(options),
    generatedAt: "2026-10-10T12:00:00.000Z"
  });
}

test("heure approximative sans preuve de stabilité reste incertaine pour signe et aspect", () => {
  const evidence = evidenceForCertainty({ timePrecision: "approximate" });
  const sign = evidence.evidence.find((item) => item.evidenceId === "natal.venus.sign");
  const aspect = evidence.evidence.find((item) => item.evidenceId === "aspect.moon.venus.trine");

  assert.equal(sign.certainty.stableAcrossApplicableWindow, false);
  assert.equal(aspect.certainty.stableAcrossApplicableWindow, false);

  const plan = buildIndividualRelationalAffectionPlan(evidence);
  assert.deepEqual(plan.sections[0].primaryEvidenceRefs, []);
  assert.ok(plan.sections[0].preconditions.some((entry) => entry.reason === "no_certain_affection_evidence"));
});

test("heure approximative explicitement stable rend signe et aspect utilisables", () => {
  const evidence = evidenceForCertainty({
    timePrecision: "approximate",
    body: {
      marginWindow: {
        marginMinutes: 30,
        signStable: true,
        signAtWindowStart: "Cancer",
        signAtWindowEnd: "Cancer"
      }
    },
    aspect: {
      marginStability: {
        stable: true,
        gapAtWindowStart: 2,
        gapAtWindowEnd: 2.5
      }
    }
  });
  const sign = evidence.evidence.find((item) => item.evidenceId === "natal.venus.sign");
  const aspect = evidence.evidence.find((item) => item.evidenceId === "aspect.moon.venus.trine");

  assert.equal(sign.certainty.stableAcrossApplicableWindow, true);
  assert.equal(aspect.certainty.stableAcrossApplicableWindow, true);

  const plan = buildIndividualRelationalAffectionPlan(evidence);
  assert.deepEqual(plan.sections[0].rules.selectedAspectRuleRefs, ["western.relational.affection.moon_venus.trine@1"]);
  assert.equal(plan.sections[0].rules.fallbackRuleRef, null);
});

test("heure exacte conserve la certitude des signes et aspects retenus", () => {
  const evidence = evidenceForCertainty({ timePrecision: "exact" });
  const sign = evidence.evidence.find((item) => item.evidenceId === "natal.venus.sign");
  const aspect = evidence.evidence.find((item) => item.evidenceId === "aspect.moon.venus.trine");

  assert.equal(sign.certainty.stableAcrossApplicableWindow, true);
  assert.equal(aspect.certainty.stableAcrossApplicableWindow, true);
});

test("heure inconnue utilise l'analyse de franchissement sur toute la journée civile locale", () => {
  const evidence = evidenceForCertainty({ timePrecision: "unknown" });
  const sign = evidence.evidence.find((item) => item.evidenceId === "natal.venus.sign");
  const aspect = evidence.evidence.find((item) => item.evidenceId === "aspect.moon.venus.trine");
  const analysis = uncertainIntervalAnalysis({
    birthDate: "1984-07-01",
    timeZone: "Europe/Paris",
    latitude: 48.8566,
    longitude: 2.3522,
    timeStart: "00:00:00",
    timeEnd: "23:59:59"
  });
  const venusTarget = analysis.targets.find((target) => target.target === "Venus");

  assert.equal(sign.certainty.basis, "local_civil_day_sign_boundary_analysis");
  assert.equal(sign.certainty.stableAcrossApplicableWindow, venusTarget.status === "stable");
  assert.equal(aspect.certainty.stableAcrossApplicableWindow, false);
});

test("l'exactitude normalisée utilise l'orbe observée absolue divisée par l'orbe maximale autorisée", () => {
  const evidence = evidenceForCertainty({
    timePrecision: "exact",
    aspect: {
      exactness: -2.5,
      orbUsed: 10
    }
  });
  const aspect = evidence.evidence.find((item) => item.evidenceId === "aspect.moon.venus.trine");

  assert.equal(aspect.value.orb, -2.5);
  assert.equal(aspect.value.orbLimit, 10);
  assert.equal(aspect.certainty.normalizedExactness, 0.25);
});
