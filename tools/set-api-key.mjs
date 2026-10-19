// Enregistre une clé API dans `.env` sans jamais l'afficher.
//
// Pourquoi cet outil : les one-liners `read -s -p` se cassent selon le shell
// (zsh, bash, découpage des guillemets), et une clé tapée dans un terminal
// n'atteint pas les processus lancés ailleurs. Ici : une question, aucune
// frappe affichée, aucune valeur dans l'historique du shell, un fichier
// gitignoré, et un remplacement idempotent de la ligne existante.
//
//   node tools/set-api-key.mjs anthropic
//   node tools/set-api-key.mjs openai
//
// Le script n'écrit jamais la valeur sur la sortie standard ni dans un message
// d'erreur ; il affiche seulement une empreinte courte pour permettre de
// vérifier qu'on a enregistré la bonne clé.

import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

const VARIABLES = {
  anthropic: { nom: "ANTHROPIC_API_KEY", libelle: "Clé Claude (Anthropic)", prefixe: "sk-ant-" },
  openai: { nom: "ASTROLAB_LLM_API_KEY", libelle: "Clé OpenAI (rédacteur Lastro)", prefixe: "sk-" }
};

const RACINE = resolve(import.meta.dirname, "..");
const FICHIER = join(RACINE, ".env");

export function nettoyerValeur(brut) {
  // Un collage dans un terminal moderne envoie des marqueurs de « bracketed
  // paste » (ESC[200~ … ESC[201~) : sans ce nettoyage, ils se retrouveraient
  // au début et à la fin de la clé.
  let valeur = String(brut ?? "")
    .replace(/\u001b\[[0-9;]*[A-Za-z~]/g, "")
    .replace(/[\r\n]+/g, "")
    .trim();
  if (
    (valeur.startsWith('"') && valeur.endsWith('"')) ||
    (valeur.startsWith("'") && valeur.endsWith("'"))
  ) {
    valeur = valeur.slice(1, -1).trim();
  }
  return valeur;
}

export function validerValeur(valeur, { prefixe = null } = {}) {
  if (!valeur) return "la clé est vide";
  if (/\s/.test(valeur)) return "la clé contient un espace (copie incomplète ?)";
  if (valeur.length < 20) return "la clé semble trop courte";
  if (prefixe && !valeur.startsWith(prefixe)) {
    return `cette clé ne commence pas par « ${prefixe} » — vérifie que tu n'as pas collé autre chose`;
  }
  return null;
}

// Remplace la ligne si elle existe, l'ajoute sinon. Ne touche à rien d'autre.
export function ecrireVariable(contenu, nom, valeur) {
  const lignes = String(contenu ?? "").split("\n");
  const motif = new RegExp(`^\\s*${nom}\\s*=`);
  const restantes = lignes.filter((ligne) => !motif.test(ligne));
  while (restantes.length > 0 && restantes[restantes.length - 1].trim() === "") restantes.pop();
  restantes.push(`${nom}=${valeur}`);
  return `${restantes.join("\n")}\n`;
}

export function empreinte(valeur) {
  return createHash("sha256").update(String(valeur)).digest("hex").slice(0, 10);
}

function lireSecret(prompt) {
  return new Promise((resolvePromise, rejectPromise) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY) {
      rejectPromise(
        new Error(
          "Ce script a besoin d'un terminal interactif. Ouvre un Terminal (ou l'onglet Terminal de l'application) puis relance la commande."
        )
      );
      return;
    }
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let valeur = "";
    const terminer = (erreur) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (erreur) rejectPromise(erreur);
      else resolvePromise(valeur);
    };
    const onData = (chunk) => {
      for (const caractere of chunk) {
        if (caractere === "\u0003") {
          terminer(new Error("interrompu (Ctrl-C) — rien n'a été écrit"));
          return;
        }
        if (caractere === "\r" || caractere === "\n") {
          terminer(null);
          return;
        }
        if (caractere === "\u007f" || caractere === "\b") {
          valeur = valeur.slice(0, -1);
          continue;
        }
        // ESC est conservé pour que `nettoyerValeur` puisse retirer proprement
        // les séquences de collage ; les autres caractères de contrôle non.
        if (caractere >= " " || caractere === "\u001b") valeur += caractere;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const fournisseur = String(process.argv[2] ?? "").trim().toLowerCase();
  const cible = VARIABLES[fournisseur];
  if (!cible) {
    console.error(`Usage : node tools/set-api-key.mjs <${Object.keys(VARIABLES).join("|")}>`);
    process.exitCode = 1;
    return;
  }

  console.log(`Fichier cible : ${FICHIER}`);
  console.log(`Variable      : ${cible.nom}`);
  console.log("Colle la clé puis appuie sur Entrée. Rien ne s'affiche pendant la frappe.\n");

  let brut;
  try {
    brut = await lireSecret(`${cible.libelle} : `);
  } catch (erreur) {
    console.error(`✖ ${erreur.message}`);
    process.exitCode = 1;
    return;
  }
  const valeur = nettoyerValeur(brut);
  const probleme = validerValeur(valeur, { prefixe: cible.prefixe });
  if (probleme) {
    console.error(`✖ ${probleme} — rien n'a été écrit.`);
    process.exitCode = 1;
    return;
  }

  const contenu = existsSync(FICHIER) ? readFileSync(FICHIER, "utf8") : "";
  writeFileSync(FICHIER, ecrireVariable(contenu, cible.nom, valeur), { mode: 0o600 });
  chmodSync(FICHIER, 0o600);

  console.log(`✔ ${cible.nom} enregistrée dans .env (fichier protégé, ignoré par Git).`);
  console.log(`  longueur : ${valeur.length} caractères · empreinte : ${empreinte(valeur)}`);
  console.log("  La valeur n'a jamais été affichée ni écrite dans l'historique du shell.");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await main();
}
