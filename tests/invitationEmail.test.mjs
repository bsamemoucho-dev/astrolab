import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { buildInvitationEmail } from "../src/notifications/invitationEmail.mjs";
import { detectStaleSendingEmails, flushQueuedEmails, sendEmail } from "../src/notifications/mailer.mjs";
import { createEmailInvitation, listAdminEmailInvitations } from "../src/models/emailInvitationService.mjs";
import { JsonStore, createEmptyState } from "../src/db/jsonStore.mjs";
import { hashAccessCode } from "../src/models/accessCodeService.mjs";

const URL = `https://www.lastro.fr/#invitation=${"A".repeat(43)}`;
const ADMIN = { id: "owner", primaryRole: "admin" };
const EMAIL = "recipient@example.invalid";
const KEYS = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME", "BREVO_REPLY_TO"];
async function withEmailEnvironment(run) {
  const saved = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, { BREVO_API_KEY: "fake-test-key", BREVO_SENDER_EMAIL: "contact@lastro.fr" });
  try { return await run(); }
  finally { for (const key of KEYS) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
}
async function fixture() {
  const state = createEmptyState(); state.users.push(ADMIN);
  state.accessCodes.push({ id: "grant", hash: hashAccessCode("ABCD2345EFGH"), codeLength: 12, usageLimit: 1, usedAt: null, revokedAt: null, expiresAt: null });
  const store = new JsonStore(null, state);
  await createEmailInvitation(store, ADMIN, { email: EMAIL, kind: "free", requestId: randomUUID() }, { baseUrl: "https://www.lastro.fr" });
  return store;
}

for (const language of ["fr", "en", "de", "es", "it", "pt", "no", "da", "nl"]) {
  for (const kind of ["free", "discount10"]) {
    test(`real PNG QR decodes to the exact fragment link: ${language}/${kind}`, async () => {
      const email = await buildInvitationEmail({ kind, language, url: URL });
      assert.equal(email.attachments.length, 1); assert.equal(email.attachments[0].name, "invitation-lastro.png");
      const png = PNG.sync.read(Buffer.from(email.attachments[0].content, "base64"));
      const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: "dontInvert" });
      assert.equal(png.width, 512); assert.equal(png.height, 512); assert.equal(decoded?.data, URL);
      assert.ok(email.text.includes(URL)); assert.ok(email.html.includes(`href="${URL}"`));
      assert.ok(!email.html.includes("<script"));
      if (kind === "discount10") assert.match(email.text, /18.*10.*8/s);
    });
  }
}

test("QR rendering uses no external network or QR provider", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("network forbidden"); };
  try { await buildInvitationEmail({ kind: "free", url: URL }); assert.equal(calls, 0); }
  finally { globalThis.fetch = original; }
});

test("QR mail refuses injected, external, insecure, query or malformed URLs", async () => {
  for (const url of ["https://evil.example/#invitation=" + "A".repeat(43), "http://www.lastro.fr/#invitation=" + "A".repeat(43),
    "https://www.lastro.fr/?invitation=" + "A".repeat(43), "https://www.lastro.fr/path#invitation=" + "A".repeat(43),
    "https://www.lastro.fr/#invitation=short", "javascript:alert(1)", "https://user:pw@www.lastro.fr/#invitation=" + "A".repeat(43)]) {
    await assert.rejects(() => buildInvitationEmail({ kind: "free", url }));
  }
});

test("Brevo receives the local PNG attachment and an invitation-specific idempotency header", async () => {
  await withEmailEnvironment(async () => {
    const email = await buildInvitationEmail({ kind: "free", url: URL });
    const original = globalThis.fetch; let captured;
    globalThis.fetch = async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return { ok: true, status: 201, json: async () => ({ messageId: "provider-accepted" }) };
    };
    try {
      const key = `lastro-invitation-inv_${randomUUID()}`;
      const result = await sendEmail({ to: EMAIL, ...email, idempotencyKey: key });
      assert.equal(result.providerMessageId, "provider-accepted");
      assert.equal(captured.url, "https://api.brevo.com/v3/smtp/email");
      assert.equal(captured.body.headers.IdempotencyKey, key);
      assert.deepEqual(captured.body.attachment, email.attachments);
      assert.ok(captured.body.htmlContent.includes(URL)); assert.equal(captured.body.to[0].email, EMAIL);
      assert.equal(captured.options.headers.IdempotencyKey, undefined, "idempotency belongs in the Brevo JSON custom headers");
    } finally { globalThis.fetch = original; }
  });
});

test("concurrent invitation flushes send once and erase the accepted queued bearer link", async () => {
  await withEmailEnvironment(async () => {
    const store = await fixture(); const state = await store.load();
    const token = state.outbox[0].body.match(/#invitation=([A-Za-z0-9_-]{43})/)[1];
    let sends = 0;
    const send = async payload => { sends++; assert.ok(payload.attachments[0].content); return { providerMessageId: "accepted" }; };
    const results = await Promise.all([flushQueuedEmails(store, { types: ["reading_invitation"], send }),
      flushQueuedEmails(store, { types: ["reading_invitation"], send })]);
    assert.equal(sends, 1); assert.equal(results.reduce((sum, row) => sum + row.sent, 0), 1);
    assert.equal(state.outbox[0].status, "sent"); assert.equal(state.outbox[0].providerMessageId, "accepted");
    assert.equal(state.outbox[0].body, null); assert.equal(state.outbox[0].html, null); assert.equal(state.outbox[0].attachments, null);
    assert.ok(!JSON.stringify(state).includes(token));
    assert.equal(state.emailInvitations[0].usedAt, null); assert.equal(state.accessCodes[0].usedAt, null);
    const view = await listAdminEmailInvitations(store, ADMIN);
    assert.equal(view.invitations[0].mail.status, "sent"); assert.ok(view.invitations[0].mail.acceptedAt);
    assert.equal(view.invitations[0].mail.delivered, undefined);
  });
});

test("an ambiguous invitation send is marked unknown, never automatically resent or logged with secrets", async () => {
  await withEmailEnvironment(async () => {
    const store = await fixture(); const state = await store.load();
    const token = state.outbox[0].body.match(/#invitation=([A-Za-z0-9_-]{43})/)[1];
    const warnings = []; const warn = console.warn; let sends = 0;
    console.warn = value => warnings.push(value);
    const send = async () => { sends++; throw new Error(`untrusted provider body ${EMAIL} ${token}`); };
    try {
      const first = await flushQueuedEmails(store, { types: ["reading_invitation"], send });
      const second = await flushQueuedEmails(store, { types: ["reading_invitation"], send });
      assert.equal(first.failed, 1); assert.equal(second.failed, 0); assert.equal(sends, 1);
      const mail = (await store.load()).outbox[0];
      assert.equal(mail.status, "failed"); assert.equal(mail.manualReviewRequired, true); assert.equal(mail.nextAttemptAt, null);
      assert.equal(mail.failureKind, "provider_acceptance_unknown");
      assert.ok(!mail.error.includes(EMAIL)); assert.ok(!mail.error.includes(token));
      assert.ok(!JSON.stringify(warnings).includes(EMAIL)); assert.ok(!JSON.stringify(warnings).includes(token));
      assert.equal((await listAdminEmailInvitations(store, ADMIN)).invitations[0].mail.status, "unknown");
    } finally { console.warn = warn; }
  });
});

test("a definite provider rejection is recorded separately from uncertain acceptance", async () => {
  await withEmailEnvironment(async () => {
    const store = await fixture(); const original = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ message: EMAIL + " " + URL }) });
    const warn = console.warn; console.warn = () => {};
    try {
      await flushQueuedEmails(store, { types: ["reading_invitation"] });
      const mail = (await store.load()).outbox[0];
      assert.equal(mail.failureKind, "provider_rejected"); assert.equal(mail.manualReviewRequired, false);
      assert.equal(mail.status, "failed"); assert.ok(!mail.error.includes(EMAIL));
    } finally { globalThis.fetch = original; console.warn = warn; }
  });
});

test("crashed invitation sends require manual review rather than replaying on server restart", async () => {
  const store = await fixture(); const state = await store.load();
  state.outbox[0].status = "sending"; state.outbox[0].sendingStartedAt = new Date(Date.now() - 6000000).toISOString();
  state.outbox[0].attempts = 1;
  const stale = await detectStaleSendingEmails(store, { types: ["reading_invitation"] });
  assert.equal(stale.length, 1); assert.equal(stale[0].status, "failed"); assert.equal(stale[0].manualReviewRequired, true);
  assert.equal(state.emailInvitations[0].usedAt, null);
});

test("ordinary transactional messages keep the old payload without invitation headers or attachments", async () => {
  await withEmailEnvironment(async () => {
    const original = globalThis.fetch; let body;
    globalThis.fetch = async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ messageId: "legacy" }) }; };
    try {
      const result = await sendEmail({ to: EMAIL, subject: "A reading", text: "Existing flow" });
      assert.equal(result.delivered, true); assert.equal(body.attachment, undefined); assert.equal(body.headers, undefined);
    } finally { globalThis.fetch = original; }
  });
});
