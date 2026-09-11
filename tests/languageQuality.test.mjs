// Qualité de langue : antécédents orphelins, anti-répétition, vouvoiement,
// vocabulaire imposé. Ces règles sont mesurées, pas seulement demandées.

import assert from "node:assert/strict";
import test from "node:test";

import { DOSSIER_SECTIONS, FRAME_DIRECTIVES } from "../src/deliverables/plan.mjs";
import {
  findForbiddenVocabulary,
  findOrphanAntecedents,
  findRepeatedPlacements,
  findTutoiement,
  validateSectionText
} from "../src/deliverables/validator.mjs";

test("un antécédent orphelin est détecté, un placement nommé ne l'est pas", () => {
  assert.equal(findOrphanAntecedents("Cette position vous demande de tenir bon.").length, 1);
  assert.equal(findOrphanAntecedents("Cette maison est celle de l'engagement.").length, 1);
  assert.equal(findOrphanAntecedents("Cet aspect explique votre élan.").length, 1);
  assert.equal(
    findOrphanAntecedents("Cette position vous demande de tenir. Votre Lune en Cancer explique cette réserve.").length,
    1,
    "l'antécédent est orphelin tant que le placement n'a pas été nommé"
  );
  // Le placement est nommé d'abord : la référence qui suit est légitime.
  assert.deepEqual(findOrphanAntecedents("Votre Lune en Cancer vous rend attentive. Cette position vous demande de tenir."), []);
  assert.deepEqual(findOrphanAntecedents("Votre Soleil est en Capricorne, en maison 7. Cette maison parle d'engagement."), []);
  // Une phrase qui nomme directement quelque chose n'est jamais orpheline.
  assert.deepEqual(findOrphanAntecedents("Cette Lune en Cancer colore vos réactions."), []);
  assert.deepEqual(findOrphanAntecedents("Vous avancez avec prudence."), []);
});

test("la consigne de nommage accompagne l'anti-répétition dans le cadre commun", () => {
  const cadre = FRAME_DIRECTIVES.join(" ");
  assert.match(cadre, /Nomme une fois le placement/i);
  assert.match(cadre, /cette position/i);
  // L'anti-répétition est toujours là : nommer n'autorise pas à réexpliquer.
  assert.match(cadre, /UNE SEULE FOIS/i);
  // Le cadre est bien transmis à chaque section rédigée.
  const sectionsRedigees = DOSSIER_SECTIONS.filter((section) => section.writer === "llm");
  assert.ok(sectionsRedigees.length > 0);
  assert.ok(sectionsRedigees.every((section) => Array.isArray(section.directives ?? [])));
});

test("un même aspect ou une même maison expliqué deux fois est détecté", () => {
  const precedentes = [
    { title: "Vos émotions", text: "Le trigone entre votre Lune et votre Saturne donne de la constance." }
  ];
  const repetition = findRepeatedPlacements(
    "Le trigone entre votre Lune et votre Saturne revient ici comme une force tranquille.",
    precedentes
  );
  assert.equal(repetition.length, 1);
  assert.equal(repetition[0].code, "repeated_placement");
  assert.equal(repetition[0].signature, "aspect:Moon-Saturn:trine");

  // Un placement différent n'est pas une répétition.
  assert.deepEqual(
    findRepeatedPlacements("Le carré entre votre Mars et votre Jupiter demande de doser.", precedentes),
    []
  );
  // Maison déjà expliquée.
  const maison = findRepeatedPlacements("Avec votre Saturne en maison 7, vous pesez vos engagements.", [
    { title: "Vos relations", text: "Saturne se tient en maison 7 : les liens demandent du temps." }
  ]);
  assert.equal(maison.length, 1);
  assert.equal(maison[0].signature, "house:Saturn:7");
  // Sans section précédente, rien n'est signalé.
  assert.deepEqual(findRepeatedPlacements("Le trigone entre votre Lune et votre Saturne.", []), []);
});

test("le tutoiement et le vocabulaire interdit sont détectés en français", () => {
  assert.equal(findTutoiement("Tu avances avec prudence.").length, 1);
  assert.equal(findTutoiement("Ton Soleil en Capricorne structure ta manière de tenir.").length, 1);
  assert.deepEqual(findTutoiement("Vous avancez avec prudence, et votre Soleil structure votre manière de tenir."), []);

  assert.equal(findForbiddenVocabulary("Le trine entre votre Lune et votre Saturne est net.").length, 1);
  assert.deepEqual(findForbiddenVocabulary("Le trigone entre votre Lune et votre Saturne est net."), []);

  const report = validateSectionText({
    sectionId: "structure-psychologique",
    text: "Le trine entre votre Lune et votre Saturne vous donne de la constance.",
    socle: null
  });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "forbidden_vocabulary"));
});
