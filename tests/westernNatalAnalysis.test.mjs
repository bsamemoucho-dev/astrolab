import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";

const courbevoieInput = Object.freeze({
  personId: "person_courbevoie",
  birthDate: "1986-01-02",
  timeValue: "16:42",
  timePrecision: "exact",
  birthPlace: "Courbevoie, France",
  latitude: 48.89672,
  longitude: 2.25666,
  timeZone: "Europe/Paris",
  coordinateSource: "test_fixture",
  coordinateConfidence: "verified_fixture"
});

function chart(input = {}) {
  return calculateWesternNatalChart({
    ...courbevoieInput,
    ...input
  }).result;
}

function factor(analysis, id) {
  return analysis.factors.find((entry) => entry.id === id);
}

function relation(analysis, relationType, factorA, factorB) {
  return analysis.relations.find(
    (entry) => entry.relation === relationType && entry.factorA === factorA && entry.factorB === factorB
  );
}

test("western natal analysis keeps astronomy unchanged while adding a prototype layer", () => {
  const result = chart();
  const analysis = result.analysisPrototype;

  assert.equal(result.astronomicalCalculation.bodies.length, 7);
  assert.equal(result.astronomicalCalculation.bodies.find((body) => body.body === "Sun").sign, "Capricorn");
  assert.equal(result.astronomicalCalculation.angles.ascendant.sign, "Cancer");
  assert.equal(result.astronomicalCalculation.angles.midheaven.sign, "Pisces");

  assert.equal(analysis.schema, "astrolab.western_natal.analysis_prototype");
  assert.equal(analysis.status, "analysis_prototype_no_interpretive_rule_version");
  assert.equal(analysis.layers.factsCalculated, true);
  assert.equal(analysis.layers.importantFactors, "undetermined_without_validated_rule");
  assert.equal(analysis.layers.factorRelations, "calculated_structural_relations_only");
  assert.equal(analysis.layers.documentedInterpretation, "not_available_no_rule_version");
  assert.equal(analysis.layers.synthesis, "limited_to_established_calculated_facts");
});

test("important factors are listed without inventing dominance or interpretation", () => {
  const analysis = chart().analysisPrototype;
  const factorIds = analysis.factors.map((entry) => entry.id);

  for (const body of ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
    assert.ok(factorIds.includes(`factor.body.${body}`));
  }
  assert.ok(factorIds.includes("factor.angle.ascendant"));
  assert.ok(factorIds.includes("factor.angle.midheaven"));

  for (const entry of analysis.factors) {
    assert.equal(entry.importance.level, "undetermined");
    assert.equal(entry.importance.reason, "importance non déterminée selon la méthode actuelle");
    assert.equal(entry.importance.rule.status, "rule_version_not_active");
    assert.equal(entry.importance.rule.source, null);
    assert.equal(entry.interpretiveStatus, "not_interpreted_no_rule_version");
  }

  assert.ok(factor(analysis, "factor.body.Sun").calculatedFacts.some((fact) => fact.kind === "sign_placement"));
  assert.ok(factor(analysis, "factor.body.Sun").calculatedFacts.some((fact) => fact.kind === "whole_sign_house_placement"));
});

test("relations distinguent la geometrie mesuree, la structure retenue et l'interpretation absente", () => {
  const analysis = chart().analysisPrototype;
  const sunSign = relation(analysis, "placed_in_sign", "factor.body.Sun", "sign.Capricorn");
  const sunHouse = relation(analysis, "placed_in_whole_sign_house", "factor.body.Sun", "house.7");
  const sunMoonGeometry = analysis.relations.find(
    (entry) =>
      entry.relation === "geometric_angular_distance" &&
      entry.factorA === "factor.body.Sun" &&
      entry.factorB === "factor.body.Moon"
  );

  assert.equal(sunSign.value.sign, "Capricorn");
  assert.equal(sunSign.detectionRule.ruleVersionId, null);
  assert.equal(sunSign.interpretiveStatus, "not_interpreted_no_rule_version");

  assert.equal(sunHouse.value.houseNumber, 7);
  assert.equal(sunHouse.value.houseSign, "Capricorn");
  assert.equal(sunHouse.detectionRule.status, "calculated_relation_no_interpretive_rule");

  assert.equal(sunMoonGeometry.value.activeAspect, false);
  assert.ok(sunMoonGeometry.value.angularDistance >= 0);
  assert.equal(sunMoonGeometry.detectionRule.ruleVersionId, null);
  assert.equal(
    sunMoonGeometry.detectionRule.status,
    "relation géométrique mesurée — décision d'orbe portée par structuralAstrology.aspects"
  );

  // Les aspects retenus portent, eux, la version de convention : c'est la
  // seule couche où une relation angulaire devient une structure du thème.
  const retained = analysis.relations.filter((entry) => entry.detectionRule.ruleVersionId === "lastro-aspects@1.0.0");
  assert.ok(retained.length > 0);
  assert.ok(retained.every((entry) => entry.relation.startsWith("retained_aspect_")));
  assert.ok(retained.every((entry) => entry.value.orbUsed > 0));
  assert.ok(retained.every((entry) => entry.detectionRule.source === "lastro_convention"));
  // Aucune signification n'est produite par le moteur.
  assert.ok(retained.every((entry) => entry.interpretiveStatus === "not_interpreted_no_rule_version"));
});

test("analysis explicitly separates fact, rule, interpretation and synthesis", () => {
  const analysis = chart().analysisPrototype;
  const allFacts = analysis.factors.flatMap((entry) => entry.calculatedFacts);

  assert.ok(allFacts.length > 0);
  assert.ok(allFacts.every((fact) => fact.layer === "calculated_fact"));
  const structural = analysis.relations.filter((entry) => entry.detectionRule.ruleVersionId !== null);
  assert.ok(structural.length > 0);
  assert.ok(structural.every((entry) => entry.detectionRule.ruleVersionId === "lastro-aspects@1.0.0"));
  assert.ok(
    analysis.relations
      .filter((entry) => entry.detectionRule.ruleVersionId === null)
      .every((entry) => entry.detectionRule.source === null)
  );
  assert.deepEqual(analysis.guardrails.structuralConventionsActive, ["lastro-aspects@1.0.0"]);
  assert.ok(analysis.relations.every((entry) => entry.interpretiveStatus === "not_interpreted_no_rule_version"));
  assert.equal(analysis.synthesis.status, "limited");
  assert.equal(analysis.guardrails.separatesFactRuleInterpretationSynthesis, true);
  assert.equal(analysis.guardrails.sourceCountingIsTruthScoring, false);
  assert.equal(analysis.guardrails.aiNarrativeGenerated, false);
  assert.equal(analysis.guardrails.ruleVersionsCreated, false);
});

test("unknown birth time analysis produces partial facts without invented timed factors", () => {
  const result = chart({ timePrecision: "unknown", timeValue: "" });
  const analysis = result.analysisPrototype;

  assert.equal(result.astronomicalCalculation.angles.ascendant, null);
  assert.equal(factor(analysis, "factor.angle.ascendant"), undefined);
  assert.equal(factor(analysis, "factor.angle.midheaven"), undefined);
  assert.ok(factor(analysis, "factor.body.Sun"));
  assert.ok(analysis.overview.established.includes("Ascendant, MC et maisons non calculés pour cette précision d'heure."));
  assert.ok(analysis.uncertainties.some((entry) => entry.topic === "time_dependent_outputs"));
  assert.ok(analysis.uncertainties.some((entry) => entry.affectedOutputs?.includes("ascendant")));
  assert.ok(analysis.relations.every((entry) => entry.relation !== "placed_in_whole_sign_house"));
});
