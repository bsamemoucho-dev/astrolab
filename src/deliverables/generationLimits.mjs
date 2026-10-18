// Limites de génération d'un bloc de section — une seule arithmétique, testable.
//
// Trois défauts mesurés dans le pipeline payant ont motivé ce module :
//
//   1. `maxTokens: 900` était écrit en dur, alors que les sections déclarent des
//      objectifs de 180 à 480 mots et des plafonds jusqu'à 920. Une section
//      d'identité (480 mots cible, 820 maximum) ne tenait pas dans 900 tokens :
//      la réponse arrivait coupée au milieu du JSON, le parsing échouait, et le
//      dossier entier était perdu — pour une limite mal dimensionnée.
//   2. L'objectif de mots de la SECTION était répété à chaque appel de BLOC.
//      `next_weeks` (8 blocs) recevait huit fois « environ 320 mots, jamais plus
//      de 620 » : rien n'empêchait 8 × 620 mots, ni de payer huit fois un quota
//      qui n'était pas le sien.
//   3. Une réponse tronquée n'était détectée qu'en tentant de la parser, ce qui
//      produisait un code d'erreur trompeur (`structured_parse_error`) et ne
//      distinguait pas « le modèle a déraillé » de « on lui a coupé la parole ».
//
// Aucune convention astrologique n'est créée ici : ce module ne fait que borner
// la longueur d'une réponse et reconnaître une réponse interrompue.

export const GENERATION_LIMITS_VERSION = "structured-generation-limits@1.0.0";

// Plancher : en dessous, même deux phrases correctes peuvent être tronquées une
// fois l'enveloppe JSON comptée. Plafond : aucune section ne justifie davantage,
// et il borne la dépense d'un bloc quoi qu'il arrive (voir worstCaseOutputTokens).
export const MIN_BLOCK_OUTPUT_TOKENS = 300;
export const MAX_BLOCK_OUTPUT_TOKENS = 2000;

// Un mot français coûte environ 1,5 à 1,8 token au modèle. On retient 2 : une
// réponse dont le prompt annonce N mots doit toujours tenir dans le plafond
// calculé, même avec un tokenizer défavorable.
const TOKENS_PER_WORD = 2;

// Enveloppe JSON attendue autour du texte (sectionId, contractVersion, blocks[],
// blockId, text, guillemets et échappements).
const JSON_ENVELOPE_TOKENS = 200;

// Seuil sous lequel une section est signalée comme nettement plus courte que son
// repère. C'est une MESURE, jamais une consigne de remplissage : une section
// courte peut être la bonne réponse quand la matière manque.
export const SHORT_SECTION_RATIO = 0.4;

const TRUNCATION_FINISH_REASONS = new Set(["length", "max_tokens", "max_output_tokens", "model_length"]);

// Compte les mots réels d'un texte (les signes isolés ne comptent pas).
export function countWords(value) {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

function prefixWordsFor(blockPlan) {
  return countWords(blockPlan?.deterministicPrefix ?? "");
}

export function blockCountOf(sectionPlan, override = null) {
  const declared = Number(override);
  if (Number.isInteger(declared) && declared > 0) return declared;
  const blocks = sectionPlan?.blockPlans?.length;
  return Number.isInteger(blocks) && blocks > 0 ? blocks : 1;
}

// Budget d'un bloc : la part qui lui revient, moins la phrase que le serveur
// ajoutera lui-même. Un bloc sur huit ne peut plus réclamer le budget entier.
//
// Cas particulier des blocs à phrase déterministe (« prochaines semaines »,
// « ciel du moment ») : le serveur écrit déjà le fait (19 à 28 mots), et la part
// restante tombait à 15–21 mots — soit une phrase de commentaire par transit,
// c'est-à-dire une liste et non une lecture. Le repère du bloc reçoit donc un
// plancher, borné par son propre plafond : la lecture redevient faisable sans
// dépasser le maximum de la section ni coûter un token de plus.
export const MIN_PREFIXED_BLOCK_TARGET_WORDS = 40;

export function blockLengthBudget({ sectionPlan = {}, blockPlan = null, blockCount = null } = {}) {
  const blocks = blockCountOf(sectionPlan, blockCount);
  const sectionTarget = Math.max(0, Number(sectionPlan?.targetWords ?? 0));
  const sectionMax = Math.max(sectionTarget, Number(sectionPlan?.maxWords ?? sectionTarget));
  const prefixWords = prefixWordsFor(blockPlan);
  const maxWords = Math.max(30, Math.ceil(sectionMax / blocks) - prefixWords);
  let targetWords = Math.max(0, Math.ceil(sectionTarget / blocks) - prefixWords);
  if (prefixWords > 0) {
    targetWords = Math.max(targetWords, Math.min(maxWords, MIN_PREFIXED_BLOCK_TARGET_WORDS));
  }
  return {
    blockCount: blocks,
    prefixWords,
    targetWords,
    maxWords,
    sectionTargetWords: sectionTarget,
    sectionMaxWords: sectionMax
  };
}

// Plafond de tokens pour cet appel : dérivé du budget du bloc, borné des deux
// côtés. Jamais zéro, jamais au-delà du plafond dur.
export function maxTokensForBlock(budget = {}) {
  const words = Math.max(0, Number(budget?.maxWords ?? 0));
  const computed = Math.ceil(words * TOKENS_PER_WORD) + JSON_ENVELOPE_TOKENS;
  return Math.min(MAX_BLOCK_OUTPUT_TOKENS, Math.max(MIN_BLOCK_OUTPUT_TOKENS, computed));
}

// Plafond de dépense théorique d'un plan complet : la somme des plafonds de ses
// blocs. Sert à documenter le pire cas avant d'ouvrir la dépense.
export function worstCaseOutputTokens(sectionPlan = {}) {
  const blocks = sectionPlan?.blockPlans ?? [];
  const blockCount = blockCountOf(sectionPlan);
  return blocks.reduce(
    (total, blockPlan) => total + maxTokensForBlock(blockLengthBudget({ sectionPlan, blockPlan, blockCount })),
    0
  );
}

function stripCodeFence(value) {
  const text = String(value ?? "").trim();
  if (!text.startsWith("```")) return text;
  return text
    .replace(/^```[a-zA-Z]*\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
}

// Un JSON est structurellement complet quand les accolades et crochets sont
// équilibrés, qu'aucune chaîne n'est laissée ouverte et qu'il se termine par une
// fermeture. Aucun parsing ici : c'est précisément ce qu'on veut éviter de faire
// sur un texte coupé.
export function isStructurallyCompleteJson(value) {
  const text = stripCodeFence(value);
  if (!text) return false;
  const first = text[0];
  if (first !== "{" && first !== "[") return false;
  const last = text[text.length - 1];
  if (last !== "}" && last !== "]") return false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0 && !inString;
}

export function looksLikeUnfinishedJson(value) {
  const text = stripCodeFence(value);
  if (!text.startsWith("{") && !text.startsWith("[")) return false;
  return !isStructurallyCompleteJson(value);
}

// Détection EXPLICITE d'une réponse interrompue, AVANT tout parsing.
//   - le fournisseur dit lui-même qu'il a coupé (`finish_reason`) ;
//   - sinon, la réponse a commencé un objet JSON et ne le ferme pas.
// Un texte qui n'est pas du JSON du tout n'est pas « tronqué » : ce cas reste
// une erreur de parsing, avec son propre code.
export function isTruncatedCompletion({ finishReason = null, text = "" } = {}) {
  const reason = String(finishReason ?? "").trim().toLowerCase();
  if (reason && TRUNCATION_FINISH_REASONS.has(reason)) return true;
  return looksLikeUnfinishedJson(text);
}

// Mesure d'une section produite. Information seulement : ni réécriture, ni
// retrait, ni remplissage décidés ici.
export function lengthReport({ text = "", targetWords = 0, maxWords = 0 } = {}) {
  const words = countWords(text);
  const target = Math.max(0, Number(targetWords ?? 0));
  const max = Math.max(0, Number(maxWords ?? 0));
  let status = "in_range";
  if (max > 0 && words > max) status = "over";
  else if (target > 0 && words < Math.ceil(target * SHORT_SECTION_RATIO)) status = "short";
  return { words, targetWords: target, maxWords: max, status };
}
