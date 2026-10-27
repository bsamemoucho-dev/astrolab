import { parentPort, workerData } from 'node:worker_threads';
import { buildComplementPreview } from './index.mjs';
import { renderIndependentReading } from './render.mjs';
// No server, store, provider, mailer, or .env loader is imported here.
try {
  const report = buildComplementPreview({ ...workerData, generatedAt: new Date().toISOString() });
  parentPort.postMessage({ ok: true, html: renderIndependentReading(report, { presentation: 'web' }) });
} catch (error) {
  const invalid = error instanceof TypeError || error instanceof RangeError || Boolean(error?.status && error.status < 500);
  parentPort.postMessage({ ok: false, code: invalid ? 'INVALID_COMPLEMENT_INPUT' : 'COMPLEMENT_CALCULATION_FAILED' });
}
