import { OUTBOX_STALE_SENDING_MS, flushQueuedEmails } from "../notifications/mailer.mjs";
import { normalizeEmail } from "../auth/security.mjs";
import { deliveryLink, queueDeliveryEmail } from "./publicDeliveryService.mjs";

function requireAdmin(user) {
  if (user.primaryRole !== "admin") {
    const error = new Error("Admin access required");
    error.status = 403;
    throw error;
  }
}

function nowTime(now = Date.now()) {
  return Number.isFinite(Number(now)) ? Number(now) : Date.now();
}

function publicUserSummary(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
    primaryRole: user.primaryRole
  };
}

function redactAudit(entry) {
  return {
    id: entry.id,
    actorUserId: entry.actorUserId,
    ownerUserId: entry.ownerUserId,
    action: entry.action,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId,
    createdAt: entry.createdAt
  };
}

export async function bootstrapAdminFromEnv(store, { env = process.env, log = console.log } = {}) {
  const email = normalizeEmail(env.ADMIN_BOOTSTRAP_EMAIL);
  if (!email) {
    return { applied: false, reason: "not_configured" };
  }

  return store.transact((state) => {
    const matches = state.users.filter((user) => normalizeEmail(user.email) === email && !user.deletedAt);
    if (matches.length !== 1) {
      return { applied: false, reason: "user_not_found_or_ambiguous" };
    }

    const user = matches[0];
    if (!user.emailVerifiedAt) {
      return { applied: false, reason: "email_not_verified" };
    }
    if (user.primaryRole === "admin") {
      return { applied: false, reason: "already_admin" };
    }

    user.primaryRole = "admin";
    log(`Admin bootstrap applied: ${email}`);
    return { applied: true, email };
  });
}

export async function getAdminSummary(store, user) {
  requireAdmin(user);
  const state = await store.load();
  return {
    counts: {
      users: state.users.filter((entry) => !entry.deletedAt).length,
      deletedUsers: state.users.filter((entry) => entry.deletedAt).length,
      persons: state.persons.length,
      analyses: state.analyses.length,
      reports: state.reports.length,
      orders: state.orders.length,
      auditLogs: state.auditLogs.length
    },
    users: state.users.map(publicUserSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}

export async function listAdminAuditLogs(store, user, input = {}) {
  requireAdmin(user);
  const state = await store.load();
  const limit = Math.min(Math.max(Number(input.limit ?? 50), 1), 200);
  const action = input.action ? String(input.action) : null;
  const ownerUserId = input.ownerUserId ? String(input.ownerUserId) : null;

  let auditLogs = state.auditLogs;
  if (action) {
    auditLogs = auditLogs.filter((entry) => entry.action === action);
  }
  if (ownerUserId) {
    auditLogs = auditLogs.filter((entry) => entry.ownerUserId === ownerUserId);
  }

  return {
    auditLogs: auditLogs
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(redactAudit)
  };
}

function normalizeQuery(value) {
  return String(value ?? "").trim().toLowerCase();
}

function latestMail(outbox, deliveryId, type) {
  return outbox
    .filter((mail) => mail.deliveryId === deliveryId && mail.type === type)
    .toSorted((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
    .at(0) ?? null;
}

function emailStatus(mail, now = Date.now()) {
  if (!mail) {
    return { status: "unknown", manualReviewRequired: false };
  }
  const started = mail.sendingStartedAt ? new Date(mail.sendingStartedAt).getTime() : 0;
  const staleSending = mail.status === "sending" && started && nowTime(now) - started >= OUTBOX_STALE_SENDING_MS;
  if (staleSending || mail.failureKind === "sending_stale" || mail.manualReviewRequired) {
    return { status: "sending_stale", manualReviewRequired: true };
  }
  return {
    status: mail.status ?? "pending",
    manualReviewRequired: Boolean(mail.manualReviewRequired)
  };
}

function readingSource(delivery) {
  if (delivery.accessCodeId) {
    return "Code d’accès";
  }
  if (delivery.freeAccess || delivery.sharedFreeAccessQuota) {
    return "Code de test";
  }
  if (delivery.paymentSessionId) {
    return "Paiement";
  }
  return "—";
}

function summarizeError(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 180) || null;
}

function mailDetails(mail) {
  if (!mail) {
    return null;
  }
  return {
    id: mail.id,
    type: mail.type,
    status: emailStatus(mail).status,
    attempts: Number(mail.attempts ?? 0),
    createdAt: mail.createdAt ?? null,
    sendingStartedAt: mail.sendingStartedAt ?? null,
    failedAt: mail.failedAt ?? null,
    nextAttemptAt: mail.nextAttemptAt ?? null,
    sentAt: mail.sentAt ?? null,
    providerMessageId: mail.providerMessageId ?? null,
    error: summarizeError(mail.error)
  };
}

function publicAdminReading(delivery, outbox, baseUrl, now = Date.now()) {
  const readyMail = latestMail(outbox, delivery.id, "public_reading_link");
  const failureMail = latestMail(outbox, delivery.id, "public_reading_failure");
  const adminAlert = outbox
    .filter((mail) => mail.deliveryId === delivery.id && mail.type === "admin_alert")
    .toSorted((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
    .at(0) ?? null;
  const readyEmail = emailStatus(readyMail, now);
  const failureEmail = emailStatus(failureMail, now);
  const adminAlertEmail = emailStatus(adminAlert, now);
  const link = delivery.status === "ready" && delivery.token ? deliveryLink(delivery.token, baseUrl) : null;
  const emailActionRequired = readyEmail.manualReviewRequired || readyEmail.status === "failed";
  const generationActionRequired = delivery.status === "failed";
  return {
    id: delivery.id,
    reference: delivery.reference,
    clientEmail: delivery.email ?? null,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
    failedAt: delivery.status === "failed" ? delivery.generation?.finishedAt ?? delivery.updatedAt ?? null : null,
    readingStatus: delivery.status,
    emailStatus: readyEmail.status,
    emailActionRequired,
    actionRequired: emailActionRequired || generationActionRequired,
    source: readingSource(delivery),
    link,
    canView: Boolean(link),
    canResendEmail: delivery.status === "ready" && Boolean(delivery.email) && ["failed", "sent", "sending_stale"].includes(readyEmail.status),
    resendWarning:
      readyEmail.status === "sent"
        ? "Cet e-mail est déjà marqué comme envoyé. Le renvoyer peut créer un doublon."
        : readyEmail.status === "sending_stale"
          ? "L’état fournisseur est incertain. Un doublon est possible."
          : null,
    failure: delivery.status === "failed"
      ? {
          message: "Action requise",
          error: summarizeError(delivery.error),
          errorCode: delivery.errorCode ?? null,
          clientFailureEmail: failureEmail.status,
          adminAlertEmail: adminAlertEmail.status
        }
      : null,
    details: {
      readingId: delivery.id,
      reference: delivery.reference,
      clientEmail: delivery.email ?? null,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
      readingStatus: delivery.status,
      emailStatus: readyEmail.status,
      attempts: Number(readyMail?.attempts ?? 0),
      lastAttemptAt: readyMail?.sendingStartedAt ?? readyMail?.failedAt ?? readyMail?.sentAt ?? null,
      sentAt: readyMail?.sentAt ?? null,
      providerMessageId: readyMail?.providerMessageId ?? null,
      source: readingSource(delivery),
      link,
      lastError: summarizeError(readyMail?.error ?? delivery.error),
      readyEmail: mailDetails(readyMail),
      clientFailureEmail: mailDetails(failureMail),
      adminAlertEmail: mailDetails(adminAlert)
    }
  };
}

function matchesFilter(reading, filter) {
  if (filter === "active") {
    return reading.readingStatus === "queued" || reading.readingStatus === "generating";
  }
  if (filter === "ready") {
    return reading.readingStatus === "ready";
  }
  if (filter === "failed") {
    return reading.readingStatus === "failed";
  }
  if (filter === "email_action") {
    return reading.emailActionRequired;
  }
  return true;
}

export async function listAdminReadings(store, user, input = {}, { baseUrl, now = Date.now() } = {}) {
  requireAdmin(user);
  const state = await store.load();
  const query = normalizeQuery(input.q);
  const filter = String(input.filter ?? "all");
  const readings = (state.publicReadings ?? [])
    .toSorted((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
    .map((delivery) => publicAdminReading(delivery, state.outbox ?? [], baseUrl, now))
    .filter((reading) => {
      if (!query) {
        return true;
      }
      return [reading.clientEmail, reading.reference, reading.id].some((value) => normalizeQuery(value).includes(query));
    })
    .filter((reading) => matchesFilter(reading, filter))
    .slice(0, 200);

  const all = (state.publicReadings ?? []).map((delivery) => publicAdminReading(delivery, state.outbox ?? [], baseUrl, now));
  return {
    maxResults: 200,
    counts: {
      active: all.filter((reading) => reading.readingStatus === "queued" || reading.readingStatus === "generating").length,
      ready: all.filter((reading) => reading.readingStatus === "ready").length,
      failed: all.filter((reading) => reading.readingStatus === "failed").length,
      emailAction: all.filter((reading) => reading.emailActionRequired).length
    },
    readings
  };
}

export async function resendAdminReadingEmail(store, user, input = {}, { baseUrl } = {}) {
  requireAdmin(user);
  const readingId = String(input.readingId ?? "").trim();
  const confirm = String(input.confirm ?? "").trim();
  if (!readingId || confirm !== readingId) {
    const error = new Error("readingId et confirmation explicite requis.");
    error.status = 400;
    throw error;
  }
  const delivery = (await store.load()).publicReadings.find((entry) => entry.id === readingId) ?? null;
  if (!delivery) {
    const error = new Error("Lecture inconnue.");
    error.status = 404;
    throw error;
  }
  if (delivery.status !== "ready") {
    const error = new Error("Seule une lecture prête peut être renvoyée.");
    error.status = 409;
    throw error;
  }
  if (!delivery.email) {
    const error = new Error("Cette lecture n'a pas d'adresse e-mail de livraison.");
    error.status = 409;
    throw error;
  }
  const link = deliveryLink(delivery.token, baseUrl);
  await queueDeliveryEmail(store, delivery, { link, purpose: `admin_resend:${Date.now()}` });
  const result = await flushQueuedEmails(store, { types: ["public_reading_link"] });
  return {
    queued: true,
    readingId,
    reference: delivery.reference,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped
  };
}
