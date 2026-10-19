// La méthode à deux hypothèses n'est pas un générateur de deux hypothèses.
//
// Ce fichier teste la GÉNÉRALITÉ : plusieurs figures réelles et synthétiques,
// des comptes d'hypothèses différents, et la phrase d'isolation vérifiée sur
// TOUS les aspects retenus — pas sur ceux qui ont une règle.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { analyseIsolation } from "../src/deliverables/editorialComposition.mjs";
import { detectFigures } from "../src/deliverables/figures.mjs";
import { buildReadingHypotheses } from "../src/deliverables/readingHypotheses.mjs";
import { rulesForEvidence } from "../src/deliverables/interpretationRules.mjs";
import { buildConfigurations } from "../src/deliverables/editorialComposition.mjs";

const THEMES = {
  demonstration: { birthDate: "1979-03-14", timePrecision: "approximate", timeValue: "09:00", timeMarginMinutes: 30, latitude: 45.764, longitude: 4.8357, timeZone: "Europe/Paris", birthPlace: "Lyon, France", placeName: "Lyon, France" },
  tCarre: { birthDate: "1975-09-08", timePrecision: "exact", timeValue: "10:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", birthPlace: "Paris, France", placeName: "Paris, France" },
  grandTrine: { birthDate: "1974-03-11", timePrecision: "exact", timeValue: "10:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", birthPlace: "Paris, France", placeName: "Paris, France" },
  sansFigure: { birthDate: "1970-06-21", timePrecision: "exact", timeValue: "10:30", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris", birthPlace: "Paris, France", placeName: "Paris, France" }
};

function dossier(theme) {
  const calculation = calculateWesternNatalChart(
    { personId: "coverage", coordinateSource: "test_fixture", coordinateConfidence: "verified_fixture", ...theme },
    { calculatedAt: "2026-10-18T00:00:00.000Z", runId: "calc_coverage" }
  );
  return buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
}

function hypothesesDe(dossierEvidence) {
  const figures = detectFigures({ dossierEvidence }).figures;
  const configurations = buildConfigurations({ dossierEvidence, rulesForEvidence });
  return { figures, configurations, ...buildReadingHypotheses({ figures, configurations }) };
}

function aspect(bodyA, bodyB, aspectType, orb, orbLimit) {
  return {
    evidenceId: `aspect.${bodyA.toLowerCase()}.${bodyB.toLowerCase()}.${aspectType}`,
    type: "NATAL_ASPECT",
    value: { bodyA, bodyB, aspectType, orb, orbLimit }
  };
}

// Figure synthétique : apex harmonique et symétrique (4° / 4,5°).
const FIGURE_SYMETRIQUE = {
  evidence: [
    aspect("Sun", "Moon", "opposition", 5, 10),
    aspect("Sun", "Jupiter", "trine", 4, 8),
    aspect("Moon", "Jupiter", "sextile", 4.5, 6),
    aspect("Mars", "Saturn", "opposition", 2, 8)
  ]
};

// Même figure, mais Mars touche Jupiter : l'isolation doit changer de verdict.
const FIGURE_RELIEE = {
  evidence: [
    aspect("Sun", "Moon", "opposition", 5, 10),
    aspect("Sun", "Jupiter", "trine", 4, 8),
    aspect("Moon", "Jupiter", "sextile", 4.5, 6),
    aspect("Mars", "Saturn", "opposition", 2, 8),
    aspect("Mars", "Jupiter", "square", 3, 6)
  ]
};

test("la méthode ne produit pas systématiquement deux hypothèses", () => {
  const resultats = [
    { nom: "démonstration", ...hypothesesDe(dossier(THEMES.demonstration)) },
    { nom: "T-carré", ...hypothesesDe(dossier(THEMES.tCarre)) },
    { nom: "grand trigone", ...hypothesesDe(dossier(THEMES.grandTrine)) },
    { nom: "sans figure", ...hypothesesDe(dossier(THEMES.sansFigure)) },
    { nom: "apex symétrique", ...hypothesesDe(FIGURE_SYMETRIQUE) },
    { nom: "apex relié", ...hypothesesDe(FIGURE_RELIEE) }
  ];
  const comptes = resultats.map((entree) => entree.hypotheses.length);
  // Le compte doit varier, et deux cas au moins ne doivent PAS valoir 2.
  assert.ok(new Set(comptes).size >= 3, `comptes trop uniformes : ${comptes.join(", ")}`);
  assert.ok(comptes.filter((compte) => compte !== 2).length >= 2, `comptes : ${comptes.join(", ")}`);
  // Aucune hypothèse quand il n'y a pas de figure.
  const sansFigure = resultats.find((entree) => entree.nom === "sans figure");
  assert.equal(sansFigure.hypotheses.length, 0);
  assert.equal(sansFigure.figures.length, 0);
});

test("chaque hypothèse cite au moins trois faits calculés et un discriminant", () => {
  for (const dossierEvidence of [dossier(THEMES.demonstration), dossier(THEMES.tCarre), dossier(THEMES.grandTrine), FIGURE_SYMETRIQUE]) {
    for (const hypothese of hypothesesDe(dossierEvidence).hypotheses) {
      assert.ok(hypothese.licence.computedFacts.length >= 3, hypothese.hypothesisId);
      assert.ok(hypothese.discriminator.length > 10, hypothese.hypothesisId);
      assert.ok(hypothese.limits.length >= 1, hypothese.hypothesisId);
    }
  }
});

test("un apex aux orbes symétriques ne fabrique pas de seconde lecture", () => {
  const { hypotheses } = hypothesesDe(FIGURE_SYMETRIQUE);
  assert.equal(hypotheses.length, 1);
  assert.equal(hypotheses[0].kind, "dialogue");
});

test("la phrase d'isolation porte sur TOUS les aspects retenus", () => {
  const dossierEvidence = dossier(THEMES.demonstration);
  const figures = detectFigures({ dossierEvidence }).figures;
  const isolation = analyseIsolation({ dossierEvidence, figures }).byFigure[0];
  assert.equal(isolation.examinedAspects, 5, "les cinq aspects retenus sont examinés");
  assert.ok(isolation.isolated.some((entree) => entree.ref.includes("mars.saturn")));
  assert.ok(isolation.isolated.some((entree) => entree.ref.includes("mercury.venus")));
  assert.match(isolation.statement, /aucun ne touche un corps de cette figure/);
});

test("quand un aspect relie la figure, l'isolation le dit au lieu de la nier", () => {
  const figures = detectFigures({ dossierEvidence: FIGURE_RELIEE }).figures;
  const isolation = analyseIsolation({ dossierEvidence: FIGURE_RELIEE, figures }).byFigure[0];
  assert.equal(isolation.examinedAspects, 5);
  const lien = isolation.linked.find((entree) => entree.ref.includes("mars.jupiter"));
  assert.ok(lien, "le carré Mars–Jupiter doit apparaître comme lien");
  // Seul Jupiter appartient à la figure : Mars est le corps extérieur.
  assert.deepEqual(lien.sharedBodies, ["Jupiter"]);
  assert.match(isolation.statement, /touchent un corps de cette figure/);
  assert.doesNotMatch(isolation.statement, /aucun ne touche/);
});
