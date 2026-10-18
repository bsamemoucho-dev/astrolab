// Entirely fictional birth; no customer records, storage, HTTP or LLM calls.
import { calculateWesternNatalChart } from '../../src/astro/westernNatal.mjs';
import { getPersonalCurrentSky } from '../../src/models/currentSkyService.mjs';
import { buildDossierEvidence } from '../../src/deliverables/dossierEvidence.mjs';
import { buildFullDossierPlan } from '../../src/deliverables/fullDossierPlan.mjs';
import { buildIndividualRelationalCommunicationPlan, buildIndividualRelationalAffectionPlan } from '../../src/deliverables/individualRelationalPlan.mjs';
export const syntheticInput = Object.freeze({ personId: 'synthetic_comparison', birthDate: '1980-01-10', timePrecision: 'exact', timeValue: '12:00', birthPlace: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris', coordinateSource: 'synthetic_fixture', coordinateConfidence: 'verified_fixture' });
export const nowUtc = '2026-10-18T12:00:00.000Z';
export async function buildSyntheticFixture() {
  const calculation = calculateWesternNatalChart(syntheticInput, { calculatedAt: nowUtc, runId: 'calc_synthetic_comparison' });
  const artifact = calculation.calculationArtifacts.find(a => a.type === 'structured_result');
  const ownerUserId = 'synthetic_owner';
  const state = { persons: [{ id: syntheticInput.personId, ownerUserId, isPrimary: true, createdAt: nowUtc }], calculationRuns: [{ ...calculation.calculationRun, ownerUserId, createdAt: nowUtc }], calculationArtifacts: [{ ...artifact, ownerUserId, calculationRunId: calculation.calculationRun.id, createdAt: nowUtc }] };
  const currentSky = await getPersonalCurrentSky({ async transact(fn) { return fn(state); } }, ownerUserId, { personId: syntheticInput.personId, nowUtc, horizonDays: 42 });
  const dossierEvidence = buildDossierEvidence({ natalResult: calculation.result, natalRun: calculation.calculationRun, currentSky, generatedAt: nowUtc });
  const fullDossierPlan = buildFullDossierPlan(dossierEvidence);
  const relationalPlans = [buildIndividualRelationalCommunicationPlan(dossierEvidence), buildIndividualRelationalAffectionPlan(dossierEvidence)];
  return { calculation, currentSky, dossierEvidence, fullDossierPlan, relationalPlans };
}
