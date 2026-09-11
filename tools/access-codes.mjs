// Codes à usage unique : fabrication et suivi, en ligne de commande.
//
//   node tools/access-codes.mjs create --count 20 --label "Lancement" --expires 90
//   node tools/access-codes.mjs list
//   node tools/access-codes.mjs revoke <identifiant>
//
// Les codes en clair ne sont affichés qu'à la création : seul leur hachage est
// enregistré (voir src/models/accessCodeService.mjs). Perdre la sortie de
// `create` oblige à effacer les codes et à recommencer.
//
// AVERTISSEMENT — le serveur garde tout l'état en mémoire et réécrit le fichier
// entier à chaque transaction. Écrire ici pendant qu'il tourne, c'est risquer
// qu'il écrase les codes créés au prochain enregistrement. Deux façons de faire
// proprement :
//   - arrêter le service, lancer la commande, redémarrer ;
//   - ou lancer la commande puis redémarrer le service (Render → Manual Deploy),
//     ce qui recharge le fichier et rend les codes visibles.
// Le serveur ne relit pas le fichier tout seul : il ne verra les nouveaux codes
// qu'après un redémarrage.

import { join } from "node:path";

import { JsonStore } from "../src/db/jsonStore.mjs";
import {
  createAccessCodes,
  listAccessCodes,
  revokeAccessCode
} from "../src/models/accessCodeService.mjs";

function parseArgs(argv) {
  const args = { commande: argv[0] ?? null, count: 20, label: null, expires: null, db: null, valeur: null };
  for (let index = 1; index < argv.length; index += 1) {
    const suivant = argv[index];
    if (suivant === "--count") args.count = Number(argv[++index]);
    else if (suivant === "--label") args.label = String(argv[++index]);
    else if (suivant === "--expires") args.expires = Number(argv[++index]);
    else if (suivant === "--db") args.db = String(argv[++index]);
    else if (!suivant.startsWith("--") && args.valeur === null) args.valeur = suivant;
  }
  return args;
}

const USAGE = `Usage :
  node tools/access-codes.mjs create [--count 20] [--label "Lancement"] [--expires 90] [--db chemin]
  node tools/access-codes.mjs list [--db chemin]
  node tools/access-codes.mjs revoke <identifiant> [--db chemin]

  --count    nombre de codes à créer (défaut 20)
  --label    étiquette libre, pour retrouver un lot (« Lancement »)
  --expires  durée de validité en jours (défaut : sans expiration)
  --db       chemin du fichier d'état (défaut : $ASTROLAB_DB_PATH ou data/astrolab.json)`;

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.commande || !["create", "list", "revoke"].includes(args.commande)) {
    console.error(USAGE);
    process.exit(args.commande ? 1 : 0);
  }

  const chemin = args.db ?? process.env.ASTROLAB_DB_PATH ?? join(process.cwd(), "data/astrolab.json");
  const store = new JsonStore(chemin);
  const etat = await store.load();

  if (args.commande === "create") {
    if (!Number.isInteger(args.count) || args.count < 1 || args.count > 1000) {
      console.error("--count doit être un entier entre 1 et 1000.");
      process.exit(2);
    }
    const expiresAt = args.expires
      ? new Date(Date.now() + args.expires * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const crees = await store.transact((state) =>
      createAccessCodes(state, { count: args.count, label: args.label, expiresAt })
    );

    console.log(`${crees.length} code(s) créé(s) dans ${chemin}`);
    console.log(
      expiresAt ? `Valides jusqu'au ${expiresAt.slice(0, 10)}.` : "Sans date d'expiration."
    );
    console.log("\nCodes — à noter MAINTENANT, ils ne seront plus affichés :\n");
    for (const entree of crees) {
      console.log(`  ${entree.code}    (${entree.id})`);
    }
    console.log(
      "\nSeul le hachage est enregistré : ces codes ne peuvent plus être relus.\n" +
        "Redémarrez le service pour qu'il les prenne en compte (il garde l'état en mémoire)."
    );
    return;
  }

  if (args.commande === "list") {
    const codes = listAccessCodes(etat);
    if (!codes.length) {
      console.log("Aucun code enregistré dans " + chemin);
      return;
    }
    const disponibles = codes.filter((entree) => entree.state === "disponible").length;
    console.log(`${codes.length} code(s) dans ${chemin} — ${disponibles} disponible(s)\n`);
    for (const entree of codes) {
      const details = [
        entree.state,
        entree.label ? `« ${entree.label} »` : null,
        `créé ${entree.createdAt.slice(0, 10)}`,
        entree.expiresAt ? `expire ${entree.expiresAt.slice(0, 10)}` : null,
        entree.usedAt ? `utilisé ${entree.usedAt.slice(0, 10)}` : null,
        entree.deliveryReference ? `lecture ${entree.deliveryReference}` : null
      ]
        .filter(Boolean)
        .join(" · ");
      console.log(`  ${entree.id}  ${details}`);
    }
    console.log(
      "\nPour retrouver la lecture d'un code utilisé, cherchez sa référence dans le stockage :\n" +
        "le lien /r/<jeton> correspondant n'est pas stocké ici."
    );
    return;
  }

  // revoke
  if (!args.valeur) {
    console.error("Indiquez l'identifiant du code à révoquer (voir `list`).");
    process.exit(2);
  }
  const revoque = await store.transact((state) => revokeAccessCode(state, args.valeur));
  console.log(
    revoque
      ? `Code ${args.valeur} révoqué.`
      : `Aucun code disponible ne correspond à ${args.valeur} (déjà utilisé, déjà révoqué, ou inconnu).`
  );
  console.log("Redémarrez le service pour qu'il prenne en compte la révocation.");
}

await main();
