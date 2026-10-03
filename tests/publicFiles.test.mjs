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

async function startApp(options = {}) {
  const { server } = createApp({ store: new JsonStore(null), ...options });
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

test("le sitemap déclare l'accueil et les guides publics", async () => {
  const app = await startApp();
  try {
    const reponse = await fetch(`${app.baseUrl}/sitemap.xml`);
    assert.equal(reponse.status, 200);
    assert.match(reponse.headers.get("content-type"), /xml/);
    const texte = await reponse.text();
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/<\/loc>/);
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/ciel\/<\/loc>/);
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/ciel\/octobre-2026\/<\/loc>/);
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/guides\/<\/loc>/);
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/guides\/theme-astral\.html<\/loc>/);
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/guides\/lecture-astrologique-personnalisee\.html<\/loc>/);
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/guides\/signes\/<\/loc>/);
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/guides\/compatibilite-signes-amoureux\.html<\/loc>/);
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/guides\/signes\/belier\.html<\/loc>/);
    assert.match(texte, /<loc>https:\/\/www\.lastro\.fr\/guides\/signes\/poissons\.html<\/loc>/);
    // Aucun chemin privé ne doit y figurer.
    assert.doesNotMatch(texte, /\/r\/|\/api\//);
  } finally {
    await app.close();
  }
});

test("les pages /ciel/ sont indexables et gardent les faits séparés des pages éditoriales", async () => {
  const app = await startApp({ cielNowUtc: "2026-10-03T12:00:00Z" });
  try {
    const index = await fetch(`${app.baseUrl}/ciel/`);
    assert.equal(index.status, 200);
    assert.equal(index.headers.get("x-robots-tag"), null);
    const html = await index.text();
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.lastro\.fr\/ciel\/">/);
    assert.match(html, /<meta property="og:title" content="Ciel du moment \| Lastro">/);
    assert.match(html, /aria-label="Fil d'Ariane"/);
    assert.match(html, /Aujourd'hui/);
    assert.match(html, /Cette semaine/);
    assert.match(html, /Ce mois-ci/);
    assert.match(html, /Prochaines lunaisons/);
    assert.match(html, /Rétrogradations/);
    assert.match(html, /Changements de signe importants/);
    assert.match(html, /Grands aspects à venir/);
    assert.match(html, /href="\/ciel\/octobre-2026\/"/);

    const mois = await fetch(`${app.baseUrl}/ciel/octobre-2026/`);
    assert.equal(mois.status, 200);
    assert.equal(mois.headers.get("x-robots-tag"), null);
    const moisHtml = await mois.text();
    assert.match(moisHtml, /<link rel="canonical" href="https:\/\/www\.lastro\.fr\/ciel\/octobre-2026\/">/);
    assert.match(moisHtml, /Octobre 2026/);
    assert.match(moisHtml, /16 faits célestes/);
    assert.match(moisHtml, /Fait céleste/);
    assert.match(moisHtml, /Nouvelle Lune/);
    assert.match(moisHtml, /Pleine Lune/);
    assert.match(moisHtml, /un événement céleste n'est pas une page éditoriale/);
  } finally {
    await app.close();
  }
});

test("une page événement céleste non publiée reste un vrai 404 noindex", async () => {
  const app = await startApp({ cielNowUtc: "2026-10-03T12:00:00Z" });
  try {
    const page = await fetch(`${app.baseUrl}/ciel/evenements/aspect-non-publie/`);
    assert.equal(page.status, 404);
    assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.match(await page.text(), /Page introuvable/);
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

test("une adresse publique inconnue répond en vrai 404 noindex", async () => {
  const app = await startApp();
  try {
    const page = await fetch(`${app.baseUrl}/cette-page-nexiste-pas`);
    assert.equal(page.status, 404);
    assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.match(await page.text(), /Page introuvable/);

    const guide = await fetch(`${app.baseUrl}/guides/article-inexistant.html`);
    assert.equal(guide.status, 404);
    assert.equal(guide.headers.get("x-robots-tag"), "noindex, nofollow");
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
    assert.match(page, /href="\/guides\/"/);
  } finally {
    await app.close();
  }
});

test("les guides SEO sont servis comme pages indexables", async () => {
  const app = await startApp();
  try {
    const index = await fetch(`${app.baseUrl}/guides/`);
    assert.equal(index.status, 200);
    assert.equal(index.headers.get("x-robots-tag"), null);
    const html = await index.text();
    assert.match(html, /Guides d'astrologie/);
    assert.match(html, /href="\/guides\/ascendant\.html"/);
    assert.match(html, /href="\/guides\/signes\/"/);
    assert.match(html, /href="\/guides\/compatibilite-signes-amoureux\.html"/);

    const article = await fetch(`${app.baseUrl}/guides/ascendant.html`);
    assert.equal(article.status, 200);
    assert.equal(article.headers.get("x-robots-tag"), null);
    const articleHtml = await article.text();
    assert.match(articleHtml, /<link rel="canonical" href="https:\/\/www\.lastro\.fr\/guides\/ascendant\.html">/);
    assert.match(articleHtml, /Pourquoi l'ascendant compte/);

    const signes = await fetch(`${app.baseUrl}/guides/signes/`);
    assert.equal(signes.status, 200);
    const signesHtml = await signes.text();
    assert.match(signesHtml, /Les 12 signes astrologiques/);
    assert.match(signesHtml, /href="\/guides\/signes\/belier\.html"/);

    const belier = await fetch(`${app.baseUrl}/guides/signes/belier.html`);
    assert.equal(belier.status, 200);
    assert.equal(belier.headers.get("x-robots-tag"), null);
    const belierHtml = await belier.text();
    assert.match(belierHtml, /Signe Bélier/);
    assert.match(belierHtml, /Compatibilités fréquentes/);

    const compatibilite = await fetch(`${app.baseUrl}/guides/compatibilite-signes-amoureux.html`);
    assert.equal(compatibilite.status, 200);
    const compatibiliteHtml = await compatibilite.text();
    assert.match(compatibiliteHtml, /Quels signes sont compatibles en amour/);
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
      // inconnue répond 404. Jamais un fichier.
      const bloque = reponse.status === 403;
      const introuvable = reponse.status === 404 && /Page introuvable/.test(corps);
      assert.ok(bloque || introuvable, `réponse inattendue pour ${chemin} : ${reponse.status}`);
    }
  } finally {
    await app.close();
  }
});
