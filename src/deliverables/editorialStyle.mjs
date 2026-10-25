// Local French style diagnostics. These are suggestions for a bounded editorial
// correction, never factual errors, astrology rules or a score of depth.
// Return only fixed messages and numeric measures: no client prose or identity.

const CONDITIONAL = /\b(?:pourriez|pourrait|pourraient)\b/gu;
const STOCK_OPENING = /^(?:vous (?:pourriez|pouvez)|cette (?:configuration|dynamique|période)|dans (?:cette lecture|ce contexte)|il (?:peut|pourrait)|cela (?:peut|pourrait)|une (?:piste|lecture|question) (?:possible|utile|serait))\b/u;
const ADVICE_CARRIER = /\b(?:vous (?:pourriez|pouvez)|il (?:serait|peut être) utile de|n'hésitez pas à|pensez à|essayez de)(?=\s|[,:;.!?]|$)/u;
const ADVICE_PATTERNS = [
  { phrase: /\b(?:prenez|prendre) du recul\b/u, imperative: /\bprenez du recul\b/u },
  { phrase: /\b(?:trouvez|trouver|retrouvez|retrouver) votre équilibre\b/u, imperative: /\b(?:trouvez|retrouvez) votre équilibre\b/u },
  { phrase: /\b(?:faites|faire) confiance à votre intuition\b/u, imperative: /\bfaites confiance à votre intuition\b/u },
  { phrase: /\b(?:avancez|avancer) à votre rythme\b/u, imperative: /\bavancez à votre rythme\b/u },
  { phrase: /\b(?:restez|rester) à l'écoute de vous-même\b/u, imperative: /\brestez à l'écoute de vous-même\b/u },
  { phrase: /\b(?:faites|faire) preuve de patience\b/u, imperative: /\bfaites preuve de patience\b/u },
  { phrase: /\b(?:accueillez|accueillir) vos émotions\b/u, imperative: /\baccueillez vos émotions\b/u }
];

function normalized(value) {
  return String(value ?? '').normalize('NFC').toLowerCase().replace(/[’‘]/gu, "'").replace(/[\u00a0\u202f]/gu, ' ');
}

function sentencesOf(text) {
  return text.replace(/([.!?])[»”"']+(?=\s|$)/gu, '$1')
    .split(/(?<=[.!?])\s+/u).map((part) => part.trim()).filter(Boolean);
}

function wordsOf(text) {
  return normalized(text).match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) ?? [];
}

// A long exact run is measurable reuse, not a judgment of semantic originality.
// Rolling rows bound memory and keep both the source excerpt and client text
// out of diagnostics/logs. Only already-authorized chapter recaps are supplied.
function sharedRun(textWords, previousTexts) {
  let maximum = 0;
  for (const previous of previousTexts) {
    if (typeof previous !== "string") continue;
    const source = wordsOf(previous);
    let row = new Uint32Array(source.length + 1);
    for (const word of textWords) {
      const next = new Uint32Array(source.length + 1);
      for (let index = 0; index < source.length; index += 1) {
        if (word === source[index]) {
          next[index + 1] = row[index] + 1;
          maximum = Math.max(maximum, next[index + 1]);
        }
      }
      row = next;
    }
  }
  return maximum;
}

// Numeric style memory never carries previous prose, facts or client identity.
export function editorialStyleCounters(text) {
  return { illustrationLeadCount: [...normalized(text).matchAll(/\bpar exemple\b/gu)].length };
}

export function editorialStyleFindings(text, { previousTexts = [], previousIllustrationLeadCount = 0 } = {}) {
  const source = normalized(text).trim();
  if (!source) return [];
  const findings = [];
  const illustrationLeads = editorialStyleCounters(source).illustrationLeadCount;
  const previousLeads = Number.isSafeInteger(previousIllustrationLeadCount) && previousIllustrationLeadCount > 0 ? previousIllustrationLeadCount : 0;
  if (illustrationLeads >= 2 || (illustrationLeads > 0 && previousLeads >= 2)) findings.push({
    code: 'editorial_repeated_illustration_lead',
    message: "L'illustration est encore annoncée par le même préambule. Énonce directement le geste ou le choix envisagé, en conservant son statut de possibilité et les seules significations autorisées ; ne remplace pas cette amorce par un nouveau gabarit.",
    counts: { illustrationLeads, previousIllustrationLeads: previousLeads }
  });
  const framing = [...source.matchAll(/\b(?:une mani[eè]re possible de l['’]illustrer serait|une situation possible serait|dans un engagement hypoth[eé]tique)\b/gu)].length;
  if (framing > 0) findings.push({
    code: 'editorial_overexplained_illustration',
    message: "Le préambule explique longuement qu'il s'agit d'une illustration. Garde l'action ou la distinction utile dans une formulation simple et non affirmative, sans commentaire de conformité ni nouvelle interprétation.",
    counts: { occurrences: framing }
  });
  const processLanguage = [...source.matchAll(/\b(?:dans votre dossier|(?:une )?ressource possible [àa] explorer)\b/gu)].length;
  if (processLanguage > 0) findings.push({
    code: 'editorial_process_language',
    message: "Une tournure commente le document ou annonce une piste au lieu de dire son apport. Reformule directement la distinction autorisée, sans décrire la fabrication de la lecture ni ajouter un comportement certain.",
    counts: { occurrences: processLanguage }
  });
  const sentences = sentencesOf(source);
  const occurrences = [...source.matchAll(CONDITIONAL)].length;
  const affectedSentences = sentences.filter((sentence) => /\b(?:pourriez|pourrait|pourraient)\b/u.test(sentence)).length;
  const sentenceShare = sentences.length ? affectedSentences / sentences.length : 0;
  if (occurrences >= 3 && sentenceShare >= 0.5) findings.push({
    code: 'editorial_mechanical_conditional',
    message: 'Le conditionnel revient mécaniquement. Varie la construction des phrases : décris les symboles sans attribuer un trait certain au lecteur, et réserve le conditionnel aux possibilités personnelles.',
    counts: { occurrences, affectedSentences, sentenceCount: sentences.length, sentenceShare: Math.round(sentenceShare * 100) / 100 }
  });

  const paragraphs = source.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
  const largestParagraphWords = Math.max(0, ...paragraphs.map((paragraph) => wordsOf(paragraph).length));
  if (largestParagraphWords >= 150 && paragraphs.some((paragraph) => wordsOf(paragraph).length >= 150 && sentencesOf(paragraph).length >= 3)) findings.push({
    code: 'editorial_dense_paragraph',
    message: "Un développement trop dense reste en un seul paragraphe. Répartis ses idées en paragraphes courts séparés par une ligne vide, sans supprimer le contenu autorisé ni ajouter de remplissage.",
    counts: { largestParagraphWords, paragraphCount: paragraphs.length }
  });

  const words = wordsOf(source);
  const priorTexts = Array.isArray(previousTexts) ? previousTexts : [];
  const maxSharedRun = words.length >= 40 ? sharedRun(words, priorTexts) : 0;
  if (maxSharedRun >= 12) findings.push({
    code: 'editorial_reused_chapter_passage',
    message: "La conclusion reprend une longue formulation d'un chapitre déjà produit. Dégage son apport pour le bilan sans recopier son explication ou son exemple, sans inventer de nouvelle interprétation et sans simplement remplacer quelques mots.",
    counts: { maxSharedRun, previousTextCount: priorTexts.filter((text) => typeof text === 'string').length }
  });

  const openings = new Map();
  for (const paragraph of paragraphs) {
    // Restrict this suggestion to stock prose openings. Repeated factual labels,
    // names or ordinary subject nouns do not suffice to diagnose a style tic.
    const plain = paragraph.replace(/^[\s*#>\-]+/u, '').replace(/\s+/gu, ' ');
    if (!STOCK_OPENING.test(plain)) continue;
    const words = plain.match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) ?? [];
    if (words.length < 3) continue;
    const opening = words.slice(0, 3).join(' ');
    openings.set(opening, (openings.get(opening) ?? 0) + 1);
  }
  const repeatedParagraphs = Math.max(0, ...openings.values());
  if (repeatedParagraphs >= 3 && repeatedParagraphs / paragraphs.length >= 0.5) findings.push({
    code: 'editorial_repeated_paragraph_opening',
    message: 'Plusieurs paragraphes commencent par le même gabarit. Ouvre chacun sur son apport propre sans remplacer simplement un tic par un synonyme ni ajouter de contenu.',
    counts: { repeatedParagraphs, paragraphCount: paragraphs.length, sharedPrefixWords: 3 }
  });

  const adviceMatches = ADVICE_PATTERNS.map((pattern) => sentences.filter((sentence) => pattern.phrase.test(sentence)
    && (pattern.imperative.test(sentence) || ADVICE_CARRIER.test(sentence))).length);
  const distinctAdvicePatterns = adviceMatches.filter((count) => count > 0).length;
  if (distinctAdvicePatterns >= 2) findings.push({
    code: 'editorial_generic_advice_accumulation',
    message: "Plusieurs conseils interchangeables s'accumulent. Retire ceux qui ne développent pas une idée précise déjà autorisée ; conserve une distinction utile au chapitre sans inventer de conseil personnalisé.",
    counts: { distinctAdvicePatterns, adviceOccurrences: adviceMatches.reduce((sum, count) => sum + count, 0) }
  });
  return findings;
}
