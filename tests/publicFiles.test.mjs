// Fichiers publics et indexation.
//
// Un audit externe a relevé l'absence de robots.txt et de sitemap.xml. La vraie
// question n'était pas là : le site n'a qu'une page publique, mais il expose des
// chemins PRIVÉS (le lien de récupération d'une lecture achetée, l'API). Ces
// chemins ne doivent jamais être indexés, et le repli monopage ne doit pas
// transformer une adresse inconnue en page indexable.

import assert from "node:assert/strict";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";

async function startApp() {
  const { server } = createApp({ store: new JsonStore(null) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

test("robots.txt interdit les chemins privés et annonce le sitemap", async () => {
  const app = await startApp();
  try {
    const reponse = await fetch(`${app.baseUrl}/robots.txt`);
    assert.equal(reponse.status, 200);
    assert.match(reponse.headers.get("content-type"), /text\/plain/);
    const texte = await reponse.text();
    assert.match(texte, /^User-agent: \*/m);
    assert.match(texte, /^Disallow: \/api\/$/m);
    assert.match(texte, /^Disallow: \/r\/$/m);
    assert.match(texte, /Sitemap: https:\/\/www\.lastro\.fr\/sitemap\.xml/);
  } finally {
    await app.close();
  }
});

test("le sitemap ne déclare que l'adresse publique", async () => {
  const app = await startApp();
  try {
    const reponse = await fetch(`${app.baseUrl}/sitemap.xml`);
    assert.equal(reponse.status, 200);
    assert.match(reponse.headers.get("content-type"), /xml/);
    const texte = await reponse.text();
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/<\/loc>/);
    // Aucun chemin privé ne doit y figurer.
    assert.doesNotMatch(texte, /\/r\/|\/api\//);
  } finally {
    await app.close();
  }
});

test("le lien de récupération d'une lecture n'est jamais indexable", async () => {
  const app = await startApp();
  try {
    // Même chose qu'un jeton inexistant : le repli monopage rend l'application,
    // mais l'en-tête doit l'empêcher d'être indexée.
    const page = await fetch(`${app.baseUrl}/r/JETONDETESTQUINEXISTEPAS`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");

    const api = await fetch(`${app.baseUrl}/api/public/deliveries/JETONDETESTQUINEXISTEPAS`);
    assert.equal(api.headers.get("x-robots-tag"), "noindex, nofollow");

    // La page publique, elle, reste indexable.
    const accueil = await fetch(`${app.baseUrl}/`);
    assert.equal(accueil.headers.get("x-robots-tag"), null);
  } finally {
    await app.close();
  }
});

test("la page publique annonce le service vendu, pas l'outil interne", async () => {
  const app = await startApp();
  try {
    const page = await (await fetch(`${app.baseUrl}/`)).text();
    const description = page.match(/<meta name="description" content="([^"]+)"/);
    assert.ok(description, "la description doit exister");
    // La description parlait de « dossier personnel » et d'« analyses
    // transversales » : le vocabulaire de l'outil d'exploitation, pas du service.
    assert.doesNotMatch(description[1], /analyses transversales|Dossier personnel/i);
    assert.match(description[1], /lecture astrologique personnalisée/i);
    assert.match(page, /<link rel="canonical" href="https:\/\/www\.lastro\.fr\/">/);
    assert.match(page, /<meta property="og:title"/);
    assert.match(page, /<link rel="icon" href="\/favicon\.svg"/);
  } finally {
    await app.close();
  }
});

test("le favicon est servi", async () => {
  const app = await startApp();
  try {
    const reponse = await fetch(`${app.baseUrl}/favicon.svg`);
    assert.equal(reponse.status, 200);
    assert.match(reponse.headers.get("content-type"), /image\/svg\+xml/);
  } finally {
    await app.close();
  }
});

test("le service de fichiers ne sort jamais du dossier public", async () => {
  // La traversée est déjà neutralisée par le lecteur d'URL (`/../x` devient `/x`)
  // et par le contrôle `relative()` de `sendStatic`. Ce test le verrouille : une
  // réécriture du service statique ne doit pas transformer le repli monopage en
  // lecture de fichier arbitraire.
  const app = await startApp();
  try {
    // Chaque tentative vise un fichier précis, avec un marqueur qui n'existe que
    // dans ce fichier : c'est la seule preuve utile (« la réponse ne contient pas
    // le code source »), le repli monopage répondant 200 par construction.
    const cibles = [
      { chemin: "/../.env", marqueur: "ASTROLAB_LLM_API_KEY" },
      { chemin: "/../../etc/passwd", marqueur: "root:" },
      { chemin: "/%2e%2e%2f%2e%2e%2fetc%2fpasswd", marqueur: "root:" },
      { chemin: "/..%2f..%2fetc%2fpasswd", marqueur: "root:" },
      { chemin: "/....//....//etc/passwd", marqueur: "root:" },
      { chemin: "/../src/http/app.mjs", marqueur: "createApp" },
      { chemin: "/../src/db/jsonStore.mjs", marqueur: "class JsonStore" },
      { chemin: "/../package.json", marqueur: "\"astronomy-engine\"" },
      { chemin: "/../data/astrolab.json", marqueur: "passwordHash" }
    ];
    for (const { chemin, marqueur } of cibles) {
      const reponse = await fetch(`${app.baseUrl}${chemin}`);
      const corps = await reponse.text();
      assert.ok(
        !corps.includes(marqueur),
        `fuite de fichier via ${chemin} (marqueur « ${marqueur} » trouvé)`
      );
      // Deux issues acceptables, et seulement deux : le garde-fou de traversée
      // répond 403 (cas des chemins encodés, comme `/..%2f..%2f`), ou l'adresse
      // inconnue retombe sur la page de l'application. Jamais un fichier.
      const bloque = reponse.status === 403;
      const pageApplication = reponse.status === 200 && /<title>Lastro/.test(corps);
      assert.ok(bloque || pageApplication, `réponse inattendue pour ${chemin} : ${reponse.status}`);
    }
  } finally {
    await app.close();
  }
});
