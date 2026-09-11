import test from "node:test";
import assert from "node:assert/strict";

import { stripeConfiguration, stripeKeyDiagnostics, stripeKeyNotice, stripeKeyProblem } from "../src/payments/stripe.mjs";

const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_CURRENCY"];

function withKeys(values, run) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  try {
    return run();
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

test("aucune clé : paiement non configuré, sans problème signalé", () => {
  withKeys({}, () => {
    assert.equal(stripeKeyProblem(), null);
    assert.equal(stripeConfiguration(), null);
  });
});

test("une seule clé sur deux : configuration incomplète", () => {
  withKeys({ STRIPE_SECRET_KEY: "sk_test_abc123456789" }, () => {
    assert.equal(stripeKeyProblem(), "incomplete_key_pair");
    assert.equal(stripeConfiguration(), null);
  });
});

test("clé secrète collée avec un retour à la ligne : nettoyée et signalée", () => {
  withKeys(
    { STRIPE_SECRET_KEY: "sk_test_abc123\n456789", STRIPE_PUBLISHABLE_KEY: "pk_test_abc123456789" },
    () => {
      assert.equal(stripeKeyProblem(), null);
      assert.equal(stripeKeyNotice(), "secret_key_cleaned");
      assert.equal(stripeConfiguration().secretKey, "sk_test_abc123456789");
    }
  );
});

test("caractère invisible dans la clé : nettoyé et signalé", () => {
  withKeys(
    { STRIPE_SECRET_KEY: "sk_live_abc\u200b123456789", STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789" },
    () => {
      assert.equal(stripeKeyNotice(), "secret_key_cleaned");
      assert.equal(stripeConfiguration().secretKey, "sk_live_abc123456789");
    }
  );
});

test("clé propre : aucun avertissement", () => {
  withKeys(
    { STRIPE_SECRET_KEY: "  sk_live_abc123456789\n", STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789" },
    () => {
      assert.equal(stripeKeyNotice(), null);
    }
  );
});

test("mode test et mode live mélangés : détecté", () => {
  withKeys(
    { STRIPE_SECRET_KEY: "sk_test_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789" },
    () => {
      assert.equal(stripeKeyProblem(), "key_mode_mismatch");
      assert.equal(stripeConfiguration(), null);
    }
  );
});

test("paire de clés cohérente : configuration acceptée", () => {
  withKeys(
    { STRIPE_SECRET_KEY: "sk_live_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789" },
    () => {
      assert.equal(stripeKeyProblem(), null);
      assert.equal(stripeConfiguration().currency, "eur");
    }
  );
});

test("clé restreinte (rk_) acceptée comme clé secrète", () => {
  withKeys(
    { STRIPE_SECRET_KEY: "rk_live_abc123456789", STRIPE_PUBLISHABLE_KEY: "pk_live_abc123456789" },
    () => {
      assert.equal(stripeKeyProblem(), null);
    }
  );
});

test("diagnostic : repère une clé secrète tronquée", () => {
  const account = "51UE4C2RsIRc7hIlD";
  const secret = `sk_live_${account}${"x".repeat(20)}`;
  const publishable = `pk_live_${account}${"y".repeat(83)}`;
  withKeys({ STRIPE_SECRET_KEY: secret, STRIPE_PUBLISHABLE_KEY: publishable }, () => {
    const diagnostics = stripeKeyDiagnostics();
    assert.equal(diagnostics.secretConfigured, true);
    assert.equal(diagnostics.publishableConfigured, true);
    assert.equal(diagnostics.secretLooksComplete, false);
    assert.equal(diagnostics.accountMatches, true);
  });
});

test("le diagnostic public ne décrit jamais la clé secrète", () => {
  // Ce résultat part dans GET /api/config, donc vers n'importe qui. Il annonçait
  // la longueur exacte de la clé secrète et son préfixe : de quoi confirmer à un
  // inconnu le mode et le format configurés. Plus un seul chiffre ne doit
  // sortir — les booléens suffisent à répondre à « la clé est-elle utilisable ? ».
  const account = "51UE4C2RsIRc7hIlD";
  withKeys(
    { STRIPE_SECRET_KEY: `sk_live_${account}${"x".repeat(85)}`, STRIPE_PUBLISHABLE_KEY: `pk_live_${account}${"y".repeat(83)}` },
    () => {
      const serialise = JSON.stringify(stripeKeyDiagnostics());
      assert.doesNotMatch(serialise, /sk_live|pk_live/);
      assert.doesNotMatch(serialise, /secretLength|secretPrefix|publishableLength/);
      assert.doesNotMatch(serialise, /\d/, "une longueur ou un identifiant s'est glissé dans le diagnostic");
    }
  );
});

test("diagnostic : repère deux clés de comptes différents", () => {
  withKeys(
    {
      STRIPE_SECRET_KEY: "sk_live_AAAAAAAAAAAAAAAA" + "x".repeat(85),
      STRIPE_PUBLISHABLE_KEY: "pk_live_BBBBBBBBBBBBBBBB" + "y".repeat(83)
    },
    () => {
      const diagnostics = stripeKeyDiagnostics();
      assert.equal(diagnostics.secretLooksComplete, true);
      assert.equal(diagnostics.accountMatches, false);
    }
  );
});

test("diagnostic : repère deux clés de comptes différents", () => {
  withKeys(
    {
      STRIPE_SECRET_KEY: "sk_live_AAAAAAAAAAAAAAAA" + "x".repeat(85),
      STRIPE_PUBLISHABLE_KEY: "pk_live_BBBBBBBBBBBBBBBB" + "y".repeat(83)
    },
    () => {
      const diagnostics = stripeKeyDiagnostics();
      assert.equal(diagnostics.secretLooksComplete, true);
      assert.equal(diagnostics.accountMatches, false);
    }
  );
});
