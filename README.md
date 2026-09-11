# Lastro (AstroLab)

Lastro is a **live product**: <https://www.lastro.fr> — a personalised symbolic
astrology reading, written from a verified calculation base.

The product is built on one rule: never confuse a tradition, a calculation, a
structured result, a transversal inference, and an AI-written explanation.

## What is live in production

- **Public path, no account**: birth form → payment → writing → reading on screen
  + a recovery link (`/r/<token>`, kept 30 days) + e-mail. The order is recorded
  **before** writing, so a failure or a closed tab stays recoverable without
  paying again.
- **Payment**: Stripe Checkout embedded in the page (card, Apple Pay, Google Pay;
  Link excluded). **Live and taking payments** — verify with
  `curl -s https://www.lastro.fr/api/config`. **One fixed price: 25 €**, and 15 €
  with the launch code `bessbousse10`, which is pre-filled in the form. The amount
  is computed server-side from the code alone (`lastro-pricing@1.0.0`): the browser
  never sends a price, and an unknown code is refused instead of being charged at
  full price. **No reading is generated without a payment verified server-side
  against Stripe** — the session must be paid, at one of the two legitimate prices,
  and marked as a reading; one payment always yields exactly one reading. The paid
  path refuses to sell when no AI writer is configured, refuses free readings in
  production when Stripe is not configured, and keeps an already-paid order
  recoverable rather than delivering a draft.
- **E-mail**: Brevo, used for recovery links (`BREVO_API_KEY`,
  `BREVO_SENDER_EMAIL`).
- **The reading document**: full-page premium cover with the three key placements,
  a **computed birth-chart wheel** (SVG) and computed element/modality
  distributions, narrative sections, and a technical annex (the verified
  calculation base) that starts on its own page when printed. Nine languages.
- **PDF**: by default the browser print dialog (the document sets the file name,
  2 cm margins and the page breaks). An **opt-in server-side renderer** produces a
  real file instead — `GET /api/public/deliveries/<token>/pdf`, one conversion at
  a time, built only with `--build-arg WITH_PDF_RENDERER=true` and enabled with
  `ASTROLAB_PDF_RENDERER=chromium`. When it is off or fails, the site silently
  falls back to the print dialog.
- **Honesty about uncertainty**: an approximate birth time is bounded by a written
  margin (`lastro-time-margin@1.0.0`); an angle sign that changes inside that
  margin is written as *not decidable*, never asserted. Aspect orbs are a written,
  versioned convention (`lastro-aspects@1.0.0`), like the price and the launch
  offer (`lastro-pricing@1.0.0`) — see
  [`docs/conventions-lastro.md`](docs/conventions-lastro.md).
- **Guardrails are measured, not requested**: one detector per important rule
  (invented facts, planet ↔ sign contradictions, unfilled placeholders,
  biographical invention, hedged uncertainty wording, repetition across sections,
  orphan antecedents, tutoiement/vouvoiement, forbidden vocabulary), plus a CI
  workflow that runs the whole suite on every push.
- **Security**: no secret in the repository (enforced by a test), secrets only in
  environment variables, and the recovery token is the only secret of a paid
  reading (`/r/` and `/api/` are `noindex`).

## What is NOT implemented yet

- the "Périodes & Cycles" module (needs transit and progression calculations);
- the server-side PDF renderer is written and tested but **never run against a
  real Chromium**: the image has not been built with `WITH_PDF_RENDERER=true`, so
  the memory cost and the Linux font rendering are still unverified;
- a dedicated public landing page — the visitor's view is revealed by JavaScript
  and a single URL is indexable;
- editorial detectors beyond French: event prediction, medical claims, biographical
  invention, orphan antecedents and tutoiement are detected in French only (the
  factual safety rules cover all nine languages);
- rate limiting outside the test-code path, and CSRF tokens;
- Apple/Google login (e-mail + verification code only);
- a relational database: persistence is a single JSON file on a mounted disk.

## How to check the state of the product

| Question | Where the answer is |
|---|---|
| Do the guardrails hold? | `npm test` (256 tests) |
| Is payment configured and live? | `curl -s https://www.lastro.fr/api/config` |
| Which version is really deployed? | `curl -s https://www.lastro.fr/healthz` (`release`), compared with `node -e "import('./src/http/release.mjs').then(m=>console.log(m.releaseFingerprint()))"` |
| What is done, decided, remaining? | [`docs/ETAT-ET-SUITE.md`](docs/ETAT-ET-SUITE.md) |
| Which conventions are active? | [`docs/conventions-lastro.md`](docs/conventions-lastro.md) |
| Did the last push pass? | the *Tests* workflow, in GitHub Actions |

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
  index.html            Web application shell (canonical, Open Graph, meta)
  app.js                Browser-side interactions
  styles.css            Interface styling
  robots.txt            Allow /, Disallow /api/ and /r/
  sitemap.xml           The single public URL
  favicon.svg           The ✦ mark
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
  detectorVocabulary.mjs  Per-language detector vocabulary (hedges, identity fields, degrees)
  render.mjs            HTML/Markdown dossier rendering
src/astro/rules/
  lastroAspects.mjs     Versioned convention lastro-aspects@1.0.0 (orbs, retained aspects)
src/server.mjs          Local app entrypoint
tools/
  measure-readings.mjs  Rewrite-rate measurement over a sample of real readings
  verify-production-reading.mjs  End-to-end check after a deployment
  preview-document.mjs  Layout preview with placeholder text, no network, no cost
  inspect-pdf.mjs       Reads a delivered PDF page by page (ToUnicode text extraction)
.github/workflows/
  tests.yml             npm test + syntax check on every push
docs/conventions-lastro.md  Versioned Lastro conventions (LASTRO_RULE) and their discipline
tests/
  app.integration.test.mjs
  core.test.mjs         Structural tests for domain invariants
  timeMargin.test.mjs   Uncertainty margin: engine, socle, detectors, nine languages
  lastroAspects.test.mjs  Aspect convention: orbs, provenance, annex, nine languages
  languageQuality.test.mjs  Orphan antecedents, repetition, vouvoiement, vocabulary, order
  noSecrets.test.mjs    Guardrail: no secret in any git-tracked file
  languageCoverage.test.mjs  Detector coverage measured across the nine languages
  writerDirectives.test.mjs  What the writer actually receives (prompt intercepted)
  printLayout.test.mjs  Print layout contracts and place-field wiring
  publicFiles.test.mjs  robots.txt, sitemap, noindex on private paths
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

## Déployer en ligne

`https://www.lastro.fr` tourne avec le paiement actif. Une instance **peut**
aussi tourner sans encaissement (recette, démonstration, développement) : sans
clés Stripe, le tunnel de paiement est simplement désactivé, et le reste
(comptes, profils, lieux résolus, calcul, dossiers) fonctionne à l'identique.

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

La vérification d'adresse à l'inscription suit `ASTROLAB_EMAIL_MODE` : `dev_code`
(le code est renvoyé dans la réponse, pour le développement) ou `email` (le code
part par Brevo et n'est jamais renvoyé). **En production, avec les inscriptions
ouvertes, il faut `email`** : en `dev_code`, n'importe qui peut créer un compte sur
l'adresse d'un autre et le valider aussitôt. Toute valeur explicite autre que
`dev_code` est traitée comme `email` — une faute de frappe ferme la faille au lieu
de la rouvrir. Le code vit 24 h, cinq essais fautifs l'invalident, et un bouton
« Renvoyer le code » (trois renvois par adresse et par heure) permet d'en obtenir un
autre sans se réinscrire ; la réponse de ce bouton est la même que l'adresse
corresponde à un compte ou non.

## Recommended next steps

1. A dedicated public landing page, served as static HTML with its own content
   (today the visitor's view is revealed by JavaScript, and only one URL is
   indexable).
2. Measure the guardrails on a larger sample of real readings (the rewrite rate is
   currently measured on one French/English sample), then tune the detectors.
3. Extend the editorial detectors to the eight other languages.
4. Build the "Périodes & Cycles" module once transit methods leave the research
   backlog.
5. Replace local JSON persistence with a relational database and migrations.
6. Rate limiting, CSRF protection, Apple/Google login.
