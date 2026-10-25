import assert from "node:assert/strict";
import test from "node:test";
import { docStrings } from "../src/deliverables/i18n.mjs";
import { mergeRelationalSubsections, renderableDossierSection } from "../src/deliverables/dossierPresentation.mjs";

const proof = (id, type, value) => ({ evidenceId: id, type, value });
const SIGN = proof("natal.venus.sign", "NATAL_BODY_SIGN", { body: "Venus", sign: "Capricorn" });
const HOUSE = proof("natal.venus.house", "NATAL_BODY_HOUSE", { body: "Venus", house: 7, houseSystem: "WHOLE_SIGN" });
const ASPECT = proof("natal.sun.venus.conjunction", "NATAL_ASPECT", { bodyA: "Sun", bodyB: "Venus", aspectType: "conjunction", orb: 4.07 });
const TRANSIT = proof("transit.uranus.saturn", "PERSONAL_TRANSIT", { transitBody: "Uranus", natalPoint: "Saturn", aspectType: "opposition" });
const natal = ({ sectionId = "affectivity", refs = [SIGN.evidenceId, HOUSE.evidenceId], primary = [SIGN.evidenceId], prefix = undefined } = {}) => ({
  section: { sectionId, blocks: [{ blockId: "main", text: "Un paragraphe validé, intégralement conservé.", evidenceRefs: refs, interpretationRuleRefs: ["rule.existing"] }] },
  sectionPlan: { primaryEvidenceRefs: primary, blockPlans: [{ blockId: "main", ...(prefix ? { deterministicPrefix: prefix } : {}) }] },
  dossierEvidence: { evidence: [SIGN, HOUSE, ASPECT] }, strings: docStrings("fr"), title: "Affectivité"
});

test("presentation: owned placement has its sign and same-block contextual house without mutating proofs", () => {
  const input = natal();const saved = structuredClone(input);const out = renderableDossierSection(input);
  assert.deepEqual(out.configurationsStudied, ["Vénus · Capricorne · maison 7"]);
  assert.equal(out.text, input.section.blocks[0].text);
  assert.deepEqual(input, saved);
});

test("presentation: a house from another block is not silently added to a sign configuration", () => {
  const input = natal({ refs: [SIGN.evidenceId] });
  input.section.blocks.push({ blockId: "secondary", text: "Autre paragraphe intact.", evidenceRefs: [HOUSE.evidenceId], interpretationRuleRefs: [] });
  const out = renderableDossierSection(input);
  assert.deepEqual(out.configurationsStudied, ["Vénus · Capricorne"]);
  assert.equal(out.text, "Un paragraphe validé, intégralement conservé.\n\nAutre paragraphe intact.");
});

test("presentation: owned house can display a same-block sign but unowned placements stay absent", () => {
  const input = natal({ primary: [HOUSE.evidenceId] });
  assert.deepEqual(renderableDossierSection(input).configurationsStudied, ["Vénus · Capricorne · maison 7"]);
  input.sectionPlan.primaryEvidenceRefs = [];
  assert.deepEqual(renderableDossierSection(input).configurationsStudied, []);
  input.sectionPlan.primaryEvidenceRefs = [SIGN.evidenceId];input.section.blocks[0].evidenceRefs = [];
  assert.deepEqual(renderableDossierSection(input).configurationsStudied, []);
});

test("presentation: uncertain sign or invalid house is never asserted in the fact panel", () => {
  const input = natal();input.dossierEvidence = structuredClone(input.dossierEvidence);
  input.dossierEvidence.evidence[0].certainty = { stableAcrossApplicableWindow: false };
  assert.deepEqual(renderableDossierSection(input).configurationsStudied, []);
  delete input.dossierEvidence.evidence[0].certainty;input.dossierEvidence.evidence[1].value.house = 13;
  assert.deepEqual(renderableDossierSection(input).configurationsStudied, ["Vénus · Capricorne"]);
});

test("presentation: relational affection is anchored to its actual owned Sun–Venus proof", () => {
  const input = natal({ sectionId: "relational_affection", refs: [ASPECT.evidenceId], primary: [ASPECT.evidenceId] });
  const out = renderableDossierSection(input);
  assert.deepEqual(out.configurationsStudied, ["Soleil–Vénus : conjonction"]);
  assert.equal(out.title, "Votre manière d'exprimer votre affection");
  assert.equal(out.text, input.section.blocks[0].text);
});

test("presentation: only the entire server-owned factual aspect lead can move to the configurations panel", () => {
  const prefix = "Le Soleil forme une conjonction avec Vénus.";
  const input = natal({ refs: [ASPECT.evidenceId], primary: [ASPECT.evidenceId], prefix });
  input.section.blocks[0].text = `${prefix}\n\nDeux phrases de lecture. Chaque mot reste présent.`;
  const out = renderableDossierSection(input);
  assert.equal(out.text, "Deux phrases de lecture. Chaque mot reste présent.");
  assert.deepEqual(out.configurationsStudied, ["Soleil–Vénus : conjonction"]);
  input.sectionPlan.primaryEvidenceRefs = [];
  assert.equal(renderableDossierSection(input).text, input.section.blocks[0].text, "no removal if the proof is not displayed");
});

test("presentation: at most three configurations; a partially covered aspect lead remains verbatim", () => {
  const aspects = Array.from({ length: 4 }, (_, n) => proof(`aspect.${n}`, "NATAL_ASPECT", { bodyA: "Sun", bodyB: ["Moon", "Venus", "Mars", "Saturn"][n], aspectType: "sextile" }));
  const prefix = "Un préfixe serveur contenant quatre aspects.";
  const input = natal({ refs: aspects.map((p) => p.evidenceId), primary: aspects.map((p) => p.evidenceId), prefix });
  input.dossierEvidence.evidence.push(...aspects);input.section.blocks[0].text = `${prefix}\n\nLecture complète à conserver.`;
  const out = renderableDossierSection(input);
  assert.equal(out.configurationsStudied.length, 3);
  assert.equal(out.text, input.section.blocks[0].text);
});

for (const sectionId of ["general_synthesis", "conclusion"]) {
  test(`presentation: no duplicate facts panel in ${sectionId}`, () => {
    assert.deepEqual(renderableDossierSection(natal({ sectionId })).configurationsStudied, []);
  });
}

const transit = () => ({
  section: { sectionId: "current_sky", blocks: [{ blockId: "transit_01", text: "Uranus forme une opposition à votre Saturne.", evidenceRefs: [TRANSIT.evidenceId], interpretationRuleRefs: [] }] },
  sectionPlan: { primaryEvidenceRefs: [TRANSIT.evidenceId], blockPlans: [{ blockId: "transit_01", packetRefs: ["packet.transit"], deterministicPrefix: "Uranus forme une opposition à votre Saturne." }], evidencePackets: [{ packetId: "packet.transit", evidenceRefs: [TRANSIT.evidenceId], interpretationRuleRefs: [] }] },
  dossierEvidence: { evidence: [TRANSIT] }, strings: docStrings("fr"), title: "Votre ciel actuellement"
});

test("presentation: a validated bare server transit becomes an exact calculated reference only", () => {
  const input = transit();const saved = structuredClone(input);const out = renderableDossierSection(input);
  assert.equal(out.text, "");assert.deepEqual(out.calculatedReferences, [input.section.blocks[0].text]);
  assert.equal(out.calculatedReferencesLabel, "Autres repères calculés");assert.equal(out.calculatedReferencesNote, "Repères présentés sans lecture symbolique.");
  assert.deepEqual(input, saved);
});

for (const variation of ["prose", "trailing_whitespace", "block_rule", "packet_rule", "missing_packet", "non_transit", "different_prefix", "unknown_block_rules", "unknown_packet_rules", "missing_used_transit_proof"]) {
  test(`presentation: ${variation} keeps the complete text rather than attributing it to a bare server prefix`, () => {
    const input = transit();
    if (variation === "prose") input.section.blocks[0].text += "\n\nUne prose validée reste ici, même sans règle attachée.";
    if (variation === "trailing_whitespace") input.section.blocks[0].text += "\n";
    if (variation === "block_rule") input.section.blocks[0].interpretationRuleRefs.push("rule");
    if (variation === "packet_rule") input.sectionPlan.evidencePackets[0].interpretationRuleRefs.push("rule");
    if (variation === "missing_packet") input.sectionPlan.blockPlans[0].packetRefs.push("unresolved");
    if (variation === "non_transit") input.dossierEvidence.evidence = [{ ...TRANSIT, type: "TRANSIT_SNAPSHOT" }];
    if (variation === "different_prefix") input.sectionPlan.blockPlans[0].deterministicPrefix = "Autre fait.";
    if (variation === "unknown_block_rules") delete input.section.blocks[0].interpretationRuleRefs;
    if (variation === "unknown_packet_rules") delete input.sectionPlan.evidencePackets[0].interpretationRuleRefs;
    if (variation === "missing_used_transit_proof") input.section.blocks[0].evidenceRefs = [];
    const out = renderableDossierSection(input);
    assert.deepEqual(out.calculatedReferences, []);assert.equal(out.text, input.section.blocks[0].text);
  });
}

test("presentation: calculated reference labels exist in all nine languages", () => {
  for (const language of ["fr", "en", "de", "es", "it", "pt", "no", "da", "nl"]) {
    const input = transit();input.strings = docStrings(language);const out = renderableDossierSection(input);
    assert.ok(out.calculatedReferencesLabel.length > 0);assert.ok(out.calculatedReferencesNote.length > 0);
    if (language !== "fr") assert.doesNotMatch(out.calculatedReferencesLabel, /Autres repères calculés/);
  }
});

test("presentation: relational axes merge below their existing chapters without changing any source text or metadata", () => {
  const main = [{ id: "communication", text: "Communication natale." }, { id: "affectivity", text: "Lecture affective." }, { id: "conclusion", text: "Conclusion." }];
  const axes = [{ id: "relational_affection", text: "Affection validée.", configurationsStudied: ["Soleil–Vénus : conjonction"] }, { id: "relational_communication", text: "Échange validé." }];
  const saved = structuredClone({ main, axes });const out = mergeRelationalSubsections(main, axes);
  assert.equal(out.find((section) => section.id === "affectivity").subsections[0].text, axes[0].text);
  assert.equal(out.find((section) => section.id === "communication").subsections[0].text, axes[1].text);
  assert.deepEqual(out.map((section) => section.id), main.map((section) => section.id));
  assert.deepEqual({ main, axes }, saved);
});

test("presentation: missing parent uses Relationships; missing Relationships places the intact axis before Conclusion", () => {
  const axis = { id: "relational_affection", text: "Texte conservé mot pour mot." };
  let out = mergeRelationalSubsections([{ id: "relationships", text: "Relations." }, { id: "conclusion", text: "Fin." }], [axis]);
  assert.equal(out[0].subsections[0].text, axis.text);assert.equal(out.at(-1).id, "conclusion");
  out = mergeRelationalSubsections([{ id: "identity", text: "Identité." }, { id: "conclusion", text: "Fin." }], [axis]);
  assert.deepEqual(out.map((section) => section.id), ["identity", "relational_affection", "conclusion"]);
  assert.equal(out[1].text, axis.text);
});


test("presentation: a repeated owned sign can use the house from a block that actually contains both proofs", () => {
  const input = natal({ refs: [SIGN.evidenceId] });
  input.section.blocks.push({ blockId: "with_context", text: "Passage validé avec son contexte.", evidenceRefs: [SIGN.evidenceId, HOUSE.evidenceId], interpretationRuleRefs: ["rule.existing"] });
  const out = renderableDossierSection(input);
  assert.deepEqual(out.configurationsStudied, ["Vénus · Capricorne · maison 7"]);
  assert.ok(out.text.endsWith("Passage validé avec son contexte."));
});
