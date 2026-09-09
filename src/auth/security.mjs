import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const PASSWORD_ITERATIONS = 210000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
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

export function createVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function isStrongEnoughPassword(password) {
  return typeof password === "string" && password.length >= 10;
}

