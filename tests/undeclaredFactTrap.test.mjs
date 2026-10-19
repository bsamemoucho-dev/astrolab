// Incident de production : `undeclared_text_fact` sur relationships/composition,
// trois fois de suite, puis échec de la commande.
//
// Cause reproduite ici : la THÈSE du dossier est une phrase factuelle
// (« le Soleil oppose la Lune ; Jupiter est en trigone… »). Elle était transmise
// à tous les chapitres, y compris ceux qui ne déclarent pas ces aspects. Un
// chapitre qui reprenait le fil conducteur écrivait alors un fait VRAI mais non
// autorisé pour lui : refus déterministe, correction automatique sans prise (la
// phrase source est identique à chaque essai), deux appels supplémentaires
// payés pour le même constat.
//
// Ce fichier vérifie la correction et, surtout, que le contrôle n'a pas été
// affaibli : un fait non déclaré reste refusé.

import assert from "node:assert/strict";
import test from "node:test";

import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import {
  buildStructuredUserPrompt,
  writeStructuredSectionWithLlm
} from "../src/deliverables/structuredSectionWriter.mjs";

const THEMES = {
  // Thème de la démonstration : figure calculée (opposition Soleil–Lune,
  // trigone Soleil–Jupiter, sextile Lune–Jupiter).
  demonstration: {
    birthDate: "1979-03-14", timePrecision: "approximate", timeValue: "09:00", timeMarginMinutes: 30,
    latitude: 45.764, longitude: 4.8357, timeZone: "Europe/Paris",
    birthPlace: "Lyon, France", placeName: "Lyon, France", country: "FR"
  },
  // Thème qui reproduit exactement la commande en échec : `relationships` y
  // reçoit un bloc « composition », et la thèse nomme des aspects de la figure
  // (Vénus–Saturne, Lune–Vénus, Lune–Saturne) que ce chapitre ne déclare pas.
  composition: {
    birthDate: "1960-07-09", timePrecision: "exact", timeValue: "20:10",
    latitude: 45.76, longitude: 4.83, timeZone: "Europe/Paris",
    birthPlace: "Lyon, France", placeName: "Lyon, France", country: "FR"
  }
};

function planPour(theme) {
  const calculation = calculateWesternNatalChart(
    { personId: "fixture", coordinateSource: "test_fixture", coordinateConfidence: "verified_fixture", ...theme },
    { calculatedAt: "2026-10-18T00:00:00.000Z", runId: "calc_fixture" }
  );
  const evidence = buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
  return { evidence, plan: buildFullDossierPlan(evidence, { aspectChapterMode: "reference" }) };
}

const sectionDe = (plan, sectionId) => plan.sections.find((section) => section.sectionId === sectionId);

// Écrivain simulé : aucune requête réseau, un texte par bloc demandé.
function ecrivainSimule(texte) {
  const calls = [];
  const fn = async (payload) => {
    calls.push(payload.sectionPlan.sectionId);
    return {
      sectionId: payload.sectionPlan.sectionId,
      blocks: (payload.sectionPlan.blockPlans ?? []).map((block) => ({ blockId: block.blockId, text: texte }))
    };
  };
  return { fn, calls };
}

function collecteurDeJournal() {
  const entrees = [];
  return { entrees, logger: { warn: (message, details) => entrees.push({ message, details }) } };
}

test("la thèse factuelle n'est transmise qu'aux chapitres qui peuvent la citer", () => {
  const { plan } = planPour(THEMES.demonstration);
  const synthese = sectionDe(plan, "general_synthesis");
  const relations = sectionDe(plan, "relationships");
  const conclusion = sectionDe(plan, "conclusion");

  assert.ok(plan.editorialPlan.thesis.statement.length > 0);
  // Propriétaire : il déclare les trois aspects de la figure, il reçoit la thèse.
  assert.equal(synthese.ownsThesis, true);
  assert.ok(synthese.editorialThesis, "la synthèse doit recevoir sa propre thèse");
  // `relationships` ne déclare AUCUN des aspects de la figure : la phrase lui
  // était transmise sans qu'il puisse l'écrire. C'était le piège.
  assert.equal(relations.ownsThesis, false);
  assert.equal(relations.editorialThesis, null);
  const payloadRelations = JSON.parse(buildStructuredUserPrompt({ sectionPlan: relations }));
  assert.equal(payloadRelations.editorial?.thesis ?? null, null, "aucune thèse factuelle ne doit être transmise");
  // La conclusion déclare déjà tous ces faits : elle peut garder la phrase.
  assert.ok(conclusion.editorialThesis, "un chapitre qui déclare tous les faits garde la thèse");
});

test("le fait refusé est nommé en clair, dans le journal et dans la correction", async () => {
  const { evidence, plan } = planPour(THEMES.composition);
  const relations = sectionDe(plan, "relationships");
  assert.equal(relations.blockPlans.length, 1);
  assert.equal(relations.blockPlans[0].blockId, "composition", "le scénario doit reproduire le bloc de production");

  const these = plan.editorialPlan.thesis.statement;
  const { fn } = ecrivainSimule(these);
  const { logger, entrees } = collecteurDeJournal();

  const erreur = await writeStructuredSectionWithLlm({
    dossierEvidence: evidence,
    sectionPlan: relations,
    options: { structuredWriterFn: fn, logger }
  }).then(() => null, (error) => error);

  assert.ok(erreur, "un fait non déclaré doit être refusé");
  assert.equal(erreur.code, "structured_section_validation_stalled");
  assert.equal(erreur.sectionId, "relationships");
  assert.equal(erreur.blockId, "composition");
  assert.ok(erreur.refusedFacts.length >= 1, "le refus doit nommer au moins un fait");
  for (const fait of erreur.refusedFacts) {
    assert.match(fait, /^(le |la |Jupiter|Saturne|Mercure|Vénus|Mars|Uranus|Neptune|Pluton|Chiron|l'Ascendant|le Descendant|la maison)/);
  }

  // Le journal d'exploitation porte désormais `factText` : plus de `[Object]`.
  const constats = entrees
    .filter((entree) => entree.message.includes("validation failed"))
    .flatMap((entree) => entree.details.findings ?? []);
  assert.ok(constats.length >= 1);
  for (const constat of constats) {
    assert.equal(constat.code, "undeclared_text_fact");
    assert.equal(typeof constat.factText, "string");
    assert.ok(constat.factText.length > 0, "chaque refus doit être lisible");
  }
});

test("un refus identique ne consomme que deux appels, jamais trois", async () => {
  const { evidence, plan } = planPour(THEMES.composition);
  const relations = sectionDe(plan, "relationships");
  const { fn, calls } = ecrivainSimule(plan.editorialPlan.thesis.statement);

  const erreur = await writeStructuredSectionWithLlm({
    dossierEvidence: evidence,
    sectionPlan: relations,
    options: { structuredWriterFn: fn }
  }).then(() => null, (error) => error);

  assert.ok(erreur);
  assert.equal(erreur.code, "structured_section_validation_stalled");
  assert.equal(calls.length, 2, `deux appels attendus, ${calls.length} observés`);
  assert.equal(erreur.attempts, 2);
  assert.match(erreur.message, /arrêt avant un appel supplémentaire/);
});

test("un texte sans fait astrologique est accepté du premier coup", async () => {
  const { evidence, plan } = planPour(THEMES.composition);
  const relations = sectionDe(plan, "relationships");
  const { fn, calls } = ecrivainSimule("Cette dimension se lit comme une piste symbolique à éprouver, sans certitude.");

  const resultat = await writeStructuredSectionWithLlm({
    dossierEvidence: evidence,
    sectionPlan: relations,
    options: { structuredWriterFn: fn }
  });

  assert.equal(resultat.validation.ok, true);
  assert.equal(calls.length, 1);
});

test("un fait inventé reste refusé : le contrôle n'a pas été élargi", async () => {
  const { evidence, plan } = planPour(THEMES.composition);
  const relations = sectionDe(plan, "relationships");
  // Saturne n'est ni déclaré pour ce chapitre, ni dans le Bélier pour ce thème.
  const { fn, calls } = ecrivainSimule("Saturne en Bélier colore votre manière d'entrer en relation.");

  const erreur = await writeStructuredSectionWithLlm({
    dossierEvidence: evidence,
    sectionPlan: relations,
    options: { structuredWriterFn: fn }
  }).then(() => null, (error) => error);

  assert.ok(erreur, "un fait inventé ne doit jamais passer");
  assert.equal(erreur.code, "structured_section_validation_stalled");
  assert.ok(
    erreur.refusedFacts.some((fait) => /Saturne en Bélier/.test(fait)),
    `fait refusé inattendu : ${JSON.stringify(erreur.refusedFacts)}`
  );
  assert.equal(calls.length, 2);
});
