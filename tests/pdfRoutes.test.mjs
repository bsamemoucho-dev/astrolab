// La route PDF : mêmes droits que la lecture elle-même, et jamais de HTML
// arbitraire. Ce que ce fichier verrouille :
//   - sans moteur, la route se déclare indisponible (le site retombe alors sur
//     l'impression du navigateur) au lieu de rendre une erreur ;
//   - le document rendu est celui qui est STOCKÉ, retrouvé par son jeton ;
//   - un jeton inconnu ne donne rien, un dossier de compte exige une session.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";

const PDF_ATTENDU = Buffer.from("%PDF-1.4 document de test");

// Un moteur de PDF factice : enregistre ce qu'on lui demande de rendre.
function fauxMoteur() {
  const rendus = [];
  return {
    rendus,
    renderer: "chromium",
    render: async (html) => {
      rendus.push(html);
      return PDF_ATTENDU;
    },
    close: async () => {},
    status: () => ({ renderer: "chromium", rendered: rendus.length, lastFailure: null })
  };
}

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
  const type = response.headers.get("content-type") ?? "";
  const payload = type.includes("application/json") ? await response.json() : null;
  return {
    status: response.status,
    payload,
    type,
    cookie: response.headers.get("set-cookie"),
    disposition: response.headers.get("content-disposition"),
    bytes: payload ? null : Buffer.from(await response.arrayBuffer())
  };
}

// Une livraison prête, écrite directement dans la base : on teste la route, pas
// la rédaction.
async function livraisonPrete(store, { html = "<html><head><title>Lecture — Caro</title></head><body><p>Texte</p></body></html>" } = {}) {
  const { createPaidDelivery, markDeliveryReady } = await import("../src/models/publicDeliveryService.mjs");
  const created = await createPaidDelivery(store, { email: "client@example.test", language: "fr", freeAccess: true });
  await markDeliveryReady(store, created.delivery.id, { html, markdown: "Texte" });
  return created.delivery;
}

test("sans moteur PDF, la route se déclare indisponible au lieu d'échouer", async () => {
  const app = await startApp({ pdfRenderer: null });
  try {
    const delivery = await livraisonPrete(app.store);
    const reponse = await request(app.baseUrl, `/api/public/deliveries/${delivery.token}/pdf`);
    assert.equal(reponse.status, 503);
    assert.equal(reponse.payload.code, "pdf_renderer_unavailable");
    // Le message dit au client quoi faire, il ne parle pas d'erreur interne.
    assert.match(reponse.payload.error, /impression/i);
  } finally {
    await app.close();
  }
});

test("avec le moteur, le PDF est rendu depuis le document stocké", async () => {
  const moteur = fauxMoteur();
  const app = await startApp({ pdfRenderer: moteur });
  try {
    const html = "<html><head><title>Lecture symbolique — Caro</title></head><body><p>Texte réel</p></body></html>";
    const delivery = await livraisonPrete(app.store, { html });
    const reponse = await request(app.baseUrl, `/api/public/deliveries/${delivery.token}/pdf`);
    assert.equal(reponse.status, 200);
    assert.equal(reponse.type, "application/pdf");
    assert.equal(reponse.disposition, 'attachment; filename="Lecture-symbolique-Caro.pdf"');
    assert.ok(reponse.bytes.equals(PDF_ATTENDU));
    // Le HTML rendu est celui de la livraison, jamais celui d'une requête.
    assert.deepEqual(moteur.rendus, [html]);
  } finally {
    await app.close();
  }
});

test("le HTML envoyé par le client n'est jamais rendu", async () => {
  const moteur = fauxMoteur();
  const app = await startApp({ pdfRenderer: moteur });
  try {
    const delivery = await livraisonPrete(app.store);
    const reponse = await fetch(`${app.baseUrl}/api/public/deliveries/${delivery.token}/pdf`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html: "<html><body>contenu injecté</body></html>" })
    });
    // Ni POST, ni corps : la route est un GET sur un document déjà stocké.
    assert.equal(reponse.status, 404);
    assert.deepEqual(moteur.rendus, []);
  } finally {
    await app.close();
  }
});

test("un jeton inconnu ne donne pas de PDF, un dossier non prêt non plus", async () => {
  const moteur = fauxMoteur();
  const app = await startApp({ pdfRenderer: moteur });
  try {
    const inconnu = await request(app.baseUrl, "/api/public/deliveries/JETONINCONNU/pdf");
    assert.equal(inconnu.status, 404);

    // Une commande enregistrée mais pas encore rédigée : rien à convertir.
    const { createPaidDelivery } = await import("../src/models/publicDeliveryService.mjs");
    const enCours = await createPaidDelivery(app.store, { email: "client@example.test", language: "fr", freeAccess: true });
    const pasPrete = await request(app.baseUrl, `/api/public/deliveries/${enCours.delivery.token}/pdf`);
    assert.equal(pasPrete.status, 409);
    assert.equal(pasPrete.payload.code, "reading_not_ready");
    assert.deepEqual(moteur.rendus, []);
  } finally {
    await app.close();
  }
});

test("l'export PDF d'un dossier passe par la session, pas par un lien devinable", async () => {
  const moteur = fauxMoteur();
  const app = await startApp({ pdfRenderer: moteur });
  try {
    const anonyme = await request(app.baseUrl, "/api/deliverables/dossier_1/export?format=pdf");
    assert.equal(anonyme.status, 401);

    // Avec une session et un dossier prêt, le PDF est rendu depuis la version
    // courante stockée.
    const cookie = await registerVerifyLogin(app.baseUrl);
    const html = "<html><head><title>Dossier — Client</title></head><body><p>Dossier</p></body></html>";
    await app.store.transact((state) => {
      const now = new Date().toISOString();
      const userId = state.users.find((entry) => entry.email === EMAIL).id;
      state.deliverables = state.deliverables ?? [];
      state.deliverableVersions = state.deliverableVersions ?? [];
      state.deliverables.push({
        id: "dossier_1",
        ownerUserId: userId,
        personLabel: "Client",
        status: "ready",
        currentVersionId: "version_1",
        createdAt: now,
        updatedAt: now
      });
      state.deliverableVersions.push({ id: "version_1", versionNumber: 1, createdAt: now, title: "Dossier", html, markdown: "Dossier" });
    });

    const reponse = await request(app.baseUrl, "/api/deliverables/dossier_1/export?format=pdf", { cookie });
    assert.equal(reponse.status, 200);
    assert.equal(reponse.type, "application/pdf");
    assert.ok(reponse.bytes.equals(PDF_ATTENDU));
    assert.deepEqual(moteur.rendus, [html]);

    // Le format inconnu reste refusé, et mentionne désormais pdf.
    const inconnu = await request(app.baseUrl, "/api/deliverables/dossier_1/export?format=docx", { cookie });
    assert.equal(inconnu.status, 400);
    assert.match(inconnu.payload.error, /pdf/);
  } finally {
    await app.close();
  }
});

test("la configuration annonce au site si le rendu automatique est actif", async () => {
  const sans = await startApp({ pdfRenderer: null });
  try {
    const config = await request(sans.baseUrl, "/api/config");
    assert.equal(config.payload.pdfRenderer, null);
  } finally {
    await sans.close();
  }
  const avec = await startApp({ pdfRenderer: fauxMoteur() });
  try {
    const config = await request(avec.baseUrl, "/api/config");
    assert.equal(config.payload.pdfRenderer, "chromium");
  } finally {
    await avec.close();
  }
});

// --- session -----------------------------------------------------------------
const EMAIL = "pdf@example.test";

async function registerVerifyLogin(baseUrl) {
  const password = "correct horse battery";
  const registered = await request(baseUrl, "/api/auth/register", { method: "POST", body: { email: EMAIL, password } });
  assert.equal(registered.status, 201);
  const verified = await request(baseUrl, "/api/auth/verify", {
    method: "POST",
    body: { email: EMAIL, code: registered.payload.devVerificationCode }
  });
  assert.equal(verified.status, 200);
  const loggedIn = await request(baseUrl, "/api/auth/login", { method: "POST", body: { email: EMAIL, password } });
  assert.equal(loggedIn.status, 200);
  const cookie = loggedIn.cookie;
  assert.ok(cookie, "une session est ouverte");
  return cookie.split(";")[0];
}

test("le bouton PDF du site demande le fichier au serveur, et sait y renoncer", () => {
  // Contrôle statique : il ne prouve pas le comportement du navigateur, il
  // interdit qu'on retire le câblage ou le repli sans s'en apercevoir.
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(source, /state\.config\?\.pdfRenderer !== "chromium"/);
  assert.match(source, /\/pdf`/);
  assert.match(source, /reponse\.status === 503 \|\| reponse\.status === 502/);
  // Le repli reste l'impression du navigateur, avec son aide traduite.
  assert.match(source, /printHtmlInWindow\(state\.guestReading\.html\)/);
  assert.match(source, /showMessage\(uiStrings\(\)\.pdfHint\)/);
  // L'export du compte passe par la même logique.
  assert.match(source, /\/api\/deliverables\/\$\{id\}\/export\?format=pdf/);
});
