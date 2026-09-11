// Qualité de langue : antécédents orphelins, anti-répétition, vouvoiement,
// vocabulaire imposé. Ces règles sont mesurées, pas seulement demandées.

import assert from "node:assert/strict";
import test from "node:test";

import { LANGUAGES, docStrings } from "../src/deliverables/i18n.mjs";
import {
  DOSSIER_SECTIONS,
  FRAME_DIRECTIVES,
  dossierSectionTitles,
  dossierSectionsInOrder
} from "../src/deliverables/plan.mjs";
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

test("les accents ne fabriquent pas de faux tutoiement", () => {
  // `\b` traite « é » et « ê » comme des non-lettres : sans frontière Unicode,
  // « complète » contient un mot « te » et le détecteur accuse un texte vouvoyé.
  assert.deepEqual(
    findTutoiement("Votre quête est complète et secrète, et votre réponse reste concrète."),
    []
  );
  assert.deepEqual(findTutoiement("Vous portez une inquiétude discrète, et votre fête intérieure compte."), []);
  assert.equal(findTutoiement("Tu avances avec ton intuition.").length, 1);
  assert.equal(findTutoiement("Ta manière de tenir compte des autres.").length, 1);
  // Même piège pour un accent final : « carré » doit être reconnu comme aspect.
  const carre = findRepeatedPlacements("Le carré entre votre Mars et votre Jupiter est tendu.", [
    { text: "Mars et Jupiter forment un carré serré." }
  ]);
  assert.equal(carre.length, 1);
  assert.equal(carre[0].signature, "aspect:Jupiter-Mars:square");
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

test("l'ordre des sections suit le rang, pas l'ordre de declaration", () => {
  const ordered = dossierSectionsInOrder();
  assert.deepEqual(
    ordered.map((section) => section.id),
    [
      "introduction",
      "grandes-lignes",
      "position-naissance-axe",
      "structure-psychologique",
      "relations",
      "action",
      "forces-tensions",
      "cles-integration",
      "lecture-passe",
      "transgenerationnel",
      "lettre-miroir",
      "periodes-cycles"
    ]
  );
  const ranks = ordered.map((section) => section.rank);
  assert.deepEqual(ranks, [...ranks].sort((first, second) => first - second), "les rangs doivent être croissants");
  assert.equal(new Set(ranks).size, ranks.length, "deux sections ne peuvent pas partager le même rang");
  assert.deepEqual(
    dossierSectionTitles().map((entry) => entry.id),
    ordered.map((section) => section.id),
    "les titres exposés suivent le même ordre"
  );
});

test("les deux sections renommees le sont dans les neuf langues", () => {
  const attendus = {
    fr: ["Vos émotions", "Votre passé"],
    en: ["Your emotions", "Your past"],
    de: ["Deine Gefühle", "Deine Vergangenheit"],
    es: ["Tus emociones", "Tu pasado"],
    it: ["Le tue emozioni", "Il tuo passato"],
    pt: ["As suas emoções", "O seu passado"],
    no: ["Følelsene dine", "Fortiden din"],
    da: ["Dine følelser", "Din fortid"],
    nl: ["Je emoties", "Je verleden"]
  };
  for (const { code } of LANGUAGES) {
    const titres = docStrings(code).sectionTitles;
    assert.equal(titres["structure-psychologique"], attendus[code][0], code);
    assert.equal(titres["lecture-passe"], attendus[code][1], code);
    // Plus aucun intitulé technique « structure psychologique » ou « lecture approfondie ».
    assert.doesNotMatch(titres["structure-psychologique"], /psycholog|psychisch|psicol|psico|psykolog/i, code);
    assert.doesNotMatch(titres["lecture-passe"], /approfondie|in-depth|vertieft|profunda|approfondita|aprofundada|dybde|diepgaand/i, code);
  }
});
