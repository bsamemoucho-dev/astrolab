// Le moteur de PDF : contrat du module, sans navigateur installé.
//
// Ce qui est vérifié ici est ce qui casse en production : une seule conversion à
// la fois, les options d'impression qui doivent suivre le CSS du document, le
// délai maximum, et le fait qu'un navigateur en panne soit fermé puis relancé
// plutôt que réutilisé.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPdfRenderer,
  defaultPdfRenderer,
  PDF_BUSY_CODE,
  PDF_FAILED_CODE,
  PDF_TIMEOUT_CODE,
  PDF_UNAVAILABLE_CODE,
  pdfFileNameFromHtml,
  pdfRendererConfiguration,
  resetDefaultPdfRenderer
} from "../src/deliverables/pdfRenderer.mjs";

// Un faux navigateur : enregistre tout ce qui compte, sans Chromium.
function fauxNavigateur({ journal, pdf = null, echecPdf = null, lenteurMs = 0 } = {}) {
  const etat = { pagesOuvertes: 0, pagesFermees: 0, fermetures: 0, lancements: 0 };
  const lancement = async () => {
    etat.lancements += 1;
    return {
      newPage: async () => {
        etat.pagesOuvertes += 1;
        journal.concurrence += 1;
        journal.maxConcurrence = Math.max(journal.maxConcurrence, journal.concurrence);
        return {
          setContent: async (html, options) => {
            journal.setContent.push({ html, options });
          },
          pdf: async (options) => {
            journal.options = options;
            if (lenteurMs) {
              await new Promise((resolve) => setTimeout(resolve, lenteurMs));
            }
            try {
              if (echecPdf) {
                throw echecPdf;
              }
              return pdf ?? Buffer.from("%PDF-1.4 faux document");
            } finally {
              journal.concurrence -= 1;
            }
          },
          close: async () => {
            etat.pagesFermees += 1;
          }
        };
      },
      close: async () => {
        etat.fermetures += 1;
      }
    };
  };
  return { lancement, etat };
}

function journalVide() {
  return { setContent: [], options: null, concurrence: 0, maxConcurrence: 0, fermetures: 0 };
}

test("le rendu PDF n'est actif que sur un drapeau explicite", () => {
  assert.equal(pdfRendererConfiguration({}), null);
  assert.equal(pdfRendererConfiguration({ ASTROLAB_PDF_RENDERER: "" }), null);
  assert.equal(pdfRendererConfiguration({ ASTROLAB_PDF_RENDERER: "0" }), null);
  assert.equal(pdfRendererConfiguration({ ASTROLAB_PDF_RENDERER: "peut-etre" }), null);
  for (const drapeau of ["chromium", "1", "true", "yes", "on"]) {
    const configuration = pdfRendererConfiguration({ ASTROLAB_PDF_RENDERER: drapeau });
    assert.equal(configuration.renderer, "chromium", `${drapeau} doit activer le rendu`);
    assert.equal(configuration.timeoutMs, 45000);
    assert.equal(configuration.idleCloseMs, 120000);
  }
  // Le chemin du binaire peut être imposé, et le délai aussi.
  const configure = pdfRendererConfiguration({
    ASTROLAB_PDF_RENDERER: "chromium",
    ASTROLAB_CHROMIUM_PATH: "/opt/chromium",
    ASTROLAB_PDF_TIMEOUT_MS: "9000",
    ASTROLAB_PDF_IDLE_CLOSE_MS: "abc"
  });
  assert.equal(configure.executablePath, "/opt/chromium");
  assert.equal(configure.timeoutMs, 9000);
  assert.equal(configure.idleCloseMs, 120000, "une valeur invalide retombe sur le défaut");
});

test("le rendu suit le CSS du document et n'ajoute rien", async () => {
  const journal = journalVide();
  const faux = fauxNavigateur({ journal });
  const rendu = createPdfRenderer({ renderer: "chromium", executablePath: "/usr/bin/chromium", timeoutMs: 5000, idleCloseMs: 60000 }, { launch: faux.lancement });

  const document = await rendu.render("<html><body><h1>Lecture</h1></body></html>");
  assert.equal(Buffer.from(document).toString("utf8"), "%PDF-1.4 faux document");
  assert.equal(journal.setContent.length, 1);
  assert.match(journal.setContent[0].html, /<h1>Lecture<\/h1>/);
  assert.equal(journal.setContent[0].options.waitUntil, "load");
  assert.deepEqual(
    { ...journal.options },
    {
      // La page vient du CSS (`@page { size: A4; margin: 0 }`), pas du moteur.
      preferCSSPageSize: true,
      // Couverture, pastilles et zones de la roue sont des fonds.
      printBackground: true,
      // Ni date, ni URL, ni numéro de page — contrairement à la fenêtre d'impression.
      displayHeaderFooter: false,
      timeout: 5000
    }
  );
  assert.equal(faux.etat.lancements, 1);
  // Le navigateur reste ouvert entre deux rendus, et les pages sont refermées.
  await rendu.render("<html></html>");
  assert.equal(faux.etat.lancements, 1, "le navigateur est réutilisé");
  assert.equal(faux.etat.pagesOuvertes, 2);
  assert.equal(faux.etat.pagesFermees, 2);
  await rendu.close();
  assert.equal(faux.etat.fermetures, 1);
});

test("une seule conversion à la fois, dans l'ordre demandé", async () => {
  const journal = journalVide();
  const faux = fauxNavigateur({ journal, lenteurMs: 20 });
  const rendu = createPdfRenderer({ renderer: "chromium", executablePath: "/usr/bin/chromium", timeoutMs: 5000, idleCloseMs: 60000 }, { launch: faux.lancement });

  await Promise.all([
    rendu.render("<html>1</html>"),
    rendu.render("<html>2</html>"),
    rendu.render("<html>3</html>")
  ]);
  assert.equal(journal.maxConcurrence, 1, "jamais deux rendus en parallèle");
  assert.deepEqual(journal.setContent.map((entree) => entree.html), ["<html>1</html>", "<html>2</html>", "<html>3</html>"]);
  await rendu.close();
});

test("un navigateur en panne est fermé, jamais réutilisé", async () => {
  const journal = journalVide();
  const faux = fauxNavigateur({ journal, echecPdf: new Error("Target closed") });
  const rendu = createPdfRenderer({ renderer: "chromium", executablePath: "/usr/bin/chromium", timeoutMs: 5000, idleCloseMs: 60000 }, { launch: faux.lancement });

  await assert.rejects(() => rendu.render("<html></html>"), (error) => {
    assert.equal(error.code, PDF_FAILED_CODE);
    assert.equal(error.name, "PdfRenderError");
    return true;
  });
  assert.equal(faux.etat.fermetures, 1, "le navigateur fautif est fermé");
  assert.equal(faux.etat.pagesFermees, 1, "la page est refermée malgré la panne");
  // Le rendu suivant relance un navigateur neuf, il ne réutilise pas le mort.
  await assert.rejects(() => rendu.render("<html></html>"));
  assert.equal(faux.etat.lancements, 2);
  assert.ok(rendu.status().lastFailure, "le dernier échec est conservé pour les journaux");
  assert.equal(rendu.status().lastFailure.code, PDF_FAILED_CODE);
  await rendu.close();
});

test("un moteur absent est déclaré indisponible, pas en panne", async () => {
  const rendu = createPdfRenderer(
    { renderer: "chromium", executablePath: "/usr/bin/chromium-absent", timeoutMs: 5000, idleCloseMs: 60000 },
    {
      launch: async () => {
        const error = new Error("spawn /usr/bin/chromium-absent ENOENT");
        error.code = "ENOENT";
        throw error;
      }
    }
  );
  await assert.rejects(() => rendu.render("<html></html>"), (error) => {
    assert.equal(error.code, PDF_UNAVAILABLE_CODE);
    return true;
  });
  assert.equal(rendu.status().rendered, 0);
  await rendu.close();
});

test("un rendu bloqué est interrompu et le navigateur fermé", async () => {
  const journal = journalVide();
  // Une page qui ne rend jamais la main : le délai doit trancher.
  const faux = {
    launch: async () => ({
      newPage: async () => ({
        setContent: async () => {},
        pdf: async () => new Promise(() => {}),
        close: async () => {}
      }),
      close: async () => {
        journal.fermetures += 1;
      }
    })
  };
  const rendu = createPdfRenderer(
    { renderer: "chromium", executablePath: "/usr/bin/chromium", timeoutMs: 30, graceMs: 40, idleCloseMs: 60000 },
    { launch: faux.launch }
  );
  await assert.rejects(() => rendu.render("<html></html>"), (error) => {
    assert.equal(error.code, PDF_TIMEOUT_CODE);
    return true;
  });
  assert.equal(journal.fermetures, 1, "un rendu bloqué laisse un navigateur inutilisable : il est fermé");
  await rendu.close();
});

test("une file saturée est refusée au lieu d'empiler des rendus", async () => {
  const journal = journalVide();
  const faux = fauxNavigateur({ journal, lenteurMs: 40 });
  const rendu = createPdfRenderer(
    { renderer: "chromium", executablePath: "/usr/bin/chromium", timeoutMs: 5000, idleCloseMs: 60000, maxQueue: 2 },
    { launch: faux.lancement }
  );
  const lances = [rendu.render("<html>1</html>"), rendu.render("<html>2</html>")];
  await assert.rejects(() => rendu.render("<html>3</html>"), (error) => {
    assert.equal(error.code, PDF_BUSY_CODE);
    return true;
  });
  await Promise.all(lances);
  // La file s'est vidée : la conversion suivante est de nouveau acceptée.
  await rendu.render("<html>4</html>");
  assert.equal(rendu.status().pending, 0);
  assert.equal(rendu.status().rendered, 3);
  await rendu.close();
});

test("le nom du fichier vient du titre du document", () => {
  assert.equal(pdfFileNameFromHtml("<title>Lecture symbolique — Caro</title>"), "Lecture-symbolique-Caro.pdf");
  assert.equal(pdfFileNameFromHtml("<title>Votre carte du ciel — Éléonore</title>"), "Votre-carte-du-ciel-Eleonore.pdf");
  assert.equal(pdfFileNameFromHtml("<html></html>"), "lastro-lecture.pdf");
  assert.equal(pdfFileNameFromHtml(""), "lastro-lecture.pdf");
  assert.equal(pdfFileNameFromHtml("<title>   </title>"), "lastro-lecture.pdf");
  assert.equal(pdfFileNameFromHtml(`<title>${"a".repeat(120)}</title>`), `${"a".repeat(60)}.pdf`);
  assert.equal(pdfFileNameFromHtml("<title>??? ///</title>"), "lastro-lecture.pdf");
});

test("l'instance par défaut suit l'environnement", () => {
  resetDefaultPdfRenderer();
  assert.equal(defaultPdfRenderer({}), null);
  const active = defaultPdfRenderer({ ASTROLAB_PDF_RENDERER: "chromium" });
  assert.equal(active.renderer, "chromium");
  assert.equal(defaultPdfRenderer({ ASTROLAB_PDF_RENDERER: "chromium" }), active, "la même instance est réutilisée");
  assert.equal(defaultPdfRenderer({}), null, "retirer le drapeau retire le moteur");
  resetDefaultPdfRenderer();
});

test("le binaire est cherché aux emplacements habituels", () => {
  // Un chemin imposé gagne ; sinon les emplacements connus sont essayés, et un
  // chemin de repli est renvoyé même si aucun n'existe — l'échec est alors
  // classé « indisponible » au lancement, jamais silencieux.
  const impose = pdfRendererConfiguration({ ASTROLAB_PDF_RENDERER: "chromium", ASTROLAB_CHROMIUM_PATH: "/x/chrome" });
  assert.equal(impose.executablePath, "/x/chrome");
  const defaut = pdfRendererConfiguration({ ASTROLAB_PDF_RENDERER: "chromium" });
  assert.match(defaut.executablePath, /chromium/);
});

test("la présence du module est vérifiée sans l'installer", () => {
  // Garde-fou de doctrine : `puppeteer-core` n'est pas une dépendance du dépôt.
  // Il est installé dans l'image seulement quand le drapeau est activé.
  const paquet = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal("puppeteer-core" in (paquet.dependencies ?? {}), false);
  assert.equal("puppeteer-core" in (paquet.optionalDependencies ?? {}), false);
});
