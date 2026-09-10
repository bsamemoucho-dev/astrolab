import assert from "node:assert/strict";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import {
  createPaidDelivery,
  deleteDeliveryByToken,
  deliveryLink,
  findDeliveryByReference,
  getDeliveryByToken,
  markDeliveryFailed,
  markDeliveryGenerating,
  markDeliveryReady,
  maskEmail,
  publicDelivery,
  purgeExpiredDeliveries,
  queueDeliveryEmail,
  RETENTION_DAYS
} from "../src/models/publicDeliveryService.mjs";

function freshStore() {
  return new JsonStore(null);
}

const READING = {
  html: "<html>lecture</html>",
  markdown: "# Lecture",
  writerMode: "llm",
  language: "fr",
  aiReview: { passes: 3, humanReviewed: false },
  verification: { status: "checked", provider: "gemini", correctedCount: 1, rejectedCount: 0, issues: [] },
  sections: [{ id: "socle", text: "détail inutile à la livraison" }]
};

test("une commande payée est créée avec un lien secret et une référence lisible", async () => {
  const store = freshStore();
  const { created, delivery } = await createPaidDelivery(store, {
    paymentSessionId: "cs_live_1",
    email: "Client@Example.com ",
    amountCents: 2000,
    currency: "eur",
    language: "fr",
    input: { birthDate: "1973-03-02" }
  });

  assert.equal(created, true);
  assert.equal(delivery.status, "paid");
  assert.match(delivery.token, /^[A-HJ-NP-Z2-9]{32}$/);
  assert.match(delivery.reference, /^L-\d{4}-[A-HJ-NP-Z2-9]{6}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(delivery.email, "client@example.com");
  assert.equal(delivery.reading, null);
  assert.equal(delivery.expiresAt > delivery.createdAt, true);
});

test("deux appels pour le même paiement ne créent qu'une commande", async () => {
  const store = freshStore();
  const first = await createPaidDelivery(store, { paymentSessionId: "cs_live_same", amountCents: 1000 });
  const second = await createPaidDelivery(store, { paymentSessionId: "cs_live_same", amountCents: 1000 });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.delivery.id, first.delivery.id);
  const state = await store.load();
  assert.equal(state.publicReadings.length, 1);
});

test("la rédaction fait passer la commande de payée à prête", async () => {
  const store = freshStore();
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_live_2", email: "a@b.fr" });
  await markDeliveryGenerating(store, delivery.id);
  const ready = await markDeliveryReady(store, delivery.id, READING);

  assert.equal(ready.status, "ready");
  assert.equal(ready.reading.html, "<html>lecture</html>");
  assert.equal(ready.reading.verification.correctedCount, 1);
  // Les sections détaillées ne sont pas dupliquées dans le stockage.
  assert.equal("sections" in ready.reading, false);

  const byToken = await getDeliveryByToken(store, delivery.token);
  assert.equal(byToken.status, "ready");
  assert.equal(byToken.reading.markdown, "# Lecture");
});

test("un échec de rédaction laisse la commande payée récupérable", async () => {
  const store = freshStore();
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_live_3" });
  await markDeliveryFailed(store, delivery.id, "Quota du fournisseur IA dépassé");

  const byToken = await getDeliveryByToken(store, delivery.token);
  assert.equal(byToken.status, "failed");
  assert.match(byToken.error, /Quota/);
  const view = publicDelivery(byToken);
  assert.equal(view.reading, null);
  assert.equal(view.status, "failed");
});

test("l'accès se fait par le lien secret ou par la référence, jamais sans", async () => {
  const store = freshStore();
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_live_4" });

  assert.equal(await getDeliveryByToken(store, "MAUVAISJETONMAUVAISJETONMAUVAIS34"), null);
  assert.equal(await getDeliveryByToken(store, ""), null);

  const byReference = await findDeliveryByReference(store, delivery.reference.toLowerCase());
  assert.equal(byReference.id, delivery.id);
  assert.equal(await findDeliveryByReference(store, "L-2026-AAAAAA-BBBB"), null);
});

test("le jeton n'est jamais exposé dans une vue publique", async () => {
  const store = freshStore();
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_live_5", email: "client@example.com" });
  await markDeliveryReady(store, delivery.id, READING);

  const view = publicDelivery(await getDeliveryByToken(store, delivery.token));
  assert.equal("token" in view, false);
  assert.equal("paymentSessionId" in view, false);
  assert.equal("input" in view, false);
  // L'e-mail est masqué : la page de récupération n'affiche pas l'adresse complète.
  assert.equal(view.email, "c***@example.com");
});

test("le client peut supprimer sa lecture", async () => {
  const store = freshStore();
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_live_6" });
  assert.equal(await deleteDeliveryByToken(store, delivery.token), true);
  assert.equal(await getDeliveryByToken(store, delivery.token), null);
  assert.equal(await deleteDeliveryByToken(store, delivery.token), false);
});

test("les lectures sont supprimées après la durée de conservation annoncée", async () => {
  const store = freshStore();
  const day = 24 * 60 * 60 * 1000;
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_live_7" }, Date.now());
  assert.equal(RETENTION_DAYS, 30);

  const removed = await purgeExpiredDeliveries(store, Date.now() + (RETENTION_DAYS - 1) * day);
  assert.equal(removed, 0);
  assert.notEqual(await getDeliveryByToken(store, delivery.token), null);

  const removedAfter = await purgeExpiredDeliveries(store, Date.now() + (RETENTION_DAYS + 1) * day);
  assert.equal(removedAfter, 1);
  assert.equal(await getDeliveryByToken(store, delivery.token), null);
});

test("le lien de récupération part dans la file d'envoi d'e-mails", async () => {
  const store = freshStore();
  const { delivery } = await createPaidDelivery(store, { paymentSessionId: "cs_live_8", email: "client@example.com" });
  await queueDeliveryEmail(store, delivery, { link: deliveryLink(delivery.token, "https://lastro.fr/") });

  const state = await store.load();
  const mail = state.outbox.at(-1);
  assert.equal(mail.type, "public_reading_link");
  assert.equal(mail.to, "client@example.com");
  assert.match(mail.link, /^https:\/\/lastro\.fr\/r\/[A-HJ-NP-Z2-9]{32}$/);
  assert.match(mail.body, new RegExp(delivery.reference));
});

test("le masquage d'e-mail reste lisible", () => {
  assert.equal(maskEmail("bassam@lastro.fr"), "b***@lastro.fr");
  assert.equal(maskEmail("a@b.fr"), "a*@b.fr");
  assert.equal(maskEmail("pas-un-email"), null);
});
