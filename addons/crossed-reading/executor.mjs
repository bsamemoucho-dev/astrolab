import { Worker } from 'node:worker_threads';

// One short-lived worker at a time, without production environment or secrets.
export function createComplementExecutor({ timeoutMs = 30_000, workerUrl = new URL('./worker.mjs', import.meta.url) } = {}) {
  let active = null;
  let closed = false;
  const failure = code => Object.assign(new Error(code), { code });
  return {
    get busy() { return active !== null; },
    async calculate(input) {
      if (closed) throw failure('COMPLEMENT_UNAVAILABLE');
      if (active) throw failure('COMPLEMENT_BUSY');
      return new Promise((resolve, reject) => {
        let worker;
        let timer;
        let settled = false;
        const finish = (error, result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          worker?.removeAllListeners();
          worker?.on('error', () => {});
          // Release the slot only after termination, including on timeout.
          Promise.resolve(worker?.terminate()).catch(() => {}).finally(() => {
            if (active?.worker === worker) active = null;
            error ? reject(error) : resolve(result);
          });
        };
        try {
          worker = new Worker(workerUrl, {
            workerData: input, env: {}, execArgv: [],
            resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 }
          });
          active = { worker, cancel: () => finish(failure('COMPLEMENT_UNAVAILABLE')) };
          timer = setTimeout(() => finish(failure('COMPLEMENT_TIMEOUT')), timeoutMs);
          timer.unref?.();
          worker.once('message', message => {
            if (message?.ok === true && typeof message.html === 'string' && message.html.length <= 2_000_000) finish(null, { html: message.html });
            else if (message?.code === 'INVALID_COMPLEMENT_INPUT') finish(failure(message.code));
            else finish(failure('COMPLEMENT_CALCULATION_FAILED'));
          });
          worker.once('error', () => finish(failure('COMPLEMENT_CALCULATION_FAILED')));
          worker.once('exit', () => finish(failure('COMPLEMENT_CALCULATION_FAILED')));
        } catch { finish(failure('COMPLEMENT_UNAVAILABLE')); }
      });
    },
    close() { closed = true; active?.cancel(); }
  };
}
