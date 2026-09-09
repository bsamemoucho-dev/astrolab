// Minimal .env loader (no external dependency, Node >= 20 compatible).
// Reads KEY=VALUE lines from the given file (default ".env" in cwd) and sets
// process.env entries only when not already defined (real environment wins).

import { readFileSync } from "node:fs";

export function loadDotEnv(filePath = ".env") {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return; // no .env file: fine
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
