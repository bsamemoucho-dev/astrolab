import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { createComplementExecutor } from './executor.mjs';

const HTML = '<!doctype html><html><body>Calculated fixture</body></html>';
const PRIVATE_ERROR = 'DO_NOT_EXPOSE_WORKER_ERROR_OR_INPUT';
const codeIs = expected => error => {
  assert.equal(error.code, expected);
  assert.equal(error.message, expected);
  assert.ok(!JSON.stringify(error).includes(PRIVATE_ERROR));
  return true;
};
function fixture({ timeoutMs = 1_000, delayedTermination = false } = {}) {
  let instance, receivedOptions, release;
  let terminateCalls = 0;
  const termination = delayedTermination ? new Promise(resolve => { release = resolve; }) : Promise.resolve(0);
  const run = createComplementExecutor({ timeoutMs, workerFactory(_url, options) {
    receivedOptions = options;
    instance = new EventEmitter();
    instance.terminate = () => { terminateCalls++; return termination; };
    return instance;
  } });
  return { run, worker: () => instance, options: () => receivedOptions,
    terminations: () => terminateCalls, release: () => release?.(0) };
}

test('error before a queued valid message does not discard that response before exit', async () => {
  const f = fixture(), pending = f.run.calculate({ fixture: true });
  try {
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    assert.equal(f.run.busy, true);
    f.worker().emit('message', { ok: true, html: HTML });
    f.worker().emit('exit', 1);
    assert.deepEqual(await pending, { html: HTML });
    assert.equal(f.terminations(), 1);
    assert.equal(f.run.busy, false);
  } finally { f.run.close(); }
});

test('a valid message before error remains the sole accepted response', async () => {
  const f = fixture(), pending = f.run.calculate({ fixture: true });
  try {
    f.worker().emit('message', { ok: true, html: HTML });
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    f.worker().emit('exit', 1);
    assert.deepEqual(await pending, { html: HTML });
    assert.equal(f.terminations(), 1);
  } finally { f.run.close(); }
});

test('error followed by exit without a response stays blocking and masked', async () => {
  const f = fixture(), pending = f.run.calculate({ fixture: true });
  const rejected = assert.rejects(pending, codeIs('COMPLEMENT_CALCULATION_FAILED'));
  try {
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    assert.equal(f.run.busy, true);
    assert.equal(f.terminations(), 0);
    f.worker().emit('exit', 1);
    await rejected;
    assert.equal(f.terminations(), 1);
    assert.equal(f.run.busy, false);
  } finally { f.run.close(); }
});

test('an error cannot convert an invalid response or a later valid message into a fallback', async () => {
  const f = fixture(), pending = f.run.calculate({ fixture: true });
  const rejected = assert.rejects(pending, codeIs('COMPLEMENT_CALCULATION_FAILED'));
  try {
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    f.worker().emit('message', { ok: true, html: 42 });
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    f.worker().emit('message', { ok: true, html: HTML });
    f.worker().emit('exit', 1);
    await rejected;
    assert.equal(f.terminations(), 1);
  } finally { f.run.close(); }
});

test('a declared invalid-input response after an error still rejects with its safe code', async () => {
  const f = fixture(), pending = f.run.calculate({ fixture: true });
  const rejected = assert.rejects(pending, codeIs('INVALID_COMPLEMENT_INPUT'));
  try {
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    f.worker().emit('message', { ok: false, code: 'INVALID_COMPLEMENT_INPUT', details: PRIVATE_ERROR });
    f.worker().emit('exit', 1);
    await rejected;
  } finally { f.run.close(); }
});

test('close between error and message remains permanent and releases the slot only after termination', async () => {
  const f = fixture({ delayedTermination: true }), pending = f.run.calculate({ fixture: true });
  const rejected = assert.rejects(pending, codeIs('COMPLEMENT_UNAVAILABLE'));
  try {
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    f.run.close();
    f.worker().emit('message', { ok: true, html: HTML });
    f.worker().emit('exit', 1);
    assert.equal(f.run.busy, true);
    assert.equal(f.terminations(), 1);
    f.release();
    await rejected;
    assert.equal(f.run.busy, false);
    await assert.rejects(f.run.calculate({ fixture: true }), codeIs('COMPLEMENT_UNAVAILABLE'));
  } finally { f.release(); f.run.close(); }
});

test('timeout between error and message stays bounded and never accepts a late response', async () => {
  const f = fixture({ timeoutMs: 5 }), pending = f.run.calculate({ fixture: true });
  const rejected = assert.rejects(pending, codeIs('COMPLEMENT_TIMEOUT'));
  try {
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    // Keep one referenced timer alive; the executor's original timer stays unref'ed.
    await Promise.all([rejected, wait(10)]);
    f.worker().emit('message', { ok: true, html: HTML });
    f.worker().emit('exit', 1);
    assert.equal(f.terminations(), 1);
    assert.equal(f.run.busy, false);
  } finally { f.run.close(); }
});

test('exit without a response is final even if an impossible late message is emitted', async () => {
  const f = fixture(), pending = f.run.calculate({ fixture: true });
  const rejected = assert.rejects(pending, codeIs('COMPLEMENT_CALCULATION_FAILED'));
  try {
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    f.worker().emit('exit', 1);
    f.worker().emit('message', { ok: true, html: HTML });
    await rejected;
    assert.equal(f.terminations(), 1);
  } finally { f.run.close(); }
});

test('waiting for a terminal event preserves exclusion and empty environment/resource limits', async () => {
  const input = { fixture: true }, f = fixture(), pending = f.run.calculate(input);
  const rejected = assert.rejects(pending, codeIs('COMPLEMENT_CALCULATION_FAILED'));
  try {
    f.worker().emit('error', new Error(PRIVATE_ERROR));
    assert.equal(f.run.busy, true);
    await assert.rejects(f.run.calculate({ fixture: 'other' }), codeIs('COMPLEMENT_BUSY'));
    assert.deepEqual(f.options(), { workerData: input, env: {}, execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 } });
    f.worker().emit('exit', 1);
    await rejected;
    assert.equal(f.run.busy, false);
  } finally { f.run.close(); }
});
