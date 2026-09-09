# AstroLab Method Contract

This document defines the contract for production and laboratory methods. It is a development artifact, not a calculation implementation.

## Core Rule

No production method may use the Internet in real time to determine a rule, calculation, interpretation, or conclusion.

Production knowledge must be internal, documented, versioned, testable, and reproducible.

## Proof Protocol

The amount of information repeating a claim is never, by itself, a measure of truth.

AstroLab must never infer:

- source count equals truth level;
- primary source equals automatic truth;
- majority position equals best documented position;
- undocumented equals false;
- suspected bias equals proven intent.

Every methodological claim must distinguish:

- provenance;
- source independence;
- proximity to primary material;
- documentary quality;
- historical and school context;
- method used;
- reproducibility;
- contradictions;
- documented conflicts of interest, if any;
- transmission state;
- evidence level.

Repeated dependent sources must be representable as one transmission chain. A minority claim can be strong if it is well documented. Contradictions must be preserved.

Every AstroLab hypothesis or discovery must be exposed to counterexamples and tests that actively try to refute it, not only tests that try to confirm it.

## Lifecycle Statuses

### Knowledge Status

- `DISCOVERED`: source or rule candidate identified.
- `DOCUMENTING`: being transcribed, summarized, and traced.
- `INFORMATIVE`: useful context but not a calculation rule.
- `LABORATORY`: usable only in research or experimental views.
- `CANDIDATE_FOR_PRODUCTION`: documented and ready for validation tests.
- `VALIDATED_FOR_PRODUCTION`: approved for deterministic production calculation.
- `REJECTED`: reviewed and not accepted.
- `DEPRECATED`: retained for old analyses but not used for new ones.
- `REPLACED`: superseded by a newer version.

### Documentary Status

- `DOCUMENTED`: documented by an identified source, without implying strength or truth.
- `WELL_SUPPORTED`: supported by strong, traceable, contextually appropriate documentation.
- `WEAKLY_SUPPORTED`: documented but with limited, indirect, late, or fragile support.
- `CONTESTED`: credible disagreement or incompatible attestations exist.
- `TRANSMISSION_UNCERTAIN`: transmission path, textual state, or attribution is materially uncertain.
- `RECONSTRUCTION`: reconstructed from incomplete, indirect, or comparative evidence.
- `HYPOTHESIS`: proposed interpretation or pattern not yet validated.
- `UNVERIFIED`: recorded but not yet checked.
- `NOT_DOCUMENTED`: no supporting documentation currently recorded.
- `REFUTED`: actively rejected by documented evidence or failed validation.
- `UNKNOWN`: state cannot be determined from available documentation.

### Method Runtime Status

- `not_implemented`: no runnable module exists.
- `documentation_insufficient`: sources or rules are not sufficient.
- `unavailable`: method exists but cannot run for the supplied data.
- `laboratory_only`: method can run only outside production.
- `candidate`: implemented but awaiting validation.
- `production`: validated and active for new production analyses.
- `suspended`: temporarily disabled.
- `replaced`: no longer selected for new analyses.

### Method Result Status

- `succeeded`
- `not_applicable`
- `unavailable`
- `not_implemented`
- `documentation_insufficient`
- `failed`

## Required Structures

### KnowledgeSource

Represents a source used to document rules, conventions, interpretations, datasets, or historical context.

Required fields:

- `id`
- `type`: `book`, `paper`, `institution`, `archive`, `museum`, `dataset`, `website`, `internal_decision`, `other`
- `title`
- `authorOrOrganization`
- `publisher`
- `publicationDate`
- `editionOrVersion`
- `url`
- `accessedAt`
- `archivalReference`
- `rightsNotes`
- `reliabilityLevel`: `A`, `B`, `C`, `D`, `E`
- `documentaryStatus`
- `primaryProximity`: `primary`, `near_primary`, `secondary`, `tertiary`, `unknown`
- `transmissionState`
- `independenceGroupId`
- `dependsOnSourceIds`
- `conflictOfInterestNotes`
- `scope`
- `notes`
- `status`

Reliability levels are evidence levels, not truth claims:

- `A`: strong primary or historical documentation.
- `B`: strong secondary or academic documentation.
- `C`: documented interpretive tradition.
- `D`: reconstruction.
- `E`: AstroLab experiment.

### MethodVersion

Represents one immutable version of a method.

Required fields:

- `id`
- `methodId`
- `version`
- `tradition`
- `family`
- `school`
- `methodName`
- `type`: `natal`, `temporal`, `relational`, `familial`, `horary`, `elective`, `mundane`, `calendar`, `divinatory`
- `definition`
- `inputRequirements`
- `calculationScope`
- `interpretationScope`
- `ruleVersionIds`
- `referenceDatasetIds`
- `dependencyIds`
- `knownVariants`
- `limits`
- `status`
- `documentationLevel`
- `productionEligible`
- `createdAt`
- `validatedAt`
- `replacesMethodVersionId`

### RuleVersion

Represents a versioned rule, convention, or parameter set used by a method.

Required fields:

- `id`
- `methodVersionId`
- `kind`: `input_normalization`, `astronomical_parameter`, `zodiac_convention`, `house_system`, `aspect_rule`, `interpretation_rule`, `eligibility_rule`, `uncertainty_rule`
- `name`
- `version`
- `definition`
- `parameters`
- `sourceIds`
- `documentaryStatus`
- `evidenceAssessment`
- `contradictionIds`
- `transmissionChainIds`
- `testCaseIds`
- `refutationTestIds`
- `status`
- `decisionRecord`
- `createdAt`
- `validatedAt`
- `replacesRuleVersionId`

### ReferenceDataset

Represents a controlled dataset required for reproducible calculation.

Required fields:

- `id`
- `name`
- `version`
- `type`: `ephemeris`, `timezone`, `geocoding`, `calendar_conversion`, `test_fixture`, `other`
- `provider`
- `storageLocation`
- `checksum`
- `coverage`
- `parameters`
- `sourceIds`
- `status`

### MethodDependency

Represents dependency or non-independence between methods, rules, or datasets.

Required fields:

- `id`
- `fromMethodVersionId`
- `toMethodVersionId`
- `dependencyType`: `shared_source`, `derived_rule`, `shared_dataset`, `shared_convention`, `historical_influence`, `implementation_dependency`
- `independenceLevel`: `independent`, `partially_dependent`, `strongly_dependent`, `unknown`
- `description`
- `sourceIds`
- `transmissionChainId`
- `status`

### TransmissionChain

Represents dependent repetition or textual transmission of a claim.

Required fields:

- `id`
- `name`
- `description`
- `sourceIds`
- `rootSourceId`
- `knownCopiesOrWitnesses`
- `translationPath`
- `dependencyAssessment`
- `uncertainties`
- `status`

### DocumentaryClaim

Represents one claim extracted from a source without making it a production rule.

Required fields:

- `id`
- `sourceId`
- `corpusId`
- `claimType`: `calculation`, `interpretation`, `definition`, `classification`, `historical_context`, `variant`, `contradiction`
- `claim`
- `context`
- `methodologicalScope`
- `documentaryStatus`
- `evidenceLevel`
- `primaryProximity`
- `transmissionChainId`
- `contradictsClaimIds`
- `supportsClaimIds`
- `notes`
- `status`

### KnowledgeChange

Represents a reviewed change to knowledge, rules, datasets, or method status.

Required fields:

- `id`
- `subjectType`
- `subjectId`
- `previousVersionId`
- `nextVersionId`
- `author`
- `reason`
- `sourceIds`
- `testResults`
- `decision`
- `decidedAt`
- `status`

### CalculationRun

Represents one deterministic execution attempt.

Required fields:

- `id`
- `analysisVersionId`
- `methodVersionId`
- `inputDataHash`
- `inputDataSnapshot`
- `ruleVersionIds`
- `referenceDatasetIds`
- `engineVersion`
- `astronomicalEngineVersion`
- `parameters`
- `startedAt`
- `finishedAt`
- `status`
- `resultHash`
- `error`

### CalculationArtifact

Represents a stored artifact created by a calculation.

Required fields:

- `id`
- `calculationRunId`
- `type`: `normalized_input`, `intermediate_state`, `raw_result`, `chart_data`, `test_output`, `log`
- `format`
- `storageLocation`
- `checksum`
- `createdAt`

### LaboratoryExperiment

Represents a hypothesis, test, or exploratory comparison that is not production knowledge.

Required fields:

- `id`
- `name`
- `hypothesis`
- `scope`
- `methodVersionIds`
- `datasetIds`
- `protocol`
- `controlGroup`
- `negativeTests`
- `counterExamples`
- `refutationCriteria`
- `stabilityTests`
- `dependencyAssessment`
- `result`
- `decision`
- `status`
- `createdAt`

## Reproducibility Fingerprint

Every important calculation must retain enough data to answer: with which data, rules, parameters, versions, and artifacts was this result produced?

Required fingerprint fields:

- `analysisId`
- `analysisVersionId`
- `calculationRunId`
- `createdAt`
- `inputDataVersion`
- `inputDataHash`
- `normalizedInputHash`
- `methodId`
- `methodVersion`
- `ruleVersionIds`
- `referenceDatasetIds`
- `astronomicalEngineVersion`
- `timezoneDatasetVersion`
- `geocodingDatasetVersion`
- `calendarConversionVersion`
- `calculationParameters`
- `calculationArtifactIds`
- `rawResultHash`
- `structuredResultHash`
- `transversalEngineVersion`
- `reportEngineVersion`
- `aiGenerationVersion`, if AI wording is later used
- `aiPromptVersion`, if AI wording is later used
- `aiOutputHash`, if AI wording is later used

## Method Module Boundary

A method module may:

- validate input availability;
- normalize method-specific inputs;
- run deterministic calculations from versioned rules and datasets;
- return structured results;
- return explicit unavailability reasons;
- expose sources and versions used.

A method module must not:

- read the web during production calculation;
- select an undocumented school or convention silently;
- write directly to the UI;
- generate final AI prose;
- merge another tradition into its own output;
- turn a laboratory rule into production behavior.

## Structured Method Result

Every result should be suitable for later transversal comparison.

Required fields:

- `id`
- `calculationRunId`
- `methodId`
- `methodVersion`
- `tradition`
- `school`
- `methodType`
- `personId`
- `dataUsed`
- `parameters`
- `rawResult`
- `concepts`
- `traditionalInterpretations`
- `temporalScope`
- `dataQuality`
- `documentationLevel`
- `independence`
- `uncertainty`
- `sources`
- `limits`
- `status`
- `error`

## Reference Test Requirements

Each production method version must include permanent reference tests covering:

- normal cases;
- missing data;
- approximate birth time;
- interval birth time;
- historical timezone;
- calendar boundary;
- location normalization;
- polar or edge latitudes, if relevant;
- method variants;
- source-backed expected results;
- regression fixtures for old versions.

Tests must fail when a calculation changes unexpectedly. If a rule correction intentionally changes expected results, create a new rule or method version and record a `KnowledgeChange`.
