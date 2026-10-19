import assert from "node:assert/strict";
import test from "node:test";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { detectAstrologicalTextFacts, validateStructuredSection } from "../src/deliverables/factualClaimsValidator.mjs";
import { detectCrossedClaims, isCrossingLicensed } from "../src/deliverables/crossedClaims.mjs";
import { buildStructuredUserPrompt, scopedSectionPlanForBlock, writeStructuredSectionWithLlm } from "../src/deliverables/structuredSectionWriter.mjs";
import { blockLengthBudget } from "../src/deliverables/generationLimits.mjs";
import { buildSocle } from "../src/deliverables/socle.mjs";
import { docStrings, LANGUAGES } from "../src/deliverables/i18n.mjs";
import { selectTransitCoverage } from "../src/deliverables/transitSelection.mjs";

const input = { personId: "editorial_fixture", birthDate: "1979-03-14", timePrecision: "exact", timeValue: "09:00", birthPlace: "Lyon", country: "FR", latitude: 45.764, longitude: 4.8357, timeZone: "Europe/Paris", coordinateSource: "test_fixture", coordinateConfidence: "verified_fixture" };
const calculation = calculateWesternNatalChart(input, { calculatedAt: "2026-10-19T00:00:00.000Z", runId: "editorial_fixture" });
function dossier(currentSky) { return buildDossierEvidence({ natalResult: calculation.result, natalRun: calculation.calculationRun, generatedAt: "2026-10-19T00:00:00.000Z", currentSky }); }
const unlinked = "La Lune forme un carré avec Mercure. Le Soleil forme une conjonction avec Vénus. Cependant, cette harmonie peut être mise à l’épreuve par les tensions évoquées précédemment.";
const detectFacts = detectAstrologicalTextFacts;

for (const text of [unlinked, unlinked.replaceAll("’", "'"), "Mars forme une opposition avec Saturne. Mercure forme un sextile avec Vénus. Ces deux aspects se répondent."]) {
  test(`interaction anaphorique bloquée : ${text.slice(-85)}`, () => {
    const findings = detectCrossedClaims({ text, detectFacts });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].provenance, "contextual_antecedents");
    assert.equal(isCrossingLicensed({ ...findings[0], relations: [] }), false);
  });
}

test("une interaction anaphorique reste autorisée avec les deux preuves de sa licence", () => {
  const findings = detectCrossedClaims({ text: "Le Soleil forme un trigone avec Jupiter. La Lune forme un sextile avec Jupiter. Ces deux aspects se répondent.", detectFacts });
  assert.equal(findings.length, 1);
  const refs = { a: { bodyA: "Sun", bodyB: "Jupiter", aspectType: "trine" }, b: { bodyA: "Moon", bodyB: "Jupiter", aspectType: "sextile" } };
  assert.equal(isCrossingLicensed({ ...findings[0], relations: [{ evidenceRefs: ["a", "b"] }], resolveRef: (ref) => refs[ref] }), true);
});

for (const text of ["La Lune forme un carré avec Mercure. Le Soleil forme une conjonction avec Vénus.", "La Lune forme un carré avec Mercure. Le Soleil forme une conjonction avec Vénus. Ces deux aspects ne se répondent pas.", "Ces deux aspects se répondent.", "Le Soleil forme une conjonction avec Vénus. Cette harmonie vous invite à réfléchir."]) {
  test(`aucun croisement inventé : ${text.slice(-75)}`, () => assert.equal(detectCrossedClaims({ text, detectFacts }).length, 0));
}

test("le validateur contrôle les renvois entre deux blocs du même chapitre", () => {
  const evidence = dossier();
  const plan = buildFullDossierPlan(evidence, { aspectChapterMode: "narrative" });
  const sectionPlan = plan.sections.find((section) => section.sectionId === "major_aspects");
  const blocks = sectionPlan.blockPlans.map((block, index) => ({ blockId: block.blockId, text: index === 0 ? "Mars forme une opposition avec Saturne. Mercure forme un sextile avec Vénus." : index === 1 ? "Ces deux aspects se répondent." : "Une lecture symbolique reste ouverte." }));
  assert.ok(blocks.length >= 2);
  const result = validateStructuredSection({ dossierEvidence: evidence, sectionPlan, section: { sectionId: sectionPlan.sectionId, blocks } });
  assert.ok(result.issues.some((issue) => issue.code === "crossed_claim_not_licensed" && issue.provenance === "contextual_antecedents"));
});

test("en production chaque aspect est développé dans son seul chapitre propriétaire", () => {
  const plan = buildFullDossierPlan(dossier(), { aspectChapterMode: "reference" });
  for (const idea of plan.editorialPlan.ideas.filter((idea) => idea.kind === "configuration")) {
    const ref = idea.evidenceRefs[0];
    const owners = plan.sections.filter((section) => section.editorialMode !== "reference" && section.primaryEvidenceRefs.includes(ref));
    assert.deepEqual(owners.map((section) => section.sectionId), [idea.owner]);
  }
});

test("les rappels n'exposent ni thèmes ni concepts et restent limités à une phrase", async () => {
  const evidence = dossier();
  const plan = buildFullDossierPlan(evidence, { aspectChapterMode: "reference" });
  let checked = 0;
  for (const sectionPlan of plan.sections) {
    const recall = sectionPlan.blockPlans.find((block) => block.blockId === "brief_recall");
    if (!recall) continue;
    checked++;
    const scoped = scopedSectionPlanForBlock(sectionPlan, recall);
    const prompt = JSON.parse(buildStructuredUserPrompt({ sectionPlan: scoped }));
    for (const packet of prompt.sectionPlan.blockPlans[0].packets) {
      assert.deepEqual(packet.themes, []);
      assert.equal(packet.semantics, undefined);
    }
    const validate = (text) => validateStructuredSection({ dossierEvidence: evidence, sectionPlan: scoped, section: { sectionId: scoped.sectionId, blocks: [{ blockId: recall.blockId, text }] } });
    assert.equal(validate("Un rappel bref invite à poursuivre la réflexion.").ok, true);
    assert.ok(validate("Un rappel. Un développement supplémentaire.").issues.some((issue) => issue.code === "block_sentence_limit_exceeded"));
    assert.ok(validate("mot ".repeat(60) + ".").issues.some((issue) => issue.code === "block_word_limit_exceeded"));
  }
  assert.ok(checked > 0);
});

function contacts() {
  return Array.from({ length: 42 }, (_, day) => ({ exactAt: new Date(Date.UTC(2026, 9, 20 + day)).toISOString(), startsAt: new Date(Date.UTC(2026, 9, 20 + day)).toISOString(), transitBody: day % 7 === 6 ? "Jupiter" : "Moon", natalPoint: "Sun", aspectType: "square", status: "UPCOMING" }));
}

test("la sélection couvre les six semaines disponibles et diversifie les corps", () => {
  const all = contacts();
  const selected = selectTransitCoverage(all, 8);
  assert.equal(selected.length, 8);
  const weeks = new Set(selected.map((item) => Math.floor((Date.parse(item.exactAt) - Date.parse(all[0].exactAt)) / (7 * 86400000))));
  assert.equal(weeks.size, 6);
  assert.ok(selected.some((item) => item.transitBody === "Jupiter"));
  assert.ok(selected.every((item) => all.includes(item)));
  assert.deepEqual(selectTransitCoverage(all, 8), selected);
});

test("aucun transit ni aucune date ne sont inventés quand la période est peu fournie", () => {
  const few = contacts().slice(0, 2);
  assert.deepEqual(selectTransitCoverage(few, 8), few);
  assert.deepEqual(selectTransitCoverage([], 8), []);
});

test("le plan conserve les transits tardifs, même si leur configuration existe déjà dans le ciel actuel", () => {
  const future = contacts().map((value, index) => ({ resultId: `future_${index}`, status: "UPCOMING", contact: { transitBody: value.transitBody, natalPoint: value.natalPoint, aspectType: value.aspectType, orb: 0.5, effectiveOrbLimit: 1.5 }, timing: { startsAt: value.startsAt, exactAt: value.exactAt, endsAt: value.exactAt, phase: "APPLYING" } }));
  const currentSky = { window: { nowUtc: "2026-10-19T00:00:00.000Z", horizonDays: 42 }, current: [{ ...future[0], resultId: "current", status: "CURRENT" }], upcoming: future, recent: [] };
  const plan = buildFullDossierPlan(dossier(currentSky), { aspectChapterMode: "reference" });
  const section = plan.sections.find((section) => section.sectionId === "next_weeks");
  const claims = section.evidencePackets.flatMap((packet) => packet.claims);
  assert.ok(claims.length <= 8);
  assert.ok(claims.some((claim) => claim.exactAt.startsWith("2026-11-")));
  assert.equal(new Set(claims.map((claim) => Math.floor((Date.parse(claim.exactAt) - Date.parse(future[0].timing.exactAt)) / (7 * 86400000)))).size, 6);
});


test("un rappel bref ne prend pas la moitié du budget du développement principal", () => {
  const primary = { blockId: "primary", packetRefs: [] };
  const recall = { blockId: "brief_recall", packetRefs: [], targetWords: 25, maxWords: 45 };
  const sectionPlan = { targetWords: 400, maxWords: 800, evidencePackets: [], blockPlans: [primary, recall] };
  const budget = blockLengthBudget({ sectionPlan, blockPlan: primary });
  assert.equal(budget.targetWords, 375);
  assert.equal(budget.maxWords, 755);
  const scoped = scopedSectionPlanForBlock(sectionPlan, primary);
  assert.deepEqual(blockLengthBudget({ sectionPlan: scoped, blockPlan: primary, blockCount: 2 }), budget);
  assert.equal(blockLengthBudget({ sectionPlan, blockPlan: recall }).maxWords, 45);
});


test("la figure conserve toutes ses preuves dans un seul bloc de développement fermé", () => {
  const plan = buildFullDossierPlan(dossier(), { aspectChapterMode: "reference" });
  let checked = 0;
  for (const section of plan.sections.filter((section) => section.readingHypotheses.length > 0)) {
    checked++;
    const block = section.blockPlans.find((block) => block.blockId === "figure_exploration");
    assert.ok(block);
    const scoped = scopedSectionPlanForBlock(section, block);
    const refs = new Set(scoped.evidencePackets.flatMap((packet) => packet.evidenceRefs));
    const figures = plan.editorialPlan.ideas.filter((idea) => idea.kind === "figure" && idea.owner === section.sectionId);
    for (const ref of figures.flatMap((idea) => idea.evidenceRefs)) assert.ok(refs.has(ref));
    assert.equal(block.maxSentences, undefined);
  }
  assert.ok(checked > 0);
});


for (const { code } of LANGUAGES) {
  test(`l'annexe distingue les deux orbes en ${code}`, () => {
    const strings = docStrings(code);
    const socle = buildSocle(calculation.result, strings);
    assert.ok(socle.retainedAspects.length > 0);
    const aspect = socle.retainedAspects[0];
    const text = socle.facts.find((fact) => fact.id === aspect.id).value;
    assert.ok(text.includes(`${strings.labels.actualOrb} ${aspect.exactness.toFixed(2)}°`));
    assert.ok(text.includes(`${strings.labels.maximumOrb} ${aspect.orbUsed}°`));
  });
}

test("un vrai fait absent des preuves reste bloquant après ces corrections", () => {
  const evidence = dossier();
  const plan = buildFullDossierPlan(evidence, { aspectChapterMode: "reference" });
  const sectionPlan = plan.sections.find((section) => section.sectionId === "internal_tensions");
  const section = { sectionId: sectionPlan.sectionId, blocks: sectionPlan.blockPlans.map((block) => ({ blockId: block.blockId, text: "Vénus en Verseau." })) };
  const result = validateStructuredSection({ dossierEvidence: evidence, sectionPlan, section });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "undeclared_text_fact"));
});
