// L'aperçu sans réseau doit rester utilisable.
//
// C'est le seul moyen de juger la mise en page sans payer un tirage réel : s'il
// sort avec des sections vides ou des avertissements, il ne sert plus à rien. Le
// 12 septembre, le texte de remplacement rendait du HTML et le détecteur de
// placeholders vidait les onze sections — ce test verrouille le contraire.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const RACINE = new URL("..", import.meta.url).pathname;

function apercu(nom, args = []) {
  const sortie = join(tmpdir(), `apercu-test-${process.pid}-${nom}.html`);
  const console_ = execFileSync(process.execPath, ["tools/preview-document.mjs", "--out", sortie, ...args], {
    cwd: RACINE,
    encoding: "utf8"
  });
  const html = readFileSync(sortie, "utf8");
  rmSync(sortie, { force: true });
  return { html, console: console_ };
}

test("l'aperçu ne sort pas avec des sections vides", () => {
  const { html, console: sortie } = apercu("fr");
  assert.doesNotMatch(sortie, /texte fautif|défauts? de style/, `aucun défaut signalé :\n${sortie}`);
  const sections = html.split('<section class="block">').slice(1);
  assert.equal(sections.length, 10, "les dix sections de texte sont présentes");
  for (const section of sections) {
    assert.match(section, /<p>/, "chaque section porte du texte");
  }
  // Les deux pages à part : la carte du ciel et l'annexe.
  assert.match(html, /<section class="block chart-page">/);
  assert.match(html, /<section class="block annex">/);
  // Le texte de remplacement est rendu en HTML, jamais montré en balises.
  assert.doesNotMatch(html, /&lt;p&gt;|&lt;em&gt;/);
  // Et il est signalé comme tel, pour qu'on ne le prenne pas pour une lecture.
  assert.match(html, /texte de remplacement, aucune lecture réelle/);
});

test("l'aperçu tient dans les neuf langues et les trois précisions d'heure", () => {
  for (const langue of ["en", "de", "es", "it", "pt", "no", "da", "nl"]) {
    const { html, console: sortie } = apercu(langue, ["--language", langue]);
    assert.doesNotMatch(sortie, /texte fautif|défauts? de style/, `${langue} :\n${sortie}`);
    assert.equal(html.length > 10000, true, `${langue} : document non vide`);
  }
  for (const precision of ["exact", "unknown"]) {
    const { html, console: sortie } = apercu(precision, ["--precision", precision]);
    assert.doesNotMatch(sortie, /texte fautif|défauts? de style/, `${precision} :\n${sortie}`);
    assert.match(html, /chart-page/, `${precision} : la page graphique est là`);
  }
});
