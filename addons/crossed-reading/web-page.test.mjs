import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { COMPLEMENT_CLIENT_JS, renderComplementPage } from './web-page.mjs';

const PLACE = { id: 'fictive', name: 'Paris, France', country: 'France', latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris' };
const RESULT = '<!doctype html><html lang="fr"><head><title>Complément fictif</title></head><body><h1>Un résultat calculé pour le test</h1></body></html>';
const reply = (data, status = 200, retry = null) => ({ ok: status >= 200 && status < 300, status, headers: { get: key => key === 'retry-after' ? retry : null }, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function harness(answer = () => reply({ html: RESULT })) {
  let document;
  function node() {
    const events = new Map(), attrs = new Map();
    return {
      value: '', checked: false, disabled: false, required: false, hidden: false, textContent: '', children: [], style: {}, dataset: {}, validityMessage: '',
      addEventListener(name, fn) { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); },
      async emit(name, extra = {}) { const event = { target: this, prevented: false, preventDefault() { this.prevented = true; }, ...extra }; for (const fn of events.get(name) ?? []) await fn(event); return event; },
      append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
      setAttribute(key, value) { attrs.set(key, String(value)); }, getAttribute(key) { return attrs.get(key) ?? null; }, removeAttribute(key) { attrs.delete(key); },
      setCustomValidity(value) { this.validityMessage = value; }, focus() { document.activeElement = this; },
      contains(target) { return target === this || this.children.some(child => child.contains?.(target)); },
      querySelectorAll() { return this.children.filter(child => child.getAttribute?.('role') === 'option'); }
    };
  }
  const ids = ['complement-form', 'person-label', 'birth-date', 'birth-time', 'birth-place', 'place-field', 'place-options', 'place-selection', 'complement-status', 'calculate-button', 'reset-button', 'result-panel', 'result-frame', 'print-button', 'download-button', 'result-title'];
  const nodes = Object.fromEntries(ids.map(id => [id, node()]));
  const exact = node(), unknown = node(); exact.value = 'exact'; exact.checked = true; unknown.value = 'unknown';
  document = node(); document.getElementById = id => nodes[id] ?? null;
  document.createElement = node; document.querySelector = () => exact.checked ? exact : unknown;
  document.querySelectorAll = () => [exact, unknown];
  nodes['place-field'].append(nodes['birth-place'], nodes['place-options']);
  nodes['result-panel'].hidden = true; nodes['place-options'].hidden = true; nodes['print-button'].disabled = true;
  nodes['download-button'].setAttribute('aria-disabled', 'true');
  nodes['birth-date'].value = '1990-01-15'; nodes['birth-time'].value = '16:30';
  nodes['complement-form'].reportValidity = () => true;
  nodes['complement-form'].reset = () => { for (const id of ['person-label', 'birth-date', 'birth-time', 'birth-place']) nodes[id].value = ''; exact.checked = true; unknown.checked = false; };
  let prints = 0; nodes['result-frame'].contentWindow = { focus() {}, print() { prints++; } };
  nodes['result-frame'].contentDocument = { documentElement: { scrollHeight: 1500 }, body: { scrollHeight: 1400 } };
  const window = node(), calls = [], urls = [], revoked = [], timers = new Map(); let timerId = 0;
  const context = vm.createContext({ document, window, AbortController, Blob,
    URL: { createObjectURL(blob) { const url = `blob:test-${urls.length + 1}`; urls.push({ url, blob }); return url; }, revokeObjectURL(url) { revoked.push(url); } },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => { calls.push({ url, options }); return answer(url, options, calls.length); }
  });
  new vm.Script(COMPLEMENT_CLIENT_JS).runInContext(context);
  async function flushSearch() { for (const [id, timer] of [...timers]) if (timer.delay === 300) { timers.delete(id); await timer.fn(); } }
  async function choosePlace(value = PLACE, approximate = false) {
    const original = answer;
    answer = (url, options, count) => url.startsWith('/api/public/places/search') ? reply({ places: [value], approximate }) : original(url, options, count);
    nodes['birth-place'].value = 'Paris'; await nodes['birth-place'].emit('input'); await flushSearch();
    const option = nodes['place-options'].querySelectorAll()[0]; if (option) await option.emit('click');
  }
  return { nodes, exact, unknown, document, window, calls, urls, revoked, timers, flushSearch, choosePlace, prints: () => prints };
}

test('the independent page has a real form, local script, home link and accessible labels', () => {
  const html = renderComplementPage();
  assert.match(html, /<html lang="fr">/u); assert.match(html, /<a class="brand" href="\/">Lastro/u);
  assert.match(html, /<form id="complement-form" method="post" action="\/api\/complement\/calculate"/u);
  assert.match(html, /<script src="\/complement\/client\.js" defer><\/script>/u);
  assert.match(html, /aria-live="polite"/u); assert.match(html, /role="combobox"/u); assert.match(html, /role="listbox"/u);
  for (const id of ['birth-date', 'birth-time', 'birth-place', 'person-label']) assert.ok(html.includes(`for="${id}"`));
  const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map(match => match[1]); assert.equal(new Set(ids).size, ids.length);
  assert.match(html, /min="1901-01-01" max="2030-12-31"/u);
});

test('the document is sandboxed without scripts and the page has no remote assets or inline handlers', () => {
  const html = renderComplementPage();
  assert.match(html, /sandbox="allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox"/u);
  assert.doesNotMatch(html, /allow-scripts|\son[a-z]+\s*=|(?:src|href)="https?:/iu);
  assert.match(html, /name="referrer" content="no-referrer"/u);
  assert.match(html, /name="robots" content="noindex,nofollow"/u);
});

test('limits and methods are explicit without promising a completed personal portrait', () => {
  const html = renderComplementPage();
  for (const term of ['Lahiri', 'Vimshottari', 'BaZi', 'heure civile locale', 'heure solaire vraie', 'maison 5', 'maison 7', 'résultats incertains', 'lecture psychologique complète']) assert.ok(html.includes(term), term);
  assert.match(html, /aucune génération IA payante n’est déclenchée/u);
  assert.match(html, /sans création de dossier/u); assert.match(html, /sans conversion/u);
});

test('client script parses and does not persist, log, evaluate or request paid services', () => {
  assert.doesNotThrow(() => new vm.Script(COMPLEMENT_CLIENT_JS));
  assert.doesNotThrow(() => new vm.Script(COMPLEMENT_CLIENT_JS).runInNewContext({ document: { getElementById: () => null } }));
  assert.doesNotMatch(COMPLEMENT_CLIENT_JS, /localStorage|sessionStorage|indexedDB|document\.cookie|console\.|innerHTML|insertAdjacentHTML|\beval\s*\(|ANTHROPIC|OPENAI|checkout|stripe|sendEmail/iu);
  assert.doesNotMatch(renderComplementPage(), /type="email"|type="password"/u);
});

test('a typed but unselected city never starts a calculation', async () => {
  const h = harness(); h.nodes['birth-place'].value = 'Paris'; await h.nodes['complement-form'].emit('submit');
  assert.equal(h.calls.length, 0); assert.match(h.nodes['complement-status'].textContent, /Choisissez la ville/u);
  assert.match(h.nodes['birth-place'].validityMessage, /Choisissez/u);
});

test('the existing city API response is used and the selected city is sent by JSON POST', async () => {
  const h = harness(); await h.choosePlace(); h.nodes['person-label'].value = '  Repère fictif  ';
  await h.nodes['complement-form'].emit('submit');
  assert.equal(h.calls[0].url, '/api/public/places/search?q=Paris');
  const call = h.calls[1]; assert.equal(call.url, '/api/complement/calculate'); assert.equal(call.options.method, 'POST');
  assert.equal(call.options.credentials, 'omit'); assert.equal(call.options.cache, 'no-store'); assert.equal(call.options.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(call.options.body), { birth: { birthDate: '1990-01-15', timePrecision: 'exact', timeValue: '16:30', latitude: PLACE.latitude, longitude: PLACE.longitude, timeZone: PLACE.timeZone, placeName: PLACE.name, country: PLACE.country }, personLabel: 'Repère fictif' });
  assert.equal(h.nodes['result-frame'].srcdoc, RESULT); assert.equal(h.nodes['result-panel'].hidden, false); assert.equal(h.nodes['calculate-button'].disabled, false);
  assert.equal(h.urls.length, 1); assert.equal(h.urls[0].blob.type, 'text/html;charset=utf-8');
});

test('unknown time disables the clock and never serializes a leftover exact time', async () => {
  const h = harness(); await h.choosePlace(); h.exact.checked = false; h.unknown.checked = true; await h.unknown.emit('change');
  assert.equal(h.nodes['birth-time'].disabled, true); assert.equal(h.nodes['birth-time'].required, false);
  await h.nodes['complement-form'].emit('submit'); const input = JSON.parse(h.calls.at(-1).options.body);
  assert.equal(input.birth.timePrecision, 'unknown'); assert.equal(Object.hasOwn(input.birth, 'timeValue'), false);
});

test('changing the city invalidates the old coordinates until another explicit selection', async () => {
  const h = harness(); await h.choosePlace(); const before = h.calls.length;
  h.nodes['birth-place'].value = 'Lyon'; await h.nodes['birth-place'].emit('input'); await h.nodes['complement-form'].emit('submit');
  assert.equal(h.calls.length, before); assert.equal(h.nodes['place-selection'].textContent, '');
});

test('city labels are inserted as text and malformed candidates are refused', async () => {
  const h = harness(); await h.choosePlace({ ...PLACE, name: '<img src=x onerror=alert(1)>' }, true);
  assert.equal(h.nodes['birth-place'].value, '<img src=x onerror=alert(1)>');
  assert.match(h.nodes['place-options'].children[0].textContent, /approchants/u);
  const other = harness(); await other.choosePlace({ ...PLACE, latitude: Infinity });
  assert.equal(other.nodes['place-options'].querySelectorAll().length, 0);
  await other.nodes['complement-form'].emit('submit'); assert.equal(other.calls.length, 1);
});

test('the city chooser supports arrows, Enter and Escape', async () => {
  const h = harness(); h.nodes['birth-place'].value = 'Paris'; await h.nodes['birth-place'].emit('input');
  // Supply real response by using the normal helper, then reopen with another query.
  await h.choosePlace(); h.nodes['birth-place'].value = 'Paris'; await h.nodes['birth-place'].emit('input'); await h.flushSearch();
  await h.nodes['birth-place'].emit('keydown', { key: 'ArrowDown' }); assert.equal(h.nodes['birth-place'].getAttribute('aria-activedescendant'), 'complement-place-0');
  await h.nodes['birth-place'].emit('keydown', { key: 'Enter' }); assert.equal(h.nodes['birth-place'].value, PLACE.name); assert.equal(h.nodes['place-options'].hidden, true);
  await h.nodes['birth-place'].emit('keydown', { key: 'Escape' }); assert.equal(h.nodes['birth-place'].getAttribute('aria-expanded'), 'false');
});

test('rate limiting displays the retry interval and only a safe error code', async () => {
  const h = harness(() => reply({ code: 'COMPLEMENT_BUSY', error: 'private customer data' }, 429, '12'));
  await h.choosePlace(); await h.nodes['complement-form'].emit('submit');
  const message = h.nodes['complement-status'].textContent;
  assert.match(message, /12 secondes/u); assert.match(message, /COMPLEMENT_BUSY/u); assert.doesNotMatch(message, /private customer data/u);
  assert.equal(h.nodes['result-panel'].hidden, true); assert.equal(h.nodes['calculate-button'].disabled, false);
});

test('unsafe server messages and codes are never echoed to the visitor', async () => {
  const h = harness(() => reply({ code: '<script>PII</script>', error: 'private@example.invalid' }, 500));
  await h.choosePlace(); await h.nodes['complement-form'].emit('submit');
  assert.doesNotMatch(h.nodes['complement-status'].textContent, /PII|script|private@/u);
});

test('an incomplete response does not enable export or show an old result', async () => {
  const h = harness(() => reply({ html: 'incomplete' })); await h.choosePlace(); await h.nodes['complement-form'].emit('submit');
  assert.match(h.nodes['complement-status'].textContent, /incomplet/u); assert.equal(h.nodes['print-button'].disabled, true);
  assert.equal(h.nodes['result-panel'].hidden, true); assert.equal(h.urls.length, 0);
});

test('concurrent clicks cannot create a second in-flight calculation', async () => {
  const pending = deferred(), h = harness(() => pending.promise); await h.choosePlace();
  const first = h.nodes['complement-form'].emit('submit'); await h.nodes['complement-form'].emit('submit');
  assert.equal(h.calls.filter(call => call.url === '/api/complement/calculate').length, 1);
  pending.resolve(reply({ html: RESULT })); await first; assert.equal(h.nodes['result-panel'].hidden, false);
});

test('clearing the form aborts a request and a late response cannot restore birth data', async () => {
  const pending = deferred(), h = harness(() => pending.promise); await h.choosePlace();
  const first = h.nodes['complement-form'].emit('submit'); const request = h.calls.at(-1);
  await h.nodes['reset-button'].emit('click'); assert.equal(request.options.signal.aborted, true);
  pending.resolve(reply({ html: RESULT })); await first;
  assert.equal(h.nodes['result-panel'].hidden, true); assert.equal(h.nodes['result-frame'].srcdoc, ''); assert.equal(h.urls.length, 0);
  assert.equal(h.nodes['birth-date'].value, ''); assert.equal(h.nodes['place-selection'].textContent, '');
});

test('print uses the report frame and cleanup revokes the private download URL', async () => {
  const h = harness(); await h.choosePlace(); await h.nodes['complement-form'].emit('submit');
  await h.nodes['result-frame'].emit('load'); assert.equal(h.nodes['result-frame'].style.height, '1512px');
  assert.equal(h.nodes['download-button'].getAttribute('aria-disabled'), 'false'); await h.nodes['print-button'].emit('click'); assert.equal(h.prints(), 1);
  await h.window.emit('pagehide'); assert.deepEqual(h.revoked, ['blob:test-1']); assert.equal(h.nodes['result-frame'].srcdoc, ''); assert.equal(h.nodes['result-panel'].hidden, true);
});
