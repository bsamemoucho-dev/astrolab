import assert from "node:assert/strict";
import test from "node:test";

import { classifyCurrentSkyStatus, relatedEventsForContact } from "../src/models/currentSkyService.mjs";

test("current sky classification uses orb window, not a fixed three-day exactness cutoff", () => {
  const status = classifyCurrentSkyStatus({
    nowUtc: "2026-10-03T12:00:00.000Z",
    startsAt: "2026-09-20T00:00:00.000Z",
    endsAt: "2026-10-10T00:00:00.000Z",
    horizonDays: 42
  });
  assert.equal(status, "CURRENT");
});

test("current sky classification separates upcoming and recent windows", () => {
  assert.equal(
    classifyCurrentSkyStatus({
      nowUtc: "2026-10-03T12:00:00.000Z",
      startsAt: "2026-10-18T00:00:00.000Z",
      endsAt: "2026-10-24T00:00:00.000Z",
      horizonDays: 42
    }),
    "UPCOMING"
  );
  assert.equal(
    classifyCurrentSkyStatus({
      nowUtc: "2026-10-03T12:00:00.000Z",
      startsAt: "2026-09-28T00:00:00.000Z",
      endsAt: "2026-10-02T12:30:00.000Z",
      horizonDays: 42
    }),
    "RECENT"
  );
  assert.equal(
    classifyCurrentSkyStatus({
      nowUtc: "2026-10-03T12:00:00.000Z",
      startsAt: "2026-12-20T00:00:00.000Z",
      endsAt: "2026-12-24T00:00:00.000Z",
      horizonDays: 42
    }),
    null
  );
});

test("related celestial events require a deterministic body link, not only a nearby date", () => {
  const contact = {
    transitBody: "Jupiter"
  };
  const timing = {
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-10-10T00:00:00.000Z"
  };
  const events = [
    {
      id: "event.same-body",
      eventType: "planetary_aspect",
      peakUtc: "2026-10-05T00:00:00.000Z",
      bodies: ["Jupiter", "Saturn"]
    },
    {
      id: "event.nearby-unrelated",
      eventType: "planetary_aspect",
      peakUtc: "2026-10-05T00:00:00.000Z",
      bodies: ["Venus", "Mars"]
    },
    {
      id: "event.same-body-outside-window",
      eventType: "planetary_aspect",
      peakUtc: "2026-10-12T00:00:00.000Z",
      bodies: ["Jupiter", "Mercury"]
    }
  ];

  assert.deepEqual(
    relatedEventsForContact({ contact, timing, events }).map((event) => event.id),
    ["event.same-body"]
  );
});
