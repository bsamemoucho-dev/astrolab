import assert from "node:assert/strict";
import test from "node:test";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { writeStructuredSectionWithLlm } from "../src/deliverables/structuredSectionWriter.mjs";

const evidence = { schema: "astrolab.dossier_evidence", evidence: [{ evidenceId: "natal.sun.sign", type: "NATAL_BODY_SIGN", value: { body: "Sun", sign: "Capricorn" } }] };
const prefix = "Le Soleil est en Capricorne.";
const clear = "Le symbole met l'accent sur la construction dans la durée.\n\nCette lecture laisse ouverte la manière dont le lecteur s'y reconnaît.";
const tic = "Vous pourriez réfléchir à ce qui vous importe. Vous pourriez considérer cette possibilité. Vous pourriez faire une place à cette nuance.";
function plan() {
  const section = buildFullDossierPlan(evidence, { aspectChapterMode: "reference" }).sections.find((entry) => entry.sectionId === "identity");
  return { ...section, blockPlans: section.blockPlans.map((block) => ({ ...block, deterministicPrefix: prefix })) };
}
const output = (section, text) => ({ sectionId: section.sectionId, blocks: section.blockPlans.map((block) => ({ blockId: block.blockId, text })) });

test("a forbidden dated fact in a stylistic rewrite is rejected, never silently removed", async () => {
  let calls = 0;
  const corrections = [];
  const invalid = "La lecture reste ouverte.\n\nVénus en Lion le 9 mars 2027.";
  await assert.rejects(writeStructuredSectionWithLlm({
    dossierEvidence: evidence,
    sectionPlan: plan(),
    options: { logger: { warn() {} }, structuredWriterFn: ({ sectionPlan, correctionIssues }) => {
      corrections.push(correctionIssues);
      return output(sectionPlan, ++calls === 1 ? tic : invalid);
    } }
  }), (error) => {
    assert.ok(error.validation.issues.some((issue) => issue.code === "undeclared_text_fact" && issue.fact?.body === "Venus"));
    assert.ok(error.validation.issues.some((issue) => issue.code === "date_rewording_in_interpretation"));
    return true;
  });
  assert.equal(calls, 3, "editorial revision shares the existing three-attempt budget");
  assert.ok(corrections[2].some((issue) => issue.block?.textFragment?.includes(invalid)), "the actual generated prose remains visible to the factual correction");
});

test("a corrected temporal rewording succeeds on the next attempt with intact paragraphs", async () => {
  let calls = 0;
  const seen = [];
  const invalid = "Ce passage sera exact le 9 mars 2027.\n\nCette lecture reste une possibilité symbolique.";
  const result = await writeStructuredSectionWithLlm({
    dossierEvidence: evidence,
    sectionPlan: plan(),
    options: { logger: { warn() {} }, structuredWriterFn: ({ sectionPlan, correctionIssues }) => {
      seen.push(correctionIssues);
      return output(sectionPlan, ++calls === 1 ? invalid : clear);
    } }
  });
  assert.equal(calls, 2);
  assert.equal(result.validation.ok, true);
  assert.equal(result.section.blocks[0].text, `${prefix}\n\n${clear}`);
  assert.ok(seen[1].some((issue) => issue.code === "date_rewording_in_interpretation"));
  assert.ok(seen[1].some((issue) => issue.code === "temporal_rewording_in_interpretation"));
  assert.ok(seen[1].some((issue) => issue.block?.textFragment?.includes(invalid)));
});

for (const [text, code] of [
  ["Ce passage est à venir.", "temporal_rewording_in_interpretation"],
  ["La fenêtre d'orbe est un repère.", "temporal_rewording_in_interpretation"],
  ["Le 9 mars 2027 est un repère.", "date_rewording_in_interpretation"],
  ["Mars 2027 est un repère calendaire.", "date_rewording_in_interpretation"]
]) test(`server-owned wording gets an explicit error rather than deletion: ${text}`, async () => {
  let calls = 0;
  await assert.rejects(writeStructuredSectionWithLlm({ dossierEvidence: evidence, sectionPlan: plan(), options: { logger: { warn() {} }, structuredWriterFn: ({ sectionPlan }) => { calls++; return output(sectionPlan, text); } } }), (error) => error.validation?.issues.some((issue) => issue.code === code));
  assert.equal(calls, 2);
});

test("correct prose and line breaks are retained exactly with a deterministic prefix", async () => {
  const result = await writeStructuredSectionWithLlm({ dossierEvidence: evidence, sectionPlan: plan(), options: { structuredWriterFn: ({ sectionPlan }) => output(sectionPlan, clear) } });
  assert.equal(result.section.blocks[0].text, `${prefix}\n\n${clear}`);
});
