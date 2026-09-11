import { pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const PASSWORD_ITERATIONS = 210000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

// Forme d'une adresse acceptée pour créer un compte.
//
// `includes("@")` laissait passer `<svg/onload=…>@x.co` : une adresse qui n'en
// est pas une, stockée telle quelle, puis affichée dans le panneau
// d'administration. Refuser ce qui ne peut pas être une adresse est une question
// de correction avant d'être une question de sécurité — l'échappement à
// l'affichage reste la protection qui compte, celle-ci ferme la porte en amont.
const EMAIL_PATTERN = /^[^\s<>"'@\\/,;]+@[^\s<>"'@\\/,;]+\.[^\s<>"'@\\/,;]{2,}$/;

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  ).toString("base64url");

  return `pbkdf2:${PASSWORD_DIGEST}:${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password, encoded) {
  const [kind, digest, iterations, salt, expected] = String(encoded).split(":");
  if (kind !== "pbkdf2" || !digest || !iterations || !salt || !expected) {
    return false;
  }

  const actual = pbkdf2Sync(
    password,
    salt,
    Number(iterations),
    PASSWORD_KEY_LENGTH,
    digest
  );
  const expectedBuffer = Buffer.from(expected, "base64url");

  if (actual.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actual, expectedBuffer);
}

// `randomInt` et non `Math.random()` : ce code à six chiffres valide l'adresse
// d'un compte, donc en prend le contrôle tant qu'elle n'est pas vérifiée. La
// suite de `Math.random()` est prévisible dès qu'on en observe quelques sorties,
// et un inscrit peut en observer autant qu'il veut en créant des comptes. Le
// reste de ce fichier utilisait déjà `randomBytes` et `timingSafeEqual` :
// c'était le seul appel non cryptographique.
export function createVerificationCode() {
  return String(randomInt(100000, 1000000));
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function isStrongEnoughPassword(password) {
  return typeof password === "string" && password.length >= 10;
}

