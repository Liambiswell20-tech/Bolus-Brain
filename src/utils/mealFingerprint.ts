const STOP_WORDS = new Set([
  'a', 'an', 'the', 'with', 'and', 'on', 'in', 'of',
  'some', 'bit', 'little', 'side', 'plus', 'no', 'extra',
]);

/**
 * Produces a canonical fingerprint for a meal name (or combined meal names).
 * Strips punctuation, lowercases, removes stop words, sorts remaining tokens,
 * and joins with underscores.
 *
 * "Beans on toast" === "Toast with beans" === "beans and toast" → "beans_toast"
 * "Lamb shank and mashed potato" !== "Cheese and crisp sandwich"
 */
export function getMealFingerprint(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w))
    .sort()
    .join('_');
}
