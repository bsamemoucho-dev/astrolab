// Échappement des données dans le client.
//
// `public/app.js` construit ses listes avec `innerHTML` : toute valeur venue du
// serveur ou saisie par l'utilisateur qui y est interpolée brute devient du HTML.
// Le cas grave n'était pas théorique — un simple inscrit pouvait stocker
// `<svg/onload=…>` dans son adresse e-mail (la validation se limitait à
// `includes("@")`), et la charge s'exécutait dans le navigateur de l'exploitant
// à l'ouverture du panneau d'administration.
//
// Ce test interdit la régression sous la forme la plus directe : ces expressions
// ne doivent JAMAIS apparaître en interpolation brute dans ce fichier.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

// Données serveur ou utilisateur affichées dans une liste construite en HTML.
const EXPRESSIONS_A_ECHAPPER = [
  "user.email",
  "user.primaryRole",
  "personName(person)",
  "birthMeta",
  "place.name",
  "place.country",
  "norm.placeName",
  "norm.birthDate",
  "norm.timeZone",
  "deliverable.title ?? deliverable.personLabel",
  "analysis.scope",
  "analysis.status",
  "entry.action",
  "entry.subjectType",
  "entry.subjectId",
  "entry.ownerUserId"
];

function motifInterpolation(expression) {
  const litteral = expression.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\$\\{${litteral}\\}`, "g");
}

test("aucune donnée serveur n'est interpolée brute dans le HTML du client", () => {
  for (const expression of EXPRESSIONS_A_ECHAPPER) {
    const restes = [...source.matchAll(motifInterpolation(expression))];
    assert.equal(
      restes.length,
      0,
      `${restes.length} interpolation(s) non échappée(s) de \${${expression}} dans public/app.js`
    );
  }
});

test("deliverable.personLabel n'est brut que dans un textContent", () => {
  // `textContent` n'interprète pas le HTML : l'interpolation y est sûre. Partout
  // ailleurs la valeur doit passer par escapeHtml.
  const brutes = source.split("\n").filter((ligne) => ligne.includes("${deliverable.personLabel}"));
  assert.ok(brutes.length > 0, "l'usage attendu a disparu : ce test ne vérifie plus rien");
  for (const ligne of brutes) {
    assert.match(ligne, /textContent/, `interpolation brute hors textContent : ${ligne.trim()}`);
  }
});

test("l'échappement couvre les cinq caractères qui comptent", () => {
  const debut = source.indexOf("function escapeHtml");
  assert.ok(debut !== -1, "escapeHtml a disparu de public/app.js");
  const corps = source.slice(debut, source.indexOf("\n}", debut));
  assert.match(corps, /\[&<>"'\]/, "la classe de caractères échappés a changé");
  for (const entite of ["&amp;", "&lt;", "&gt;", "&quot;", "&#39;"]) {
    assert.ok(corps.includes(entite), `escapeHtml ne produit plus ${entite}`);
  }
});
