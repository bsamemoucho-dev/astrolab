// Standalone complement: no account, payment, notification or browser storage.
const CSS = `
:root{color-scheme:light;--ink:#292e38;--muted:#646970;--line:#dedbd5;--paper:#faf8f4;--gold:#856137}*{box-sizing:border-box}body{margin:0;overflow-wrap:anywhere;background:var(--paper);color:var(--ink);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-underline-offset:3px}header,main,footer{max-width:1120px;margin:auto;padding:0 28px}header{display:flex;justify-content:space-between;align-items:center;gap:18px;min-height:88px;border-bottom:1px solid var(--line)}.brand{font:500 30px Georgia,serif;text-decoration:none}.back{font-size:14px;color:var(--muted)}main{padding-top:44px;padding-bottom:36px}.eyebrow{color:var(--gold);font-size:11px;letter-spacing:.14em;font-weight:700;text-transform:uppercase}h1,h2,h3{font-family:Georgia,"Times New Roman",serif;line-height:1.2;font-weight:500}h1{font-size:clamp(32px,5vw,48px);max-width:800px;margin:12px 0 18px}h2{font-size:29px;margin:0 0 16px}h3{font-size:21px;margin:0 0 10px}.intro{max-width:780px;color:var(--muted);margin-bottom:30px}.layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:28px;align-items:start}.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px}.aside{padding:8px 0}.aside section+section{border-top:1px solid var(--line);padding-top:18px;margin-top:18px}.aside p{font-size:14px;color:var(--muted);margin:0}label,.legend{display:block;font-size:14px;font-weight:650;margin-bottom:7px}.optional{font-size:12px;font-weight:400;color:var(--muted)}.field{margin-bottom:20px}input{width:100%;padding:12px 13px;border:1px solid #aaa69e;border-radius:9px;background:#fff;color:var(--ink);font:inherit;min-width:0}input:focus-visible,button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #d6bea0;outline-offset:3px}input:disabled{background:#f2f0eb;color:var(--muted)}fieldset{border:0;padding:0;margin:0 0 20px}legend{padding:0}.time-choice{display:flex;gap:12px;flex-wrap:wrap}.time-choice label{display:flex;align-items:center;gap:7px;font-weight:400;margin:0}.time-choice input{width:16px;height:16px;margin:0;accent-color:var(--gold)}.hint{font-size:12px;line-height:1.5;color:var(--muted);margin:7px 0 0}.place-field{position:relative}.place-options{position:absolute;z-index:2;top:calc(100% + 6px);left:0;right:0;background:#fff;box-shadow:0 12px 30px #27251f16;border:1px solid var(--line);border-radius:10px;max-height:285px;overflow:auto;padding:6px}.place-option{display:block;width:100%;background:#fff;color:var(--ink);text-align:left;border:0;border-radius:6px;font:inherit;font-size:14px;padding:10px;cursor:pointer}.place-option span{display:block;color:var(--muted);font-size:11px}.place-option:hover,.place-option[aria-selected="true"]{background:#f2ece3}.place-note{font-size:12px;color:var(--muted);margin:5px 9px}.selection{padding:8px 0;color:#51634d}.actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}button,.download{font:600 14px ui-sans-serif,system-ui,sans-serif;cursor:pointer;padding:12px 18px;border-radius:24px;border:1px solid var(--ink);background:var(--ink);color:#fff;text-decoration:none}button.secondary,.download{background:#fff;color:var(--ink);border-color:var(--line)}button:disabled,.download[aria-disabled="true"]{opacity:.55;cursor:wait}.privacy{margin-top:17px;padding-top:14px;border-top:1px solid var(--line)}.status{padding:14px 0;font-size:14px;min-height:50px}.status[data-kind="error"]{color:#9c3428}.help{margin-top:28px;border-top:1px solid var(--line);padding-top:19px}.help summary{cursor:pointer;font-weight:600}.help dl{font-size:14px}.help dt{font-weight:650;margin-top:15px}.help dd{margin:4px 0 0;color:var(--muted)}.limit{border-left:3px solid #b09267;padding:11px 14px;background:#f3eee5;margin-top:22px;font-size:13px}.result{margin-top:36px;border-top:1px solid var(--line);padding-top:28px}.result-bar{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}.result-bar h2{margin:0}.result-note{font-size:13px;color:var(--muted)}iframe{display:block;width:100%;min-height:600px;border:1px solid var(--line);border-radius:12px;background:#fff;margin-top:20px}footer{padding-top:22px;padding-bottom:30px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}[hidden]{display:none!important}@media(max-width:760px){header,main,footer{padding-left:18px;padding-right:18px}header{min-height:72px}.layout{grid-template-columns:1fr;gap:24px}main{padding-top:30px}.card{padding:21px}.aside{display:grid;gap:18px}.aside section+section{padding-top:16px;margin-top:0}.result-bar .actions{width:100%}.result-bar button,.download{flex:1;text-align:center}}`;

export function renderComplementPage() {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Votre complément de naissance | Lastro</title><style>${CSS}</style><script src="/complement/client.js" defer></script></head><body>
<header><a class="brand" href="/">Lastro</a><a class="back" href="/">Retour à l’accueil</a></header><main><div class="eyebrow">Complément indépendant</div><h1>Votre naissance, plusieurs cadres de lecture</h1><p class="intro">Retrouvez votre thème tropical, votre carte sidérale selon Lahiri, les périodes Vimshottari et les quatre piliers du BaZi. Chaque méthode garde ses conventions et ses limites : leurs ressemblances ne prouvent rien sur votre personnalité.</p>
<div class="layout"><div class="card"><h2>Vos repères de naissance</h2><form id="complement-form" method="post" action="/api/complement/calculate" autocomplete="off">
<div class="field"><label for="person-label">Prénom ou repère <span class="optional">facultatif</span></label><input id="person-label" name="personLabel" type="text" maxlength="80" autocomplete="off" placeholder="Un prénom suffit"></div>
<div class="field"><label for="birth-date">Date de naissance</label><input id="birth-date" name="birthDate" type="date" min="1901-01-01" max="2030-12-31" required aria-describedby="date-hint"><p class="hint" id="date-hint">Période de calcul vérifiée : 1901–2030.</p></div>
<fieldset><legend class="legend">Connaissez-vous l’heure de naissance ?</legend><div class="time-choice"><label><input type="radio" name="timePrecision" value="exact" checked>Oui</label><label><input type="radio" name="timePrecision" value="unknown">Non</label></div></fieldset>
<div class="field"><label for="birth-time">Heure locale de naissance</label><input id="birth-time" name="timeValue" type="time" required aria-describedby="time-hint"><p class="hint" id="time-hint">Indiquez l’heure de l’horloge sur place, sans conversion. Sans heure connue, les résultats incertains restent signalés.</p></div>
<div class="field"><label for="birth-place">Ville de naissance</label><div class="place-field" id="place-field"><input id="birth-place" name="placeName" type="text" required minlength="3" maxlength="160" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="place-options" aria-describedby="place-hint place-selection" placeholder="Rechercher une ville…"><div class="place-options" id="place-options" role="listbox" aria-label="Villes proposées" hidden></div></div><p class="hint" id="place-hint">Saisissez au moins trois caractères, puis choisissez la ville dans la liste.</p><p class="hint selection" id="place-selection" aria-live="polite"></p></div>
<div class="actions"><button id="calculate-button" type="submit">Calculer mon complément</button><button class="secondary" id="reset-button" type="button">Effacer</button></div><p class="hint privacy">Aucun compte, paiement ni e-mail n’est demandé. Les données de naissance sont envoyées au serveur pour le calcul, sans création de dossier ni conservation dans votre compte. Enregistrez le résultat si vous souhaitez le garder.</p><noscript><p>Activez JavaScript pour choisir la ville et afficher votre complément. Aucune commande n’est créée par ce formulaire.</p></noscript></form><div class="status" id="complement-status" role="status" aria-live="polite" tabindex="-1"></div></div>
<aside class="aside" aria-label="Ce que contient le complément"><section><h3>Carte sidérale / Jyotish</h3><p>Les positions sont recalculées dans un zodiaque sidéral avec l’ayanamsha Lahiri. Le secteur lunaire, appelé nakshatra, et son quart, le pada, sont affichés lorsqu’ils peuvent être déterminés.</p></section><section><h3>Périodes Vimshottari</h3><p>Ce calendrier traditionnel est construit à partir de la Lune sidérale. Les marges sur les dates sont indiquées ; une période ne garantit aucun événement à venir.</p></section><section><h3>Quatre piliers du BaZi</h3><p>Année, mois, jour et heure sont calculés selon les frontières solaires et l’heure civile locale. Ce choix est affiché : il peut différer d’un calcul en heure solaire vraie.</p></section><div class="limit">Ce complément présente des calculs et des repères symboliques documentés. Il n’est pas une prédiction ni une lecture psychologique complète. Il reste séparé de votre dossier Lastro habituel.</div></aside></div>
<details class="help"><summary>Quelques clés pour lire le résultat</summary><dl><dt>Un signe, un degré, une maison : quelle différence ?</dt><dd>Le signe et le degré situent un astre dans le zodiaque choisi. Les maisons divisent la carte selon le lieu et l’heure de naissance ; les maisons entières sont utilisées ici. Dans la tradition astrologique, la maison 5 renvoie notamment à la création et aux loisirs, la maison 7 aux partenariats. Ce sont des associations symboliques, pas des faits établis sur votre vie.</dd><dt>Pourquoi le signe peut-il changer entre deux cartes ?</dt><dd>Le zodiaque tropical et le zodiaque sidéral n’ont pas la même origine. Le décalage est annoncé et calculé ; un changement de signe ne constitue pas une contradiction entre les calculs.</dd><dt>Pourquoi certains résultats sont-ils incertains ?</dt><dd>Une heure inconnue ou une naissance proche d’une frontière peut donner plusieurs possibilités. Le complément les conserve au lieu de choisir arbitrairement. Aux hautes latitudes, les angles et les maisons peuvent rester indisponibles.</dd><dt>Est-ce un dossier rédigé par une IA ?</dt><dd>Non. Les positions et les périodes sont produites par les calculateurs. Les explications symboliques documentées sont séparées des résultats ; aucune génération IA payante n’est déclenchée.</dd></dl></details>
<section id="result-panel" class="result" aria-labelledby="result-title" hidden><div class="result-bar"><h2 id="result-title" tabindex="-1">Votre complément</h2><div class="actions"><button id="print-button" class="secondary" type="button" disabled>Imprimer / PDF</button><a id="download-button" class="download" href="#" download="complement-lastro.html" aria-disabled="true">Enregistrer le HTML</a></div></div><p class="result-note">Pour un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d’impression. Vérifiez l’aperçu avant d’enregistrer. Le document affiche les conventions et les incertitudes de chaque méthode.</p><iframe id="result-frame" title="Votre complément de naissance" sandbox="allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe></section>
</main><footer>Lastro · Les positions sont calculées ; les significations astrologiques relèvent de traditions symboliques. Aucune donnée n’est ajoutée à vos dossiers existants.</footer></body></html>`;
}

function complementClient() {
  'use strict';
  const byId = id => document.getElementById(id), form = byId('complement-form');
  if (!form) return;
  const label = byId('person-label'), date = byId('birth-date'), time = byId('birth-time');
  const placeInput = byId('birth-place'), field = byId('place-field'), list = byId('place-options'), selection = byId('place-selection');
  const status = byId('complement-status'), calculate = byId('calculate-button'), reset = byId('reset-button');
  const result = byId('result-panel'), frame = byId('result-frame'), print = byId('print-button'), download = byId('download-button');
  let place = null, candidates = [], active = -1, querySequence = 0, timer = null, searchController = null;
  let controller = null, sequence = 0, busy = false, html = '', blobUrl = null;
  const mode = () => document.querySelector('input[name="timePrecision"]:checked')?.value;
  function announce(message, error = false) { status.textContent = message; status.dataset.kind = error ? 'error' : 'info'; if (error) status.focus(); }
  function closeList() { list.hidden = true; active = -1; placeInput.setAttribute('aria-expanded', 'false'); placeInput.removeAttribute('aria-activedescendant'); }
  function clearReport() {
    html = ''; if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = null;
    download.removeAttribute('href'); download.setAttribute('aria-disabled', 'true'); print.disabled = true;
    frame.srcdoc = ''; frame.style.height = ''; result.hidden = true;
  }
  function updateTime() { time.disabled = mode() === 'unknown'; time.required = !time.disabled; }
  function choose(value) {
    place = value; placeInput.value = value.name; placeInput.setCustomValidity('');
    selection.textContent = `Ville retenue : ${value.name} · ${value.timeZone}. Le calcul utilise les coordonnées de cette ville.`; closeList();
  }
  function usable(value) {
    return value && typeof value.name === 'string' && value.name.trim() && value.name.length <= 300
      && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180
      && typeof value.timeZone === 'string' && value.timeZone.length > 0 && value.timeZone.length <= 100;
  }
  function paint(places, approximate) {
    list.replaceChildren(); candidates = places.filter(usable).slice(0, 12).map(value => ({ name: value.name.trim(),
      country: typeof value.country === 'string' ? value.country.slice(0, 100) : '', latitude: value.latitude, longitude: value.longitude, timeZone: value.timeZone }));
    const note = document.createElement('p'); note.className = 'place-note';
    note.textContent = candidates.length ? (approximate ? 'Résultats approchants : vérifiez la ville choisie.' : 'Choisissez votre ville.') : 'Aucune ville trouvée. Précisez le nom ou le pays.'; list.append(note);
    candidates.forEach((value, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'place-option'; button.id = `complement-place-${index}`; button.tabIndex = -1;
      button.setAttribute('role', 'option'); button.setAttribute('aria-selected', 'false'); button.textContent = value.name;
      const zone = document.createElement('span'); zone.textContent = value.timeZone; button.append(zone);
      button.addEventListener('mousedown', event => event.preventDefault()); button.addEventListener('click', () => choose(value)); list.append(button);
    });
    list.hidden = false; active = -1; placeInput.setAttribute('aria-expanded', 'true'); placeInput.removeAttribute('aria-activedescendant');
  }
  async function search(query, token) {
    searchController?.abort(); searchController = new AbortController();
    try {
      const response = await fetch(`/api/public/places/search?q=${encodeURIComponent(query)}`, { credentials: 'omit', cache: 'no-store', signal: searchController.signal });
      const data = await response.json(); if (token !== querySequence) return;
      if (!response.ok) throw new Error('PLACE_SEARCH_FAILED'); paint(Array.isArray(data.places) ? data.places : [], data.approximate === true);
    } catch (error) { if (token !== querySequence || error?.name === 'AbortError') return; closeList(); selection.textContent = 'La recherche de ville est indisponible. Réessayez dans un instant.'; }
  }
  function requestError(response, data) {
    const code = typeof data?.code === 'string' && /^[A-Z][A-Z0-9_]{2,70}$/.test(data.code) ? data.code : '';
    const suffix = code ? ` Référence : ${code}.` : '';
    if (response.status === 429 || response.status === 503) {
      const wait = Number(response.headers.get('retry-after')), delay = Number.isFinite(wait) && wait > 0 ? ` dans ${Math.min(3600, Math.ceil(wait))} secondes` : ' dans un instant';
      return `Le calcul est momentanément indisponible. Réessayez${delay}.${suffix}`;
    }
    if (response.status === 400 || response.status === 422) return `Le calcul n’a pas abouti. Vérifiez la date, l’heure locale et la ville sélectionnée.${suffix}`;
    return `Le complément n’a pas pu être calculé. Réessayez dans un instant.${suffix}`;
  }
  function resize() {
    if (!html) return;
    try { frame.style.height = `${Math.max(600, Math.max(frame.contentDocument.documentElement.scrollHeight, frame.contentDocument.body?.scrollHeight ?? 0) + 12)}px`; }
    catch { frame.style.height = '1000px'; }
  }
  frame.addEventListener('load', () => { if (!html) return; resize(); print.disabled = false; download.setAttribute('aria-disabled', 'false'); });
  print.addEventListener('click', () => {
    if (!html || print.disabled) return;
    try { frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch { announce('La fenêtre d’impression ne s’est pas ouverte. Enregistrez le HTML puis ouvrez-le dans votre navigateur.', true); }
  });
  download.addEventListener('click', event => { if (!blobUrl || download.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
  placeInput.addEventListener('input', () => {
    place = null; placeInput.setCustomValidity(''); selection.textContent = ''; clearTimeout(timer); searchController?.abort();
    const token = ++querySequence, query = placeInput.value.trim(); closeList(); if (query.length < 3) return;
    timer = setTimeout(() => search(query, token), 300);
  });
  placeInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeList(); return; } if (list.hidden || !candidates.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); active = event.key === 'ArrowDown' ? (active + 1) % candidates.length : (active <= 0 ? candidates.length - 1 : active - 1);
      list.querySelectorAll('[role="option"]').forEach((option, index) => option.setAttribute('aria-selected', String(index === active)));
      placeInput.setAttribute('aria-activedescendant', `complement-place-${active}`);
    } else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(candidates[active]); }
  });
  document.addEventListener('click', event => { if (!field.contains(event.target)) closeList(); });
  document.querySelectorAll('input[name="timePrecision"]').forEach(input => input.addEventListener('change', updateTime));
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if (!place || placeInput.value !== place.name) { placeInput.setCustomValidity('Choisissez une ville dans la liste avant de calculer.'); form.reportValidity(); placeInput.focus(); announce('Choisissez la ville de naissance dans la liste proposée.', true); return; }
    placeInput.setCustomValidity(''); if (!form.reportValidity()) return;
    busy = true; calculate.disabled = true; clearReport(); closeList(); announce('Calcul en cours. Cela peut prendre quelques secondes…');
    const token = ++sequence; controller = new AbortController(); const thisController = controller;
    const timeout = setTimeout(() => thisController.abort(), 30000);
    const birth = { birthDate: date.value, timePrecision: mode(), latitude: place.latitude, longitude: place.longitude, timeZone: place.timeZone, placeName: place.name, country: place.country };
    if (birth.timePrecision === 'exact') birth.timeValue = time.value;
    const input = { birth }; if (label.value.trim()) input.personLabel = label.value.trim();
    try {
      const response = await fetch('/api/complement/calculate', { method: 'POST', credentials: 'omit', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal: thisController.signal });
      const data = await response.json().catch(() => ({})); if (token !== sequence) return;
      if (!response.ok) { announce(requestError(response, data), true); return; }
      if (typeof data.html !== 'string' || data.html.length < 100) { announce('Le résultat reçu est incomplet. Réessayez dans un instant.', true); return; }
      html = data.html; blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })); download.href = blobUrl;
      result.hidden = false; frame.srcdoc = html;
      announce('Votre complément est prêt. Les résultats incertains et les conventions sont indiqués dans le document.'); byId('result-title').focus();
    } catch (error) {
      if (token !== sequence) return;
      announce(error?.name === 'AbortError' ? 'Le résultat n’a pas été reçu à temps. Réessayez dans un instant.' : 'Le résultat n’a pas pu être reçu. Vérifiez votre connexion puis réessayez.', true);
    } finally { clearTimeout(timeout); if (token === sequence) { busy = false; calculate.disabled = false; controller = null; } }
  });
  function erase() {
    ++sequence; ++querySequence; clearTimeout(timer); searchController?.abort(); controller?.abort(); searchController = null; controller = null;
    place = null; candidates = []; busy = false; calculate.disabled = false;
    clearReport(); closeList(); list.replaceChildren(); form.reset(); placeInput.setCustomValidity(''); selection.textContent = ''; updateTime(); announce('');
  }
  reset.addEventListener('click', () => { erase(); label.focus(); }); window.addEventListener('resize', resize); window.addEventListener('pagehide', erase); updateTime();
}

export const COMPLEMENT_CLIENT_JS = `(${complementClient.toString()})();\n`;
