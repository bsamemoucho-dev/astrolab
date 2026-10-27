#!/usr/bin/env node
// Local files only. No .env, API key, model, server or customer lifecycle.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildComplementPreview } from './index.mjs';
import { renderIndependentReading } from './render.mjs';

export function runPreview(args) {
  if (args.length !== 4) throw Object.assign(new TypeError('Arguments requis : --input FICHIER --out NOUVEAU_DOSSIER'), { code: 'INVALID_ARGUMENTS' });
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!['--input', '--out'].includes(flag) || Object.hasOwn(options, flag) || !args[i + 1] || args[i + 1].startsWith('--')) throw Object.assign(new TypeError('Argument non autorisé.'), { code: 'INVALID_ARGUMENTS' });
    options[flag] = args[i + 1];
  }
  if (!options['--input'] || !options['--out']) throw Object.assign(new TypeError('Arguments manquants.'), { code: 'INVALID_ARGUMENTS' });
  const target = resolve(options['--out']);
  if (existsSync(target)) throw Object.assign(new Error('Le répertoire de sortie doit être nouveau.'), { code: 'OUTPUT_ALREADY_EXISTS' });
  const inputPath = resolve(options['--input']);
  const bytes = readFileSync(inputPath);
  if (bytes.length > 64 * 1024) throw Object.assign(new RangeError('Entrée trop volumineuse.'), { code: 'INPUT_TOO_LARGE' });
  const report = buildComplementPreview(JSON.parse(bytes.toString('utf8')));
  const html = renderIndependentReading(report);
  // All calculation/validation succeeds before the first write. wx forbids an
  // accidental overwrite even if another process creates the same output.
  mkdirSync(target, { mode: 0o700 });
  writeFileSync(join(target, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  writeFileSync(join(target, 'preview.html'), html, { flag: 'wx', mode: 0o600 });
  return { status: 'local_preview', filesCreated: 2, aiCalls: 0, aiSpentUsd: 0 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(runPreview(process.argv.slice(2)))); }
  catch (error) { console.error(JSON.stringify({ code: error.code ?? 'LOCAL_PREVIEW_FAILED' })); process.exitCode = 1; }
}
