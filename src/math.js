/**
 * Hypergeometric Draw Engine for Balatro Tactical Companion
 */

/**
 * Calculates combinations (nCr) in a precise and overflow-safe manner.
 * Returns 0 if parameters are mathematically invalid.
 * 
 * @param {number} n Total items
 * @param {number} r Chosen items
 * @returns {number} nCr value
 */
export function nCr(n, r) {
  if (r < 0 || r > n || n < 0) return 0;
  if (r === 0 || r === n) return 1;
  if (r > n / 2) r = n - r;

  let res = 1;
  for (let i = 1; i <= r; i++) {
    res = res * (n - i + 1) / i;
  }
  return Math.round(res);
}

/**
 * Computes individual Hypergeometric Probability P(X = k)
 * 
 * @param {number} k Target successes drawn
 * @param {number} N Total remaining deck size
 * @param {number} K Total matching targets in deck
 * @param {number} n Discard draw sample size
 * @returns {number} Probability value between 0 and 1
 */
export function hypergeometricPdf(k, N, K, n) {
  // Boundary exceptions
  if (k > n || k > K || n > N || k < 0 || n < 0 || K < 0 || N < 0) {
    return 0;
  }

  const num = nCr(K, k) * nCr(N - K, n - k);
  const den = nCr(N, n);

  if (den === 0) return 0;
  return num / den;
}

/**
 * Computes Cumulative Hypergeometric Probability P(X >= k)
 * 
 * @param {number} k Minimum successes needed
 * @param {number} N Total remaining deck size
 * @param {number} K Total matching targets in deck
 * @param {number} n Discard draw sample size
 * @returns {number} Cumulative probability value between 0 and 1
 */
export function hypergeometricCdf(k, N, K, n) {
  // Boundary Exception Guard Rules:
  // "If k > n, k > K, or n > N, the evaluation framework must catch the out-of-bounds error early and return a deterministic 0.00% success indicator"
  if (k > n || k > K || n > N) {
    return 0;
  }

  // If we need 0 or fewer successes, probability of meeting the target is 100%
  if (k <= 0) {
    return 1;
  }

  let sum = 0;
  const maxSuccesses = Math.min(n, K);
  for (let i = k; i <= maxSuccesses; i++) {
    sum += hypergeometricPdf(i, N, K, n);
  }

  // Ensure precision boundaries [0, 1]
  return Math.max(0, Math.min(1, sum));
}

/**
 * Evaluates dual-target joint probability for Full House (3 of Rank A, 2 of Rank B)
 * Using Multivariate Hypergeometric Distribution.
 * 
 * @param {number} kA Needed cards of Rank A
 * @param {number} kB Needed cards of Rank B
 * @param {number} N Total remaining deck size
 * @param {number} KA Total Rank A cards in remaining deck
 * @param {number} KB Total Rank B cards in remaining deck
 * @param {number} n Discard draw sample size
 * @returns {number} Cumulative joint probability between 0 and 1
 */
export function multivariateHypergeometricCdf(kA, kB, N, KA, KB, n) {
  // Boundary Exception Guard Rules
  if (kA + kB > n || kA > KA || kB > KB || n > N) {
    return 0;
  }

  // If both targets are already met
  if (kA <= 0 && kB <= 0) {
    return 1;
  }

  const den = nCr(N, n);
  if (den === 0) return 0;

  let sum = 0;

  // We iterate over all possible draw amounts of Rank A (xA) and Rank B (xB)
  // that satisfy:
  // xA >= kA, xB >= kB, and xA + xB <= n
  for (let xA = Math.max(0, kA); xA <= Math.min(n, KA); xA++) {
    for (let xB = Math.max(0, kB); xB <= Math.min(n - xA, KB); xB++) {
      const remainingDraw = n - xA - xB;
      const remainingDeck = N - KA - KB;

      if (remainingDraw >= 0 && remainingDraw <= remainingDeck) {
        const num = nCr(KA, xA) * nCr(KB, xB) * nCr(remainingDeck, remainingDraw);
        sum += num / den;
      }
    }
  }

  return Math.max(0, Math.min(1, sum));
}
