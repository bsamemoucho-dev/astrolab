// Presentation only. The two existing calculated contacts remain separate
// claims/proofs; only one of their already-calculated windows is displayed.
const ANGLES = Object.freeze({
  asc: { axis: 'ascendant_descendant', pole: 0 }, ascendant: { axis: 'ascendant_descendant', pole: 0 },
  ds: { axis: 'ascendant_descendant', pole: 1 }, dsc: { axis: 'ascendant_descendant', pole: 1 }, descendant: { axis: 'ascendant_descendant', pole: 1 },
  mc: { axis: 'midheaven_imum_coeli', pole: 0 }, midheaven: { axis: 'midheaven_imum_coeli', pole: 0 },
  ic: { axis: 'midheaven_imum_coeli', pole: 1 }, imumcoeli: { axis: 'midheaven_imum_coeli', pole: 1 }
});
const COMPLEMENT = Object.freeze({ conjunction: 'opposition', opposition: 'conjunction', sextile: 'trine', trine: 'sextile', square: 'square' });
const key = value => String(value ?? '').replace(/[^a-z]/gi, '').toLowerCase();
const instant = value => typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
const sixDecimals = value => Number.isFinite(value) ? value.toFixed(6) : null;

function candidate(group, byId) {
  if (group.length !== 1 || !(byId instanceof Map)) return null;
  const packet = group[0];
  if (!packet || typeof packet.packetId !== 'string' || !packet.packetId ||
    !Array.isArray(packet.interpretationRuleRefs) || packet.interpretationRuleRefs.length !== 0 ||
    !Array.isArray(packet.evidenceRefs) || !packet.evidenceRefs.length || !Array.isArray(packet.claims)) return null;
  // Missing references must never disappear behind a coalesced display.
  const proofs = packet.evidenceRefs.map(ref => byId.get(ref));
  if (proofs.some(proof => !proof)) return null;
  const personal = proofs.filter(proof => proof.type === 'PERSONAL_TRANSIT');
  const claims = packet.claims.filter(claim => claim.type === 'PERSONAL_TRANSIT');
  if (personal.length !== 1 || claims.length !== 1) return null;
  const proof = personal[0], value = proof.value ?? {}, claim = claims[0];
  if (!proof.evidenceId || !packet.evidenceRefs.includes(proof.evidenceId) ||
    !Array.isArray(claim.evidenceRefs) || !claim.evidenceRefs.includes(proof.evidenceId)) return null;
  const angle = ANGLES[key(value.natalPoint)];
  if (!angle || !COMPLEMENT[value.aspectType] || !value.transitBody) return null;
  const start = instant(value.startsAt), peak = instant(value.exactAt), end = instant(value.endsAt);
  if (![start, peak, end].every(Number.isFinite) || start > peak || peak > end ||
    !Number.isFinite(value.orb) || value.orb < 0 || !Number.isFinite(value.effectiveOrbLimit) || value.effectiveOrbLimit <= 0 || value.orb > value.effectiveOrbLimit) return null;
  // Resolve geometry from the canonical proof, while requiring the packet's
  // claim to describe that very same event. The view never repairs a claim.
  if (claim.transitBody !== value.transitBody || key(claim.natalPoint) !== key(value.natalPoint) || claim.aspectType !== value.aspectType ||
    instant(claim.startsAt) !== start || instant(claim.exactAt) !== peak || instant(claim.endsAt) !== end || claim.orb !== value.orb ||
    (claim.phase ?? null) !== (value.phase ?? null) ||
    (claim.natalHouse !== undefined && claim.natalHouse !== value.natalHouse) ||
    (claim.houseSystem !== undefined && claim.houseSystem !== value.houseSystem)) return null;
  const reliability = value.reliability ?? proof.provenance?.reliability ?? null;
  if (value.reliability && proof.provenance?.reliability && value.reliability !== proof.provenance.reliability) return null;
  return { packet, proof, value, angle, start, peak, end, reliability };
}

function representative(first, second) {
  if (first.angle.axis !== second.angle.axis || first.angle.pole === second.angle.pole ||
    first.value.transitBody !== second.value.transitBody || COMPLEMENT[first.value.aspectType] !== second.value.aspectType ||
    first.peak !== second.peak || sixDecimals(first.value.orb) !== sixDecimals(second.value.orb) ||
    (first.value.phase ?? null) !== (second.value.phase ?? null) || first.reliability !== second.reliability) return null;
  const contains = (outer, inner) => outer.value.effectiveOrbLimit >= inner.value.effectiveOrbLimit && outer.start <= inner.start && outer.end >= inner.end;
  const firstContains = contains(first, second), secondContains = contains(second, first);
  if (!firstContains && !secondContains) return null;
  if (firstContains && secondContains) return first.angle.pole === 0 ? first : second;
  return firstContains ? first : second;
}

export function groupComplementaryAxisPackets(storyGroups, byId) {
  if (!Array.isArray(storyGroups) || storyGroups.some(group => !Array.isArray(group))) {
    throw new TypeError('Axis grouping expects arrays of existing story packets.');
  }
  const candidates = storyGroups.map(group => candidate(group, byId));
  const consumed = new Set(), result = [];
  for (let index = 0; index < storyGroups.length; index++) {
    if (consumed.has(index)) continue;
    const first = candidates[index];
    let pair = null;
    if (first) for (let next = index + 1; next < storyGroups.length; next++) {
      if (consumed.has(next) || !candidates[next]) continue;
      const primary = representative(first, candidates[next]);
      if (primary) { pair = { next, second: candidates[next], primary }; break; }
    }
    if (!pair) {
      result.push({ packets: storyGroups[index], displayPackets: storyGroups[index], axisGroup: null });
      continue;
    }
    consumed.add(pair.next);
    result.push({
      packets: [...storyGroups[index], ...storyGroups[pair.next]],
      displayPackets: [pair.primary.packet],
      axisGroup: {
        axis: first.angle.axis,
        evidenceRefs: [first.proof.evidenceId, pair.second.proof.evidenceId],
        packetIds: [first.packet.packetId, pair.second.packet.packetId],
        primaryEvidenceRef: pair.primary.proof.evidenceId,
        primaryPacketId: pair.primary.packet.packetId
      }
    });
  }
  return result;
}
