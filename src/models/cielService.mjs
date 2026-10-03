import {
  createEditorialEvent,
  decorateEventForEdition,
  enumerateCelestialEvents,
  eventTypeLabelFr
} from "../astro/westernTransits.mjs";

const PUBLIC_BASE_URL = "https://www.lastro.fr";

const MONTHS_FR = Object.freeze([
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function monthRange(year, monthIndexZero) {
  const start = new Date(Date.UTC(year, monthIndexZero, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndexZero + 1, 1, 0, 0, 0));
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

function dayRangeUtc(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function relevantWindowEvents({ startUtc, endUtc }) {
  return enumerateCelestialEvents({ startUtc, endUtc }).map((event) => ({
    ...decorateEventForEdition(event),
    editorial: createEditorialEvent(event)
  }));
}

function splitEventsForHome(nowUtc) {
  const now = new Date(nowUtc ?? Date.now());
  const { start, end } = dayRangeUtc(now);
  const weekEnd = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const month = monthRange(now.getUTCFullYear(), now.getUTCMonth());
  const nextMonthsEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1, 0, 0, 0));
  const monthEvents = relevantWindowEvents(month);
  const horizonEvents = relevantWindowEvents({ startUtc: start.toISOString(), endUtc: nextMonthsEnd.toISOString() });

  return {
    today: monthEvents.filter((event) => {
      const date = new Date(event.peakUtc ?? event.startUtc);
      return date >= start && date < end;
    }),
    week: horizonEvents.filter((event) => {
      const date = new Date(event.peakUtc ?? event.startUtc);
      return date >= start && date < weekEnd;
    }),
    month: monthEvents,
    lunations: horizonEvents.filter((event) => ["new_moon", "full_moon"].includes(event.eventType)).slice(0, 5),
    retrogrades: horizonEvents.filter((event) => ["retrograde_station", "direct_station"].includes(event.eventType)).slice(0, 8),
    ingresses: horizonEvents
      .filter((event) => event.eventType === "sign_ingress" && ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"].includes(event.primaryBody))
      .slice(0, 8),
    majorAspects: horizonEvents
      .filter((event) => event.eventType === "planetary_aspect" && event.bodies.some((body) => ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"].includes(body)))
      .slice(0, 10)
  };
}

function eventLine(event) {
  const title = event.editorialTitle ?? event.titleFr ?? event.title;
  return `<li><time datetime="${escapeHtml(event.peakUtc ?? event.startUtc)}">${escapeHtml(event.localLabel)}</time><span>${escapeHtml(eventTypeLabelFr(event))}</span><strong>${escapeHtml(title)}</strong></li>`;
}

function eventList(events, emptyText) {
  if (!events.length) {
    return `<p class="ciel-empty">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul class="ciel-events">${events.map(eventLine).join("")}</ul>`;
}

function shell({ title, description, canonicalPath, body }) {
  const canonical = `${PUBLIC_BASE_URL}${canonicalPath}`;
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:type" content="website">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/guides/styles.css">
    <style>
      .ciel-page { max-width: 1080px; margin: 0 auto; padding: 32px 20px 56px; }
      .ciel-hero { margin: 16px 0 28px; }
      .ciel-hero h1 { margin-bottom: 10px; }
      .ciel-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
      .ciel-section { border-top: 1px solid rgba(255, 255, 255, 0.16); padding-top: 18px; }
      .ciel-section h2 { font-size: 1.25rem; margin: 0 0 12px; }
      .ciel-events { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
      .ciel-events li { display: grid; gap: 4px; padding: 0 0 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
      .ciel-events time, .ciel-events span, .ciel-empty, .ciel-note { color: #c9cbe2; }
      .ciel-events strong { color: #fff; font-size: 1.02rem; }
      .breadcrumb { font-size: 0.94rem; color: #c9cbe2; margin-bottom: 18px; }
      .breadcrumb a { color: inherit; }
      .ciel-month-link { display: inline-block; margin-top: 14px; }
      @media (max-width: 680px) { .ciel-page { padding: 24px 16px 44px; } }
    </style>
  </head>
  <body>
    <main class="ciel-page">${body}</main>
  </body>
</html>`;
}

export function renderCielHomePage({ nowUtc = null } = {}) {
  const sections = splitEventsForHome(nowUtc);
  return shell({
    title: "Ciel du moment | Lastro",
    description: "Calendrier astrologique factuel : lunaisons, rétrogradations, changements de signe et grands aspects à venir.",
    canonicalPath: "/ciel/",
    body: `
      <nav class="breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a> / Ciel du moment</nav>
      <section class="ciel-hero">
        <h1>Ciel du moment</h1>
        <p>Un calendrier calculé des principaux faits célestes, séparé des lectures personnelles.</p>
        <a class="ciel-month-link" href="/ciel/octobre-2026/">Voir octobre 2026</a>
      </section>
      <div class="ciel-grid">
        <section class="ciel-section"><h2>Aujourd'hui</h2>${eventList(sections.today, "Aucun fait céleste majeur détecté aujourd'hui.")}</section>
        <section class="ciel-section"><h2>Cette semaine</h2>${eventList(sections.week, "Aucun fait céleste majeur détecté cette semaine.")}</section>
        <section class="ciel-section"><h2>Ce mois-ci</h2>${eventList(sections.month, "Aucun fait céleste majeur détecté ce mois-ci.")}</section>
        <section class="ciel-section"><h2>Prochaines lunaisons</h2>${eventList(sections.lunations, "Aucune lunaison détectée dans la fenêtre.")}</section>
        <section class="ciel-section"><h2>Rétrogradations</h2>${eventList(sections.retrogrades, "Aucune station détectée dans la fenêtre.")}</section>
        <section class="ciel-section"><h2>Changements de signe importants</h2>${eventList(sections.ingresses, "Aucun changement de signe lent détecté dans la fenêtre.")}</section>
        <section class="ciel-section"><h2>Grands aspects à venir</h2>${eventList(sections.majorAspects, "Aucun grand aspect lent détecté dans la fenêtre.")}</section>
      </div>`
  });
}

export function october2026Events() {
  return relevantWindowEvents(monthRange(2026, 9));
}

export function renderCielOctober2026Page() {
  const events = october2026Events();
  return shell({
    title: "Ciel astrologique d'octobre 2026 | Lastro",
    description: "Calendrier factuel des lunaisons, stations, changements de signe et aspects astrologiques majeurs d'octobre 2026.",
    canonicalPath: "/ciel/octobre-2026/",
    body: `
      <nav class="breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a> / <a href="/ciel/">Ciel du moment</a> / Octobre 2026</nav>
      <section class="ciel-hero">
        <h1>Octobre 2026</h1>
        <p>${events.length} faits célestes calculés en UTC puis affichés pour l'édition France.</p>
      </section>
      <section class="ciel-section">
        <h2>Chronologie</h2>
        <ul class="ciel-events">
          ${events
            .map((event) => `<li><time datetime="${escapeHtml(event.peakUtc ?? event.startUtc)}">${escapeHtml(event.localLabel)}</time><span>Fait céleste · ${escapeHtml(eventTypeLabelFr(event))}</span><strong>${escapeHtml(event.editorialTitle ?? event.titleFr ?? event.title)}</strong></li>`)
            .join("")}
        </ul>
        <p class="ciel-note">Aucune lecture astrologique Lastro indexable n'est publiée automatiquement depuis ces faits : un événement céleste n'est pas une page éditoriale.</p>
      </section>`
  });
}

export function renderCielEventPageBySlug(_slug) {
  return null;
}
