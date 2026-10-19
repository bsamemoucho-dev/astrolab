// Dossier complet produit par le nouveau moteur éditorial, avec des réponses
// SIMULÉES : aucun réseau, aucun appel payant.
//
// C'est la répétition générale de ce que Vtest exécutera avec une vraie clé :
// même plan éditorial (`buildFullDossierPlan`, mode « annexe de référence »),
// même écrivain structuré, mêmes validateurs, même rendu. Seul le modèle est
// remplacé par une fonction locale qui renvoie un texte neutre pour chaque bloc.
//
// Ce test protège trois choses à la fois :
//   - le parcours complet reste générable de bout en bout ;
//   - les validateurs factuels acceptent un texte sans fait inventé ;
//   - le coût reste nul (aucune requête HTTP n'est émise).

import assert from "node:assert/strict";
import test from "node:test";

import { createFullPublicReading } from "../src/models/fullDossierService.mjs";

const INPUT = {
  firstName: "Test",
  language: "fr",
  birthDate: "1986-01-02",
  timePrecision: "approximate",
  timeValue: "16:45",
  timeMarginMinutes: 30,
  deliveryEmail: "vtest@example.test",
  resolvedPlace: {
    selectedName: "Courbevoie, France",
    country: "France",
    normalizedForCalculation: { latitude: 48.89672, longitude: 2.25666, timeZone: "Europe/Paris" }
  }
};

// Texte volontairement neutre : aucune position, aucun aspect, aucune date.
// S'il en contenait, les validateurs devraient refuser la section — et ce test
// échouerait, ce qui est précisément le comportement attendu.
const TEXTE_SIMULE = "Cette dimension se lit comme une piste symbolique à éprouver, sans certitude.";

test("le nouveau moteur produit un dossier complet avec des réponses simulées, sans appel réseau", async () => {
  const appels = [];
  const structuredWriterFn = async (prompt) => {
    appels.push(prompt?.sectionPlan?.sectionId ?? "inconnue");
    return {
      sectionId: prompt?.sectionPlan?.sectionId,
      blocks: (prompt?.sectionPlan?.blockPlans ?? []).map((block) => ({
        blockId: block.blockId,
        text: TEXTE_SIMULE
      }))
    };
  };

  // Aucun fetch ne doit être atteint : `config` est null, tout passe par la
  // fonction simulée. Une régression qui tenterait un vrai appel échouerait ici.
  const resultat = await createFullPublicReading(INPUT, {
    structuredWriterFn,
    failFast: true,
    config: null
  });

  assert.equal(resultat.writerMode, "llm", "le parcours doit être celui de l'écrivain structuré");
  assert.ok(appels.length >= 10, `trop peu de blocs écrits : ${appels.length}`);

  const sections = resultat.sections ?? [];
  assert.ok(sections.length >= 10, `trop peu de sections : ${sections.length}`);
  const rejetees = sections.filter((section) => section.status !== "ok");
  assert.deepEqual(rejetees.map((section) => [section.id, section.status]), [], "aucune section ne doit être rejetée");

  // Validation factuelle finale : c'est elle qui autorise la livraison.
  assert.equal(resultat.validation?.ok ?? true, true);

  const html = String(resultat.html ?? "");
  assert.ok(html.length > 15_000, `document trop court : ${html.length} caractères`);
  // L'annexe de référence des aspects et ses orbes sont bien dans le document.
  assert.match(html, /lastro-aspects@1\.0\.0/);
  assert.match(html, /Marge d'incertitude retenue/);
  // Aucun texte technique ne doit atteindre le client.
  assert.doesNotMatch(html, /\{[a-z]+\}|\[[^\]]{1,40}\]/);
  // Le texte simulé est bien celui qui a été écrit, pas un texte de secours.
  assert.match(html, /piste symbolique à éprouver/);
});

test("les validateurs refusent un texte qui invente une position absente du socle", async () => {
  // Une phrase plausible mais fausse : le Soleil n'est pas en Balance dans ce
  // thème. Si ce test passait, la garantie factuelle ne serait qu'un décor.
  const structuredWriterFn = async (prompt) => ({
    sectionId: prompt?.sectionPlan?.sectionId,
    blocks: (prompt?.sectionPlan?.blockPlans ?? []).map((block) => ({
      blockId: block.blockId,
      text: "Le Soleil est en Balance et la Lune en maison 7."
    }))
  });

  await assert.rejects(
    createFullPublicReading(INPUT, { structuredWriterFn, failFast: true, config: null }),
    (error) => {
      assert.ok(
        /validation_failed$/.test(String(error.code ?? "")) || error.validation?.ok === false,
        `code inattendu : ${error.code ?? error.message}`
      );
      return true;
    }
  );
});
