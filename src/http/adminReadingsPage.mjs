export function renderAdminReadingsPage() {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Lectures publiques | Admin Lastro</title>
  <style>
    :root { color-scheme: light; --bg: #f7f7f4; --panel: #fff; --ink: #171717; --muted: #666; --line: #ddd; --accent: #111; --warn: #8a5200; --bad: #a22121; --ok: #17613b; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); }
    header { padding: 24px clamp(16px, 4vw, 40px) 12px; border-bottom: 1px solid var(--line); background: var(--panel); }
    h1 { margin: 0 0 14px; font-size: 24px; letter-spacing: 0; }
    main { padding: 18px clamp(16px, 4vw, 40px) 40px; }
    .metrics, .filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .metric { min-width: 132px; padding: 10px 12px; border: 1px solid var(--line); background: var(--panel); }
    .metric strong { display: block; font-size: 22px; line-height: 1.1; }
    .metric span { color: var(--muted); font-size: 13px; }
    .toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; margin: 18px 0 12px; flex-wrap: wrap; }
    .filters button, .actions button, .actions a { min-height: 34px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); padding: 7px 10px; font: inherit; text-decoration: none; cursor: pointer; }
    .filters button[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: var(--accent); }
    input[type="search"] { min-height: 36px; width: min(360px, 100%); border: 1px solid var(--line); padding: 8px 10px; font: inherit; background: var(--panel); }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); table-layout: fixed; }
    th, td { padding: 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { font-size: 12px; color: var(--muted); font-weight: 600; background: #fbfbf9; }
    td { font-size: 14px; }
    tr[data-open="true"] { background: #fffaf0; }
    .status { display: inline-block; border: 1px solid var(--line); padding: 2px 6px; font-size: 12px; white-space: nowrap; }
    .status.ready, .status.sent { color: var(--ok); border-color: #a8d5bc; }
    .status.failed, .status.sending_stale { color: var(--bad); border-color: #e0aaaa; }
    .status.queued, .status.generating, .status.pending, .status.sending { color: var(--warn); border-color: #e5c07b; }
    .action-required { color: var(--bad); font-weight: 700; }
    .detail { padding: 14px 10px 18px; background: #fffaf0; border-bottom: 1px solid var(--line); }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px 18px; }
    .detail dt { color: var(--muted); font-size: 12px; }
    .detail dd { margin: 2px 0 8px; overflow-wrap: anywhere; }
    .notice { margin-top: 8px; color: var(--warn); font-size: 13px; }
    .error { color: var(--bad); }
    .muted { color: var(--muted); }
    @media (max-width: 880px) {
      table, thead, tbody, tr, th, td { display: block; }
      thead { position: absolute; left: -9999px; }
      tr { border-bottom: 1px solid var(--line); }
      td { border-bottom: 0; padding: 8px 10px; }
      td::before { content: attr(data-label); display: block; color: var(--muted); font-size: 12px; margin-bottom: 2px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Lectures publiques</h1>
    <div class="metrics" id="metrics"></div>
  </header>
  <main>
    <div class="toolbar">
      <div class="filters" id="filters" aria-label="Filtres"></div>
      <input id="search" type="search" autocomplete="off" placeholder="E-mail, référence ou readingId">
    </div>
    <p class="muted" id="summary"></p>
    <table>
      <thead>
        <tr>
          <th>Référence</th>
          <th>Client</th>
          <th>Créée le</th>
          <th>Lecture</th>
          <th>E-mail</th>
          <th>Source</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
    <p class="error" id="error" role="alert"></p>
  </main>
  <script>
    const state = { filter: "all", q: "", openId: null, lastRows: [] };
    const filters = [
      ["all", "Toutes"],
      ["active", "En cours"],
      ["ready", "Prêtes"],
      ["failed", "Échecs"],
      ["email_action", "E-mails à traiter"]
    ];
    const readingLabels = { queued: "En attente", generating: "En génération", ready: "Prête", failed: "Échec" };
    const emailLabels = { pending: "pending", sending: "sending", sent: "sent", failed: "failed", sending_stale: "sending stale / revue manuelle", unknown: "—" };
    const paris = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

    function text(value) {
      return document.createTextNode(value == null || value === "" ? "—" : String(value));
    }
    function clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }
    function cell(row, label, value) {
      const td = document.createElement("td");
      td.dataset.label = label;
      td.appendChild(text(value));
      row.appendChild(td);
      return td;
    }
    function status(value, labels = {}) {
      const span = document.createElement("span");
      span.className = "status " + String(value || "unknown");
      span.appendChild(text(labels[value] || value || "—"));
      return span;
    }
    function formatDate(value) {
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? paris.format(date) : "—";
    }
    function buildFilters() {
      const wrap = document.getElementById("filters");
      clear(wrap);
      for (const [value, label] of filters) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.filter = value;
        button.setAttribute("aria-pressed", String(state.filter === value));
        button.appendChild(text(label));
        button.addEventListener("click", () => {
          state.filter = value;
          load();
        });
        wrap.appendChild(button);
      }
    }
    function renderMetrics(counts) {
      const items = [
        ["En cours", counts.active],
        ["Prêtes", counts.ready],
        ["Échecs", counts.failed],
        ["E-mails à traiter", counts.emailAction]
      ];
      const root = document.getElementById("metrics");
      clear(root);
      for (const [label, value] of items) {
        const box = document.createElement("div");
        box.className = "metric";
        const strong = document.createElement("strong");
        strong.appendChild(text(value));
        const span = document.createElement("span");
        span.appendChild(text(label));
        box.append(strong, span);
        root.appendChild(box);
      }
    }
    function detailRow(reading) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      const detail = document.createElement("div");
      detail.className = "detail";
      const dl = document.createElement("dl");
      dl.className = "detail-grid";
      const fields = [
        ["readingId", reading.details.readingId],
        ["référence", reading.details.reference],
        ["email client", reading.details.clientEmail],
        ["création", formatDate(reading.details.createdAt)],
        ["dernière mise à jour", formatDate(reading.details.updatedAt)],
        ["statut lecture", readingLabels[reading.details.readingStatus] || reading.details.readingStatus],
        ["statut email", emailLabels[reading.details.emailStatus] || reading.details.emailStatus],
        ["attempts", reading.details.attempts],
        ["dernier essai", formatDate(reading.details.lastAttemptAt)],
        ["sentAt", formatDate(reading.details.sentAt)],
        ["providerMessageId", reading.details.providerMessageId],
        ["source", reading.details.source],
        ["lien", reading.details.link],
        ["dernière erreur", reading.details.lastError]
      ];
      if (reading.failure) {
        fields.push(["E-mail d'échec client", emailLabels[reading.failure.clientFailureEmail] || reading.failure.clientFailureEmail]);
        fields.push(["Alerte admin", emailLabels[reading.failure.adminAlertEmail] || reading.failure.adminAlertEmail]);
      }
      for (const [label, value] of fields) {
        const group = document.createElement("div");
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.appendChild(text(label));
        dd.appendChild(text(value));
        group.append(dt, dd);
        dl.appendChild(group);
      }
      detail.appendChild(dl);
      td.appendChild(detail);
      tr.appendChild(td);
      return tr;
    }
    async function resend(reading) {
      if (reading.resendWarning && !confirm(reading.resendWarning)) return;
      const response = await fetch("/api/admin/readings/resend-email", {
        method: "POST",
        headers: { "content-type": "application/json", "x-astrolab-admin-action": "resend-email" },
        body: JSON.stringify({ readingId: reading.id, confirm: reading.id })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Renvoi impossible.");
      }
      await load();
    }
    function renderRows(readings) {
      const body = document.getElementById("rows");
      clear(body);
      for (const reading of readings) {
        const tr = document.createElement("tr");
        tr.dataset.open = String(state.openId === reading.id);
        cell(tr, "Référence", reading.reference);
        cell(tr, "Client", reading.clientEmail);
        cell(tr, "Créée le", formatDate(reading.createdAt));
        const readingCell = cell(tr, "Lecture", "");
        readingCell.replaceChildren(status(reading.readingStatus, readingLabels));
        const emailCell = cell(tr, "E-mail", "");
        emailCell.replaceChildren(status(reading.emailStatus, emailLabels));
        if (reading.actionRequired) {
          emailCell.appendChild(document.createElement("br"));
          const required = document.createElement("span");
          required.className = "action-required";
          required.appendChild(text("Action requise"));
          emailCell.appendChild(required);
        }
        cell(tr, "Source", reading.source);
        const actions = cell(tr, "Actions", "");
        actions.className = "actions";
        if (reading.canView) {
          const link = document.createElement("a");
          link.href = reading.link;
          link.target = "_blank";
          link.rel = "noreferrer";
          link.appendChild(text("Voir"));
          actions.appendChild(link);
          const copy = document.createElement("button");
          copy.type = "button";
          copy.appendChild(text("Copier le lien"));
          copy.addEventListener("click", () => navigator.clipboard?.writeText(reading.link));
          actions.appendChild(copy);
        }
        if (reading.canResendEmail) {
          const button = document.createElement("button");
          button.type = "button";
          button.appendChild(text("Renvoyer l’e-mail"));
          button.addEventListener("click", () => resend(reading).catch((error) => document.getElementById("error").textContent = error.message));
          actions.appendChild(button);
          if (reading.resendWarning) {
            const warn = document.createElement("div");
            warn.className = "notice";
            warn.appendChild(text(reading.resendWarning));
            actions.appendChild(warn);
          }
        }
        const details = document.createElement("button");
        details.type = "button";
        details.appendChild(text(state.openId === reading.id ? "Masquer" : "Détails"));
        details.addEventListener("click", () => {
          state.openId = state.openId === reading.id ? null : reading.id;
          renderRows(state.lastRows);
        });
        actions.appendChild(details);
        body.appendChild(tr);
        if (state.openId === reading.id) {
          body.appendChild(detailRow(reading));
        }
      }
    }
    async function load() {
      buildFilters();
      const params = new URLSearchParams({ filter: state.filter });
      if (state.q) params.set("q", state.q);
      const response = await fetch("/api/admin/readings?" + params.toString(), { headers: { accept: "application/json" } });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Accès admin refusé.");
      }
      const payload = await response.json();
      state.lastRows = payload.readings || [];
      renderMetrics(payload.counts || {});
      renderRows(state.lastRows);
      document.getElementById("summary").textContent = String(state.lastRows.length) + " lecture(s), maximum " + String(payload.maxResults || 200) + ".";
      document.getElementById("error").textContent = "";
    }
    document.getElementById("search").addEventListener("input", (event) => {
      state.q = event.target.value;
      clearTimeout(window.__searchTimer);
      window.__searchTimer = setTimeout(() => load().catch((error) => document.getElementById("error").textContent = error.message), 180);
    });
    buildFilters();
    load().catch((error) => document.getElementById("error").textContent = error.message);
    setInterval(() => load().catch(() => null), 15000);
  </script>
</body>
</html>`;
}
