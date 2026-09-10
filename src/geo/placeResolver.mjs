const LOCAL_GAZETTEER_VERSION = "astrolab-local-gazetteer@0.1.0-dev";
const OPEN_METEO_GEOCODING_VERSION = "open-meteo-geocoding-api@2026-09-01";
const OPEN_METEO_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

const PLACES = [
  {
    id: "paris-fr",
    name: "Paris, France",
    country: "France",
    latitude: 48.8566,
    longitude: 2.3522,
    timeZone: "Europe/Paris",
    aliases: ["paris", "paris france", "paris, france"]
  },
  {
    id: "lyon-fr",
    name: "Lyon, France",
    country: "France",
    latitude: 45.764,
    longitude: 4.8357,
    timeZone: "Europe/Paris",
    aliases: ["lyon", "lyon france", "lyon, france"]
  },
  {
    id: "marseille-fr",
    name: "Marseille, France",
    country: "France",
    latitude: 43.2965,
    longitude: 5.3698,
    timeZone: "Europe/Paris",
    aliases: ["marseille", "marseille france", "marseille, france"]
  },
  {
    id: "london-gb",
    name: "London, United Kingdom",
    country: "United Kingdom",
    latitude: 51.5072,
    longitude: -0.1276,
    timeZone: "Europe/London",
    aliases: ["london", "london uk", "london united kingdom", "london, united kingdom"]
  },
  {
    id: "new-york-us",
    name: "New York, United States",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
    timeZone: "America/New_York",
    aliases: ["new york", "new york usa", "new york united states", "new york, united states"]
  },
  {
    id: "springfield-il-us",
    name: "Springfield, Illinois, United States",
    country: "United States",
    latitude: 39.7817,
    longitude: -89.6501,
    timeZone: "America/Chicago",
    aliases: ["springfield"]
  },
  {
    id: "springfield-ma-us",
    name: "Springfield, Massachusetts, United States",
    country: "United States",
    latitude: 42.1015,
    longitude: -72.5898,
    timeZone: "America/New_York",
    aliases: ["springfield"]
  }
];

function normalizeQuery(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function publicPlace(place) {
  return {
    id: place.id,
    name: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    timeZone: place.timeZone
  };
}

function encodeExternalCandidate(candidate) {
  return `open-meteo:${Buffer.from(JSON.stringify(candidate), "utf8").toString("base64url")}`;
}

function decodeExternalCandidate(placeId) {
  if (!String(placeId ?? "").startsWith("open-meteo:")) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(placeId.slice("open-meteo:".length), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function selectedPlace(place, { birthDate, source, confidence, timezoneRuleSource }) {
  return {
    ...publicPlace(place),
    selectedName: place.name,
    timezoneRule: {
      timeZone: place.timeZone,
      birthDate: birthDate ?? null,
      source: timezoneRuleSource,
      status: "iana_zone_selected_historical_rule_not_independently_audited"
    },
    resolutionSource: source,
    confidence,
    normalizedForCalculation: {
      placeName: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      timeZone: place.timeZone
    }
  };
}

export function searchPlaces(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }
  return PLACES.filter((place) =>
    place.aliases.some((alias) => normalizeQuery(alias).includes(normalized) || normalized.includes(normalizeQuery(alias)))
  ).map(publicPlace);
}

export function resolvePlace({ query, placeId, birthDate } = {}) {
  const externalCandidate = decodeExternalCandidate(placeId);
  if (externalCandidate) {
    return selectedPlace(externalCandidate, {
      birthDate,
      source: OPEN_METEO_GEOCODING_VERSION,
      confidence: "external_geocoding_unverified",
      timezoneRuleSource: "IANA time zone identifier returned by Open-Meteo Geocoding"
    });
  }

  const matches = placeId ? PLACES.filter((place) => place.id === placeId) : searchPlaces(query);
  if (matches.length === 0) {
    const error = new Error("Birth place could not be resolved");
    error.status = 404;
    throw error;
  }
  if (matches.length > 1) {
    const error = new Error("Birth place is ambiguous; select one resolved place");
    error.status = 409;
    error.matches = matches.map(publicPlace);
    throw error;
  }

  const place = matches[0];
  return selectedPlace(place, {
    birthDate,
    source: LOCAL_GAZETTEER_VERSION,
    confidence: "development_fixture",
    timezoneRuleSource: "IANA time zone identifier from local development gazetteer"
  });
}

function fromOpenMeteoResult(result) {
  const locationParts = [result.name, result.admin1, result.country].filter(Boolean);
  const name = [...new Set(locationParts)].join(", ");
  return {
    id: encodeExternalCandidate({
      id: `open-meteo-${result.id}`,
      name,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
      timeZone: result.timezone
    }),
    name,
    country: result.country,
    latitude: result.latitude,
    longitude: result.longitude,
    timeZone: result.timezone
  };
}

async function searchOpenMeteoPlaces(query) {
  if (process.env.ASTROLAB_DISABLE_EXTERNAL_PLACE_RESOLUTION === "1") {
    return [];
  }

  const url = new URL(OPEN_METEO_ENDPOINT);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "fr");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) {
    const error = new Error("External place resolution service is unavailable");
    error.status = 502;
    throw error;
  }
  const payload = await response.json();
  return (payload.results ?? []).filter((result) => result.latitude && result.longitude && result.timezone).map(fromOpenMeteoResult);
}

// Requêtes de secours utilisées quand la saisie exacte ne donne rien : on
// tolère une faute de frappe en fin de mot (« Marseile » → « Marsei ») ou un
// mot en trop en fin de saisie (« Marseille Frnce » → « Marseille »).
export function approximateQueries(query) {
  const base = String(query ?? "").trim();
  if (!base) {
    return [];
  }
  const candidates = [];
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    candidates.push(words.slice(0, -1).join(" "));
  }
  for (const drop of [1, 2]) {
    if (base.length - drop >= 4) {
      candidates.push(base.slice(0, base.length - drop));
    }
  }
  const normalizedBase = normalizeQuery(base);
  return [...new Set(candidates.map((value) => value.trim()))].filter(
    (value) => value.length >= 4 && normalizeQuery(value) !== normalizedBase
  );
}

// Renvoie les lieux candidats et précise s'ils proviennent d'une recherche
// approximative (saisie fautive) pour que l'interface puisse le signaler.
export async function searchPlacesForEntryDetailed(query) {
  const localMatches = searchPlaces(query);
  if (localMatches.length) {
    return { places: localMatches, approximate: false };
  }
  const directMatches = await searchOpenMeteoPlaces(query);
  if (directMatches.length) {
    return { places: directMatches, approximate: false };
  }
  for (const candidate of approximateQueries(query)) {
    const matches = await searchOpenMeteoPlaces(candidate);
    if (matches.length) {
      return { places: matches, approximate: true };
    }
  }
  return { places: [], approximate: false };
}

export async function searchPlacesForEntry(query) {
  return (await searchPlacesForEntryDetailed(query)).places;
}

export async function resolvePlaceForEntry({ query, placeId, birthDate } = {}) {
  try {
    return resolvePlace({ query, placeId, birthDate });
  } catch (error) {
    if (error.status !== 404 || placeId) {
      throw error;
    }
  }

  const matches = await searchOpenMeteoPlaces(query);
  if (matches.length === 0) {
    const error = new Error("Birth place could not be resolved");
    error.status = 404;
    throw error;
  }
  if (matches.length > 1) {
    const error = new Error("Birth place is ambiguous; select one resolved place");
    error.status = 409;
    error.matches = matches;
    throw error;
  }

  return resolvePlace({ placeId: matches[0].id, birthDate });
}

export function placeResolverVersion() {
  return LOCAL_GAZETTEER_VERSION;
}
