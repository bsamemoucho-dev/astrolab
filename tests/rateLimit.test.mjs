// Contrats du limiteur de débit partagé.
//
// Ces propriétés sont celles sur lesquelles reposent les quatre points d'entrée
// non authentifiés (inscription, connexion, récupération, géocodage) : compter
// sans prolonger un refus, oublier les coups sortis de la fenêtre, et ne pas
// laisser un client choisir sa propre clé.

import assert from "node:assert/strict";
import test from "node:test";

import { clientAddress, createRateLimiter, isLoopbackAddress, maskClientAddress, retryAfterSeconds } from "../src/http/rateLimit.mjs";

test("la limitation compte les coups dans la fenêtre, puis oublie", () => {
  let instant = 1_000_000;
  const limiteur = createRateLimiter({ windowMs: 1000, max: 2, now: () => instant });

  assert.equal(limiteur.check("client").limited, false);
  limiteur.hit("client");
  assert.equal(limiteur.check("client").limited, false);
  limiteur.hit("client");
  assert.equal(limiteur.check("client").limited, true);

  // La fenêtre glisse : les coups sortis ne comptent plus.
  instant += 1001;
  assert.equal(limiteur.check("client").limited, false);
});

test("consulter ne consomme pas de coup : un refus ne prolonge pas le refus", () => {
  // Sinon un client qui insiste sans jamais réussir repousserait indéfiniment sa
  // propre sortie de limitation, et se bloquerait pour de bon.
  let instant = 1_000_000;
  const limiteur = createRateLimiter({ windowMs: 1000, max: 1, now: () => instant });
  limiteur.hit("client");
  for (let essai = 0; essai < 5; essai += 1) {
    assert.equal(limiteur.check("client").limited, true);
  }
  instant += 1001;
  assert.equal(limiteur.check("client").limited, false);
});

test("les clés sont indépendantes", () => {
  const limiteur = createRateLimiter({ windowMs: 1000, max: 1 });
  limiteur.hit("a");
  assert.equal(limiteur.check("a").limited, true);
  assert.equal(limiteur.check("b").limited, false);
});

test("le délai annoncé décroît puis retombe à zéro", () => {
  let instant = 1_000_000;
  const limiteur = createRateLimiter({ windowMs: 60_000, max: 1, now: () => instant });
  limiteur.hit("client");
  assert.equal(limiteur.check("client").retryAfterMs, 60_000);
  instant += 45_000;
  assert.equal(limiteur.check("client").retryAfterMs, 15_000);
  instant += 15_000;
  assert.equal(limiteur.check("client").limited, false);
  assert.equal(limiteur.check("client").retryAfterMs, 0);
});

test("la table ne grandit pas sans fin, même avec une clé par requête", () => {
  // Un attaquant qui invente une clé à chaque appel ne doit pas pouvoir faire
  // grossir la table indéfiniment.
  const limiteur = createRateLimiter({ windowMs: 60_000, max: 5, maxKeys: 10 });
  for (let index = 0; index < 100; index += 1) {
    limiteur.hit(`client-${index}`);
  }
  // Les dix plus récentes sont encore là, les anciennes ont été oubliées.
  assert.equal(limiteur.check("client-99").limited, false);
  assert.equal(limiteur.check("client-0").limited, false);
});

test("reset efface une clé, ou tout", () => {
  const limiteur = createRateLimiter({ windowMs: 1000, max: 1 });
  limiteur.hit("a");
  limiteur.hit("b");
  limiteur.reset("a");
  assert.equal(limiteur.check("a").limited, false);
  assert.equal(limiteur.check("b").limited, true);
  limiteur.reset();
  assert.equal(limiteur.check("b").limited, false);
});

test("une fenêtre ou un plafond absurde est refusé à la construction", () => {
  assert.throws(() => createRateLimiter({ windowMs: 0, max: 1 }), TypeError);
  assert.throws(() => createRateLimiter({ windowMs: 1000, max: 0 }), TypeError);
});

test("retryAfterSeconds arrondit au supérieur et ne descend jamais sous une seconde", () => {
  assert.equal(retryAfterSeconds(0), "1");
  assert.equal(retryAfterSeconds(1), "1");
  assert.equal(retryAfterSeconds(1001), "2");
  assert.equal(retryAfterSeconds(60_000), "60");
});

test("clientAddress prend la dernière entrée transmise, pas celle du client", () => {
  // Un client peut envoyer son propre X-Forwarded-For : le proxy ajoute la vraie
  // adresse à la suite. Prendre la première laisserait choisir sa clé de
  // limitation, donc contourner la limite.
  const req = { headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9" }, socket: { remoteAddress: "10.0.0.1" } };
  assert.equal(clientAddress(req), "203.0.113.9");
});

test("clientAddress retombe sur la socket quand rien n'est transmis", () => {
  assert.equal(clientAddress({ headers: {}, socket: { remoteAddress: "127.0.0.1" } }), "127.0.0.1");
  assert.equal(clientAddress({ headers: {} }), "inconnu");
});

test("l'adresse journalisée est réduite à son préfixe réseau", () => {
  // Un journal doit permettre de repérer « un poste insiste » sans conserver
  // l'adresse complète d'un client, qui est une donnée personnelle.
  assert.equal(maskClientAddress("203.0.113.9"), "203.0.113.x");
  assert.equal(maskClientAddress("::ffff:198.51.100.7"), "198.51.100.x");
  assert.equal(maskClientAddress("2001:db8:1234:5678::1"), "2001:db8:1234::");
  assert.equal(maskClientAddress("::1"), "adresse locale");
  assert.equal(maskClientAddress(""), "adresse inconnue");
  assert.equal(maskClientAddress(undefined), "adresse inconnue");
});

test("seule la machine elle-même est reconnue comme locale", () => {
  assert.equal(isLoopbackAddress("127.0.0.1"), true);
  assert.equal(isLoopbackAddress("127.1.2.3"), true);
  assert.equal(isLoopbackAddress("::1"), true);
  assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLoopbackAddress("localhost"), true);
  assert.equal(isLoopbackAddress("203.0.113.9"), false);
  assert.equal(isLoopbackAddress("10.0.0.1"), false);
  assert.equal(isLoopbackAddress(""), false);
});
