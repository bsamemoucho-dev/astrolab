// Préversion (Vtest) : accès protégé et indexation interdite.
//
// Pourquoi ces deux garde-fous vivent dans le serveur et pas dans un réglage
// d'hébergeur : Render n'offre pas d'authentification HTTP sur un service, et
// une préversion non protégée qui génère des lectures est une fabrique de
// dossiers gratuits ouverte à Internet. Un service de test se protège donc
// lui-même, et refuse de démarrer en mode « ouvert par accident ».
//
//   ASTROLAB_PREVIEW_AUTH="utilisateur:motdepasse"  accès protégé (Basic)
//   ASTROLAB_NOINDEX=1                              x-robots-tag partout + robots.txt fermé
//
// Rien de tout cela n'est actif par défaut : la production ignore ces variables
// et garde exactement son comportement actuel.

import { createHash, timingSafeEqual } from "node:crypto";

export const PREVIEW_ROBOTS_BODY = "User-agent: *\nDisallow: /\n";

// Chemins laissés ouverts même quand l'accès est protégé :
//   - /healthz    : Render sonde le service ; une sonde ne sait pas s'authentifier,
//                   et un service marqué « unhealthy » est redémarré en boucle.
//   - /robots.txt : un moteur de recherche doit pouvoir lire l'interdiction.
export const PREVIEW_OPEN_PATHS = Object.freeze(["/healthz", "/robots.txt"]);

export function noindexEnabled() {
  return process.env.ASTROLAB_NOINDEX === "1";
}

/**
 * Lit ASTROLAB_PREVIEW_AUTH.
 * - désactivé : variable absente ou vide ;
 * - mal configuré : valeur présente mais sans « utilisateur:motdepasse ».
 *   Dans ce cas on ne désactive PAS la protection : une faute de frappe
 *   ouvrirait la préversion à tout le monde. On ferme (503) et on le dit.
 */
export function previewAuthConfig() {
  const raw = String(process.env.ASTROLAB_PREVIEW_AUTH ?? "").trim();
  if (!raw) {
    return { enabled: false, misconfigured: false };
  }
  const separator = raw.indexOf(":");
  const user = separator > 0 ? raw.slice(0, separator) : "";
  const password = separator > 0 ? raw.slice(separator + 1) : "";
  if (!user || !password) {
    return { enabled: true, misconfigured: true };
  }
  return { enabled: true, misconfigured: false, user, password };
}

function sameSecret(candidate, expected) {
  // Comparaison à temps constant : le nom d'utilisateur et le mot de passe ne
  // doivent pas être devinables en mesurant la durée de la réponse.
  const left = createHash("sha256").update(String(candidate)).digest();
  const right = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(left, right);
}

export function previewAuthorized(req) {
  const config = previewAuthConfig();
  if (!config.enabled) {
    return true;
  }
  if (config.misconfigured) {
    return false;
  }
  const header = String(req?.headers?.authorization ?? "");
  const match = header.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    return false;
  }
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator <= 0) {
    return false;
  }
  const userOk = sameSecret(decoded.slice(0, separator), config.user);
  const passwordOk = sameSecret(decoded.slice(separator + 1), config.password);
  return userOk && passwordOk;
}

export function previewPathIsOpen(pathname) {
  return PREVIEW_OPEN_PATHS.includes(pathname);
}

/**
 * Applique la protection à une requête. Renvoie `true` quand la requête peut
 * continuer, `false` quand une réponse a déjà été envoyée.
 */
export function enforcePreviewAccess(req, res, pathname, { securityHeaders }) {
  const config = previewAuthConfig();
  if (!config.enabled || previewPathIsOpen(pathname)) {
    return true;
  }
  const baseHeaders = {
    ...securityHeaders(),
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow"
  };
  if (config.misconfigured) {
    res.writeHead(503, { ...baseHeaders, "content-type": "text/plain; charset=utf-8" });
    res.end("Préversion indisponible : ASTROLAB_PREVIEW_AUTH doit contenir « utilisateur:motdepasse ».\n");
    return false;
  }
  if (!previewAuthorized(req)) {
    // Un 401 nu suffit à faire ouvrir la boîte de dialogue du navigateur, mais
    // un corps court évite de laisser croire à une panne.
    res.writeHead(401, {
      ...baseHeaders,
      "www-authenticate": 'Basic realm="Lastro Vtest", charset="UTF-8"',
      "content-type": "text/plain; charset=utf-8"
    });
    res.end("Accès réservé à la préversion Lastro.\n");
    return false;
  }
  return true;
}
