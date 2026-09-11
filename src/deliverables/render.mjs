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
  let tableBuffer = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      out.push(`<ul>${listBuffer.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      listBuffer = [];
    }
  };

  // Tableaux « | a | b | ». La ligne de séparation |---|---| est reconnue et
  // ignorée : elle sert en Markdown, pas en HTML.
  const flushTable = () => {
    if (tableBuffer.length === 0) {
      return;
    }
    const lignes = tableBuffer.map((ligne) =>
      ligne.replace(/^\||\|$/g, "").split("|").map((cellule) => cellule.trim())
    );
    const [entetes, ...corps] = lignes;
    const donnees = corps.filter((cellules) => !cellules.every((cellule) => /^:?-{2,}:?$/.test(cellule)));
    out.push(
      `<table><thead><tr>${entetes.map((cellule) => `<th>${inlineMarkdown(cellule)}</th>`).join("")}</tr></thead>` +
        `<tbody>${donnees
          .map((cellules) => `<tr>${cellules.map((cellule) => `<td>${inlineMarkdown(cellule)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
    );
    tableBuffer = [];
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
      flushTable();
      flushList();
      flushParagraph();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\|.*\|/.test(line)) {
      flushList();
      flushParagraph();
      tableBuffer.push(line);
      continue;
    }
    if (line.startsWith("- ")) {
      flushTable();
      flushParagraph();
      listBuffer.push(line.slice(2));
      continue;
    }
    if (line.trim() === "") {
      flushTable();
      flushList();
      flushParagraph();
      continue;
    }
    flushTable();
    flushList();
    paragraphBuffer.push(line);
  }
  flushTable();
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
  header.cover { border-top:6px solid var(--accent); border-bottom:2px solid var(--ink); padding:18px 0 20px; margin-bottom:8px; }
  .brand { font-size:12px; letter-spacing:2.5px; text-transform:uppercase; color:var(--soft); }
  h1 { font-size:30px; margin:10px 0 4px; line-height:1.2; }
  .cover-meta { color:var(--soft); font-size:13px; }
  /* Trois placements clés sur la couverture. La fragilité éventuelle est écrite :
     « probable » ou « non décidable », jamais un signe affirmé au-delà du calcul. */
  .cover-cards { list-style:none; display:flex; gap:14px; margin:24px 0 0; padding:0; break-inside:avoid; page-break-inside:avoid; }
  .cover-cards li { flex:1; background:#f7f5ff; border:1px solid #e6e0ff; border-radius:10px; padding:13px 14px; text-align:center; }
  .cover-card-label { display:block; font-size:10.5px; letter-spacing:1.6px; text-transform:uppercase; color:var(--soft); }
  .cover-card-value { display:block; font-size:17px; margin-top:5px; }
  .cover-card-precision { display:block; font-size:11px; font-style:italic; color:var(--soft); margin-top:3px; }
  .caveat { font-size:13px; line-height:1.55; color:#4a4f58; background:#f6f4ff; border:1px solid #e6e0ff; border-radius:8px; padding:12px 14px; margin:20px 0 10px; }
  /* L'analyse se lit sur plusieurs pages : paragraphes aérés et interligne
     confortable, pour qu'elle ne soit pas un bloc compact. */
  p { line-height:1.6; font-size:15.5px; margin:0 0 1.1em; }
  p:last-child { margin-bottom:0; }
  ul, ol { line-height:1.6; font-size:15px; margin:0 0 1.1em; padding-left:1.35em; }
  li + li { margin-top:.4em; }
  /* Tableaux (tableau des positions) : lisibles, en-tête répété à chaque page. */
  table { width:100%; border-collapse:collapse; margin:0 0 1.3em; font-size:14px; }
  thead { display:table-header-group; }
  thead th { text-align:left; font-size:10.5px; letter-spacing:1.1px; text-transform:uppercase; color:var(--soft); border-bottom:1.5px solid var(--ink); padding:7px 8px; }
  tbody td { padding:7px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  tbody tr:last-child td { border-bottom:0; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  section.block { margin-top:2.6em; }
  /* Titres de section : petites capitales espacées et marqueur, dans l'esprit
     d'un magazine — sans rien changer au contenu. */
  h2 { font-size:15.5px; text-transform:uppercase; letter-spacing:.11em; margin:0 0 1em; line-height:1.35; }
  h2::before { content:"✦"; color:var(--accent); margin-right:.6em; font-size:13px; letter-spacing:0; }
  h3 { font-size:16px; margin:1.7em 0 .45em; line-height:1.3; }
  /* Un titre ne doit jamais rester seul en bas de page, ni être séparé de sa
     première phrase : un intitulé orphelin en bas de page est illisible. */
  h1, h2, h3, h4 { break-after:avoid-page; page-break-after:avoid; break-inside:avoid; }
  h2 + p, h3 + p, h2 + ul, h3 + ul { break-before:avoid-page; page-break-before:avoid; }
  p { orphans:3; widows:3; }
  .badge { display:inline-block; font-size:11px; letter-spacing:.4px; border-radius:999px; padding:3px 10px; margin:0 0 12px; }
  .badge-calculated { background:#e9f9f1; color:var(--ok); border:1px solid #bfe9d4; }
  .badge-symbolic { background:#f3efff; color:#5b3fd4; border:1px solid #ddd2ff; }
  .badge-unavailable { background:#f6f6f6; color:var(--soft); border:1px solid var(--line); }
  .validation { font-size:12px; color:var(--soft); margin-top:14px; }
  .validation .err { color:var(--err); }
  .validation .warn { color:var(--warn); }
  .annex { background:#fafafa; border:1px solid var(--line); border-radius:10px; padding:20px 24px; margin-top:44px; }
  .annex p, .annex li { font-size:13px; line-height:1.6; color:#444; }
  footer { margin-top:46px; padding-top:18px; border-top:1px solid var(--line); font-size:12px; color:var(--soft); }
  .ai-review { margin:16px 0 4px; padding:12px 16px; border:1px solid #e6d6a8; border-left:4px solid #d9b45c; border-radius:8px; background:#fdf8ec; color:#6b5320; font-size:13px; line-height:1.55; font-weight:500; break-inside:avoid; page-break-inside:avoid; }
  /* À l'impression (donc dans le PDF) : 2 cm de marge tout autour, et des titres
     jamais seuls en bas de page. L'annexe n'a plus rien à déplier : elle est
     visible partout, donc elle ne peut plus manquer au fichier. */
  @page { margin:2cm; }
  @media print {
    body { background:#fff; }
    .sheet { box-shadow:none; margin:0; max-width:none; padding:0; }
    /* L'annexe commence toujours sur une nouvelle page : elle est d'une autre
       nature que la lecture (des faits vérifiés, pas du texte rédigé). */
    .annex { border:0; background:none; padding:0; margin-top:0; break-before:page; page-break-before:always; }
    .caveat, .ai-review, .badge { break-inside:avoid; page-break-inside:avoid; }
    a { color:inherit; text-decoration:none; }
  }
`;

export function renderDossierHtml({ title, personLabel, createdAt, writerMode, sections, author = null, strings = null, verificationNote = null, aiReview = null, cover = null }) {
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
      // L'annexe est une section comme les autres : toujours visible, jamais
      // repliée derrière un « détail » cliquable. Un document payant n'a pas de
      // contenu caché, et le repli était la cause d'une annexe absente du PDF.
      const classes = section.kind === "annex" ? "block annex" : "block";
      return `<section class="${classes}">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="block-body">${markdownToHtml(section.text)}</div>
      </section>`;
    })
    .join("\n");

  const writerNote =
    writerMode === "llm" ? t.writerNoteLlm : writerMode === "template" ? t.writerNoteTemplate : "";

  const placements = Array.isArray(cover?.placements) ? cover.placements : [];
  const coverCards =
    placements.length > 0
      ? `<ul class="cover-cards">${placements
          .map(
            (placement) =>
              `<li><span class="cover-card-label">${escapeHtml(placement.label)}</span>` +
              `<span class="cover-card-value">${escapeHtml(placement.value)}</span>` +
              (placement.precision ? `<span class="cover-card-precision">${escapeHtml(placement.precision)}</span>` : "") +
              "</li>"
          )
          .join("")}</ul>`
      : "";

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
    ${coverCards}
  </header>
  <div class="caveat">${escapeHtml(t.caveat)}</div>
  ${body}
  <footer>
    ${aiReview ? `<p class="ai-review">${escapeHtml(aiReview)}</p>` : ""}
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

export function renderDossierMarkdown({ title, personLabel, createdAt, sections, author = null, strings = null, verificationNote = null, aiReview = null, cover = null }) {
  const t = strings ?? docStrings("fr");
  const parts = [`# ${title}`, ""];
  if (personLabel) {
    parts.push(`${t.person} : ${personLabel}`);
  }
  // Date lisible, comme dans le HTML : « 2026-09-11T09:29:18.661Z » n'a rien à
  // faire dans un document vendu.
  parts.push(`${t.generatedOn} : ${formatHumanDate(createdAt, t.lang)}`, "");
  const placements = Array.isArray(cover?.placements) ? cover.placements : [];
  if (placements.length > 0) {
    parts.push(
      "",
      placements
        .map((placement) => `**${placement.label}** : ${placement.value}${placement.precision ? ` _(${placement.precision})_` : ""}`)
        .join(" · ")
    );
  }
  parts.push("", "---", "");
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
