import assert from 'node:assert/strict';
import test from 'node:test';
import { createFullPublicReading } from '../src/models/fullDossierService.mjs';

const birth = Object.freeze({ birthDate: '1990-01-15', timePrecision: 'exact', timeValue: '16:30',
  latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris', birthPlace: 'Paris', country: 'France' });

for (const [description, firstName, expected] of [
  ['a supplied name', '  Exemple fictif  ', 'Exemple fictif'],
  ['HTML in a name', '<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;'],
  ['no supplied name', null, 'Votre carte du ciel']
]) {
  test(`the full public service preserves cover personalization safely: ${description}`, async () => {
    let simulatedCalls = 0;
    const reading = await createFullPublicReading({ ...birth, firstName, deliveryEmail: 'never-use-as-name@example.com' }, {
      nowUtc: '2026-11-01T12:00:00.000Z', currentSky: null,
      structuredWriterFn: ({ sectionPlan }) => {
        simulatedCalls++;
        return { sectionId: sectionPlan.sectionId, blocks: sectionPlan.blockPlans.map(block => ({
          blockId: block.blockId, text: 'La lecture propose un repère symbolique ouvert à votre réflexion.'
        })) };
      }
    });
    assert.ok(simulatedCalls > 0);
    assert.equal(reading.observability.llmCalls, 0);
    assert.equal(reading.personLabel, firstName?.trim() || null);
    assert.ok(reading.html.includes(`<div class="cover-name">${expected}</div>`));
    assert.doesNotMatch(reading.html, /<img src=x|never-use-as-name@example\.com/);
    assert.equal(reading.verification.status, 'structured_validated');
  });
}
