import assert from "node:assert/strict";
import test from "node:test";

import { JsonStore } from "../src/db/jsonStore.mjs";
import { bootstrapAdminFromEnv } from "../src/models/adminService.mjs";

function storeWithUsers(users) {
  return new JsonStore(null, {
    users,
    sessions: [],
    persons: [],
    birthData: [],
    dataPoints: [],
    dataSources: [],
    relationships: [],
    analyses: [],
    analysisVersions: [],
    methodResults: [],
    transversalFindings: [],
    calculationRuns: [],
    calculationArtifacts: [],
    reports: [],
    deliverables: [],
    deliverableVersions: [],
    orders: [],
    publicReadings: [],
    accessCodes: [],
    creditLedger: [],
    auditLogs: [],
    methods: [],
    outbox: []
  });
}

function user(overrides = {}) {
  return {
    id: overrides.id ?? "user_1",
    email: overrides.email ?? "flak@lastro.fr",
    emailVerifiedAt: Object.hasOwn(overrides, "emailVerifiedAt")
      ? overrides.emailVerifiedAt
      : new Date("2026-10-06T08:20:33.659Z").toISOString(),
    primaryRole: overrides.primaryRole ?? "user",
    createdAt: new Date("2026-10-06T08:00:00.000Z").toISOString(),
    deletedAt: overrides.deletedAt ?? null
  };
}

test("admin bootstrap promotes exactly one active verified user and is idempotent", async () => {
  const logs = [];
  const store = storeWithUsers([
    user({ id: "target", email: "Flak@Lastro.fr", primaryRole: "user" }),
    user({ id: "other", email: "autre@lastro.fr", primaryRole: "user" })
  ]);

  const first = await bootstrapAdminFromEnv(store, {
    env: { ADMIN_BOOTSTRAP_EMAIL: " flak@lastro.fr " },
    log: (message) => logs.push(message)
  });
  const second = await bootstrapAdminFromEnv(store, {
    env: { ADMIN_BOOTSTRAP_EMAIL: "flak@lastro.fr" },
    log: (message) => logs.push(message)
  });

  const state = await store.load();
  assert.deepEqual(first, { applied: true, email: "flak@lastro.fr" });
  assert.equal(second.applied, false);
  assert.equal(second.reason, "already_admin");
  assert.equal(state.users.find((entry) => entry.id === "target").primaryRole, "admin");
  assert.equal(state.users.find((entry) => entry.id === "other").primaryRole, "user");
  assert.deepEqual(logs, ["Admin bootstrap applied: flak@lastro.fr"]);
});

test("admin bootstrap does nothing without one active verified matching user", async () => {
  const cases = [
    {
      name: "not configured",
      env: {},
      users: [user()],
      reason: "not_configured"
    },
    {
      name: "missing user",
      env: { ADMIN_BOOTSTRAP_EMAIL: "absent@lastro.fr" },
      users: [user()],
      reason: "user_not_found_or_ambiguous"
    },
    {
      name: "deleted user",
      env: { ADMIN_BOOTSTRAP_EMAIL: "flak@lastro.fr" },
      users: [user({ deletedAt: new Date().toISOString() })],
      reason: "user_not_found_or_ambiguous"
    },
    {
      name: "ambiguous active users",
      env: { ADMIN_BOOTSTRAP_EMAIL: "flak@lastro.fr" },
      users: [user({ id: "a" }), user({ id: "b" })],
      reason: "user_not_found_or_ambiguous"
    },
    {
      name: "unverified user",
      env: { ADMIN_BOOTSTRAP_EMAIL: "flak@lastro.fr" },
      users: [user({ emailVerifiedAt: null })],
      reason: "email_not_verified"
    }
  ];

  for (const scenario of cases) {
    const logs = [];
    const store = storeWithUsers(scenario.users);
    const result = await bootstrapAdminFromEnv(store, {
      env: scenario.env,
      log: (message) => logs.push(message)
    });
    const state = await store.load();

    assert.equal(result.applied, false, scenario.name);
    assert.equal(result.reason, scenario.reason, scenario.name);
    assert.equal(state.users.some((entry) => entry.primaryRole === "admin"), false, scenario.name);
    assert.deepEqual(logs, [], scenario.name);
  }
});
