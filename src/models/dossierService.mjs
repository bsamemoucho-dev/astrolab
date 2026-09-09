import { DATA_STATUSES, RELATIONSHIP_TYPES, TIME_PRECISIONS } from "../core/domain.mjs";
import { classifyBirthTimePrecision, validateBirthTimePrecision } from "../core/validation.mjs";

const DATA_STATUS_SET = new Set(DATA_STATUSES);
const RELATIONSHIP_TYPE_SET = new Set(RELATIONSHIP_TYPES);

function now() {
  return new Date().toISOString();
}

function cleanString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanJsonObject(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function requireOwnerPerson(state, ownerUserId, personId) {
  const person = state.persons.find((entry) => entry.id === personId && entry.ownerUserId === ownerUserId);
  if (!person) {
    const error = new Error("Person not found");
    error.status = 404;
    throw error;
  }
  return person;
}

function createSource(state, store, ownerUserId, input) {
  const source = {
    id: store.id("source"),
    ownerUserId,
    type: input?.sourceType ?? "user",
    title: cleanString(input?.sourceTitle) ?? "User-provided information",
    reference: cleanString(input?.sourceReference),
    notes: cleanString(input?.sourceNote),
    status: input?.sourceStatus ?? "available",
    consultedAt: now(),
    createdAt: now()
  };
  state.dataSources.push(source);
  return source;
}

function appendAudit(state, store, actorUserId, action, subjectType, subjectId, before, after) {
  state.auditLogs.push({
    id: store.id("audit"),
    actorUserId,
    ownerUserId: actorUserId,
    action,
    subjectType,
    subjectId,
    before,
    after,
    createdAt: now()
  });
}

function appendDataPoint(state, store, ownerUserId, createdByUserId, subjectType, subjectId, field, value, status, sourceId, previousId = null) {
  if (!DATA_STATUS_SET.has(status)) {
    const error = new Error(`Unknown data status: ${status}`);
    error.status = 400;
    throw error;
  }

  const dataPoint = {
    id: store.id("dp"),
    ownerUserId,
    subjectType,
    subjectId,
    field,
    value,
    status,
    sourceId,
    validFrom: now(),
    validTo: null,
    createdByUserId,
    replacesDataPointId: previousId,
    createdAt: now()
  };
  state.dataPoints.push(dataPoint);
  return dataPoint;
}

function buildBirthData(input, sourceId) {
  const timePrecision = input.timePrecision ?? classifyBirthTimePrecision(input);
  validateBirthTimePrecision(timePrecision);

  if (timePrecision === "exact" && !input.timeValue) {
    const error = new Error("Exact birth time requires timeValue");
    error.status = 400;
    throw error;
  }

  if (timePrecision === "interval" && (!input.timeStart || !input.timeEnd)) {
    const error = new Error("Interval birth time requires timeStart and timeEnd");
    error.status = 400;
    throw error;
  }

  if (!TIME_PRECISIONS.includes(timePrecision)) {
    const error = new Error("Invalid time precision");
    error.status = 400;
    throw error;
  }

  const resolvedPlace = cleanJsonObject(input.resolvedPlace);
  const resolvedCalculationPlace = resolvedPlace?.normalizedForCalculation;

  return {
    birthDate: cleanString(input.birthDate),
    timeValue: timePrecision === "unknown" ? null : cleanString(input.timeValue),
    timeStart: timePrecision === "interval" ? cleanString(input.timeStart) : null,
    timeEnd: timePrecision === "interval" ? cleanString(input.timeEnd) : null,
    timePrecision,
    placeName: cleanString(input.birthPlace) ?? cleanString(resolvedCalculationPlace?.placeName),
    country: cleanString(input.country) ?? cleanString(resolvedPlace?.country),
    latitude: cleanNumber(input.latitude) ?? cleanNumber(resolvedCalculationPlace?.latitude),
    longitude: cleanNumber(input.longitude) ?? cleanNumber(resolvedCalculationPlace?.longitude),
    timeZone: cleanString(input.timeZone) ?? cleanString(resolvedCalculationPlace?.timeZone),
    resolvedPlace,
    coordinateSource: cleanString(input.coordinateSource) ?? cleanString(resolvedPlace?.resolutionSource),
    coordinateConfidence: cleanString(input.coordinateConfidence) ?? cleanString(resolvedPlace?.confidence),
    quality: input.quality ?? "user_provided",
    sourceId
  };
}

export async function getDossier(store, userId) {
  const state = await store.load();
  const user = state.users.find((entry) => entry.id === userId);
  const people = state.persons.filter((person) => person.ownerUserId === userId);
  const birthData = state.birthData.filter((entry) => entry.ownerUserId === userId);
  const relationships = state.relationships.filter((entry) => entry.ownerUserId === userId);
  const history = state.auditLogs
    .filter((entry) => entry.ownerUserId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    user: user ? { id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt } : null,
    people,
    birthData,
    relationships,
    history
  };
}

export async function exportDossier(store, userId) {
  const state = await store.load();
  const user = state.users.find((entry) => entry.id === userId);
  if (!user || user.deletedAt) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  return {
    exportedAt: now(),
    user: {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      deletedAt: user.deletedAt,
      primaryRole: user.primaryRole
    },
    persons: state.persons.filter((entry) => entry.ownerUserId === userId),
    birthData: state.birthData.filter((entry) => entry.ownerUserId === userId),
    relationships: state.relationships.filter((entry) => entry.ownerUserId === userId),
    dataPoints: state.dataPoints.filter((entry) => entry.ownerUserId === userId),
    dataSources: state.dataSources.filter((entry) => entry.ownerUserId === userId),
    analyses: state.analyses.filter((entry) => entry.ownerUserId === userId),
    analysisVersions: state.analysisVersions.filter((entry) => state.analyses.some((analysis) => analysis.ownerUserId === userId && analysis.id === entry.analysisId)),
    methodResults: state.methodResults.filter((entry) =>
      state.analysisVersions.some((version) => state.analyses.some((analysis) => analysis.ownerUserId === userId && analysis.id === version.analysisId) && version.id === entry.analysisVersionId)
    ),
    transversalFindings: state.transversalFindings.filter((entry) =>
      state.analysisVersions.some((version) => state.analyses.some((analysis) => analysis.ownerUserId === userId && analysis.id === version.analysisId) && version.id === entry.analysisVersionId)
    ),
    calculationRuns: (state.calculationRuns ?? []).filter((entry) => entry.ownerUserId === userId),
    calculationArtifacts: (state.calculationArtifacts ?? []).filter((entry) => entry.ownerUserId === userId),
    reports: state.reports.filter((entry) => entry.ownerUserId === userId),
    orders: state.orders.filter((entry) => entry.ownerUserId === userId),
    creditLedger: state.creditLedger.filter((entry) => entry.ownerUserId === userId),
    auditLogs: state.auditLogs.filter((entry) => entry.ownerUserId === userId)
  };
}

export async function upsertPrimaryProfile(store, userId, input) {
  return store.transact((state) => {
    if (!cleanString(input.firstName) || !cleanString(input.birthDate) || !cleanString(input.birthPlace)) {
      const error = new Error("Primary profile requires firstName, birthDate, and birthPlace");
      error.status = 400;
      throw error;
    }

    let person = state.persons.find((entry) => entry.ownerUserId === userId && entry.isPrimary === true);
    const beforePerson = person ? structuredClone(person) : null;
    const source = createSource(state, store, userId, input);

    if (!person) {
      person = {
        id: store.id("person"),
        ownerUserId: userId,
        isPrimary: true,
        firstName: cleanString(input.firstName),
        lastName: cleanString(input.lastName),
        birthName: cleanString(input.birthName),
        verificationStatus: "user_declared",
        createdAt: now(),
        updatedAt: now()
      };
      state.persons.push(person);
    } else {
      person.firstName = cleanString(input.firstName);
      person.lastName = cleanString(input.lastName);
      person.birthName = cleanString(input.birthName);
      person.updatedAt = now();
    }

    const birth = buildBirthData(input, source.id);
    const previousBirth = state.birthData.find((entry) => entry.ownerUserId === userId && entry.personId === person.id);
    const beforeBirth = previousBirth ? structuredClone(previousBirth) : null;

    if (previousBirth) {
      Object.assign(previousBirth, birth, { updatedAt: now() });
    } else {
      state.birthData.push({
        id: store.id("birth"),
        ownerUserId: userId,
        personId: person.id,
        ...birth,
        createdAt: now(),
        updatedAt: now()
      });
    }

    for (const [field, value] of Object.entries({ firstName: person.firstName, lastName: person.lastName, birthName: person.birthName, ...birth })) {
      appendDataPoint(state, store, userId, userId, field in birth ? "BirthData" : "Person", person.id, field, value, value ? "confirmed" : "unknown", source.id);
    }

    appendAudit(state, store, userId, beforePerson ? "profile.updated" : "profile.created", "Person", person.id, { person: beforePerson, birthData: beforeBirth }, { person, birthData: birth });
    return { person, birthData: state.birthData.find((entry) => entry.ownerUserId === userId && entry.personId === person.id) };
  });
}

export async function createLinkedPerson(store, userId, input) {
  return store.transact((state) => {
    const source = createSource(state, store, userId, input);
    const person = {
      id: store.id("person"),
      ownerUserId: userId,
      isPrimary: false,
      firstName: cleanString(input.firstName),
      lastName: cleanString(input.lastName),
      birthName: cleanString(input.birthName),
      verificationStatus: input.verificationStatus ?? "user_declared",
      createdAt: now(),
      updatedAt: now()
    };

    state.persons.push(person);

    const hasBirthData =
      input.birthDate ||
      input.timeValue ||
      input.timeStart ||
      input.timeEnd ||
      input.birthPlace ||
      input.country ||
      input.latitude ||
      input.longitude ||
      input.timeZone;
    let birth = null;
    if (hasBirthData) {
      birth = {
        id: store.id("birth"),
        ownerUserId: userId,
        personId: person.id,
        ...buildBirthData(input, source.id),
        createdAt: now(),
        updatedAt: now()
      };
      state.birthData.push(birth);
    }

    appendDataPoint(state, store, userId, userId, "Person", person.id, "firstName", person.firstName, person.firstName ? "confirmed" : "unknown", source.id);
    appendAudit(state, store, userId, "person.created", "Person", person.id, null, { person, birthData: birth });
    return { person, birthData: birth };
  });
}

export async function updateLinkedPerson(store, userId, personId, input) {
  return store.transact((state) => {
    const person = requireOwnerPerson(state, userId, personId);
    const beforePerson = structuredClone(person);
    const source = createSource(state, store, userId, input);

    person.firstName = cleanString(input.firstName);
    person.lastName = cleanString(input.lastName);
    person.birthName = cleanString(input.birthName);
    person.verificationStatus = input.verificationStatus ?? person.verificationStatus;
    person.updatedAt = now();

    const hasBirthData =
      input.birthDate ||
      input.timeValue ||
      input.timeStart ||
      input.timeEnd ||
      input.birthPlace ||
      input.country ||
      input.latitude ||
      input.longitude ||
      input.timeZone ||
      input.timePrecision;
    let birth = state.birthData.find((entry) => entry.ownerUserId === userId && entry.personId === person.id);
    const beforeBirth = birth ? structuredClone(birth) : null;
    if (hasBirthData) {
      const nextBirth = buildBirthData(input, source.id);
      if (birth) {
        Object.assign(birth, nextBirth, { updatedAt: now() });
      } else {
        birth = {
          id: store.id("birth"),
          ownerUserId: userId,
          personId: person.id,
          ...nextBirth,
          createdAt: now(),
          updatedAt: now()
        };
        state.birthData.push(birth);
      }
    }

    appendDataPoint(state, store, userId, userId, "Person", person.id, "firstName", person.firstName, person.firstName ? "confirmed" : "unknown", source.id);
    appendAudit(state, store, userId, "person.updated", "Person", person.id, { person: beforePerson, birthData: beforeBirth }, { person, birthData: birth });
    return { person, birthData: birth };
  });
}

export async function deletePerson(store, userId, personId) {
  return store.transact((state) => {
    const person = requireOwnerPerson(state, userId, personId);
    if (person.isPrimary) {
      const error = new Error("Primary profile cannot be deleted from this endpoint");
      error.status = 400;
      throw error;
    }

    const before = {
      person: structuredClone(person),
      birthData: state.birthData.filter((entry) => entry.ownerUserId === userId && entry.personId === personId),
      relationships: state.relationships.filter((entry) => entry.ownerUserId === userId && (entry.fromPersonId === personId || entry.toPersonId === personId))
    };

    state.persons = state.persons.filter((entry) => !(entry.ownerUserId === userId && entry.id === personId));
    state.birthData = state.birthData.filter((entry) => !(entry.ownerUserId === userId && entry.personId === personId));
    state.relationships = state.relationships.filter((entry) => !(entry.ownerUserId === userId && (entry.fromPersonId === personId || entry.toPersonId === personId)));
    appendAudit(state, store, userId, "person.deleted", "Person", personId, before, null);
    return { deleted: true };
  });
}

export async function createRelationship(store, userId, input) {
  return store.transact((state) => {
    if (input.fromPersonId === input.toPersonId) {
      const error = new Error("Relationship requires two different people");
      error.status = 400;
      throw error;
    }

    requireOwnerPerson(state, userId, input.fromPersonId);
    requireOwnerPerson(state, userId, input.toPersonId);

    if (!RELATIONSHIP_TYPE_SET.has(input.type)) {
      const error = new Error("Invalid relationship type");
      error.status = 400;
      throw error;
    }

    const source = createSource(state, store, userId, input);
    const relationship = {
      id: store.id("rel"),
      ownerUserId: userId,
      fromPersonId: input.fromPersonId,
      toPersonId: input.toPersonId,
      type: input.type,
      status: input.status ?? "confirmed",
      sourceId: source.id,
      createdAt: now(),
      updatedAt: now()
    };

    state.relationships.push(relationship);
    appendAudit(state, store, userId, "relationship.created", "Relationship", relationship.id, null, relationship);
    return relationship;
  });
}

export async function deleteRelationship(store, userId, relationshipId) {
  return store.transact((state) => {
    const relationship = state.relationships.find((entry) => entry.ownerUserId === userId && entry.id === relationshipId);
    if (!relationship) {
      const error = new Error("Relationship not found");
      error.status = 404;
      throw error;
    }

    state.relationships = state.relationships.filter((entry) => !(entry.ownerUserId === userId && entry.id === relationshipId));
    appendAudit(state, store, userId, "relationship.deleted", "Relationship", relationshipId, relationship, null);
    return { deleted: true };
  });
}
