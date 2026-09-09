import { calculateAngles } from "./angles.mjs";
import { ASTROLAB_MODEL_VERSION, SEVEN_TRADITIONAL_BODIES, SIGN_NAMES } from "./constants.mjs";
import { rawBodyPosition } from "./ephemeris.mjs";
import {
  julianDay,
  localDateTimeToUtc,
  parseDate,
  parseTime,
  timezoneOffsetMinutes,
  validateCoordinates
} from "./time.mjs";

const INTERVAL_TARGETS = Object.freeze(["Ascendant", "Midheaven", ...SEVEN_TRADITIONAL_BODIES]);

const DEFAULT_STEP_SECONDS = 60;
const BISECTION_MAX_ITERATIONS = 60;
const DAY_END_SENTINEL = "24:00:00";

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

function normalizeContext(input) {
  const birthDate = String(input.birthDate ?? "").trim();
  const date = parseDate(birthDate);
  const timeZone = String(input.timeZone ?? "").trim();
  if (!timeZone) {
    const error = new Error("Missing required field: timeZone");
    error.status = 400;
    throw error;
  }
  const coordinates = validateCoordinates(
    requireFiniteNumber("latitude", input.latitude),
    requireFiniteNumber("longitude", input.longitude)
  );
  const stepSecondsRaw = input.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const stepSeconds = Math.round(Number(stepSecondsRaw));
  if (!Number.isInteger(stepSeconds) || stepSeconds < 1 || stepSeconds > 600) {
    const error = new Error("stepSeconds must be an integer between 1 and 600");
    error.status = 400;
    throw error;
  }
  return {
    date,
    birthDate,
    timeZone,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    stepSeconds
  };
}

function addDays(date, days) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function civilDayUtcSpan(date, timeZone) {
  const midnight = { hour: 0, minute: 0, second: 0 };
  const startMs = localDateTimeToUtc({ date, time: midnight, timeZone }).utcInstant.getTime();
  const endMs = localDateTimeToUtc({ date: addDays(date, 1), time: midnight, timeZone }).utcInstant.getTime();
  return { startMs, endMs };
}

function localClockFromUtcMs(utcMs, timeZone) {
  const instant = new Date(utcMs);
  const offsetMinutes = timezoneOffsetMinutes(timeZone, instant);
  const localMs = utcMs + offsetMinutes * 60000 + 500;
  const dayMs = localMs % 86400000;
  let totalSeconds = Math.floor(dayMs / 1000);
  if (totalSeconds >= 86400) {
    totalSeconds = 86399;
  }
  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds % 3600) / 60);
  const second = totalSeconds % 60;
  return [hour, minute, second].map((part) => String(part).padStart(2, "0")).join(":");
}

function normalizedSignIndex(longitude) {
  const normalized = ((longitude % 360) + 360) % 360;
  return Math.floor(normalized / 30);
}

function longitudeForTarget(target, jd, latitude, longitude) {
  if (target === "Ascendant") {
    return calculateAngles({ jd, latitude, longitude }).ascendant.longitude;
  }
  if (target === "Midheaven") {
    return calculateAngles({ jd, latitude, longitude }).midheaven.longitude;
  }
  return rawBodyPosition(target, jd).longitude;
}

function bisectCrossing(target, aMs, bMs, boundaryDegrees, latitude, longitude) {
  const jdAt = (ms) => julianDay(new Date(ms));
  const g = (ms) => {
    const lonAtInstant = longitudeForTarget(target, jdAt(ms), latitude, longitude);
    let delta = lonAtInstant - boundaryDegrees;
    delta = ((delta % 360) + 540) % 360 - 180;
    return delta;
  };
  let a = aMs;
  let b = bMs;
  let ga = g(a);
  for (let iteration = 0; iteration < BISECTION_MAX_ITERATIONS; iteration += 1) {
    const mid = (a + b) / 2;
    const gm = g(mid);
    if (gm === 0 || b - a < 1) {
      return mid;
    }
    if (ga * gm < 0) {
      b = mid;
    } else {
      a = mid;
      ga = gm;
    }
  }
  return (a + b) / 2;
}

function scanDayCrossings(ctx) {
  const { date, timeZone, latitude, longitude, stepSeconds } = ctx;
  const { startMs, endMs } = civilDayUtcSpan(date, timeZone);
  const spanMs = endMs - startMs;
  const intervalCount = Math.max(2, Math.ceil(spanMs / (stepSeconds * 1000)));
  const samples = [];
  for (let index = 0; index <= intervalCount; index += 1) {
    const utcMs = startMs + (spanMs * index) / intervalCount;
    const jd = julianDay(new Date(utcMs));
    const longitudes = {};
    for (const target of INTERVAL_TARGETS) {
      longitudes[target] = longitudeForTarget(target, jd, latitude, longitude);
    }
    samples.push({ utcMs, longitudes });
  }

  const crossingsByTarget = {};
  for (const target of INTERVAL_TARGETS) {
    const crossings = [];
    for (let index = 0; index < intervalCount; index += 1) {
      const first = samples[index];
      const second = samples[index + 1];
      const firstSign = normalizedSignIndex(first.longitudes[target]);
      const secondSign = normalizedSignIndex(second.longitudes[target]);
      if (firstSign === secondSign) {
        continue;
      }
      const boundaryDegrees = 30 * Math.max(firstSign, secondSign);
      const rootMs = bisectCrossing(target, first.utcMs, second.utcMs, boundaryDegrees, latitude, longitude);
      const roundedMs = Math.round(rootMs);
      const forward = ((secondSign - firstSign + 12) % 12) === 1;
      crossings.push({
        utcMs: roundedMs,
        local: localClockFromUtcMs(roundedMs, timeZone),
        boundaryDegrees,
        fromSign: SIGN_NAMES[firstSign],
        toSign: SIGN_NAMES[secondSign],
        direction: forward ? "forward" : "backward"
      });
    }
    crossings.sort((first, second) => first.utcMs - second.utcMs);
    crossingsByTarget[target] = crossings;
  }

  return {
    startMs,
    endMs,
    spanMs,
    intervalCount,
    samples,
    crossingsByTarget
  };
}

function validateMonotonicForwardSequence(crossings) {
  if (!Array.isArray(crossings) || crossings.length !== 12) {
    return false;
  }
  let previousIndex = SIGN_NAMES.indexOf(crossings[0].fromSign);
  for (const crossing of crossings) {
    if (SIGN_NAMES.indexOf(crossing.fromSign) !== previousIndex) {
      return false;
    }
    if (crossing.direction !== "forward") {
      return false;
    }
    previousIndex = SIGN_NAMES.indexOf(crossing.toSign);
  }
  return previousIndex === SIGN_NAMES.indexOf(crossings[0].fromSign);
}

export function ascendantSignWindows(input) {
  const ctx = normalizeContext(input);
  const { date, timeZone, latitude, longitude, stepSeconds } = ctx;
  const day = scanDayCrossings(ctx);
  const ascendantCrossings = day.crossingsByTarget.Ascendant;
  const method = {
    kind: "bracketed_sign_change_resolution",
    samplingStepSeconds: stepSeconds,
    gridSampleCount: day.intervalCount + 1,
    refinement: "bisection_to_sub_millisecond",
    reportedPrecision: "local_second"
  };

  const base = {
    schema: "astrolab.western_natal.ascendant_sign_windows",
    schemaVersion: ASTROLAB_MODEL_VERSION,
    methodId: "western-natal",
    input: {
      birthDate: ctx.birthDate,
      timeZone,
      latitude,
      longitude,
      stepSeconds
    },
    method,
    deterministic: true
  };

  if (!validateMonotonicForwardSequence(ascendantCrossings)) {
    return {
      ...base,
      status: "indeterminate_latitude_behavior",
      reason:
        "The Ascendant does not cross the twelve sign boundaries exactly once forward over this civil day (possible stall or oscillation near a polar latitude). No windows are invented.",
      windows: [],
      limits: [
        "Windows are half-open [startLocal, endLocal): the Ascendant occupies the sign from startLocal until endLocal.",
        "Crossing instants are resolved by bisection over a UTC grid and reported to the nearest local second.",
        "Near or above polar circles the Ascendant can stall or oscillate at a boundary; this method returns indeterminate instead of fabricated windows."
      ]
    };
  }

  const windows = [];
  let cursorMs = day.startMs;
  let cursorLocal = "00:00:00";
  for (let index = 0; index < ascendantCrossings.length; index += 1) {
    const crossing = ascendantCrossings[index];
    windows.push({
      sign: index === 0 ? crossing.fromSign : ascendantCrossings[index - 1].toSign,
      startLocal: cursorLocal,
      startUtcMs: cursorMs,
      endLocal: crossing.local,
      endUtcMs: crossing.utcMs
    });
    cursorMs = crossing.utcMs;
    cursorLocal = crossing.local;
  }
  const lastCrossing = ascendantCrossings[ascendantCrossings.length - 1];
  windows.push({
    sign: lastCrossing.toSign,
    startLocal: cursorLocal,
    startUtcMs: cursorMs,
    endLocal: DAY_END_SENTINEL,
    endUtcMs: day.endMs
  });

  return {
    ...base,
    status: "calculated",
    windows,
    limits: [
      "Windows are half-open [startLocal, endLocal): the Ascendant occupies the sign from startLocal until endLocal.",
      "Crossing instants are resolved by bisection over a UTC grid and reported to the nearest local second.",
      "These windows are calculated facts; they carry no astrological interpretation.",
      "They can be used to check a claimed Ascendant: the reported Ascendant sign must contain the claimed birth time."
    ]
  };
}

function parseLocalTime(value, field) {
  const time = parseTime(value);
  return {
    seconds: time.hour * 3600 + time.minute * 60 + time.second,
    time
  };
}

function signAtUtc(target, utcMs, latitude, longitude) {
  const jd = julianDay(new Date(utcMs));
  return SIGN_NAMES[normalizedSignIndex(longitudeForTarget(target, jd, latitude, longitude))];
}

function windowsFromCrossings(target, startMs, endMs, crossings, timeZone, latitude, longitude) {
  const relevant = crossings.filter((crossing) => crossing.utcMs > startMs && crossing.utcMs < endMs);
  if (relevant.length === 0) {
    const signAtStart = signAtUtc(target, startMs, latitude, longitude);
    return {
      target,
      status: "stable",
      signAtStart,
      signAtEnd: signAtStart,
      note: "no sign boundary crossed within the interval"
    };
  }
  const windows = [];
  let cursorMs = startMs;
  for (const crossing of relevant) {
    windows.push({
      sign: signAtUtc(target, cursorMs, latitude, longitude),
      startLocal: localClockFromUtcMs(cursorMs, timeZone),
      startUtcMs: cursorMs,
      endLocal: crossing.local,
      endUtcMs: crossing.utcMs
    });
    cursorMs = crossing.utcMs;
  }
  windows.push({
    sign: signAtUtc(target, cursorMs, latitude, longitude),
    startLocal: localClockFromUtcMs(cursorMs, timeZone),
    startUtcMs: cursorMs,
    endLocal: localClockFromUtcMs(endMs, timeZone),
    endUtcMs: endMs
  });

  return {
    target,
    status: "sensitive",
    signAtStart: windows[0].sign,
    signAtEnd: windows[windows.length - 1].sign,
    crossingTimes: relevant.map((crossing) => ({
      local: crossing.local,
      utcMs: crossing.utcMs,
      fromSign: crossing.fromSign,
      toSign: crossing.toSign,
      direction: crossing.direction
    })),
    windows,
    note:
      target === "Ascendant"
        ? "the Ascendant crosses a sign boundary inside the interval; every Whole Sign house placement rotates at that instant"
        : `${target} crosses a sign boundary inside the interval`
  };
}

export function uncertainIntervalAnalysis(input) {
  const ctx = normalizeContext(input);
  const { date, timeZone, latitude, longitude, stepSeconds } = ctx;
  const start = parseLocalTime(input.timeStart, "timeStart");
  const end = parseLocalTime(input.timeEnd, "timeEnd");
  if (end.seconds <= start.seconds) {
    const error = new Error("timeEnd must be later than timeStart within the same civil day");
    error.status = 400;
    throw error;
  }

  const startUtcMs = localDateTimeToUtc({ date, time: start.time, timeZone }).utcInstant.getTime();
  const endUtcMs = localDateTimeToUtc({ date, time: end.time, timeZone }).utcInstant.getTime();
  const day = scanDayCrossings(ctx);

  const ascendantMonotonic = validateMonotonicForwardSequence(day.crossingsByTarget.Ascendant);
  const midheavenMonotonic = validateMonotonicForwardSequence(day.crossingsByTarget.Midheaven);

  const targets = INTERVAL_TARGETS.map((target) => {
    const classified = windowsFromCrossings(
      target,
      startUtcMs,
      endUtcMs,
      day.crossingsByTarget[target],
      timeZone,
      latitude,
      longitude
    );
    const monotonic = target === "Ascendant" ? ascendantMonotonic : target === "Midheaven" ? midheavenMonotonic : true;
    if (!monotonic) {
      return {
        target,
        status: "indeterminate",
        signAtStart: signAtUtc(target, startUtcMs, latitude, longitude),
        signAtEnd: signAtUtc(target, endUtcMs, latitude, longitude),
        note: "the target can stall or oscillate at a sign boundary near or above polar latitudes on this civil day; stability cannot be classified from sign crossings alone",
        windows: []
      };
    }
    return classified;
  });

  const stableTargets = targets.filter((entry) => entry.status === "stable").map((entry) => entry.target);
  const sensitiveTargets = targets.filter((entry) => entry.status === "sensitive").map((entry) => entry.target);
  const indeterminateTargets = targets.filter((entry) => entry.status === "indeterminate").map((entry) => entry.target);

  return {
    schema: "astrolab.western_natal.interval_stability_analysis",
    schemaVersion: ASTROLAB_MODEL_VERSION,
    methodId: "western-natal",
    status: "calculated",
    input: {
      birthDate: ctx.birthDate,
      timeZone,
      latitude,
      longitude,
      timeStart: String(input.timeStart),
      timeEnd: String(input.timeEnd),
      stepSeconds
    },
    interval: {
      startLocal: String(input.timeStart),
      endLocal: String(input.timeEnd),
      startUtcMs,
      endUtcMs,
      durationSeconds: Math.round((endUtcMs - startUtcMs) / 1000)
    },
    targets,
    summary: {
      stableTargets,
      sensitiveTargets,
      indeterminateTargets,
      housesNote: "Whole Sign house placements change at every Ascendant sign boundary crossed within the interval."
    },
    method: {
      kind: "bracketed_sign_change_resolution_over_local_interval",
      samplingStepSeconds: stepSeconds,
      gridSampleCount: day.intervalCount + 1,
      refinement: "bisection_to_sub_millisecond",
      reportedPrecision: "local_second",
      classification: "stable when no sign boundary is crossed; sensitive when at least one is crossed; indeterminate when day-level angle behavior is not monotonic (polar latitudes); relatively_stable is not assigned until thresholds are validated"
    },
    deterministic: true
  };
}
