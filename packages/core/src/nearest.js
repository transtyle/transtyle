/**
 * "Did you mean …?" — shared by config validation (unknown key), target
 * resolution (unknown target instance), and the CLI's `explain` (unknown slot).
 *
 * AL5 rationale: every one of those three errors used to end at "X is not
 * valid" while the code was holding the list of things that ARE valid. A typo
 * is the most common way each is reached, so the suggestion is not a nicety —
 * it is usually the entire fix.
 */

/** Classic Levenshtein edit distance. */
export function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * The closest candidate to `name`, or null when nothing is close enough.
 * The threshold scales with the name's length (a third of it, at least 1, at
 * most 3) so short names don't match everything and long ones still tolerate a
 * couple of slips — guessing wildly is worse than not guessing.
 */
export function nearestName(name, candidates) {
  const limit = Math.max(1, Math.min(3, Math.floor(name.length / 3)));
  let best = null;
  for (const c of candidates) {
    const d = levenshtein(name, c);
    if (d <= limit && (!best || d < best.d)) best = { c, d };
  }
  return best?.c ?? null;
}
