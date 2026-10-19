// Diagnostics : mesurer sans jamais bloquer ni réécrire.

import assert from "node:assert/strict";
import test from "node:test";

import {
  chapterNovelty,
  crossChapterRepetition,
  diagnose,
  lexicalOverlap,
  relationCoverage,
  verbatimDependency
} from "../src/deliverables/editorialDiagnostics.mjs";

test("la dépendance verbatim mesure la plus longue suite recopiée", () => {
  const sources = ["tension entre l'élan d'agir et la limite rencontrée", "confiance disponible pour élargir son horizon"];
  const recopie = verbatimDependency({
    text: "On retrouve une tension entre l'élan d'agir et la limite rencontrée dans ce thème.",
    sources
  });
  assert.ok(recopie.maxRun >= 6, `suite détectée : ${recopie.maxRun}`);
  assert.equal(recopie.spans.length, 1);
  const reformule = verbatimDependency({
    text: "L'élan se mesure ici à une borne intérieure exigeante.",
    sources
  });
  assert.equal(reformule.maxRun, 0);
});

test("la nouveauté d'un chapitre distingue reformulation et apport", () => {
  const ownedLabels = ["tension entre action et limite", "effort tenu dans la durée"];
  const pure = chapterNovelty({ text: "Tension entre action et limite, effort tenu dans la durée.", ownedLabels });
  assert.ok(pure.novelRatio <= 0.2, `reformulation détectée : ${pure.novelRatio}`);
  const apport = chapterNovelty({
    text: "Le troisième terme change la lecture : la limite n'est plus un mur mais une mesure.",
    ownedLabels
  });
  assert.ok(apport.novelRatio >= 0.6, `apport détecté : ${apport.novelRatio}`);
});

test("le recouvrement lexical repère deux chapitres qui se répètent", () => {
  const a = "La tension entre l'élan d'agir et le cadre intérieur exigeant se lit dans cette opposition serrée.";
  const b = "Cette opposition serrée montre une tension entre l'élan d'agir et un cadre intérieur exigeant.";
  assert.ok(lexicalOverlap(a, b) > 0.4);
  const c = "La parole circule volontiers par l'échange et la formulation de ce qui compte.";
  assert.ok(lexicalOverlap(a, c) < 0.15);
});

test("les répétitions entre chapitres sont signalées avec leur mesure", () => {
  const chapitres = [
    { id: "tensions", text: "La tension entre l'élan d'agir et le cadre intérieur exigeant se lit dans cette opposition." },
    { id: "aspects", text: "On retrouve la tension entre l'élan d'agir et le cadre intérieur exigeant dans l'opposition." },
    { id: "ressources", text: "La parole circule par l'échange et la formulation de ce qui compte." }
  ];
  const paires = crossChapterRepetition({ sections: chapitres });
  assert.equal(paires.length, 1);
  assert.deepEqual([paires[0].a, paires[0].b].sort(), ["aspects", "tensions"]);
  assert.ok(paires[0].lexicalRatio >= 0.2);
});

test("la couverture des croisements vérifie que les deux corps sont nommés", () => {
  const relations = [
    { relationId: "r1", corps: ["Jupiter", "Lune"] },
    { relationId: "r2", corps: ["Mars", "Saturne"] }
  ];
  const couverture = relationCoverage({ text: "Jupiter relie ici la Lune à l'axe du Soleil.", relations });
  assert.deepEqual(couverture.servies, ["r1"]);
  assert.deepEqual(couverture.manquees, ["r2"]);
  assert.equal(couverture.couverture, 0.5);
});

test("le diagnostic agrège sans modifier les textes reçus", () => {
  const sections = [
    { id: "tensions", text: "Un texte court.", sources: ["un texte court"] }
  ];
  const avant = JSON.stringify(sections);
  const rapport = diagnose({ sections, editorialPlan: { ideas: [], relations: [], rejected: [], gaps: [] } });
  assert.equal(JSON.stringify(sections), avant, "le diagnostic ne doit rien réécrire");
  assert.equal(rapport.sections.length, 1);
  assert.ok(rapport.sections[0].words >= 3);
});
