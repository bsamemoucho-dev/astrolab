// Read-only snapshot check. Never imports the server or a route that can claim a job.
import { OUTBOX_MAX_ATTEMPTS } from "../src/notifications/mailer.mjs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function notificationStatus(mail) {
  if (mail?.status !== undefined) return mail.status;
  if (!["public_reading_link", "public_reading_failure", "admin_alert"].includes(mail?.type)) return null;
  // Match the sender's reservation rules; do not infer delivery from attempts.
  if (mail.sentAt) return "historical_sent";
  if (Number(mail.attempts ?? 0) >= OUTBOX_MAX_ATTEMPTS) return "legacy_exhausted";
  return "pending";
}

export function deploymentSafetyReport(state) {
  const reasons = [];
  const readings = Array.isArray(state?.publicReadings) ? state.publicReadings : null;
  const outbox = Array.isArray(state?.outbox) ? state.outbox.filter((mail) => !(mail?.type === "email_verification" && mail.status === undefined)) : null;
  if (!readings || !outbox) reasons.push("INVALID_STORAGE_SCHEMA");
  const activeGenerations = (readings ?? []).filter((r) => ["queued", "generating"].includes(r?.status)).length;
  const pendingNotifications = (outbox ?? []).filter((r) => ["pending", "sending"].includes(notificationStatus(r))).length;
  const unknownReadingStatuses = (readings ?? []).filter((r) => !["queued", "generating", "ready", "failed"].includes(r?.status)).length;
  const unknownNotificationStatuses = (outbox ?? []).filter((r) => !["pending", "sending", "sent", "failed", "preview", "historical_sent", "legacy_exhausted"].includes(notificationStatus(r))).length;
  const legacyExhaustedNotifications = (outbox ?? []).filter((r) => notificationStatus(r) === "legacy_exhausted").length;
  if (unknownNotificationStatuses) reasons.push("UNKNOWN_NOTIFICATION_STATUS");
  if (activeGenerations) reasons.push("ACTIVE_GENERATIONS");
  if (pendingNotifications) reasons.push("PENDING_NOTIFICATIONS");
  if (unknownReadingStatuses) reasons.push("UNKNOWN_READING_STATUS");
  return { schema: "lastro.deployment_preflight@1.0.0", snapshotOnly: true,
    safeAtSnapshot: reasons.length === 0, reasons,
    counts: { readings: readings?.length ?? null, activeGenerations, pendingNotifications, unknownReadingStatuses, unknownNotificationStatuses, legacyExhaustedNotifications } };
}

export async function main(args, io = { log: console.log, error: console.error }) {
  if (args.length !== 2 || args[0] !== "--db" || !args[1]) {
    io.error("Usage: node tools/deploy-preflight.mjs --db /var/data/astrolab.json");
    return 1;
  }
  try {
    const bytes = await readFile(args[1]);
    const report = deploymentSafetyReport(JSON.parse(bytes));
    io.log(JSON.stringify({ ...report, checkedAt: new Date().toISOString(), snapshotHash: createHash("sha256").update(bytes).digest("hex") }));
    return report.safeAtSnapshot ? 0 : 2;
  } catch {
    io.error(JSON.stringify({ code: "DEPLOYMENT_PREFLIGHT_UNREADABLE" }));
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
