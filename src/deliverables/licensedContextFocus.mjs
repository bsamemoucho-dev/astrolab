// Internal editorial focus for the five explicitly reviewed natal contexts.
// This only guides an already licensed primary block; it creates no fact,
// interpretation rule, block, word quota, transport call or correction pass.
import { interpretationRuleById, ruleMatchesEvidence } from "./interpretationRules.mjs";

const FOCUS = Object.freeze({
  "western.angle.ascendant.sign.cancer@1": "Développe l’apport de l’Ascendant en Cancer comme fonction distincte : la manière d’aborder une situation et l’attention au climat. N’en déduis aucun trait de personnalité établi.",
  "western.body.moon.house.3@1": "Explique ce que la maison 3 ajoute à la lecture de la Lune : le ressenti envisagé dans la parole et les échanges de proximité. Ne te limite pas à une description de signe.",
  "western.body.mercury.house.6@1": "Explique l’apport de Mercure en maison 6 dans l’organisation des tâches quotidiennes. Développe ce domaine sans déduire de métier ni de santé.",
  "western.body.saturn.house.6@1": "Développe l’apport de Saturne en maison 6 au cadre, aux responsabilités et aux limites du travail quotidien. N’en déduis aucune profession ni situation de santé.",
  "western.body.jupiter.house.8@1": "Explique l’apport de Jupiter en maison 8 à la mise en commun et aux transformations. Ne réduis pas ce passage à une description de signe ; ne présume aucun argent reçu ni événement."
});

export function licensedContextNarrativeRole({ blockPlan, evidencePackets, byId } = {}) {
  const previous = typeof blockPlan?.narrativeRole === "string" ? blockPlan.narrativeRole : null;
  if (blockPlan?.deterministic || blockPlan?.calculatedReference) return previous;
  if (!Array.isArray(blockPlan?.packetRefs) || !Array.isArray(evidencePackets) || typeof byId?.get !== "function") return previous;
  const packets = new Map(evidencePackets.map((packet) => [packet.packetId, packet]));
  const licensed = new Set();
  for (const packetRef of blockPlan.packetRefs) {
    const packet = packets.get(packetRef);
    if (packet?.interpretationDepth !== "primary" || !Array.isArray(packet.evidenceRefs) || !Array.isArray(packet.interpretationRuleRefs)) continue;
    for (const ruleId of packet.interpretationRuleRefs) {
      if (!Object.hasOwn(FOCUS, ruleId)) continue;
      const rule = interpretationRuleById(ruleId);
      if (packet.evidenceRefs.some((ref) => ruleMatchesEvidence(rule, byId.get(ref)))) licensed.add(ruleId);
    }
  }
  if (licensed.size === 0) return previous;
  const instructions = [...licensed].map((ruleId) => FOCUS[ruleId]);
  return previous ? [previous, ...instructions].join("\n") : instructions.join("\n");
}
