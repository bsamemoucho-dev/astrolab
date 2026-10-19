// Vérification de bout en bout d'un service de préversion (Vtest).
//
// Différence avec verify-production-reading.mjs : ce script n'exige aucun code
// d'accès (la préversion autorise les lectures libres), respecte la protection
// par mot de passe, et ne considère PAS l'absence de rédacteur IA comme une
// panne : sans clé, le dossier est un brouillon technique complet, ce qui est le
// comportement attendu d'un service de test sans dépense.
//
//   ASTROLAB_PREVIEW_AUTH="utilisateur:motdepasse" \
//     node tools/vtest-smoke.mjs --base https://lastro-vtest.onrender.com
//
//   node tools/vtest-smoke.mjs --base http://127.0.0.1:4399 --no-auth
//
// Aucun appel payant : si une clé LLM est configurée côté service, la génération
// déclenchera de vrais appels facturés (une seule lecture, bornée par le plafond
// ASTROLAB_LLM_BUDGET_USD du service).

const args = { base: "http://127.0.0.1:4399", timeout: 240000, requireLlm: false, expectNoindex: true };
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === "--base") args.base = String(process.argv[++i] ?? args.base);
  else if (arg === "--timeout") args.timeout = Number(process.argv[++i]);
  else if (arg === "--require-llm") args.requireLlm = true;
  else if (arg === "--no-noindex") args.expectNoindex = false;
  else if (arg === "--no-auth") args.noAuth = true;
}

const base = args.base.replace(/\/+$/, "");
const previewAuth = String(process.env.ASTROLAB_PREVIEW_AUTH ?? "").trim();
const authorization = (() => {
  if (args.noAuth || !previewAuth) return null;
  return `Basic ${Buffer.from(previewAuth).toString("base64")}`;
})();

function headers(extra = {}) {
  return { ...(authorization ? { authorization } : {}), ...extra };
}

const problemes = [];
const lignes = [];
const note = (label, value) => lignes.push([label, String(value)]);
const signaler = (probleme) => problemes.push(probleme);

async function get(path, options = {}) {
  const reponse = await fetch(`${base}${path}`, { headers: headers(options.headers), redirect: "manual", signal: options.signal });
  return reponse;
}

// --- 1. Santé ---------------------------------------------------------------
const sante = await get("/healthz");
if (sante.status !== 200) {
  console.error(`/healthz répond ${sante.status} : le service n'est pas joignable (ou la protection bloque la sonde).`);
  process.exit(1);
}
const santeJson = await sante.json();
note("service", `${santeJson.release} · production=${santeJson.production}`);

// --- 2. Accueil et en-têtes -------------------------------------------------
const accueil = await get("/");
if (accueil.status === 401) {
  console.error("401 sur / : renseignez ASTROLAB_PREVIEW_AUTH (utilisateur:motdepasse) ou passez --no-auth.");
  process.exit(1);
}
if (accueil.status !== 200) {
  signaler(`l'accueil répond ${accueil.status}`);
}
const html = await accueil.text();
note("accueil", `${accueil.status} · titre « Votre signe n’est que… » : ${/Votre signe n’est que/.test(html)}`);
if (!/Votre signe n’est que/.test(html)) signaler("le nouveau titre d'accueil est absent");
if (!/personne ne peut décider à votre place/.test(html)) signaler("la phrase de clôture de la section pédagogique est absente");
if (!/Vous n’avez donc pas un seul signe/.test(html)) signaler("la phrase clé de la section pédagogique est absente");

const robotsTag = accueil.headers.get("x-robots-tag") ?? "";
note("noindex", robotsTag || "(absent)");
if (args.expectNoindex && !robotsTag.includes("noindex")) signaler("x-robots-tag noindex absent sur l'accueil");
if (!args.expectNoindex && robotsTag.includes("noindex")) signaler("noindex présent alors que le test attend la production");

const robots = await get("/robots.txt");
const robotsBody = await robots.text();
const robotsFerme = /Disallow: \/\s*$/m.test(robotsBody) && !/Sitemap:/.test(robotsBody);
note("robots.txt", robotsFerme ? "fermé (Disallow: /)" : "ouvert (plan de production)");
if (args.expectNoindex && !robotsFerme) signaler("robots.txt n'interdit pas l'exploration");
if (!args.expectNoindex && robotsFerme) signaler("robots.txt fermé sur un service qui doit être indexable");

// --- 3. Configuration publique ---------------------------------------------
const configReponse = await get("/api/config");
if (configReponse.status !== 200) {
  signaler(`/api/config répond ${configReponse.status}`);
} else {
  const config = await configReponse.json();
  note("paiement", config.payments?.configured ? `ACTIF (${config.payments.provider})` : "désactivé");
  note("commerce", config.commerceEnabled ? "actif" : "désactivé");
  note("e-mail", config.emailConfigured ? "ACTIF" : "désactivé (file interne)");
  note("rédacteur", config.llmConfigured ? `configuré (${config.llmModel})` : "absent → brouillon technique");
  note("plafond LLM", config.llmBudget ? `${config.llmBudget.remainingUsd} $ restants sur ${config.llmBudget.capUsd} $` : "aucun");

  if (config.payments?.configured) signaler("des clés Stripe sont configurées sur un service de test");
  if (config.emailConfigured) signaler("un envoi d'e-mail réel est configuré sur un service de test");
  if (config.commerceEnabled) signaler("le commerce est actif sur un service de test");
  if (args.requireLlm && !config.llmConfigured) signaler("le rédacteur IA est requis (--require-llm) mais absent");
}

// --- 4. Génération d'un dossier fictif --------------------------------------
// Thème de test : aucune donnée réelle (2 janvier 1986, 16:45, Courbevoie).
const payload = {
  firstName: "Test",
  language: "fr",
  birthDate: "1986-01-02",
  timePrecision: "approximate",
  timeValue: "16:45",
  timeMarginMinutes: 30,
  deliveryEmail: "vtest@example.test",
  resolvedPlace: {
    selectedName: "Courbevoie, France",
    country: "France",
    normalizedForCalculation: { latitude: 48.89672, longitude: 2.25666, timeZone: "Europe/Paris" }
  }
};

const controleur = new AbortController();
const minuteur = setTimeout(() => controleur.abort(), args.timeout);
console.log(`Génération d'une lecture de test sur ${base}…`);
let lecture;
try {
  lecture = await fetch(`${base}/api/public/readings`, {
    method: "POST",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
    signal: controleur.signal
  });
} finally {
  clearTimeout(minuteur);
}

let job = await lecture.json().catch(() => null);
note("génération", `HTTP ${lecture.status} · statut ${job?.status ?? "n/a"} · accès offert: ${job?.freeAccess === true}`);

if (lecture.status >= 400 || !job?.readingId) {
  signaler(`la lecture n'a pas été lancée (HTTP ${lecture.status}) : ${job?.error ?? "réponse illisible"}`);
} else {
  // La génération est asynchrone : on interroge son état jusqu'à la fin.
  const echeance = Date.now() + args.timeout;
  while (job.status !== "ready" && job.status !== "failed" && Date.now() < echeance) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const etat = await fetch(`${base}/api/public/readings/${encodeURIComponent(job.readingId)}/status`, { headers: headers() });
    if (!etat.ok) {
      signaler(`le suivi de génération répond ${etat.status}`);
      break;
    }
    job = await etat.json();
  }
  note("statut final", job.status);

  if (job.status !== "ready") {
    signaler(`la génération n'a pas abouti (statut ${job.status})`);
  } else {
    // Le document est lu par le même chemin que le client : son lien de récupération.
    const lien = job.delivery?.link ?? null;
    const jeton = lien ? String(lien).split("/r/")[1]?.replace(/\/+$/, "") : null;
    if (!jeton) {
      signaler("aucun lien de récupération renvoyé");
    } else {
      const document = await fetch(`${base}/api/public/deliveries/${encodeURIComponent(jeton)}`, { headers: headers() })
        .then((r) => r.json())
        .catch(() => null);
      const lectureFinale = document?.delivery?.reading ?? null;
      const statutLien = document?.delivery?.status ?? "inconnu";
      note("lien de récupération", `${statutLien} · référence ${job.delivery?.reference ?? "n/a"}`);
      if (statutLien !== "ready") signaler(`le lien de récupération ne rend pas la lecture (statut ${statutLien})`);

      const htmlFinal = String(lectureFinale?.html ?? "");
      const sections = lectureFinale?.sections ?? [];
      const statuts = sections.reduce((acc, section) => {
        acc[section.status] = (acc[section.status] ?? 0) + 1;
        return acc;
      }, {});
      note("sections", sections.length ? `${sections.length} · ${JSON.stringify(statuts)}` : "non exposées par l'API publique (le document fait foi)");
      note("rédacteur utilisé", lectureFinale?.writerMode ?? job.writerMode ?? "n/a");
      note("annexe aspects", /lastro-aspects@1\.0\.0/.test(htmlFinal) ? "présente" : "ABSENTE");
      note("marge d'incertitude", /Marge d'incertitude retenue/.test(htmlFinal) ? "présente" : "ABSENTE");
      note("placeholders", /\{[a-z]+\}|\[[^\]]{1,40}\]/.test(htmlFinal) ? "PRÉSENTS" : "aucun");
      note("taille du document", `${Math.round(htmlFinal.length / 1024)} Ko`);

      if (!htmlFinal) signaler("le document est vide");
      if (!/lastro-aspects@1\.0\.0/.test(htmlFinal)) signaler("la convention d'aspects est absente de l'annexe");
      if (!/Marge d'incertitude retenue/.test(htmlFinal)) signaler("la marge d'incertitude est absente de l'annexe");
      if (/\{[a-z]+\}|\[[^\]]{1,40}\]/.test(htmlFinal)) signaler("un placeholder a été livré");
      const modeRedacteur = lectureFinale?.writerMode ?? null;
      if (modeRedacteur !== "llm") {
        const message = "les sections narratives sont des brouillons techniques (aucune clé LLM sur ce service)";
        if (args.requireLlm) signaler(message);
        else note("à savoir", message);
      }
    }
  }
}

// --- Synthèse ---------------------------------------------------------------
console.log("");
for (const [label, value] of lignes) {
  console.log(`${label.padEnd(24)}: ${value}`);
}
console.log("");
if (problemes.length > 0) {
  console.log("PROBLÈMES DÉTECTÉS :");
  for (const probleme of problemes) console.log(`  - ${probleme}`);
  process.exit(1);
}
console.log("Vérification de préversion concluante.");
