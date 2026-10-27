import { readJson, securityHeaders, sendJson } from '../../src/http/httpUtils.mjs';
import { clientAddress, createRateLimiter, retryAfterSeconds } from '../../src/http/rateLimit.mjs';
import { createComplementExecutor } from './executor.mjs';
import { renderComplementPage, COMPLEMENT_CLIENT_JS } from './web-page.mjs';

const INPUT_KEYS = new Set(['birth', 'personLabel']);
const BIRTH_KEYS = new Set(['birthDate', 'timePrecision', 'timeValue', 'latitude', 'longitude', 'timeZone', 'placeName', 'country']);
const COMMON = {
  'cache-control': 'no-store, max-age=0', pragma: 'no-cache',
  'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer'
};
const CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self' blob:; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function inputAllowed(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !INPUT_KEYS.has(key))) return false;
  if (input.personLabel !== undefined && (typeof input.personLabel !== 'string' || input.personLabel.length > 200)) return false;
  const b = input.birth;
  if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).some(key => !BIRTH_KEYS.has(key))) return false;
  if (typeof b.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.birthDate) || !['exact', 'unknown'].includes(b.timePrecision)) return false;
  if (Number(b.birthDate.slice(0, 4)) < 1901 || Number(b.birthDate.slice(0, 4)) > 2030) return false;
  if (b.timePrecision === 'exact' && (typeof b.timeValue !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.timeValue))) return false;
  if (b.timePrecision === 'unknown' && b.timeValue !== undefined) return false;
  if (typeof b.latitude !== 'number' || !Number.isFinite(b.latitude) || Math.abs(b.latitude) > 90) return false;
  if (typeof b.longitude !== 'number' || !Number.isFinite(b.longitude) || Math.abs(b.longitude) > 180) return false;
  for (const key of ['timeZone', 'placeName', 'country']) {
    if (typeof b[key] !== 'string' || !b[key].trim() || b[key].length > 200) return false;
  }
  try { new Intl.DateTimeFormat('fr', { timeZone: b.timeZone }); } catch { return false; }
  return true;
}
function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host;
  } catch { return false; }
}
export function createComplementHttp({ executor = createComplementExecutor(), clientMax = 5, serviceMax = 30 } = {}) {
  const clients = createRateLimiter({ windowMs: 60_000, max: clientMax });
  const service = createRateLimiter({ windowMs: 3_600_000, max: serviceMax, maxKeys: 1 });
  const json = (res, status, payload, headers = {}) => sendJson(res, status, payload, { ...COMMON, ...headers });
  const unavailable = (res, code) => json(res, 503, {
    code, error: 'Le complément est momentanément indisponible. Réessayez dans un instant.'
  }, { 'retry-after': '30' });
  const routes = [
    { method: 'GET', pattern: /^\/complement\/?$/, handler: async (_req, res) => {
      res.writeHead(200, { ...securityHeaders(), ...COMMON, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP });
      res.end(renderComplementPage());
    } },
    { method: 'GET', pattern: /^\/complement\/client\.js$/, handler: async (_req, res) => {
      res.writeHead(200, { ...securityHeaders(), ...COMMON, 'content-type': 'text/javascript; charset=utf-8' });
      res.end(COMPLEMENT_CLIENT_JS);
    } },
    { method: 'POST', pattern: /^\/api\/complement\/calculate$/, handler: async (req, res, _params, url) => {
      // Mask errors here, before the app's generic URL/exception logger.
      if (!sameOrigin(req)) return json(res, 403, { code: 'COMPLEMENT_ORIGIN_REJECTED', error: 'Origine de la demande refusée.' });
      if (url.search) return json(res, 400, { code: 'INVALID_COMPLEMENT_INPUT', error: 'Les informations doivent être transmises dans le formulaire.' });
      const client = clientAddress(req);
      const clientLimit = clients.check(client);
      if (clientLimit.limited) return json(res, 429, { code: 'COMPLEMENT_RATE_LIMITED', error: 'Trop de demandes rapprochées. Réessayez dans un instant.' }, { 'retry-after': retryAfterSeconds(clientLimit.retryAfterMs) });
      clients.hit(client);
      const limit = service.check('service');
      if (limit.limited) return json(res, 429, { code: 'COMPLEMENT_RATE_LIMITED', error: 'Le complément a atteint sa capacité temporaire. Réessayez plus tard.' }, { 'retry-after': retryAfterSeconds(limit.retryAfterMs) });
      if (executor.busy) return json(res, 429, { code: 'COMPLEMENT_BUSY', error: 'Un calcul est en cours. Réessayez dans quelques secondes.' }, { 'retry-after': '5' });
      let input;
      try { input = await readJson(req); }
      catch (error) {
        const status = error?.status === 413 ? 413 : error?.status === 415 ? 415 : 400;
        return json(res, status, { code: 'INVALID_COMPLEMENT_INPUT', error: 'Le formulaire reçu est invalide ou trop volumineux.' });
      }
      if (!inputAllowed(input)) return json(res, 400, { code: 'INVALID_COMPLEMENT_INPUT', error: 'Vérifiez la date, l’heure et le lieu sélectionné (naissances de 1901 à 2030).' });
      service.hit('service');
      try {
        const result = await executor.calculate(input);
        return json(res, 200, { html: result.html, aiCalls: 0, saved: false });
      } catch (error) {
        if (error?.code === 'INVALID_COMPLEMENT_INPUT') return json(res, 400, { code: error.code, error: 'Ces données ne permettent pas de calculer le complément. Vérifiez notamment la date et l’heure locale.' });
        if (error?.code === 'COMPLEMENT_BUSY') return json(res, 429, { code: error.code, error: 'Un calcul est en cours. Réessayez dans quelques secondes.' }, { 'retry-after': '5' });
        return unavailable(res, ['COMPLEMENT_TIMEOUT', 'COMPLEMENT_UNAVAILABLE'].includes(error?.code) ? error.code : 'COMPLEMENT_CALCULATION_FAILED');
      }
    } }
  ];
  return { routes, close: () => executor.close() };
}
