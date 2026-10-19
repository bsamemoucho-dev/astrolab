// Isolation de la préversion Vtest : accès protégé, indexation fermée, plafond
// de dépense LLM, et absence de référence absolue vers la production.
//
// Ces tests montent l'application réelle sur un port éphémère : ils vérifient le
// comportement HTTP, pas une fonction isolée.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import {
  assertLlmBudget,
  estimateCallCostUsd,
  llmBudgetPath,
  llmBudgetState,
  llmBudgetUsd,
  readLlmBudgetLedger,
  recordLlmSpend
} from "../src/deliverables/llmBudget.mjs";

const KEYS = [
  "ASTROLAB_NOINDEX",
  "ASTROLAB_PREVIEW_AUTH",
  "ASTROLAB_LLM_BUDGET_USD",
  "ASTROLAB_LLM_BUDGET_PATH",
  "ASTROLAB_DB_PATH",
  "ASTROLAB_LLM_API_KEY",
  "ASTROLAB_LLM_BASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY"
];

async function withEnv(values, run) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

async function startApp() {
  const { server, store } = createApp({ store: new JsonStore(null) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    store,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

const basic = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

test("sans variables de préversion, la production garde son comportement", async () => {
  await withEnv({}, async () => {
    const app = await startApp();
    try {
      const accueil = await fetch(`${app.baseUrl}/`, { redirect: "manual" });
      assert.equal(accueil.status, 200);
      assert.equal(accueil.headers.get("x-robots-tag"), null, "aucun noindex imposé par défaut");

      const robots = await fetch(`${app.baseUrl}/robots.txt`);
      assert.equal(robots.status, 200);
      const body = await robots.text();
      assert.match(body, /Sitemap: https:\/\/www\.lastro\.fr\/sitemap\.xml/, "le robots.txt servi est bien le fichier public");

      // La page d'accueil contient le nouveau texte (intégré dans la branche de test).
      const html = await accueil.text();
      assert.match(html, /Votre signe n’est que/);
      assert.match(html, /personne ne peut décider à votre place/);
    } finally {
      await app.close();
    }
  });
});

test("ASTROLAB_NOINDEX=1 ferme l'indexation partout", async () => {
  await withEnv({ ASTROLAB_NOINDEX: "1" }, async () => {
    const app = await startApp();
    try {
      for (const path of ["/", "/app.js", "/api/config", "/ciel/"]) {
        const reponse = await fetch(`${app.baseUrl}${path}`);
        assert.equal(reponse.status, 200, path);
        assert.equal(reponse.headers.get("x-robots-tag"), "noindex, nofollow", `en-tête manquant sur ${path}`);
      }
      const robots = await fetch(`${app.baseUrl}/robots.txt`);
      assert.equal(await robots.text(), "User-agent: *\nDisallow: /\n");
      // Le robots.txt reste lisible sans identifiants : un moteur doit pouvoir
      // lire l'interdiction, sinon il l'ignore.
      assert.equal(robots.status, 200);
    } finally {
      await app.close();
    }
  });
});

test("l'accès protégé exige le couple utilisateur:motdepasse", async () => {
  await withEnv({ ASTROLAB_PREVIEW_AUTH: "testeur:motdepasse-long-123" }, async () => {
    const app = await startApp();
    try {
      const sansIdentifiants = await fetch(`${app.baseUrl}/`);
      assert.equal(sansIdentifiants.status, 401);
      assert.match(sansIdentifiants.headers.get("www-authenticate") ?? "", /^Basic /);
      assert.equal(sansIdentifiants.headers.get("cache-control"), "no-store");

      const mauvaisMotDePasse = await fetch(`${app.baseUrl}/`, { headers: { authorization: basic("testeur", "autre") } });
      assert.equal(mauvaisMotDePasse.status, 401);

      const bon = await fetch(`${app.baseUrl}/`, { headers: { authorization: basic("testeur", "motdepasse-long-123") } });
      assert.equal(bon.status, 200);

      // L'API est protégée comme le reste : pas de contournement par /api.
      const api = await fetch(`${app.baseUrl}/api/config`);
      assert.equal(api.status, 401);

      // Sondes et robots restent ouverts, sinon Render redémarre le service.
      const sante = await fetch(`${app.baseUrl}/healthz`);
      assert.equal(sante.status, 200);
      assert.equal((await sante.json()).ok, true);
      assert.equal((await fetch(`${app.baseUrl}/robots.txt`)).status, 200);
    } finally {
      await app.close();
    }
  });
});

test("une valeur ASTROLAB_PREVIEW_AUTH mal formée ferme le service au lieu de l'ouvrir", async () => {
  await withEnv({ ASTROLAB_PREVIEW_AUTH: "sans-deux-points" }, async () => {
    const app = await startApp();
    try {
      const reponse = await fetch(`${app.baseUrl}/`);
      assert.equal(reponse.status, 503);
      assert.match(await reponse.text(), /utilisateur:motdepasse/);
      // La sonde de santé doit rester joignable, sinon Render boucle.
      assert.equal((await fetch(`${app.baseUrl}/healthz`)).status, 200);
    } finally {
      await app.close();
    }
  });
});

test("le plafond LLM est déjà publié dans /api/config quand il est configuré", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lastro-budget-"));
  try {
    await withEnv({ ASTROLAB_LLM_BUDGET_USD: "0.25", ASTROLAB_LLM_BUDGET_PATH: join(directory, "llm-budget.json") }, async () => {
      const app = await startApp();
      try {
        const config = await (await fetch(`${app.baseUrl}/api/config`)).json();
        assert.deepEqual(config.llmBudget, { enabled: true, capUsd: 0.25, spentUsd: 0, remainingUsd: 0.25, calls: 0 });
      } finally {
        await app.close();
      }
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("le plafond refuse l'appel suivant AVANT le réseau, puis s'arrête", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lastro-budget-"));
  const ledgerPath = join(directory, "llm-budget.json");
  try {
    await withEnv({ ASTROLAB_LLM_BUDGET_USD: "0.02", ASTROLAB_LLM_BUDGET_PATH: ledgerPath }, async () => {
      assert.equal(llmBudgetUsd(), 0.02);
      assert.equal(llmBudgetPath(), ledgerPath);
      assert.equal(readLlmBudgetLedger(ledgerPath).spentUsd, 0);

      // Estimation : un prompt de 4 000 caractères + 900 tokens de sortie sur un
      // modèle bon marché vaut bien moins que 2 cents → premier appel autorisé.
      const estimation = estimateCallCostUsd({ model: "gpt-4o-mini", promptChars: 4000, outputTokens: 900 });
      assert.ok(estimation.usd < 0.02, `estimation inattendue : ${estimation.usd}`);
      assert.doesNotThrow(() => assertLlmBudget({ model: "gpt-4o-mini", promptChars: 4000, outputTokens: 900 }));

      // Une dépense réelle (tokens facturés) au-delà du plafond.
      recordLlmSpend({ model: "gpt-4o-mini", usage: { promptTokens: 4000, completionTokens: 900 } });
      const ledger = readLlmBudgetLedger(ledgerPath);
      assert.ok(ledger.spentUsd > 0);
      assert.equal(ledger.calls, 1);

      // Un second appel coûteux est refusé AVANT le réseau, avec un code exploitable.
      let caught = null;
      try {
        // 2 M de caractères ≈ 500 000 tokens d'entrée : cet appel dépasserait à
        // lui seul le plafond encore disponible.
        assertLlmBudget({ model: "gpt-4o-mini", promptChars: 2_000_000, outputTokens: 4000 });
      } catch (error) {
        caught = error;
      }
      assert.ok(caught, "le dépassement aurait dû lever une erreur");
      assert.equal(caught.code, "llm_budget_exhausted");
      assert.equal(caught.status, 503);
      assert.match(caught.message, /Plafond de dépense LLM atteint/);
      assert.equal(caught.budget.capUsd, 0.02);

      // Le registre survit à une relecture (fichier JSON sur disque).
      const surDisque = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(surDisque.version, "lastro-llm-budget@1");
      assert.equal(surDisque.calls, 1);
      assert.equal(surDisque.spentUsd, ledger.spentUsd);

      const state = llmBudgetState();
      assert.equal(state.capUsd, 0.02);
      assert.equal(state.spentUsd, ledger.spentUsd);
      assert.equal(state.remainingUsd, Math.round((0.02 - ledger.spentUsd) * 1e6) / 1e6);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("un plafond dépensé ne bloque pas le service hors génération", async () => {
  // Le plafond ne doit jamais empêcher de consulter le site : seule la
  // génération est refusée.
  const directory = await mkdtemp(join(tmpdir(), "lastro-budget-"));
  try {
    await withEnv({ ASTROLAB_LLM_BUDGET_USD: "0.01", ASTROLAB_LLM_BUDGET_PATH: join(directory, "llm-budget.json") }, async () => {
      recordLlmSpend({ model: "gpt-4o-mini", usage: { promptTokens: 100_000, completionTokens: 100_000 } });
      const app = await startApp();
      try {
        assert.equal((await fetch(`${app.baseUrl}/`)).status, 200);
        const config = await (await fetch(`${app.baseUrl}/api/config`)).json();
        assert.equal(config.llmBudget.remainingUsd, 0);
      } finally {
        await app.close();
      }
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("aucune référence absolue du navigateur vers la production", async () => {
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  // Toutes les API doivent rester relatives : un appel absolu enverrait les
  // données d'un testeur à la production.
  assert.doesNotMatch(appJs, /https?:\/\/[^"' ]*lastro\.fr/);
  assert.doesNotMatch(appJs, /https?:\/\/[^"' ]*onrender\.com/);
  const absolus = [...appJs.matchAll(/["'](https?:\/\/[^"']+)["']/g)].map((match) => match[1]);
  const autorises = (url) =>
    url.startsWith("https://unpkg.com/leaflet@") ||
    url.startsWith("https://{s}.tile.openstreetmap.org/") ||
    url.startsWith("https://www.openstreetmap.org/") ||
    url.startsWith("https://js.stripe.com/") ||
    url.startsWith("https://cdn.jsdelivr.net/"); // icônes de pays, si présentes
  const inattendus = absolus.filter((url) => !autorises(url));
  assert.deepEqual(inattendus, [], `URL absolues inattendues : ${inattendus.join(", ")}`);
});

test("le blueprint Render décrit un service de test isolé", async () => {
  const yaml = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
  assert.match(yaml, /name: lastro-vtest/);
  assert.match(yaml, /branch: vtest/);
  assert.match(yaml, /mountPath: \/var\/data/);
  assert.match(yaml, /ASTROLAB_NOINDEX/);
  assert.match(yaml, /ASTROLAB_PREVIEW_AUTH/);
  assert.match(yaml, /healthCheckPath: \/healthz/);
  // Aucune clé Stripe dans le blueprint : le paiement de test doit rester absent.
  assert.doesNotMatch(yaml, /STRIPE_/);
  assert.doesNotMatch(yaml, /BREVO_API_KEY/);
});
