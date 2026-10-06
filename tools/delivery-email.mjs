#!/usr/bin/env node

import { join } from "node:path";

import { JsonStore } from "../src/db/jsonStore.mjs";
import {
  adminAlertEmailContent,
  deliveryFailureEmail,
  deliveryLink,
  deliveryReadyEmail,
  getDeliveryById,
  queueDeliveryEmail
} from "../src/models/publicDeliveryService.mjs";
import { flushQueuedEmails, sendEmail } from "../src/notifications/mailer.mjs";

function usage() {
  console.log(`Usage:
  node tools/delivery-email.mjs resend --reading-id <id> --confirm <id> [--db <path>] [--base-url <url>]
  node tools/delivery-email.mjs test --kind ready|failure|admin --to <email> [--base-url <url>] [--token <token>]

Variables requises pour l'envoi réel :
  BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME optionnel, BREVO_REPLY_TO optionnel.

Le renvoi manuel exige un readingId explicite et ne traite jamais plusieurs lectures.`);
}

function args(argv) {
  const out = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      out._.push(item);
      continue;
    }
    const key = item.slice(2);
    out[key] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
  }
  return out;
}

function required(value, name) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${name} requis.`);
  }
  return text;
}

async function resend(parsed) {
  const readingId = required(parsed["reading-id"], "--reading-id");
  const confirm = required(parsed.confirm, "--confirm");
  if (confirm !== readingId) {
    throw new Error("--confirm doit être exactement égal au readingId.");
  }
  const dbPath = parsed.db ? String(parsed.db) : join(process.cwd(), "data/astrolab.json");
  const baseUrl = String(parsed["base-url"] ?? process.env.PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/]+/i.test(baseUrl)) {
    throw new Error("--base-url ou PUBLIC_BASE_URL doit être une URL absolue.");
  }
  const store = new JsonStore(dbPath);
  const delivery = await getDeliveryById(store, readingId);
  if (!delivery) {
    throw new Error(`Lecture inconnue : ${readingId}`);
  }
  if (delivery.status !== "ready") {
    throw new Error(`La lecture ${delivery.reference} n'est pas prête (${delivery.status}).`);
  }
  if (!delivery.email) {
    throw new Error(`La lecture ${delivery.reference} n'a pas d'adresse e-mail de livraison.`);
  }
  const link = deliveryLink(delivery.token, baseUrl);
  await queueDeliveryEmail(store, delivery, { link, purpose: `manual:${Date.now()}` });
  const result = await flushQueuedEmails(store, { types: ["public_reading_link"] });
  console.log(JSON.stringify({ queued: true, reference: delivery.reference, sent: result.sent, failed: result.failed }, null, 2));
}

async function testEmail(parsed) {
  const kind = required(parsed.kind, "--kind");
  const to = required(parsed.to, "--to");
  const baseUrl = String(parsed["base-url"] ?? process.env.PUBLIC_BASE_URL ?? "https://www.lastro.fr").trim().replace(/\/+$/, "");
  const token = String(parsed.token ?? "TEST-EMAIL-LINK-NOT-A-REAL-READING").trim();
  let template;
  if (kind === "ready") {
    template = deliveryReadyEmail({ link: deliveryLink(token, baseUrl), reference: "TEST-EMAIL" });
  } else if (kind === "failure") {
    template = deliveryFailureEmail();
  } else if (kind === "admin") {
    template = adminAlertEmailContent({
      delivery: { id: "reading_test", reference: "TEST-EMAIL", email: to, status: "ready" },
      failureType: "test_admin_alert",
      status: "test",
      attempts: 0,
      error: "Test d'alerte admin sans lecture client réelle.",
      link: deliveryLink(token, baseUrl)
    });
  } else {
    throw new Error("--kind doit valoir ready, failure ou admin.");
  }
  const result = await sendEmail({ to, subject: template.subject, text: template.body, html: template.html });
  console.log(JSON.stringify({ sent: true, kind, to, providerMessageId: result.providerMessageId ?? null }, null, 2));
}

try {
  const parsed = args(process.argv.slice(2));
  const command = parsed._[0];
  if (command === "resend") {
    await resend(parsed);
  } else if (command === "test") {
    await testEmail(parsed);
  } else {
    usage();
    process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
