const STOP_WORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'what', 'who', 'how', 'why', 'when',
  'where', 'this', 'that', 'with', 'are', 'was', 'has', 'have', 'can', 'does',
  'did', 'not', 'but', 'all', 'any', 'its', 'our', 'out', 'get', 'got',
  'about', 'from', 'they', 'them', 'his', 'her', 'she', 'him', 'will',
  'would', 'could', 'should', 'into', 'over', 'than', 'then', 'just',
  'like', 'some', 'more', 'very', 'also', 'please', 'tell', 'say', 'ask',
  // Short function words kept out now that 2-char tokens are indexed;
  // without these, near-every sentence would match everything.
  'is', 'it', 'be', 'we', 'me', 'my', 'so', 'no', 'yes', 'on', 'in', 'to',
  'of', 'at', 'as', 'by', 'or', 'an', 'if', 'up', 'us', 'am', 'do', 'ok',
]);

/** Lowercase, fold curly/straight apostrophes so "say's" matches "says". */
export function normalizeKnowledgeText(text = '') {
  return String(text).toLowerCase().replace(/['’`´]/g, '');
}

/** Meaningful lowercase words (>=2 chars, apostrophe-folded, no stop words). */
export function tokenize(text = '') {
  const words = normalizeKnowledgeText(text).match(/[a-z0-9]{2,}/g) ?? [];
  return words.filter((word) => !STOP_WORDS.has(word));
}

/**
 * Offline retrieval over global training knowledge (no external AI needed).
 * Scores each stored record by how many distinct prompt terms it contains.
 * Returns { record, matchedTerms } for the single best match, or null.
 */
export function findKnowledge(memoryStore, prompt, { minMatches = 1 } = {}) {
  const terms = [...new Set(tokenize(prompt))];
  if (!terms.length) return null;

  let best = null;
  for (const record of memoryStore.listAll('global')) {
    const haystack = normalizeKnowledgeText(record.content ?? '');
    const matched = terms.filter((term) => haystack.includes(term));
    if (matched.length >= Math.max(1, minMatches) && (!best || matched.length > best.matched.length)) {
      best = { record, matched };
    }
  }
  return best;
}
