// Deterministic editorial selection of calculated contacts (no astronomy).
export const TRANSIT_SELECTION_VERSION = "transit-selection@1.1.0";

const DAY_MS = 86_400_000;
const timeOf = (value) => value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN;
const pointKey = (value) => String(value ?? "").replace(/[^a-z]/gi, "").toLowerCase();
const AXIS_POINTS = Object.freeze({
  ascendant: { axis: "ascendant_descendant", order: 0 }, asc: { axis: "ascendant_descendant", order: 0 },
  descendant: { axis: "ascendant_descendant", order: 1 }, dsc: { axis: "ascendant_descendant", order: 1 },
  midheaven: { axis: "midheaven_imum_coeli", order: 0 }, mc: { axis: "midheaven_imum_coeli", order: 0 },
  imumcoeli: { axis: "midheaven_imum_coeli", order: 1 }, ic: { axis: "midheaven_imum_coeli", order: 1 }
});

function equivalentAxisSquare(first, second) {
  const a = first.value, b = second.value;
  const pa = AXIS_POINTS[pointKey(a.natalPoint)], pb = AXIS_POINTS[pointKey(b.natalPoint)];
  if (!pa || !pb || pa.axis !== pb.axis || pa.order === pb.order) return false;
  // Only equal squares to opposed angles are coalesced. Other aspect types,
  // distinct windows, unknown or unequal orbs, and inconsistent phases remain
  // separate facts. No geometric contact is inferred from only one proof.
  if (a.aspectType !== "square" || b.aspectType !== "square" || a.transitBody !== b.transitBody) return false;
  if (![a.orb, b.orb, a.effectiveOrbLimit, b.effectiveOrbLimit].every(Number.isFinite)) return false;
  if (a.orb !== b.orb || a.effectiveOrbLimit !== b.effectiveOrbLimit) return false;
  if ((a.phase ?? null) !== (b.phase ?? null) || (a.reliability ?? null) !== (b.reliability ?? null)) return false;
  if (first.startsAt !== second.startsAt || first.endsAt !== second.endsAt) return false;
  const exactA = timeOf(a.exactAt), exactB = timeOf(b.exactAt);
  return Number.isFinite(exactA) && Number.isFinite(exactB)
    ? exactA === exactB
    : a.exactAt == null && b.exactAt == null;
}

// This is a presentation boundary. The returned items are the original values,
// and axisPairs retains both original proofs for traceability. Never mutate the
// dossier's evidence or rewrite source statuses to make an item fit a chapter.
export function prepareTransitSelection(items, options = {}) {
  const { nowUtc, period = "current", horizonDays = 42 } = options;
  // A plain options object inherits Object.prototype.valueOf. It is not a
  // supplied evidence mapper and must never be called as one.
  const valueOf = Object.hasOwn(options, "valueOf") ? options.valueOf : (item) => item;
  const source = Array.isArray(items) ? items : [];
  const diagnostics = [], axisPairs = [];
  const now = timeOf(nowUtc);
  const section = String(period).toLowerCase();
  if (!Number.isFinite(now) || typeof valueOf !== "function" || !["current", "upcoming"].includes(section)
    || (section === "upcoming" && (!Number.isFinite(horizonDays) || horizonDays < 0))) {
    return { items: [], axisPairs, diagnostics: [{ code: !Number.isFinite(now) ? "transit_reference_time_missing" : "transit_selection_context_invalid" }] };
  }
  const candidates = [];
  source.forEach((item, index) => {
    const value = valueOf(item) ?? {};
    const startsAt = timeOf(value.startsAt), endsAt = timeOf(value.endsAt);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt > endsAt) {
      diagnostics.push({ code: "transit_window_invalid", index });
      return;
    }
    const inWindow = section === "current"
      ? startsAt <= now && now <= endsAt
      : startsAt > now && startsAt <= now + horizonDays * DAY_MS;
    if (!inWindow) {
      diagnostics.push({ code: section === "current" ? "transit_not_current" : "transit_not_upcoming", index,
        reason: endsAt < now ? "ended_before_reference" : startsAt > now ? "outside_section_window" : "already_started" });
      return;
    }
    if (value.status && value.status !== section.toUpperCase()) {
      diagnostics.push({ code: "transit_status_inconsistent_with_section", index });
      return;
    }
    candidates.push({ item, index, value, startsAt, endsAt });
  });
  const removed = new Set();
  for (let i = 0; i < candidates.length; i += 1) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < candidates.length; j += 1) {
      if (removed.has(j) || !equivalentAxisSquare(candidates[i], candidates[j])) continue;
      const first = candidates[i], second = candidates[j];
      const preferredFirst = AXIS_POINTS[pointKey(first.value.natalPoint)].order === 0;
      const retained = preferredFirst ? first : second;
      const suppressed = preferredFirst ? second : first;
      const axis = AXIS_POINTS[pointKey(first.value.natalPoint)].axis;
      removed.add(preferredFirst ? j : i);
      axisPairs.push({ retainedItem: retained.item, suppressedItem: suppressed.item, axis,
        retainedIndex: retained.index, suppressedIndex: suppressed.index });
      diagnostics.push({ code: "transit_equivalent_axis_square", index: suppressed.index, retainedIndex: retained.index, axis });
      if (!preferredFirst) break;
    }
  }
  return { items: candidates.filter((_, index) => !removed.has(index)).map((entry) => entry.item), diagnostics, axisPairs };
}

export function selectTransitCoverage(items, limit, valueOf = (item) => item, options = null) {
  const candidates = options ? prepareTransitSelection(items, { ...options, valueOf }).items : items;
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const count = Math.floor(limit);
  if (candidates.length <= count) return [...candidates];
  const dated = candidates.map((item, index) => {
    const value = valueOf(item) ?? {};
    return { item, index, time: timeOf(value.exactAt ?? value.startsAt), body: value.transitBody };
  }).filter((entry) => Number.isFinite(entry.time)).sort((a, b) => a.time - b.time || a.index - b.index);
  if (!dated.length) return candidates.slice(0, count);
  const selected = new Set();
  const bodies = new Map();
  const buckets = Math.min(6, count);
  const first = dated[0].time, span = Math.max(1, dated.at(-1).time - first + 1);
  const pick = (pool) => {
    const candidate = [...pool].sort((a, b) => (bodies.get(a.body) ?? 0) - (bodies.get(b.body) ?? 0) || a.time - b.time || a.index - b.index)[0];
    if (!candidate) return;
    selected.add(candidate.index);
    bodies.set(candidate.body, (bodies.get(candidate.body) ?? 0) + 1);
  };
  for (let bucket = 0; bucket < buckets; bucket++) pick(dated.filter((entry) => Math.min(buckets - 1, Math.floor((entry.time - first) / span * buckets)) === bucket));
  while (selected.size < Math.min(count, dated.length)) pick(dated.filter((entry) => !selected.has(entry.index)));
  return dated.filter((entry) => selected.has(entry.index)).map((entry) => entry.item);
}
