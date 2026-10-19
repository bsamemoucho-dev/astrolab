// Trois garde-fous ajoutés après la comparaison :
//   1. un croisement affirmé dans le texte doit être licencié par la géométrie ;
//   2. « Aspects majeurs » devient une annexe de référence (table calculée) ;
//   3. la mesure de recopie est calibrée, et la migration sémantique est suivie.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { detectCrossedClaims, isCrossingLicensed, INTERACTION_MARKERS } from "../src/deliverables/crossedClaims.mjs";
import { buildDossierEvidence } from "../src/deliverables/dossierEvidence.mjs";
import { mots, verbatimDependency } from "../src/deliverables/editorialDiagnostics.mjs";
import { buildFullDossierPlan } from "../src/deliverables/fullDossierPlan.mjs";
import { detectAstrologicalTextFacts, validateStructuredSection } from "../src/deliverables/factualClaimsValidator.mjs";
import { aspectIdentifier } from "../src/deliverables/figures.mjs";
import { semanticsCoverage } from "../src/deliverables/interpretationRules.mjs";
import { buildStructuredUserPrompt, scopedSectionPlanForBlock } from "../src/deliverables/structuredSectionWriter.mjs";

const RACINE = path.resolve(import.meta.dirname, "..");

const THEME = {
  birthDate: "1979-03-14",
  timePrecision: "approximate",
  timeValue: "09:00",
  timeMarginMinutes: 30,
  birthPlace: "Lyon, France",
  placeName: "Lyon, France",
  country: "FR",
  latitude: 45.764,
  longitude: 4.8357,
  timeZone: "Europe/Paris",
  coordinateSource: "test_fixture",
  coordinateConfidence: "verified_fixture"
};

function dossier() {
  const calculation = calculateWesternNatalChart(
    { personId: "guards", ...THEME },
    { calculatedAt: "2026-10-18T00:00:00.000Z", runId: "calc_guards" }
  );
  return buildDossierEvidence({
    natalResult: calculation.result,
    natalRun: calculation.calculationRun,
    generatedAt: "2026-10-18T00:00:00.000Z"
  });
}

function valider({ dossierEvidence, plan, sectionId, texte }) {
  const sectionPlan = plan.sections.find((section) => section.sectionId === sectionId);
  const blocks = sectionPlan.blockPlans.map((blockPlan, index) => ({
    blockId: blockPlan.blockId,
    text: index === 0 ? texte : "Cette partie reste brève."
  }));
  return validateStructuredSection({
    dossierEvidence,
    sectionPlan,
    section: { sectionId, contractVersion: "structured-section-writer@0.1.0", blocks }
  });
}

// ---------------------------------------------------------------------------
// 1. Croisements non licenciés
// ---------------------------------------------------------------------------

test("une interaction affirmée entre configurations non reliées est refusée", () => {
  const dossierEvidence = dossier();
  const plan = buildFullDossierPlan(dossierEvidence, { aspectChapterMode: "narrative" });
  const resultat = valider({
    dossierEvidence,
    plan,
    sectionId: "major_aspects",
    texte:
      "Mars forme une opposition avec Saturne, et Mercure forme un sextile avec Vénus : ces deux aspects se répondent."
  });
  assert.equal(resultat.ok, false);
  const issue = resultat.issues.find((entree) => entree.code === "crossed_claim_not_licensed");
  assert.ok(issue, "le croisement doit être refusé");
  assert.deepEqual(issue.facts.sort(), ["aspect.mars.saturn.opposition", "aspect.mercury.venus.sextile"]);
  assert.equal(issue.marker, "se répondent");
});

test("un croisement licencié par la figure est accepté", () => {
  const dossierEvidence = dossier();
  const plan = buildFullDossierPlan(dossierEvidence, { aspectChapterMode: "narrative" });
  const resultat = valider({
    dossierEvidence,
    plan,
    sectionId: "internal_tensions",
    texte:
      "Le Soleil forme un trigone avec Jupiter et la Lune forme un sextile avec Jupiter : ces deux appuis se répondent."
  });
  assert.equal(resultat.ok, true, JSON.stringify(resultat.issues.map((i) => i.code)));
});

test("une phrase qui nie le lien, ou qui énumère, n'est pas un croisement", () => {
  const dossierEvidence = dossier();
  const plan = buildFullDossierPlan(dossierEvidence, { aspectChapterMode: "narrative" });
  const nie = valider({
    dossierEvidence,
    plan,
    sectionId: "major_aspects",
    texte:
      "Mars forme une opposition avec Saturne et Mercure forme un sextile avec Vénus : ces deux aspects ne se répondent pas."
  });
  assert.equal(nie.ok, true);
  const enumere = valider({
    dossierEvidence,
    plan,
    sectionId: "major_aspects",
    texte: "Mars forme une opposition avec Saturne. Mercure forme un sextile avec Vénus."
  });
  assert.equal(enumere.ok, true);
});

test("le détecteur exige une phrase, deux aspects distincts et un marqueur", () => {
  const detectFacts = detectAstrologicalTextFacts;
  assert.equal(detectCrossedClaims({ text: "Mars forme une opposition avec Saturne. Mercure forme un sextile avec Vénus.", detectFacts }).length, 0);
  assert.equal(detectCrossedClaims({ text: "L'opposition Mars–Saturne et le sextile Mercure–Vénus se renforcent.", detectFacts }).length, 1);
  assert.equal(detectCrossedClaims({ text: "Mars forme une opposition avec Saturne et Saturne forme une opposition avec Mars se renforcent.", detectFacts }).length, 0);
  assert.ok(INTERACTION_MARKERS.includes("se répondent"));
});

test("le moteur historique n'est pas soumis au contrôle de croisement", () => {
  const dossierEvidence = dossier();
  const plan = buildFullDossierPlan(dossierEvidence, { editorialEngine: "legacy", aspectChapterMode: "narrative" });
  const resultat = valider({
    dossierEvidence,
    plan,
    sectionId: "major_aspects",
    texte:
      "Mars forme une opposition avec Saturne, et Mercure forme un sextile avec Vénus : ces deux aspects se répondent."
  });
  assert.equal(resultat.issues.some((issue) => issue.code === "crossed_claim_not_licensed"), false);
});

test("isCrossingLicensed compare les deux preuves d'un croisement autorisé", () => {
  const relation = {
    evidenceRefs: ["aspect.sun.moon.opposition", "aspect.sun.jupiter.trine", "aspect.moon.jupiter.sextile"]
  };
  const premier = { bodyA: "Sun", bodyB: "Moon", aspectType: "opposition" };
  const second = { bodyA: "Moon", bodyB: "Jupiter", aspectType: "sextile" };
  const tiers = { bodyA: "Mercury", bodyB: "Venus", aspectType: "sextile" };
  assert.equal(isCrossingLicensed({ premier, second, relations: [relation], identifier: aspectIdentifier }), true);
  assert.equal(isCrossingLicensed({ premier, second: tiers, relations: [relation], identifier: aspectIdentifier }), false);
  assert.equal(isCrossingLicensed({ premier, second, relations: [], identifier: aspectIdentifier }), false);
});

// ---------------------------------------------------------------------------
// 2. « Aspects majeurs » en annexe de référence
// ---------------------------------------------------------------------------

test("en mode référence, le chapitre ne rédige plus et publie sa table calculée", () => {
  const plan = buildFullDossierPlan(dossier(), { aspectChapterMode: "reference" });
  const section = plan.sections.find((entree) => entree.sectionId === "major_aspects");
  assert.ok(section, "le chapitre reste dans le plan");
  assert.equal((section.blockPlans ?? []).length, 0, "aucun bloc narratif");
  assert.equal(section.editorialMode, "reference");
  assert.equal(section.referenceTable.length, 5, "les cinq aspects calculés sont dans la table");
  for (const ligne of section.referenceTable) {
    assert.ok(ligne.evidenceRef.startsWith("aspect."));
    assert.equal(typeof ligne.orb, "number");
  }
  const orbes = section.referenceTable.map((ligne) => ligne.orb);
  assert.deepEqual(orbes, [...orbes].sort((a, b) => a - b), "la table est triée par orbe");
});

test("le produit choisit l'annexe de référence, le plan générique reste narratif", () => {
  const service = readFileSync(path.join(RACINE, "src/models/fullDossierService.mjs"), "utf8");
  assert.match(service, /aspectChapterMode: "reference"/);
  const planParDefaut = buildFullDossierPlan(dossier());
  assert.equal(planParDefaut.aspectChapterMode, "narrative");
  assert.ok(planParDefaut.sections.find((s) => s.sectionId === "major_aspects").blockPlans.length > 0);
});

test("un mode inconnu lève au lieu de retomber silencieusement", () => {
  assert.throws(() => buildFullDossierPlan(dossier(), { aspectChapterMode: "synthesis" }), /aspectChapterMode inconnu/);
});

// ---------------------------------------------------------------------------
// 3. Mesure de recopie et migration progressive
// ---------------------------------------------------------------------------

test("la mesure de recopie est calibrée : copie totale, partielle, ordre changé, accents", () => {
  const source = "la sécurité intérieure s'appuie sur la confiance plutôt que sur le contrôle";
  // La mesure travaille sur des jetons NORMALISÉS : l'apostrophe coupe
  // « s'appuie » en deux jetons. L'attendu se calcule donc avec la même
  // normalisation, sinon le test comparerait deux unités différentes.
  const jetonsSource = mots(source);

  // 1. Copie intégrale : la mesure égale la longueur normalisée de la source.
  const totale = verbatimDependency({ text: `Ici, ${source}.`, sources: [source] });
  assert.equal(totale.maxRun, jetonsSource.length, `copie totale : attendu ${jetonsSource.length}, mesuré ${totale.maxRun}`);

  // 2. Copie partielle : six jetons consécutifs de la source.
  const extrait = jetonsSource.slice(2, 8).join(" ");
  const partielle = verbatimDependency({ text: `On note ${extrait} dans ce thème.`, sources: [source] });
  assert.equal(partielle.maxRun, 6, `copie partielle : attendu 6, mesuré ${partielle.maxRun}`);

  // 3. Même vocabulaire, ordre changé : aucune longue suite recopiée.
  //    Un réordonnancement peut conserver une courte suite fortuite
  //    (« s'appuie sur la » = 4 jetons) : la mesure est lexicale, pas sémantique.
  const reordonne = verbatimDependency({
    text: "Le contrôle plutôt que la confiance s'appuie sur la sécurité intérieure.",
    sources: [source]
  });
  assert.ok(reordonne.maxRun < 6, `réordonnancement : ${reordonne.maxRun}`);

  // 4. Accents et casse sont normalisés : la copie reste détectée.
  const accents = verbatimDependency({ text: "SECURITE INTERIEURE S'APPUIE SUR LA CONFIANCE", sources: [source] });
  assert.ok(accents.maxRun >= 5, `normalisation accents/casse : ${accents.maxRun}`);

  // 5. Sous le seuil demandé, aucun signalement.
  const court = verbatimDependency({ text: "la confiance plutôt", sources: [source], minRun: 4 });
  assert.equal(court.maxRun, 0, "sous le seuil, pas de signalement");
});

test("la couverture sémantique dit où en est la migration", () => {
  const couverture = semanticsCoverage();
  assert.equal(couverture.total, couverture.structured + couverture.legacy);
  assert.ok(couverture.structured >= 5);
  assert.equal(couverture.byType.NATAL_ASPECT.structured, 5);
  assert.equal(couverture.byType.NATAL_BODY_SIGN.structured, 0, "la famille suivante n'est pas encore migrée");
});

test("dans un même chapitre, concepts et phrases coexistent sans casser le prompt", () => {
  const plan = buildFullDossierPlan(dossier(), { aspectChapterMode: "reference" });
  const identity = plan.sections.find((section) => section.sectionId === "identity");
  const blocks = identity.blockPlans.map((blockPlan) => {
    const payload = JSON.parse(
      buildStructuredUserPrompt({ sectionPlan: scopedSectionPlanForBlock(identity, blockPlan) })
    );
    return payload.sectionPlan.blockPlans.flatMap((bloc) => bloc.packets);
  });
  const packets = blocks.flat();
  assert.ok(packets.some((packet) => packet.semantics), "au moins une règle migrée fournit des concepts");
  assert.ok(packets.some((packet) => !packet.semantics && packet.themes.length > 0), "les règles non migrées gardent leurs phrases");
  assert.ok(plan.editorialPlan.semantics.structured >= 5);
});
