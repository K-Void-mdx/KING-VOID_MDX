const STOP_WORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'what', 'who', 'how', 'why', 'when',
  'where', 'this', 'that', 'with', 'are', 'was', 'has', 'have', 'can', 'does',
  'did', 'not', 'but', 'all', 'any', 'its', 'our', 'out', 'get', 'got',
  'about', 'from', 'they', 'them', 'his', 'her', 'she', 'him', 'will',
  'would', 'could', 'should', 'into', 'over', 'than', 'then', 'just',
  'like', 'some', 'more', 'very', 'also', 'please', 'tell', 'say', 'ask',
]);

/** Lowercased meaningful words (>=3 chars, no stop words). */
export function tokenize(text = '') {
  const words = String(text).toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
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
    const haystack = String(record.content ?? '').toLowerCase();
    const matched = terms.filter((term) => haystack.includes(term));
    if (matched.length >= Math.max(1, minMatches) && (!best || matched.length > best.matched.length)) {
      best = { record, matched };
    }
  }
  return best;
}
