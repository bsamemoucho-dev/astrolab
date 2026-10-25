import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonStore, createEmptyState } from "../src/db/jsonStore.mjs";

async function temporaryStore(run) {
  const dir = await mkdtemp(join(tmpdir(), "lastro-store-init-"));
  try { await run(join(dir, "state.json")); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test("concurrent startup loads share the same state rather than replacing a claimed snapshot", async () => {
  await temporaryStore(async (file) => {
    const state = createEmptyState();
    state.publicReadings.push({ id: "fictional-reading", status: "queued" });
    await writeFile(file, JSON.stringify(state));
    const store = new JsonStore(file);
    const [recovery, outbox, request] = await Promise.all([store.load(), store.load(), store.load()]);
    assert.equal(recovery, outbox);
    assert.equal(request, recovery);
    await store.transact((loaded) => { loaded.publicReadings[0].status = "generating"; loaded.publicReadings[0].leaseId = "new-owner"; });
    assert.equal((await store.load()).publicReadings[0].leaseId, "new-owner");
    assert.equal(JSON.parse(await readFile(file, "utf8")).publicReadings[0].leaseId, "new-owner");
  });
});

test("concurrent first loads initialize an absent file once", async () => {
  await temporaryStore(async (file) => {
    class CountingStore extends JsonStore {
      writes = 0;
      async save() { this.writes++; return super.save(); }
    }
    const store = new CountingStore(file);
    const results = await Promise.all([store.load(), store.load(), store.load()]);
    assert.equal(store.writes, 1);
    assert.ok(results.every((state) => state === results[0]));
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")), createEmptyState());
  });
});

test("failed initialization rejects all readers and can be retried after repair", async () => {
  await temporaryStore(async (file) => {
    await writeFile(file, "invalid JSON");
    const store = new JsonStore(file);
    const first = await Promise.allSettled([store.load(), store.load()]);
    assert.ok(first.every((result) => result.status === "rejected" && result.reason instanceof SyntaxError));
    const repaired = createEmptyState();
    repaired.users.push({ id: "fictional-user" });
    await writeFile(file, JSON.stringify(repaired));
    const [one, two] = await Promise.all([store.load(), store.load()]);
    assert.equal(one, two);
    assert.equal(one.users[0].id, "fictional-user");
  });
});
