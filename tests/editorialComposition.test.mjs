// Composition éditoriale : quelles configurations la géométrie autorise-t-elle
// à croiser, et lesquelles doivent être refusées.
//
// Règle du commanditaire : un croisement n'est permis que si les configurations
// partagent un corps calculé OU appartiennent à une même figure détectée. Tout
// le reste reçoit une réponse explicite — jamais une convergence de confort.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import {
  COMPOSITION_CONVENTIONS,
  composeEditorialMaterial,
  composeRelations
} from "../src/deliverables/editorialComposition.mjs";
import { detectFigures, FIGURE_CONVENTIONS } from "../src/deliverables/figures.mjs";
import { rulesForEvidence } from "../src/deliverables/interpretationRules.mjs";

const PARIS = {
  birthPlace: "Paris, France",
  placeName: "Paris, France",
  country: "FR",
  latitude: 48.8566,
  longitude: 2.3522,
  timeZone: "Europe/Paris",
  coordinateSource: "test_fixture",
  coordinateConfidence: "verified_fixture"
};

// Thèmes de référence, calculés localement, sans réseau.
export const THEMES = {
  demonstration: { birthDate: "1979-03-14", timePrecision: "approximate", timeValue: "09:00", timeMarginMinutes: 30, latitude: 45.764, longitude: 4.8357, timeZone: "Europe/Paris", birthPlace: "Lyon, France", placeName: "Lyon, France" },
  tCarre: { birthDate: "1975-09-08", timePrecision: "exact", timeValue: "10:30", ...PARIS },
  grandTrine: { birthDate: "1974-03-11", timePrecision: "exact", timeValue: "10:30", ...PARIS },
  sansFigure: { birthDate: "1970-06-21", timePrecision: "exact", timeValue: "10:30", ...PARIS }
};

export function dossierPour(theme) {
  const calculation = calculateWesternNatalChart(
    { personId: "fixture", coordinateSource: "test_fixture", coordinateConfidence: "verified_fixture", ...theme },
    { calculatedAt: "2026-10-18T00:00:00.000Z", runId: "calc_fixture" }
  );
  return buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
}

function figuresPour(theme) {
  return detectFigures({ dossierEvidence: dossierPour(theme) }).figures;
}

test("la figure Soleil–Lune–Jupiter est détectée, avec ses orbes et son membre le plus serré", () => {
  const figures = figuresPour(THEMES.demonstration);
  assert.equal(figures.length, 1, "une seule figure sur ce thème");
  const figure = figures[0];
  assert.equal(figure.type, "apex_on_opposition");
  assert.equal(figure.mode, "harmonic");
  assert.equal(figure.conventionId, FIGURE_CONVENTIONS.apexOnOpposition.ruleId);
  assert.deepEqual(figure.bodies.opposition, ["Sun", "Moon"]);
  assert.equal(figure.bodies.apex, "Jupiter");
  assert.equal(figure.members.length, 3);
  assert.equal(figure.tightestMemberId, "aspect.moon.jupiter.sextile");
  assert.match(figure.proof, /Jupiter/);
  // Chaque membre garde son orbe calculé : la figure n'invente aucune mesure.
  for (const membre of figure.members) {
    assert.equal(typeof membre.orb, "number");
    assert.ok(membre.orb >= 0);
  }
});

test("un T-carré est reconnu comme figure dure, un grand trigone comme figure harmonique", () => {
  const dur = figuresPour(THEMES.tCarre).find(
    (figure) => figure.type === "apex_on_opposition" && figure.mode === "hard"
  );
  assert.ok(dur, "le thème de 1975 doit produire une figure dure");
  assert.equal(dur.apexAspects.toA, "square");
  assert.equal(dur.apexAspects.toB, "square");

  const trigones = figuresPour(THEMES.grandTrine).filter((figure) => figure.type === "grand_trine");
  assert.ok(trigones.length >= 1, "le thème de 1974 doit produire un grand trigone");
  assert.equal(trigones[0].members.length, 3);
  assert.equal(trigones[0].conventionId, FIGURE_CONVENTIONS.grandTrine.ruleId);
});

test("un thème sans figure n'en fabrique aucune", () => {
  const figures = figuresPour(THEMES.sansFigure);
  assert.deepEqual(figures, []);
});

test("les seuls croisements produits sont ceux que la géométrie autorise", () => {
  const dossierEvidence = dossierPour(THEMES.demonstration);
  const material = composeEditorialMaterial({ dossierEvidence, rulesForEvidence });
  assert.equal(material.configurations.length, 5);
  assert.equal(material.relations.length, 3, "les trois paires de la figure");
  for (const relation of material.relations) {
    assert.equal(relation.kind, "figure_third_term");
    assert.ok(relation.conventionId);
    assert.ok(relation.articulation.length > 20, "chaque relation est articulée avec des faits calculés");
    // Chaque relation cite les preuves qu'elle croise ET les membres de la figure.
    for (const ref of relation.evidenceRefs) assert.ok(ref.startsWith("aspect."));
    assert.deepEqual(
      relation.figureMembers.map((membre) => membre.aspectId).sort(),
      ["aspect.moon.jupiter.sextile", "aspect.sun.jupiter.trine", "aspect.sun.moon.opposition"]
    );
  }
});

test("le contre-exemple obligatoire est refusé : Mars–Saturne × Mercure–Vénus", () => {
  const material = composeEditorialMaterial({
    dossierEvidence: dossierPour(THEMES.demonstration),
    rulesForEvidence
  });
  const refus = material.rejected.find((entree) =>
    entree.memberConfigs.some((id) => id.includes("mars.saturn")) &&
    entree.memberConfigs.some((id) => id.includes("mercury.venus"))
  );
  assert.ok(refus, "aucun croisement ne doit être produit entre ces deux configurations");
  assert.equal(refus.message, "Aucune relation astrologique directe suffisamment étayée pour ce croisement.");
  assert.equal(refus.conventionId, COMPOSITION_CONVENTIONS.noRelation.ruleId);
});

test("le croisement Soleil–Lune × Mars–Saturne est refusé lui aussi : pas de corps partagé", () => {
  const material = composeEditorialMaterial({
    dossierEvidence: dossierPour(THEMES.demonstration),
    rulesForEvidence
  });
  const produit = material.relations.some((relation) =>
    relation.evidenceRefs.some((ref) => ref.includes("mars.saturn")) &&
    relation.evidenceRefs.some((ref) => ref.includes("sun.moon"))
  );
  assert.equal(produit, false);
});

test("deux configurations qui partagent un corps sont croisées, même hors figure", () => {
  // Mercure–Vénus et Soleil–Mercure partagent Mercure : le croisement est licite
  // par la convention « corps partagé », sans aucune figure.
  const configurations = [
    { configId: "config:a", evidenceRef: "aspect.mercury.venus.sextile", bodyA: "Mercury", bodyB: "Venus", aspectType: "sextile", category: "support", motif: "parole" },
    { configId: "config:b", evidenceRef: "aspect.sun.mercury.conjunction", bodyA: "Sun", bodyB: "Mercury", aspectType: "conjunction", category: "tension", motif: null }
  ];
  const { relations } = composeRelations({ configurations, figures: [] });
  assert.equal(relations.length, 1);
  assert.equal(relations[0].kind, "shared_body");
  assert.deepEqual(relations[0].sharedBodies, ["Mercury"]);
  assert.match(relations[0].articulation, /Mercure/);
});

test("sans corps partagé ni figure, la réponse est un refus explicite", () => {
  const configurations = [
    { configId: "config:a", evidenceRef: "aspect.mars.saturn.opposition", bodyA: "Mars", bodyB: "Saturn", aspectType: "opposition", category: "tension" },
    { configId: "config:b", evidenceRef: "aspect.mercury.venus.sextile", bodyA: "Mercury", bodyB: "Venus", aspectType: "sextile", category: "support" }
  ];
  const { relations, rejected } = composeRelations({ configurations, figures: [] });
  assert.equal(relations.length, 0);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].message, "Aucune relation astrologique directe suffisamment étayée pour ce croisement.");
});

test("la composition est déterministe : deux exécutions donnent le même résultat", () => {
  const premier = composeEditorialMaterial({ dossierEvidence: dossierPour(THEMES.demonstration), rulesForEvidence });
  const second = composeEditorialMaterial({ dossierEvidence: dossierPour(THEMES.demonstration), rulesForEvidence });
  assert.equal(JSON.stringify(premier), JSON.stringify(second));
});

test("les figures et les relations restent étiquetées comme conventions", () => {
  assert.equal(FIGURE_CONVENTIONS.apexOnOpposition.kind, "GEOMETRIC_STRUCTURE");
  assert.equal(COMPOSITION_CONVENTIONS.figureThirdTerm.kind, "EDITORIAL_CONVENTION");
  assert.match(COMPOSITION_CONVENTIONS.sharedBody.description, /n'attribue aucune signification nouvelle/i);
  assert.match(COMPOSITION_CONVENTIONS.figureThirdTerm.description, /troisième terme/i);
  assert.match(COMPOSITION_CONVENTIONS.figureThirdTerm.description, /serrage des orbes/i);
});
