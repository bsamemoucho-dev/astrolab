import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { deleteAccount, getUserForSession, login, logout, register, verifyEmail } from "../auth/authService.mjs";
import { llmConfiguration } from "../deliverables/writers.mjs";
import { JsonStore } from "../db/jsonStore.mjs";
import { resolvePlaceForEntry, searchPlacesForEntry } from "../geo/placeResolver.mjs";
import { getAdminSummary, listAdminAuditLogs } from "../models/adminService.mjs";
import { createAnalysis, getAnalysis, listAnalyses } from "../models/analysisService.mjs";
import { consumeCredits, createDevelopmentCreditOrder, getCommerceSummary } from "../models/commerceService.mjs";
import { calculateWesternNatalForUser } from "../models/natalCalculationService.mjs";
import { createReport, listReports } from "../models/reportService.mjs";
import {
  deleteDeliverable,
  getDeliverable,
  getDeliverableContent,
  listDeliverables,
  markDeliverableReviewed,
  startDeliverableGeneration
} from "../models/deliverableService.mjs";
import {
  createLinkedPerson,
  createRelationship,
  deletePerson,
  deleteRelationship,
  exportDossier,
  getDossier,
  updateLinkedPerson,
  upsertPrimaryProfile
} from "../models/dossierService.mjs";
import { listMethodRegistry } from "../methodology/registry.mjs";
import { clearSessionCookie, parseCookies, readJson, sendJson, sendStatic, setSessionCookie } from "./httpUtils.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_PUBLIC_DIR = join(__dirname, "../../public");

async function requireUser(store, req) {
  const cookies = parseCookies(req.headers.cookie);
  const user = await getUserForSession(store, cookies.astrolab_session);
  if (!user) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  return user;
}

function route(method, pattern, handler) {
  return { method, pattern, handler };
}

function matchRoute(routes, req) {
  const url = new URL(req.url, "http://localhost");
  for (const candidate of routes) {
    if (candidate.method !== req.method) {
      continue;
    }
    const match = url.pathname.match(candidate.pattern);
    if (match) {
      return { handler: candidate.handler, params: match.groups ?? {}, url };
    }
  }
  return null;
}

export function createApp(options = {}) {
  const store =
    options.store ?? new JsonStore(options.dbPath ?? process.env.ASTROLAB_DB_PATH ?? join(process.cwd(), "data/astrolab.json"));
  const publicDir = options.publicDir ?? DEFAULT_PUBLIC_DIR;
  const commerceEnabled = options.commerceEnabled ?? process.env.ASTROLAB_ENABLE_COMMERCE !== "0";
  const allowRegistration = options.allowRegistration ?? process.env.ASTROLAB_ALLOW_REGISTRATION !== "0";

  const routes = [
    route("GET", /^\/healthz$/, async (_req, res) => {
      sendJson(res, 200, {
        ok: true,
        service: "astrolab",
        production: process.env.NODE_ENV === "production",
        time: new Date().toISOString()
      });
    }),
    route("GET", /^\/api\/config$/, async (_req, res) => {
      sendJson(res, 200, {
        commerceEnabled,
        allowRegistration,
        llmConfigured: Boolean(llmConfiguration()),
        llmModel: llmConfiguration()?.model ?? null,
        emailVerificationMode: process.env.ASTROLAB_EMAIL_MODE ?? "dev_code",
        production: process.env.NODE_ENV === "production"
      });
    }),
    route("POST", /^\/api\/auth\/register$/, async (req, res) => {
      if (!allowRegistration) {
        const error = new Error("Les inscriptions sont momentanément fermées.");
        error.status = 403;
        throw error;
      }
      const result = await register(store, await readJson(req));
      sendJson(res, 201, result);
    }),
    route("POST", /^\/api\/auth\/verify$/, async (req, res) => {
      const result = await verifyEmail(store, await readJson(req));
      sendJson(res, 200, result);
    }),
    route("POST", /^\/api\/auth\/login$/, async (req, res) => {
      const result = await login(store, await readJson(req));
      sendJson(res, 200, { user: result.user }, { "set-cookie": setSessionCookie(result.token) });
    }),
    route("POST", /^\/api\/auth\/logout$/, async (req, res) => {
      const cookies = parseCookies(req.headers.cookie);
      await logout(store, cookies.astrolab_session);
      sendJson(res, 200, { ok: true }, { "set-cookie": clearSessionCookie() });
    }),
    route("GET", /^\/api\/session$/, async (req, res) => {
      const cookies = parseCookies(req.headers.cookie);
      const user = await getUserForSession(store, cookies.astrolab_session);
      sendJson(res, 200, { user });
    }),
    route("GET", /^\/api\/me$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await getDossier(store, user.id));
    }),
    route("GET", /^\/api\/me\/export$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await exportDossier(store, user.id));
    }),
    route("PUT", /^\/api\/me\/profile$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await upsertPrimaryProfile(store, user.id, await readJson(req)));
    }),
    route("DELETE", /^\/api\/me$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await deleteAccount(store, user.id), { "set-cookie": clearSessionCookie() });
    }),
    route("GET", /^\/api\/people$/, async (req, res) => {
      const user = await requireUser(store, req);
      const dossier = await getDossier(store, user.id);
      sendJson(res, 200, { people: dossier.people, birthData: dossier.birthData });
    }),
    route("GET", /^\/api\/places\/search$/, async (req, res, _params, url) => {
      await requireUser(store, req);
      sendJson(res, 200, { places: await searchPlacesForEntry(url.searchParams.get("q")) });
    }),
    route("POST", /^\/api\/places\/resolve$/, async (req, res) => {
      await requireUser(store, req);
      try {
        sendJson(res, 200, { place: await resolvePlaceForEntry(await readJson(req)) });
      } catch (error) {
        if (error.status === 409) {
          sendJson(res, 409, { error: error.message, matches: error.matches });
          return;
        }
        throw error;
      }
    }),
    route("POST", /^\/api\/people$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 201, await createLinkedPerson(store, user.id, await readJson(req)));
    }),
    route("PUT", /^\/api\/people\/(?<id>[^/]+)$/, async (req, res, params) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await updateLinkedPerson(store, user.id, params.id, await readJson(req)));
    }),
    route("DELETE", /^\/api\/people\/(?<id>[^/]+)$/, async (req, res, params) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await deletePerson(store, user.id, params.id));
    }),
    route("GET", /^\/api\/relationships$/, async (req, res) => {
      const user = await requireUser(store, req);
      const dossier = await getDossier(store, user.id);
      sendJson(res, 200, { relationships: dossier.relationships });
    }),
    route("POST", /^\/api\/relationships$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 201, await createRelationship(store, user.id, await readJson(req)));
    }),
    route("DELETE", /^\/api\/relationships\/(?<id>[^/]+)$/, async (req, res, params) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await deleteRelationship(store, user.id, params.id));
    }),
    route("GET", /^\/api\/history$/, async (req, res) => {
      const user = await requireUser(store, req);
      const dossier = await getDossier(store, user.id);
      sendJson(res, 200, { history: dossier.history });
    }),
    route("GET", /^\/api\/analyses$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, { analyses: await listAnalyses(store, user.id) });
    }),
    route("POST", /^\/api\/analyses$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 201, await createAnalysis(store, user.id, await readJson(req)));
    }),
    route("POST", /^\/api\/western-natal\/calculate$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 201, await calculateWesternNatalForUser(store, user.id, await readJson(req)));
    }),
    route("GET", /^\/api\/analyses\/(?<id>[^/]+)$/, async (req, res, params) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await getAnalysis(store, user.id, params.id));
    }),
    route("GET", /^\/api\/analyses\/(?<id>[^/]+)\/reports$/, async (req, res, params) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, { reports: await listReports(store, user.id, params.id) });
    }),
    route("POST", /^\/api\/analyses\/(?<id>[^/]+)\/reports$/, async (req, res, params) => {
      const user = await requireUser(store, req);
      sendJson(res, 201, await createReport(store, user.id, params.id));
    }),
    route("GET", /^\/api\/commerce$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await getCommerceSummary(store, user.id));
    }),
    route("POST", /^\/api\/commerce\/dev-credit-order$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 201, await createDevelopmentCreditOrder(store, user.id, await readJson(req)));
    }),
    route("POST", /^\/api\/commerce\/consume$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await consumeCredits(store, user.id, await readJson(req)));
    }),
    route("GET", /^\/api\/admin\/summary$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await getAdminSummary(store, user));
    }),
    route("GET", /^\/api\/admin\/audit$/, async (req, res, _params, url) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await listAdminAuditLogs(store, user, Object.fromEntries(url.searchParams.entries())));
    }),
    route("GET", /^\/api\/methods$/, async (_req, res) => {
      sendJson(res, 200, { methods: await listMethodRegistry(store) });
    }),
    route("GET", /^\/api\/deliverables$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await listDeliverables(store, user.id));
    }),
    route("POST", /^\/api\/deliverables$/, async (req, res) => {
      const user = await requireUser(store, req);
      sendJson(res, 202, await startDeliverableGeneration(store, user.id, await readJson(req)));
    }),
    route("GET", /^\/api\/deliverables\/(?<id>[^/]+)$/, async (req, res, params) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await getDeliverable(store, user.id, params.id));
    }),
    route("GET", /^\/api\/deliverables\/(?<id>[^/]+)\/export$/, async (req, res, params, url) => {
      const user = await requireUser(store, req);
      const format = url.searchParams.get("format") ?? "html";
      const { version } = await getDeliverableContent(store, user.id, params.id);
      if (format === "html") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(version.html);
        return;
      }
      if (format === "md" || format === "markdown") {
        res.writeHead(200, { "content-type": "text/markdown; charset=utf-8" });
        res.end(version.markdown);
        return;
      }
      if (format === "json") {
        sendJson(res, 200, version);
        return;
      }
      sendJson(res, 400, { error: "Unsupported export format. Use html, md or json." });
    }),
    route("PATCH", /^\/api\/deliverables\/(?<id>[^/]+)\/review$/, async (req, res, params) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await markDeliverableReviewed(store, user.id, params.id, await readJson(req)));
    }),
    route("DELETE", /^\/api\/deliverables\/(?<id>[^/]+)$/, async (req, res, params) => {
      const user = await requireUser(store, req);
      sendJson(res, 200, await deleteDeliverable(store, user.id, params.id));
    })
  ];

  const server = createServer(async (req, res) => {
    try {
      const matched = matchRoute(routes, req);
      if (matched) {
        await matched.handler(req, res, matched.params, matched.url);
        return;
      }

      if (req.method === "GET") {
        await sendStatic(publicDir, req, res);
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      const status = error.status ?? (error instanceof SyntaxError ? 400 : 500);
      sendJson(res, status, { error: status === 500 ? "Internal server error" : error.message });
    }
  });

  return { server, store };
}
