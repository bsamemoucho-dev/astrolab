// Le tunnel de paiement vend un prix fixe.
//
// Ce que ces tests protègent : le montant envoyé à Stripe est TOUJOURS calculé
// par le serveur. Un montant glissé dans la requête n'est pas corrigé, il est
// ignoré — sans quoi n'importe qui paierait 1 € pour une lecture à 25 €.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { createApp } from "../src/http/app.mjs";

const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_CURRENCY", "ASTROLAB_PRICE_CENTS", "ASTROLAB_PROMO_CODE", "ASTROLAB_PROMO_DISCOUNT_CENTS", "ASTROLAB_LLM_API_KEY"];
// Le paiement n est ouvert que si un redacteur est configure : les tests du
// tunnel fournissent donc aussi cette cle.
const WRITER_KEY = { ASTROLAB_LLM_API_KEY: "cle-de-test" };

async function withKeys(values, run) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

// Le faux Stripe ne remplace QUE les appels à l'API Stripe : les requêtes vers le
// serveur de test continuent de passer par le vrai fetch.
function withFakeStripe(reply, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const cible = String(url);
    if (!cible.startsWith("https://api.stripe.com")) {
      return original(url, options);
    }
    const body = options.body ? Object.fromEntries(new URLSearchParams(options.body)) : {};
    calls.push({ url: cible, body });
    const answer = reply(calls.length, body);
    return {
      ok: answer.ok !== false,
      status: answer.status ?? (answer.ok === false ? 400 : 200),
      json: async () => answer.payload
    };
  };
  return Promise.resolve(run(calls)).finally(() => {
    globalThis.fetch = original;
  });
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

async function post(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

const SESSION_OK = () => ({
  ok: true,
  payload: { id: "cs_test_1", client_secret: "cs_test_1_secret", amount_total: 1500, currency: "eur" }
});

test("la configuration annonce le prix et le code de lancement", async () => {
  const app = await startApp();
  try {
    const config = await (await fetch(`${app.baseUrl}/api/config`)).json();
    assert.equal(config.pricing.version, "lastro-pricing@1.0.0");
    assert.equal(config.pricing.currency, "eur");
    assert.equal(config.pricing.baseCents, 2500);
    assert.equal(config.pricing.promoCode, "bessbousse10");
    assert.equal(config.pricing.promoDiscountCents, 1000);
    assert.equal(config.pricing.totalCents, 1500);
  } finally {
    await app.close();
  }
});

test("le devis est public : c'est le serveur qui calcule, le site affiche", async () => {
  const app = await startApp();
  try {
    const avec = await post(app.baseUrl, "/api/public/price-quote", { promoCode: "BessBousse10" });
    assert.equal(avec.status, 200);
    assert.equal(avec.payload.quote.baseCents, 2500);
    assert.equal(avec.payload.quote.discountCents, 1000);
    assert.equal(avec.payload.quote.totalCents, 1500);
    assert.equal(avec.payload.quote.valid, true);

    const sans = await post(app.baseUrl, "/api/public/price-quote", {});
    assert.equal(sans.payload.quote.totalCents, 2500);
    assert.equal(sans.payload.quote.valid, false);
    assert.equal(sans.payload.quote.reason, "empty");

    const faux = await post(app.baseUrl, "/api/public/price-quote", { promoCode: "gratuit" });
    assert.equal(faux.payload.quote.totalCents, 2500);
    assert.equal(faux.payload.quote.reason, "unknown");
  } finally {
    await app.close();
  }
});

test("le montant envoyé par le navigateur est ignoré", async () => {
  await withKeys({ STRIPE_SECRET_KEY: "sk_test_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_test_abc123456789", ...WRITER_KEY }, () =>
    withFakeStripe(SESSION_OK, async (calls) => {
      const app = await startApp();
      try {
        // Le code de lancement s'applique : 15 €, quoi que raconte le client.
        const session = await post(app.baseUrl, "/api/public/checkout-session", {
          amountCents: 100,
          promoCode: "bessbousse10",
          language: "fr"
        });
        assert.equal(session.status, 201);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].body["line_items[0][price_data][unit_amount]"], "1500");
        assert.match(calls[0].body["line_items[0][price_data][product_data][name]"], /offre de lancement/);
        assert.equal(calls[0].body["line_items[0][quantity]"], "1");

        // Sans code : plein tarif, toujours sans lire le montant du client.
        await post(app.baseUrl, "/api/public/checkout-session", { amountCents: 100, label: "cadeau" });
        assert.equal(calls.length, 2);
        assert.equal(calls[1].body["line_items[0][price_data][unit_amount]"], "2500");
        assert.doesNotMatch(calls[1].body["line_items[0][price_data][product_data][name]"], /cadeau/);
      } finally {
        await app.close();
      }
    })
  );
});

test("un code inconnu ne fait pas payer et ne crée aucun paiement", async () => {
  await withKeys({ STRIPE_SECRET_KEY: "sk_test_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_test_abc123456789", ...WRITER_KEY }, () =>
    withFakeStripe(SESSION_OK, async (calls) => {
      const app = await startApp();
      try {
        const refus = await post(app.baseUrl, "/api/public/checkout-session", { promoCode: "gratuit" });
        assert.equal(refus.status, 400);
        assert.equal(refus.payload.code, "unknown_promo_code");
        assert.equal(calls.length, 0, "aucun appel à Stripe : on ne demande pas au client de payer un prix qu'il n'attendait pas");
      } finally {
        await app.close();
      }
    })
  );
});

test("le prix de l'offre peut être changé sans toucher au code", async () => {
  await withKeys(
    {
      STRIPE_SECRET_KEY: "sk_test_abc123456789",
      STRIPE_PUBLISHABLE_KEY: "pk_test_abc123456789",
      ...WRITER_KEY,
      ASTROLAB_PRICE_CENTS: "3500",
      ASTROLAB_PROMO_CODE: "lancement2026",
      ASTROLAB_PROMO_DISCOUNT_CENTS: "1500"
    },
    () =>
      withFakeStripe(SESSION_OK, async (calls) => {
        const app = await startApp();
        try {
          const config = await (await fetch(`${app.baseUrl}/api/config`)).json();
          assert.equal(config.pricing.baseCents, 3500);
          assert.equal(config.pricing.promoCode, "lancement2026");
          assert.equal(config.pricing.totalCents, 2000);

          // L'ancien code ne donne plus rien.
          const ancien = await post(app.baseUrl, "/api/public/price-quote", { promoCode: "bessbousse10" });
          assert.equal(ancien.payload.quote.reason, "unknown");

          const session = await post(app.baseUrl, "/api/public/checkout-session", { promoCode: "LANCEMENT2026" });
          assert.equal(session.status, 201);
          assert.equal(calls[0].body["line_items[0][price_data][unit_amount]"], "2000");
        } finally {
          await app.close();
        }
      })
  );
});

test("sans clé Stripe, aucun paiement n'est ouvert", async () => {
  await withKeys({}, async () => {
    const app = await startApp();
    try {
      const reponse = await post(app.baseUrl, "/api/public/checkout-session", { promoCode: "bessbousse10" });
      assert.equal(reponse.status, 503);
    } finally {
      await app.close();
    }
  });
});

// Contrôles statiques du site : ils ne prouvent pas le comportement du
// navigateur, ils interdisent qu'on revienne au prix libre ou qu'on oublie une
// langue sans s'en apercevoir.
test("le site n'a plus de montant libre, et parle des neuf langues", () => {
  const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

  // Plus aucun champ de montant, plus aucune puce de prix.
  assert.doesNotMatch(page, /id="pay-amount"/);
  assert.doesNotMatch(page, /data-amount=/);
  assert.doesNotMatch(page, /id="price-slider"/);
  assert.doesNotMatch(source, /bindPriceSlider/);
  // Le code de lancement est pré-rempli, et le prix demandé au serveur.
  assert.match(page, /id="pay-promo"/);
  assert.match(source, /\/api\/public\/price-quote/);
  assert.match(source, /promoCode: quote\?\.valid/);
  // Le corps envoyé au paiement ne porte aucun montant : cherché dans la requête
  // elle-même, pas dans tout le fichier (la vue commerciale a ses propres tarifs).
  const appel = /\/api\/public\/checkout-session[\s\S]{0,400}/.exec(source);
  assert.ok(appel, "l'appel au paiement doit exister");
  assert.doesNotMatch(appel[0], /amountCents/, "le site n'envoie plus aucun montant");

  // Chaque libellé de prix existe dans les neuf langues.
  for (const cle of ["payPromoLabel", "payOfferNote", "payPromoApplied", "payPromoUnknown", "payPromoEmpty"]) {
    const occurrences = (source.match(new RegExp(`${cle}:`, "g")) ?? []).length;
    assert.equal(occurrences, 9, `${cle} doit être traduit dans les neuf langues (${occurrences})`);
  }
  // Et les libellés de remise portent bien la variable de montant.
  assert.equal((source.match(/\{discount\}/g) ?? []).length >= 9, true);
  assert.equal((source.match(/\{total\}/g) ?? []).length >= 18, true);
});

test("chaque élément de prix manipulé par le site existe dans la page", () => {
  // Un identifiant renommé d'un côté seulement laissait un affichage muet : le
  // prix ne se mettait plus à jour, sans erreur visible.
  const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const ids = new Set(
    [...source.matchAll(/(?:\$|setNodeText)\(\s*"#([a-z0-9-]+)"/g)].map((m) => m[1])
  );
  const prix = [...ids].filter((id) => id.startsWith("pay-") || id.startsWith("offre-"));
  assert.equal(prix.length >= 14, true, `identifiants de prix trouvés : ${prix.length} : ${prix.join(", ")}`);
  for (const id of prix) {
    assert.match(page, new RegExp(`id="${id}"`), `#${id} doit exister dans la page`);
  }
});
