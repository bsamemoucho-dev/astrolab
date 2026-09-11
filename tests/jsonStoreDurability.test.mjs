// Durabilité du stockage.
//
// Le fichier JSON contient TOUT l'état : comptes, jetons de session, commandes,
// lectures payées, données de naissance. Il est réécrit en entier à chaque
// transaction. Trois propriétés doivent tenir, et aucune n'était testée :
// l'écriture ne doit jamais laisser un fichier tronqué, deux transactions
// simultanées ne doivent pas s'écraser, et le fichier ne doit pas être lisible
// par un autre utilisateur de la machine.

import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";

function dossierTemporaire() {
  return mkdtemp(join(tmpdir(), "lastro-store-"));
}

async function lireEtat(chemin) {
  return JSON.parse(await readFile(chemin, "utf8"));
}

test("l'écriture passe par un fichier temporaire renommé, et n'en laisse aucun", async () => {
  const dossier = await dossierTemporaire();
  const chemin = join(dossier, "etat.json");
  const store = new JsonStore(chemin);

  await store.transact((state) => {
    state.auditLogs.push({ id: "a" });
  });

  assert.equal((await lireEtat(chemin)).auditLogs.length, 1);
  // Une écriture directe aurait tronqué le fichier avant d'écrire : on vérifie
  // aussi qu'aucun résidu temporaire ne s'accumule.
  const restes = (await readdir(dossier)).filter((nom) => nom.endsWith(".tmp"));
  assert.deepEqual(restes, [], "un fichier temporaire est resté derrière la transaction");
});

test("le fichier d'état n'est lisible que par son propriétaire", async () => {
  if (process.platform === "win32") {
    return;
  }
  const dossier = await dossierTemporaire();
  const chemin = join(dossier, "sous", "etat.json");
  const store = new JsonStore(chemin);

  await store.transact((state) => {
    state.auditLogs.push({ id: "a" });
  });

  assert.equal((await stat(chemin)).mode & 0o777, 0o600, "le fichier d'état doit être en 0600");
  assert.equal((await stat(join(dossier, "sous"))).mode & 0o777, 0o700, "son dossier doit être en 0700");
});

test("une transaction qui échoue n'efface pas une transaction concurrente", async () => {
  // Sans file d'attente, l'annulation sur erreur rétablissait un instantané
  // antérieur à la transaction concurrente — celle-ci disparaissait de l'état en
  // mémoire, donc de toutes les réponses suivantes.
  const dossier = await dossierTemporaire();
  const chemin = join(dossier, "etat.json");
  const store = new JsonStore(chemin);
  await store.load();

  const premiere = store.transact(async (state) => {
    state.auditLogs.push({ id: "t1" });
    await new Promise((resolve) => setTimeout(resolve, 30));
    throw new Error("échec simulé");
  });
  const seconde = store.transact((state) => {
    state.auditLogs.push({ id: "t2" });
  });

  await assert.rejects(premiere, /échec simulé/);
  await seconde;

  assert.deepEqual(
    (await lireEtat(chemin)).auditLogs.map((entree) => entree.id),
    ["t2"],
    "la transaction concurrente a été perdue"
  );
});

test("cinquante transactions simultanées ne perdent rien et laissent un JSON valide", async () => {
  const dossier = await dossierTemporaire();
  const chemin = join(dossier, "etat.json");
  const store = new JsonStore(chemin);

  await Promise.all(
    Array.from({ length: 50 }, (_, index) =>
      store.transact((state) => {
        state.auditLogs.push({ id: `t${index}` });
      })
    )
  );

  const identifiants = (await lireEtat(chemin)).auditLogs.map((entree) => entree.id);
  assert.equal(identifiants.length, 50, "des transactions ont été perdues");
  assert.equal(new Set(identifiants).size, 50, "des transactions se sont écrasées");
});

test("un fichier illisible n'est pas écrasé silencieusement", async () => {
  // Une panne de lecture ne doit jamais devenir une perte de données : le code
  // doit échouer bruyamment plutôt que de repartir d'un état vide.
  const dossier = await dossierTemporaire();
  const chemin = join(dossier, "etat.json");
  const corrompu = "{ ceci n'est pas du JSON";
  await writeFile(chemin, corrompu, "utf8");

  const store = new JsonStore(chemin);
  await assert.rejects(store.load());
  assert.equal(await readFile(chemin, "utf8"), corrompu, "le fichier a été modifié alors qu'il était illisible");
});
