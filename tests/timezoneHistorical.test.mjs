import assert from "node:assert/strict";
import test from "node:test";

import { localDateTimeToUtc, parseDate, parseTime, timezoneDatabaseVersion } from "../src/astro/time.mjs";

function convert(date, time, timeZone) {
  return localDateTimeToUtc({
    date: parseDate(date),
    time: parseTime(time),
    timeZone
  });
}

test("la conversion civile utilise les règles IANA historiques et expose leur version", () => {
  assert.match(timezoneDatabaseVersion(), /^icu-tzdata@|runtime-icu-tzdata-version-unavailable/);

  const parisWinter1940 = convert("1940-01-15", "12:00", "Europe/Paris");
  assert.equal(parisWinter1940.utcInstant.toISOString(), "1940-01-15T12:00:00.000Z");
  assert.equal(parisWinter1940.timezoneOffsetSeconds, 0);
  assert.ok(parisWinter1940.timezoneDatabaseVersion);

  const parisSummer1940 = convert("1940-07-01", "12:00", "Europe/Paris");
  assert.equal(parisSummer1940.utcInstant.toISOString(), "1940-07-01T10:00:00.000Z");
  assert.equal(parisSummer1940.timezoneOffsetSeconds, 7200);

  const parisBeforeModernDst = convert("1960-07-01", "12:00", "Europe/Paris");
  assert.equal(parisBeforeModernDst.utcInstant.toISOString(), "1960-07-01T11:00:00.000Z");
  assert.equal(parisBeforeModernDst.timezoneOffsetSeconds, 3600);

  const parisBeforeStandardOffset = convert("1910-01-01", "12:00", "Europe/Paris");
  assert.equal(parisBeforeStandardOffset.utcInstant.toISOString(), "1910-01-01T11:50:39.000Z");
  assert.equal(parisBeforeStandardOffset.timezoneOffsetSeconds, 561);

  const newYorkWarTime = convert("1945-08-14", "12:00", "America/New_York");
  assert.equal(newYorkWarTime.utcInstant.toISOString(), "1945-08-14T16:00:00.000Z");
  assert.equal(newYorkWarTime.timezoneOffsetSeconds, -14400);
});

test("une heure locale inexistante ou ambiguë n'est jamais résolue silencieusement", () => {
  assert.throws(
    () => convert("2026-03-29", "02:30", "Europe/Paris"),
    (error) => error.code === "nonexistent_local_time"
  );

  assert.throws(
    () => convert("2026-10-25", "02:30", "Europe/Paris"),
    (error) => error.code === "ambiguous_local_time" && error.candidates.length === 2 && "timezoneOffsetSeconds" in error.candidates[0]
  );

  assert.throws(
    () => convert("2011-12-30", "12:00", "Pacific/Apia"),
    (error) => error.code === "nonexistent_local_time"
  );
});
