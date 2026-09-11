// Code de vérification : durée de vie, essais, renvoi.
//
// Motif : un code à six chiffres était comparé sans limite d'essais et sans
// expiration, et il n'existait aucun moyen d'en obtenir un autre. Fermer la fuite
// du code affiché (mode e-mail) rendait ce manque visible : sans renvoi, un client
// qui ne reçoit rien est bloqué — il ne peut ni vérifier, ni se réinscrire (409).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";
import {
  CODE_TTL_MS,
  MAX_RESENDS_PER_ADDRESS_PER_HOUR,
  MAX_VERIFICATION_ATTEMPTS,
  resetResendLimits,
  verificationCheck
} from "../src/auth/verification.mjs";

const KEYS = ["ASTROLAB_EMAIL_MODE", "BREVO_API_KEY", "BREVO_SENDER_EMAIL"];

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

const EMAIL = "verif@example.test";
const PASSWORD = "correct horse battery";

async function inscrire(app, extra = {}) {
  const reponse = await post(app.baseUrl, "/api/auth/register", { email: EMAIL, password: PASSWORD, language: "fr", ...extra });
  assert.equal(reponse.status, 201);
  return reponse.payload;
}

test("cinq essais faux invalident le code, et le compteur est bien enregistré", async () => {
  // Le piège : `store.transact` annule tout si le mutateur lève une erreur. Un
  // compteur incrémenté puis annulé ne limiterait rien — 900 000 combinaisons se
  // devinaient alors sans limite.
  await withEnv({}, async () => {
    const app = await startApp();
    try {
      const creation = await inscrire(app);
      const bon = creation.devVerificationCode;
      for (let essai = 1; essai <= MAX_VERIFICATION_ATTEMPTS; essai += 1) {
        const refus = await post(app.baseUrl, "/api/auth/verify", { email: EMAIL, code: "000000" });
        assert.equal(refus.status, 401, `essai ${essai}`);
        assert.equal(refus.payload.code, "verification_code_rejected");
      }

      // La transaction a bien été conservée malgré le refus.
      const state = await app.store.load();
      assert.equal(state.users[0].verificationAttempts, MAX_VERIFICATION_ATTEMPTS);
      assert.equal(state.users[0].verificationCode, null, "le code est mort après cinq essais");

      // Même le bon code ne repasse plus.
      const apres = await post(app.baseUrl, "/api/auth/verify", { email: EMAIL, code: bon });
      assert.equal(apres.status, 401);
      assert.equal(apres.payload.code, "verification_code_rejected");
    } finally {
      await app.close();
    }
  });
});

test("un code expiré est refusé, un code récent passe", async () => {
  const maintenant = Date.now();
  const utilisateur = {
    verificationCode: "123456",
    verificationCodeCreatedAt: new Date(maintenant - CODE_TTL_MS - 1000).toISOString(),
    verificationAttempts: 0
  };
  assert.deepEqual(verificationCheck(utilisateur, "123456", { now: maintenant }), { ok: false, reason: "expired" });
  utilisateur.verificationCodeCreatedAt = new Date(maintenant - 1000).toISOString();
  assert.deepEqual(verificationCheck(utilisateur, "123456", { now: maintenant }), { ok: true });
  // Un compte sans code en attente ne peut pas être validé.
  assert.deepEqual(verificationCheck({ verificationCode: null }, "123456", { now: maintenant }), {
    ok: false,
    reason: "missing"
  });
});

test("le renvoi émet un nouveau code et invalide l'ancien", async () => {
  await withEnv({}, async () => {
    resetResendLimits();
    const app = await startApp();
    try {
      const creation = await inscrire(app);
      const premier = creation.devVerificationCode;
      const renvoi = await post(app.baseUrl, "/api/auth/resend", { email: EMAIL, language: "fr" });
      assert.equal(renvoi.status, 200);
      const second = renvoi.payload.devVerificationCode;
      assert.ok(second, "en développement, le nouveau code est renvoyé");
      assert.notEqual(second, premier, "le code a changé");

      const ancien = await post(app.baseUrl, "/api/auth/verify", { email: EMAIL, code: premier });
      assert.equal(ancien.status, 401, "l'ancien code ne doit plus fonctionner");
      const nouveau = await post(app.baseUrl, "/api/auth/verify", { email: EMAIL, code: second });
      assert.equal(nouveau.status, 200);
      assert.ok(nouveau.payload.user.emailVerifiedAt);
    } finally {
      await app.close();
    }
  });
});

test("en mode e-mail, le renvoi part par e-mail et ne dit rien de l'existence du compte", async () => {
  await withEnv({ ASTROLAB_EMAIL_MODE: "email", BREVO_API_KEY: "xkeysib-test", BREVO_SENDER_EMAIL: "info@lastro.test" }, () =>
    withBrevo(async (envois) => {
      resetResendLimits();
      const app = await startApp();
      try {
        await inscrire(app);
        const envoisAvant = envois.length;
        const connu = await post(app.baseUrl, "/api/auth/resend", { email: EMAIL, language: "en" });
        assert.equal(connu.status, 200);
        assert.equal(connu.payload.verificationEmailSent, true);
        assert.equal("devVerificationCode" in connu.payload, false, "le code ne sort jamais en mode e-mail");
        assert.equal(envois.length, envoisAvant + 1);

        // Adresse inconnue : même réponse, même forme — pas d'annuaire.
        const inconnu = await post(app.baseUrl, "/api/auth/resend", { email: "personne@example.test", language: "en" });
        assert.equal(inconnu.status, 200);
        assert.deepEqual(Object.keys(inconnu.payload).sort(), ["ok"]);

        // Compte déjà vérifié : même réponse neutre.
        const state = await app.store.load();
        const code = /(\d{6})/.exec(envois[envois.length - 1].textContent)?.[1];
        await post(app.baseUrl, "/api/auth/verify", { email: EMAIL, code });
        const dejaVerifie = await post(app.baseUrl, "/api/auth/resend", { email: EMAIL, language: "en" });
        assert.equal(dejaVerifie.status, 200);
        assert.deepEqual(Object.keys(dejaVerifie.payload).sort(), ["ok"]);
      } finally {
        await app.close();
      }
    })
  );
});

test("le renvoi est limité par adresse", async () => {
  await withEnv({}, async () => {
    resetResendLimits();
    const app = await startApp();
    try {
      await inscrire(app);
      for (let envoi = 1; envoi <= MAX_RESENDS_PER_ADDRESS_PER_HOUR; envoi += 1) {
        const reponse = await post(app.baseUrl, "/api/auth/resend", { email: EMAIL, language: "fr" });
        assert.equal(reponse.status, 200, `renvoi ${envoi}`);
      }
      const trop = await post(app.baseUrl, "/api/auth/resend", { email: EMAIL, language: "fr" });
      assert.equal(trop.status, 429);
      assert.equal(trop.payload.code, "verification_resend_rate_limited");
      // La limitation d'une adresse ne bloque pas les autres.
      const autre = await post(app.baseUrl, "/api/auth/resend", { email: "autre@example.test", language: "fr" });
      assert.equal(autre.status, 200);
    } finally {
      resetResendLimits();
      await app.close();
    }
  });
});

test("le site porte le bouton de renvoi, dans les neuf langues", () => {
  const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(page, /id="resend-code"/);
  assert.match(page, /id="resend-status"/);
  assert.match(source, /"\/api\/auth\/resend"/);
  for (const cle of ["verifyCodeRejected", "resendCode", "resendCodeSent", "resendCodeTooMany"]) {
    const occurrences = (source.match(new RegExp(`${cle}:`, "g")) ?? []).length;
    assert.equal(occurrences, 9, `${cle} doit être traduit dans les neuf langues (${occurrences})`);
  }
});
