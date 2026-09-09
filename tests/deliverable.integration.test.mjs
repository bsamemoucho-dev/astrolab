import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { validateSectionText } from "../src/deliverables/validator.mjs";
import { writeSection } from "../src/deliverables/writers.mjs";
import { DOSSIER_SECTIONS } from "../src/deliverables/plan.mjs";

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
  return { status: response.status, payload, cookie: response.headers.get("set-cookie") };
}

async function registerVerifyLogin(baseUrl, email) {
  const password = "correct horse battery";
  const registered = await request(baseUrl, "/api/auth/register", { method: "POST", body: { email, password } });
  assert.equal(registered.status, 201);
  const verified = await request(baseUrl, "/api/auth/verify", {
    method: "POST",
    body: { email, code: registered.payload.devVerificationCode }
  });
  assert.equal(verified.status, 200);
  const loggedIn = await request(baseUrl, "/api/auth/login", { method: "POST", body: { email, password } });
  assert.equal(loggedIn.status, 200);
  return loggedIn.cookie;
}

async function waitDeliverable(baseUrl, cookie, id, timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    const response = await request(baseUrl, `/api/deliverables/${id}`, { cookie });
    assert.equal(response.status, 200);
    if (response.payload.deliverable.status !== "generating") {
      return response.payload;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Deliverable generation timed out in test");
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function createSubject(app, cookie, email) {
  const resolved = await request(app.baseUrl, "/api/places/resolve", {
    method: "POST",
    cookie,
    body: { query: "Paris, France", birthDate: "1990-01-15" }
  });
  assert.equal(resolved.status, 200);
  const saved = await request(app.baseUrl, "/api/me/profile", {
    method: "PUT",
    cookie,
    body: {
      firstName: "Client",
      lastName: "Test",
      birthDate: "1990-01-15",
      birthPlace: "Paris, France",
      country: "France",
      timePrecision: "exact",
      timeValue: "12:30",
      resolvedPlace: resolved.payload.place
    }
  });
  assert.equal(saved.status, 200);
  return saved.payload;
}

test("client dossier is created end-to-end from saved birth data (template writer, no LLM key)", async () => {
  const app = await startTestApp();
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "dossier@example.test");
    const subject = await createSubject(app, cookie);

    const created = await request(app.baseUrl, "/api/deliverables", {
      method: "POST",
      cookie,
      body: {
        personId: subject.person.id,
        intention: "Comprendre ma manière de tenir et d'avancer sans m'épuiser.",
        parents: [{ role: "mother", label: "Micheline", birthPlace: "Bouillante" }]
      }
    });
    assert.equal(created.status, 202);
    assert.equal(created.payload.deliverable.status, "generating");
    assert.ok(created.payload.deliverable.calculationRunId);

    const completed = await waitDeliverable(app.baseUrl, cookie, created.payload.deliverable.id);
    assert.equal(completed.deliverable.status, "template_draft");
    assert.equal(completed.deliverable.writerMode, "template");

    const sectionIds = completed.version.sections.map((section) => section.id);
    assert.ok(sectionIds.includes("introduction"));
    assert.ok(sectionIds.includes("position-naissance-axe"));
    assert.ok(sectionIds.includes("periodes-cycles"));
    assert.ok(sectionIds.includes("annexe-socle"));

    const intro = completed.version.sections.find((section) => section.id === "introduction");
    assert.equal(intro.status, "template_draft");
    assert.equal(intro.provider, "template");
    assert.equal(intro.validation.ok, true);

    const periods = completed.version.sections.find((section) => section.id === "periodes-cycles");
    assert.equal(periods.status, "not_available");
    assert.equal(periods.provider, "none");

    const listed = await request(app.baseUrl, "/api/deliverables", { cookie });
    assert.equal(listed.status, 200);
    assert.equal(listed.payload.deliverables.length, 1);
    assert.equal(listed.payload.deliverables[0].personLabel, "Client Test");
  } finally {
    await app.close();
  }
});

test("dossier exports render standalone HTML and markdown with the verified annex", async () => {
  const app = await startTestApp();
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "export@example.test");
    const subject = await createSubject(app, cookie);
    const created = await request(app.baseUrl, "/api/deliverables", {
      method: "POST",
      cookie,
      body: { personId: subject.person.id }
    });
    assert.equal(created.status, 202);
    const id = created.payload.deliverable.id;
    await waitDeliverable(app.baseUrl, cookie, id);

    const htmlResponse = await fetch(`${app.baseUrl}/api/deliverables/${id}/export?format=html`, {
      headers: { cookie }
    });
    assert.equal(htmlResponse.status, 200);
    assert.match(htmlResponse.headers.get("content-type"), /text\/html/);
    const html = await htmlResponse.text();
    assert.match(html, /<!doctype html>/);
    assert.match(html, /Dossier de lecture/);
    assert.match(html, /socle de calcul vérifié/i);

    const mdResponse = await fetch(`${app.baseUrl}/api/deliverables/${id}/export?format=md`, {
      headers: { cookie }
    });
    assert.equal(mdResponse.status, 200);
    const markdown = await mdResponse.text();
    assert.match(markdown, /## Position de naissance & axe de vie/);
    assert.match(markdown, /annexe — socle de calcul vérifié/i);
  } finally {
    await app.close();
  }
});

test("dossier generation in unknown birth time keeps the verified annex honest", async () => {
  const app = await startTestApp();
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "unknown@example.test");
    const resolved = await request(app.baseUrl, "/api/places/resolve", {
      method: "POST",
      cookie,
      body: { query: "Paris, France", birthDate: "1985-06-01" }
    });
    const saved = await request(app.baseUrl, "/api/me/profile", {
      method: "PUT",
      cookie,
      body: {
        firstName: "Sans",
        lastName: "Heure",
        birthDate: "1985-06-01",
        birthPlace: "Paris, France",
        country: "France",
        timePrecision: "unknown",
        resolvedPlace: resolved.payload.place
      }
    });
    const created = await request(app.baseUrl, "/api/deliverables", {
      method: "POST",
      cookie,
      body: { personId: saved.payload.person.id }
    });
    assert.equal(created.status, 202);

    const completed = await waitDeliverable(app.baseUrl, cookie, created.payload.deliverable.id);
    const fetched = await fetch(`${app.baseUrl}/api/deliverables/${completed.deliverable.id}/export?format=md`, {
      headers: { cookie }
    });
    const markdown = await fetched.text();
    assert.match(markdown, /Heure de naissance inconnue/i);
    assert.match(markdown, /Ascendant/i);
  } finally {
    await app.close();
  }
});

test("validator rejects invented facts, predictions, and contradictions with the verified socle", () => {
  const socle = {
    bodies: [
      { body: "Sun", sign: "Sagittarius" },
      { body: "Moon", sign: "Gemini" }
    ],
    ascendant: { sign: "Sagittarius" },
    midheaven: null
  };

  const contradiction = validateSectionText({
    sectionId: "position-naissance-axe",
    text: "Ton Soleil en Gémeaux et ton Ascendant Cancer façonnent ta manière de tenir.",
    socle
  });
  assert.equal(contradiction.ok, false);
  assert.ok(contradiction.issues.some((issue) => issue.code === "contradiction_with_socle"));

  const invented = validateSectionText({
    sectionId: "position-naissance-axe",
    text: "Avec un Ascendant Lion, tu affirmes ta place.",
    socle: { bodies: [], ascendant: null, midheaven: null }
  });
  assert.equal(invented.ok, false);
  assert.ok(invented.issues.some((issue) => issue.code === "invented_unavailable_fact"));

  const prediction = validateSectionText({
    sectionId: "lecture-passe",
    text: "Tu vas rencontrer quelqu'un qui changera ta vie.",
    socle
  });
  assert.equal(prediction.ok, false);
  assert.ok(prediction.issues.some((issue) => issue.code === "event_prediction"));

  const medical = validateSectionText({
    sectionId: "structure-psychologique",
    text: "Cela pourrait relever d'un trouble anxieux à surveiller.",
    socle
  });
  assert.equal(medical.ok, false);
  assert.ok(medical.issues.some((issue) => issue.code === "medical_or_diagnostic"));

  const clean = validateSectionText({
    sectionId: "structure-psychologique",
    text: "Tu as pu développer une posture de protection forte : tenir d'abord, ressentir ensuite. Ce que tu portes aujourd'hui peut se poser.",
    socle
  });
  assert.equal(clean.ok, true);
});

test("public no-account reading works without authentication and stores nothing", async () => {
  const app = await startTestApp();
  try {
    const reading = await request(app.baseUrl, "/api/public/readings", {
      method: "POST",
      body: {
        firstName: "Test",
        birthDate: "1990-01-15",
        timePrecision: "exact",
        timeValue: "12:30",
        resolvedPlace: {
          selectedName: "Paris, France",
          normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
        }
      }
    });
    assert.equal(reading.status, 200);
    assert.equal(reading.payload.writerMode, "template");
    assert.equal(reading.payload.status, "template_draft");
    assert.match(reading.payload.html, /<!doctype html>/);
    assert.match(reading.payload.html, /socle de calcul vérifié/i);
    assert.ok(reading.payload.sections.some((section) => section.id === "lettre-ame"));
    assert.equal(reading.payload.sections.length, 11); // 11 sections narratives ; l'annexe est dans le HTML

    const state = await app.store.load();
    assert.equal(state.users.length, 0);
    assert.equal(state.persons.length, 0);
    assert.equal((state.deliverables ?? []).length, 0);
  } finally {
    await app.close();
  }
});

test("public reading rejects invalid birth data without crashing", async () => {
  const app = await startTestApp();
  try {
    const missing = await request(app.baseUrl, "/api/public/readings", {
      method: "POST",
      body: { firstName: "X" }
    });
    assert.equal(missing.status, 400);
    assert.match(missing.payload.error, /date de naissance/i);
  } finally {
    await app.close();
  }
});

test("healthz and public config endpoints are available", async () => {
  const app = await startTestApp();
  try {
    const health = await fetch(`${app.baseUrl}/healthz`);
    assert.equal(health.status, 200);
    const healthPayload = await health.json();
    assert.equal(healthPayload.ok, true);

    const config = await fetch(`${app.baseUrl}/api/config`);
    assert.equal(config.status, 200);
    const configPayload = await config.json();
    assert.equal(configPayload.commerceEnabled, true);
    assert.equal(typeof configPayload.llmConfigured, "boolean");
  } finally {
    await app.close();
  }
});

test("operator can register a client person with a resolved place and generate a dossier", async () => {
  const app = await startTestApp();
  try {
    const cookie = await registerVerifyLogin(app.baseUrl, "operator@example.test");
    const resolved = await request(app.baseUrl, "/api/places/resolve", {
      method: "POST",
      cookie,
      body: { query: "Courbevoie, France", birthDate: "1986-01-02" }
    });
    assert.equal(resolved.status, 200);

    const person = await request(app.baseUrl, "/api/people", {
      method: "POST",
      cookie,
      body: {
        firstName: "Caroline",
        lastName: "Cliente",
        birthDate: "1986-01-02",
        birthPlace: "Courbevoie, France",
        timePrecision: "exact",
        timeValue: "16:45",
        resolvedPlace: resolved.payload.place
      }
    });
    assert.equal(person.status, 201);
    assert.ok(person.payload.birthData, "linked person must store resolved birth data");

    const dossier = await request(app.baseUrl, "/api/deliverables", {
      method: "POST",
      cookie,
      body: { personId: person.payload.person.id, intention: "Test du flux opérateur." }
    });
    assert.equal(dossier.status, 202);
    const completed = await waitDeliverable(app.baseUrl, cookie, dossier.payload.deliverable.id);
    assert.equal(completed.deliverable.personLabel, "Caroline Cliente");
    assert.equal(completed.deliverable.progress.phase, "done");

    const reviewed = await request(app.baseUrl, `/api/deliverables/${completed.deliverable.id}/review`, {
      method: "PATCH",
      cookie,
      body: { reviewed: true, note: "Vérifié manuellement avant livraison." }
    });
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.payload.deliverable.reviewedByHuman, true);
    assert.equal(reviewed.payload.deliverable.reviewNote, "Vérifié manuellement avant livraison.");

    const unmarked = await request(app.baseUrl, `/api/deliverables/${completed.deliverable.id}/review`, {
      method: "PATCH",
      cookie,
      body: { reviewed: false }
    });
    assert.equal(unmarked.payload.deliverable.reviewedByHuman, false);
  } finally {
    await app.close();
  }
});

test("injected writer text is validated and stored with its provider", async () => {
  const context = { person: { firstName: "A" }, parents: [], intention: null, socle: { facts: [] } };
  const section = DOSSIER_SECTIONS.find((entry) => entry.id === "lecture-passe");
  const written = await writeSection(section, context, {
    writerFn: () => "Tu as pu apprendre très tôt à tenir sans demander. Rien n'est figé : ce que tu as porté peut se poser."
  });
  assert.equal(written.provider, "injected");
  assert.match(written.text, /tenir sans demander/);
});
