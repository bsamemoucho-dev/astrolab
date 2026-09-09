# Conceptual Data Model

This model is intentionally conceptual. Names can change during implementation, but the boundaries should remain.

## Identity

### User

Owns an account and authentication state.

Key fields:

- `id`
- `email`
- `emailVerifiedAt`
- `createdAt`
- `deletedAt`
- `primaryRole`

### AuthIdentity

External or local login identity.

Key fields:

- `id`
- `userId`
- `provider`
- `providerSubject`
- `createdAt`

## Dossier

### Person

A person registered in a user's dossier. A person is not automatically a user account.

Key fields:

- `id`
- `ownerUserId`
- `firstName`
- `lastName`
- `birthName`
- `verificationStatus`
- `createdAt`
- `updatedAt`

### Relationship

Typed relation between two persons.

Key fields:

- `id`
- `ownerUserId`
- `fromPersonId`
- `toPersonId`
- `type`
- `sourceId`
- `status`
- `createdAt`

### BirthData

Current normalized view of birth-related data for a person.

Key fields:

- `id`
- `personId`
- `date`
- `timeValue`
- `timeStart`
- `timeEnd`
- `timePrecision`
- `placeName`
- `country`
- `latitude`
- `longitude`
- `timeZone`
- `resolvedPlace`
- `coordinateSource`
- `coordinateConfidence`
- `quality`
- `sourceId`

The user-facing interface records a human birth place and a selected resolved place. Latitude, longitude and IANA time zone are stored for reproducibility, but they are not user-facing manual inputs.

### DataPoint

Atomic sourced value, including contradictory or historical values.

Key fields:

- `id`
- `subjectType`
- `subjectId`
- `field`
- `value`
- `status`
- `sourceId`
- `validFrom`
- `validTo`
- `createdByUserId`
- `createdAt`
- `replacesDataPointId`

### DataSource

Provenance record.

Key fields:

- `id`
- `type`
- `title`
- `authorOrOrganization`
- `reference`
- `url`
- `consultedAt`
- `status`
- `notes`

## Methodology

### Method

Stable method identity.

Key fields:

- `id`
- `tradition`
- `school`
- `name`
- `status`
- `productionEligible`

### MethodVersion

Versioned method rules and limits.

Key fields:

- `id`
- `methodId`
- `version`
- `origin`
- `historicalPeriod`
- `requiredData`
- `rules`
- `knownDependencies`
- `limits`
- `documentationStatus`
- `validatedAt`
- `replacesVersionId`

### Concept

Structured symbolic or methodological concept.

Key fields:

- `id`
- `methodId`
- `name`
- `definition`
- `context`
- `domain`
- `sourceId`

### ConceptBridge

Documented bridge between concepts. A bridge is not an equivalence.

Key fields:

- `id`
- `fromConceptId`
- `toConceptId`
- `status`
- `definition`
- `evidence`
- `sourceId`

## Analysis

### Analysis

Analysis request container.

Key fields:

- `id`
- `ownerUserId`
- `primaryPersonId`
- `scope`
- `status`
- `createdAt`

### AnalysisVersion

Immutable analysis snapshot.

Key fields:

- `id`
- `analysisId`
- `appVersion`
- `engineVersion`
- `dataSnapshot`
- `methodVersionIds`
- `createdAt`

### MethodResult

Structured output of one method version.

Key fields:

- `id`
- `analysisVersionId`
- `methodVersionId`
- `personId`
- `inputDataSnapshot`
- `rawResult`
- `conceptIds`
- `status`
- `uncertainty`
- `sources`

In the current V1 slice, method results can explicitly record `not_implemented` or `documentation_insufficient` without producing a calculation.

### CalculationRun

Executable calculation record for one deterministic run.

Key fields:

- `id`
- `ownerUserId`
- `personId`
- `methodId`
- `methodVersion`
- `status`
- `calculatedAt`
- `inputDataHash`
- `resultHash`
- `engine`
- `createdAt`

In the current V1 slice, `CalculationRun` is used by the Western Natal development calculator. It is separate from `RuleVersion` and from final interpretation.

### CalculationArtifact

Stored reproducibility artifact attached to a calculation run.

Key fields:

- `id`
- `ownerUserId`
- `calculationRunId`
- `type`
- `format`
- `hash`
- `payload`
- `createdAt`

Current artifact types:

- `normalized_input`
- `structured_result`

### TransversalFinding

Structured cross-method comparison result.

Key fields:

- `id`
- `analysisVersionId`
- `type`
- `contributingResultIds`
- `evidence`
- `dependencyAssessment`
- `stability`
- `limits`
- `status`

### Report

Guarded user-facing report artifact generated from one analysis version.

Key fields:

- `id`
- `ownerUserId`
- `analysisId`
- `analysisVersionId`
- `reportEngineVersion`
- `status`
- `sections`
- `guardrails`
- `limits`
- `createdAt`

The current V1 slice creates deterministic blocked reports from structured state. It does not invoke AI wording until the structured result and validation pipeline can support it.

### Pattern

Named motif definition.

Key fields:

- `id`
- `category`
- `name`
- `definition`
- `detectionRule`
- `status`
- `version`

### PatternEvidence

Evidence linking results to a motif.

Key fields:

- `id`
- `patternId`
- `analysisVersionId`
- `methodResultIds`
- `strength`
- `specificity`
- `uncertainty`
- `status`

## Commerce

### Order

Payment or development credit order.

Key fields:

- `id`
- `ownerUserId`
- `planId`
- `credits`
- `amountCents`
- `currency`
- `status`
- `provider`
- `providerReference`
- `createdAt`

The current V1 slice creates `development` provider orders only. No real payment provider is connected.

### CreditLedger

Append-only credit movement ledger.

Key fields:

- `id`
- `ownerUserId`
- `delta`
- `reason`
- `orderId`
- `createdAt`

### Question

Post-report analytical question.

Key fields:

- `id`
- `userId`
- `analysisId`
- `prompt`
- `status`
- `technicalCostClass`
- `creditsCharged`
- `answer`
- `createdAt`

### Coupon

Commercial configuration.

Key fields:

- `id`
- `code`
- `amountOff`
- `currency`
- `validFrom`
- `validUntil`
- `maxRedemptions`
- `status`

## Governance

### AuditLog

Sensitive action journal.

Key fields:

- `id`
- `actorUserId`
- `action`
- `subjectType`
- `subjectId`
- `before`
- `after`
- `createdAt`

### PermissionGrant

Admin or temporary access grant.

Key fields:

- `id`
- `userId`
- `scope`
- `level`
- `validFrom`
- `validUntil`
- `createdByUserId`

### Document

Generated or uploaded document metadata.

Key fields:

- `id`
- `ownerUserId`
- `analysisVersionId`
- `type`
- `storageKey`
- `format`
- `createdAt`

### Experiment

Laboratory hypothesis or method test.

Key fields:

- `id`
- `name`
- `definition`
- `status`
- `createdAt`

### ExperimentResult

Reproducible laboratory result.

Key fields:

- `id`
- `experimentId`
- `inputSnapshot`
- `result`
- `decision`
- `createdAt`
