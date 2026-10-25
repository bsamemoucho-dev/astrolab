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

export function editorialStyleFindings(text) {
  const source = normalized(text).trim();
  if (!source) return [];
  const findings = [];
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
