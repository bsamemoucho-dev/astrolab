# AstroLab

AstroLab is a web platform project for personal transversal analysis across documented astrological, calendrical, and symbolic systems.

The product is designed around one rule: never confuse a tradition, a calculation, a structured result, a transversal inference, and an AI-written explanation.

## Current Status

This repository contains the first functional V1 slice:

- product and technical architecture notes;
- a conceptual data model;
- internal engine contracts;
- domain constants and validation helpers;
- a dependency-free Node web server;
- e-mail/password registration with verification code;
- HTTP-only cookie sessions;
- structured account export and logical account deletion;
- a local structured JSON store;
- profile, birth data, linked people, relationships, and audit history APIs;
- versioned analysis snapshots with explicit unavailable method results;
- an initial transversal engine that stays indeterminate until comparison rules are validated;
- guarded deterministic report artifacts that stay blocked until structured results support interpretation;
- a client-dossier delivery layer: verified factual "socle" rendered from structured results, an eleven-section reading plan with provenance badges, an OpenAI-compatible LLM writer adapter or a deterministic template fallback, machine validation (no invented facts, no event predictions, no contradictions with the socle), and versioned HTML/Markdown exports;
- development credit plans, paid-order stubs, and an append-only credit ledger;
- admin-only summary and redacted audit views;
- shared HTTP security headers, JSON body limits, content-type checks, and production `Secure` cookies;
- a usable responsive web interface;
- structural and integration tests.

It does not yet implement production SMTP, OAuth, real payment provider integration, PDF export, full administration workflows, rate limiting, CSRF tokens, or real methodological calculations. Client-dossier narrative writing requires an LLM key (see below); without one the dossier is generated as a technical draft whose verified annex remains complete.

## Client Dossier (delivery layer)

`POST /api/deliverables` generates a client dossier from a person with saved birth data. The verified factual socle is always computed locally and deterministically. Narrative sections are written by an OpenAI-compatible chat-completions endpoint when configured:

```bash
export ASTROLAB_LLM_API_KEY="..."
export ASTROLAB_LLM_BASE_URL="https://api.openai.com/v1"   # optional
export ASTROLAB_LLM_MODEL="gpt-4o-mini"                     # optional
```

Without a key, sections are produced by a deterministic template writer and the dossier is flagged `template_draft` (not client-ready). Every generated section is machine-validated (guardrail contract) before the dossier is marked `ready_for_human_review`; human review remains mandatory before delivery. The module "Périodes & Cycles" is declared `not_available` until transit methods leave the research backlog.

Alternatively, copy `.env.example` to `.env` in the project root and fill the values (`.env` is git-ignored and loaded automatically by `npm start`).

## Accès gratuit de test (exploitant)

Pour tester le parcours complet sans encaisser, définir `ASTROLAB_TEST_CODE` (12 caractères
minimum) dans l'environnement. Un lien discret « J'ai un code de test » apparaît alors dans
le tunnel de paiement — **invisible tant qu'aucun code n'est configuré** — et un code valide
génère la lecture sans paiement.

Le code vit uniquement côté serveur : il n'est ni dans ce dépôt, ni dans le JavaScript
envoyé au navigateur. La comparaison se fait à longueur constante, les tentatives invalides
sont limitées à 20 par heure, et chaque usage est journalisé
(`[Lastro] lecture offerte (code de test)`). Il fonctionne même si les clés Stripe sont
absentes ou inutilisables, ce qui permet de continuer à travailler pendant une panne de
configuration du paiement. Ne le communiquez à personne : il donne des lectures gratuites.

## Birth place entry

The birth place field is a type-ahead: as the user types, the browser asks
`GET /api/public/places/search?q=…` and shows a list of candidate places (name, region,
country + IANA time zone). Picking one calls `POST /api/public/places/resolve`, which is
the only value used by the calculation — the free text alone is never trusted. If the
exact query returns nothing, the server retries with a truncated query so that a typo
(`Amsterdm`, `Lisbone`) still proposes the right places, flagged as approximate.

A small confirmation map (Leaflet + OpenStreetMap tiles, no API key, no account) is shown
under the confirmed place so the user can see the pin before paying. **The pin is
draggable**: the user can correct the exact position, and the moved coordinates are what
the calculation receives (`resolvedPlace.normalizedForCalculation`). The interface states
the exact point sent to the calculation ("Point utilisé pour le calcul : 52.3966, 4.9768 ·
Heure de naissance interprétée en Europe/Amsterdam"), updated live while dragging, and
draws a dashed line from the geocoded origin to the moved pin so the change is visible.
The adjustment is
recorded in the payload (`confidence: coordinates_manually_adjusted`,
`manualAdjustment.movedMeters`, original coordinates) so the provenance stays honest.
The IANA time zone is deliberately **not** recomputed on drag: beyond 30 km the interface
warns the user and suggests picking the right city from the list instead. A "back to the
original point" button restores the server-resolved coordinates. The map is loaded only
after a place has been confirmed; if the CDN is unreachable it disappears silently and the
textual confirmation remains. OpenStreetMap tiles require the visible "© OpenStreetMap"
attribution, which is kept on the map. No coordinates, time zone or provider name is shown
as technical data in the customer interface.

## Guiding Constraints

- Do not invent undocumented traditions, rules, or sources.
- Do not use AI as the calculation engine.
- Do not store only generated prose; store structured results and provenance.
- Do not count traditions as votes.
- Preserve uncertainty, contradictions, versions, and sources.
- Keep production methods separate from laboratory hypotheses.

## Repository Layout

```text
docs/
  architecture.md       Product and system architecture
  api.md                Current HTTP API
  data-model.md         Conceptual entities and relationships
  engine-contracts.md   Internal module and engine interfaces
public/
  index.html            Web application shell
  app.js                Browser-side interactions
  styles.css            Interface styling
src/auth/
  authService.mjs       Registration, verification, login, sessions
  security.mjs          Password hashing and token helpers
src/core/
  domain.mjs            Shared domain constants
  validation.mjs        Core validation and classification helpers
src/db/
  jsonStore.mjs         Local structured persistence
src/http/
  app.mjs               HTTP routes and static file server
src/methodology/
  registry.mjs          Non-implemented method placeholders
src/models/
  adminService.mjs      Admin summary and redacted audit views
  analysisService.mjs   Versioned analysis snapshots
  commerceService.mjs   Development credit plans, orders, and ledger
  deliverableService.mjs Client dossier generation, listing, export
  dossierService.mjs    Profile, people, relationship, and history logic
  reportService.mjs     Guarded deterministic report artifacts
  transversalEngine.mjs Initial transversal findings
src/deliverables/
  plan.mjs              Sections, ranks and writing directives (single ordering source)
  socle.mjs             Verified factual socle + technical annex
  writers.mjs           LLM writer adapter + deterministic template fallback
  validator.mjs         All detectors: fatal errors and style defects
  i18n.mjs              Nine languages (interface, annex, versioned conventions)
  render.mjs            HTML/Markdown dossier rendering
src/astro/rules/
  lastroAspects.mjs     Versioned convention lastro-aspects@1.0.0 (orbs, retained aspects)
src/server.mjs          Local app entrypoint
docs/conventions-lastro.md  Versioned Lastro conventions (LASTRO_RULE) and their discipline
tests/
  app.integration.test.mjs
  core.test.mjs         Structural tests for domain invariants
  timeMargin.test.mjs   Uncertainty margin: engine, socle, detectors, nine languages
  lastroAspects.test.mjs  Aspect convention: orbs, provenance, annex, nine languages
  languageQuality.test.mjs  Orphan antecedents, repetition, vouvoiement, vocabulary, order
  noSecrets.test.mjs    Guardrail: no secret in any git-tracked file
```

## Run Tests

```bash
npm test
```

The current tests use Node's built-in test runner and require no external dependencies.

In restricted sandboxes, integration tests may need permission to open a local HTTP listener on `127.0.0.1`.

## Run The App

```bash
npm start
```

Then open `http://localhost:4173`.

The development e-mail adapter returns the verification code in the registration response and stores the message in `data/astrolab.json` under `outbox`.

## Déployer en ligne (sans encaissement)

Le site est pleinement opérationnel **sans aucun système de paiement** : comptes (vérification par code en développement), profils, personnes/clients avec lieu résolu, calcul Western Natal, et génération de dossiers clients (socle vérifié local ; rédaction IA si une clé LLM est fournie). La partie commerciale n'est qu'un brouillon technique et peut être masquée.

Variables d'environnement :

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` / `HOST` | Écoute HTTP | `4173` / `0.0.0.0` |
| `ASTROLAB_DB_PATH` | Fichier de données persistant | `data/astrolab.json` |
| `ASTROLAB_ENABLE_COMMERCE` | `0` masque la partie commerciale | activée |
| `ASTROLAB_ALLOW_REGISTRATION` | `0` ferme les inscriptions publiques | activées |
| `ASTROLAB_LLM_API_KEY` | Rédaction narrative (facultative) | désactivée |
| `ASTROLAB_LLM_BASE_URL` / `ASTROLAB_LLM_MODEL` | Fournisseur/modèle LLM | OpenAI `gpt-4o-mini` |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (`sk_…`) — active le paiement obligatoire | paiement désactivé |
| `STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe (`pk_…`), envoyée au navigateur | — |
| `STRIPE_CURRENCY` | Devise du paiement | `eur` |
| `ASTROLAB_TEST_CODE` | Code d'accès gratuit réservé aux tests de l'exploitant (12 caractères minimum) | désactivé |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` | Envoi du lien de récupération par e-mail (Brevo) | désactivé |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Vérification croisée du texte par Google Gemini (optionnelle) | désactivée |
| `GEMINI_MODEL` | Modèle Gemini utilisé pour la vérification | `gemini-2.5-flash` |
| `ASTROLAB_CROSS_CHECK` | `0` désactive la vérification croisée | activée si clé fournie |
| `NODE_ENV=production` | Cookies `Secure` (nécessite HTTPS) | — |

Endpoints de service : `GET /healthz` (santé) et `GET /api/config` (configuration publique, sans secret).

### Avec Docker

```bash
docker build -t astrolab .
docker run -d --name astrolab -p 8080:8080 \
  -v astrolab-data:/data \
  -e NODE_ENV=production \
  -e ASTROLAB_ENABLE_COMMERCE=0 \
  -e ASTROLAB_LLM_API_KEY="..." \
  astrolab
```

### Sur une plateforme (Render / Fly.io / Railway / VPS)

- Commande de démarrage : `node src/server.mjs` (ou l'image Docker ci-dessus).
- Déclarez un **volume persistant** sur le chemin utilisé par `ASTROLAB_DB_PATH` (ex. `/data`) : le stockage est un fichier JSON local ; sans volume, les données sont perdues au redémarrage.
- Renseignez `NODE_ENV=production` et servez en HTTPS (fourni par la plateforme ou par Caddy/nginx). Les cookies de session deviennent alors `Secure`.
- Activez la rédaction IA avec `ASTROLAB_LLM_API_KEY` quand vous voulez des sections narratives (sinon le dossier est un brouillon technique avec socle vérifié complet).

#### Render : rendre les comptes persistants

L'offre gratuite utilise un système de fichiers éphémère (et met le service en veille après 15 min
d'inactivité). Pour conserver comptes, sessions et dossiers entre deux déploiements :

1. passer le service en instance payante (une instance *Starter* suffit : ce serveur Node est léger) ;
2. ajouter un **disque persistant** (1 Go suffit largement pour un fichier JSON) monté sur `/var/data` ;
3. définir `ASTROLAB_DB_PATH=/var/data/astrolab.json` (si le service est déployé via le `Dockerfile`,
   le chemin `/data` est déjà celui du disque déclaré : garder les deux cohérents).

Au démarrage, le serveur affiche `Lastro — stockage : <chemin>` : si le chemin ressemble à
`/app/data/…` au lieu du point de montage du disque, la persistance n'est **pas** active.
Un disque persistant empêche le déploiement sans coupure (quelques secondes d'indisponibilité à
chaque mise en ligne) et interdit de faire tourner plusieurs instances en parallèle.

La vérification e-mail reste en mode « code affiché dans la réponse » (`ASTROLAB_EMAIL_MODE=dev_code`) tant qu'aucun SMTP réel n'est configuré — suffisant pour tester.

## Recommended V1 Build Order

1. Replace local JSON persistence with a relational database and migrations.
2. Add production SMTP plus Apple/Google login.
3. Add the first documented methodology module only after source validation.
4. Connect production payment provider and harden commercial reconciliation.
5. Expand administration workflows, rate limiting, CSRF protection, and security hardening.
