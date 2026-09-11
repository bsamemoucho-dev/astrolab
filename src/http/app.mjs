import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { deleteAccount, getUserForSession, login, logout, register, verifyEmail } from "../auth/authService.mjs";
import { llmConfiguration } from "../deliverables/writers.mjs";
import { JsonStore } from "../db/jsonStore.mjs";
import { resolvePlaceForEntry, searchPlacesForEntryDetailed } from "../geo/placeResolver.mjs";
import { getAdminSummary, listAdminAuditLogs } from "../models/adminService.mjs";
import { createAnalysis, getAnalysis, listAnalyses } from "../models/analysisService.mjs";
import { consumeCredits, createDevelopmentCreditOrder, getCommerceSummary } from "../models/commerceService.mjs";
import { calculateWesternNatalForUser } from "../models/natalCalculationService.mjs";
import { createPublicReading } from "../models/publicReadingService.mjs";
import {
  createPaidDelivery,
  deleteDeliveryByToken,
  deliveryLink,
  findDeliveryByReference,
  getDeliveryByToken,
  maskEmail,
  markDeliveryFailed,
  findDeliveryByPaymentSession,
  markDeliveryGenerating,
  markDeliveryReady,
  publicDelivery,
  queueDeliveryEmail
} from "../models/publicDeliveryService.mjs";
import { emailEnabled, flushQueuedEmails, sendEmail } from "../notifications/mailer.mjs";
import {
  createEmbeddedCheckoutSession,
  lastStripeFailure,
  MAX_AMOUNT_CENTS,
  MIN_AMOUNT_CENTS,
  retrieveCheckoutSession,
  stripeConfiguration,
  stripeKeyDiagnostics,
  stripeKeyNotice,
  stripeKeyProblem
} from "../payments/stripe.mjs";
import {
  registerTestCodeFailure,
  testCodeEnabled,
  testCodeMatches,
  testCodeRateLimited
} from "../payments/freeAccess.mjs";
import { generateDailyHoroscope } from "../models/horoscopeService.mjs";
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

// Adresse publique du site, pour construire les liens de récupération : on se
// fie à l'hôte de la requête (fonctionne sur le domaine final comme sur une
// préversion), jamais à une valeur codée en dur.
function publicBaseUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() || "https";
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}

// Seules les données nécessaires à une reprise de rédaction sont conservées :
// jamais l'identifiant de paiement ni le code de test.
function storableInput(body) {
  return {
    firstName: body.firstName ?? null,
    language: body.language ?? null,
    birthDate: body.birthDate ?? null,
    timePrecision: body.timePrecision ?? null,
    timeValue: body.timeValue ?? null,
    timeMarginMinutes: body.timeMarginMinutes ?? null,
    timeStart: body.timeStart ?? null,
    timeEnd: body.timeEnd ?? null,
    resolvedPlace: body.resolvedPlace ?? null,
    intention: body.intention ?? null,
    parents: body.parents ?? null
  };
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
    // Parcours public « sans compte » : résolution de lieu et lecture, aucune
    // inscription, aucune donnée personnelle persistée.
    route("GET", /^\/api\/public\/places\/search$/, async (_req, res, _params, url) => {
      sendJson(res, 200, await searchPlacesForEntryDetailed(url.searchParams.get("q")));
    }),
    route("POST", /^\/api\/public\/places\/resolve$/, async (req, res) => {
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
    route("POST", /^\/api\/public\/checkout-session$/, async (req, res) => {
      const body = await readJson(req);
      sendJson(
        res,
        201,
        await createEmbeddedCheckoutSession({
          amountCents: body.amountCents,
          label: body.label ?? "Lecture symbolique Lastro"
        })
      );
    }),
    route("POST", /^\/api\/public\/readings$/, async (req, res) => {
      const body = await readJson(req);

      // Accès gratuit de test : code d'exploitant, comparé côté serveur.
      let freeAccess = false;
      const testCode = String(body.testCode ?? "").trim();
      if (testCode) {
        if (!testCodeEnabled()) {
          const error = new Error("Aucun code de test n'est configuré sur ce site.");
          error.status = 400;
          throw error;
        }
        if (!testCodeMatches(testCode)) {
          // La limite ne porte que sur les codes invalides : un code correct
          // reste utilisable même si quelqu'un a essayé de le deviner.
          if (testCodeRateLimited()) {
            const error = new Error("Trop de codes de test invalides. Réessayez dans une heure.");
            error.status = 429;
            throw error;
          }
          registerTestCodeFailure();
          const error = new Error("Code de test invalide.");
          error.status = 403;
          throw error;
        }
        freeAccess = true;
        console.log(`[Lastro] lecture offerte (code de test) — ${new Date().toISOString()}`);
      }

      let payment = null;
      let existingDelivery = null;
      if (!freeAccess) {
        // Clés Stripe présentes mais inutilisables (recopie incomplète, modes
        // mélangés…) : on refuse la lecture plutôt que de l'offrir par accident.
        if (stripeKeyProblem()) {
          const error = new Error("Le paiement est momentanément indisponible. Merci de réessayer dans quelques minutes.");
          error.status = 503;
          throw error;
        }

        // Paiement obligatoire dès que Stripe est configuré (sinon mode test/dev).
        if (stripeConfiguration()) {
          const sessionId = String(body.paymentSessionId ?? "").trim();
          if (!sessionId) {
            const error = new Error("Le paiement est requis pour recevoir votre lecture.");
            error.status = 402;
            throw error;
          }
          // Un paiement = une lecture, pour toujours : si la lecture existe déjà
          // et qu'elle est prête, on la relivre telle quelle, sans rien régénérer
          // ni redemander de paiement. C'est ce qui rend une perte réparable.
          existingDelivery = await findDeliveryByPaymentSession(store, sessionId);
          if (existingDelivery?.status === "ready") {
            const link = deliveryLink(existingDelivery.token, publicBaseUrl(req));
            sendJson(res, 200, {
              schema: "astrolab.public_reading",
              status: "delivered",
              ...existingDelivery.reading,
              delivery: { reference: existingDelivery.reference, link, expiresAt: existingDelivery.expiresAt }
            });
            return;
          }
          const session = await retrieveCheckoutSession(sessionId);
          if (session.payment_status !== "paid") {
            const error = new Error("Le paiement n'est pas encore confirmé. Patientez quelques secondes puis réessayez.");
            error.status = 402;
            throw error;
          }
          payment = {
            sessionId,
            email: session.customer_details?.email ?? null,
            amountCents: Number.isFinite(session.amount_total) ? session.amount_total : null,
            currency: session.currency ?? null
          };
        }
      }

      // La lecture est enregistrée AVANT la rédaction : si la rédaction échoue
      // ou si le client ferme la page au mauvais moment, elle reste
      // récupérable via son lien, sans jamais repayer.
      let delivery = existingDelivery;
      if (!delivery) {
        const created = await createPaidDelivery(store, {
          paymentSessionId: payment?.sessionId ?? null,
          email: payment?.email ?? null,
          amountCents: payment?.amountCents ?? null,
          currency: payment?.currency ?? null,
          language: body.language ?? null,
          input: storableInput(body),
          freeAccess
        });
        delivery = created.delivery;
      }
      await markDeliveryGenerating(store, delivery.id);

      // En reprise, on repart des données enregistrées avec le paiement : le
      // client a peut-être fermé la page, on ne dépend pas de ce qu'il renvoie.
      const readingInput = existingDelivery ? (existingDelivery.input ?? body) : body;

      try {
        const reading = await createPublicReading(readingInput);
        await markDeliveryReady(store, delivery.id, reading);
        const link = deliveryLink(delivery.token, publicBaseUrl(req));
        await queueDeliveryEmail(store, delivery, { link });
        // L'envoi ne doit jamais faire échouer la livraison : en cas d'échec,
        // le message reste dans la file et le client a déjà son lien à l'écran.
        const mail = await flushQueuedEmails(store).catch(() => ({ sent: 0, skipped: true }));
        sendJson(res, 200, {
          ...reading,
          ...(freeAccess ? { freeAccess: true } : {}),
          delivery: {
            reference: delivery.reference,
            link,
            expiresAt: delivery.expiresAt,
            email: maskEmail(delivery.email),
            emailSent: mail.sent > 0,
            emailConfigured: emailEnabled()
          }
        });
      } catch (error) {
        await markDeliveryFailed(store, delivery.id, error.message);
        throw error;
      }
    }),
    // Vérification de la configuration d'envoi, réservée à l'exploitant : mieux
    // vaut tester l'e-mail avant qu'un client en dépende.
    route("POST", /^\/api\/public\/test-email$/, async (req, res) => {
      const body = await readJson(req);
      if (!testCodeEnabled() || !testCodeMatches(String(body.testCode ?? ""))) {
        if (testCodeEnabled()) {
          registerTestCodeFailure();
        }
        const error = new Error("Code de test invalide.");
        error.status = 403;
        throw error;
      }
      if (!emailEnabled()) {
        const error = new Error("L'envoi d'e-mails n'est pas configuré : ajoutez BREVO_API_KEY et BREVO_SENDER_EMAIL.");
        error.status = 503;
        throw error;
      }
      const to = String(body.to ?? "").trim();
      await sendEmail({
        to,
        subject: "Test d'envoi Lastro",
        text:
          "Cet e-mail confirme que l'envoi fonctionne depuis Lastro.\n\n" +
          "Si vous le recevez, les liens de récupération de lecture partiront correctement.\n" +
          `Envoyé le ${new Date().toISOString()}.`
      });
      sendJson(res, 200, { sent: true, to: maskEmail(to) });
    }),
    // Lien perdu : le client redonne son numéro de commande et l'e-mail utilisé
    // au paiement, et reçoit le lien à cette adresse. La réponse est identique
    // que la commande existe ou non, pour ne rien révéler à un curieux.
    route("POST", /^\/api\/public\/deliveries\/recover$/, async (req, res) => {
      const body = await readJson(req);
      const reference = String(body.reference ?? "").trim().toUpperCase().replace(/\s+/g, "");
      const email = String(body.email ?? "").trim().toLowerCase();
      const delivery = reference && email ? await findDeliveryByReference(store, reference) : null;

      if (delivery && delivery.email && delivery.email === email) {
        const link = deliveryLink(delivery.token, publicBaseUrl(req));
        await queueDeliveryEmail(store, delivery, { link });
        await flushQueuedEmails(store).catch(() => null);
        console.log(`[Lastro] lien de lecture renvoyé — ${delivery.reference}`);
      }
      sendJson(res, 200, { requested: true });
    }),
    // Récupération d'une lecture payée : le jeton du lien est le seul secret.
    route("GET", /^\/api\/public\/deliveries\/(?<token>[^/]+)$/, async (_req, res, params) => {
      const delivery = await getDeliveryByToken(store, params.token);
      if (!delivery) {
        const error = new Error("Ce lien de lecture est inconnu ou a expiré.");
        error.status = 404;
        throw error;
      }
      sendJson(res, 200, { delivery: publicDelivery(delivery) });
    }),
    route("DELETE", /^\/api\/public\/deliveries\/(?<token>[^/]+)$/, async (_req, res, params) => {
      sendJson(res, 200, { deleted: await deleteDeliveryByToken(store, params.token) });
    }),
    // Reprise d'une rédaction qui avait échoué : le client a déjà payé, on ne
    // lui redemande jamais de payer.
    route("POST", /^\/api\/public\/deliveries\/(?<token>[^/]+)\/regenerate$/, async (_req, res, params) => {
      const delivery = await getDeliveryByToken(store, params.token);
      if (!delivery) {
        const error = new Error("Ce lien de lecture est inconnu ou a expiré.");
        error.status = 404;
        throw error;
      }
      if (delivery.status !== "ready") {
        await markDeliveryGenerating(store, delivery.id);
        try {
          const reading = await createPublicReading(delivery.input ?? {});
          await markDeliveryReady(store, delivery.id, reading);
        } catch (error) {
          await markDeliveryFailed(store, delivery.id, error.message);
          throw error;
        }
      }
      sendJson(res, 200, { delivery: publicDelivery(await getDeliveryByToken(store, params.token)) });
    }),
    route("GET", /^\/api\/public\/horoscope\/(?<sign>[^/]+)$/, async (_req, res, params) => {
      sendJson(res, 200, await generateDailyHoroscope(params.sign));
    }),
    route("GET", /^\/api\/config$/, async (_req, res) => {
      const stripe = stripeConfiguration();
      sendJson(res, 200, {
        commerceEnabled,
        allowRegistration,
        testCodeEnabled: testCodeEnabled(),
        emailConfigured: emailEnabled(),
        payments: {
          provider: stripe ? "stripe" : null,
          configured: Boolean(stripe),
          publishableKey: stripe?.publishableKey ?? null,
          currency: stripe?.currency ?? "eur",
          minAmountCents: MIN_AMOUNT_CENTS,
          maxAmountCents: MAX_AMOUNT_CENTS,
          problem: stripeKeyProblem(),
          notice: stripeKeyNotice(),
          diagnostics: stripeKeyDiagnostics(),
          lastError: lastStripeFailure()
        },
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
      sendJson(res, 200, await searchPlacesForEntryDetailed(url.searchParams.get("q")));
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
      if (status >= 500) {
        // Journalisé tel quel côté serveur : c'est là qu'on lit la vraie cause
        // (Render → Logs), jamais dans la réponse au navigateur.
        console.error(`[Lastro] ${status} ${req.method} ${req.url ?? ""} — ${error.message}`, error.cause ?? "");
      }
      const masked = status === 500 || status === 502;
      const message = error.publicMessage ?? (masked ? "Une erreur interne est survenue. Merci de réessayer dans un instant." : error.message);
      sendJson(res, status, { error: message });
    }
  });

  return { server, store };
}
