import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { createPaidDelivery, markDeliveryReady } from "../src/models/publicDeliveryService.mjs";

const run = promisify(execFile);
const TOOL = join(process.cwd(), "tools/delivery-email.mjs");

test("le renvoi manuel exige un readingId confirmé et ne traite qu'une lecture", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lastro-delivery-email-tool-"));
  const dbPath = join(dir, "state.json");
  const store = new JsonStore(dbPath);
  const first = await createPaidDelivery(store, { paymentSessionId: "cs_manual_1", email: "client@example.com" });
  const second = await createPaidDelivery(store, { paymentSessionId: "cs_manual_2", email: "autre@example.com" });
  await markDeliveryReady(store, first.delivery.id, { html: "<p>ok</p>", markdown: "ok" });
  await markDeliveryReady(store, second.delivery.id, { html: "<p>ok</p>", markdown: "ok" });

  await assert.rejects(
    () =>
      run(process.execPath, [
        TOOL,
        "resend",
        "--db",
        dbPath,
        "--base-url",
        "https://www.lastro.fr",
        "--reading-id",
        first.delivery.id,
        "--confirm",
        second.delivery.id
      ]),
    /--confirm doit être exactement égal/
  );
  assert.equal((await store.load()).outbox.length, 0);

  const { stdout } = await run(process.execPath, [
    TOOL,
    "resend",
    "--db",
    dbPath,
    "--base-url",
    "https://www.lastro.fr",
    "--reading-id",
    first.delivery.id,
    "--confirm",
    first.delivery.id
  ]);
  assert.match(stdout, /"queued": true/);

  const state = await new JsonStore(dbPath).load();
  assert.equal(state.outbox.length, 1);
  assert.equal(state.outbox[0].deliveryId, first.delivery.id);
  assert.equal(state.outbox[0].to, "client@example.com");
  assert.match(state.outbox[0].purpose, /^manual:/);
});
