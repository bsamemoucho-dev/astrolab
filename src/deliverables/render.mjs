// Renders a client dossier (sections + verified annex) as standalone HTML or Markdown.
// Styling is self-contained so the HTML can be opened or printed to PDF as-is.

import { docStrings } from "./i18n.mjs";
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

// « 2026-09-11T00:25:17.558Z » n'a rien à faire dans une lecture payante.
function formatHumanDate(value, lang = "fr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value ?? "");
  }
  try {
    return new Intl.DateTimeFormat(lang || "fr", { day: "numeric", month: "long", year: "numeric" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function statusLabel(status, t = null) {
  const strings = t ?? docStrings("fr");
  const labels = {
    ok: strings.statusOk,
    needs_review: strings.statusNeedsReview,
    not_available: strings.statusNotAvailable,
    template_draft: strings.statusTemplateDraft
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
  .ai-review { margin:14px 0 4px; padding:12px 16px; border:1px solid #e6d6a8; border-left:4px solid #d9b45c; border-radius:8px; background:#fdf8ec; color:#6b5320; font-size:13px; font-weight:600; }
  @media print { body { background:#fff; } .sheet { box-shadow:none; margin:0; max-width:none; padding:24px 16px; } }
`;

export function renderDossierHtml({ title, personLabel, createdAt, writerMode, sections, author = null, strings = null, verificationNote = null, aiReview = null }) {
  const t = strings ?? docStrings("fr");
  const badges = {
    calculated: "badge-calculated",
    symbolic: "badge-symbolic",
    unavailable: "badge-unavailable"
  };
  const authorLine = author
    ? `<p>${escapeHtml(author)}</p>`
    : "";
  // Document client : ni badge de classification, ni statut de validation, ni
  // message interne. Ces informations servent à l'exploitation, pas au lecteur.
  // Une section indisponible disparaît : on ne montre jamais « module non
  // disponible » à quelqu'un qui vient de payer.
  const body = sections
    .filter((section) => section.badgeCode !== "unavailable")
    .map((section) => {
      const annex = section.kind === "annex";
      const block = `<div class="block-body">${markdownToHtml(section.text)}</div>`;
      return annex
        ? `<details class="block annex">
        <summary>${escapeHtml(t.annexShow)}</summary>
        ${block}
      </details>`
        : `<section class="block">
        <h2>${escapeHtml(section.title)}</h2>
        ${block}
      </section>`;
    })
    .join("\n");

  const writerNote =
    writerMode === "llm" ? t.writerNoteLlm : writerMode === "template" ? t.writerNoteTemplate : "";

  return `<!doctype html>
<html lang="${escapeHtml(t.lang ?? "fr")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="sheet">
  <header class="cover">
    <div class="brand">${escapeHtml(t.brand)}</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="cover-meta">${personLabel ? `${escapeHtml(t.person)} : ${escapeHtml(personLabel)} · ` : ""}${escapeHtml(t.generatedOn)} ${escapeHtml(formatHumanDate(createdAt, t.lang))}</div>
  </header>
  <div class="caveat">${escapeHtml(t.caveat)}</div>
  ${aiReview ? `<div class="ai-review">${escapeHtml(aiReview)}</div>` : ""}
  ${body}
  <footer>
    <p class="ethical-closing">${escapeHtml(t.ethicalClosing)}</p>
    ${authorLine}
    <p>${writerNote}</p>
    ${verificationNote ? `<p>${escapeHtml(verificationNote)}</p>` : ""}
    <p>${escapeHtml(t.footer)}</p>
  </footer>
</div>
</body>
</html>`;
}

export function renderDossierMarkdown({ title, personLabel, createdAt, sections, author = null, strings = null, verificationNote = null, aiReview = null }) {
  const t = strings ?? docStrings("fr");
  const parts = [`# ${title}`, ""];
  if (personLabel) {
    parts.push(`${t.person} : ${personLabel}`);
  }
  parts.push(`${t.generatedOn} : ${createdAt}`, "", "---", "");
  for (const section of sections) {
    parts.push(`## ${section.title}`, "", `_${section.badgeLabel}_`, "", section.text, "");
  }
  if (aiReview) {
    parts.push("---", `**${aiReview}**`);
  }
  if (author) {
    parts.push("---", author);
  }
  if (verificationNote) {
    parts.push("", `_${verificationNote}_`);
  }
  return parts.join("\n");
}

export function annexSections(socle, strings = null) {
  const t = strings ?? docStrings("fr");
  const text = renderSocleAnnex(socle, t);
  return [
    {
      id: "annexe-socle",
      title: t.annexTitle,
      badgeCode: "calculated",
      badgeLabel: t.badgeCalculated,
      kind: "annex",
      text,
      status: "ok",
      validation: { ok: true, issues: [] }
    }
  ];
}
