# API V1 Slice

All dossier endpoints require a verified session cookie named `astrolab_session`.

The HTTP layer applies shared security headers, rejects non-JSON request bodies for JSON endpoints, and limits JSON payloads to 64 KiB.

## Service Endpoints

### `GET /healthz`

Health check used by deployment platforms. Returns `{ ok: true, service: "astrolab", production }` without authentication.

### `GET /api/config`

Public configuration, no secrets: `commerceEnabled`, `llmConfigured`, `llmModel` (or `null`), `emailVerificationMode`, `production`. `commerceEnabled` follows `ASTROLAB_ENABLE_COMMERCE` (set `0` to run the site without the commercial part).

## Authentication

### `POST /api/auth/register`

Creates an account and writes a verification e-mail to the development outbox.

Body:

```json
{
  "email": "user@example.com",
  "password": "at least 10 characters"
}
```

### `POST /api/auth/verify`

Verifies the e-mail address.

Body:

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

### `POST /api/auth/login`

Creates a session only if the e-mail is verified.

Session cookies are `HttpOnly` and `SameSite=Lax`; production mode also adds `Secure`.

### `POST /api/auth/logout`

Deletes the current session.

### `GET /api/session`

Returns the current public user or `null`.

## Dossier

### `GET /api/me`

Returns the current user's dossier:

- public user;
- people;
- birth data;
- relationships;
- audit history.

No record owned by another user is returned.

### `GET /api/me/export`

Returns a structured JSON export for the current user, including:

- public account fields;
- people;
- birth data;
- relationships;
- data points;
- data sources;
- analyses;
- analysis versions;
- method results;
- transversal findings;
- reports;
- orders;
- credit ledger;
- audit history.

Authentication secrets such as password hashes and verification codes are excluded.

### `PUT /api/me/profile`

Creates or updates the primary person and birth data.

Required:

- `firstName`
- `birthDate`
- `birthPlace`
- `timePrecision`

When `timePrecision` is `exact`, `timeValue` is required.

When `timePrecision` is `interval`, `timeStart` and `timeEnd` are required.

Optional calculation fields:

- `resolvedPlace`
- `coordinateSource`
- `coordinateConfidence`

`resolvedPlace` stores the selected human place and the normalized technical data used later by the Western Natal V1 development calculator: place name, latitude, longitude, IANA time zone, timezone rule status, resolution source and confidence. Users should not be asked to enter latitude, longitude or IANA time zone manually in the interface.

### `POST /api/places/resolve`

Resolves a human birth place label before calculation.

Body:

```json
{
  "query": "Paris, France",
  "birthDate": "1990-01-15"
}
```

The current implementation first uses a small local development gazetteer. If no local match exists, it can call Open-Meteo Geocoding at data-entry time to obtain a human place, WGS84 coordinates and an IANA time zone. The selected result is stored before calculation, and the calculation itself remains local.

Responses:

- `200` with one resolved `place`;
- `404` when no place can be resolved;
- `409` with `matches` when the place is ambiguous.

### `GET /api/places/search`

Returns local development place matches for a query string `q`.

### `DELETE /api/me`

Logically deletes the current account, revokes all sessions for that user, and clears the current session cookie.

### `POST /api/people`

Creates a linked person. Birth data is optional.

### `PUT /api/people/:id`

Updates a person owned by the current user.

### `DELETE /api/people/:id`

Deletes a linked person owned by the current user. The primary profile cannot be deleted through this endpoint.

### `POST /api/relationships`

Creates a typed relationship between two people owned by the current user.

The API rejects cross-user relationships and self-relationships.

### `DELETE /api/relationships/:id`

Deletes a relationship owned by the current user.

### `GET /api/history`

Returns audit entries for the current user.

## Analyses

### `GET /api/analyses`

Returns the current user's analyses with their saved versions.

### `POST /api/analyses`

Creates a versioned analysis snapshot for the current primary profile.

Body:

```json
{
  "scope": "personal_profile"
}
```

The current implementation records explicit unavailable method results instead of fabricating calculations for undocumented methods.

### `POST /api/western-natal/calculate`

Creates a laboratory Western Natal V1 calculation run for the current user.

Body:

```json
{
  "personId": "optional person id",
  "birthDate": "1990-01-15",
  "timeValue": "12:30",
  "timePrecision": "exact",
  "resolvedPlace": {
    "selectedName": "Paris, France",
    "normalizedForCalculation": {
      "placeName": "Paris, France",
      "latitude": 48.8566,
      "longitude": 2.3522,
      "timeZone": "Europe/Paris"
    }
  }
}
```

If fields are omitted, the endpoint uses the selected person's saved birth data. V1 requires a resolved place for reproducibility, but it does not require exact birth time.

Time handling:

- `exact`: calculates timed positions, angles, sect and Whole Sign houses.
- `approximate`: calculates timed structures but marks the result as approximate, not exact.
- `interval`: preserves `timeStart` and `timeEnd`, returns a time-window result, and does not collapse exact angles/houses. The result adds `uncertainty.intervalAnalysis`: sign-boundary crossings of Ascendant, Midheaven and the seven traditional bodies inside the interval, each target classified `stable` or `sensitive`, with crossing instants and sign windows.
- `unknown`: calculates date-level body sign stability where possible, does not invent an hour, and does not calculate Ascendant, houses or sect.

The response includes:

- `calculationRun`;
- two `calculationArtifacts` metadata records;
- `result`, the structured calculation output.

The endpoint does not create any `RuleVersion`, does not produce final user interpretation, does not call Internet at runtime, and is not production eligible.

### `GET /api/analyses/:id`

Returns one analysis owned by the current user, including versions, method results, and transversal findings.

### `GET /api/analyses/:id/reports`

Returns report artifacts generated for the selected analysis.

### `POST /api/analyses/:id/reports`

Creates a guarded deterministic report artifact from the selected analysis version.

The current implementation does not call an AI model. It creates controlled sections from structured analysis state and marks the report as `blocked` until successful method results and determinate transversal findings exist.

## Client Dossiers (delivery)

The delivery layer turns a person with saved birth data into a versioned client dossier: a verified factual socle (always local and deterministic) plus narrative sections written per section by an OpenAI-compatible endpoint when `ASTROLAB_LLM_API_KEY` is set, or by a deterministic template writer otherwise. Every narrative section is machine-validated before the dossier can reach `ready_for_human_review`; human review is mandatory before delivery.

### `POST /api/deliverables`

Creates a client dossier for the selected person (or the primary person if omitted). Body may include `personId`, `intention`, and optional `parents` (`role`, `label`, `birthDate`, `birthPlace`).

Response includes `deliverable` metadata (id, person, `status`, `writerMode`, version references) and a `version` summary with per-section `status`, `provider`, and `validation` issues.

Statuses: `template_draft` (no LLM key), `ready_for_human_review` (all sections validated), `needs_review` (at least one section flagged by the machine validator).

### `GET /api/deliverables`

Lists the current user's dossiers.

### `GET /api/deliverables/:id`

Returns the dossier metadata and its current version section summaries.

### `GET /api/deliverables/:id/export?format=html|md|json`

Returns the full rendered dossier. `html` is a standalone styled document (printable to PDF); `md` is Markdown; `json` is the structured version (sections, socle facts, validation).

### `DELETE /api/deliverables/:id`

Deletes the dossier and its versions.

## Commerce

### `GET /api/commerce`

Returns the current user's credit balance, available development plans, orders, and credit ledger.

### `POST /api/commerce/dev-credit-order`

Creates a development-only paid order and appends a positive credit ledger entry.

Body:

```json
{
  "planId": "starter"
}
```

This endpoint does not connect to a payment provider and must not be treated as production payment logic.

### `POST /api/commerce/consume`

Consumes credits from the current user's ledger.

Body:

```json
{
  "amount": 4,
  "reason": "manual_consumption"
}
```

The API returns `402` when the balance is insufficient.

## Administration

Admin endpoints require a verified session whose public user has `primaryRole: "admin"`.

### `GET /api/admin/summary`

Returns system counts and redacted user summaries. Authentication secrets are never included.

### `GET /api/admin/audit`

Returns redacted audit log rows. Query parameters:

- `limit`, capped at 200;
- `action`;
- `ownerUserId`.

The response omits raw `before` and `after` payloads to avoid exposing dossier or authentication details in the audit overview.

## Method Registry

### `GET /api/methods`

Returns method placeholders. Current entries are explicitly `not_implemented` and not production eligible.
