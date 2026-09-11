// Accès gratuit réservé aux tests de l'exploitant.
//
// Le code vit dans une variable d'environnement (Render → Environment,
// `ASTROLAB_TEST_CODE`), jamais dans le dépôt et jamais dans le JavaScript
// envoyé au navigateur : le navigateur ne fait que transmettre ce que
// l'utilisateur tape, la décision est prise ici.
//
// Un code court serait devinable : en dessous de 12 caractères il est refusé, et
// les échecs répétés sont limités dans le temps (voir `createApp`).

const MIN_CODE_LENGTH = 12;
// Bornes de la limitation des tentatives, exportées pour que la route et ce
// module ne divergent pas sur les valeurs.
export const FAILURE_WINDOW_MS = 60 * 60 * 1000;
export const MAX_FAILURES_PER_WINDOW = 20;

export function testCodeConfiguration() {
  const code = String(process.env.ASTROLAB_TEST_CODE ?? "").trim();
  if (code.length < MIN_CODE_LENGTH) {
    return null;
  }
  return { code };
}

export function testCodeEnabled() {
  return Boolean(testCodeConfiguration());
}

// Comparaison à temps constant : on ne laisse pas fuiter le code caractère par
// caractère via le temps de réponse.
export function testCodeMatches(value) {
  const config = testCodeConfiguration();
  if (!config) {
    return false;
  }
  const candidate = String(value ?? "").trim();
  if (candidate.length !== config.code.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ config.code.charCodeAt(index);
  }
  return difference === 0;
}

// La limitation des tentatives ne vit plus ici.
//
// Elle était portée par un tableau au niveau du module, donc GLOBALE : vingt
// mauvais codes envoyés depuis n'importe où bloquaient le code de l'exploitant
// pendant une heure, pour tout le monde. C'était un déni de service sur son propre
// accès, pas une protection. Elle est maintenant par client (et plafonnée pour le
// service) dans `createApp`, avec les autres limites.
