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
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Les fichiers qui portent les décisions visibles depuis l'extérieur : les
// routes et les règles de prix côté serveur, ce que le navigateur exécute et
// affiche côté client.
export const RELEASE_FILES = Object.freeze([
  "src/http/app.mjs",
  "src/payments/pricing.mjs",
  "public/app.js",
  "public/index.html"
]);

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function releaseFingerprint({ racine = RACINE } = {}) {
  const empreintes = RELEASE_FILES.map((relatif) => {
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
