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
  /* Direction artistique : reprise du template validé (papier crème, violet, or,
     Georgia pour les titres, sans-serif pour le corps). */
  :root{
    --ink:#292534; --muted:#746f7d; --paper:#fffdf9; --violet:#5a447f; --violet-2:#8b6aae;
    --rose:#c78ca6; --gold:#c5a15a; --line:#e9e2ea; --soft:#f6f1f7; --soft-2:#fbf7f4;
  }
  *{box-sizing:border-box}
  /* Interligne du texte lu : une seule valeur à changer ici. Le client a demandé
     2 ; 2,5 est possible en modifiant cette ligne (le document s'allonge d'autant). */
  :root{--interligne:2}
  body{
    margin:0; background:#ece7e3; color:var(--ink);
    font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "DejaVu Sans", sans-serif;
    line-height:var(--interligne);
  }
  /* La feuille fait exactement une page A4 : les marges viennent de son
     rembourrage (2 cm), pas du dialogue d'impression. */
  .sheet{
    width:210mm; margin:0 auto 22px; background:var(--paper);
    padding:20mm; box-shadow:0 16px 45px rgba(46,35,53,.12);
  }

  /* --- Couverture pleine page --- */
  .cover-page{
    width:210mm; min-height:297mm; margin:0 auto 22px; position:relative; overflow:hidden;
    background:
      radial-gradient(circle at 18% 12%, rgba(255,255,255,.18), transparent 28%),
      radial-gradient(circle at 82% 22%, rgba(255,255,255,.10), transparent 25%),
      linear-gradient(155deg, #4e3577 0%, #69478c 46%, #a7698d 100%);
    color:#fff; break-after:page; page-break-after:always;
  }
  .cover-inner{
    min-height:297mm; padding:24mm 22mm; display:flex; flex-direction:column;
    justify-content:center; text-align:center;
  }
  .brand{text-transform:uppercase;letter-spacing:.32em;font-size:11px;font-weight:800;color:#7d7182}
  .cover-page .brand{color:#f1e9f1}
  .kicker{text-transform:uppercase;letter-spacing:.24em;font-size:10px;font-weight:800;color:var(--gold);margin-bottom:8px}
  .cover-page .kicker{color:#dfcfa8}
  /* Étoile dessinée, pas un glyphe de police : « ✦ » n'est pas garanti sous
     Linux (rendu PDF serveur), où il s'imprimerait en carré vide. */
  .sparkle{margin-top:24px;line-height:0}
  .sparkle svg{width:20px;height:20px}
  .cover-name{font-family:Georgia,"Times New Roman","Liberation Serif","DejaVu Serif",serif;font-size:38px;margin-top:16px;line-height:1.1}
  .cover-note{margin:4px auto 0;color:#dfd7e2;font-size:11px;max-width:430px;line-height:1.5}
  .big-three{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:32px auto 16px;width:78%}
  .big-card{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);border-radius:14px;padding:15px 10px 13px}
  .big-card small{display:block;text-transform:uppercase;letter-spacing:.18em;font-size:9px;color:#dfd3e6;margin-bottom:5px}
  .big-card b{display:block;font-family:Georgia,"Times New Roman","Liberation Serif","DejaVu Serif",serif;font-size:18px;font-weight:600}
  .big-card i{display:block;font-size:10px;font-style:italic;color:#cfc3d8;margin-top:4px}

  /* --- Corps du document --- */
  h1,h2,h3,h4{font-family:Georgia,"Times New Roman","Liberation Serif","DejaVu Serif",serif;margin:0;font-weight:600}
  h2{font-size:26px;line-height:1.2;margin:0 0 .5em}
  h3{font-size:18px;line-height:1.25;margin:1.5em 0 .4em}
  /* Justifié des deux côtés, avec césure : sans césure, un mot long creuse des
     trous dans la ligne. La langue est déclarée sur <html>, la césure suit. */
  p{line-height:var(--interligne);font-size:14.5px;margin:0 0 1.35em;text-align:justify;hyphens:auto;-webkit-hyphens:auto;text-justify:inter-word}
  p:last-child{margin-bottom:0}
  ul,ol{line-height:var(--interligne);font-size:14px;margin:0 0 1.35em;padding-left:1.35em;text-align:justify;hyphens:auto;-webkit-hyphens:auto}
  /* Ce qui ne se justifie pas : une ligne courte, un titre, un tableau, une
     légende, une note de pied. Justifier ces blocs ne crée que des trous. */
  h1,h2,h3,h4,th,td,.badge,.legend,.footer-note,footer,.caveat,.ai-review,.cover-page p,.bar-row,table{text-align:initial;hyphens:none}
  footer,.footer-note,.legend,td{text-align:left}
  li+li{margin-top:.4em}
  a{color:var(--violet)}
  .muted,.chart-intro{color:var(--muted)}
  .header-line{height:3px;border-radius:4px;background:linear-gradient(90deg,var(--violet),var(--rose));margin:0 0 20px}
  section.block{margin-top:2.6em}
  .badge{display:inline-block;font-size:11px;letter-spacing:.4px;border-radius:999px;padding:3px 10px;margin:0 0 12px}
  .badge-calculated{background:#eef4f0;color:#2f6e56;border:1px solid #cfe3d9}
  .badge-symbolic{background:#f3efff;color:#5b3fd4;border:1px solid #ddd2ff}
  .badge-unavailable{background:#f6f6f6;color:var(--muted);border:1px solid var(--line)}
  .validation{font-size:12px;color:var(--muted);margin-top:14px}
  .validation .err{color:#c0392b}
  .validation .warn{color:#c98a1b}

  /* Un titre ne reste jamais seul en bas de page, ni séparé de sa première phrase. */
  h1,h2,h3,h4{break-after:avoid-page;page-break-after:avoid;break-inside:avoid}
  h2+p,h3+p,h2+ul,h3+ul{break-before:avoid-page;page-break-before:avoid}
  p{orphans:3;widows:3}

  /* --- Cartes, tableaux, graphiques --- */
  .caveat{font-size:12.5px;line-height:1.55;color:#4a4f58;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 22px;break-inside:avoid;page-break-inside:avoid}
  .card{border:1px solid var(--line);background:#fff;border-radius:16px;padding:18px}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .chart-wrap{display:grid;grid-template-columns:1fr;gap:16px}
  .chart-wheel{display:flex;flex-direction:column;align-items:center}
  .wheel{width:100%;max-width:250px;height:auto;margin:4px auto 8px}
  .bar-row{display:grid;grid-template-columns:70px 1fr 34px;align-items:center;gap:10px;margin:9px 0;font-size:12px}
  .bar-track{height:8px;border-radius:99px;background:#eeeaf0;overflow:hidden}
  .bar{height:100%;border-radius:99px}
  .donut{width:118px;height:118px;border-radius:50%;margin:8px auto 12px;position:relative}
  .donut:after{content:"";position:absolute;inset:27px;background:#fff;border-radius:50%}
  .legend{display:grid;grid-template-columns:1fr;gap:6px;font-size:11px;color:var(--muted)}
  .dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:7px}
  .footer-note{font-size:10.5px;color:#847c86;margin-top:12px;line-height:1.5}
  table{width:100%;border-collapse:collapse;font-size:12px;margin:0 0 1.2em}
  thead{display:table-header-group}
  thead th{text-align:left;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#948a98;border-bottom:1px solid #dacfdc;padding:9px 6px}
  tbody td{padding:9px 6px;border-bottom:1px solid #eee7ef;vertical-align:middle;line-height:1.45}
  tr{break-inside:avoid;page-break-inside:avoid}
  .annex{background:var(--soft-2);border:1px solid var(--line);border-radius:16px;padding:20px 24px;margin-top:44px}
  .annex p,.annex li{font-size:12.5px;line-height:var(--interligne);color:#444;text-align:justify;hyphens:auto}
  footer{margin-top:46px;padding-top:18px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted)}
  .ai-review{margin:16px 0 4px;padding:12px 16px;border:1px solid #e6d6a8;border-left:4px solid var(--gold);border-radius:10px;background:#fdf9f0;color:#6b5320;font-size:12.5px;line-height:1.55;break-inside:avoid;page-break-inside:avoid}
  .ethical-closing{font-family:Georgia,"Times New Roman","Liberation Serif","DejaVu Serif",serif;font-size:13px}
  footer p{line-height:1.55;text-align:left;hyphens:none}

  /* Chaque grande pièce commence sur sa page : la carte du ciel, puis l'annexe. */
  section.block.chart-page{break-before:page;page-break-before:always;break-after:page;page-break-after:always;margin-top:0}
  section.block.annex{break-before:page;page-break-before:always;margin-top:0}
  /* Deux lignes vides avant l'annexe, demandées explicitement. À l'écran (où le
     saut de page n'existe pas) elles séparent vraiment les deux blocs ; à
     l'impression, elles tombent en fin de page précédente ou en haut de celle de
     l'annexe, sans jamais rien casser. */
  .annex-gap{height:calc(2 * var(--interligne) * 14.5px)}

  /* Les marges viennent de la PAGE, pas du rembourrage de la feuille.
     Le rembourrage d'une boîte ne s'applique qu'UNE fois : la première page
     recevait ses 2 cm en haut, les suivantes rien du tout, et le bas de page
     jamais. Mesuré sur le PDF livré : texte à 4,5 mm du haut et 7 mm du bas.
     @page se répète à chaque page, lui. */
  @page{size:A4;margin:20mm}
  /* La couverture est pleine page : seule la première page est sans marge.
     Si un navigateur ignore :first, la couverture se contente de la zone
     imprimable — d'où les hauteurs en vh, qui ne débordent jamais. */
  @page :first{margin:0}
  @media print{
    body{background:#fff}
    .sheet{width:auto;margin:0;box-shadow:none;padding:0}
    .cover-page{width:auto;min-height:100vh;margin:0;box-shadow:none}
    .cover-inner{min-height:100vh;padding:14mm 18mm}
    .caveat,.ai-review,.badge{break-inside:avoid;page-break-inside:avoid}
    a{color:inherit;text-decoration:none}
  }
  /* « screen and » est INDISPENSABLE : une page A4 mesure 794 px de large, donc
     « (max-width:900px) » est vraie à l'impression. Cette règle, plus bas dans la
     feuille que le bloc d'impression et de même spécificité, écrasait alors les
     2 cm de marge par 20 px (5,3 mm) — c'est exactement ce que montrait le PDF
     livré. Les règles d'écran ne doivent jamais s'appliquer au papier. */
  @media screen and (max-width:900px){
    /* Sur écran étroit, les 2 cm d'une feuille A4 ne tiennent pas : on garde un
       vrai air latéral (32 px ≈ 8,5 mm) au lieu des 20 px d'avant. */
    .sheet,.cover-page{width:100%;box-shadow:none;padding:28px 32px}
    .cover-inner{padding:32px 24px}
    .two-col{grid-template-columns:1fr}
    .big-three{width:100%;grid-template-columns:1fr}
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
      // La carte du ciel arrive avec son HTML calculé (roue SVG, graphiques).
      if (section.kind === "chart") {
        return `<section class="block chart-page"><div class="block-body">${section.html ?? ""}</div></section>`;
      }
      const classes = section.kind === "annex" ? "block annex" : "block";
      // Deux lignes vides avant l'annexe (voir .annex-gap).
      const avant = section.kind === "annex" ? '<div class="annex-gap" aria-hidden="true"></div>\n' : "";
      return `${avant}<section class="${classes}">
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
      ? `<div class="big-three">${placements
          .map(
            (placement) =>
              `<div class="big-card"><small>${escapeHtml(placement.label)}</small>` +
              `<b>${escapeHtml(placement.value)}</b>` +
              (placement.precision ? `<i>${escapeHtml(placement.precision)}</i>` : "") +
              "</div>"
          )
          .join("")}</div>`
      : "";
  // La marque sur la couverture : le premier mot suffit, la ligne complète est
  // trop longue pour l'interlettrage du titre.
  const marque = String(t.brand ?? "Lastro").split("·")[0].trim();

  return `<!doctype html>
<html lang="${escapeHtml(t.lang ?? "fr")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="cover-page">
  <div class="cover-inner">
    <div class="brand">${escapeHtml(marque)}</div>
    <div class="sparkle"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 0 L14.4 9.6 L24 12 L14.4 14.4 L12 24 L9.6 14.4 L0 12 L9.6 9.6 Z" fill="#d8c083"/></svg></div>
    <div class="kicker">${escapeHtml(t.titlePrefix)}</div>
    ${personLabel ? `<div class="cover-name">${escapeHtml(personLabel)}</div>` : `<div class="cover-name">${escapeHtml(title)}</div>`}
    ${coverCards}
    <div class="cover-note">${escapeHtml(t.coverNote ?? "")}</div>
    <div class="sparkle"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 0 L14.4 9.6 L24 12 L14.4 14.4 L12 24 L9.6 14.4 L0 12 L9.6 9.6 Z" fill="#d8c083"/></svg></div>
  </div>
</div>
<div class="sheet">
  <div class="caveat">${escapeHtml(t.caveat)}</div>
  ${body}
  <footer>
    ${aiReview ? `<p class="ai-review">${escapeHtml(aiReview)}</p>` : ""}
    <p class="ethical-closing">${escapeHtml(t.ethicalClosing)}</p>
    ${authorLine}
    <p>${writerNote}</p>
    ${verificationNote ? `<p>${escapeHtml(verificationNote)}</p>` : ""}
    <p>${escapeHtml(t.footer)}</p>
    <p>${escapeHtml(t.generatedOn)} ${escapeHtml(formatHumanDate(createdAt, t.lang))}</p>
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
    if (section.kind === "annex") {
      // Deux lignes vides avant l'annexe, comme dans le HTML.
      parts.push("", "");
    }
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
