// Renders a client dossier (sections + verified annex) as standalone HTML or Markdown.
// Styling is self-contained so the HTML can be opened or printed to PDF as-is.

import { renderSocleAnnex } from "./socle.mjs";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function inlineMarkdown(paragraph) {
  let html = escapeHtml(paragraph);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return html;
}

export function markdownToHtml(source) {
  const lines = String(source ?? "").split("\n");
  const out = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      out.push(`<ul>${listBuffer.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      listBuffer = [];
    }
  };

  let paragraphBuffer = [];
  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      out.push(`<p>${inlineMarkdown(paragraphBuffer.join(" "))}</p>`);
      paragraphBuffer = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      flushParagraph();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      listBuffer.push(line.slice(2));
      continue;
    }
    if (line.trim() === "") {
      flushList();
      flushParagraph();
      continue;
    }
    flushList();
    paragraphBuffer.push(line);
  }
  flushList();
  flushParagraph();
  return out.join("\n");
}

function statusLabel(status) {
  const labels = {
    ok: "validé machine",
    needs_review: "à vérifier",
    not_available: "non disponible",
    template_draft: "brouillon (sans rédacteur IA)"
  };
  return labels[status] ?? status;
}

const CSS = `
  :root { --ink:#23262b; --soft:#5f6570; --line:#e4e6ea; --paper:#ffffff; --accent:#7c5cff; --ok:#2f9e6e; --warn:#c98a1b; --err:#c0392b; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Georgia, "Times New Roman", serif; color:var(--ink); background:#f2f3f5; }
  .sheet { max-width:820px; margin:24px auto; background:var(--paper); padding:56px 64px; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  header.cover { border-bottom:2px solid var(--ink); padding-bottom:20px; margin-bottom:8px; }
  .brand { font-size:12px; letter-spacing:2.5px; text-transform:uppercase; color:var(--soft); }
  h1 { font-size:30px; margin:10px 0 4px; }
  .cover-meta { color:var(--soft); font-size:13px; }
  .caveat { font-size:13px; line-height:1.55; color:#4a4f58; background:#f6f4ff; border:1px solid #e6e0ff; border-radius:8px; padding:12px 14px; margin:18px 0 8px; }
  section.block { margin-top:34px; }
  h2 { font-size:21px; margin:0 0 4px; }
  h3 { font-size:16px; margin:22px 0 4px; }
  .badge { display:inline-block; font-size:11px; letter-spacing:.4px; border-radius:999px; padding:3px 10px; margin:0 0 12px; }
  .badge-calculated { background:#e9f9f1; color:var(--ok); border:1px solid #bfe9d4; }
  .badge-symbolic { background:#f3efff; color:#5b3fd4; border:1px solid #ddd2ff; }
  .badge-unavailable { background:#f6f6f6; color:var(--soft); border:1px solid var(--line); }
  p { line-height:1.75; font-size:15.5px; }
  ul { line-height:1.7; font-size:15px; }
  .validation { font-size:12px; color:var(--soft); margin-top:14px; }
  .validation .err { color:var(--err); }
  .validation .warn { color:var(--warn); }
  .annex { background:#fafafa; border:1px solid var(--line); border-radius:10px; padding:18px 22px; margin-top:40px; }
  .annex p, .annex li { font-size:13px; line-height:1.6; color:#444; }
  footer { margin-top:42px; padding-top:16px; border-top:1px solid var(--line); font-size:12px; color:var(--soft); }
  @media print { body { background:#fff; } .sheet { box-shadow:none; margin:0; max-width:none; padding:24px 16px; } }
`;

export function renderDossierHtml({ title, personLabel, createdAt, writerMode, sections }) {
  const badges = {
    calculated: "badge-calculated",
    symbolic: "badge-symbolic",
    unavailable: "badge-unavailable"
  };
  const body = sections
    .map((section) => {
      const badgeClass = badges[section.badgeCode] ?? "badge-symbolic";
      const status = section.status === "ok" ? "validé machine" : statusLabel(section.status);
      const issues =
        section.validation?.issues?.length > 0
          ? `<div class="validation">${section.validation.issues
              .map(
                (issue) =>
                  `<span class="${issue.severity === "error" ? "err" : "warn"}">• ${escapeHtml(issue.message)}</span><br>`
              )
              .join("")}</div>`
          : "";
      return `<section class="block">
        <h2>${escapeHtml(section.title)}</h2>
        <span class="badge ${badgeClass}">${escapeHtml(section.badgeLabel)}</span>
        <div class="block-body">${markdownToHtml(section.text)}</div>
        <div class="validation">Statut : ${status}${issues}</div>
      </section>`;
    })
    .join("\n");

  const writerNote =
    writerMode === "llm"
      ? "Rédaction : rédacteur IA configuré, sections validées par la machine avant relecture humaine."
      : writerMode === "template"
        ? "Brouillon : rédacteur IA non configuré (clé absente). Ce document n'est pas prêt pour la livraison."
        : "";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="sheet">
  <header class="cover">
    <div class="brand">AstroLab · Lecture symbolique personnalisée</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="cover-meta">${personLabel ? `Personne : ${escapeHtml(personLabel)} · ` : ""}Généré le ${escapeHtml(createdAt)}</div>
  </header>
  <div class="caveat">
    Cadre : cette lecture est une cartographie intérieure, symbolique et non prédictive. Elle ne constitue ni un diagnostic,
    ni une thérapie, ni une prédiction d'événements. Le libre arbitre reste entier. Les données astronomiques utilisées sont
    vérifiées (annexe technique) ; les interprétations restent des lectures symboliques.
  </div>
  ${body}
  <footer>
    <p>${writerNote}</p>
    <p>Document généré par AstroLab — socle de calcul local et déterministe ; toute interprétation est étiquetée et doit être relue avant livraison.</p>
  </footer>
</div>
</body>
</html>`;
}

export function renderDossierMarkdown({ title, personLabel, createdAt, sections }) {
  const parts = [`# ${title}`, ""];
  if (personLabel) {
    parts.push(`Personne : ${personLabel}`);
  }
  parts.push(`Généré le : ${createdAt}`, "", "---", "");
  for (const section of sections) {
    parts.push(`## ${section.title}`, "", `_${section.badgeLabel}_`, "", section.text, "");
  }
  return parts.join("\n");
}

export function annexSections(socle) {
  const text = renderSocleAnnex(socle);
  return [
    {
      id: "annexe-socle",
      title: "Annexe — socle de calcul vérifié",
      badgeCode: "calculated",
      badgeLabel: "Données vérifiées (calcul)",
      kind: "annex",
      text,
      status: "ok",
      validation: { ok: true, issues: [] }
    }
  ];
}
