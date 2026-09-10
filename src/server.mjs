import { loadDotEnv } from "./env.mjs";

loadDotEnv(); // charge .env (racine du projet) avant toute lecture de process.env

import { access, constants, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { createApp } from "./http/app.mjs";
import { stripeConfiguration, stripeKeyNotice, stripeKeyProblem } from "./payments/stripe.mjs";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST; // absent → écoute IPv6+IPv4 (localhost et 127.0.0.1)

await reportStorage();
reportPayments();

const { server } = createApp();

if (host) {
  server.listen(port, host, onListen);
} else {
  server.listen(port, onListen);
}

function onListen() {
  console.log(`Lastro running at http://localhost:${port}`);
}

// Un problème de clé Stripe est visible dans les journaux avant même le
// premier client : mieux vaut le voir ici que dans un paiement qui échoue.
function reportPayments() {
  const problem = stripeKeyProblem();
  if (problem) {
    console.warn(
      `Lastro — paiement Stripe INUTILISABLE (${problem}) : vérifiez STRIPE_SECRET_KEY et STRIPE_PUBLISHABLE_KEY ` +
        "(clé recopiée en entier, sans retour à la ligne, même mode test/live). Les lectures sont refusées tant que ce n'est pas corrigé."
    );
    return;
  }
  console.log(stripeConfiguration() ? "Lastro — paiement Stripe actif" : "Lastro — paiement non configuré (lectures gratuites)");
  const notice = stripeKeyNotice();
  if (notice) {
    console.warn(
      `Lastro — ${notice} : la clé contenait un retour à la ligne ou un caractère invisible, il a été retiré automatiquement. ` +
        "Recollez la clé proprement dans les variables d'environnement pour éviter toute ambiguïté."
    );
  }
}

// Rend visible dans les journaux si les comptes et dossiers survivront à un
// redémarrage : il faut un disque persistant monté sur le dossier de
// ASTROLAB_DB_PATH (Render : /var/data ou /data), sinon tout est éphémère.
async function reportStorage() {
  const filePath = process.env.ASTROLAB_DB_PATH
    ? resolve(process.env.ASTROLAB_DB_PATH)
    : join(process.cwd(), "data/astrolab.json");
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await access(dirname(filePath), constants.W_OK);
    console.log(`Lastro — stockage : ${filePath}`);
  } catch (error) {
    console.warn(
      `Lastro — stockage NON inscriptible : ${filePath} (${error.code ?? error.message}). ` +
        "Les comptes et dossiers seront perdus au redémarrage : montez un disque persistant sur ce dossier."
    );
  }
}
