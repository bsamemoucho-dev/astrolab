// Données parentales : rien ne doit être transmis, stocké ni transformé en
// preuve sans date de naissance exploitable.
//
// Contexte : le bloc « Parents » du formulaire public est masqué parce que le
// dossier payant ne contient aucune section transgénérationnelle. Le risque
// résiduel est un envoi direct (script, page modifiée) qui déposerait des noms,
// des dates ou des villes de tiers sans qu'aucun calcul ne puisse en sortir.
// Ces tests figent la règle : pas de date, pas de donnée parentale.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";

const RACINE = path.resolve(import.meta.dirname, "..");

const THEME = {
  personId: "person_parents",
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

function evidenceAvecParents(parents) {
  const calculation = calculateWesternNatalChart(THEME, {
    calculatedAt: "2026-10-18T00:00:00.000Z",
    runId: "calc_parents"
  });
  return buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    parentContext: { parents },
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
}

test("aucune preuve parentale n'est créée à partir d'un parent sans date de naissance", () => {
  const evidence = evidenceAvecParents([
    { role: "mother", label: "Nadira", birthDate: null, birthPlace: "Bouillante" },
    { role: "father", label: "Karim", birthDate: "", birthPlace: "Roubaix" }
  ]);
  assert.equal(
    evidence.evidence.some((item) => item.type === "PARENT_CONTEXT"),
    false,
    "un nom et une ville ne suffisent pas : aucune preuve parentale ne doit exister"
  );
});

test("une liste de parents vide ne crée aucune preuve parentale", () => {
  const evidence = evidenceAvecParents([]);
  assert.equal(evidence.evidence.some((item) => item.type === "PARENT_CONTEXT"), false);
  // Le socle natal reste complet : la règle ne retire rien au calcul personnel.
  assert.ok(evidence.evidence.some((item) => item.type === "NATAL_BODY_SIGN"));
});

test("un parent daté produit toujours une preuve parentale (non-régression)", () => {
  const evidence = evidenceAvecParents([
    { role: "mother", label: "Nadira", birthDate: "1955-06-02", birthPlace: "Bouillante" }
  ]);
  const preuve = evidence.evidence.find((item) => item.type === "PARENT_CONTEXT");
  assert.ok(preuve, "un parent daté doit rester exploitable");
  assert.equal(preuve.value.parents.length, 1);
  assert.equal(preuve.provenance.reliability, "USER_PROVIDED");
});

// Les deux gardes côté code : le service (ce qui est stocké) et le client (ce qui
// est envoyé). Le test est statique faute de pouvoir importer du code navigateur,
// mais il empêche la garde de disparaître silencieusement.
test("le service et le formulaire refusent tous deux un parent sans date", () => {
  const service = readFileSync(path.join(RACINE, "src/models/fullDossierService.mjs"), "utf8");
  const blocService = service.match(/function normalizeParents\([\s\S]*?\n}/)?.[0] ?? "";
  assert.match(blocService, /cleanString\(entry\.birthDate\)/, "le service doit exiger une date de naissance");

  const client = readFileSync(path.join(RACINE, "public/app.js"), "utf8");
  const blocClient = client.match(/function deliverableParentsFromForm\([\s\S]*?\n}/)?.[0] ?? "";
  assert.match(blocClient, /if \(!birthDate\) return;/, "le formulaire doit cesser d'envoyer un parent sans date");
});
