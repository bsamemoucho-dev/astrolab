const state = {
  user: null,
  dossier: null,
  config: null,
  currentView: "auth"
};

const titles = {
  auth: "Compte",
  express: "Lecture express",
  offre: "Offre & prix",
  profile: "Profil",
  people: "Personnes",
  relations: "Relations",
  natal: "Thème natal",
  analyses: "Analyses",
  history: "Historique",
  methods: "Méthodes",
  deliverables: "Dossier client",
  commerce: "Tarifs & crédits",
  admin: "Administration"
};

const relationshipLabels = {
  mother: "mère",
  father: "père",
  grandparent: "grand-parent",
  great_grandparent: "arrière-grand-parent",
  sibling: "frère/sœur",
  child: "enfant",
  partner: "partenaire",
  ex_partner: "ex-partenaire",
  friend: "ami",
  associate: "associé",
  other: "autre"
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function showMessage(text, isError = false) {
  const box = $("#message");
  box.textContent = text;
  box.hidden = false;
  box.classList.toggle("error", isError);
}

function asForm(target) {
  if (target?.tagName === "FORM") {
    return target;
  }
  const closestForm = target?.closest?.("form");
  if (closestForm?.tagName === "FORM") {
    return closestForm;
  }
  return null;
}

function formData(target) {
  const form = asForm(target);
  if (!form) {
    throw new Error("Formulaire introuvable pour cette action.");
  }
  return Object.fromEntries(new FormData(form).entries());
}

function formPayload(target) {
  const data = formData(target);
  if (data.resolvedPlace) {
    data.resolvedPlace = JSON.parse(data.resolvedPlace);
  }
  return data;
}

function field(form, name) {
  return form.elements.namedItem(name);
}

function captureFormValues(form) {
  return Object.fromEntries([...new FormData(form).entries()]);
}

function restoreFormValues(form, values) {
  for (const [name, value] of Object.entries(values)) {
    const input = field(form, name);
    if (input) {
      input.value = value;
    }
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error ?? "Erreur inconnue");
    Object.assign(error, payload);
    throw error;
  }
  return payload;
}

function personName(person) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "Sans nom";
}

function birthFor(personId) {
  return state.dossier?.birthData?.find((entry) => entry.personId === personId);
}

function placeDetails(place) {
  if (!place) {
    return "";
  }
  return `
    <article class="item">
      <div class="item-title">
        <span>${place.selectedName ?? place.name}</span>
        <span class="badge">${place.confidence ?? "non vérifié"}</span>
      </div>
      <div class="meta">Coordonnées utilisées : ${place.normalizedForCalculation.latitude}, ${place.normalizedForCalculation.longitude}</div>
      <div class="meta">Fuseau IANA : ${place.normalizedForCalculation.timeZone}</div>
      <div class="meta">Règle/fuseau : ${place.timezoneRule?.status ?? "non documenté"}</div>
      <div class="meta">Source : ${place.resolutionSource}</div>
    </article>
  `;
}

function showResolvedPlace(targetId, place) {
  const box = $(`#${targetId}`);
  box.innerHTML = placeDetails(place);
  box.hidden = false;
}

async function resolvePlaceForForm(form, detailsId, placeId = null, usePublic = false) {
  const payload = formPayload(form);
  const base = usePublic ? "/api/public/places" : "/api/places";
  try {
    const result = await api(`${base}/resolve`, {
      method: "POST",
      body: {
        query: payload.birthPlace,
        birthDate: payload.birthDate,
        placeId
      }
    });
    field(form, "resolvedPlace").value = JSON.stringify(result.place);
    field(form, "birthPlace").value = result.place.selectedName;
    showResolvedPlace(detailsId, result.place);
    showMessage("Lieu résolu et prêt pour le calcul.");
    return result.place;
  } catch (error) {
    if (error.matches?.length) {
      const box = $(`#${detailsId}`);
      box.innerHTML = error.matches
        .map(
          (place) => `
            <article class="item">
              <div class="item-title"><span>${place.name}</span><span class="badge">${place.timeZone}</span></div>
              <div class="meta">Sélection requise avant le calcul.</div>
              <button class="secondary" data-resolve-place-id="${place.id}" type="button">Sélectionner</button>
            </article>
          `
        )
        .join("");
      box.hidden = false;
      $all("[data-resolve-place-id]", box).forEach((button) => {
        button.addEventListener("click", async () => {
          await resolvePlaceForForm(form, detailsId, button.dataset.resolvePlaceId, usePublic);
        });
      });
      showMessage(error.message, true);
      return null;
    }
    showMessage(error.message, true);
    return null;
  }
}

async function ensureResolvedPlace(form, detailsId, usePublic = false) {
  if (field(form, "resolvedPlace").value) {
    return true;
  }
  if (!field(form, "birthPlace").value.trim()) {
    showMessage("Indiquez le lieu de naissance.", true);
    return false;
  }
  return Boolean(await resolvePlaceForForm(form, detailsId, null, usePublic));
}

function setView(name) {
  state.currentView = name;
  $all(".view").forEach((view) => view.classList.remove("active"));
  $(`#${name}-view`).classList.add("active");
  $all(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  $("#view-title").textContent = titles[name];
}

function updateNav() {
  const authenticated = Boolean(state.user);
  const isAdmin = state.user?.primaryRole === "admin";
  $all(".nav-button").forEach((button) => {
    if (
      button.dataset.view !== "auth" &&
      button.dataset.view !== "methods" &&
      button.dataset.view !== "offre" &&
      button.dataset.view !== "express"
    ) {
      button.disabled = !authenticated;
    }
    if (button.dataset.view === "admin") {
      button.disabled = !isAdmin;
    }
  });
  $all(".admin-only").forEach((element) => {
    element.hidden = !isAdmin;
  });
  $("#session-state").textContent = authenticated ? state.user.email : "Non connecté";
  $("#account-tools").hidden = !authenticated;
}

function formatMoney(amountCents, currency) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency
  }).format(amountCents / 100);
}

function renderPeople() {
  const list = $("#people-list");
  if (!state.dossier?.people?.length) {
    list.innerHTML = '<p class="hint">Aucune personne enregistrée.</p>';
    return;
  }

  list.innerHTML = state.dossier.people
    .map((person) => {
      const birth = birthFor(person.id);
      const birthMeta = birth
        ? `${birth.birthDate ?? "date inconnue"} · ${birth.placeName ?? "lieu inconnu"} · heure ${birth.timePrecision}`
        : "Aucune donnée de naissance enregistrée";
      const deleteButton = person.isPrimary
        ? ""
        : `<button class="danger" data-delete-person="${person.id}" type="button">Supprimer</button>`;
      return `
        <article class="item">
          <div class="item-title">
            <span>${personName(person)}</span>
            <span class="badge">${person.isPrimary ? "profil" : "lié"}</span>
          </div>
          <div class="meta">${birthMeta}</div>
          ${deleteButton}
        </article>
      `;
    })
    .join("");

  $all("[data-delete-person]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/people/${button.dataset.deletePerson}`, { method: "DELETE" });
      await refreshDossier();
      showMessage("Personne supprimée.");
    });
  });
}

function renderRelationshipOptions() {
  const people = state.dossier?.people ?? [];
  for (const select of $all("#relationship-form select[name='fromPersonId'], #relationship-form select[name='toPersonId']")) {
    select.innerHTML = people.map((person) => `<option value="${person.id}">${personName(person)}</option>`).join("");
  }
  const natalPerson = $("#natal-person");
  if (natalPerson) {
    natalPerson.innerHTML = people.map((person) => `<option value="${person.id}">${personName(person)}</option>`).join("");
  }
  const deliverablePerson = $("#deliverable-person");
  if (deliverablePerson) {
    const withBirth = people.filter((person) => birthFor(person.id));
    deliverablePerson.innerHTML = withBirth.length
      ? withBirth.map((person) => `<option value="${person.id}">${personName(person)}</option>`).join("")
      : '<option value="">Aucune personne avec données de naissance</option>';
  }
}

function renderRelationships() {
  const list = $("#relationship-list");
  const relationships = state.dossier?.relationships ?? [];
  if (!relationships.length) {
    list.innerHTML = '<p class="hint">Aucune relation enregistrée.</p>';
    return;
  }

  const peopleById = new Map(state.dossier.people.map((person) => [person.id, person]));
  list.innerHTML = relationships
    .map((relationship) => `
      <article class="item">
        <div class="item-title">
          <span>${personName(peopleById.get(relationship.fromPersonId))} -> ${personName(peopleById.get(relationship.toPersonId))}</span>
          <span class="badge">${relationshipLabels[relationship.type] ?? relationship.type}</span>
        </div>
        <div class="meta">Statut : ${relationship.status}</div>
        <button class="danger" data-delete-relationship="${relationship.id}" type="button">Supprimer</button>
      </article>
    `)
    .join("");

  $all("[data-delete-relationship]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/relationships/${button.dataset.deleteRelationship}`, { method: "DELETE" });
      await refreshDossier();
      showMessage("Relation supprimée.");
    });
  });
}

function renderHistory() {
  const list = $("#history-list");
  const history = state.dossier?.history ?? [];
  if (!history.length) {
    list.innerHTML = '<p class="hint">Aucune modification enregistrée.</p>';
    return;
  }

  list.innerHTML = history
    .map((entry) => `
      <article class="timeline-entry">
        <strong>${entry.action}</strong>
        <div class="meta">${new Date(entry.createdAt).toLocaleString("fr-FR")} · ${entry.subjectType}</div>
      </article>
    `)
    .join("");
}

function renderAnalyses(analyses = state.dossier?.analyses ?? []) {
  const list = $("#analysis-list");
  if (!analyses.length) {
    list.innerHTML = '<p class="hint">Aucune analyse enregistrée.</p>';
    return;
  }

  list.innerHTML = analyses
    .map((analysis) => {
      const version = analysis.versions?.[0];
      const createdAt = new Date(analysis.createdAt).toLocaleString("fr-FR");
      const versionMeta = version ? `Version ${version.id} · ${version.methodVersionIds.length} méthode(s)` : "Aucune version";
      return `
        <article class="item">
          <div class="item-title">
            <span>${analysis.scope}</span>
            <span class="badge">${analysis.status}</span>
          </div>
          <div class="meta">${createdAt}</div>
          <div class="meta">${versionMeta}</div>
          ${(analysis.methodResults ?? [])
            .map((result) => `<div class="meta">${result.methodId} : ${result.status}</div>`)
            .join("")}
          ${(analysis.reports ?? [])
            .map(
              (report) => `
                <div class="report-preview">
                  <div class="item-title">
                    <span>Rapport ${report.id}</span>
                    <span class="badge">${report.status}</span>
                  </div>
                  ${report.sections.map((section) => `<div class="meta"><strong>${section.title}</strong> · ${section.body}</div>`).join("")}
                </div>
              `
            )
            .join("")}
          <button class="secondary" data-create-report="${analysis.id}" type="button">Générer rapport</button>
        </article>
      `;
    })
    .join("");

  $all("[data-create-report]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/api/analyses/${button.dataset.createReport}/reports`, { method: "POST" });
        await refreshAnalyses();
        showMessage("Rapport contrôlé créé.");
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  });
}

async function refreshAnalyses() {
  const { analyses } = await api("/api/analyses");
  const detailed = await Promise.all(
    analyses.map(async (analysis) => {
      const detail = await api(`/api/analyses/${analysis.id}`);
      const { reports } = await api(`/api/analyses/${analysis.id}/reports`);
      return { ...detail, reports };
    })
  );
  renderAnalyses(detailed);
}

async function renderMethods() {
  const { methods } = await api("/api/methods");
  $("#method-list").innerHTML = methods
    .map((method) => `
      <article class="item">
        <div class="item-title">
          <span>${method.name}</span>
          <span class="badge">${method.status}</span>
        </div>
        <div class="meta">${method.tradition} · production : ${method.productionEligible ? "oui" : "non"}</div>
        <div class="meta">${method.notes}</div>
      </article>
    `)
    .join("");
}

async function renderCommerce() {
  const summary = await api("/api/commerce");
  $("#credit-balance").textContent = summary.balance;
  $("#plan-list").innerHTML = summary.plans
    .map(
      (plan) => `
        <article class="item">
          <div class="item-title">
            <span>${plan.name}</span>
            <span class="badge">${plan.credits} crédits</span>
          </div>
          <div class="meta">${formatMoney(plan.amountCents, plan.currency)} · paiement réel non connecté</div>
          <button data-buy-plan="${plan.id}" type="button">Créditer en développement</button>
        </article>
      `
    )
    .join("");

  $("#credit-ledger").innerHTML = summary.ledger.length
    ? summary.ledger
        .map(
          (entry) => `
            <article class="timeline-entry">
              <strong>${entry.delta > 0 ? "+" : ""}${entry.delta} crédit(s)</strong>
              <div class="meta">${entry.reason} · ${new Date(entry.createdAt).toLocaleString("fr-FR")}</div>
            </article>
          `
        )
        .join("")
    : '<p class="hint">Aucune écriture de crédit.</p>';

  $all("[data-buy-plan]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api("/api/commerce/dev-credit-order", {
          method: "POST",
          body: { planId: button.dataset.buyPlan }
        });
        await renderCommerce();
        showMessage("Crédits de développement ajoutés.");
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  });
}

async function renderAdmin() {
  const [summary, audit] = await Promise.all([api("/api/admin/summary"), api("/api/admin/audit?limit=25")]);
  $("#admin-counts").innerHTML = Object.entries(summary.counts)
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");

  $("#admin-users").innerHTML = summary.users.length
    ? summary.users
        .map(
          (user) => `
            <article class="item">
              <div class="item-title">
                <span>${user.email}</span>
                <span class="badge">${user.primaryRole}</span>
              </div>
              <div class="meta">Créé : ${new Date(user.createdAt).toLocaleString("fr-FR")}</div>
              <div class="meta">Statut : ${user.deletedAt ? "supprimé" : "actif"}</div>
            </article>
          `
        )
        .join("")
    : '<p class="hint">Aucun utilisateur.</p>';

  $("#admin-audit").innerHTML = audit.auditLogs.length
    ? audit.auditLogs
        .map(
          (entry) => `
            <article class="timeline-entry">
              <strong>${entry.action}</strong>
              <div class="meta">${entry.subjectType} · ${entry.subjectId}</div>
              <div class="meta">${new Date(entry.createdAt).toLocaleString("fr-FR")} · propriétaire ${entry.ownerUserId}</div>
            </article>
          `
        )
        .join("")
    : '<p class="hint">Aucun log.</p>';
}

function fillProfileForm() {
  const primary = state.dossier?.people?.find((person) => person.isPrimary);
  if (!primary) {
    return;
  }
  const birth = birthFor(primary.id) ?? {};
  const form = $("#profile-form");
  field(form, "firstName").value = primary.firstName ?? "";
  field(form, "lastName").value = primary.lastName ?? "";
  field(form, "birthName").value = primary.birthName ?? "";
  field(form, "birthDate").value = birth.birthDate ?? "";
  field(form, "birthPlace").value = birth.placeName ?? "";
  field(form, "country").value = birth.country ?? "";
  field(form, "resolvedPlace").value = birth.resolvedPlace ? JSON.stringify(birth.resolvedPlace) : "";
  if (birth.resolvedPlace) {
    showResolvedPlace("profile-place-details", birth.resolvedPlace);
  }
  field(form, "timePrecision").value = birth.timePrecision ?? "unknown";
  field(form, "timeValue").value = birth.timeValue ?? "";
  field(form, "timeStart").value = birth.timeStart ?? "";
  field(form, "timeEnd").value = birth.timeEnd ?? "";
}

function fillNatalForm() {
  const form = $("#natal-form");
  if (!form || !state.dossier?.people?.length) {
    return;
  }
  const selectedPersonId = field(form, "personId").value || state.dossier.people.find((person) => person.isPrimary)?.id || state.dossier.people[0].id;
  field(form, "personId").value = selectedPersonId;
  const birth = birthFor(selectedPersonId) ?? {};
  field(form, "birthDate").value = birth.birthDate ?? "";
  field(form, "timeValue").value = birth.timeValue ?? "";
  field(form, "timeStart").value = birth.timeStart ?? "";
  field(form, "timeEnd").value = birth.timeEnd ?? "";
  field(form, "timePrecision").value = birth.timePrecision ?? "unknown";
  field(form, "birthPlace").value = birth.placeName ?? "";
  field(form, "resolvedPlace").value = birth.resolvedPlace ? JSON.stringify(birth.resolvedPlace) : "";
  if (birth.resolvedPlace) {
    showResolvedPlace("natal-place-details", birth.resolvedPlace);
  }
}

const NATAL_BODY_LABELS = {
  Sun: "☉ Soleil",
  Moon: "☽ Lune",
  Mercury: "☿ Mercure",
  Venus: "♀ Vénus",
  Mars: "♂ Mars",
  Jupiter: "♃ Jupiter",
  Saturn: "♄ Saturne"
};

const NATAL_SIGN_FR = {
  Aries: "Bélier",
  Taurus: "Taureau",
  Gemini: "Gémeaux",
  Cancer: "Cancer",
  Leo: "Lion",
  Virgo: "Vierge",
  Libra: "Balance",
  Scorpio: "Scorpion",
  Sagittarius: "Sagittaire",
  Capricorn: "Capricorne",
  Aquarius: "Verseau",
  Pisces: "Poissons"
};

function frSignName(sign) {
  return NATAL_SIGN_FR[sign] ?? sign;
}

function formatDegrees(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  const integer = Math.floor(Number(value));
  const minutes = Math.round((Number(value) - integer) * 60);
  return `${integer}°${String(Math.min(minutes, 59)).padStart(2, "0")}′`;
}

function natalHouseFor(body, houses) {
  if (!Array.isArray(houses) || houses.length === 0 || body.signIndex === null || body.signIndex === undefined) {
    return null;
  }
  const house = houses.find((entry) => entry.signIndex === body.signIndex);
  return house?.houseNumber ?? null;
}

function natalAspectList(result) {
  const infrastructure = result.structuralAstrology?.aspectInfrastructure;
  if (!Array.isArray(infrastructure)) {
    return [];
  }
  return infrastructure
    .map((pair) => {
      const best = pair.candidates?.[0] ?? null;
      return {
        label: `${NATAL_BODY_LABELS[pair.bodyA] ?? pair.bodyA} – ${NATAL_BODY_LABELS[pair.bodyB] ?? pair.bodyB}`,
        distance: pair.angularDistance,
        type: best?.type ?? null,
        exactness: best?.exactness ?? null
      };
    })
    .sort((first, second) => (first.exactness ?? 999) - (second.exactness ?? 999))
    .slice(0, 8);
}

function natalTimeDescription(norm) {
  const precision = norm.timePrecision;
  if (precision === "exact") {
    return `Heure de naissance : ${norm.timeValue} (exacte)`;
  }
  if (precision === "approximate") {
    return `Heure de naissance : ${norm.timeValue} (approximative — Ascendant et maisons sensibles à l'incertitude)`;
  }
  if (precision === "interval") {
    return `Heure de naissance : intervalle ${norm.timeStart} – ${norm.timeEnd} (aucune heure exacte inventée)`;
  }
  return "Heure de naissance : inconnue (l'Ascendant, les maisons et la secte n'ont pas été calculés)";
}

const ZODIAC_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const PLANET_GLYPHS = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄"
};

function polar(cx, cy, radius, degrees) {
  const angle = (Math.PI * degrees) / 180;
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
}

function natalChartSvg(result) {
  const size = 460;
  const c = size / 2;
  const outer = 204;
  const ring = 158;
  const planetR = 118;
  const bodies = Array.isArray(result.astronomicalCalculation?.bodies) ? result.astronomicalCalculation.bodies : [];
  const angles = result.astronomicalCalculation?.angles ?? {};
  const parts = [];

  parts.push(`<svg class="chart-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Carte du ciel">`);
  parts.push(`<defs>
    <radialGradient id="wheelBg" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1eefb"/>
    </radialGradient>
  </defs>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="${outer + 8}" fill="url(#wheelBg)" stroke="#e0dcf2"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="${ring}" fill="none" stroke="#cfc9ea" stroke-width="1.4"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="${planetR}" fill="none" stroke="#e5e1f4" stroke-width="1"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="${48}" fill="#faf9ff" stroke="#e0dcf2"/>`);

  // 12 secteurs de signes
  for (let index = 0; index < 12; index += 1) {
    const startDeg = index * 30;
    const endDeg = startDeg + 30;
    const a = polar(c, c, ring, startDeg);
    const b = polar(c, c, outer, startDeg);
    const d = polar(c, c, outer, endDeg);
    const e = polar(c, c, ring, endDeg);
    const fill = index % 2 === 0 ? "rgba(255,255,255,0.9)" : "rgba(244,242,253,0.9)";
    const large = 0;
    parts.push(
      `<path d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)} A ${outer} ${outer} 0 ${large} 1 ${d.x.toFixed(1)} ${d.y.toFixed(1)} L ${e.x.toFixed(1)} ${e.y.toFixed(1)} A ${ring} ${ring} 0 ${large} 0 ${a.x.toFixed(1)} ${a.y.toFixed(1)} Z" fill="${fill}" stroke="#e6e2f5" stroke-width="0.8"/>`
    );
    const midDeg = startDeg + 15;
    const label = polar(c, c, (outer + ring) / 2 + 2, midDeg);
    parts.push(`<text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="15" fill="#6d7190">${ZODIAC_GLYPHS[index]}</text>`);
  }

  // limites de signes + repère de longitude
  for (let index = 0; index < 12; index += 1) {
    const deg = index * 30;
    const a = polar(c, c, ring, deg);
    const b = polar(c, c, outer, deg);
    parts.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#dcd7f0" stroke-width="0.8"/>`);
  }

  // planètes (uniquement si longitude calculée)
  for (const body of bodies) {
    if (body.longitude === null || body.longitude === undefined || Number.isNaN(Number(body.longitude))) {
      continue;
    }
    const glyph = PLANET_GLYPHS[body.body] ?? "•";
    const p = polar(c, c, planetR, body.longitude);
    parts.push(`<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="17" fill="#23265e" font-weight="700">${glyph}</text>`);
  }

  // angles
  const drawAngle = (label, longitude, color) => {
    const inner = polar(c, c, planetR, longitude);
    const outerP = polar(c, c, outer, longitude);
    parts.push(`<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outerP.x.toFixed(1)}" y2="${outerP.y.toFixed(1)}" stroke="${color}" stroke-width="2"/>`);
    const pos = polar(c, c, outer + 18, longitude);
    const rotate = longitude > 90 && longitude < 270 ? longitude + 180 : longitude;
    parts.push(`<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="800" fill="${color}" transform="rotate(${rotate} ${pos.x.toFixed(1)} ${pos.y.toFixed(1)})">${label}</text>`);
  };
  if (angles.ascendant?.longitude !== undefined && angles.ascendant?.longitude !== null) {
    drawAngle("ASC", angles.ascendant.longitude, "#4b3ac4");
  }
  if (angles.midheaven?.longitude !== undefined && angles.midheaven?.longitude !== null) {
    drawAngle("MC", angles.midheaven.longitude, "#c2850f");
  }

  parts.push(`<text x="${c}" y="${c - 4}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="#6d7190">♁</text>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}

function renderNatalResult(payload) {
  const result = payload.result;
  const norm = result.normalizedInput ?? {};
  const bodies = Array.isArray(result.astronomicalCalculation?.bodies) ? result.astronomicalCalculation.bodies : [];
  const angles = result.astronomicalCalculation?.angles ?? {};
  const rawHouses = result.structuralAstrology?.houses;
  const houses = Array.isArray(rawHouses) ? rawHouses : rawHouses?.houses ?? [];
  const sect = result.structuralAstrology?.sect;
  const person = state.dossier?.people?.find((entry) => entry.id === norm.personId);

  const placeLine = [norm.placeName, norm.country].filter(Boolean).join(", ");
  const aspects = natalAspectList(result);
  const bodiesRows = bodies
    .map((body) => {
      const label = NATAL_BODY_LABELS[body.body] ?? body.body;
      const sign = body.sign
        ? `${frSignName(body.sign)} ${formatDegrees(body.degreeInSign)}`
        : body.signRange
          ? `${frSignName(body.signRange.start)} → ${frSignName(body.signRange.end)}`
          : "position du jour";
      const house = natalHouseFor(body, houses);
      const retro = body.apparentMotion?.retrograde ? " · rétrograde" : "";
      return `<div class="chart-row"><span class="chart-label">${label}</span><strong>${sign}</strong><span class="chart-side">${house ? `maison ${house}` : "—"}${retro}</span></div>`;
    })
    .join("");

  const angleRows = angles.ascendant
    ? [
        `<div class="chart-row"><span class="chart-label">Ascendant</span><strong>${frSignName(angles.ascendant.sign)} ${formatDegrees(angles.ascendant.degreeInSign)}</strong><span class="chart-side">maison 1</span></div>`,
        `<div class="chart-row"><span class="chart-label">Milieu du Ciel</span><strong>${frSignName(angles.midheaven.sign)} ${formatDegrees(angles.midheaven.degreeInSign)}</strong></div>`,
        ...(sect?.chartSect
          ? [`<div class="chart-row"><span class="chart-label">Secte</span><strong>${sect.chartSect === "diurnal" ? "diurne (Soleil au-dessus de l'horizon)" : "nocturne"}</strong></div>`]
          : [])
      ].join("")
    : '<p class="hint">Heure inconnue ou intervalle : l’Ascendant et le Milieu du Ciel n’ont pas été calculés. Le reste du thème du jour reste valable en tendance.</p>';

  const aspectRows = aspects.length
    ? aspects
        .map(
          (aspect) =>
            `<div class="chart-row"><span class="chart-label">${aspect.label}</span><strong>${aspect.distance.toFixed(1)}°</strong><span class="chart-side">proche de : ${aspect.type} (écart ${aspect.exactness.toFixed(1)}°)</span></div>`
        )
        .join("")
    : '<p class="hint">Distances angulaires indisponibles (temps non précis).</p>';

  $("#natal-summary").innerHTML = `
    <article class="item hero-result">
      <div class="item-title">
        <span>${person ? personName(person) : "Thème"}</span>
        <span class="badge badge-ok">Calcul vérifié</span>
      </div>
      <div class="meta">${norm.birthDate} · ${placeLine || "lieu non précisé"} · ${natalTimeDescription(norm)}</div>
      <div class="meta">Fuseau ${norm.timeZone} · zodiaque tropical · maisons Whole Sign</div>
    </article>

    <article class="item chart-card">
      <div class="item-title"><span>Carte du ciel</span><span class="badge">tropical · Whole Sign</span></div>
      ${natalChartSvg(result)}
      <p class="hint">Tracé calculé d'après les longitudes vérifiées. ${angles.ascendant ? "" : "Heure inconnue : les planètes du jour sont indiquées sans Ascendant ni Milieu du Ciel."}</p>
    </article>

    <article class="item">
      <div class="item-title"><span>Planètes et points</span><span class="badge">${bodies.length + (angles.ascendant ? 2 : 0)}</span></div>
      ${bodiesRows}
      ${angleRows}
    </article>

    <article class="item">
      <div class="item-title"><span>Distances angulaires les plus proches d’un aspect</span><span class="badge">${aspects.length}</span></div>
      ${aspectRows}
      <p class="hint">Distances calculées, classées par proximité. Aucune règle d’orbe n’est encore activée : ce ne sont pas encore des « aspects validés ».</p>
    </article>

    <article class="note note-accent">
      <strong>Et l’interprétation ?</strong>
      <span>Le moteur calcule et vérifie ; il ne décide pas encore ce qui est « important » (aucune règle documentée validée). Pour une lecture complète et rédigée, ouvrez l’onglet <strong>Dossier client</strong> : il utilise ces mêmes données vérifiées comme socle.</span>
    </article>

    <article class="item tech-meta">
      <div class="item-title"><span>Référence du calcul</span><span class="badge">${result.methodVersion}</span></div>
      <div class="meta">Run : ${payload.calculationRun.id}</div>
      <div class="meta">Hachage du résultat : ${payload.calculationRun.resultHash}</div>
      <div class="meta">UTC : ${result.time?.utc ?? "—"}</div>
    </article>
  `;
  $("#natal-json").textContent = JSON.stringify(payload, null, 2);
}

function renderDossier() {
  fillProfileForm();
  renderPeople();
  renderRelationshipOptions();
  fillNatalForm();
  renderRelationships();
  renderHistory();
}

function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

const deliverableStatusLabels = {
  ready_for_human_review: "prêt pour relecture",
  needs_review: "à vérifier",
  template_draft: "brouillon sans rédacteur IA",
  generating: "en cours…",
  failed: "échec",
  generated: "généré"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setDeliverableProgress(progress) {
  const panel = $("#deliverable-progress");
  const percent = progress
    ? Math.min(99, Math.round((progress.completedSteps / Math.max(1, progress.totalSteps)) * 100))
    : 0;
  $("#deliverable-progress-percent").textContent = `${percent} %`;
  $("#deliverable-progress-bar").style.width = `${percent}%`;
  $("#deliverable-progress-section").textContent = progress?.currentSection
    ? `Rédaction en cours : ${progress.currentSection.title}`
    : "Génération en cours…";
  panel.hidden = false;
}

async function pollDeliverableGeneration(id) {
  const maxAttempts = 90; // ~4 min à 2,5 s par essai
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const payload = await api(`/api/deliverables/${id}`);
    const status = payload.deliverable.status;
    if (status === "generating") {
      setDeliverableProgress(payload.deliverable.progress);
      await sleep(2500);
      continue;
    }
    return payload;
  }
  throw new Error("La génération a dépassé le temps d'attente. Vérifiez la liste des dossiers.");
}

function deliverableStatusLabel(status) {
  return deliverableStatusLabels[status] ?? status;
}

function fillDeliverablePersonSelect() {
  const people = state.dossier?.people ?? [];
  const withBirth = people.filter((person) => birthFor(person.id));
  const select = $("#deliverable-person");
  if (!select) {
    return;
  }
  select.innerHTML = withBirth.length
    ? withBirth.map((person) => `<option value="${person.id}">${personName(person)}</option>`).join("")
    : '<option value="">Aucune personne avec données de naissance</option>';
}

function renderDeliverables(deliverables) {
  const list = $("#deliverable-list");
  if (!deliverables.length) {
    list.innerHTML = '<p class="hint">Aucun dossier généré. Renseignez une personne avec sa naissance, puis générez.</p>';
    return;
  }

  list.innerHTML = deliverables
    .map((deliverable) => {
      const statusBadges = [
        `<span class="badge">${deliverableStatusLabel(deliverable.status)}</span>`,
        deliverable.reviewedByHuman ? '<span class="badge badge-ok">relu ✓</span>' : ""
      ].join(" ");
      const costLine =
        deliverable.costEstimate && deliverable.writerMode === "llm"
          ? ` · IA ≈ ${deliverable.costEstimate.usd.toFixed(4)}$ (${deliverable.costEstimate.totalTokens} tokens)`
          : deliverable.writerMode === "template"
            ? " · brouillon (socle local)"
            : "";
      const progressPart =
        deliverable.status === "generating" && deliverable.progress
          ? ` · ${Math.round((deliverable.progress.completedSteps / Math.max(1, deliverable.progress.totalSteps)) * 100)} %`
          : "";
      return `
      <article class="item">
        <div class="item-title">
          <span>${deliverable.title ?? deliverable.personLabel}</span>
          <span class="badge-row">${statusBadges}</span>
        </div>
        <div class="meta">${new Date(deliverable.createdAt).toLocaleString("fr-FR")} · ${deliverable.personLabel}${costLine}${progressPart}</div>
        <div class="split-actions">
          <button type="button" data-open-deliverable="${deliverable.id}">Ouvrir</button>
          <button class="secondary" type="button" data-download-deliverable="${deliverable.id}" data-format="html">HTML</button>
          <button class="secondary" type="button" data-download-deliverable="${deliverable.id}" data-format="md">Markdown</button>
          <button class="secondary" type="button" data-pdf-deliverable="${deliverable.id}">PDF</button>
          <button class="danger" type="button" data-delete-deliverable="${deliverable.id}">Supprimer</button>
        </div>
      </article>
    `;
    })
    .join("");

  $all("[data-open-deliverable]").forEach((button) => {
    button.addEventListener("click", () => openDeliverable(button.dataset.openDeliverable));
  });
  $all("[data-download-deliverable]").forEach((button) => {
    button.addEventListener("click", () => downloadDeliverable(button.dataset.downloadDeliverable, button.dataset.format));
  });
  $all("[data-pdf-deliverable]").forEach((button) => {
    button.addEventListener("click", () => exportDeliverablePdf(button.dataset.pdfDeliverable));
  });
  $all("[data-delete-deliverable]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Supprimer ce dossier ?")) {
        return;
      }
      await api(`/api/deliverables/${button.dataset.deleteDeliverable}`, { method: "DELETE" });
      await refreshDeliverables();
      showMessage("Dossier supprimé.");
    });
  });
}

async function refreshDeliverables() {
  if (!state.user) {
    return;
  }
  fillDeliverablePersonSelect();
  const payload = await api("/api/deliverables");
  renderDeliverables(payload.deliverables);
}

async function exportDeliverablePdf(id) {
  const response = await fetch(`/api/deliverables/${id}/export?format=html`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Export PDF impossible.");
  }
  const html = await response.text();
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    throw new Error("Autorisez les fenêtres pop-up pour exporter en PDF.");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
  showMessage("Choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.");
}

async function toggleDeliverableReview() {
  const id = state.activeDeliverableId;
  if (!id) {
    return;
  }
  const current = await api(`/api/deliverables/${id}`);
  const markReviewed = !current.deliverable.reviewedByHuman;
  const note = markReviewed ? window.prompt("Note de relecture (facultatif) :") ?? "" : "";
  const result = await api(`/api/deliverables/${id}/review`, {
    method: "PATCH",
    body: { reviewed: markReviewed, note }
  });
  await refreshDeliverables();
  await openDeliverable(id);
  showMessage(
    result.deliverable.reviewedByHuman
      ? "Dossier marqué comme relu (prêt pour livraison)."
      : "Relecture retirée."
  );
}

async function openDeliverable(id) {
  const payload = await api(`/api/deliverables/${id}`);
  const deliverable = payload.deliverable;
  const viewer = $("#deliverable-viewer");
  viewer.hidden = false;
  const reviewState = deliverable.reviewedByHuman ? " · relu ✓" : "";
  $("#deliverable-viewer-title").textContent = `Dossier — ${deliverable.personLabel}${reviewState}`;
  const reviewButton = $("#review-deliverable-button");
  if (reviewButton) {
    reviewButton.disabled = deliverable.status === "generating" || deliverable.status === "failed";
    reviewButton.textContent = deliverable.reviewedByHuman ? "Retirer « relu »" : "Marquer comme relu";
  }
  const cost = deliverable.costEstimate ? ` · IA ≈ ${deliverable.costEstimate.usd.toFixed(4)}$` : "";
  $("#deliverable-viewer-status").textContent = `${deliverableStatusLabel(deliverable.status)}${cost}`;
  $("#deliverable-frame").srcdoc = "";
  state.activeDeliverableId = id;

  if (deliverable.status === "generating") {
    $("#deliverable-frame").srcdoc =
      "<html><body style='font-family:sans-serif;display:grid;place-items:center;height:100vh;color:#444'><div style='text-align:center'><p style='font-size:1.4rem'>⏳ Génération en cours…</p><p>La barre de progression sous le bouton indique l'avancement.</p></div></body></html>";
    return;
  }
  if (deliverable.status === "failed") {
    $("#deliverable-frame").srcdoc =
      "<html><body style='font-family:sans-serif;display:grid;place-items:center;height:100vh;color:#c0392b'><p>⚠️ La génération a échoué : " +
      escapeHtml(deliverable.error ?? "") +
      "</p></body></html>";
    return;
  }
  const response = await fetch(`/api/deliverables/${id}/export?format=html`);
  const html = await response.text();
  $("#deliverable-frame").srcdoc = html;
}

async function downloadDeliverable(id, format) {
  const extension = format === "md" ? "md" : "html";
  const response = await fetch(`/api/deliverables/${id}/export?format=${extension}`);
  const text = await response.text();
  const blob = new Blob([text], { type: extension === "md" ? "text/markdown" : "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dossier-${id}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}

function deliverableParentsFromForm(form) {
  const parents = [];
  const read = (role, prefix) => {
    const label = field(form, `${prefix}Name`)?.value.trim() ?? "";
    const birthDate = field(form, `${prefix}BirthDate`)?.value ?? "";
    const birthPlace = field(form, `${prefix}BirthPlace`)?.value.trim() ?? "";
    if (label || birthDate || birthPlace) {
      parents.push({
        role,
        label: label || null,
        birthDate: birthDate || null,
        birthPlace: birthPlace || null
      });
    }
  };
  read("mother", "mother");
  read("father", "father");
  return parents;
}

function bindPriceSlider() {
  const slider = $("#price-slider");
  if (!slider) {
    return;
  }
  const amountEl = $("#price-amount");
  const tierEl = $("#price-tier");
  const splitEl = $("#price-split");
  const confirmBox = $("#price-confirm");
  const confirmText = $("#price-confirm-text");
  const resultEl = $("#price-result");
  const chips = $all("#price-chips .chip");
  const shareChips = $all("#share-chips .chip");
  const PRICE_TIERS = [
    [500, "Légende du ciel — merci infini 💫"],
    [100, "Soutien précieux 💜"],
    [30, "Grand merci ✨"],
    [10, "Merci pour votre confiance 🙏"],
    [1, "Merci d'être là 💫"]
  ];
  let pendingPrice = null;

  const format = (value) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

  const activeShare = () => Number(shareChips.find((chip) => chip.classList.contains("active"))?.dataset.share ?? 0);

  function refresh() {
    const value = Number(slider.value);
    amountEl.textContent = format(value);
    for (const chip of chips) {
      chip.classList.toggle("active", Number(chip.dataset.price) === value);
    }
    const tier = PRICE_TIERS.find(([threshold]) => value >= threshold)?.[1] ?? "Merci d'être là 💫";
    tierEl.textContent = tier;
    updateSplit(value);
  }

  function updateSplit(value) {
    const share = activeShare();
    const authorPortion = Math.round((value * (100 - share)) / 100);
    const associationPortion = value - authorPortion;
    if (share === 0) {
      splitEl.textContent = `Intégralité pour votre lecture : ${format(authorPortion)}.`;
    } else {
      splitEl.textContent = `Répartition : ${format(authorPortion)} pour votre lecture · ${format(associationPortion)} reversé à l'association (maximum 50 %).`;
    }
  }

  function finish(value) {
    confirmBox.hidden = true;
    const share = activeShare();
    const authorPortion = Math.round((value * (100 - share)) / 100);
    const associationPortion = value - authorPortion;
    const tier = PRICE_TIERS.find(([threshold]) => value >= threshold)?.[1] ?? "Merci d'être là 💫";
    const lines = [
      `Choix enregistré (démo) : ${format(value)} pour votre lecture — ${tier}`,
      associationPortion > 0 ? `Dont ${format(associationPortion)} reversé à l'association (max 50 %).` : ""
    ];
    resultEl.textContent = lines.filter(Boolean).join(" ");
    showMessage(
      associationPortion > 0
        ? `Démo : merci pour ${format(authorPortion)} — ${format(associationPortion)} ira à l'association.`
        : `Démo : merci pour ${format(authorPortion)} — ${tier}`
    );
  }

  slider.addEventListener("input", () => {
    confirmBox.hidden = true;
    refresh();
  });

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      slider.value = chip.dataset.price;
      confirmBox.hidden = true;
      refresh();
    });
  }
  for (const chip of shareChips) {
    chip.addEventListener("click", () => {
      for (const other of shareChips) {
        other.classList.toggle("active", other === chip);
      }
      refresh();
    });
  }

  $("#price-validate").addEventListener("click", () => {
    if (!confirmBox.hidden) {
      return;
    }
    const value = Number(slider.value);
    resultEl.textContent = "";
    if (value > 100) {
      pendingPrice = value;
      confirmText.textContent = `Vous êtes sur le point de choisir ${format(value)} pour votre lecture. C'est un montant élevé : confirmez-vous ?`;
      confirmBox.hidden = false;
      return;
    }
    finish(value);
  });

  $("#price-confirm-yes").addEventListener("click", () => {
    if (pendingPrice !== null) {
      finish(pendingPrice);
      pendingPrice = null;
    }
  });

  $("#price-confirm-no").addEventListener("click", () => {
    confirmBox.hidden = true;
    pendingPrice = null;
  });

  $("#price-reset").addEventListener("click", () => {
    slider.value = 10;
    pendingPrice = null;
    confirmBox.hidden = true;
    resultEl.textContent = "";
    for (const chip of shareChips) {
      chip.classList.toggle("active", Number(chip.dataset.share) === 0);
    }
    refresh();
  });

  refresh();
}

async function refreshDossier() {
  if (!state.user) {
    state.dossier = null;
    updateNav();
    return;
  }
  state.dossier = await api("/api/me");
  renderDossier();
  updateNav();
}

function printHtmlInWindow(html) {
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    throw new Error("Autorisez les fenêtres pop-up pour imprimer/enregistrer en PDF.");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
}

function applyGuestLayout() {
  const guest = !state.user;
  document.body.classList.toggle("guest", guest);
  const hero = $("#guest-hero");
  if (hero) {
    hero.hidden = !guest;
  }
  return guest;
}

function bindExpressForm() {
  const form = $("#express-form");
  if (!form) {
    return;
  }
  $("#express-resolve-place").addEventListener("click", () => {
    resolvePlaceForForm(form, "express-place-details", null, true);
  });
  field(form, "birthPlace").addEventListener("input", () => {
    field(form, "resolvedPlace").value = "";
    $("#express-place-details").hidden = true;
  });

  const precisionSelect = field(form, "timePrecision");
  const timeWrap = $("#express-time-label");
  const intervalWrap = $("#express-interval-fields");
  const syncTimeVisibility = () => {
    const value = precisionSelect.value;
    timeWrap.hidden = !(value === "exact" || value === "approximate");
    intervalWrap.hidden = value !== "interval";
  };
  precisionSelect.addEventListener("change", syncTimeVisibility);
  syncTimeVisibility();

  $("#guest-pro-link")?.addEventListener("click", () => {
    document.body.classList.remove("guest");
    const hero = $("#guest-hero");
    if (hero) {
      hero.hidden = true;
    }
    setView("auth");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const originalLabel = submitButton.textContent;
    try {
      if (!(await ensureResolvedPlace(form, "express-place-details", true))) {
        return;
      }
      const payload = formPayload(form);
      const body = {
        firstName: payload.firstName || null,
        birthDate: payload.birthDate,
        timePrecision: payload.timePrecision ?? "unknown",
        timeValue: payload.timeValue || null,
        timeStart: payload.timeStart || null,
        timeEnd: payload.timeEnd || null,
        birthPlace: payload.birthPlace || null,
        resolvedPlace: payload.resolvedPlace ?? null,
        intention: payload.intention || null,
        parents: deliverableParentsFromForm(form)
      };
      submitButton.disabled = true;
      submitButton.textContent = "Génération en cours… (1 à 2 min)";
      $("#express-progress").hidden = false;
      const paymentPanel = $("#express-payment");
      if (paymentPanel) {
        paymentPanel.hidden = false;
      }
      showMessage("Calcul du socle puis rédaction des sections… veuillez patienter (1 à 2 minutes).");

      const reading = await api("/api/public/readings", { method: "POST", body });
      state.guestReading = { html: reading.html, markdown: reading.markdown };
      $("#express-viewer").hidden = false;
      $("#express-frame").srcdoc = reading.html;
      $("#express-progress").hidden = true;
      showMessage(
        reading.writerMode === "llm"
          ? "Lecture prête — téléchargez-la ou imprimez-la, rien n'a été enregistré."
          : "Lecture générée en brouillon technique (socle vérifié complet)."
      );
    } catch (error) {
      $("#express-progress").hidden = true;
      showMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  });

  $("#guest-download-html").addEventListener("click", () => {
    if (!state.guestReading) return;
    const blob = new Blob([state.guestReading.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lecture-astrologique.html";
    link.click();
    URL.revokeObjectURL(url);
  });
  $("#guest-download-md").addEventListener("click", () => {
    if (!state.guestReading) return;
    const blob = new Blob([state.guestReading.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lecture-astrologique.md";
    link.click();
    URL.revokeObjectURL(url);
  });
  $("#guest-download-pdf").addEventListener("click", () => {
    if (!state.guestReading) return;
    try {
      printHtmlInWindow(state.guestReading.html);
      showMessage("Choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });
}

function bindForms() {
  bindPriceSlider();
  bindExpressForm();
  $("#register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/auth/register", { method: "POST", body: formData(event.currentTarget) });
      $("#verify-form").email.value = result.user.email;
      showMessage(`Compte créé. Code de vérification développement : ${result.devVerificationCode}`);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#verify-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/auth/verify", { method: "POST", body: formData(event.currentTarget) });
      showMessage("E-mail vérifié. Vous pouvez vous connecter.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/auth/login", { method: "POST", body: formData(event.currentTarget) });
      state.user = result.user;
      applyGuestLayout();
      await refreshDossier();
      setView("profile");
      showMessage("Connexion réussie.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#logout-button").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    state.user = null;
    state.dossier = null;
    updateNav();
    applyGuestLayout();
    setView("express");
    showMessage("Déconnecté. Vous repartez sur la lecture simple.");
  });

  $("#export-account-button").addEventListener("click", async () => {
    try {
      const payload = await api("/api/me/export");
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`astrolab-export-${date}.json`, payload);
      showMessage("Export préparé.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#delete-account-button").addEventListener("click", async () => {
    if (!confirm("Supprimer ce compte ? Cette action ferme les sessions et bloque les accès futurs.")) {
      return;
    }

    try {
      await api("/api/me", { method: "DELETE" });
      state.user = null;
      state.dossier = null;
      updateNav();
      applyGuestLayout();
      setView("express");
      showMessage("Compte supprimé. Vous repartez sur la lecture simple.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      if (!(await ensureResolvedPlace(form, "profile-place-details"))) {
        return;
      }
      await api("/api/me/profile", { method: "PUT", body: formPayload(form) });
      await refreshDossier();
      showMessage("Profil enregistré avec incertitude conservée.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#profile-resolve-place").addEventListener("click", async () => {
    await resolvePlaceForForm($("#profile-form"), "profile-place-details");
  });
  field($("#profile-form"), "birthPlace").addEventListener("input", () => {
    field($("#profile-form"), "resolvedPlace").value = "";
    $("#profile-place-details").hidden = true;
  });

  $("#natal-person").addEventListener("change", fillNatalForm);

  $("#natal-resolve-place").addEventListener("click", async () => {
    await resolvePlaceForForm($("#natal-form"), "natal-place-details");
  });
  field($("#natal-form"), "birthPlace").addEventListener("input", () => {
    field($("#natal-form"), "resolvedPlace").value = "";
    $("#natal-place-details").hidden = true;
  });

  $("#natal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      if (!(await ensureResolvedPlace(form, "natal-place-details"))) {
        return;
      }
      const preservedValues = captureFormValues(form);
      const result = await api("/api/western-natal/calculate", { method: "POST", body: formPayload(form) });
      renderNatalResult(result);
      await refreshDossier();
      restoreFormValues(form, preservedValues);
      if (preservedValues.resolvedPlace) {
        showResolvedPlace("natal-place-details", JSON.parse(preservedValues.resolvedPlace));
      }
      showMessage("Calcul Western Natal V1 enregistré comme run de développement.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#copy-natal-json").addEventListener("click", async () => {
    try {
      await copyText($("#natal-json").textContent);
      showMessage("Artefact JSON copié.");
    } catch (error) {
      showMessage("Copie impossible depuis ce navigateur.", true);
    }
  });

  $("#person-resolve-place").addEventListener("click", async () => {
    await resolvePlaceForForm($("#person-form"), "person-place-details");
  });
  field($("#person-form"), "birthPlace").addEventListener("input", () => {
    field($("#person-form"), "resolvedPlace").value = "";
    $("#person-place-details").hidden = true;
  });

  $("#person-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const wantsBirth = Boolean(
        field(form, "birthDate").value || field(form, "birthPlace").value.trim() || field(form, "timeValue").value
      );
      if (wantsBirth && !(await ensureResolvedPlace(form, "person-place-details"))) {
        return;
      }
      await api("/api/people", { method: "POST", body: formPayload(form) });
      form.reset();
      await refreshDossier();
      showMessage("Personne ajoutée.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#relationship-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const body = formData(event.currentTarget);
      if (body.fromPersonId === body.toPersonId) {
        throw new Error("Choisissez deux personnes différentes.");
      }
      await api("/api/relationships", { method: "POST", body });
      await refreshDossier();
      showMessage("Relation enregistrée.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#analysis-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/analyses", { method: "POST", body: formData(event.currentTarget) });
      await refreshAnalyses();
      await refreshDossier();
      showMessage("Analyse versionnée créée.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#deliverable-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalLabel = submitButton ? submitButton.textContent : "";
    try {
      const personId = field(form, "personId").value;
      if (!personId) {
        throw new Error("Choisissez une personne disposant de données de naissance (onglet Profil).");
      }
      submitButton.disabled = true;
      submitButton.textContent = "Génération…";
      $("#deliverable-progress-label").textContent = "Génération du dossier en cours…";
      setDeliverableProgress({ completedSteps: 0, totalSteps: 12, currentSection: null });

      const body = {
        personId,
        intention: field(form, "intention").value.trim() || null,
        parents: deliverableParentsFromForm(form)
      };
      const started = await api("/api/deliverables", { method: "POST", body });
      const id = started.deliverable.id;
      const done = await pollDeliverableGeneration(id);
      const deliverable = done.deliverable;
      if (deliverable.status === "failed") {
        throw new Error(deliverable.error ?? "La génération a échoué. Réessayez.");
      }
      $("#deliverable-progress").hidden = true;
      await refreshDeliverables();
      await openDeliverable(id);
      showMessage(
        deliverable.writerMode === "llm"
          ? "Dossier généré avec rédaction IA — à relire avant livraison."
          : "Dossier généré en brouillon technique : socle vérifié complet ; configurez ASTROLAB_LLM_API_KEY pour activer la rédaction narrative."
      );
    } catch (error) {
      $("#deliverable-progress").hidden = true;
      showMessage(error.message, true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  });

  $("#download-deliverable-html").addEventListener("click", () => {
    if (state.activeDeliverableId) {
      downloadDeliverable(state.activeDeliverableId, "html");
    }
  });
  $("#download-deliverable-md").addEventListener("click", () => {
    if (state.activeDeliverableId) {
      downloadDeliverable(state.activeDeliverableId, "md");
    }
  });
  $("#export-deliverable-pdf").addEventListener("click", async () => {
    if (!state.activeDeliverableId) {
      return;
    }
    try {
      await exportDeliverablePdf(state.activeDeliverableId);
    } catch (error) {
      showMessage(error.message, true);
    }
  });
  $("#review-deliverable-button").addEventListener("click", async () => {
    try {
      await toggleDeliverableReview();
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $all(".nav-button").forEach((button) => {
    button.addEventListener("click", async () => {
      setView(button.dataset.view);
      if (button.dataset.view === "analyses") {
        await refreshAnalyses();
      }
      if (button.dataset.view === "natal") {
        fillNatalForm();
      }
      if (button.dataset.view === "methods") {
        await renderMethods();
      }
      if (button.dataset.view === "deliverables") {
        await refreshDeliverables();
      }
      if (button.dataset.view === "commerce") {
        if (state.config?.commerceEnabled === false) {
          showMessage("La partie commerciale est désactivée sur cette instance.", true);
          return;
        }
        await renderCommerce();
      }
      if (button.dataset.view === "admin") {
        await renderAdmin();
      }
    });
  });
}

async function loadConfig() {
  try {
    state.config = await api("/api/config");
  } catch {
    state.config = { commerceEnabled: true, llmConfigured: false, production: false };
  }
  const commerceNav = document.querySelector('.nav-button[data-view="commerce"]');
  if (commerceNav && state.config.commerceEnabled === false) {
    commerceNav.hidden = true;
    const sectionLabel = commerceNav.previousElementSibling;
    if (sectionLabel?.classList.contains("nav-section")) {
      sectionLabel.hidden = true;
    }
  }
  if (state.config.allowRegistration === false) {
    const registerForm = $("#register-form");
    const verifyForm = $("#verify-form");
    if (registerForm) {
      registerForm.hidden = true;
    }
    if (verifyForm) {
      verifyForm.hidden = true;
    }
  }
}

async function boot() {
  bindForms();
  await loadConfig();
  const session = await api("/api/session");
  state.user = session.user;
  applyGuestLayout();
  if (state.user) {
    await refreshDossier();
    setView("profile");
  } else {
    updateNav();
    setView("express");
  }
  await renderMethods();
}

boot().catch((error) => showMessage(error.message, true));
