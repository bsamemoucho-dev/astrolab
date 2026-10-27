import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../src/http/app.mjs';
import { JsonStore } from '../../src/db/jsonStore.mjs';
import { releaseInfo } from '../../src/http/release.mjs';

const input = () => ({ personLabel: 'Exemple fictif', birth: {
  birthDate: '1990-01-15', timePrecision: 'exact', timeValue: '16:30',
  latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris', placeName: 'Paris', country: 'France'
} });
async function start(complementHttp) {
  const store = new JsonStore(null);
  const { server } = createApp({ store, complementHttp, outboxMaintenance: false, backgroundReadingJobs: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    store, server, base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve))
  };
}
async function post(app, body, { headers = {}, suffix = '', raw = false } = {}) {
  const res = await fetch(`${app.base}/api/complement/calculate${suffix}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: raw ? body : JSON.stringify(body)
  });
  return { res, body: await res.json() };
}
function stub(overrides = {}) {
  return { busy: false, async calculate() { return { html: '<p>Calculated</p>' }; }, close() {}, ...overrides };
}

test('independent routes are reachable without a customer lifecycle and have privacy headers', async () => {
  const app = await start();
  try {
    const page = await fetch(`${app.base}/complement`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /id="complement-form"/);
    assert.match(page.headers.get('cache-control'), /no-store/);
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
    assert.match(page.headers.get('x-robots-tag'), /noindex/);
    assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
    assert.doesNotMatch(page.headers.get('content-security-policy'), /script-src[^;]*unsafe-inline/);
    const js = await fetch(`${app.base}/complement/client.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type'), /javascript/);
    assert.match(await js.text(), /\/api\/complement\/calculate/);
    const get = await fetch(`${app.base}/api/complement/calculate`);
    assert.equal(get.status, 404);
    assert.equal((await (await fetch(`${app.base}/healthz`)).json()).release, releaseInfo().fingerprint);
  } finally { await app.close(); }
});

test('real worker calculates all three methods and a bounded reading without persisting birth data', async () => {
  const app = await start();
  try {
    const before = JSON.stringify(await app.store.load());
    const result = await post(app, input());
    assert.equal(result.res.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.aiCalls, 0);
    assert.equal(result.body.saved, false);
    for (const id of ['jyotish-title', 'dasha-title', 'bazi-title', 'documented-reading-title']) assert.match(result.body.html, new RegExp(`id="${id}"`));
    assert.doesNotMatch(result.body.html, /Aperçu local ·|Base de préparation locale|id="symbolic-title"|Ce qui reste à préparer/);
    assert.match(result.body.html, /target="_blank" rel="noopener noreferrer"/);
    assert.match(result.body.html, /print-color-adjust:exact/);
    assert.match(result.body.html, /Content-Security-Policy/);
    assert.equal(JSON.stringify(await app.store.load()), before);
    assert.match(result.res.headers.get('cache-control'), /no-store/);
  } finally { await app.close(); }
});

test('invalid and injected inputs fail before calculation without echoing personal values', async () => {
  let calls = 0;
  const app = await start({ clientMax: 100, executor: stub({ calculate() { calls++; return { html: '<p>ok</p>' }; } }) });
  const cases = [null, [], {}, { ...input(), generatedAt: '2026-01-01' }, { ...input(), facts: [] }];
  for (const [key, value] of [
    ['birthDate', {}], ['birthDate', []], ['birthDate', { toString: null }], ['birthDate', '1800-01-01'],
    ['timeValue', {}], ['timeValue', ['16:30']], ['timeValue', '25:00'], ['latitude', '48.8'], ['latitude', 91],
    ['longitude', 181], ['timeZone', 'INVALID_PRIVATE_ZONE'], ['placeName', ''], ['houseSystem', 'PLACIDUS']
  ]) cases.push({ ...input(), birth: { ...input().birth, [key]: value } });
  try {
    for (const value of cases) {
      const result = await post(app, value);
      assert.equal(result.res.status, 400, JSON.stringify(value));
      assert.equal(result.body.code, 'INVALID_COMPLEMENT_INPUT');
      assert.doesNotMatch(JSON.stringify(result.body), /INVALID_PRIVATE_ZONE/);
    }
    assert.equal(calls, 0);
    assert.equal((await post(app, input(), { suffix: '?birthDate=private-value' })).res.status, 400);
  } finally { await app.close(); }
});

test('unknown time remains unknown and never supplies an artificial exact time', async () => {
  let captured;
  const app = await start({ executor: stub({ async calculate(value) { captured = value; return { html: '<p>ok</p>' }; } }) });
  const value = input(); value.birth.timePrecision = 'unknown'; delete value.birth.timeValue;
  try {
    assert.equal((await post(app, value)).res.status, 200);
    assert.equal(captured.birth.timePrecision, 'unknown');
    assert.equal(Object.hasOwn(captured.birth, 'timeValue'), false);
    assert.equal((await post(app, { ...value, birth: { ...value.birth, timeValue: '12:00' } })).res.status, 400);
  } finally { await app.close(); }
});

test('cross-site, malformed JSON, wrong media type and oversized input stay masked', async () => {
  const app = await start({ clientMax: 100, executor: stub({ calculate() { assert.fail('invalid input reached worker'); } }) });
  try {
    assert.equal((await post(app, input(), { headers: { origin: 'https://other.example' } })).res.status, 403);
    assert.equal((await post(app, input(), { headers: { 'sec-fetch-site': 'cross-site' } })).res.status, 403);
    assert.equal((await post(app, '{invalid-private-value', { raw: true })).res.status, 400);
    assert.equal((await post(app, input(), { headers: { 'content-type': 'text/plain' } })).res.status, 415);
    assert.equal((await post(app, JSON.stringify({ private: 'x'.repeat(66_000) }), { raw: true })).res.status, 413);
  } finally { await app.close(); }
});

test('client and service quotas reject excess calculations with retry-after', async () => {
  const app = await start({ clientMax: 1, serviceMax: 2, executor: stub() });
  try {
    assert.equal((await post(app, input())).res.status, 200);
    let result = await post(app, input());
    assert.equal(result.res.status, 429); assert.ok(Number(result.res.headers.get('retry-after')) > 0);
    assert.equal((await post(app, input(), { headers: { 'x-forwarded-for': '192.0.2.1' } })).res.status, 200);
    result = await post(app, input(), { headers: { 'x-forwarded-for': '192.0.2.2' } });
    assert.equal(result.res.status, 429); assert.equal(result.body.code, 'COMPLEMENT_RATE_LIMITED');
  } finally { await app.close(); }
});

for (const [code, status] of [['INVALID_COMPLEMENT_INPUT',400], ['COMPLEMENT_TIMEOUT',503], ['COMPLEMENT_UNAVAILABLE',503], ['COMPLEMENT_BUSY',429], ['PRIVATE_INTERNAL_FAILURE',503]]) {
  test(`worker failure ${code} is masked and leaves health and existing routes available`, async () => {
    const app = await start({ executor: stub({ async calculate() { throw Object.assign(new Error('private birth data'), { code }); } }) });
    try {
      const result = await post(app, input());
      assert.equal(result.res.status, status);
      assert.doesNotMatch(JSON.stringify(result.body), /private birth data|PRIVATE_INTERNAL_FAILURE/);
      assert.equal((await fetch(`${app.base}/healthz`)).status, 200);
      assert.equal((await fetch(`${app.base}/`)).status, 200);
    } finally { await app.close(); }
  });
}

test('a busy calculator does not start another job and shutdown closes its executor', async () => {
  let closed = false;
  const app = await start({ executor: stub({ busy: true, calculate() { assert.fail('busy calculation started'); }, close() { closed = true; } }) });
  try {
    const result = await post(app, input());
    assert.equal(result.res.status, 429);
    assert.equal(result.body.code, 'COMPLEMENT_BUSY');
  } finally { await app.close(); }
  assert.equal(closed, true);
});
