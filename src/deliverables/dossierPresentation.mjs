// Presentation of already validated sections only. Plans, proofs, claims and
// relationship metadata stay unchanged; no interpretation is licensed here.
const LABELS = Object.freeze({
  fr: { configurations: "Configurations étudiées", references: "Autres repères calculés", note: "Repères présentés sans lecture symbolique.", affection: "Votre manière d'exprimer votre affection", communication: "Communication relationnelle" },
  en: { configurations: "Configurations explored", references: "Other calculated reference points", note: "Reference points shown without symbolic interpretation.", affection: "Your way of expressing affection", communication: "Communication in relationships" },
  de: { configurations: "Betrachtete Konfigurationen", references: "Weitere berechnete Bezugspunkte", note: "Bezugspunkte ohne symbolische Deutung.", affection: "Ihre Art, Zuneigung auszudrücken", communication: "Kommunikation in Beziehungen" },
  es: { configurations: "Configuraciones estudiadas", references: "Otras referencias calculadas", note: "Referencias presentadas sin lectura simbólica.", affection: "Su manera de expresar afecto", communication: "Comunicación en las relaciones" },
  it: { configurations: "Configurazioni esaminate", references: "Altri riferimenti calcolati", note: "Riferimenti presentati senza lettura simbolica.", affection: "Il vostro modo di esprimere affetto", communication: "Comunicazione nelle relazioni" },
  pt: { configurations: "Configurações analisadas", references: "Outras referências calculadas", note: "Referências apresentadas sem leitura simbólica.", affection: "A sua maneira de expressar afeto", communication: "Comunicação nas relações" },
  no: { configurations: "Konfigurasjoner som undersøkes", references: "Andre beregnede holdepunkter", note: "Holdepunkter vist uten symbolsk tolkning.", affection: "Din måte å uttrykke hengivenhet på", communication: "Kommunikasjon i relasjoner" },
  da: { configurations: "Undersøgte konfigurationer", references: "Andre beregnede holdepunkter", note: "Holdepunkter vist uden symbolsk fortolkning.", affection: "Din måde at udtrykke hengivenhed på", communication: "Kommunikation i relationer" },
  nl: { configurations: "Onderzochte configuraties", references: "Andere berekende aanknopingspunten", note: "Aanknopingspunten zonder symbolische duiding.", affection: "Uw manier om genegenheid te uiten", communication: "Communicatie in relaties" }
});

const BODY_PLACEMENT_TYPES = new Set(["NATAL_BODY_SIGN", "NATAL_BODY_HOUSE"]);
const NON_FACT_PANEL_SECTIONS = new Set(["general_synthesis", "conclusion", "major_aspects", "current_sky", "next_weeks"]);
const TRANSIT_SECTIONS = new Set(["current_sky", "next_weeks"]);
const labelsFor = (strings) => LABELS[strings?.lang] ?? LABELS.fr;
const bodyName = (body, strings) => strings?.planets?.[body] ?? body;
const signName = (sign, strings) => strings?.signs?.[sign] ?? sign;

function usedByBlock(section, byId) {
  return (section.blocks ?? []).map((block) => ({ block, proofs: (block.evidenceRefs ?? []).map((ref) => byId.get(ref)).filter(Boolean) }));
}

// A context house/sign can join the owned placement only if it really occurs
// in the same validated block. Its appearance here grants no narrative right.
function studiedConfigurations(section, sectionPlan, byId, strings) {
  if (NON_FACT_PANEL_SECTIONS.has(section.sectionId)) return [];
  const primary = new Set(sectionPlan?.primaryEvidenceRefs ?? []);
  const blocks = usedByBlock(section, byId);
  const used = new Set(blocks.flatMap(({ proofs }) => proofs.map((proof) => proof.evidenceId)));
  const owned = [...primary].map((ref) => byId.get(ref)).filter((proof) => proof && used.has(proof.evidenceId));
  const facts = [];
  for (const proof of owned.filter((item) => item.type === "NATAL_ASPECT")) {
    const value = proof.value ?? {};
    facts.push({ refs: [proof.evidenceId], text: `${bodyName(value.bodyA, strings)}–${bodyName(value.bodyB, strings)} : ${strings?.aspects?.[value.aspectType] ?? value.aspectType}` });
  }
  const bodyDone = new Set();
  for (const proof of owned.filter((item) => BODY_PLACEMENT_TYPES.has(item.type))) {
    const body = proof.value?.body;
    if (!body || bodyDone.has(body) || proof.certainty?.stableAcrossApplicableWindow === false) continue;
    const placementProofs = ({ proofs }) => proofs.filter((item) => item.value?.body === body && BODY_PLACEMENT_TYPES.has(item.type) && item.certainty?.stableAcrossApplicableWindow !== false);
    const sameBlock = blocks.filter(({ proofs }) => proofs.some((item) => item.evidenceId === proof.evidenceId))
      .sort((first, second) => new Set(placementProofs(second).map((item) => item.type)).size - new Set(placementProofs(first).map((item) => item.type)).size)[0];
    const candidates = sameBlock ? placementProofs(sameBlock) : [];
    const sign = candidates.find((item) => item.type === "NATAL_BODY_SIGN" && item.value?.sign);
    const house = candidates.find((item) => item.type === "NATAL_BODY_HOUSE" && Number.isInteger(item.value?.house) && item.value.house >= 1 && item.value.house <= 12);
    const parts = [bodyName(body, strings), sign ? signName(sign.value.sign, strings) : null, house ? `${strings?.labels?.house ?? "maison"} ${house.value.house}` : null].filter(Boolean);
    if (parts.length < 2) continue;
    const refs = [sign?.evidenceId, house?.evidenceId].filter(Boolean);
    facts.push({ refs, text: parts.join(" · ") });
    bodyDone.add(body);
  }
  return facts.slice(0, 3);
}

function bareCalculatedTransit({ block, blockPlan, sectionPlan, byId }) {
  const prefix = blockPlan?.deterministicPrefix;
  if (typeof prefix !== "string" || !prefix || block.text !== prefix) return false;
  if (!Array.isArray(block.interpretationRuleRefs) || block.interpretationRuleRefs.length > 0) return false;
  const wanted = blockPlan.packetRefs ?? [];
  if (wanted.length === 0) return false;
  const packets = wanted.map((ref) => (sectionPlan?.evidencePackets ?? []).find((packet) => packet.packetId === ref));
  if (packets.some((packet) => !packet || !Array.isArray(packet.interpretationRuleRefs) || packet.interpretationRuleRefs.length > 0)) return false;
  // A snapshot or natal lead cannot be mistaken for an uninterpreted transit.
  return packets.some((packet) => (packet.evidenceRefs ?? []).some((ref) => (block.evidenceRefs ?? []).includes(ref) && byId.get(ref)?.type === "PERSONAL_TRANSIT"));
}

export function renderableDossierSection({ section, strings, sectionPlan, dossierEvidence, title }) {
  const labels = labelsFor(strings);
  const byId = new Map((dossierEvidence?.evidence ?? []).map((item) => [item.evidenceId, item]));
  const configurations = studiedConfigurations(section, sectionPlan, byId, strings);
  const displayedRefs = new Set(configurations.flatMap((item) => item.refs));
  const references = [];
  const paragraphs = [];
  for (const block of section.blocks ?? []) {
    const blockPlan = sectionPlan?.blockPlans?.find((plan) => plan.blockId === block.blockId);
    if (TRANSIT_SECTIONS.has(section.sectionId) && bareCalculatedTransit({ block, blockPlan, sectionPlan, byId })) {
      references.push(block.text);
      continue;
    }
    const prefix = blockPlan?.deterministicPrefix;
    const aspects = (block.evidenceRefs ?? []).map((ref) => byId.get(ref)).filter((item) => item?.type === "NATAL_ASPECT");
    // Only a known server-owned factual lead may move into the panel. Its full
    // set of aspect facts must be displayed; never trim generated prose.
    const canMovePrefix = configurations.length > 0 && typeof prefix === "string" && prefix.length > 0 &&
      block.text.startsWith(prefix) && aspects.length > 0 && aspects.every((item) => displayedRefs.has(item.evidenceId));
    paragraphs.push(canMovePrefix ? block.text.slice(prefix.length).trim() : block.text);
  }
  const relationalTitle = section.sectionId === "relational_affection" ? labels.affection : section.sectionId === "relational_communication" ? labels.communication : null;
  return {
    id: section.sectionId,
    title: relationalTitle ?? title ?? strings?.sectionTitles?.[section.sectionId] ?? sectionPlan?.title ?? section.sectionId,
    rank: null,
    badgeCode: "symbolic",
    badgeLabel: strings?.badgeSymbolic,
    kind: "symbolic",
    provider: "llm",
    status: "ok",
    text: paragraphs.filter(Boolean).join("\n\n"),
    configurationsLabel: labels.configurations,
    configurationsStudied: configurations.map((item) => item.text),
    calculatedReferences: references,
    calculatedReferencesLabel: labels.references,
    calculatedReferencesNote: labels.note,
    validation: { ok: true, issues: [] }
  };
}

export function mergeRelationalSubsections(mainSections = [], relationalSections = []) {
  const sections = mainSections.map((section) => ({ ...section, ...(section.subsections ? { subsections: [...section.subsections] } : {}) }));
  for (const relational of relationalSections) {
    const preferred = relational.id === "relational_affection" ? "affectivity" : relational.id === "relational_communication" ? "communication" : null;
    const parent = sections.find((section) => section.id === preferred) ?? sections.find((section) => section.id === "relationships");
    if (parent) {
      parent.subsections = [...(parent.subsections ?? []), { ...relational }];
      continue;
    }
    const conclusionIndex = sections.findIndex((section) => section.id === "conclusion");
    sections.splice(conclusionIndex < 0 ? sections.length : conclusionIndex, 0, { ...relational });
  }
  return sections;
}
