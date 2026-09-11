import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";

async function startTestApp() {
  const { server, store } = createApp({ store: new JsonStore(null) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    store,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function request(baseUrl, path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  return {
    status: response.status,
    payload,
    cookie: response.headers.get("set-cookie")
  };
}

async function rawRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return {
    status: response.status,
    text,
    headers: response.headers
  };
}

async function registerVerifyLogin(baseUrl, email) {
  const password = "correct horse battery";
  const registered = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { email, password }
  });
  assert.equal(registered.status, 201);

  const verified = await request(baseUrl, "/api/auth/verify", {
    method: "POST",
    body: { email, code: registered.payload.devVerificationCode }
  });
  assert.equal(verified.status, 200);

  const loggedIn = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email, password }
  });
  assert.equal(loggedIn.status, 200);
  assert.match(loggedIn.cookie, /astrolab_session=/);
  return loggedIn.cookie;
}

test("email authentication requires verification before login", async () => {
  const app = await startTestApp();
  try {
    const password = "correct horse battery";
    const registered = await request(app.baseUrl, "/api/auth/register", {
      method: "POST",
      body: { email: "one@example.test", password }
    });
    assert.equal(registered.status, 201);

    const rejectedLogin = await request(app.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "one@example.test", password }
    });
    assert.equal(rejectedLogin.status, 403);

    const verified = await request(app.baseUrl, "/api/auth/verify", {
      method: "POST",
      body: { email: "one@example.test", code: registered.payload.devVerificationCode }
    });
    assert.equal(verified.status, 200);
  } finally {
    await app.close();
  }
});

test("profile birth data preserves explicit time interval uncertainty", async () => {
  const app = await startTestApp();
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "profile@example.test");
    const saved = await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie,
      body: {
        firstName: "Ada",
        lastName: "Lovelace",
        birthDate: "1815-12-10",
        birthPlace: "London",
        country: "United Kingdom",
        timePrecision: "interval",
        timeStart: "14:00",
        timeEnd: "16:00",
        sourceNote: "Test interval"
      }
    });

    assert.equal(saved.status, 200);
    assert.equal(saved.payload.birthData.timePrecision, "interval");
    assert.equal(saved.payload.birthData.timeStart, "14:00");
    assert.equal(saved.payload.birthData.timeEnd, "16:00");

    const dossier = await request(app.baseUrl, "/api/me", { cookie });
    assert.equal(dossier.payload.people.length, 1);
    assert.equal(dossier.payload.history[0].action, "profile.created");
  } finally {
    await app.close();
  }
});

test("users cannot access or relate people owned by another user", async () => {
  const app = await startTestApp();
  try {
    const cookieA = await registerVerifyLogin(app.baseUrl, "a@example.test");
    const cookieB = await registerVerifyLogin(app.baseUrl, "b@example.test");

    await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie: cookieA,
      body: {
        firstName: "User",
        lastName: "A",
        birthDate: "1990-01-01",
        birthPlace: "Paris",
        timePrecision: "unknown"
      }
    });

    await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie: cookieB,
      body: {
        firstName: "User",
        lastName: "B",
        birthDate: "1991-01-01",
        birthPlace: "Lyon",
        timePrecision: "unknown"
      }
    });

    const personA = await request(app.baseUrl, "/api/people", {
      method: "POST",
      cookie: cookieA,
      body: { firstName: "Parent A", timePrecision: "unknown" }
    });
    assert.equal(personA.status, 201);

    const dossierB = await request(app.baseUrl, "/api/me", { cookie: cookieB });
    const primaryB = dossierB.payload.people.find((person) => person.isPrimary);

    const crossRelationship = await request(app.baseUrl, "/api/relationships", {
      method: "POST",
      cookie: cookieB,
      body: {
        fromPersonId: primaryB.id,
        toPersonId: personA.payload.person.id,
        type: "mother"
      }
    });
    assert.equal(crossRelationship.status, 404);

    const crossDelete = await request(app.baseUrl, `/api/people/${personA.payload.person.id}`, {
      method: "DELETE",
      cookie: cookieB
    });
    assert.equal(crossDelete.status, 404);
  } finally {
    await app.close();
  }
});

test("linked people, relationships, deletions, and history work within one dossier", async () => {
  const app = await startTestApp();
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "family@example.test");
    await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie,
      body: {
        firstName: "Main",
        lastName: "Person",
        birthDate: "1985-05-05",
        birthPlace: "Marseille",
        timePrecision: "exact",
        timeValue: "09:15"
      }
    });

    const dossier = await request(app.baseUrl, "/api/me", { cookie });
    const primary = dossier.payload.people.find((person) => person.isPrimary);

    const linked = await request(app.baseUrl, "/api/people", {
      method: "POST",
      cookie,
      body: {
        firstName: "Mother",
        birthDate: "1955-03-02",
        birthPlace: "Nice",
        timePrecision: "unknown"
      }
    });
    assert.equal(linked.status, 201);

    const relation = await request(app.baseUrl, "/api/relationships", {
      method: "POST",
      cookie,
      body: {
        fromPersonId: primary.id,
        toPersonId: linked.payload.person.id,
        type: "mother"
      }
    });
    assert.equal(relation.status, 201);

    const afterRelation = await request(app.baseUrl, "/api/me", { cookie });
    assert.equal(afterRelation.payload.relationships.length, 1);
    assert.ok(afterRelation.payload.history.some((entry) => entry.action === "relationship.created"));

    const deleted = await request(app.baseUrl, `/api/relationships/${relation.payload.id}`, {
      method: "DELETE",
      cookie
    });
    assert.equal(deleted.status, 200);

    const afterDelete = await request(app.baseUrl, "/api/me", { cookie });
    assert.equal(afterDelete.payload.relationships.length, 0);
    assert.ok(afterDelete.payload.history.some((entry) => entry.action === "relationship.deleted"));
  } finally {
    await app.close();
  }
});

test("invalid dossier writes fail without leaving partial records", async () => {
  const app = await startTestApp();
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "rollback@example.test");
    const invalid = await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie,
      body: {
        firstName: "Invalid",
        birthDate: "2000-01-01",
        birthPlace: "Paris",
        timePrecision: "interval",
        timeStart: "10:00"
      }
    });
    assert.equal(invalid.status, 400);

    const dossier = await request(app.baseUrl, "/api/me", { cookie });
    assert.equal(dossier.payload.people.length, 0);
    assert.equal(dossier.payload.history.length, 0);
  } finally {
    await app.close();
  }
});

test("account export omits auth secrets and account deletion revokes access", async () => {
  const app = await startTestApp();
  try {
    const email = "export-delete@example.test";
    const password = "correct horse battery";
    const cookie = await registerVerifyLogin(app.baseUrl, email);

    const saved = await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie,
      body: {
        firstName: "Exported",
        birthDate: "2001-01-01",
        birthPlace: "Toulouse",
        timePrecision: "unknown",
        sourceNote: "Account export test"
      }
    });
    assert.equal(saved.status, 200);

    const exported = await request(app.baseUrl, "/api/me/export", { cookie });
    assert.equal(exported.status, 200);
    assert.equal(exported.payload.user.email, email);
    assert.equal(exported.payload.persons.length, 1);
    assert.equal(exported.payload.birthData.length, 1);
    assert.ok(exported.payload.dataSources.length >= 1);
    assert.ok(exported.payload.auditLogs.some((entry) => entry.action === "profile.created"));
    assert.equal(Object.hasOwn(exported.payload.user, "passwordHash"), false);
    assert.equal(Object.hasOwn(exported.payload.user, "verificationCode"), false);

    const deleted = await request(app.baseUrl, "/api/me", {
      method: "DELETE",
      cookie
    });
    assert.equal(deleted.status, 200);
    assert.match(deleted.cookie, /astrolab_session=;/);

    const session = await request(app.baseUrl, "/api/session", { cookie });
    assert.equal(session.status, 200);
    assert.equal(session.payload.user, null);

    const denied = await request(app.baseUrl, "/api/me", { cookie });
    assert.equal(denied.status, 401);

    const loginAfterDelete = await request(app.baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email, password }
    });
    assert.equal(loginAfterDelete.status, 401);
  } finally {
    await app.close();
  }
});

test("analyses create immutable snapshots with explicit unavailable method results", async () => {
  const app = await startTestApp();
  try {
    const cookieA = await registerVerifyLogin(app.baseUrl, "analysis-a@example.test");
    const cookieB = await registerVerifyLogin(app.baseUrl, "analysis-b@example.test");

    const rejected = await request(app.baseUrl, "/api/analyses", {
      method: "POST",
      cookie: cookieA,
      body: { scope: "personal_profile" }
    });
    assert.equal(rejected.status, 400);

    await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie: cookieA,
      body: {
        firstName: "Analysis",
        birthDate: "1992-02-03",
        birthPlace: "Bordeaux",
        timePrecision: "unknown"
      }
    });

    const created = await request(app.baseUrl, "/api/analyses", {
      method: "POST",
      cookie: cookieA,
      body: { scope: "personal_profile" }
    });
    assert.equal(created.status, 201);
    assert.equal(created.payload.versions.length, 1);
    assert.equal(created.payload.versions[0].dataSnapshot.people.length, 1);
    assert.equal(created.payload.methodResults.length, 3);
    assert.ok(created.payload.methodResults.every((result) => ["not_implemented", "documentation_insufficient"].includes(result.status)));
    assert.equal(created.payload.transversalFindings[0].type, "indeterminate");

    await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie: cookieA,
      body: {
        firstName: "Changed",
        birthDate: "1992-02-03",
        birthPlace: "Bordeaux",
        timePrecision: "unknown"
      }
    });

    const fetched = await request(app.baseUrl, `/api/analyses/${created.payload.id}`, { cookie: cookieA });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.payload.versions[0].dataSnapshot.people[0].firstName, "Analysis");

    const list = await request(app.baseUrl, "/api/analyses", { cookie: cookieA });
    assert.equal(list.status, 200);
    assert.equal(list.payload.analyses.length, 1);

    const crossUser = await request(app.baseUrl, `/api/analyses/${created.payload.id}`, { cookie: cookieB });
    assert.equal(crossUser.status, 404);
  } finally {
    await app.close();
  }
});

test("reports are generated from structured analysis state with guardrails", async () => {
  const app = await startTestApp();
  try {
    const cookieA = await registerVerifyLogin(app.baseUrl, "report-a@example.test");
    const cookieB = await registerVerifyLogin(app.baseUrl, "report-b@example.test");

    await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie: cookieA,
      body: {
        firstName: "Report",
        birthDate: "1998-04-12",
        birthPlace: "Lille",
        timePrecision: "unknown"
      }
    });

    const analysis = await request(app.baseUrl, "/api/analyses", {
      method: "POST",
      cookie: cookieA,
      body: { scope: "personal_profile" }
    });
    assert.equal(analysis.status, 201);

    const report = await request(app.baseUrl, `/api/analyses/${analysis.payload.id}/reports`, {
      method: "POST",
      cookie: cookieA
    });
    assert.equal(report.status, 201);
    assert.equal(report.payload.analysisId, analysis.payload.id);
    assert.equal(report.payload.status, "blocked");
    assert.equal(report.payload.guardrails.aiGenerated, false);
    assert.equal(report.payload.guardrails.unsupportedClaims.length, 0);
    assert.ok(report.payload.sections.some((section) => section.layer === "transversal_inference" && section.findingIds.length > 0));

    const reports = await request(app.baseUrl, `/api/analyses/${analysis.payload.id}/reports`, { cookie: cookieA });
    assert.equal(reports.status, 200);
    assert.equal(reports.payload.reports.length, 1);

    const crossUser = await request(app.baseUrl, `/api/analyses/${analysis.payload.id}/reports`, {
      method: "POST",
      cookie: cookieB
    });
    assert.equal(crossUser.status, 404);
  } finally {
    await app.close();
  }
});

test("western natal endpoint calculates and persists reproducible development artifacts", async () => {
  const app = await startTestApp();
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "natal@example.test");
    const resolved = await request(app.baseUrl, "/api/places/resolve", {
      method: "POST",
      cookie,
      body: { query: "Paris, France", birthDate: "1990-01-15" }
    });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.payload.place.selectedName, "Paris, France");
    assert.equal(resolved.payload.place.normalizedForCalculation.timeZone, "Europe/Paris");

    const saved = await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie,
      body: {
        firstName: "Natal",
        lastName: "Subject",
        birthDate: "1990-01-15",
        birthPlace: "Paris, France",
        country: "France",
        timePrecision: "exact",
        timeValue: "12:30",
        resolvedPlace: resolved.payload.place
      }
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.payload.birthData.latitude, 48.8566);
    assert.equal(saved.payload.birthData.timeZone, "Europe/Paris");
    assert.equal(saved.payload.birthData.resolvedPlace.resolutionSource, resolved.payload.place.resolutionSource);

    const calculated = await request(app.baseUrl, "/api/western-natal/calculate", {
      method: "POST",
      cookie,
      body: { personId: saved.payload.person.id }
    });
    assert.equal(calculated.status, 201);
    assert.equal(calculated.payload.result.methodId, "western-natal");
    assert.equal(calculated.payload.result.productionEligible, false);
    assert.deepEqual(calculated.payload.result.parameters.ruleVersionsCreated, ["lastro-aspects@1.0.0"]);
    assert.equal(calculated.payload.result.parameters.interpretiveRuleVersionsCreated, false);
    assert.equal(calculated.payload.calculationArtifacts.length, 2);
    assert.match(calculated.payload.calculationRun.inputDataHash, /^[a-f0-9]{64}$/);
    assert.match(calculated.payload.calculationRun.resultHash, /^[a-f0-9]{64}$/);
    assert.equal(calculated.payload.result.astronomicalCalculation.bodies.length, 7);
    assert.equal(calculated.payload.result.structuralAstrology.houses.length, 12);
    assert.deepEqual(calculated.payload.result.normalizedInput.resolvedPlace, resolved.payload.place);

    const exported = await request(app.baseUrl, "/api/me/export", { cookie });
    assert.equal(exported.payload.calculationRuns.length, 1);
    assert.equal(exported.payload.calculationArtifacts.length, 2);
    assert.ok(exported.payload.auditLogs.some((entry) => entry.action === "calculation.western_natal.created"));
  } finally {
    await app.close();
  }
});

test("place resolution endpoint reports invalid and ambiguous places", async () => {
  const app = await startTestApp();
  const previousExternalResolution = process.env.ASTROLAB_DISABLE_EXTERNAL_PLACE_RESOLUTION;
  process.env.ASTROLAB_DISABLE_EXTERNAL_PLACE_RESOLUTION = "1";
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "places@example.test");
    const invalid = await request(app.baseUrl, "/api/places/resolve", {
      method: "POST",
      cookie,
      body: { query: "No Such City" }
    });
    assert.equal(invalid.status, 404);

    const ambiguous = await request(app.baseUrl, "/api/places/resolve", {
      method: "POST",
      cookie,
      body: { query: "Springfield" }
    });
    assert.equal(ambiguous.status, 409);
    assert.equal(ambiguous.payload.matches.length, 2);
  } finally {
    if (previousExternalResolution === undefined) {
      delete process.env.ASTROLAB_DISABLE_EXTERNAL_PLACE_RESOLUTION;
    } else {
      process.env.ASTROLAB_DISABLE_EXTERNAL_PLACE_RESOLUTION = previousExternalResolution;
    }
    await app.close();
  }
});

test("western natal endpoint creates partial calculation when birth time is unknown", async () => {
  const app = await startTestApp();
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "natal-missing@example.test");
    const resolved = await request(app.baseUrl, "/api/places/resolve", {
      method: "POST",
      cookie,
      body: { query: "Paris, France", birthDate: "1990-01-15" }
    });
    await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie,
      body: {
        firstName: "Missing",
        birthDate: "1990-01-15",
        birthPlace: "Paris, France",
        timePrecision: "unknown",
        resolvedPlace: resolved.payload.place
      }
    });

    const calculated = await request(app.baseUrl, "/api/western-natal/calculate", {
      method: "POST",
      cookie,
      body: {}
    });
    assert.equal(calculated.status, 201);
    assert.equal(calculated.payload.result.uncertainty.timePrecision, "unknown");
    assert.equal(calculated.payload.result.astronomicalCalculation.angles.ascendant, null);
    assert.equal(calculated.payload.result.structuralAstrology.houses.status, "not_calculated_time_unknown");
    assert.equal(calculated.payload.result.astronomicalCalculation.bodies.length, 7);
  } finally {
    await app.close();
  }
});

test("commerce ledger tracks development credit orders and consumption per user", async () => {
  const app = await startTestApp();
  try {
    const cookieA = await registerVerifyLogin(app.baseUrl, "commerce-a@example.test");
    const cookieB = await registerVerifyLogin(app.baseUrl, "commerce-b@example.test");

    const initial = await request(app.baseUrl, "/api/commerce", { cookie: cookieA });
    assert.equal(initial.status, 200);
    assert.equal(initial.payload.balance, 0);
    assert.equal(initial.payload.plans.length, 3);

    const grant = await request(app.baseUrl, "/api/commerce/dev-credit-order", {
      method: "POST",
      cookie: cookieA,
      body: { planId: "starter" }
    });
    assert.equal(grant.status, 201);
    assert.equal(grant.payload.balance, 10);
    assert.equal(grant.payload.order.status, "paid");
    assert.equal(grant.payload.ledgerEntry.delta, 10);

    const consumed = await request(app.baseUrl, "/api/commerce/consume", {
      method: "POST",
      cookie: cookieA,
      body: { amount: 4, reason: "test_consumption" }
    });
    assert.equal(consumed.status, 200);
    assert.equal(consumed.payload.balance, 6);
    assert.equal(consumed.payload.ledgerEntry.delta, -4);

    const insufficient = await request(app.baseUrl, "/api/commerce/consume", {
      method: "POST",
      cookie: cookieA,
      body: { amount: 7 }
    });
    assert.equal(insufficient.status, 402);

    const after = await request(app.baseUrl, "/api/commerce", { cookie: cookieA });
    assert.equal(after.payload.balance, 6);
    assert.equal(after.payload.orders.length, 1);
    assert.equal(after.payload.ledger.length, 2);

    const otherUser = await request(app.baseUrl, "/api/commerce", { cookie: cookieB });
    assert.equal(otherUser.status, 200);
    assert.equal(otherUser.payload.balance, 0);
    assert.equal(otherUser.payload.orders.length, 0);
    assert.equal(otherUser.payload.ledger.length, 0);
  } finally {
    await app.close();
  }
});

test("admin endpoints require admin role and expose redacted audit views", async () => {
  const app = await startTestApp();
  try {
    const userCookie = await registerVerifyLogin(app.baseUrl, "regular@example.test");
    const adminCookie = await registerVerifyLogin(app.baseUrl, "admin@example.test");

    await app.store.transact((state) => {
      const admin = state.users.find((entry) => entry.email === "admin@example.test");
      admin.primaryRole = "admin";
    });

    await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie: userCookie,
      body: {
        firstName: "Regular",
        birthDate: "1990-06-01",
        birthPlace: "Paris",
        timePrecision: "unknown"
      }
    });

    const denied = await request(app.baseUrl, "/api/admin/summary", { cookie: userCookie });
    assert.equal(denied.status, 403);

    const summary = await request(app.baseUrl, "/api/admin/summary", { cookie: adminCookie });
    assert.equal(summary.status, 200);
    assert.equal(summary.payload.counts.users, 2);
    assert.equal(summary.payload.users.length, 2);
    assert.equal(Object.hasOwn(summary.payload.users[0], "passwordHash"), false);
    assert.equal(Object.hasOwn(summary.payload.users[0], "verificationCode"), false);

    const audit = await request(app.baseUrl, "/api/admin/audit?limit=10", { cookie: adminCookie });
    assert.equal(audit.status, 200);
    assert.ok(audit.payload.auditLogs.some((entry) => entry.action === "profile.created"));
    assert.equal(Object.hasOwn(audit.payload.auditLogs[0], "before"), false);
    assert.equal(Object.hasOwn(audit.payload.auditLogs[0], "after"), false);
  } finally {
    await app.close();
  }
});

test("http layer applies security headers and request body guardrails", async () => {
  const app = await startTestApp();
  try {
    const page = await rawRequest(app.baseUrl, "/");
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("x-content-type-options"), "nosniff");
    assert.equal(page.headers.get("x-frame-options"), "DENY");
    assert.equal(page.headers.get("referrer-policy"), "same-origin");
    assert.match(page.headers.get("permissions-policy"), /camera=\(\)/);

    const badContentType = await rawRequest(app.baseUrl, "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not json"
    });
    assert.equal(badContentType.status, 415);

    const tooLarge = await rawRequest(app.baseUrl, "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "large@example.test", password: "correct horse battery", filler: "x".repeat(70 * 1024) })
    });
    assert.equal(tooLarge.status, 413);
  } finally {
    await app.close();
  }
});
