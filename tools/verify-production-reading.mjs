// Vérification de bout en bout EN PRODUCTION, après déploiement.
//
// Pourquoi : les tests verts et un commit déployé ne prouvent pas que le
// correctif agit là où ça compte. Le seul moyen de le savoir est de générer une
// vraie lecture sur lastro.fr et de regarder ce que le client reçoit.
//
// Le code d'accès de test est lu dans l'environnement (ou dans .env, non suivi par
// git) : il n'est JAMAIS affiché, ni en clair, ni tronqué, ni journalisé. Sans ce
// code, le script s'arrête sans rien envoyer.
//
// EFFETS DE BORD ASSUMÉS : une commande est créée en production (conservée
// 30 jours) et une lecture est rédigée par le rédacteur IA.
//
//   node tools/verify-production-reading.mjs            # français (défaut)
//   node tools/verify-production-reading.mjs --language en
//   node tools/verify-production-reading.mjs --base https://www.lastro.fr
//
// Sort en erreur si un signal de régression apparaît : section en brouillon,
// placeholder ou langage interne livré, marge ou convention absente de l'annexe,
// ordre des sections incorrect, ou majorité de sections à vérifier (le faux
// positif de contradiction produisait exactement cela).

import { dossierSectionsInOrder } from "../src/deliverables/plan.mjs";
import { loadDotEnv } from "../src/env.mjs";

function parseArgs(argv) {
  const args = { base: "https://www.lastro.fr", language: "fr", timeout: 240000 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--base") args.base = String(argv[++i] ?? args.base);
    else if (argv[i] === "--language") args.language = String(argv[++i] ?? "fr");
    else if (argv[i] === "--timeout") args.timeout = Number(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
loadDotEnv();

const code = String(process.env.ASTROLAB_TEST_CODE ?? "").trim();
if (!code) {
  console.error(
    "ASTROLAB_TEST_CODE est absent de l'environnement et de .env.\n" +
      "Le code vit dans les variables d'environnement de Render ; pour lancer cette\n" +
      "vérification, ajoutez-le à votre .env local (non suivi par git) — il ne sera\n" +
      "ni affiché ni transmis ailleurs qu'à lastro.fr."
  );
  process.exit(2);
}

// Thème de référence déjà utilisé par les tests : aucune donnée de client réel.
const CORPS = {
  firstName: "Test",
  language: args.language,
  birthDate: "1986-01-02",
  timePrecision: "approximate",
  timeValue: "16:45",
  timeMarginMinutes: 30,
  resolvedPlace: {
    selectedName: "Courbevoie, France",
    country: "France",
    normalizedForCalculation: { latitude: 48.89672, longitude: 2.25666, timeZone: "Europe/Paris" }
  },
  testCode: code
};

const controleur = new AbortController();
const minuteur = setTimeout(() => controleur.abort(), args.timeout);
console.log(`Envoi d'une lecture de test à ${args.base} (langue ${args.language}) — une commande sera créée.`);

let reponse;
try {
  reponse = await fetch(`${args.base}/api/public/readings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(CORPS),
    signal: controleur.signal
  });
} finally {
  clearTimeout(minuteur);
}

const corps = await reponse.json().catch(() => null);
console.log(`HTTP ${reponse.status} · accès offert : ${corps?.freeAccess === true}`);

if (reponse.status !== 200 || !corps?.html) {
  console.error("La lecture n'a pas été produite :", corps?.error ?? "(réponse illisible)");
  process.exit(1);
}

const problemes = [];
const sections = corps.sections ?? [];
const statuts = sections.reduce((acc, section) => {
  acc[section.status] = (acc[section.status] ?? 0) + 1;
  return acc;
}, {});
const ordreAttendu = dossierSectionsInOrder()
  .map((section) => section.id)
  .filter((id) => sections.some((section) => section.id === id));
const ordreRecu = sections.filter((section) => ordreAttendu.includes(section.id)).map((section) => section.id);

console.log(`sections                : ${sections.length} · statuts ${JSON.stringify(statuts)}`);
console.log(`redacteur               : ${corps.writerMode} · modele ${corps.sections?.find((s) => s.model)?.model ?? "n/a"}`);
console.log(`verification croisee    : ${corps.verification?.status ?? "n/a"} (${corps.verification?.correctedCount ?? 0} correction(s), ${corps.verification?.rejectedCount ?? 0} ecartee(s))`);
console.log(`marge publiee           : ${/Marge d'incertitude retenue/.test(corps.html)}`);
console.log(`convention d'aspects    : ${/lastro-aspects@1\.0\.0/.test(corps.html)}`);
console.log(`placeholder livre       : ${/\{[a-z]+\}|\[[^\]]{1,40}\]/.test(corps.html)}`);
console.log(`langage interne livre   : ${/calculated_development_not_production|JPL Horizons|inactive structures/.test(corps.html)}`);

// Contrôles bloquants.
if (corps.writerMode !== "llm") problemes.push("le rédacteur IA n'a pas été utilisé : la lecture n'est qu'un brouillon");
if (statuts.template_draft) problemes.push(`${statuts.template_draft} section(s) en brouillon technique`);
if (statuts.needs_review > sections.length / 2) {
  problemes.push(`${statuts.needs_review}/${sections.length} sections à vérifier : possible retour du faux positif de contradiction`);
}
if (/\{[a-z]+\}|\[[^\]]{1,40}\]/.test(corps.html)) problemes.push("un placeholder a été livré");
if (/calculated_development_not_production|JPL Horizons|inactive structures/.test(corps.html)) {
  problemes.push("du langage interne a été livré");
}
if (!/Marge d'incertitude retenue/.test(corps.html)) problemes.push("la marge d'incertitude est absente de l'annexe");
if (!/lastro-aspects@1\.0\.0/.test(corps.html)) problemes.push("la convention d'aspects est absente de l'annexe");
if (JSON.stringify(ordreRecu) !== JSON.stringify(ordreAttendu)) {
  problemes.push(`ordre des sections incorrect : ${ordreRecu.join(" > ")}`);
}

// Le lien de récupération doit rendre la lecture : c'est ce que le client garde.
const lien = corps.delivery?.link ?? null;
if (!lien) {
  problemes.push("aucun lien de récupération renvoyé");
} else {
  const relecture = await fetch(lien).then((r) => r.json()).catch(() => null);
  const statut = relecture?.delivery?.status ?? "inconnu";
  console.log(`lien de recuperation    : ${statut} · reference ${corps.delivery?.reference ?? "n/a"} (lien non affiché)`);
  if (statut !== "ready") {
    problemes.push(`le lien de récupération ne rend pas la lecture (statut ${statut})`);
  }
}

console.log("");
if (problemes.length > 0) {
  console.log("SIGNAL DE RÉGRESSION EN PRODUCTION :");
  for (const probleme of problemes) {
    console.log(`  - ${probleme}`);
  }
  process.exit(1);
}
console.log("Vérification de production concluante : aucun signal de régression.");
