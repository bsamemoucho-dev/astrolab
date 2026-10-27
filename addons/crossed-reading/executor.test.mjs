import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { createComplementExecutor } from './executor.mjs';

const directory = await mkdtemp(join(tmpdir(), 'lastro-complement-executor-'));
const workerPath = join(directory, 'simulated-worker.mjs');
const HTML = '<!doctype html><html lang="fr"><head><title>Test fictif</title></head><body><h1>Complément simulé sans appel réseau ni calcul astrologique</h1></body></html>';
await writeFile(workerPath, `
import { parentPort, workerData } from 'node:worker_threads';
const html = ${JSON.stringify(HTML)};
switch (workerData?.mode) {
  case 'success': parentPort.postMessage({ok:true,html}); break;
  case 'delay': setTimeout(() => parentPort.postMessage({ok:true,html}), workerData.delayMs ?? 150); break;
  case 'park': setInterval(() => {}, 500); break;
  case 'throw': throw new Error('DO_NOT_EXPOSE_PRIVATE_WORKER_DETAILS');
  case 'exit': process.exit(0); break;
  case 'input-error': parentPort.postMessage({ok:false,code:'INVALID_COMPLEMENT_INPUT',details:'DO_NOT_EXPOSE_INPUT'}); break;
  case 'unexpected-code': parentPort.postMessage({ok:false,code:'DO_NOT_EXPOSE_PRIVATE_CODE'}); break;
  case 'invalid-message': parentPort.postMessage(workerData.message); break;
  case 'large-html': parentPort.postMessage({ok:true,html:'x'.repeat(2_000_001)}); break;
  case 'env': parentPort.postMessage({ok:true,html:JSON.stringify({keys:Object.keys(process.env),secret:process.env.LASTRO_COMPLEMENT_TEST_SECRET ?? null})}); break;
  case 'reply-then-error': parentPort.postMessage({ok:true,html}); throw new Error('DO_NOT_EXPOSE_AFTER_REPLY');
  case 'reply-and-live': {
    const values = new Int32Array(workerData.shared);
    setInterval(() => Atomics.add(values, 0, 1), 1);
    parentPort.postMessage({ok:true,html});
    break;
  }
}
`, { mode: 0o600 });
after(async () => { await rm(directory, { recursive: true, force: true }); });
const executor = (extra = {}) => createComplementExecutor({ timeoutMs: 5_000, workerUrl: pathToFileURL(workerPath), ...extra });
const codeIs = code => error => { assert.equal(error.code, code); assert.equal(error.message, code); return true; };

// Real worker threads exercise isolation and lifecycle; only their transport is
// simulated. No environment loader, HTTP API or production calculation runs.
test('a real isolated worker returns only the allowed HTML response', async () => {
  const run = executor();
  try {
    assert.equal(run.busy, false);
    assert.deepEqual(await run.calculate({mode:'success'}), {html:HTML});
    assert.equal(run.busy, false);
  } finally { run.close(); }
});

test('a second concurrent calculation is rejected and a later one is accepted', async () => {
  const run = executor();
  try {
    const first = run.calculate({mode:'delay',delayMs:150}); assert.equal(run.busy, true);
    await assert.rejects(run.calculate({mode:'success'}), codeIs('COMPLEMENT_BUSY'));
    assert.deepEqual(await first, {html:HTML}); assert.equal(run.busy, false);
    assert.deepEqual(await run.calculate({mode:'success'}), {html:HTML});
  } finally { run.close(); }
});

test('timeout terminates a worker and does not poison the next calculation', async () => {
  const run = executor({timeoutMs:500});
  try {
    await assert.rejects(run.calculate({mode:'park'}), codeIs('COMPLEMENT_TIMEOUT'));
    assert.equal(run.busy, false);
    assert.deepEqual(await run.calculate({mode:'success'}), {html:HTML});
  } finally { run.close(); }
});

for (const mode of ['throw','exit','unexpected-code']) {
  test(`${mode} is masked and a fresh worker can recover`, async () => {
    const run = executor();
    try {
      await assert.rejects(run.calculate({mode}), codeIs('COMPLEMENT_CALCULATION_FAILED'));
      assert.equal(run.busy, false);
      assert.deepEqual(await run.calculate({mode:'success'}), {html:HTML});
    } finally { run.close(); }
  });
}

test('only the declared safe input error code is retained', async () => {
  const run = executor();
  try { await assert.rejects(run.calculate({mode:'input-error'}), codeIs('INVALID_COMPLEMENT_INPUT')); }
  finally { run.close(); }
});

for (const [name,message] of [['null',null],['primitive','private'],['missing-html',{ok:true}],['numeric-html',{ok:true,html:42}],['failed-with-html',{ok:false,html:HTML}]]) {
  test(`invalid worker message (${name}) cannot become a report`, async () => {
    const run = executor();
    try {
      await assert.rejects(run.calculate({mode:'invalid-message',message}), codeIs('COMPLEMENT_CALCULATION_FAILED'));
      assert.equal(run.busy, false);
    } finally { run.close(); }
  });
}

test('an oversized HTML message is rejected', async () => {
  const run = executor();
  try { await assert.rejects(run.calculate({mode:'large-html'}), codeIs('COMPLEMENT_CALCULATION_FAILED')); }
  finally { run.close(); }
});

test('worker environment is empty even when the parent has a secret-shaped variable', async () => {
  const name = 'LASTRO_COMPLEMENT_TEST_SECRET', previous = process.env[name], run = executor();
  process.env[name] = 'parent-only-fictitious-value';
  try {
    const output = await run.calculate({mode:'env'});
    assert.deepEqual(JSON.parse(output.html), {keys:[],secret:null});
    assert.equal(process.env[name], 'parent-only-fictitious-value');
  } finally {
    run.close(); if (previous === undefined) delete process.env[name]; else process.env[name] = previous;
  }
});

test('closing while idle is permanent and idempotent', async () => {
  const run = executor(); run.close(); run.close();
  assert.equal(run.busy, false);
  await assert.rejects(run.calculate({mode:'success'}), codeIs('COMPLEMENT_UNAVAILABLE'));
});

test('closing during work cancels it and no late result can unlock the closed executor', async () => {
  const run = executor();
  const pending = run.calculate({mode:'park'});
  const rejected = assert.rejects(pending, codeIs('COMPLEMENT_UNAVAILABLE'));
  assert.equal(run.busy, true); run.close(); run.close(); await rejected;
  assert.equal(run.busy, false);
  await assert.rejects(run.calculate({mode:'success'}), codeIs('COMPLEMENT_UNAVAILABLE'));
});

test('a worker constructor failure is masked and leaves no busy slot', async () => {
  const run = executor({workerUrl:42});
  try {
    await assert.rejects(run.calculate({mode:'success'}), codeIs('COMPLEMENT_UNAVAILABLE'));
    assert.equal(run.busy, false);
  } finally { run.close(); }
});

test('a worker error immediately following a valid reply cannot escape as an unhandled error', async () => {
  const run = executor();
  try {
    assert.deepEqual(await run.calculate({mode:'reply-then-error'}), {html:HTML});
    await wait(20); assert.equal(run.busy, false);
    assert.deepEqual(await run.calculate({mode:'success'}), {html:HTML});
  } finally { run.close(); }
});

test('a worker is stopped after delivery even if its event loop would remain live', async () => {
  const run = executor(), shared = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT), values = new Int32Array(shared);
  try {
    assert.deepEqual(await run.calculate({mode:'reply-and-live',shared}), {html:HTML});
    const counter = Atomics.load(values,0); await wait(25);
    assert.equal(Atomics.load(values,0), counter); assert.equal(run.busy, false);
  } finally { run.close(); }
});
