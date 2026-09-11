import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/http/app.mjs";
import { JsonStore } from "../src/db/jsonStore.mjs";
import { validateSectionText } from "../src/deliverables/validator.mjs";
import { writeSection } from "../src/deliverables/writers.mjs";
import { DOSSIER_SECTIONS } from "../src/deliverables/plan.mjs";
import { createPublicReading, hasConvergentIndicators } from "../src/models/publicReadingService.mjs";

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
    // Ce dossier fournit des données familiales (Micheline, Bouillante) : la
    // section transgénérationnelle est donc présente. Le cas inverse — aucun
    // parent renseigné, section supprimée — est vérifié par le test de la
    // lecture publique, qui partage la même condition.
    assert.ok(sectionIds.includes("transgenerationnel"));

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
    // Une seule lettre, en bonus : « Lettre d'âme » a été retirée.
    assert.equal(reading.payload.sections.some((section) => section.id === "lettre-ame"), false);
    assert.ok(reading.payload.sections.some((section) => section.id === "lettre-miroir"));
    assert.equal(reading.payload.verification.status, "skipped");
    // Sans données familiales, la section transgénérationnelle disparaît (au lieu
    // d'inventer une histoire d'ancêtres) ; la conclusion éthique n'est plus une
    // section mais une clôture fixe ; et « forces et tensions » n'apparaît que
    // si des indicateurs convergent réellement (ici : oui).
    assert.equal(reading.payload.sections.length, 10);
    assert.equal(reading.payload.sections.some((section) => section.id === "transgenerationnel"), false);
    // La provenance est explicite : rien n'est présenté comme une règle traditionnelle.
    assert.equal(reading.payload.provenance.lastroConvention, "lastro-convergence@1.0.0");
    assert.equal(reading.payload.provenance.traditionalRules, null);

    const state = await app.store.load();
    assert.equal(state.users.length, 0);
    assert.equal(state.persons.length, 0);
    assert.equal((state.deliverables ?? []).length, 0);
  } finally {
    await app.close();
  }
});

test("cross-check safeguards: a correction that contradicts the facts is rejected", async () => {
  const input = {
    firstName: "Test",
    language: "fr",
    birthDate: "1990-01-15",
    timePrecision: "exact",
    timeValue: "12:30",
    resolvedPlace: {
      selectedName: "Paris, France",
      normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
    }
  };
  const writerFn = (section) => `Texte de départ pour ${section.id}, sans erreur factuelle.`;

  const badCorrection = await createPublicReading(input, {
    writerFn,
    crossCheckFn: async ({ sections }) => ({
      status: "checked",
      provider: "gemini",
      model: "test-model",
      issues: [{ section: sections[0].id, severity: "error", message: "Soleil mal placé" }],
      corrections: { [sections[0].id]: "Ton Soleil en Gémeaux raconte une tout autre histoire." }
    })
  });
  assert.equal(badCorrection.verification.rejectedCount, 1);
  assert.equal(badCorrection.verification.correctedCount, 0);
  assert.match(badCorrection.html, /Texte de départ/);

  const goodCorrection = await createPublicReading(input, {
    writerFn,
    crossCheckFn: async ({ sections }) => ({
      status: "checked",
      provider: "gemini",
      model: "test-model",
      issues: [{ section: sections[0].id, severity: "error", message: "coquille" }],
      corrections: { [sections[0].id]: "Texte de départ corrigé, sans erreur factuelle." }
    })
  });
  assert.equal(goodCorrection.verification.correctedCount, 1);
  assert.equal(goodCorrection.verification.rejectedCount, 0);
  assert.match(goodCorrection.html, /Texte de départ corrigé/);
});

test("a manually moved map pin really changes the coordinates used by the reading", async () => {
  const writerFn = (section) => `Texte pour ${section.id}.`;
  const base = {
    firstName: "Test",
    language: "fr",
    birthDate: "1990-01-15",
    timePrecision: "exact",
    timeValue: "12:30"
  };
  const resolved = {
    selectedName: "Amsterdam, Pays-Bas",
    country: "Pays-Bas",
    latitude: 52.37403,
    longitude: 4.88969,
    timeZone: "Europe/Amsterdam",
    normalizedForCalculation: { latitude: 52.37403, longitude: 4.88969, timeZone: "Europe/Amsterdam" },
    resolutionSource: "open-meteo-geocoding-api@2026-09-01",
    confidence: "external_geocoding_unverified"
  };
  const moved = {
    ...resolved,
    latitude: 52.34709,
    longitude: 4.81339,
    normalizedForCalculation: { latitude: 52.34709, longitude: 4.81339, timeZone: "Europe/Amsterdam" },
    resolutionSource: "open-meteo-geocoding-api@2026-09-01 + ajustement manuel du repère",
    confidence: "coordinates_manually_adjusted"
  };

  const before = await createPublicReading({ ...base, resolvedPlace: resolved }, { writerFn, crossCheckFn: null });
  const after = await createPublicReading({ ...base, resolvedPlace: moved }, { writerFn, crossCheckFn: null });

  // Le document publié porte les coordonnées réellement utilisées.
  assert.match(before.html, /52\.37403/);
  assert.match(after.html, /52\.34709/);
  assert.doesNotMatch(after.html, /52\.37403/);
  assert.match(after.markdown, /52\.34709/);
});

test("public checkout session reports that payments are not configured yet", async () => {
  const app = await startTestApp();
  try {
    const response = await request(app.baseUrl, "/api/public/checkout-session", {
      method: "POST",
      body: { amountCents: 1000 }
    });
    assert.equal(response.status, 503);
    assert.match(response.payload.error, /paiement/i);

    const config = await fetch(`${app.baseUrl}/api/config`).then((r) => r.json());
    assert.equal(config.payments.configured, false);
    assert.equal(config.payments.publishableKey, null);
    // L'offre publiée au navigateur : montant libre à partir de 5 €, sans plafond produit.
    assert.equal(config.payments.minAmountCents, 500);
    assert.equal(config.payments.maxAmountCents, 99999999);
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

test("public daily horoscope returns the requested sign (template fallback without key)", async () => {
  const app = await startTestApp();
  try {
    const ok = await request(app.baseUrl, "/api/public/horoscope/belier");
    assert.equal(ok.status, 200);
    assert.equal(ok.payload.sign.fr, "Bélier");
    assert.equal(ok.payload.sign.glyph, "♈");
    assert.equal(ok.payload.provider, "template");
    assert.ok(ok.payload.horoscope.amour && ok.payload.horoscope.travail && ok.payload.horoscope.bienEtre);
    assert.ok(ok.payload.day.length > 3);
  } finally {
    await app.close();
  }
});

test("public horoscope rejects an unknown sign", async () => {
  const app = await startTestApp();
  try {
    const bad = await request(app.baseUrl, "/api/public/horoscope/notasign");
    assert.equal(bad.status, 400);
    assert.match(bad.payload.error, /signe/i);
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

test("heure de naissance inconnue : le rédacteur est prévenu que l'axe et les maisons ne sont pas calculés", async () => {
  const contextes = [];
  const writerFn = (section, context) => {
    contextes.push(context);
    return `Texte pour ${section.id}.`;
  };
  const reading = await createPublicReading(
    {
      firstName: "Test",
      language: "fr",
      birthDate: "1970-06-15",
      timePrecision: "unknown",
      resolvedPlace: {
        selectedName: "Paris, France",
        normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
      }
    },
    { writerFn, crossCheckFn: null }
  );

  // Le rédacteur reçoit l'information, section par section (une section peut
  // être marquée « non disponible » et ne pas passer par le rédacteur).
  assert.ok(contextes.length >= 9, `contextes reçus : ${contextes.length}`);
  for (const context of contextes) {
    assert.equal(context.uncertainty.timeKnown, false);
    assert.ok(context.uncertainty.indeterminable.includes("ascendant"));
    assert.ok(context.uncertainty.indeterminable.includes("houses"));
    assert.match(context.uncertainty.warnings.join(" "), /unknown/i);
  }

  // Et aucun fait d'ascendant ou de maison ne lui est présenté comme calculé.
  const facts = contextes[0].socle.facts;
  const labels = facts.map((fact) => fact.id);
  // Aucun angle n'est présenté comme calculé…
  assert.equal(labels.some((id) => id.startsWith("angle.")), false);
  // …et aucune position n'est rattachée à une maison, ni affichée avec une
  // valeur inventée (« null », « 0°00′ »).
  const bodyValues = facts.filter((fact) => fact.id.startsWith("body.")).map((fact) => String(fact.value));
  assert.ok(bodyValues.length >= 7);
  assert.doesNotMatch(bodyValues.join(" | "), /maison|house|null|0°00/i);
});

test("transgénérationnel fourni : la section revient, et la rédaction sait ce qui a déjà été écrit", async () => {
  const contextes = [];
  const writerFn = (section, context) => {
    contextes.push({ id: section.id, precedents: context.previousSections?.length ?? 0 });
    return `Texte pour ${section.id}.`;
  };
  const reading = await createPublicReading(
    {
      firstName: "Test",
      language: "fr",
      birthDate: "1970-06-15",
      timePrecision: "unknown",
      parents: [{ role: "mother", firstName: "Marie", birthDate: "1945-02-03" }],
      resolvedPlace: {
        selectedName: "Paris, France",
        normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
      }
    },
    { writerFn, crossCheckFn: null }
  );

  // Avec des données familiales, la section existe à nouveau.
  assert.ok(reading.sections.some((section) => section.id === "transgenerationnel"));

  // Dès la deuxième section, le rédacteur reçoit ce qui a déjà été produit.
  const premiere = contextes[0];
  const derniere = contextes.at(-1);
  assert.equal(premiere.precedents, 0);
  assert.ok(derniere.precedents >= 8, `sections précédentes transmises : ${derniere.precedents}`);
});

test("« Vos forces et vos tensions » n'existe que si des indicateurs convergent réellement", async () => {
  // Deux corps dans un même signe : matière suffisante.
  assert.equal(
    hasConvergentIndicators([
      { body: "Sun", sign: "Gemini" },
      { body: "Mercury", sign: "Gemini" },
      { body: "Venus", sign: "Cancer" }
    ]),
    true
  );
  // Tous les signes différents : aucune convergence, donc pas de section.
  assert.equal(
    hasConvergentIndicators([
      { body: "Sun", sign: "Gemini" },
      { body: "Mercury", sign: "Cancer" },
      { body: "Venus", sign: "Leo" }
    ]),
    false
  );
  // Un signe indéterminé (heure inconnue) ne compte pas comme convergence.
  assert.equal(
    hasConvergentIndicators([
      { body: "Moon", sign: null },
      { body: "Sun", sign: "Gemini" }
    ]),
    false
  );

  const contextes = [];
  const reading = await createPublicReading(
    {
      firstName: "Test",
      language: "fr",
      birthDate: "1970-06-15",
      timePrecision: "unknown",
      resolvedPlace: {
        selectedName: "Paris, France",
        normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
      }
    },
    { writerFn: (section, context) => { contextes.push(context); return "Texte."; }, crossCheckFn: null }
  );
  // La section a été retirée du plan : tant que les aspects sont inactifs,
  // aucune matière robuste n'existe, donc aucune section.
  assert.equal(reading.sections.some((section) => section.id === "forces-tensions"), false);
  // Et la consigne interdit d'interpréter les aspects, encore inactifs.
  assert.match(contextes[0].socle.warnings.join(" "), /inactive/i);
});

test("une contradiction planète/signe déclenche une réécriture, jamais une livraison", async () => {
  const appels = [];
  const writerFn = (section) => {
    appels.push(section.id);
    if (section.id === "action" && appels.filter((id) => id === "action").length === 1) {
      // Exactement le type d'erreur relevée sur une vraie lecture.
      return "Ton Soleil, ta Lune et Mercure en Balance racontent autre chose. Tu avances avec diplomatie.";
    }
    return `Texte pour ${section.id}.`;
  };

  const reading = await createPublicReading(
    {
      firstName: "Test",
      language: "fr",
      birthDate: "1970-06-15",
      timePrecision: "unknown",
      resolvedPlace: {
        selectedName: "Paris, France",
        normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
      }
    },
    { writerFn, crossCheckFn: null }
  );

  // Le texte intégral n'est pas exposé dans la réponse publique : on contrôle
  // le document livré, celui que le client lit.
  assert.ok(reading.sections.some((section) => section.id === "action"));
  assert.doesNotMatch(reading.html, /Lune et Mercure en Balance/i);
  // Et la section a bien été réécrite, pas simplement amputée.
  assert.equal(appels.filter((id) => id === "action").length, 2);
});

test("un placeholder non rempli ne peut pas atteindre le client", async () => {
  const appels = [];
  const writerFn = (section) => {
    appels.push(section.id);
    if (section.id === "lettre-miroir" && appels.filter((id) => id === "lettre-miroir").length === 1) {
      // Exactement ce que le modèle a produit sur une vraie lecture.
      return "Cette lettre vous accompagne. Avec respect et espoir, [Votre prénom ou un mot symbolique]";
    }
    return `Texte pour ${section.id}.`;
  };

  const reading = await createPublicReading(
    {
      firstName: "Bassam",
      language: "fr",
      birthDate: "1970-06-15",
      timePrecision: "unknown",
      resolvedPlace: {
        selectedName: "Paris, France",
        normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
      }
    },
    { writerFn, crossCheckFn: null }
  );

  assert.doesNotMatch(reading.html, /\[Votre prénom/i);
  assert.doesNotMatch(reading.html, /mot symbolique/i);
  // La lettre a été réécrite, elle n'a pas simplement disparu.
  assert.equal(appels.filter((id) => id === "lettre-miroir").length, 2);
  assert.ok(reading.sections.some((section) => section.id === "lettre-miroir"));
});
