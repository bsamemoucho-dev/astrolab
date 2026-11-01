import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../src/http/app.mjs';
import { JsonStore } from '../../src/db/jsonStore.mjs';
import { FULL_DOSSIER_SECTIONS } from '../../src/deliverables/fullDossierPlan.mjs';
import { buildComplementPreview } from './index.mjs';
import { renderIndependentReading } from './render.mjs';
import { renderComplementPage } from './web-page.mjs';

// Only fictional birth data and a memory store; never a production account.
const input = () => ({ personLabel: 'Exemple fictif', birth: {
  birthDate: '1990-01-15', timePrecision: 'exact', timeValue: '16:30',
  latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris', placeName: 'Paris', country: 'France'
} });

test('the independent report gains one letter section, separately from the main dossier', () => {
  const report = buildComplementPreview({ ...input(), generatedAt: '2026-10-27T12:00:00Z' });
  const before = structuredClone(report);
  const html = renderIndependentReading(report, { presentation: 'web' });
  assert.equal([...html.matchAll(/id="soul-letter-title"/g)].length, 1);
  assert.match(html, /Lettre d’âme/u);
  assert.ok(html.indexOf('id="soul-letter-title"') > html.indexOf('id="bazi-title"'));
  assert.ok(html.indexOf('id="soul-letter-title"') < html.indexOf('id="limits-title"'));
  assert.match(html, /class="soul-letter"/);
  assert.doesNotMatch(renderIndependentReading(report), /id="soul-letter-title"/);
  assert.deepEqual(report, before);
  assert.ok(FULL_DOSSIER_SECTIONS.every(s => !/letter|lettre|soul/iu.test(s.sectionId)));
});

test('the form describes the bounded letter without promising a paid AI reading', () => {
  const html = renderComplementPage();
  assert.match(html, /<h3>Lettre d’âme<\/h3>/u);
  assert.match(html, /lorsqu’il est établi avec certitude/u);
  assert.match(html, /aucune génération IA payante n’est déclenchée/u);
  assert.match(html, /Il reste séparé de votre dossier Lastro habituel/u);
});

test('a real HTTP request through the isolated worker includes the letter and creates no customer record', async () => {
  const store = new JsonStore(null);
  const { server } = createApp({ store, outboxMaintenance: false, backgroundReadingJobs: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const before = await store.load();
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/complement/calculate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input())
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const result = await response.json();
    assert.equal(result.aiCalls, 0);
    assert.equal(result.saved, false);
    assert.match(result.html, /id="soul-letter-title"/);
    assert.deepEqual(await store.load(), before);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('an unknown birth time does not add an empty or generic letter to the report', () => {
  const fixture = input();
  fixture.birth.timePrecision = 'unknown';
  delete fixture.birth.timeValue;
  const report = buildComplementPreview({ ...fixture, generatedAt: '2026-10-27T12:00:00Z' });
  const html = renderIndependentReading(report, { presentation: 'web' });
  assert.doesNotMatch(html, /id="soul-letter-title"/);
  assert.match(html, /id="bazi-title"/);
});
