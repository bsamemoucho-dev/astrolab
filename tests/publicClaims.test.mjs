// Ce que le site promet, comparé à ce qui est réellement exécuté.
//
// Le parcours payant (`createFullPublicReading`) n'exécute AUCUNE vérification
// par un second modèle : `crossCheckReading` n'est appelé que par le chemin
// historique (`publicReadingService.mjs`). La page publique affirmait pourtant
// « dont une vérification par un second modèle ». Ces tests figent la règle
// inverse : une promesse de contrôle n'est publiée que si le code la tient.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { FULL_DOSSIER_SECTIONS } from "../src/deliverables/fullDossierPlan.mjs";
import { aiNotice, LANGUAGES } from "../src/deliverables/i18n.mjs";

const RACINE = path.resolve(import.meta.dirname, "..");
const page = readFileSync(path.join(RACINE, "public/index.html"), "utf8");
const script = readFileSync(path.join(RACINE, "public/app.js"), "utf8");

// Les neuf formulations qui promettaient un second modèle, une par langue.
const PROMESSES_SECOND_MODELE = [
  /second modèle/i,
  /second model/i,
  /zweite[nrs]? Modell/i,
  /segundo modelo/i,
  /secondo modello/i,
  /annen modell/i,
  /anden model/i,
  /tweede model/i
];

test("aucun texte public ne promet une vérification par un second modèle", () => {
  const surfaces = [
    ["public/index.html", page],
    ["public/app.js", script]
  ];
  for (const [nom, contenu] of surfaces) {
    for (const motif of PROMESSES_SECOND_MODELE) {
      assert.doesNotMatch(
        contenu,
        motif,
        `${nom} promet encore un contrôle (${motif.source}) que le parcours payant n'exécute pas`
      );
    }
  }
});

test("le texte de transparence livré ne promet ni second modèle ni relecture humaine", () => {
  for (const { code } of LANGUAGES) {
    const notice = aiNotice(code);
    assert.ok(notice && notice.trim().length > 40, `texte de transparence manquant en ${code}`);
    for (const motif of [...PROMESSES_SECOND_MODELE, /relu[e]? par un humain|reviewed by a human|von einem Menschen geprüft/i]) {
      assert.doesNotMatch(notice, motif, `le document livré promet un contrôle inexistant en ${code}`);
    }
  }
});

test("la page et la chaîne française de l'application disent la même chose", () => {
  const dansPage = page.match(/<span id="ai-notice-text">([\s\S]*?)<\/span>/)?.[1]?.trim();
  const dansScript = script.match(/aiNoticeText: "((?:[^"\\]|\\.)*)"/)?.[1]?.trim();
  assert.ok(dansPage, "le texte de transparence doit exister dans la page");
  assert.ok(dansScript, "le texte de transparence doit exister dans app.js");
  assert.equal(dansPage, dansScript, "les deux copies du texte de transparence ont divergé");
});

// Invariant de promesse produit : le bloc « Parents » du parcours public ne
// collecte des naissances que le jour où une section transgénérationnelle est
// réellement livrée. Tant qu'il n'y en a pas, il doit rester masqué — les champs
// restent dans le DOM (ils sont câblés sur la reconnaissance de lieu, vérifié par
// tests/printLayout.test.mjs) mais l'utilisateur ne les voit pas.
test("le bloc parents du parcours payant reste masqué tant qu'aucune section n'est livrée", () => {
  const bloc = page.match(/<details class="parent-fieldset express-optional"([^>]*)>\s*<summary>Parents/i);
  assert.ok(bloc, "le bloc parents du parcours public doit exister");
  const livreSectionTransgenerationnelle = FULL_DOSSIER_SECTIONS.some((section) =>
    /transgeneration/i.test(section.sectionId)
  );
  if (livreSectionTransgenerationnelle) {
    assert.doesNotMatch(bloc[1], /\bhidden\b/, "la section transgénérationnelle est livrée : le bloc doit être visible");
  } else {
    assert.match(
      bloc[1],
      /\bhidden\b/,
      "aucune section transgénérationnelle n'est livrée : le bloc parents ne doit pas collecter de données"
    );
  }
});
