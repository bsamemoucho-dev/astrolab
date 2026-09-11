import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { deleteAccount, getUserForSession, login, logout, register, verifyEmail } from "../auth/authService.mjs";
import { releaseInfo } from "./release.mjs";
import {
  defaultPdfRenderer,
  PDF_BUSY_CODE,
  PDF_FAILED_CODE,
  PDF_UNAVAILABLE_CODE,
  pdfFileNameFromHtml
} from "../deliverables/pdfRenderer.mjs";
import { llmConfiguration } from "../deliverables/writers.mjs";
import { JsonStore } from "../db/jsonStore.mjs";
import { resolvePlaceForEntry, searchPlacesForEntryDetailed } from "../geo/placeResolver.mjs";
import { getAdminSummary, listAdminAuditLogs } from "../models/adminService.mjs";
import { createAnalysis, getAnalysis, listAnalyses } from "../models/analysisService.mjs";
import { consumeCredits, createDevelopmentCreditOrder, getCommerceSummary } from "../models/commerceService.mjs";
import { calculateWesternNatalForUser } from "../models/natalCalculationService.mjs";
import { assertPublicReadingInput, createPublicReading } from "../models/publicReadingService.mjs";
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
import { emailEnabled, emailVerificationMode, flushQueuedEmails, sendEmail } from "../notifications/mailer.mjs";
import { registerResend, resendRateLimited, resendVerification } from "../auth/verification.mjs";
import {
  checkoutLineLabel,
  checkoutSessionProblem,
  publicPricing,
  publicQuote,
  quotePrice,
  READING_PURPOSE
} from "../payments/pricing.mjs";
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
  FAILURE_WINDOW_MS,
  MAX_FAILURES_PER_WINDOW,
  testCodeEnabled,
  testCodeMatches
} from "../payments/freeAccess.mjs";
import { generateDailyHoroscope } from "../models/horoscopeService.mjs";
import { accessCodeError, checkAccessCode, countUsableAccessCodes } from "../models/accessCodeService.mjs";
import { clientAddress, createRateLimiter, isLoopbackAddress, maskClientAddress, retryAfterSeconds } from "./rateLimit.mjs";
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

// Base des liens envoyés par e-mail.
//
// Elle ne vient PAS de l'en-tête Host de la requête, qui est fourni par le
// client. Le raisonnement d'origine (« fonctionne sur le domaine final comme sur
// une préversion ») avait un coût qu'on n'avait pas vu : il suffisait de forger
// `X-Forwarded-Host` pour que l'e-mail envoyé à un client pointe vers le domaine
// de l'attaquant. Le client cliquait, et le jeton de sa lecture — seul secret du
// document — partait chez lui. Il fallait connaître le numéro de commande et
// l'adresse, mais ces deux valeurs circulent (support, capture d'écran,
// transfert d'e-mail).
//
// L'ordre est donc : configuration explicite, puis l'hôte de la requête
// UNIQUEMENT hors production (confort du développement local), puis le domaine
// de production. Le défaut est le domaine déjà publié (canonical de la page,
// sitemap) : s'il change, c'est la configuration qui change, pas le code.
const DEFAULT_PUBLIC_BASE_URL = "https://www.lastro.fr";

function publicBaseUrl(req) {
  const configure = String(process.env.ASTROLAB_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  if (configure) {
    // Une valeur mal formée produirait des liens morts dans les e-mails : on
    // retombe sur le domaine connu plutôt que d'envoyer n'importe quoi.
    if (/^https?:\/\/[^\s/]+/i.test(configure)) {
      return configure;
    }
    console.warn(`[Lastro] ASTROLAB_PUBLIC_URL ignorée (URL absolue attendue) : ${configure.slice(0, 60)}`);
  }
  if (process.env.NODE_ENV !== "production") {
    // `http` par défaut : le serveur de développement écoute en clair, et
    // supposer `https` produisait des liens morts en local. Derrière un proxy
    // qui termine le TLS, l'en-tête transmis fait foi.
    const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() || "http";
    const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost").split(",")[0].trim();
    return `${proto}://${host}`;
  }
  return DEFAULT_PUBLIC_BASE_URL;
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

// Crédits « de développement » : ce point d'entrée existe pour les essais, pas
// pour la production. Sans ce refus, n'importe quel compte connecté s'attribue
// 10, 50 ou 150 crédits — sans conséquence tant que les crédits n'ouvrent rien,
// porte grande ouverte le jour où ils ouvriront quelque chose. Le drapeau
// explicite permet un essai assumé, comme ASTROLAB_ALLOW_FREE_READINGS.
function developmentCreditsAllowed() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return process.env.ASTROLAB_ALLOW_DEV_CREDITS === "1";
}

// Destinataires autorisés pour le test d'envoi.
//
// Ce point d'entrée sert à vérifier que l'envoi fonctionne, pas à écrire à
// n'importe qui. Il était ouvert à quiconque détient le code de test : celui-ci
// étant fait pour être partagé, son détenteur pouvait envoyer du courrier
// illimité vers n'importe quelle adresse depuis notre domaine (quota Brevo,
// délivrabilité, réputation). Par défaut on n'écrit donc qu'à l'expéditeur
// lui-même ; ASTROLAB_TEST_EMAIL_ALLOWLIST ajoute des adresses, séparées par des
// virgules, pour les essais qui ont besoin d'une autre boîte.
function testEmailAllowedRecipients() {
  const expediteur = String(process.env.BREVO_SENDER_EMAIL ?? "").trim().toLowerCase();
  const supplement = String(process.env.ASTROLAB_TEST_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((adresse) => adresse.trim().toLowerCase())
    .filter(Boolean);
  return new Set([expediteur, ...supplement].filter(Boolean));
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
  // Rendu PDF automatique : `null` quand le drapeau n'est pas posé, et l'option
  // permet d'en injecter un autre dans les tests.
  const pdfRenderer = "pdfRenderer" in options ? options.pdfRenderer : defaultPdfRenderer();

  // Compteurs des points d'entrée non authentifiés, créés par application et non
  // au niveau du module : deux applications (les tests en montent plusieurs) ne
  // doivent pas partager leurs compteurs, sinon un cas de test hérite de l'état
  // laissé par le précédent. Les valeurs sont commentées à chaque usage.
  const limites = {
    // Inscrire envoie un e-mail : la borne protège la boîte visée et le quota.
    // Dix par heure et par client plutôt que cinq : une annonce de lancement fait
    // s'inscrire plusieurs personnes derrière la même adresse (bureau, wifi
    // public), et bloquer des inscriptions légitimes coûte plus cher que la
    // poignée d'e-mails qu'un client peut déclencher. C'est le plafond de
    // service, cent par heure, qui protège réellement le quota d'envoi.
    inscriptionParClient: createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }),
    inscriptionService: createRateLimiter({ windowMs: 60 * 60 * 1000, max: 100 }),
    // Se connecter : la clé est le compte visé, pas la source — un attaquant peut
    // changer d'adresse, pas changer le compte qu'il essaie d'ouvrir.
    connexionParCompte: createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
    connexionParClient: createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }),
    // Redemander un lien de lecture envoie un e-mail à l'adresse enregistrée.
    recuperationParClient: createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }),
    // Chercher un lieu relaie vers un service externe gratuit.
    lieuxParClient: createRateLimiter({ windowMs: 10 * 60 * 1000, max: 120 }),
    // Tentatives de code de test. PAR CLIENT d'abord : un compteur global
    // permettait à n'importe qui de bloquer le code de l'exploitant pour tout le
    // monde en envoyant vingt mauvais codes. Le plafond de service reste, en
    // second rideau, pour borner une attaque distribuée.
    codeTestParClient: createRateLimiter({ windowMs: FAILURE_WINDOW_MS, max: MAX_FAILURES_PER_WINDOW }),
    codeTestService: createRateLimiter({ windowMs: FAILURE_WINDOW_MS, max: 100 }),
    // Lectures offertes par le code de test PARTAGÉ : lui seul est illimité par
    // construction, donc lui seul a besoin d'un plafond. Les codes à usage unique
    // sont déjà bornés à une lecture — les plafonner par client punirait un
    // atelier où dix personnes légitimes se connectent du même réseau.
    lecturesOffertesParClient: createRateLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 5 })
  };

  // Réponse unique de limitation : le client sait quand réessayer, et on ne dit
  // jamais si la ressource visée existe.
  const refuseTropDeRequetes = (limite, message) => {
    const error = new Error(message);
    error.status = 429;
    error.retryAfterSeconds = retryAfterSeconds(limite.retryAfterMs);
    throw error;
  };

  // Une conversion à la fois, et jamais de HTML arbitraire : on ne rend que le
  // document déjà stocké, retrouvé par son jeton ou son identifiant.
  const sendPdf = async (res, html) => {
    if (!pdfRenderer) {
      const error = new Error(
        "La génération automatique du PDF n'est pas activée sur ce site. Utilisez l'impression du navigateur (Enregistrer au format PDF)."
      );
      error.status = 503;
      error.code = PDF_UNAVAILABLE_CODE;
      // État de configuration, pas incident : un site sans moteur PDF répond
      // toujours cela, et le journal ne doit pas s'en remplir.
      error.expected = true;
      throw error;
    }
    let document;
    try {
      document = await pdfRenderer.render(html);
    } catch (cause) {
      const indisponible = cause?.code === PDF_UNAVAILABLE_CODE || cause?.code === PDF_BUSY_CODE;
      const error = new Error(
        indisponible
          ? "Le moteur de PDF n'est pas disponible sur ce serveur. Utilisez l'impression du navigateur (Enregistrer au format PDF)."
          : "Le PDF n'a pas pu être produit. Utilisez l'impression du navigateur (Enregistrer au format PDF)."
      );
      error.status = indisponible ? 503 : 502;
      error.code = cause?.code ?? PDF_FAILED_CODE;
      error.cause = cause;
      throw error;
    }
    const corps = Buffer.isBuffer(document) ? document : Buffer.from(document);
    res.writeHead(200, {
      "content-type": "application/pdf",
      "content-length": corps.length,
      "content-disposition": `attachment; filename="${pdfFileNameFromHtml(html)}"`,
      "cache-control": "no-store"
    });
    res.end(corps);
  };

  const routes = [
    route("GET", /^\/healthz$/, async (_req, res) => {
      sendJson(res, 200, {
        ok: true,
        service: "astrolab",
        // Empreinte du code réellement servi : comparer avec l'empreinte locale
        // répond à « le déploiement est-il passé ? » sans deviner.
        release: releaseInfo().fingerprint,
        production: process.env.NODE_ENV === "production",
        time: new Date().toISOString()
      });
    }),
    // Parcours public « sans compte » : résolution de lieu et lecture, aucune
    // inscription, aucune donnée personnelle persistée.
    route("GET", /^\/api\/public\/places\/search$/, async (req, res, _params, url) => {
      const client = clientAddress(req);
      const limite = limites.lieuxParClient.check(client);
      if (limite.limited) {
        refuseTropDeRequetes(limite, "Trop de recherches de lieux en peu de temps. Réessayez dans un instant.");
      }
      limites.lieuxParClient.hit(client);
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
    // Devis public : le site affiche le prix calculé par le serveur, jamais le sien.
    route("POST", /^\/api\/public\/price-quote$/, async (req, res) => {
      const body = await readJson(req);
      sendJson(res, 200, { quote: publicQuote(quotePrice({ promoCode: body.promoCode })) });
    }),
    // Le montant n'est JAMAIS lu dans la requête : seul un code promo l'est. Un
    // montant glissé par le client est ignoré, pas négocié.
    route("POST", /^\/api\/public\/checkout-session$/, async (req, res) => {
      const body = await readJson(req);
      const quote = quotePrice({ promoCode: body.promoCode });
      if (quote.reason === "unknown") {
        const error = new Error("Ce code promo n'est pas valide : le prix reste à son tarif normal.");
        error.status = 400;
        error.code = "unknown_promo_code";
        throw error;
      }
      // On n'encaisse pas ce qu'on ne peut pas rédiger. Le site masque déjà le
      // bouton, mais un appel direct à l'API le contournerait : le client serait
      // débité pour une lecture qui ne peut pas être écrite.
      if (!llmConfiguration()) {
        const error = new Error(
          "La rédaction est momentanément indisponible : le paiement n'est pas ouvert, vous ne serez pas débité. Merci de réessayer dans quelques minutes."
        );
        error.status = 503;
        error.code = "writer_unavailable";
        throw error;
      }
      sendJson(
        res,
        201,
        await createEmbeddedCheckoutSession({
          amountCents: quote.totalCents,
          label: checkoutLineLabel({ quote, language: body.language }),
          // Marque du produit : elle permet de refuser plus tard une session
          // payée pour autre chose sur le même compte Stripe.
          metadata: {
            purpose: READING_PURPOSE,
            pricing: quote.version,
            promo_code: quote.valid ? quote.promoCode : "none"
          }
        })
      );
    }),
    route("POST", /^\/api\/public\/readings$/, async (req, res) => {
      const body = await readJson(req);

      // Accès gratuit : deux sources, un seul chemin.
      //
      //   - le code de test de l'exploitant, partagé et illimité (variable
      //     d'environnement) ;
      //   - les codes à usage unique, distribués à des personnes et consommés à
      //     la première lecture.
      //
      // Ce bloc ne fait que DÉCIDER du chemin. La consommation d'un code à usage
      // unique a lieu dans la transaction qui crée la livraison (voir
      // `createPaidDelivery`) : c'est le seul endroit où vérifier et consommer ne
      // peuvent pas être séparés par une autre requête.
      let freeAccess = false;
      let accessCode = null;
      // Le quota ne compte que les lectures réellement accordées : une demande
      // incomplète ne doit pas consommer le quota de quelqu'un.
      let compteQuotaPartage = false;
      const client = clientAddress(req);
      const codeSaisi = String(body.accessCode ?? body.testCode ?? "").trim();
      if (codeSaisi) {
        if (testCodeEnabled() && testCodeMatches(codeSaisi)) {
          // Le code de test est partagé et illimité par construction : c'est la
          // seule source qu'un plafond doit borner. S'il fuite, il ne peut pas
          // servir à produire des lectures en série depuis un même poste.
          const quota = limites.lecturesOffertesParClient.check(client);
          if (quota.limited) {
            refuseTropDeRequetes(
              quota,
              "Trop de lectures offertes depuis ce poste aujourd'hui. Réessayez demain, ou utilisez votre code personnel."
            );
          }
          freeAccess = true;
          compteQuotaPartage = true;
          console.log(
            `[Lastro] lecture offerte (code de test) — ${maskClientAddress(client)} — ${new Date().toISOString()}`
          );
        } else {
          // Pas le code de test : peut-être un code à usage unique. Le contrôle
          // ci-dessous est en LECTURE SEULE — il choisit le message, il n'autorise
          // rien. Seule la transaction de création fait autorité.
          const controle = checkAccessCode(await store.load(), codeSaisi);
          if (controle.ok) {
            freeAccess = true;
            accessCode = codeSaisi;
            // Journalisé avec l'identifiant du registre, jamais avec le code.
            console.log(
              `[Lastro] lecture offerte (code à usage unique ${controle.entry.id}) — ${maskClientAddress(client)} — ${new Date().toISOString()}`
            );
          } else if (controle.reason !== "inconnu") {
            // Connu mais déjà consommé ou expiré : message et statut propres, sinon
            // le client croirait s'être trompé de code.
            throw accessCodeError(controle.reason);
          } else {
            // Valeur reconnue par aucune source.
            //
            // Le compteur d'échecs est incrémenté DÈS QU'un code de test est
            // configuré, quelle que soit l'origine de la saisie : sans cela, le
            // champ du site permettrait de deviner le code de test partagé sans
            // jamais déclencher la limitation.
            if (testCodeEnabled()) {
              const parClient = limites.codeTestParClient.check(client);
              const parService = limites.codeTestService.check("service");
              if (parClient.limited || parService.limited) {
                refuseTropDeRequetes(
                  parClient.limited ? parClient : parService,
                  "Trop de codes de test invalides. Réessayez dans une heure."
                );
              }
              limites.codeTestParClient.hit(client);
              limites.codeTestService.hit("service");
            }
            if (body.accessCode) {
              const error = new Error("Ce code n'est pas valide.");
              error.status = 403;
              throw error;
            }
            if (!testCodeEnabled()) {
              const error = new Error("Aucun code de test n'est configuré sur ce site.");
              error.status = 400;
              throw error;
            }
            const error = new Error("Code de test invalide.");
            error.status = 403;
            throw error;
          }
        }
      }

      // Validation AVANT de consommer : une demande incomplète (date manquante)
      // ne doit pas brûler le code de quelqu'un. La livraison serait de toute
      // façon enregistrée avant la rédaction, donc le code serait consommé pour
      // une lecture qui ne peut pas être écrite.
      if (freeAccess) {
        assertPublicReadingInput(body);
      }

      let payment = null;
      let existingDelivery = null;
      const sessionId = String(body.paymentSessionId ?? "").trim();
      if (!freeAccess) {
        // Clés Stripe présentes mais inutilisables (recopie incomplète, modes
        // mélangés…) : on refuse la lecture plutôt que de l'offrir par accident.
        if (stripeKeyProblem()) {
          const error = new Error("Le paiement est momentanément indisponible. Merci de réessayer dans quelques minutes.");
          error.status = 503;
          throw error;
        }

        // On ne vend pas ce qu'on ne peut pas rédiger : avec le paiement actif et
        // sans rédacteur IA, un client paierait pour recevoir un brouillon portant
        // « ce document n'est pas prêt pour la livraison ». Tant qu'aucune session
        // de paiement n'est fournie, on refuse AVANT tout débit.
        if (stripeConfiguration() && !llmConfiguration() && !sessionId) {
          const error = new Error(
            "La rédaction est momentanément indisponible : aucune lecture ne peut être commandée pour l'instant. Vous ne serez pas débité."
          );
          error.status = 503;
          throw error;
        }

        // L'absence de paiement configuré n'est pas un mode gratuit implicite.
        //
        //   - en production : refus, sauf ASTROLAB_ALLOW_FREE_READINGS=1 ;
        //   - ailleurs (développement, préversion) : refus SAUF si l'appel vient de
        //     la machine elle-même. Une préversion oubliée, joignable depuis
        //     Internet et sans Stripe, offrait sinon des lectures à n'importe qui.
        if (!stripeConfiguration() && process.env.ASTROLAB_ALLOW_FREE_READINGS !== "1") {
          const local = isLoopbackAddress(clientAddress(req));
          if (process.env.NODE_ENV === "production" || !local) {
            const error = new Error(
              "Le paiement n'est pas configuré sur ce service : aucune lecture ne peut être commandée pour l'instant. Vous ne serez pas débité. Merci de réessayer plus tard."
            );
            error.status = 503;
            error.code = "payment_not_configured";
            throw error;
          }
        }

        // Paiement obligatoire dès que Stripe est configuré (sinon mode test/dev).
        if (stripeConfiguration()) {
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
          // Payé ne suffit pas : encore faut-il que ce soit payé POUR cette
          // lecture, au bon prix. Une session d'un autre produit sur le même
          // compte Stripe ne doit pas ouvrir de lecture.
          const probleme = checkoutSessionProblem(session);
          if (probleme) {
            console.warn(`[Lastro] session de paiement refusée (${probleme}) — ${sessionId}`);
            const error = new Error(
              "Cette session de paiement ne correspond pas à une lecture. Aucune lecture n'a été générée ; si vous avez été débité, contactez-nous avec votre numéro de commande."
            );
            error.status = 402;
            error.code = probleme;
            throw error;
          }
          if (!session.metadata?.purpose) {
            // Sessions créées avant la marque produit : acceptées sur le montant,
            // mais signalées, pour pouvoir serrer la vis quand elles auront expiré.
            console.warn(`[Lastro] session payée sans marque produit (ancienne session) — ${sessionId}`);
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
          freeAccess,
          accessCode
        });
        delivery = created.delivery;
      }
      await markDeliveryGenerating(store, delivery.id);

      // En reprise, on repart des données enregistrées avec le paiement : le
      // client a peut-être fermé la page, on ne dépend pas de ce qu'il renvoie.
      const readingInput = existingDelivery ? (existingDelivery.input ?? body) : body;

      try {
        // Client déjà débité et rédacteur indisponible : la commande reste
        // enregistrée (lien conservé, relance sans repayer) mais on ne livre pas un
        // brouillon technique à quelqu'un qui a payé. L'échec passe par le chemin
        // habituel : la livraison est marquée en échec et le client peut relancer.
        if (stripeConfiguration() && !llmConfiguration()) {
          const error = new Error(
            "La rédaction est momentanément indisponible. Votre commande est enregistrée : vous pourrez relancer la rédaction sans repayer."
          );
          error.status = 503;
          throw error;
        }
        const reading = await createPublicReading(readingInput);
        await markDeliveryReady(store, delivery.id, reading);
        // Le quota ne compte que les lectures RÉELLEMENT accordées : une demande
        // incomplète ou une rédaction en échec ne consomme rien.
        if (compteQuotaPartage) {
          limites.lecturesOffertesParClient.hit(client);
        }
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
          // Mêmes compteurs que la route des lectures : ce point d'entrée est une
          // autre porte sur le même secret, elle ne doit pas être plus permissive.
          const client = clientAddress(req);
          const parClient = limites.codeTestParClient.check(client);
          const parService = limites.codeTestService.check("service");
          if (parClient.limited || parService.limited) {
            refuseTropDeRequetes(
              parClient.limited ? parClient : parService,
              "Trop de codes de test invalides. Réessayez dans une heure."
            );
          }
          limites.codeTestParClient.hit(client);
          limites.codeTestService.hit("service");
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
      // Le code de test est fait pour être partagé : il ne doit pas devenir un
      // droit d'écrire à n'importe qui depuis notre domaine.
      if (!testEmailAllowedRecipients().has(to.toLowerCase())) {
        const error = new Error(
          "Cette adresse n'est pas autorisée pour le test d'envoi. Ajoutez-la à ASTROLAB_TEST_EMAIL_ALLOWLIST pour l'utiliser."
        );
        error.status = 403;
        throw error;
      }
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
      // Ce point d'entrée envoie un e-mail à l'adresse enregistrée : sans borne,
      // il sert à inonder la boîte d'un client dont on connaît la référence.
      const client = clientAddress(req);
      const limite = limites.recuperationParClient.check(client);
      if (limite.limited) {
        refuseTropDeRequetes(limite, "Trop de demandes de récupération en peu de temps. Réessayez plus tard.");
      }
      limites.recuperationParClient.hit(client);
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
    // Le PDF du document livré : même secret que la lecture elle-même (le jeton),
    // et rendu à partir du HTML stocké — jamais d'un HTML envoyé par le client.
    route("GET", /^\/api\/public\/deliveries\/(?<token>[^/]+)\/pdf$/, async (_req, res, params) => {
      const delivery = await getDeliveryByToken(store, params.token);
      if (!delivery) {
        const error = new Error("Ce lien de lecture est inconnu ou a expiré.");
        error.status = 404;
        throw error;
      }
      if (delivery.status !== "ready" || !delivery.reading?.html) {
        const error = new Error("Cette lecture n'est pas prête : il n'y a pas encore de document à convertir.");
        error.status = 409;
        error.code = "reading_not_ready";
        throw error;
      }
      await sendPdf(res, delivery.reading.html);
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
      // Le site n'affiche le champ « J'ai un code » que si une source de code
      // existe : un code de test configuré, ou au moins un code à usage unique
      // disponible. On n'annonce jamais COMBIEN il en reste : le nombre de codes
      // non utilisés est une information d'exploitation.
      const codesEnabled = testCodeEnabled() || countUsableAccessCodes(await store.load()) > 0;
      sendJson(res, 200, {
        commerceEnabled,
        allowRegistration,
        testCodeEnabled: testCodeEnabled(),
        codesEnabled,
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
        pricing: publicPricing(),
        llmConfigured: Boolean(llmConfiguration()),
        llmModel: llmConfiguration()?.model ?? null,
        // « chromium » quand le rendu PDF automatique est actif ; sinon le bouton
        // du site garde la fenêtre d'impression du navigateur.
        pdfRenderer: pdfRenderer ? pdfRenderer.renderer : null,
        // Mode EFFECTIF : une valeur inconnue est traitée comme « email », donc
        // l'annonce ne peut pas mentir sur le comportement réel.
        emailVerificationMode: emailVerificationMode(),
        production: process.env.NODE_ENV === "production"
      });
    }),
    route("POST", /^\/api\/auth\/register$/, async (req, res) => {
      if (!allowRegistration) {
        const error = new Error("Les inscriptions sont momentanément fermées.");
        error.status = 403;
        throw error;
      }
      // S'inscrire envoie un e-mail à l'adresse fournie : c'est le seul point du
      // site qui écrit à quelqu'un qui n'a rien demandé. La limite par client
      // borne l'inondation d'une boîte tierce, la limite de service borne le
      // quota d'envoi et la réputation du domaine. Le corps de la requête n'est
      // pas encore lu : refuser avant coûte moins cher.
      const client = clientAddress(req);
      const parClient = limites.inscriptionParClient.check(client);
      const parService = limites.inscriptionService.check("service");
      if (parClient.limited || parService.limited) {
        refuseTropDeRequetes(
          parClient.limited ? parClient : parService,
          "Trop d'inscriptions en peu de temps. Réessayez dans un moment."
        );
      }
      limites.inscriptionParClient.hit(client);
      limites.inscriptionService.hit("service");
      const result = await register(store, await readJson(req));
      if (emailVerificationMode() === "email") {
        // Le code part par e-mail et n'est PAS renvoyé dans la réponse : sans
        // cela, n'importe qui validerait l'adresse d'un autre en s'inscrivant
        // avec. Si l'envoi échoue, le message reste dans la file et le code
        // n'est pas divulgué pour autant (le client peut redemander un envoi).
        const envoi = await flushQueuedEmails(store, { types: ["email_verification"] }).catch((error) => {
          console.warn(`[Lastro] code de vérification non envoyé — ${error.message}`);
          return { sent: 0, failed: 1, skipped: false };
        });
        const { devVerificationCode: _ignore, ...reste } = result;
        sendJson(res, 201, { ...reste, verificationEmailSent: envoi.sent > 0 });
        return;
      }
      sendJson(res, 201, result);
    }),
    route("POST", /^\/api\/auth\/verify$/, async (req, res) => {
      const result = await verifyEmail(store, await readJson(req));
      sendJson(res, 200, result);
    }),
    // Renvoi du code de vérification. Réponse NEUTRE : la même que l'adresse
    // corresponde à un compte non vérifié ou non — sinon ce point d'entrée
    // dirait qui possède un compte chez nous.
    route("POST", /^\/api\/auth\/resend$/, async (req, res) => {
      const body = await readJson(req);
      const email = String(body.email ?? "").trim();
      if (!email) {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (resendRateLimited(email)) {
        const error = new Error("Trop de demandes de code pour cette adresse. Réessayez dans une heure.");
        error.status = 429;
        error.code = "verification_resend_rate_limited";
        throw error;
      }
      registerResend(email);
      const resultat = await resendVerification(store, { email, language: body.language });
      if (emailVerificationMode() === "email") {
        // Un échec d'envoi ne dit rien de plus au client : le message reste dans
        // la file, et l'exploitant peut le renvoyer.
        const envoi = await flushQueuedEmails(store, { types: ["email_verification"] }).catch((error) => {
          console.warn(`[Lastro] code de vérification non envoyé — ${error.message}`);
          return { sent: 0, failed: 1, skipped: false };
        });
        sendJson(res, 200, { ok: true, ...(resultat.sent ? { verificationEmailSent: envoi.sent > 0 } : {}) });
        return;
      }
      // Développement : le code reste affiché, comme à l'inscription.
      sendJson(res, 200, { ok: true, ...(resultat.sent ? { devVerificationCode: resultat.code } : {}) });
    }),
    route("POST", /^\/api\/auth\/login$/, async (req, res) => {
      const body = await readJson(req);
      // La clé est le compte visé, pas la source : un attaquant peut changer
      // d'adresse IP, pas le compte dont il cherche le mot de passe. La limite
      // par client attrape en plus le bourrage sur beaucoup de comptes.
      const compte = String(body.email ?? "").trim().toLowerCase();
      const client = clientAddress(req);
      const parCompte = limites.connexionParCompte.check(compte);
      const parClient = limites.connexionParClient.check(client);
      if (parCompte.limited || parClient.limited) {
        refuseTropDeRequetes(
          parCompte.limited ? parCompte : parClient,
          "Trop de tentatives de connexion. Réessayez dans quelques minutes."
        );
      }
      let result;
      try {
        result = await login(store, body);
      } catch (error) {
        // Seul un mot de passe faux compte comme un échec : un compte non vérifié
        // n'est pas une tentative d'intrusion, et le refuser ne doit pas
        // consommer le quota de connexion de quelqu'un qui a oublié de valider.
        if (error.status === 401) {
          limites.connexionParCompte.hit(compte);
          limites.connexionParClient.hit(client);
        }
        throw error;
      }
      // Connexion réussie : le compteur du compte repart à zéro, sinon dix
      // erreurs de frappe étalées dans la journée finiraient par le bloquer.
      limites.connexionParCompte.reset(compte);
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
      if (!developmentCreditsAllowed()) {
        const error = new Error("L'attribution de crédits de développement est désactivée sur ce site.");
        error.status = 403;
        throw error;
      }
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
      if (format === "pdf") {
        await sendPdf(res, version.html);
        return;
      }
      sendJson(res, 400, { error: "Unsupported export format. Use html, md, json or pdf." });
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
      // Aucune réponse d'API ni de lien de récupération ne doit être indexée :
      // on le déclare avant tout routage, y compris pour les erreurs. Posé ici
      // plutôt que dans sendStatic, sinon les réponses JSON y échappent.
      const cheminDemande = new URL(req.url, "http://localhost").pathname;
      if (cheminDemande.startsWith("/api/") || cheminDemande.startsWith("/r/")) {
        res.setHeader("x-robots-tag", "noindex, nofollow");
      }

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
      if (status >= 500 && !error.expected) {
        // Journalisé tel quel côté serveur : c'est là qu'on lit la vraie cause
        // (Render → Logs), jamais dans la réponse au navigateur.
        console.error(`[Lastro] ${status} ${req.method} ${req.url ?? ""} — ${error.message}`, error.cause ?? "");
      }
      const masked = status === 500 || status === 502;
      const message = error.publicMessage ?? (masked ? "Une erreur interne est survenue. Merci de réessayer dans un instant." : error.message);
      // Une limitation n'est pas une erreur : le client doit savoir QUAND
      // réessayer, sinon il insiste et la limitation se prolonge.
      if (error.retryAfterSeconds) {
        res.setHeader("retry-after", error.retryAfterSeconds);
      }
      // Le code est une information de contrat, pas un détail d'implémentation :
      // le bouton PDF du site s'en sert pour retomber sur l'impression du
      // navigateur plutôt que d'afficher une erreur au client.
      sendJson(res, status, error.code ? { error: message, code: error.code } : { error: message });
    }
  });

  return { server, store };
}
