import assert from "node:assert/strict";
import test from "node:test";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { angleSignCertainty, angleSignWindow } from "../src/astro/angleUncertainty.mjs";
import { buildDossierEvidence, evidenceById, isEvidenceDeterminateForClaim } from "../src/deliverables/dossierEvidence.mjs";
import { rulesForEvidence } from "../src/deliverables/interpretationRules.mjs";
import { detectAstrologicalTextFacts, validateDossierClaims, validateStructuredSection } from "../src/deliverables/factualClaimsValidator.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { getPersonalCurrentSky } from "../src/models/currentSkyService.mjs";

// Fictional birth, not the reported customer's identity or birth data. At 05:00
// a ±30 min window crosses Scorpio/Sagittarius, with nominal DSC in Gemini.
const INPUT = Object.freeze({ birthDate: "1990-01-15", timeValue: "05:00", timePrecision: "approximate", timeMarginMinutes: 30, latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", placeName: "Paris", country: "France" });
const GENERATED = "2026-11-01T12:00:00.000Z";
function fixture(extra = {}) {
  const calculation = calculateWesternNatalChart({ ...INPUT, ...extra }, { calculatedAt: GENERATED });
  const before = structuredClone(calculation.result);
  const dossier = buildDossierEvidence({ natalResult: calculation.result, generatedAt: GENERATED });
  assert.deepEqual(calculation.result, before, "evidence must preserve every calculated position, time and window");
  return { calculation, dossier, byId: evidenceById(dossier) };
}
function validateText(dossier, proof, text, claims = []) {
  return validateStructuredSection({ dossierEvidence: dossier,
    sectionPlan: { sectionId: "relationships", primaryEvidenceRefs: [proof.evidenceId], secondaryEvidenceRefs: [], allowedInterpretationRuleRefs: [] },
    section: { sectionId: "relationships", blocks: [{ blockId: "relationship", interpretationDepth: "primary", evidenceRefs: [proof.evidenceId], interpretationRuleRefs: [], text, claims }] }
  });
}

for (const [angle, opposite] of [["ascendant", "descendant"], ["midheaven", "imumCoeli"]]) {
  test(`uncertain axes: ${angle}/${opposite} preserve opposite windows and identical certainty`, () => {
    const { calculation, byId } = fixture();
    const windows = calculation.result.astronomicalCalculation.angles.uncertaintyWindow;
    assert.equal(windows[angle].signStable, windows[opposite].signStable);
    for (const edge of ["Start", "End"]) assert.ok(Math.abs((windows[angle][`longitudeAtWindow${edge}`] + 180) % 360 - windows[opposite][`longitudeAtWindow${edge}`]) < 0.00001);
    assert.equal(byId.get(`angle.${angle === "imumCoeli" ? "imum_coeli" : angle}.sign`).certainty.stableAcrossApplicableWindow,
      byId.get(`angle.${opposite === "imumCoeli" ? "imum_coeli" : opposite}.sign`).certainty.stableAcrossApplicableWindow);
  });
}

test("uncertain axes: reported Scorpio/Sagittarius contradiction reproduced without customer data", () => {
  const f = fixture();
  const asc = f.byId.get("angle.ascendant.sign"), dsc = f.byId.get("angle.descendant.sign");
  assert.deepEqual(asc.certainty.signsInWindow, ["Scorpio", "Sagittarius"]);
  assert.deepEqual(dsc.certainty.signsInWindow, ["Taurus", "Gemini"]);
  assert.equal(dsc.value.sign, "Gemini", "the actual nominal result remains available for diagnostics");
  assert.equal(dsc.certainty.stableAcrossApplicableWindow, false);
  assert.deepEqual(rulesForEvidence(dsc), []);
  const claim = { type: "ANGLE_SIGN", angle: "descendant", sign: "Gemini", evidenceRefs: [dsc.evidenceId] };
  const claimResult = validateDossierClaims({ dossierEvidence: f.dossier, claims: [claim] });
  assert.ok(claimResult.issues.some((finding) => finding.code === "uncertain_factual_claim"));
  const textResult = validateText(f.dossier, dsc, "Votre Descendant est en Gémeaux.", [claim]);
  assert.ok(textResult.issues.some((finding) => finding.code === "undeclared_text_fact" && finding.reason === "source_fact_undecidable" && finding.fact.angle === "descendant"));
  assert.equal(textResult.ok, false);
});

for (const [angle, text] of [["ascendant", "Votre Ascendant est en Sagittaire."], ["descendant", "Votre Descendant est en Gémeaux."], ["midheaven", "Votre Milieu du Ciel est en Balance."], ["imumCoeli", "Votre Fond du Ciel est en Bélier."]]) {
  test(`uncertain axes: even nominally matching ${angle} facts do not override an explicit unstable window`, () => {
    const f = fixture();
    const proof = structuredClone(f.byId.get(`angle.${angle === "imumCoeli" ? "imum_coeli" : angle}.sign`));
    proof.certainty.stableAcrossApplicableWindow = false;
    const dossier = { evidence: [proof] };
    const signFr = { Aries: "Bélier", Taurus: "Taureau", Gemini: "Gémeaux", Cancer: "Cancer", Leo: "Lion", Virgo: "Vierge", Libra: "Balance", Scorpio: "Scorpion", Sagittarius: "Sagittaire", Capricorn: "Capricorne", Aquarius: "Verseau", Pisces: "Poissons" };
    const actualText = text.replace(/en .+\./u, `en ${signFr[proof.value.sign]}.`);
    assert.equal(isEvidenceDeterminateForClaim(proof), false);
    assert.deepEqual(rulesForEvidence(proof), []);
    assert.ok(validateText(dossier, proof, actualText).issues.some((issue) => issue.code === "undeclared_text_fact" && issue.reason === "source_fact_undecidable"));
  });
}

test("uncertain axes: approximate stable DSC retains its licence, without inventing exact time", () => {
  const f = fixture({ timeMarginMinutes: 10 });
  const dsc = f.byId.get("angle.descendant.sign");
  assert.equal(dsc.certainty.timePrecision, "approximate");
  assert.equal(dsc.certainty.stableAcrossApplicableWindow, true);
  assert.ok(rulesForEvidence(dsc).some((rule) => rule.ruleId === "western.angle.descendant.sign.gemini@1"));
  assert.equal(validateText(f.dossier, dsc, "Votre Descendant est en Gémeaux.").ok, true);
});

test("uncertain axes: exact time retains all four true angle facts", () => {
  const f = fixture({ timePrecision: "exact" });
  assert.equal(f.calculation.result.astronomicalCalculation.angles.uncertaintyWindow, undefined);
  for (const proof of f.dossier.evidence.filter((item) => item.type === "ANGLE_SIGN")) {
    assert.equal(proof.certainty.stableAcrossApplicableWindow, true);
    assert.equal(validateDossierClaims({ dossierEvidence: f.dossier, claims: [{ type: "ANGLE_SIGN", ...proof.value, evidenceRefs: [proof.evidenceId] }] }).ok, true);
  }
});

for (const precision of ["unknown", "interval"]) {
  test(`uncertain axes: ${precision} time cannot invent a nominal angle or house`, () => {
    const f = fixture({ timePrecision: precision, ...(precision === "interval" ? { timeStart: "04:30", timeEnd: "05:30" } : {}) });
    assert.equal(f.dossier.evidence.some((proof) => proof.type === "ANGLE_SIGN" || proof.type === "NATAL_BODY_HOUSE"), false);
    const malicious = { evidenceId: "angle.descendant.sign", type: "ANGLE_SIGN", value: { angle: "descendant", sign: "Gemini" } };
    const dossier = { evidence: [...f.dossier.evidence, malicious] };
    assert.ok(validateText(dossier, malicious, "Votre Descendant est en Gémeaux.").issues.some((issue) => issue.code === "undeclared_text_fact"));
  });
}

test("uncertain axes: approximate context cannot be bypassed by omitting certainty metadata", () => {
  const f = fixture();
  for (const type of ["ANGLE_SIGN", "NATAL_BODY_HOUSE"]) {
    const proof = type === "ANGLE_SIGN"
      ? { evidenceId: "angle.descendant.sign", type, value: { angle: "descendant", sign: "Gemini" } }
      : { evidenceId: "natal.venus.house", type, value: { body: "Venus", house: 7, houseSystem: "WHOLE_SIGN" } };
    const dossier = { evidence: [f.byId.get("birth.identity"), proof] };
    const claim = { type, ...proof.value, evidenceRefs: [proof.evidenceId] };
    assert.ok(validateDossierClaims({ dossierEvidence: dossier, claims: [claim] }).issues.some((issue) => issue.code === "uncertain_factual_claim"));
    assert.ok(validateText(dossier, proof, type === "ANGLE_SIGN" ? "Votre Descendant est en Gémeaux." : "Vénus est en maison 7.").issues.some((issue) => issue.code === "undeclared_text_fact"));
  }
});

test("uncertain axes: historical ASC/MC-only windows give DSC/IC the same uncertainty", () => {
  const f = fixture();
  const legacy = structuredClone(f.calculation.result);
  const original = structuredClone(legacy);
  delete legacy.astronomicalCalculation.angles.uncertaintyWindow.descendant;
  delete legacy.astronomicalCalculation.angles.uncertaintyWindow.imumCoeli;
  delete legacy.structuralAstrology.houseUncertainty;
  const legacyBefore = structuredClone(legacy);
  const evidence = buildDossierEvidence({ natalResult: legacy, generatedAt: GENERATED });
  const byId = evidenceById(evidence);
  assert.deepEqual(legacy, legacyBefore);
  assert.equal(byId.get("angle.descendant.sign").certainty.stableAcrossApplicableWindow, false);
  assert.deepEqual(byId.get("angle.descendant.sign").certainty.signsInWindow, ["Taurus", "Gemini"]);
  assert.equal(evidence.evidence.some((proof) => proof.type === "NATAL_BODY_HOUSE"), false);
  for (const key of ["ascendant", "descendant", "midheaven", "imumCoeli"]) {
    assert.deepEqual(legacy.astronomicalCalculation.angles[key], original.astronomicalCalculation.angles[key], "no astronomical coordinate is changed to hide uncertainty");
  }
});

test("uncertain axes: contradictory opposing metadata cannot declare either sign stable", () => {
  const f = fixture();
  const angles = structuredClone(f.calculation.result.astronomicalCalculation.angles);
  angles.uncertaintyWindow.descendant.signStable = true;
  assert.equal(angleSignWindow(angles, "descendant").signStable, false);
});

test("uncertain axes: no undecidable angle enters a narrative packet or server prefix", () => {
  const f = fixture();
  const plan = buildFullDossierPlan(f.dossier, { aspectChapterMode: "reference" });
  const undecidable = new Set(f.dossier.evidence.filter((proof) => !isEvidenceDeterminateForClaim(proof)).map((proof) => proof.evidenceId));
  for (const section of plan.sections) {
    for (const packet of section.evidencePackets ?? []) for (const ref of packet.evidenceRefs) assert.equal(undecidable.has(ref), false, `${section.sectionId}/${ref}`);
  }
  assert.equal(f.dossier.evidence.some((proof) => proof.evidenceId === "angle.descendant.sign"), true, "source diagnostic fact is preserved");
});

test("uncertain axes: existing unlicensed/wrong astrological facts remain blocking", () => {
  const f = fixture({ timePrecision: "exact" }), dsc = f.byId.get("angle.descendant.sign");
  for (const text of ["Votre Descendant est en Cancer.", "Vénus est en maison 9.", "La Lune forme un trigone avec Mars."]) {
    assert.ok(validateText(f.dossier, dsc, text).issues.some((issue) => issue.code === "undeclared_text_fact"), text);
  }
});

test("uncertain axes: transits to MC/IC are excluded when their signs cross despite stable ASC", async () => {
  const f = fixture({ timeValue: "05:30" });
  const natal = f.calculation.result;
  assert.equal(angleSignCertainty(natal, "ascendant").stableAcrossApplicableWindow, true);
  assert.equal(angleSignCertainty(natal, "midheaven").stableAcrossApplicableWindow, false);
  const state = { persons: [{ id: "fictional-person", ownerUserId: "fictional-user", isPrimary: true }], calculationRuns: [{ id: "fictional-run", ownerUserId: "fictional-user", personId: "fictional-person", methodId: "western-natal", calculatedAt: GENERATED }], calculationArtifacts: [{ ownerUserId: "fictional-user", calculationRunId: "fictional-run", type: "structured_result", payload: natal, hash: "uncertain-axes-regression-fictional" }] };
  const before = structuredClone(state);
  const store = { transact(fn) { return Promise.resolve(fn(state)); } };
  const sky = await getPersonalCurrentSky(store, "fictional-user", { personId: "fictional-person", nowUtc: GENERATED, horizonDays: 7 });
  assert.deepEqual(state, before, "in-memory fixture remains unchanged");
  const contacts = [...sky.current, ...sky.upcoming, ...sky.recent].map((item) => item.contact);
  assert.ok(contacts.some((contact) => ["ASC", "DSC"].includes(contact.natalPoint)), "the stable axis must not disappear with the unstable one");
  assert.ok(contacts.every((contact) => !["MC", "IC"].includes(contact.natalPoint)));
});

// Same public wording as the report, but exclusively fictional structured data.
test("uncertain axes: an explanatory apposition cannot hide the rejected Descendant claim", () => {
  const f = fixture(), dsc = f.byId.get("angle.descendant.sign");
  const text = "Le Descendant, repère symbolique des partenariats, se situe en Gémeaux.";
  assert.deepEqual(detectAstrologicalTextFacts(text), [{ type: "ANGLE_SIGN", angle: "descendant", sign: "Gemini" }]);
  assert.ok(validateText(f.dossier, dsc, text).issues.some((issue) => issue.code === "undeclared_text_fact" && issue.reason === "source_fact_undecidable"));
  const stable = fixture({ timePrecision: "exact" });
  assert.equal(validateText(stable.dossier, stable.byId.get("angle.descendant.sign"), text).ok, true);
  assert.ok(detectAstrologicalTextFacts("Le Descendant (repère symbolique des partenariats) se situe en Gémeaux.").some((fact) => fact.angle === "descendant" && fact.sign === "Gemini"));
});

test("uncertain axes: appositions never erase another placement, aspect or grammatical subject", () => {
  for (const text of ["Le Descendant, Vénus en Balance, se situe en Gémeaux.", "Le Descendant, un carré avec Mars, et Vénus en Gémeaux.", "Le Descendant, puis Vénus en Gémeaux.", "Le Descendant, repère symbolique des partenariats. Vénus en Gémeaux."]) {
    assert.equal(detectAstrologicalTextFacts(text).some((fact) => fact.type === "ANGLE_SIGN" && fact.angle === "descendant" && fact.sign === "Gemini"), false, text);
  }
  assert.ok(detectAstrologicalTextFacts("Le Descendant, repère du lien, se situe en Gémeaux et Vénus en Balance.").some((fact) => fact.angle === "descendant" && fact.sign === "Gemini"));
});

test("uncertain axes: an imported transit to an undecidable angle remains diagnostic, never an authorised narrative fact", () => {
  const f = fixture();
  const sky = { current: [{ resultId: "fictional-angle-transit", status: "CURRENT", contact: { transitBody: "Sun", natalPoint: "DSC", aspectType: "trine", orb: 0.5, reliability: "HIGH" }, timing: { startsAt: "2026-10-31T00:00:00Z", exactAt: "2026-11-01T12:00:00Z", endsAt: "2026-11-03T00:00:00Z" } }], upcoming: [], recent: [] };
  const dossier = buildDossierEvidence({ natalResult: f.calculation.result, currentSky: sky, generatedAt: GENERATED });
  const transit = dossier.evidence.find((proof) => proof.type === "PERSONAL_TRANSIT");
  assert.ok(transit, "the calculation is kept available for diagnostics");
  assert.equal(transit.certainty.stableAcrossApplicableWindow, false);
  const textResult = validateText(dossier, transit, "Le Soleil forme un trigone avec le Descendant.");
  assert.ok(textResult.issues.some((issue) => issue.code === "undeclared_text_fact" && issue.reason === "source_fact_undecidable"));
  const plan = buildFullDossierPlan(dossier, { aspectChapterMode: "reference" });
  assert.ok(plan.sections.every((section) => section.evidencePackets.every((packet) => !packet.evidenceRefs.includes(transit.evidenceId))));
});

test("uncertain axes: conflicting serialized time precision never overrules the birth context", () => {
  const f = fixture();
  const proof = structuredClone(f.byId.get("angle.descendant.sign"));
  proof.certainty = { timePrecision: "exact" };
  const dossier = { evidence: [f.byId.get("birth.identity"), proof] };
  assert.equal(isEvidenceDeterminateForClaim(proof, { timePrecision: "approximate" }), false);
  assert.ok(validateText(dossier, proof, "Votre Descendant est en Gémeaux.").issues.some((issue) => issue.code === "undeclared_text_fact"));
  proof.certainty.stableAcrossApplicableWindow = true;
  assert.equal(isEvidenceDeterminateForClaim(proof, { timePrecision: "approximate" }), false);
});

test("uncertain axes: inconsistent window flags cannot overrule its endpoint signs", () => {
  const f = fixture(), angles = structuredClone(f.calculation.result.astronomicalCalculation.angles);
  angles.uncertaintyWindow.ascendant.signStable = true;
  angles.uncertaintyWindow.descendant.signStable = true;
  assert.equal(angleSignWindow(angles, "ascendant").signStable, false);
  assert.equal(angleSignWindow(angles, "descendant").signStable, false);
  const stable = fixture({ timeMarginMinutes: 10 }).calculation.result.astronomicalCalculation.angles;
  const corrupted = structuredClone(stable);
  delete corrupted.uncertaintyWindow.descendant.signStable;
  assert.equal(angleSignWindow(corrupted, "ascendant").signStable, false);
  delete corrupted.uncertaintyWindow.descendant;
  assert.equal(angleSignWindow(corrupted, "ascendant").signStable, true, "a complete legacy ASC-only window remains usable");
});

for (const precision of ["approximate", "unknown", "interval"]) {
  test(`uncertain axes: a serialized angle transit missing certainty cannot bypass ${precision} context`, () => {
    for (const point of ["ASC", "DSC", "MC", "IC", "ascendant", "descendant", "midheaven", "imumCoeli"]) {
      const proof = { evidenceId: "transit.angle.fixture", type: "PERSONAL_TRANSIT", value: { transitBody: "Sun", natalPoint: point, aspectType: "trine" } };
      const dossier = { evidence: [{ evidenceId: "birth.identity", type: "BIRTH_CONTEXT", value: { timePrecision: precision } }, proof] };
      assert.equal(isEvidenceDeterminateForClaim(proof, { timePrecision: precision }), false);
      assert.ok(validateDossierClaims({ dossierEvidence: dossier, claims: [{ type: "PERSONAL_TRANSIT", transitBody: "Sun", natalPoint: point, aspectType: "trine", evidenceRefs: [proof.evidenceId] }] }).issues.some((issue) => issue.code === "uncertain_factual_claim"));
    }
  });
}

test("uncertain axes: stable window flags cannot certify a nominal sign outside that window", () => {
  const f = fixture({ timeMarginMinutes: 10 });
  const natal = structuredClone(f.calculation.result);
  natal.astronomicalCalculation.angles.descendant.sign = "Cancer";
  assert.equal(angleSignCertainty(natal, "descendant").stableAcrossApplicableWindow, false);
});

test("uncertain axes: ±720 min cannot be certified from matching endpoint signs after a full rotation", () => {
  const f = fixture({ timeMarginMinutes: 720 });
  const natal = f.calculation.result, windows = natal.astronomicalCalculation.angles.uncertaintyWindow;
  assert.equal(windows.ascendant.signAtWindowStart, "Cancer");
  assert.equal(windows.ascendant.signAtWindowEnd, "Cancer");
  assert.equal(natal.astronomicalCalculation.angles.ascendant.sign, "Sagittarius");
  assert.equal(windows.ascendant.signStable, false);
  assert.equal(windows.ascendant.stabilityVerification, "wide_margin_not_certified");
  assert.equal(natal.structuralAstrology.houseUncertainty.housesDecidableWithinMargin, false);
  for (const key of ["ascendant", "descendant", "midheaven", "imumCoeli"]) assert.equal(angleSignCertainty(natal, key).stableAcrossApplicableWindow, false);
  const legacy = structuredClone(natal);
  legacy.astronomicalCalculation.angles.uncertaintyWindow.ascendant.signStable = true;
  delete legacy.astronomicalCalculation.angles.uncertaintyWindow.descendant;
  assert.equal(angleSignCertainty(legacy, "ascendant").stableAcrossApplicableWindow, false, "legacy equal endpoints also require certified coverage");
  assert.equal(f.dossier.evidence.some((proof) => proof.type === "NATAL_BODY_HOUSE"), false);
});

test("uncertain axes: absence of verified sampling never licenses any supported margin above 60 minutes", () => {
  for (const margin of [61, 90, 120, 360, 720]) {
    const f = fixture({ timeMarginMinutes: margin });
    for (const proof of f.dossier.evidence.filter((entry) => entry.type === "ANGLE_SIGN")) assert.equal(proof.certainty.stableAcrossApplicableWindow, false);
  }
});
