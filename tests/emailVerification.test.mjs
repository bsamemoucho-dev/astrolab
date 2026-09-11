// Vérification d'adresse à l'inscription, et empreinte de version.
//
// Deux sujets liés par la même question : ce que la production fait vraiment.
//   1. `ASTROLAB_EMAIL_MODE` était décoratif : la variable était annoncée dans
//      /api/config mais le code de vérification était TOUJOURS renvoyé dans la
//      réponse HTTP. Avec les inscriptions ouvertes, n'importe qui pouvait
//      valider l'adresse d'un autre. Elle est maintenant réelle.
//   2. Rien ne permettait de dire quelle version tournait réellement en
//      production. /healthz porte désormais une empreinte du code servi.

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { releaseFingerprint, RELEASE_FILES } from "../src/http/release.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";
import { emailVerificationMode, verificationEmail } from "../src/notifications/mailer.mjs";

const KEYS = ["ASTROLAB_EMAIL_MODE", "BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"];

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
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    store,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function post(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }).then(async (response) => ({ status: response.status, payload: await response.json().catch(() => null) }));
}

const INSCRIPTION = { email: "client@example.test", password: "correct horse battery", language: "fr" };

// Faux Brevo : capture les envois sans réseau.
function withBrevo(run) {
  const original = globalThis.fetch;
  const envois = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.brevo.com")) {
      envois.push(JSON.parse(init.body));
      return { ok: true, status: 201, json: async () => ({ messageId: "test" }) };
    }
    return original(url, init);
  };
  return Promise.resolve(run(envois)).finally(() => {
    globalThis.fetch = original;
  });
}

const BREVO_KEYS = { BREVO_API_KEY: "xkeysib-test", BREVO_SENDER_EMAIL: "info@lastro.test" };

test("par défaut, le code reste affiché (développement)", async () => {
  await withEnv({}, async () => {
    assert.equal(emailVerificationMode(), "dev_code");
    const app = await startApp();
    try {
      const reponse = await post(app.baseUrl, "/api/auth/register", INSCRIPTION);
      assert.equal(reponse.status, 201);
      assert.match(reponse.payload.devVerificationCode, /^\d+$/);
      const config = await (await fetch(`${app.baseUrl}/api/config`)).json();
      assert.equal(config.emailVerificationMode, "dev_code");
    } finally {
      await app.close();
    }
  });
});

test("en mode e-mail, le code part par e-mail et n'est PAS renvoyé", async () => {
  await withEnv({ ...BREVO_KEYS, ASTROLAB_EMAIL_MODE: "email" }, () =>
    withBrevo(async (envois) => {
      const app = await startApp();
      try {
        const reponse = await post(app.baseUrl, "/api/auth/register", INSCRIPTION);
        assert.equal(reponse.status, 201);
        // Le point capital : aucun code dans la réponse HTTP.
        assert.equal("devVerificationCode" in reponse.payload, false);
        assert.equal(reponse.payload.verificationEmailSent, true);
        assert.match(reponse.payload.user.email, /client@example\.test/);

        // L'e-mail est parti, dans la langue du client, avec un code.
        assert.equal(envois.length, 1);
        assert.match(envois[0].to[0].email, /client@example\.test/);
        assert.match(envois[0].textContent, /code de vérification/i);
        const code = /(\d{4,8})/.exec(envois[0].textContent)?.[1];
        assert.ok(code, "le code est dans l'e-mail");

        // Et ce code permet bien de vérifier l'adresse.
        const verification = await post(app.baseUrl, "/api/auth/verify", { email: INSCRIPTION.email, code });
        assert.equal(verification.status, 200);

        const state = await app.store.load();
        assert.equal(state.outbox[0].sentAt !== undefined, true, "le message est marqué envoyé");
      } finally {
        await app.close();
      }
    })
  );
});

test("en mode e-mail, l'envoi impossible ne divulgue pas le code", async () => {
  // Brevo non configuré : l'envoi échoue. Le code ne doit pas être renvoyé
  // « pour rendre service » — c'est exactement la faille qu'on ferme.
  await withEnv({ ASTROLAB_EMAIL_MODE: "email" }, async () => {
    const app = await startApp();
    try {
      const reponse = await post(app.baseUrl, "/api/auth/register", INSCRIPTION);
      assert.equal(reponse.status, 201);
      assert.equal("devVerificationCode" in reponse.payload, false);
      assert.equal(reponse.payload.verificationEmailSent, false);
      // Le message reste dans la file : rien n'est perdu, l'exploitant peut le
      // renvoyer une fois Brevo configuré.
      const state = await app.store.load();
      assert.equal(state.outbox.length, 1);
      assert.equal(state.outbox[0].sentAt, undefined);
    } finally {
      await app.close();
    }
  });
});

test("une valeur inconnue ferme la faille au lieu de la rouvrir", async () => {
  for (const valeur of ["email", "EMAIL", "mail", "brevo", "true", "n'importe quoi"]) {
    await withEnv({ ASTROLAB_EMAIL_MODE: valeur }, async () => {
      assert.equal(emailVerificationMode(), "email", `« ${valeur} » doit être traité comme un envoi par e-mail`);
    });
  }
  // Le mode de développement doit rester accessible explicitement.
  await withEnv({ ASTROLAB_EMAIL_MODE: "dev_code" }, async () => {
    assert.equal(emailVerificationMode(), "dev_code");
  });
});

test("l'e-mail de vérification existe dans les neuf langues", () => {
  const codes = ["fr", "en", "de", "es", "it", "pt", "no", "da", "nl"];
  const sujets = new Set();
  for (const code of codes) {
    const courriel = verificationEmail(code, "123456");
    assert.match(courriel.body, /123456/, `${code} : le code doit figurer dans le corps`);
    assert.equal(courriel.subject.length > 5, true, `${code} : un objet est nécessaire`);
    assert.doesNotMatch(courriel.subject, /undefined/, code);
    sujets.add(courriel.subject);
  }
  // Une langue inconnue retombe sur l'anglais plutôt que sur du français.
  assert.match(verificationEmail("zz", "123456").subject, /Lastro verification code/);
});

test("/healthz porte une empreinte du code servi", async () => {
  const app = await startApp();
  try {
    const premier = await (await fetch(`${app.baseUrl}/healthz`)).json();
    assert.match(premier.release, /^[0-9a-f]{12}$/);
    const deuxieme = await (await fetch(`${app.baseUrl}/healthz`)).json();
    assert.equal(deuxieme.release, premier.release, "l'empreinte est stable");
    // L'empreinte locale est celle que la production doit annoncer après déploiement.
    assert.equal(premier.release, releaseFingerprint());
  } finally {
    await app.close();
  }
});

test("l'empreinte change quand un fichier suivi change", () => {
  const racine = mkdtempSync(join(tmpdir(), "lastro-release-"));
  try {
    for (const relatif of RELEASE_FILES) {
      cpSync(new URL(`../${relatif}`, import.meta.url).pathname, join(racine, relatif), { recursive: true });
    }
    const avant = releaseFingerprint({ racine });
    assert.equal(avant, releaseFingerprint({ racine }), "deux calculs identiques donnent la même empreinte");

    // Modifier un seul fichier change l'empreinte : c'est toute la propriété utile.
    const cible = join(racine, "public/app.js");
    writeFileSync(cible, `${readFileSync(cible, "utf8")}\n// changement\n`);
    assert.notEqual(releaseFingerprint({ racine }), avant);

    // Un fichier manquant ne doit pas produire une empreinte qui a l'air valide
    // tout en étant identique à celle d'une autre version incomplète.
    rmSync(cible);
    const incomplet = releaseFingerprint({ racine });
    assert.notEqual(incomplet, avant);
    assert.notEqual(incomplet, releaseFingerprint({ racine: tmpdir() }));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test("le site ne dit jamais qu'un code a été envoyé s'il ne l'a pas été", () => {
  // Contrôle statique : la phrase affichée dépend de `verificationEmailSent`,
  // jamais du seul fait que le compte a été créé.
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(source, /result\.verificationEmailSent\s*\?\s*t\.registerEmailSent\s*:\s*t\.registerEmailFailed/);
  assert.match(source, /result\.devVerificationCode\s*\?\s*fillTemplate\(t\.registerDevCode/);
  for (const cle of ["registerEmailSent", "registerEmailFailed", "registerDevCode"]) {
    const occurrences = (source.match(new RegExp(`${cle}:`, "g")) ?? []).length;
    assert.equal(occurrences, 9, `${cle} doit être traduit dans les neuf langues (${occurrences})`);
  }
});

test("l'empreinte couvre le moteur du document, pas seulement les routes", () => {
  // Leçon : la première empreinte ne hachait que quatre fichiers choisis à la main,
  // et ne bougeait pas quand la mise en page changeait — donc elle ne répondait pas
  // à la question qu'on lui posait.
  const dossier = new URL("../src/deliverables/", import.meta.url).pathname;
  const suivi = RELEASE_FILES.some((entree) => entree === "src");
  assert.equal(suivi, true, "tout le code du serveur doit être couvert");
  for (const fichier of ["render.mjs", "chart.mjs", "socle.mjs", "pdfRenderer.mjs", "validator.mjs"]) {
    const racine = mkdtempSync(join(tmpdir(), "lastro-release2-"));
    try {
      for (const relatif of RELEASE_FILES) {
        cpSync(new URL(`../${relatif}`, import.meta.url).pathname, join(racine, relatif), { recursive: true });
      }
      const avant = releaseFingerprint({ racine });
      writeFileSync(join(racine, "src/deliverables", fichier), `${readFileSync(join(dossier, fichier), "utf8")}\n// marque\n`);
      assert.notEqual(releaseFingerprint({ racine }), avant, `modifier ${fichier} doit changer l'empreinte`);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  }
});
