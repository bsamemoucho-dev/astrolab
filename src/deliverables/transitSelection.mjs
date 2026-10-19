// Deterministic editorial sampling of calculated contacts (no astronomy).
export const TRANSIT_SELECTION_VERSION = "transit-selection@1.0.0";
export function selectTransitCoverage(items, limit, valueOf = (item) => item) {
  if (items.length <= limit) return [...items];
  const dated = items.map((item, index) => {
    const value = valueOf(item) ?? {};
    return { item, index, time: Date.parse(value.exactAt ?? value.startsAt), body: value.transitBody };
  }).filter((entry) => Number.isFinite(entry.time)).sort((a, b) => a.time - b.time || a.index - b.index);
  if (!dated.length) return items.slice(0, limit);
  const selected = new Set();
  const bodies = new Map();
  const buckets = Math.min(6, limit);
  const first = dated[0].time, span = Math.max(1, dated.at(-1).time - first + 1);
  const pick = (pool) => {
    const candidate = [...pool].sort((a, b) => (bodies.get(a.body) ?? 0) - (bodies.get(b.body) ?? 0) || a.time - b.time || a.index - b.index)[0];
    if (!candidate) return;
    selected.add(candidate.index);
    bodies.set(candidate.body, (bodies.get(candidate.body) ?? 0) + 1);
  };
  for (let bucket = 0; bucket < buckets; bucket++) pick(dated.filter((entry) => Math.min(buckets - 1, Math.floor((entry.time - first) / span * buckets)) === bucket));
  while (selected.size < Math.min(limit, dated.length)) pick(dated.filter((entry) => !selected.has(entry.index)));
  return dated.filter((entry) => selected.has(entry.index)).map((entry) => entry.item);
}
