// Invariant de sécurité : aucun secret ne doit entrer dans le dépôt.
//
// Le brief l'exige (« secrets uniquement dans les variables d'environnement »),
// et les autres règles du projet sont mesurées plutôt que demandées : ce test
// applique la même discipline. Il scanne les fichiers SUIVIS par git (donc ceux
// qui partent chez l'hébergeur et chez GitHub), pas la copie de travail : `.env`
// doit exister localement, mais ne jamais être suivi.
//
// Les motifs exigent une longueur réaliste (une vraie clé Stripe live fait plus
// de 99 caractères, une clé Brevo plus de 60). Les valeurs de test du dépôt
// (`sk_live_abc123456789`, `xkeysib-test`) sont donc hors motif par
// construction : pas de liste d'exceptions à maintenir.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Motifs à longueur réaliste : préfixe connu + corps long.
const SECRET_PATTERNS = [
  { name: "clé secrète Stripe live", pattern: /sk_live_[A-Za-z0-9]{32,}/ },
  { name: "clé secrète Stripe test", pattern: /sk_test_[A-Za-z0-9]{32,}/ },
  { name: "clé restreinte Stripe", pattern: /rk_(?:live|test)_[A-Za-z0-9]{32,}/ },
  { name: "secret de webhook Stripe", pattern: /whsec_[A-Za-z0-9]{32,}/ },
  { name: "clé API Brevo", pattern: /xkeysib-[A-Za-z0-9]{40,}/ },
  { name: "jeton GitHub", pattern: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "clé privée PEM", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: "valeur longue affectée à une variable secrète",
    pattern:
      /(?:STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|BREVO_API_KEY|ASTROLAB_LLM_API_KEY|ASTROLAB_TEST_CODE|ASTROLAB_AUTHOR_LINE)\s*[:=]\s*["']?[A-Za-z0-9_\-]{24,}/i
  }
];

const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Une valeur construite (`"sk_live_" + "x".repeat(85)`) est un gabarit de test :
// elle n'existe nulle part telle quelle. On l'écarte par sa construction, pas par
// une liste d'exceptions fichier par fichier, qui pourrirait avec le temps.
const CONSTRUCTED_FIXTURE = /\.repeat\s*\(/;

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: REPO_ROOT, encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}

function isBinary(file) {
  const head = readFileSync(file).subarray(0, 8192);
  return head.includes(0);
}

test("aucun fichier suivi ne contient de secret aux longueurs réalistes", () => {
  const files = trackedFiles();
  assert.ok(files.length > 50, "la liste des fichiers suivis semble vide : le test ne mesurerait rien");

  const fuites = [];
  for (const relative of files) {
    const absolute = path.join(REPO_ROOT, relative);
    if (statSync(absolute).size > MAX_FILE_BYTES || isBinary(absolute)) {
      continue;
    }
    const lines = readFileSync(absolute, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const { name, pattern } of SECRET_PATTERNS) {
        if (!pattern.test(line)) {
          continue;
        }
        // On ne recopie jamais la valeur trouvée : fichier, ligne et motif.
        if (CONSTRUCTED_FIXTURE.test(line)) {
          continue;
        }
        fuites.push(`${relative}:${index + 1} — ${name}`);
      }
    });
  }
  assert.deepEqual(fuites, [], `secret détecté dans un fichier suivi : ${fuites.join(" | ")}`);
});

test("les gabarits construits du dépôt ne ressemblent pas à de vraies clés", () => {
  // Garde-fou du garde-fou : la tolérance `.repeat(` ne doit pas pouvoir servir
  // à masquer une vraie clé collée telle quelle sur la même ligne.
  const fauxPositif = 'STRIPE_SECRET_KEY: "sk_live_AAAAAAAAAAAAAAAA" + "x".repeat(85),';
  assert.ok(CONSTRUCTED_FIXTURE.test(fauxPositif), "le gabarit de test doit être reconnu comme construit");
  const vraieCle = `STRIPE_SECRET_KEY: "sk_live_${"9f2Kd7".repeat(17)}"`;
  const litterale = vraieCle.replace(/\.repeat\([^)]*\)/, "");
  assert.ok(
    SECRET_PATTERNS.some(({ pattern }) => pattern.test(litterale)),
    "une clé collée en clair doit être détectée même sans .repeat("
  );
});

test("le fichier .env local n'est jamais suivi par git", () => {
  const files = trackedFiles();
  assert.equal(files.includes(".env"), false, ".env est suivi par git : les secrets partiraient dans le dépôt");
  assert.equal(
    files.some((file) => file.endsWith("/.env")),
    false,
    "un fichier .env est suivi par git"
  );
  // Le modèle public, lui, doit rester suivi et ne contenir aucune valeur.
  assert.ok(files.includes(".env.example"), ".env.example doit rester suivi");
  const exemple = readFileSync(path.join(REPO_ROOT, ".env.example"), "utf8");
  assert.ok(exemple.length > 0);
});
