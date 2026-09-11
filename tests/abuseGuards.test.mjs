// Garde-fous des points d'entrée non authentifiés.
//
// Chacun a été ajouté après un audit : ils ne se voient pas à l'usage normal,
// donc ils se testent explicitement — un garde-fou qu'aucun test ne couvre est
// un garde-fou qu'une refonte supprime sans que personne ne s'en aperçoive.

import assert from "node:assert/strict";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";
import { createPaidDelivery, markDeliveryReady } from "../src/models/publicDeliveryService.mjs";

const PASSWORD = "correct horse battery";

async function startApp(options = {}) {
  const { server, store } = createApp({ store: new JsonStore(null), ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    store,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function request(baseUrl, path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => null);
  return {
    status: response.status,
    payload,
    cookie: response.headers.get("set-cookie"),
    retryAfter: response.headers.get("retry-after")
  };
}

async function inscrireVerifierConnecter(baseUrl, email) {
  const inscrit = await request(baseUrl, "/api/auth/register", { method: "POST", body: { email, password: PASSWORD } });
  assert.equal(inscrit.status, 201);
  const verifie = await request(baseUrl, "/api/auth/verify", {
    method: "POST",
    body: { email, code: inscrit.payload.devVerificationCode }
  });
  assert.equal(verifie.status, 200);
  const connecte = await request(baseUrl, "/api/auth/login", { method: "POST", body: { email, password: PASSWORD } });
  assert.equal(connecte.status, 200);
  return connecte.cookie;
}

// Applique des variables d'environnement et les restaure, quoi qu'il arrive.
async function avecEnv(variables, action) {
  const avant = new Map(Object.keys(variables).map((nom) => [nom, process.env[nom]]));
  for (const [nom, valeur] of Object.entries(variables)) {
    if (valeur === undefined) {
      delete process.env[nom];
    } else {
      process.env[nom] = valeur;
    }
  }
  try {
    return await action();
  } finally {
    for (const [nom, valeur] of avant) {
      if (valeur === undefined) {
        delete process.env[nom];
      } else {
        process.env[nom] = valeur;
      }
    }
  }
}

test("les crédits de développement sont refusés en production", async () => {
  await avecEnv({ NODE_ENV: undefined, ASTROLAB_ALLOW_DEV_CREDITS: undefined }, async () => {
    const app = await startApp();
    try {
      const cookie = await inscrireVerifierConnecter(app.baseUrl, "credits@example.test");

      // Hors production, le point d'entrée sert à ce pour quoi il existe.
      const permis = await request(app.baseUrl, "/api/commerce/dev-credit-order", {
        method: "POST",
        body: { planId: "starter" },
        cookie
      });
      assert.equal(permis.status, 201);

      // En production, plus personne ne s'attribue de crédits — même connecté.
      await avecEnv({ NODE_ENV: "production" }, async () => {
        const refuse = await request(app.baseUrl, "/api/commerce/dev-credit-order", {
          method: "POST",
          body: { planId: "starter" },
          cookie
        });
        assert.equal(refuse.status, 403);
        assert.match(refuse.payload.error, /désactivée/i);

        const avant = await request(app.baseUrl, "/api/commerce", { cookie });
        assert.equal(avant.payload.balance, 10, "aucun crédit ne doit s'ajouter en production");
      });

      // Le drapeau explicite reste la porte de sortie assumée pour un essai.
      await avecEnv({ NODE_ENV: "production", ASTROLAB_ALLOW_DEV_CREDITS: "1" }, async () => {
        const permis = await request(app.baseUrl, "/api/commerce/dev-credit-order", {
          method: "POST",
          body: { planId: "starter" },
          cookie
        });
        assert.equal(permis.status, 201);
      });
    } finally {
      await app.close();
    }
  });
});

test("l'inscription est limitée par client et par service", async () => {
  const app = await startApp();
  try {
    // Dix inscriptions passent : le plafond par client.
    for (let index = 0; index < 10; index += 1) {
      const reponse = await request(app.baseUrl, "/api/auth/register", {
        method: "POST",
        body: { email: `inscrit-${index}@example.test`, password: PASSWORD }
      });
      assert.equal(reponse.status, 201, `inscription ${index} refusée trop tôt`);
    }
    // La onzième est refusée AVANT d'envoyer le moindre e-mail.
    const refusee = await request(app.baseUrl, "/api/auth/register", {
      method: "POST",
      body: { email: "inscrit-11@example.test", password: PASSWORD }
    });
    assert.equal(refusee.status, 429);
    assert.match(refusee.payload.error, /Trop d'inscriptions/i);
    assert.ok(Number(refusee.retryAfter) > 0, "le client doit savoir quand réessayer");

    const state = await app.store.load();
    assert.equal(state.users.length, 10, "aucun compte ne doit être créé au-delà du plafond");
  } finally {
    await app.close();
  }
});

test("les tentatives de connexion sont limitées par compte", async () => {
  const app = await startApp();
  try {
    await inscrireVerifierConnecter(app.baseUrl, "cible@example.test");

    for (let essai = 0; essai < 10; essai += 1) {
      const rate = await request(app.baseUrl, "/api/auth/login", {
        method: "POST",
        body: { email: "cible@example.test", password: "mauvais mot de passe" }
      });
      assert.equal(rate.status, 401, `essai ${essai} : attendu 401`);
    }
    const bloque = await request(app.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "cible@example.test", password: "mauvais mot de passe" }
    });
    assert.equal(bloque.status, 429);
    assert.match(bloque.payload.error, /Trop de tentatives/i);

    // Le bon mot de passe lui-même est refusé pendant la fenêtre : sinon la
    // limitation ne protégerait rien, il suffirait de trouver le mot de passe.
    const bonMotDePasse = await request(app.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "cible@example.test", password: PASSWORD }
    });
    assert.equal(bonMotDePasse.status, 429);
  } finally {
    await app.close();
  }
});

test("une connexion réussie remet le compteur du compte à zéro", async () => {
  const app = await startApp();
  try {
    await inscrireVerifierConnecter(app.baseUrl, "compteur@example.test");

    for (let essai = 0; essai < 4; essai += 1) {
      await request(app.baseUrl, "/api/auth/login", {
        method: "POST",
        body: { email: "compteur@example.test", password: "mauvais mot de passe" }
      });
    }
    const reussie = await request(app.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "compteur@example.test", password: PASSWORD }
    });
    assert.equal(reussie.status, 200);

    // Cinq erreurs de frappe de plus ne doivent pas bloquer : le compteur est
    // reparti de zéro, sinon quatre fautes étalées dans la journée finiraient
    // par enfermer le client légitime.
    for (let essai = 0; essai < 5; essai += 1) {
      const rate = await request(app.baseUrl, "/api/auth/login", {
        method: "POST",
        body: { email: "compteur@example.test", password: "mauvais mot de passe" }
      });
      assert.equal(rate.status, 401, `essai ${essai} après succès : attendu 401, pas 429`);
    }
  } finally {
    await app.close();
  }
});

test("un compte non vérifié ne consomme pas le quota de connexion", async () => {
  // Le refus « adresse non vérifiée » n'est pas une tentative d'intrusion :
  // le compter enfermerait quelqu'un qui a simplement oublié de valider.
  const app = await startApp();
  try {
    await request(app.baseUrl, "/api/auth/register", {
      method: "POST",
      body: { email: "pas-verifie@example.test", password: PASSWORD }
    });
    for (let essai = 0; essai < 15; essai += 1) {
      const reponse = await request(app.baseUrl, "/api/auth/login", {
        method: "POST",
        body: { email: "pas-verifie@example.test", password: PASSWORD }
      });
      assert.equal(reponse.status, 403, `essai ${essai} : attendu 403 (non vérifié)`);
    }
  } finally {
    await app.close();
  }
});

test("la récupération d'un lien de lecture est limitée", async () => {
  const app = await startApp();
  try {
    for (let essai = 0; essai < 10; essai += 1) {
      const reponse = await request(app.baseUrl, "/api/public/deliveries/recover", {
        method: "POST",
        body: { reference: "L-2026-AAAAAA-BBBB", email: "client@example.test" }
      });
      assert.equal(reponse.status, 200, `demande ${essai} refusée trop tôt`);
      // La réponse reste neutre : elle ne dit pas si la commande existe.
      assert.deepEqual(reponse.payload, { requested: true });
    }
    const refusee = await request(app.baseUrl, "/api/public/deliveries/recover", {
      method: "POST",
      body: { reference: "L-2026-AAAAAA-BBBB", email: "client@example.test" }
    });
    assert.equal(refusee.status, 429);
    assert.ok(Number(refusee.retryAfter) > 0);
  } finally {
    await app.close();
  }
});

test("la recherche de lieux publique est limitée", async () => {
  const app = await startApp();
  try {
    let refusee = null;
    for (let essai = 0; essai < 121 && !refusee; essai += 1) {
      const reponse = await request(app.baseUrl, "/api/public/places/search?q=Paris%2C%20France");
      if (reponse.status === 429) {
        refusee = reponse;
      }
    }
    assert.ok(refusee, "la 121e recherche devait être refusée");
    assert.ok(Number(refusee.retryAfter) > 0);
  } finally {
    await app.close();
  }
});

test("/api/config ne publie rien qui décrive la clé secrète", async () => {
  await avecEnv(
    {
      STRIPE_SECRET_KEY: "sk_live_51UE4C2RsIRc7hIlDwDbsy" + "x".repeat(80),
      STRIPE_PUBLISHABLE_KEY: "pk_live_51UE4C2RsIRc7hIlDwDbsy" + "y".repeat(80)
    },
    async () => {
      const app = await startApp();
      try {
        const reponse = await request(app.baseUrl, "/api/config");
        assert.equal(reponse.status, 200);
        const diagnostics = JSON.stringify(reponse.payload.payments.diagnostics);
        assert.doesNotMatch(diagnostics, /sk_live|pk_live/);
        assert.doesNotMatch(diagnostics, /\d/, "une longueur ou un identifiant s'est glissé dans la réponse publique");
      } finally {
        await app.close();
      }
    }
  );
});

// Prépare une lecture prête et déclenche l'envoi de son lien par le parcours
// « j'ai perdu mon lien ». Renvoie le lien réellement mis dans la file d'envoi.
async function lienEnvoye(app, { entetes = {} } = {}) {
  const { delivery } = await createPaidDelivery(app.store, {
    paymentSessionId: `cs_test_host_${Math.random().toString(36).slice(2)}`,
    email: "client@example.test"
  });
  await markDeliveryReady(app.store, delivery.id, { html: "<p>x</p>", markdown: "x" });
  const reponse = await fetch(`${app.baseUrl}/api/public/deliveries/recover`, {
    method: "POST",
    headers: { "content-type": "application/json", ...entetes },
    body: JSON.stringify({ reference: delivery.reference, email: "client@example.test" })
  });
  assert.equal(reponse.status, 200);
  const state = await app.store.load();
  return { lien: state.outbox.at(-1).link, token: delivery.token };
}

test("un en-tête Host forgé ne détourne pas le lien envoyé par e-mail", async () => {
  // L'en-tête Host vient du client : s'en servir pour construire un lien envoyé
  // par e-mail permettait de faire pointer le client vers le domaine de
  // l'attaquant, et de lui prendre le jeton de sa lecture au clic.
  await avecEnv({ NODE_ENV: "production", ASTROLAB_PUBLIC_URL: undefined }, async () => {
    const app = await startApp();
    try {
      const { lien, token } = await lienEnvoye(app, {
        entetes: { "x-forwarded-host": "attaquant.example", "x-forwarded-proto": "http" }
      });
      assert.equal(lien, `https://www.lastro.fr/r/${token}`);
      assert.doesNotMatch(lien, /attaquant\.example/);
    } finally {
      await app.close();
    }
  });
});

test("ASTROLAB_PUBLIC_URL fixe la base des liens, même en production", async () => {
  await avecEnv({ NODE_ENV: "production", ASTROLAB_PUBLIC_URL: "https://preversion.lastro.fr/" }, async () => {
    const app = await startApp();
    try {
      const { lien, token } = await lienEnvoye(app, { entetes: { "x-forwarded-host": "attaquant.example" } });
      // La barre finale de la configuration ne doit pas produire « //r/ ».
      assert.equal(lien, `https://preversion.lastro.fr/r/${token}`);
    } finally {
      await app.close();
    }
  });
});

test("hors production, l'hôte de la requête reste utilisé", async () => {
  // Le confort du développement local est conservé : c'est la production qui ne
  // se fie plus à la requête.
  await avecEnv({ NODE_ENV: undefined, ASTROLAB_PUBLIC_URL: undefined }, async () => {
    const app = await startApp();
    try {
      const { lien, token } = await lienEnvoye(app);
      assert.equal(lien, `${app.baseUrl}/r/${token}`);
    } finally {
      await app.close();
    }
  });
});

test("une ASTROLAB_PUBLIC_URL mal formée est ignorée au profit du domaine connu", async () => {
  await avecEnv({ NODE_ENV: "production", ASTROLAB_PUBLIC_URL: "pas-une-url" }, async () => {
    const app = await startApp();
    try {
      const { lien } = await lienEnvoye(app);
      assert.match(lien, /^https:\/\/www\.lastro\.fr\/r\//);
    } finally {
      await app.close();
    }
  });
});

test("une adresse qui n'est pas une adresse est refusée à l'inscription", async () => {
  // `includes("@")` laissait passer `<svg/onload=…>@x.co` : une valeur qui n'est
  // pas une adresse, stockée telle quelle, puis affichée dans le panneau
  // d'administration. L'échappement à l'affichage est la vraie protection (voir
  // tests/clientEscaping.test.mjs) ; refuser la forme en amont évite en plus
  // d'accumuler des adresses inutilisables et des comptes non délivrables.
  const app = await startApp();
  try {
    const refusees = [
      "<svg/onload=alert(1)>@x.co",
      "a@b",
      "deux@@exemple.fr",
      "sans-arobase.fr",
      "espaces dans@exemple.fr",
      'guillemet"@exemple.fr',
      "chevrons<>@exemple.fr"
    ];
    for (const email of refusees) {
      const reponse = await request(app.baseUrl, "/api/auth/register", { method: "POST", body: { email, password: PASSWORD } });
      assert.equal(reponse.status, 400, `adresse acceptée à tort : ${email}`);
    }
    const state = await app.store.load();
    assert.equal(state.users.length, 0, "aucun compte ne doit exister avec une adresse invalide");

    // Une adresse normale passe toujours.
    const acceptee = await request(app.baseUrl, "/api/auth/register", {
      method: "POST",
      body: { email: "cliente@exemple.fr", password: PASSWORD }
    });
    assert.equal(acceptee.status, 201);
  } finally {
    await app.close();
  }
});

// --- accès gratuit : ce que le code doit garantir -------------------------

const CODE_DE_TEST = "code-de-test-partage-2026";
// Charge complète : une lecture se génère sans rédacteur IA configuré (brouillon
// modèle), ce qui permet de tester le quota sans appeler de service externe.
const LECTURE_VALIDE = {
  firstName: "Essai",
  birthDate: "1990-01-15",
  timePrecision: "exact",
  timeValue: "12:30",
  birthPlace: "Paris, France",
  country: "France",
  latitude: 48.8566,
  longitude: 2.3522,
  timeZone: "Europe/Paris"
};

const ENV_TEST_CODE = {
  NODE_ENV: undefined,
  ASTROLAB_TEST_CODE: CODE_DE_TEST,
  ASTROLAB_ALLOW_FREE_READINGS: undefined,
  STRIPE_SECRET_KEY: undefined,
  STRIPE_PUBLISHABLE_KEY: undefined,
  ASTROLAB_LLM_API_KEY: undefined
};

test("un attaquant ne peut pas bloquer le code de test de l'exploitant", async () => {
  // Le compteur d'échecs était global : vingt mauvais codes depuis n'importe où
  // bloquaient le code de l'exploitant pour tout le monde. C'était un déni de
  // service sur son propre accès, pas une protection.
  await avecEnv(ENV_TEST_CODE, async () => {
    const app = await startApp();
    const attaquant = { "x-forwarded-for": "203.0.113.9" };
    try {
      let dernier = null;
      for (let essai = 0; essai < 21; essai += 1) {
        dernier = await fetch(`${app.baseUrl}/api/public/readings`, {
          method: "POST",
          headers: { "content-type": "application/json", ...attaquant },
          body: JSON.stringify({ testCode: `mauvais-${essai}-123456`, firstName: "Test" })
        });
      }
      assert.equal(dernier.status, 429, "l'attaquant doit finir limité");
      assert.ok(Number(dernier.headers.get("retry-after")) > 0);

      // Le même attaquant reste bloqué…
      const encore = await fetch(`${app.baseUrl}/api/public/readings`, {
        method: "POST",
        headers: { "content-type": "application/json", ...attaquant },
        body: JSON.stringify({ testCode: "mauvais-encore-123456", firstName: "Test" })
      });
      assert.equal(encore.status, 429);

      // …mais l'exploitant, depuis son poste, garde son accès.
      const exploitant = await request(app.baseUrl, "/api/public/readings", {
        method: "POST",
        body: { testCode: CODE_DE_TEST, firstName: "Test" }
      });
      assert.equal(exploitant.status, 400, "le code correct doit rester utilisable");
      assert.match(exploitant.payload.error, /date de naissance/i);
    } finally {
      await app.close();
    }
  });
});

test("le code de test partagé est plafonné par poste et par jour", async () => {
  // Ce code est illimité par construction : c'est la seule source qu'un plafond
  // doit borner. S'il fuite, il ne peut pas produire des lectures en série.
  await avecEnv(ENV_TEST_CODE, async () => {
    const app = await startApp();
    try {
      for (let essai = 0; essai < 5; essai += 1) {
        const reponse = await request(app.baseUrl, "/api/public/readings", {
          method: "POST",
          body: { ...LECTURE_VALIDE, testCode: CODE_DE_TEST }
        });
        assert.equal(reponse.status, 200, `lecture ${essai + 1} refusée trop tôt`);
      }
      const auDela = await request(app.baseUrl, "/api/public/readings", {
        method: "POST",
        body: { ...LECTURE_VALIDE, testCode: CODE_DE_TEST }
      });
      assert.equal(auDela.status, 429);
      assert.match(auDela.payload.error, /Trop de lectures offertes/i);
    } finally {
      await app.close();
    }
  });
});

test("une demande incomplète ne consomme pas le quota de lectures offertes", async () => {
  await avecEnv(ENV_TEST_CODE, async () => {
    const app = await startApp();
    try {
      for (let essai = 0; essai < 6; essai += 1) {
        const reponse = await request(app.baseUrl, "/api/public/readings", {
          method: "POST",
          body: { testCode: CODE_DE_TEST, firstName: "Test" }
        });
        assert.equal(reponse.status, 400, "date manquante : refus attendu, pas un plafond");
      }
      // Le quota est intact : une première lecture complète passe encore.
      const valide = await request(app.baseUrl, "/api/public/readings", {
        method: "POST",
        body: { ...LECTURE_VALIDE, testCode: CODE_DE_TEST }
      });
      assert.equal(valide.status, 200);
    } finally {
      await app.close();
    }
  });
});

test("sans paiement configuré, une préversion ne sert pas de lectures à distance", async () => {
  await avecEnv(
    {
      NODE_ENV: undefined,
      ASTROLAB_ALLOW_FREE_READINGS: undefined,
      ASTROLAB_TEST_CODE: undefined,
      STRIPE_SECRET_KEY: undefined,
      STRIPE_PUBLISHABLE_KEY: undefined,
      ASTROLAB_LLM_API_KEY: undefined
    },
    async () => {
      const app = await startApp();
      try {
        // Depuis la machine elle-même : le développement local fonctionne.
        const local = await request(app.baseUrl, "/api/public/readings", {
          method: "POST",
          body: { firstName: "Test" }
        });
        assert.equal(local.status, 400, "en local, on doit atteindre la validation des données");

        // Depuis Internet : non. Une préversion oubliée offrait sinon des lectures.
        const distant = await fetch(`${app.baseUrl}/api/public/readings`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify({ firstName: "Test" })
        });
        assert.equal(distant.status, 503);
        assert.equal((await distant.json()).code, "payment_not_configured");
      } finally {
        await app.close();
      }
    }
  );
});

test("le drapeau explicite rouvre le mode gratuit sans paiement", async () => {
  await avecEnv(
    {
      NODE_ENV: undefined,
      ASTROLAB_ALLOW_FREE_READINGS: "1",
      ASTROLAB_TEST_CODE: undefined,
      STRIPE_SECRET_KEY: undefined,
      STRIPE_PUBLISHABLE_KEY: undefined,
      ASTROLAB_LLM_API_KEY: undefined
    },
    async () => {
      const app = await startApp();
      try {
        const distant = await fetch(`${app.baseUrl}/api/public/readings`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify({ firstName: "Test" })
        });
        // 400 (données incomplètes) et non 503 : le drapeau a bien ouvert la porte.
        assert.equal(distant.status, 400);
      } finally {
        await app.close();
      }
    }
  );
});
