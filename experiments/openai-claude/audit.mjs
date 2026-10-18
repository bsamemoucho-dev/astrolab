// Offline audit only. All provider transport is replaced locally; no paid call.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSyntheticFixture, syntheticInput, nowUtc } from './fixture.mjs';
import { writeStructuredSectionWithLlm, structuredSectionLlmConfiguration } from '../../src/deliverables/structuredSectionWriter.mjs';
import { validateStructuredSection, detectAstrologicalTextFacts } from '../../src/deliverables/factualClaimsValidator.mjs';
const destination = process.argv[2];
if (!destination) throw new Error('Usage: node experiments/openai-claude/audit.mjs <private-output-directory>');
globalThis.fetch = async () => { throw new Error('NETWORK_FORBIDDEN_IN_OFFLINE_AUDIT'); };
const fixture = await buildSyntheticFixture();
const { dossierEvidence, fullDossierPlan, relationalPlans, currentSky, calculation } = fixture;
const plans = [...fullDossierPlan.sections, ...relationalPlans.flatMap(p => p.sections)];
const transports = [], prefixFailures = [], blockFailures = [], sectionStats = [];
const logger = { warn() {} };
for (const plan of plans) {
  const model = structuredSectionLlmConfiguration(plan, { model: 'gpt-4o-mini' }).model;
  sectionStats.push({ sectionId: plan.sectionId, model, targetWords: plan.targetWords, maxWords: plan.maxWords, primary: plan.primaryEvidenceRefs.length, secondary: plan.secondaryEvidenceRefs.length, packets: plan.evidencePackets.length, blocks: plan.blockPlans.length, rules: plan.allowedInterpretationRuleRefs.length });
  for (const block of plan.blockPlans) {
    const scoped = { ...plan, blockPlans: [block] };
    if (block.deterministicPrefix) {
      const validation = validateStructuredSection({ dossierEvidence, sectionPlan: scoped, section: { sectionId: plan.sectionId, blocks: [{ blockId: block.blockId, text: block.deterministicPrefix }] } });
      if (!validation.ok) prefixFailures.push({ sectionId: plan.sectionId, blockId: block.blockId, issues: validation.issues });
    }
    const config = { apiKey: 'offline-placeholder', baseUrl: 'https://offline.invalid/v1', model, fetchFn: async (_url, request) => {
      const body = JSON.parse(request.body);
      transports.push({ sectionId: plan.sectionId, blockId: block.blockId, model: body.model, maxOutputTokens: body.max_tokens, promptBytes: Buffer.byteLength(JSON.stringify(body.messages)), messages: body.messages });
      return { ok: true, headers: new Headers(), async json() { return { choices: [{ message: { content: JSON.stringify({ sectionId: plan.sectionId, blocks: [{ blockId: block.blockId, text: 'Cette piste symbolique reste ouverte à votre propre réflexion.' }] }) } }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }; } };
    } };
    try { await writeStructuredSectionWithLlm({ dossierEvidence, sectionPlan: scoped, options: { config, logger } }); }
    catch (error) { blockFailures.push({ sectionId: plan.sectionId, blockId: block.blockId, code: error.code, issues: error.validation?.issues }); }
  }
}
const types = {};
for (const e of dossierEvidence.evidence) types[e.type] = (types[e.type] ?? 0) + 1;
const usageRefs = new Set(plans.flatMap(p => p.evidencePackets.flatMap(k => k.evidenceRefs)));
const unassigned = dossierEvidence.evidence.filter(e => !usageRefs.has(e.evidenceId)).map(e => ({ evidenceId: e.evidenceId, type: e.type }));
const aspectItems = calculation.result.structuralAstrology?.aspects?.items ?? [];
const skyBodies = {};
for (const [status, items] of Object.entries({ current: currentSky.current, upcoming: currentSky.upcoming, recent: currentSky.recent })) {
 skyBodies[status] = {}; for (const i of items) { const body = i.contact.transitBody; skyBodies[status][body] = (skyBodies[status][body] ?? 0) + 1; }
}
const promptBytes = transports.reduce((n,t) => n+t.promptBytes,0);
const report = { status: 'OFFLINE_PREPARATION_ONLY_NO_DOSSIERS_GENERATED', input: syntheticInput, nowUtc, evidenceTypes: types, sections: sectionStats, computedAspectItems: aspectItems.length, retainedAspects: aspectItems.filter(a => a.retained).length, retainedAspectValues: dossierEvidence.evidence.filter(e => e.type === 'NATAL_ASPECT').map(e=>e.value), currentSky: { window: currentSky.window, bodies: skyBodies }, unassigned, prefixFailures, blockFailures, dryRun: { calls: transports.length, promptBytes, roughInputTokens: { low: Math.ceil(promptBytes/4), high: Math.ceil(promptBytes/2.5) }, maxOutputTokensPerAttempt: transports.reduce((n,t)=>n+t.maxOutputTokens,0), models: [...new Set(transports.map(t=>t.model))] }, rejectedFreeTextSamples: [], realProviderCalls: 0, actualCostUsd: 0 };
await mkdir(destination,{recursive:true,mode:0o700});
for (const [name,data] of Object.entries({ 'audit.json': report, 'synthetic-evidence.json': dossierEvidence, 'synthetic-plans.json': plans, 'offline-prompts.json': transports })) await writeFile(resolve(destination,name), JSON.stringify(data,null,2)+'\n', {mode:0o600});
console.log(JSON.stringify({ sections:sectionStats.length, evidenceTypes:types, dryRun:report.dryRun, prefixFailures:prefixFailures.length, blockFailures:blockFailures.length, actualCostUsd:0 }));
