// Empreinte du code servi.
//
// Pourquoi : après un déploiement, plusieurs vérifications ont été faites « au
// feeling » — le site sert-il bien la version qui vient d'être poussée ? Les
// protections du tunnel payant, en particulier, ne se déclenchent que dans des
// situations qu'on ne provoque pas volontairement en production : impossible de
// les observer pour deviner la version. Une empreinte répond à la question en
// une commande, sans exposer autre chose qu'un condensat de fichiers PUBLICS
// (le dépôt l'est aussi).

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Ce qui est couvert : TOUT le code du serveur et ce que le navigateur reçoit.
//
// Une première version ne hachait que quatre fichiers choisis à la main, et la
// question « est-ce que ma correction de marges est en ligne ? » n'avait toujours
// pas de réponse : `render.mjs`, qui décide de la mise en page, n'y était pas. Une
// empreinte qui ne bouge pas quand le document change ne sert à rien.
export const RELEASE_FILES = Object.freeze([
  "src",
  "public/app.js",
  "public/index.html",
  "public/styles.css"
]);

const EXTENSIONS = /\.(mjs|js|html|css)$/;

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Un fichier, ou tous ceux d'un dossier, dans un ordre stable.
function fichiers(racine, relatif) {
  const complet = join(racine, relatif);
  try {
    const entrees = statSync(complet).isDirectory()
      ? readdirSync(complet, { recursive: true })
          .map((entree) => String(entree))
          .filter((entree) => EXTENSIONS.test(entree))
          .map((entree) => join(relatif, entree))
      : [relatif];
    return entrees.sort();
  } catch {
    return [`${relatif}:absent`];
  }
}

export function releaseFingerprint({ racine = RACINE } = {}) {
  const empreintes = RELEASE_FILES.flatMap((relatif) => fichiers(racine, relatif)).map((relatif) => {
    try {
      const contenu = readFileSync(join(racine, relatif));
      return `${relatif}:${createHash("sha256").update(contenu).digest("hex")}`;
    } catch {
      // Fichier absent (paquet incomplet) : on le dit dans l'empreinte plutôt que
      // de renvoyer une empreinte qui aurait l'air valide.
      return `${relatif}:absent`;
    }
  });
  return createHash("sha256").update(empreintes.join("\n")).digest("hex").slice(0, 12);
}

let cache = null;

// Calculée une fois : les fichiers ne changent pas pendant que le service tourne.
export function releaseInfo() {
  if (!cache) {
    cache = { fingerprint: releaseFingerprint(), files: [...RELEASE_FILES] };
  }
  return cache;
}
