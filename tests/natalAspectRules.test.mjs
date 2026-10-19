// Règles d'aspect natal — expérimentation ciblée.
//
// Cinq règles seulement, pour les cinq aspects réellement présents dans le thème
// de référence. Le but n'est pas de remplir une matrice mais de vérifier qu'avec
// des preuves et des thèmes, trois chapitres aujourd'hui absents se mettent à
// exister : tensions intérieures, ressources complémentaires, aspects majeurs.
//
// Deux garde-fous sont testés ici parce qu'ils ont déjà failli céder :
//   - une règle sans `scope` ne doit pas MASQUER une règle relationnelle de même
//     identifiant (la déduplication garde la première occurrence) ;
//   - une preuve ne doit pas être à la fois primaire et secondaire dans le même
//     chapitre (le validateur refuserait la réutilisation comme interprétation
//     principale).

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { detectAstrologicalTextFacts } from "../src/deliverables/factualClaimsValidator.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import {
  INTERPRETATION_LIBRARY_VERSION,
  INTERPRETATION_RULES,
  RELATIONAL_COMMUNICATION_SCOPE,
  interpretationRuleById,
  ruleMatchesEvidence,
  rulesForEvidence
} from "../src/deliverables/interpretationRules.mjs";

// Thème de référence de l'expérimentation (fictif, calculé localement).
const THEME = {
  personId: "person_aspects",
  birthDate: "1979-03-14",
  timePrecision: "approximate",
  timeValue: "09:00",
  timeMarginMinutes: 30,
  birthPlace: "Lyon, France",
  country: "FR",
  latitude: 45.764,
  longitude: 4.8357,
  timeZone: "Europe/Paris",
  coordinateSource: "test_fixture",
  coordinateConfidence: "unverified"
};

const NOUVELLES_REGLES = [
  ["western.natal.aspect.moon_jupiter.sextile@1", "support"],
  ["western.natal.aspect.mars_saturn.opposition@1", "tension"],
  ["western.natal.aspect.mercury_venus.sextile@1", "support"],
  ["western.natal.aspect.sun_moon.opposition@1", "tension"],
  ["western.natal.aspect.sun_jupiter.trine@1", "support"]
];

function planDuThemeReference() {
  const calculation = calculateWesternNatalChart(THEME, {
    calculatedAt: "2026-10-18T00:00:00.000Z",
    runId: "calc_aspects"
  });
  const dossierEvidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
  return { dossierEvidence, plan: buildFullDossierPlan(dossierEvidence) };
}

function chapitre(plan, sectionId) {
  return plan.sections.find((section) => section.sectionId === sectionId);
}

function estEcrivable(section) {
  const blocs = (section.blockPlans ?? []).length;
  const regles = (section.allowedInterpretationRuleRefs ?? []).length;
  const preuves = (section.primaryEvidenceRefs ?? []).length + (section.secondaryEvidenceRefs ?? []).length;
  return blocs > 0 && regles > 0 && preuves > 0;
}

test("les cinq règles d'aspect du thème existent, avec une convention explicite", () => {
  assert.equal(INTERPRETATION_LIBRARY_VERSION, "lastro-interpretation-library@0.3.0");
  for (const [ruleId, categorie] of NOUVELLES_REGLES) {
    const regle = interpretationRuleById(ruleId);
    assert.ok(regle, `${ruleId} doit exister`);
    assert.equal(regle.evidenceType, "NATAL_ASPECT");
    assert.equal(regle.scope, undefined, "une règle d'axe natal ne doit pas porter de scope");
    assert.ok(Array.isArray(regle.themes) && regle.themes.length >= 2, `${ruleId} doit porter au moins deux thèmes`);
    assert.ok(
      regle.categories[0].includes(categorie === "tension" ? "aspect_tension" : "aspect_support"),
      `${ruleId} doit être rangée dans la catégorie ${categorie}`
    );
    for (const theme of regle.themes) {
      assert.ok(theme.trim().length > 12, `thème trop vague dans ${ruleId} : « ${theme} »`);
      assert.doesNotMatch(theme, /sera|va se produire|diagnostic|guérison|certain/i);
    }
  }
});

test("aucune règle relationnelle n'est masquée par une règle de même identifiant", () => {
  // `western.natal.mercury_venus.sextile@1` (scope communication) existait avant
  // l'expérimentation ; la nouvelle règle porte donc un identifiant distinct.
  const relationnelle = interpretationRuleById("western.natal.mercury_venus.sextile@1");
  assert.ok(relationnelle, "la règle relationnelle Mercury–Vénus doit toujours exister");
  assert.deepEqual(relationnelle.scope, [RELATIONAL_COMMUNICATION_SCOPE]);

  const preuve = { type: "NATAL_ASPECT", value: { bodyA: "Mercury", bodyB: "Venus", aspectType: "sextile" } };
  const pourLAxeNatal = rulesForEvidence(preuve).map((rule) => rule.ruleId);
  const pourLAxeRelations = rulesForEvidence(preuve, { scope: RELATIONAL_COMMUNICATION_SCOPE })
    .filter((rule) => Array.isArray(rule.scope))
    .map((rule) => rule.ruleId);
  assert.ok(pourLAxeNatal.includes("western.natal.aspect.mercury_venus.sextile@1"));
  assert.ok(!pourLAxeNatal.includes("western.natal.mercury_venus.sextile@1"));
  assert.ok(pourLAxeRelations.includes("western.natal.mercury_venus.sextile@1"));
});

test("les identifiants de règles restent uniques dans la bibliothèque", () => {
  const ids = INTERPRETATION_RULES.map((rule) => rule.ruleId);
  assert.equal(new Set(ids).size, ids.length, "deux règles partagent un identifiant");
});

test("les trois chapitres d'aspects ne sont plus écartés", () => {
  const { plan } = planDuThemeReference();
  for (const sectionId of ["internal_tensions", "supporting_resources", "major_aspects"]) {
    const section = chapitre(plan, sectionId);
    assert.ok(section, `${sectionId} doit exister dans le plan`);
    assert.ok(estEcrivable(section), `${sectionId} doit devenir écrivable`);
    assert.ok(section.evidencePackets.length > 0, `${sectionId} doit recevoir des preuves`);
  }
});

// Depuis la couche éditoriale, un chapitre de catégorie DÉVELOPPE sa catégorie
// et peut CITER (profondeur « reference ») les configurations qu'il croise dans
// une figure calculée. L'ancien invariant (« seulement des tensions ») est
// remplacé par celui-ci, plus précis.
test("chaque paquet développé porte sa règle et ses concepts ; les citations restent des citations", () => {
  const { plan } = planDuThemeReference();
  for (const sectionId of ["internal_tensions", "supporting_resources", "major_aspects"]) {
    const section = chapitre(plan, sectionId);
    const developpes = section.evidencePackets.filter((packet) => packet.interpretationDepth === "primary");
    const cites = section.evidencePackets.filter((packet) => packet.interpretationDepth === "reference");
    assert.ok(developpes.length > 0, `${sectionId} doit développer au moins une configuration`);
    for (const packet of developpes) {
      assert.ok(packet.themes.length >= 2, `${sectionId}/${packet.packetId} doit porter des thèmes`);
      assert.ok(packet.interpretationRuleRefs.length >= 1, "chaque paquet développé cite sa règle");
    }
    // Une citation ne porte pas de développement : c'est le principe même.
    for (const packet of cites) {
      assert.ok(packet.interpretationRuleRefs.length >= 1);
    }
  }
});

test("ce que les chapitres de catégorie développent respecte leur catégorie", () => {
  const { plan } = planDuThemeReference();
  const DEVELOPPES = (sectionId) =>
    chapitre(plan, sectionId).evidencePackets
      .filter((packet) => packet.interpretationDepth === "primary")
      .map((packet) => packet.claims[0].aspectType);
  const tensions = new Set(["conjunction", "square", "opposition"]);
  for (const type of DEVELOPPES("internal_tensions")) assert.ok(tensions.has(type), `tension inattendue : ${type}`);
  for (const type of DEVELOPPES("supporting_resources")) assert.ok(!tensions.has(type), `soutien attendu, reçu : ${type}`);
});

test("en mode narratif, les aspects majeurs couvrent exactement ce que les deux catégories développent", () => {
  const { plan } = planDuThemeReference();
  const developpes = (sectionId) =>
    chapitre(plan, sectionId).evidencePackets.filter((packet) => packet.interpretationDepth === "primary").length;
  const majeurs = chapitre(plan, "major_aspects").evidencePackets.filter(
    (packet) => packet.claims[0]?.type === "NATAL_ASPECT"
  ).length;
  assert.equal(majeurs, developpes("internal_tensions") + developpes("supporting_resources"));
});

test("aucune preuve n'est à la fois primaire et secondaire dans un même chapitre", () => {
  const { plan } = planDuThemeReference();
  for (const section of plan.sections) {
    const primaires = new Set(section.primaryEvidenceRefs ?? []);
    for (const ref of section.secondaryEvidenceRefs ?? []) {
      assert.ok(!primaires.has(ref), `${section.sectionId} : ${ref} est à la fois primaire et secondaire`);
    }
  }
});

test("un aspect absent du thème ne produit aucune règle appliquée", () => {
  // Le carré Soleil–Saturne n'existe pas dans ce thème : la règle d'axe natal
  // Mercure–Mars (autre aspect non présent) ne doit jamais apparaître.
  const { plan } = planDuThemeReference();
  const references = plan.sections.flatMap((section) => section.evidencePackets.flatMap((packet) => packet.interpretationRuleRefs));
  assert.ok(!references.includes("western.natal.mercury_mars.conjunction@1"));
  const regleAbsente = interpretationRuleById("western.natal.aspect.moon_jupiter.sextile@1");
  assert.equal(
    ruleMatchesEvidence(regleAbsente, { type: "NATAL_ASPECT", value: { bodyA: "Moon", bodyB: "Jupiter", aspectType: "square" } }),
    false
  );
});

test("la phrase déterministe du serveur est grammaticale et reste vérifiable", () => {
  const { plan } = planDuThemeReference();
  const prefixes = plan.sections.flatMap((section) => (section.blockPlans ?? []).map((block) => block.deterministicPrefix ?? ""));
  const avecLune = prefixes.find((prefix) => prefix.includes("opposition avec la Lune"));
  assert.ok(avecLune, "le serveur doit écrire « avec la Lune », jamais « avec Lune »");
  for (const prefix of prefixes.filter(Boolean)) {
    assert.doesNotMatch(prefix, /avec (Lune|Soleil)\./);
  }
  // La phrase reste reconnue par le détecteur : la correction grammaticale ne
  // doit pas créer un angle mort dans le contrôle des faits.
  const faits = detectAstrologicalTextFacts("Le Soleil forme une opposition avec la Lune.");
  assert.deepEqual(faits, [{ type: "ASPECT", bodyA: "Sun", bodyB: "Moon", aspectType: "opposition" }]);
});
