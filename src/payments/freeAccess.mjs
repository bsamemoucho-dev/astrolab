// Accès gratuit réservé aux tests de l'exploitant.
//
// Le code vit dans une variable d'environnement (Render → Environment,
// `ASTROLAB_TEST_CODE`), jamais dans le dépôt et jamais dans le JavaScript
// envoyé au navigateur : le navigateur ne fait que transmettre ce que
// l'utilisateur tape, la décision est prise ici.
//
// Un code court serait devinable : en dessous de 12 caractères il est refusé,
// et les échecs répétés sont limités dans le temps.

const MIN_CODE_LENGTH = 12;
const FAILURE_WINDOW_MS = 60 * 60 * 1000;
const MAX_FAILURES_PER_WINDOW = 20;

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

const failures = [];

function pruneFailures() {
  const now = Date.now();
  while (failures.length > 0 && now - failures[0] > FAILURE_WINDOW_MS) {
    failures.shift();
  }
}

export function testCodeRateLimited() {
  pruneFailures();
  return failures.length >= MAX_FAILURES_PER_WINDOW;
}

export function registerTestCodeFailure() {
  pruneFailures();
  failures.push(Date.now());
  return failures.length;
}

// Utilisé par les tests automatisés.
export function resetTestCodeFailures() {
  failures.length = 0;
}
