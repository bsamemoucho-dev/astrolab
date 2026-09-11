import { calculateWesternNatalChart } from "../astro/westernNatal.mjs";
import { resolvePlace } from "../geo/placeResolver.mjs";

function now() {
  return new Date().toISOString();
}

function publicRun(run) {
  return {
    id: run.id,
    personId: run.personId,
    methodId: run.methodId,
    methodVersion: run.methodVersion,
    status: run.status,
    calculatedAt: run.calculatedAt,
    inputDataHash: run.inputDataHash,
    resultHash: run.resultHash,
    engine: run.engine
  };
}

function requirePrimaryPerson(state, userId, personId) {
  const person = personId
    ? state.persons.find((entry) => entry.ownerUserId === userId && entry.id === personId)
    : state.persons.find((entry) => entry.ownerUserId === userId && entry.isPrimary);
  if (!person) {
    const error = new Error("Person not found");
    error.status = 404;
    throw error;
  }
  return person;
}

function inputFromPersonAndBirth(person, birth, overrides) {
  const resolvedPlace = overrides.resolvedPlace ?? birth?.resolvedPlace ?? null;
  const placeQuery = overrides.birthPlace ?? overrides.placeName ?? birth?.placeName;
  const selectedPlace = resolvedPlace
    ? resolvedPlace
    : resolvePlace({
        query: placeQuery,
        placeId: overrides.placeId,
        birthDate: overrides.birthDate ?? birth?.birthDate
      });

  return {
    personId: person.id,
    birthDate: overrides.birthDate ?? birth?.birthDate,
    timeValue: overrides.timeValue ?? birth?.timeValue,
    timeMarginMinutes: overrides.timeMarginMinutes ?? birth?.timeMarginMinutes ?? null,
    timeStart: overrides.timeStart ?? birth?.timeStart,
    timeEnd: overrides.timeEnd ?? birth?.timeEnd,
    timePrecision: overrides.timePrecision ?? birth?.timePrecision,
    birthPlace: selectedPlace.selectedName,
    country: selectedPlace.country,
    latitude: selectedPlace.normalizedForCalculation.latitude,
    longitude: selectedPlace.normalizedForCalculation.longitude,
    timeZone: selectedPlace.normalizedForCalculation.timeZone,
    resolvedPlace: selectedPlace,
    coordinateSource: selectedPlace.resolutionSource,
    coordinateConfidence: selectedPlace.confidence
  };
}

export async function calculateWesternNatalForUser(store, userId, input = {}) {
  return store.transact((state) => {
    state.calculationRuns ??= [];
    state.calculationArtifacts ??= [];

    const person = requirePrimaryPerson(state, userId, input.personId);
    const birth = state.birthData.find((entry) => entry.ownerUserId === userId && entry.personId === person.id);
    if (!birth) {
      const error = new Error("Birth data not found for selected person");
      error.status = 400;
      throw error;
    }

    const calculatedAt = now();
    const calculation = calculateWesternNatalChart(inputFromPersonAndBirth(person, birth, input), {
      runId: store.id("calc"),
      normalizedInputArtifactId: store.id("artifact"),
      resultArtifactId: store.id("artifact"),
      calculatedAt
    });

    const storedRun = {
      ...calculation.calculationRun,
      ownerUserId: userId,
      createdAt: calculatedAt
    };
    const storedArtifacts = calculation.calculationArtifacts.map((artifact) => ({
      ...artifact,
      ownerUserId: userId,
      calculationRunId: storedRun.id,
      createdAt: calculatedAt
    }));

    state.calculationRuns.push(storedRun);
    state.calculationArtifacts.push(...storedArtifacts);
    state.auditLogs.push({
      id: store.id("audit"),
      actorUserId: userId,
      ownerUserId: userId,
      action: "calculation.western_natal.created",
      subjectType: "CalculationRun",
      subjectId: storedRun.id,
      before: null,
      after: publicRun(storedRun),
      createdAt: calculatedAt
    });

    return {
      calculationRun: publicRun(storedRun),
      calculationArtifacts: storedArtifacts.map((artifact) => ({
        id: artifact.id,
        calculationRunId: artifact.calculationRunId,
        type: artifact.type,
        format: artifact.format,
        hash: artifact.hash
      })),
      result: calculation.result
    };
  });
}
