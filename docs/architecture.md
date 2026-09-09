# Architecture V1

## Mission

AstroLab must calculate several documented systems separately, preserve their differences, compare structured outputs, detect motifs, and produce readable AI-assisted reports without presenting hypotheses as facts.

## Architectural Principles

1. A user account is not the same entity as a person in a dossier.
2. Every important datum has a source, status, timestamp, and edit history.
3. Every methodological rule must have a registry entry and a documentation status.
4. A method result is structured data first and prose second.
5. The transversal engine compares results; it does not erase differences.
6. AI writes from approved structured synthesis only; it does not calculate or invent.
7. Analyses are versioned snapshots and are never silently overwritten.
8. Laboratory hypotheses are excluded from commercial reports unless explicitly promoted.

## Proposed Stack

The initial low-cost architecture should be a modular web application:

- Frontend: responsive web app, mobile-first.
- Backend API: typed application service layer.
- Database: relational database for authoritative records.
- Queue: background jobs for heavy analyses and PDF generation.
- Object storage: generated documents and exports.
- Payment provider: external checkout; no direct card storage.
- AI provider: report wording from structured synthesis with validation.

The exact framework can be selected during implementation. The core boundary is more important than the framework: methodological calculations must be isolated from the interface and from AI text generation.

## Main Services

### Identity

Owns accounts, email verification, OAuth identities, sessions, account deletion, and account-level permissions.

### Dossier

Owns persons, birth data, data points, sources, relationships, and edit history.

### Method Registry

Owns traditions, methods, method versions, sources, rules, applicability requirements, documentation status, and production/laboratory status.

### Calculation Engine

Runs one method at a time against explicit input data. It returns structured method results or an explicit non-applicable/non-implemented result.

### Transversal Engine

Compares structured method results to identify convergence, divergence, complementarity, indeterminate relations, stability, dependencies, suppression sensitivity, and motifs.

### Report Engine

Builds a report plan from structured results, runs AI wording where appropriate, then validates output for invented claims, excessive certainty, missing uncertainty, and ignored divergences.

### Commerce

Owns orders, coupons, credits, refunds/goodwill operations, and internal cost accounting.

### Administration

Owns admin roles, temporary grants, audit logs, feature flags, module activation, and commercial configuration.

## Async Jobs

Analyses, recalculations, family comparisons, PDF generation, and expensive question answers should run as jobs with these states:

- `queued`
- `running`
- `succeeded`
- `failed`
- `partially_succeeded`

Module failure should not automatically fail the whole analysis. The final report must disclose unavailable methods.

## AI Boundary

AI receives only:

- structured method results;
- transversal findings;
- uncertainty and contradiction metadata;
- allowed tone rules;
- report section plan.

AI must not receive permission to create new facts, new rules, new sources, or new certainty levels.

Generated text must be validated before display.

