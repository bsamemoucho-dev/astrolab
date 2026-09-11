// Conversion HTML → PDF, côté serveur, derrière un drapeau.
//
// Pourquoi un navigateur : le document livré est une page HTML/CSS (couverture
// pleine page, roue du ciel en SVG, sauts de page). La seule façon d'en faire un
// PDF fidèle est de la faire rendre par un moteur qui l'affiche. Un convertisseur
// « texte + styles simples » ne saurait pas rendre la roue ni les sauts de page.
//
// Le drapeau. Sans `ASTROLAB_PDF_RENDERER=chromium`, ce module ne charge AUCUNE
// dépendance et ne lance AUCUN processus : la route PDF répond « indisponible » et
// le bouton du site retombe sur la fenêtre d'impression du navigateur. C'est le
// choix par défaut, parce qu'un navigateur sans écran coûte de la mémoire et que
// le tunnel payant ne doit pas tomber avec lui. Le paquet n'est pas déclaré dans
// `package.json` : il est installé dans l'image seulement quand le drapeau de
// construction est activé (voir Dockerfile). Le dépôt garde ainsi une seule
// dépendance d'exécution, `astronomy-engine`.
//
// Ce que le rendu reproduit exactement : le modèle d'impression du document
// (`@page { size: A4; margin: 0 }` + feuille à 20 mm), les fonds (couverture,
// pastilles, barres) et — contrairement à la fenêtre d'impression — NI date, NI
// URL, NI numéro de page ajoutés par le navigateur.
//
// Une seule conversion à la fois : deux rendus simultanés doubleraient le pic de
// mémoire pour aucun gain, et une panne de rendu ne doit pas emporter le service.
// Un navigateur qui a échoué est fermé et n'est jamais réutilisé.

import { existsSync } from "node:fs";

export const PDF_UNAVAILABLE_CODE = "pdf_renderer_unavailable";
export const PDF_FAILED_CODE = "pdf_render_failed";
export const PDF_TIMEOUT_CODE = "pdf_render_timeout";
// File saturée : mieux vaut le dire tout de suite (le site retombe sur
// l'impression) que d'empiler des rendus en mémoire.
export const PDF_BUSY_CODE = "pdf_renderer_busy";

const CHROMIUM_CANDIDATES = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/lib/chromium/chrome"];
const DRAPEAUX_ACTIFS = new Set(["chromium", "1", "true", "yes", "on"]);

function entierPositif(valeur, defaut) {
  const nombre = Number(valeur);
  return Number.isInteger(nombre) && nombre > 0 ? nombre : defaut;
}

// Configuration lue à chaque démarrage. `null` = pas de rendu automatique.
export function pdfRendererConfiguration(env = process.env) {
  const drapeau = String(env.ASTROLAB_PDF_RENDERER ?? "").trim().toLowerCase();
  if (!DRAPEAUX_ACTIFS.has(drapeau)) {
    return null;
  }
  const declare = String(env.ASTROLAB_CHROMIUM_PATH ?? "").trim();
  return {
    renderer: "chromium",
    executablePath: declare || CHROMIUM_CANDIDATES.find((chemin) => existsSync(chemin)) || CHROMIUM_CANDIDATES[0],
    timeoutMs: entierPositif(env.ASTROLAB_PDF_TIMEOUT_MS, 45000),
    // Marge au-delà du délai de page avant de couper court : le moteur peut
    // dépasser légèrement son propre délai sans être réellement bloqué.
    graceMs: entierPositif(env.ASTROLAB_PDF_GRACE_MS, 5000),
    idleCloseMs: entierPositif(env.ASTROLAB_PDF_IDLE_CLOSE_MS, 120000),
    // Nombre de conversions en attente tolérées : au-delà, on refuse plutôt que
    // d'accumuler des documents en mémoire.
    maxQueue: entierPositif(env.ASTROLAB_PDF_MAX_QUEUE, 4),
    moduleName: String(env.ASTROLAB_PDF_MODULE ?? "puppeteer-core").trim() || "puppeteer-core"
  };
}

export class PdfRenderError extends Error {
  constructor(message, { code = PDF_FAILED_CODE, cause = null } = {}) {
    super(message);
    this.name = "PdfRenderError";
    this.code = code;
    this.cause = cause;
  }
}

// Un manque d'outil dans l'environnement n'est pas une panne de rendu : le premier
// veut dire « ce site n'a pas de moteur PDF », le second « le moteur a échoué ».
function traduire(error) {
  if (error instanceof PdfRenderError) {
    return error;
  }
  const code = error?.code ?? "";
  const message = String(error?.message ?? error);
  const environnement =
    code === "ERR_MODULE_NOT_FOUND" ||
    code === "ENOENT" ||
    /cannot find (module|package)/i.test(message) ||
    /could not find chrome|failed to launch the browser|no such file or directory/i.test(message);
  return new PdfRenderError(message, { code: environnement ? PDF_UNAVAILABLE_CODE : PDF_FAILED_CODE, cause: error });
}

// `launch` est injectable : les tests vérifient le contrat (une conversion à la
// fois, options d'impression, délai respecté, navigateur fermé après panne) sans
// navigateur installé.
export function createPdfRenderer(configuration, { launch = null } = {}) {
  let navigateur = null;
  let minuteurFermeture = null;
  let file = Promise.resolve();
  let enAttente = 0;
  let rendus = 0;
  let dernierEchec = null;

  async function fabriquer() {
    if (launch) {
      return launch();
    }
    const charge = await import(configuration.moduleName);
    const puppeteer = charge.default ?? charge;
    return puppeteer.launch({
      executablePath: configuration.executablePath,
      headless: true,
      args: [
        // Le conteneur tourne en root : sans ce drapeau, Chromium refuse de démarrer.
        "--no-sandbox",
        // /dev/shm est petit dans Docker : sans ceci, les grosses pages plantent.
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none"
      ]
    });
  }

  async function obtenirNavigateur() {
    if (!navigateur) {
      navigateur = fabriquer().catch((error) => {
        navigateur = null;
        throw traduire(error);
      });
    }
    return navigateur;
  }

  async function fermer() {
    if (minuteurFermeture) {
      clearTimeout(minuteurFermeture);
      minuteurFermeture = null;
    }
    const courant = navigateur;
    navigateur = null;
    if (courant) {
      try {
        const instance = await courant;
        await instance.close();
      } catch {
        // Fermer un navigateur déjà mort n'est pas une erreur à remonter.
      }
    }
  }

  function programmerFermeture() {
    if (minuteurFermeture) {
      clearTimeout(minuteurFermeture);
    }
    minuteurFermeture = setTimeout(() => {
      void fermer();
    }, configuration.idleCloseMs);
    // Le minuteur ne doit pas maintenir le processus en vie.
    minuteurFermeture.unref?.();
  }

  async function rendreUneFois(html) {
    let page = null;
    try {
      const instance = await obtenirNavigateur();
      page = await instance.newPage();
      await page.setContent(html, { waitUntil: "load", timeout: configuration.timeoutMs });
      const pdf = await page.pdf({
        // Le document déclare sa propre page (`@page { size: A4; margin: 0 }`) et
        // ses marges de 2 cm : le rendu suit le CSS, pas un réglage du moteur.
        preferCSSPageSize: true,
        // Couverture, pastilles, barres et zones de la roue sont des fonds.
        printBackground: true,
        // Ni date, ni URL, ni numéro de page : c'est la fenêtre d'impression du
        // navigateur qui les ajoute, pas le moteur.
        displayHeaderFooter: false,
        timeout: configuration.timeoutMs
      });
      rendus += 1;
      programmerFermeture();
      return pdf;
    } catch (error) {
      const traduit = traduire(error);
      dernierEchec = { code: traduit.code, message: traduit.message.slice(0, 200), at: new Date().toISOString() };
      // Un navigateur qui a échoué n'est jamais réutilisé.
      await fermer();
      throw traduit;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  async function rendre(html) {
    const maximum = configuration.maxQueue ?? 4;
    if (enAttente >= maximum) {
      throw new PdfRenderError(`Trop de conversions PDF en attente (${enAttente}).`, { code: PDF_BUSY_CODE });
    }
    enAttente += 1;
    const precedent = file;
    let liberer;
    file = new Promise((resolve) => {
      liberer = resolve;
    });
    await precedent;
    try {
      const travail = rendreUneFois(String(html ?? ""));
      // Le délai peut gagner la course : la promesse perdante ne doit pas faire
      // tomber le processus (rejet non traité).
      travail.catch(() => {});
      let minuteur = null;
      const delai = new Promise((_resolve, rejeter) => {
        minuteur = setTimeout(() => {
          rejeter(new PdfRenderError(`Le rendu PDF n'a pas abouti en ${configuration.timeoutMs} ms.`, { code: PDF_TIMEOUT_CODE }));
        }, configuration.timeoutMs + (configuration.graceMs ?? 5000));
        minuteur.unref?.();
      });
      try {
        return await Promise.race([travail, delai]);
      } catch (error) {
        const traduit = traduire(error);
        dernierEchec = { code: traduit.code, message: traduit.message.slice(0, 200), at: new Date().toISOString() };
        if (traduit.code === PDF_TIMEOUT_CODE) {
          // Un rendu bloqué laisse un navigateur inutilisable : on le ferme.
          await fermer();
        }
        throw traduit;
      } finally {
        if (minuteur) {
          clearTimeout(minuteur);
        }
      }
    } finally {
      enAttente -= 1;
      liberer();
    }
  }

  return {
    renderer: configuration.renderer,
    executablePath: configuration.executablePath,
    render: rendre,
    close: fermer,
    status: () => ({ renderer: configuration.renderer, rendered: rendus, pending: enAttente, lastFailure: dernierEchec })
  };
}

let singleton = null;
let signature = null;

// Une instance par processus, recréée seulement si la configuration change.
export function defaultPdfRenderer(env = process.env) {
  const configuration = pdfRendererConfiguration(env);
  if (!configuration) {
    singleton = null;
    signature = null;
    return null;
  }
  const empreinte = JSON.stringify(configuration);
  if (!singleton || signature !== empreinte) {
    singleton = createPdfRenderer(configuration);
    signature = empreinte;
  }
  return singleton;
}

export function resetDefaultPdfRenderer() {
  singleton = null;
  signature = null;
}

// Nom du fichier téléchargé : le titre du document, réduit à de l'ASCII pour
// traverser tous les systèmes sans mauvaise surprise d'encodage d'en-tête.
export function pdfFileNameFromHtml(html, secours = "lastro-lecture") {
  const titre = /<title[^>]*>([^<]*)<\/title>/i.exec(String(html ?? ""))?.[1] ?? "";
  const base = (titre.trim() || secours)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || secours}.pdf`;
}
