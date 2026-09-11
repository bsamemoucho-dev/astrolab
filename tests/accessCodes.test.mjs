// Codes à usage unique : une lecture offerte, une seule fois.
//
// La propriété qui compte n'est pas « le code finit marqué utilisé » mais « deux
// requêtes simultanées ne donnent pas deux lectures ». C'est elle qui dépend de
// la transaction, et c'est donc elle qu'on teste explicitement.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";
import {
  checkAccessCode,
  consumeAccessCode,
  countUsableAccessCodes,
  createAccessCodes,
  formatAccessCode,
  listAccessCodes,
  markAccessCodeUsed,
  revokeAccessCode
} from "../src/models/accessCodeService.mjs";
import { createPaidDelivery } from "../src/models/publicDeliveryService.mjs";

const executer = promisify(execFile);
const RACINE = fileURLToPath(new URL("..", import.meta.url));

const KEYS = ["ASTROLAB_TEST_CODE", "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "ASTROLAB_LLM_API_KEY"];

async function avecEnv(values, run) {
  const sauve = Object.fromEntries(KEYS.map((cle) => [cle, process.env[cle]]));
  for (const cle of KEYS) {
    delete process.env[cle];
  }
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const cle of KEYS) {
      if (sauve[cle] === undefined) {
        delete process.env[cle];
      } else {
        process.env[cle] = sauve[cle];
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

async function post(baseUrl, chemin, body) {
  const reponse = await fetch(`${baseUrl}${chemin}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: reponse.status, payload: await reponse.json().catch(() => null) };
}

// --- le service -----------------------------------------------------------

test("créer des codes n'enregistre que leur empreinte", () => {
  const state = { accessCodes: [] };
  const crees = createAccessCodes(state, { count: 3, label: "Lancement" });

  assert.equal(crees.length, 3);
  assert.equal(state.accessCodes.length, 3);
  const serialise = JSON.stringify(state);
  for (const entree of crees) {
    // Alphabet sans caractères confondables : un code recopié de travers est un
    // client bloqué.
    assert.doesNotMatch(entree.code, /[IO01]/, `caractère confondable dans ${entree.code}`);
    assert.equal(entree.code.replace(/-/g, "").length, 16);
    // Le code en clair n'apparaît nulle part dans l'état.
    assert.ok(!serialise.includes(entree.code.replace(/-/g, "")), "le code en clair est dans l'état");
    assert.equal(checkAccessCode(state, entree.code).ok, true);
  }
  assert.equal(countUsableAccessCodes(state), 3);
  // Trois codes distincts, pas trois fois le même.
  assert.equal(new Set(crees.map((entree) => entree.code)).size, 3);
});

test("un code se compare sans casse, sans tirets ni espaces", () => {
  const state = { accessCodes: [] };
  const [cree] = createAccessCodes(state, { count: 1 });
  const brut = cree.code.replace(/-/g, "");

  assert.equal(checkAccessCode(state, brut).ok, true);
  assert.equal(checkAccessCode(state, brut.toLowerCase()).ok, true);
  assert.equal(checkAccessCode(state, formatAccessCode(brut)).ok, true);
  assert.equal(checkAccessCode(state, `  ${formatAccessCode(brut).toLowerCase()}  `).ok, true);
  assert.equal(checkAccessCode(state, "ZZZZ-ZZZZ-ZZZZ-ZZZZ").reason, "inconnu");
});

test("un code utilisé, expiré ou révoqué est refusé", () => {
  const state = { accessCodes: [] };

  const [utilise] = createAccessCodes(state, { count: 1 });
  markAccessCodeUsed(checkAccessCode(state, utilise.code).entry);
  assert.equal(checkAccessCode(state, utilise.code).reason, "utilise");

  const [expire] = createAccessCodes(state, { count: 1, expiresAt: new Date(Date.now() - 1000) });
  assert.equal(checkAccessCode(state, expire.code).reason, "expire");

  const [revoque] = createAccessCodes(state, { count: 1 });
  assert.equal(revokeAccessCode(state, revoque.id), true);
  // Un code révoqué ne se distingue pas d'un code inconnu : celui à qui on l'a
  // retiré n'a pas à apprendre qu'il a existé.
  assert.equal(checkAccessCode(state, revoque.code).reason, "inconnu");
  // Révoquer deux fois ne fait rien de plus.
  assert.equal(revokeAccessCode(state, revoque.id), false);

  assert.equal(countUsableAccessCodes(state), 0);
});

test("consommer un code le refuse ensuite avec le statut qui explique pourquoi", () => {
  const state = { accessCodes: [] };
  const [cree] = createAccessCodes(state, { count: 1 });

  const entree = consumeAccessCode(state, cree.code);
  markAccessCodeUsed(entree, { reference: "L-2026-TEST-TEST" });
  assert.equal(entree.deliveryReference, "L-2026-TEST-TEST");

  let dejaUtilise = null;
  try {
    consumeAccessCode(state, cree.code);
  } catch (error) {
    dejaUtilise = error;
  }
  assert.equal(dejaUtilise.status, 409, "un code déjà utilisé doit répondre 409, pas « invalide »");
  assert.match(dejaUtilise.message, /déjà/);

  let inconnu = null;
  try {
    consumeAccessCode(state, "ZZZZ-ZZZZ-ZZZZ-ZZZZ");
  } catch (error) {
    inconnu = error;
  }
  assert.equal(inconnu.status, 403);
  assert.match(inconnu.message, /pas valide/);
});

test("le suivi ne révèle jamais les codes", () => {
  const state = { accessCodes: [] };
  const crees = createAccessCodes(state, { count: 2, label: "Test" });
  markAccessCodeUsed(checkAccessCode(state, crees[0].code).entry, { reference: "L-2026-AAAA-BBBB" });

  const suivi = listAccessCodes(state);
  assert.deepEqual(
    suivi.map((entree) => entree.state),
    ["utilisé", "disponible"]
  );
  assert.equal(suivi[0].deliveryReference, "L-2026-AAAA-BBBB");
  const serialise = JSON.stringify(suivi);
  for (const entree of crees) {
    assert.ok(!serialise.includes(entree.code.replace(/-/g, "")));
  }
});

// --- l'atomicité ----------------------------------------------------------

test("deux livraisons simultanées avec le même code : une seule est créée", async () => {
  // C'est LE test qui justifie de consommer dans la transaction : un contrôle
  // fait avant laisserait passer les deux requêtes, et une seule personne
  // obtiendrait deux lectures gratuites.
  const store = new JsonStore(null);
  const [cree] = createAccessCodes(await store.load(), { count: 1 });

  const resultats = await Promise.allSettled([
    createPaidDelivery(store, { accessCode: cree.code, freeAccess: true, input: { firstName: "A" } }),
    createPaidDelivery(store, { accessCode: cree.code, freeAccess: true, input: { firstName: "B" } })
  ]);

  const reussies = resultats.filter((resultat) => resultat.status === "fulfilled");
  const refusees = resultats.filter((resultat) => resultat.status === "rejected");
  assert.equal(reussies.length, 1, "une seule livraison doit être créée");
  assert.equal(refusees.length, 1, "la seconde requête doit être refusée");
  assert.equal(refusees[0].reason.status, 409);

  const etat = await store.load();
  assert.equal(etat.publicReadings.length, 1, "une seule lecture doit exister");
  assert.equal(countUsableAccessCodes(etat), 0);
});

test("la livraison note le code qui l'a ouverte", async () => {
  const store = new JsonStore(null);
  const [cree] = createAccessCodes(await store.load(), { count: 1 });

  const { delivery } = await createPaidDelivery(store, { accessCode: cree.code, freeAccess: true });
  const etat = await store.load();
  const entree = etat.accessCodes.find((candidat) => candidat.id === delivery.accessCodeId);

  assert.ok(entree, "la livraison doit référencer son code");
  assert.ok(entree.usedAt, "le code doit être marqué utilisé");
  assert.equal(entree.deliveryReference, delivery.reference);
});

// --- le parcours HTTP -----------------------------------------------------

test("un code à usage unique remplace le paiement, et survit à une demande incomplète", async () => {
  await avecEnv(
    {
      STRIPE_SECRET_KEY: "sk_live_abc123456789",
      STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789",
      ASTROLAB_LLM_API_KEY: "cle-de-test"
    },
    async () => {
      const app = await startApp();
      try {
        // Le code existe AVANT la lecture de /api/config : c'est ce qui rend le
        // champ visible sur le site.
        const [cree] = createAccessCodes(await app.store.load(), { count: 1 });

        const config = await (await fetch(`${app.baseUrl}/api/config`)).json();
        assert.equal(config.codesEnabled, true, "le champ doit apparaître dès qu'un code existe");
        assert.equal(config.testCodeEnabled, false, "aucun code de test n'est configuré ici");

        // Sans code : le paiement reste exigé.
        const sansCode = await post(app.baseUrl, "/api/public/readings", { firstName: "Test" });
        assert.equal(sansCode.status, 402);

        // Avec le code mais une demande incomplète : on a dépassé le garde-fou de
        // paiement (400 sur la date, plus 402)…
        const incomplete = await post(app.baseUrl, "/api/public/readings", {
          accessCode: cree.code,
          firstName: "Test"
        });
        assert.equal(incomplete.status, 400);
        assert.match(incomplete.payload.error, /date de naissance/i);

        // …et le code n'est PAS consommé par une demande incomplète.
        assert.equal(countUsableAccessCodes(await app.store.load()), 1, "le code a été brûlé pour rien");

        // Un code inconnu est refusé, sans révéler quoi que ce soit.
        const inconnu = await post(app.baseUrl, "/api/public/readings", {
          accessCode: "ZZZZ-ZZZZ-ZZZZ-ZZZZ",
          firstName: "Test"
        });
        assert.equal(inconnu.status, 403);
        assert.match(inconnu.payload.error, /pas valide/i);

        // Un code déjà consommé le dit clairement.
        markAccessCodeUsed(checkAccessCode(await app.store.load(), cree.code).entry);
        const dejaUtilise = await post(app.baseUrl, "/api/public/readings", {
          accessCode: cree.code,
          firstName: "Test"
        });
        assert.equal(dejaUtilise.status, 409);
        assert.match(dejaUtilise.payload.error, /déjà/i);
      } finally {
        await app.close();
      }
    }
  );
});

// --- l'outil en ligne de commande ----------------------------------------

test("l'outil crée et suit les codes, et n'affiche jamais les codes en clair à la relecture", async () => {
  const dossier = await mkdtemp(join(tmpdir(), "lastro-codes-"));
  const chemin = join(dossier, "etat.json");
  const outil = join(RACINE, "tools", "access-codes.mjs");

  const creation = await executer(process.execPath, [outil, "create", "--count", "3", "--label", "Lancement", "--db", chemin]);
  const codes = [...creation.stdout.matchAll(/\b([A-Z2-9]{4}(?:-[A-Z2-9]{4}){3})\b/g)].map((m) => m[1]);
  assert.equal(codes.length, 3, `l'outil doit afficher 3 codes, il en a affiché ${codes.length}`);
  assert.match(creation.stdout, /Redémarrez le service/, "l'avertissement de redémarrage doit être affiché");

  // Le fichier ne contient que des empreintes.
  const contenu = await readFile(chemin, "utf8");
  for (const code of codes) {
    assert.ok(!contenu.includes(code.replace(/-/g, "")), "un code en clair est enregistré dans le stockage");
  }

  const suivi = await executer(process.execPath, [outil, "list", "--db", chemin]);
  assert.match(suivi.stdout, /3 disponible\(s\)/);
  for (const code of codes) {
    assert.ok(!suivi.stdout.includes(code), "« list » ne doit jamais réafficher un code");
  }

  // Révoquer un code le retire des disponibles.
  const identifiant = suivi.stdout.match(/(code_[0-9a-f-]+)/)[1];
  await executer(process.execPath, [outil, "revoke", identifiant, "--db", chemin]);
  const apres = await executer(process.execPath, [outil, "list", "--db", chemin]);
  assert.match(apres.stdout, /2 disponible\(s\)/);
  assert.match(apres.stdout, /révoqué/);
});
