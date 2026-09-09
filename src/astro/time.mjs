import { normalizeSignedDegrees } from "./math.mjs";

function requireFiniteNumber(name, value) {
  if (value === null || value === undefined || value === "") {
    const error = new Error(`${name} must be provided`);
    error.status = 400;
    throw error;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const error = new Error(`${name} must be a finite number`);
    error.status = 400;
    throw error;
  }
  return number;
}

export function parseDate(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const error = new Error("birthDate must use YYYY-MM-DD");
    error.status = 400;
    throw error;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    const error = new Error("birthDate is not a valid calendar date");
    error.status = 400;
    throw error;
  }

  return {
    year,
    month,
    day
  };
}

export function parseTime(value) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    const error = new Error("timeValue must use HH:MM or HH:MM:SS");
    error.status = 400;
    throw error;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) {
    const error = new Error("timeValue is not a valid clock time");
    error.status = 400;
    throw error;
  }
  return { hour, minute, second };
}

export function validateCoordinates(latitude, longitude) {
  const lat = requireFiniteNumber("latitude", latitude);
  const lon = requireFiniteNumber("longitude", longitude);
  if (lat < -90 || lat > 90) {
    const error = new Error("latitude must be between -90 and 90");
    error.status = 400;
    throw error;
  }
  if (lon < -180 || lon > 180) {
    const error = new Error("longitude must be between -180 and 180");
    error.status = 400;
    throw error;
  }
  return { latitude: lat, longitude: lon };
}

export function timezoneOffsetMinutes(timeZone, instant) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).formatToParts(instant);
  } catch (error) {
    const wrapped = new Error(`Invalid or unsupported timeZone: ${timeZone}`);
    wrapped.status = 400;
    throw wrapped;
  }

  const fields = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const localAsUtc = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
  return Math.round((localAsUtc - instant.getTime()) / 60000);
}

export function localDateTimeToUtc({ date, time, timeZone }) {
  const firstGuess = new Date(Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second));
  const firstOffset = timezoneOffsetMinutes(timeZone, firstGuess);
  const secondGuess = new Date(firstGuess.getTime() - firstOffset * 60000);
  const secondOffset = timezoneOffsetMinutes(timeZone, secondGuess);
  const utcInstant = new Date(firstGuess.getTime() - secondOffset * 60000);
  return {
    utcInstant,
    timezoneOffsetMinutes: secondOffset
  };
}

export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function gmstDegrees(jd) {
  const t = (jd - 2451545.0) / 36525;
  return normalizeSignedDegrees(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000);
}
