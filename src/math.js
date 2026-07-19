/**
 * Hypergeometric Draw Engine for Balatro Tactical Companion (v1)
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
 * Generalized Multivariate Hypergeometric Cumulative Probability Solver.
 * Evaluates the probability that for all targets, we draw at least t.k cards
 * of category i (which has t.K available items in the remaining deck)
 * when drawing a sample of size n from a deck of size N.
 * 
 * @param {number} N Total remaining deck size
 * @param {number} n Discard draw sample size
 * @param {Array<{K: number, k: number}>} targets List of target configurations
 * @returns {number} Joint probability between 0 and 1
 */
export function calculateMultivariateHypergeometric(N, n, targets) {
  // Filter out targets that don't need any cards (k <= 0)
  const activeTargets = targets.filter(t => t.k > 0);
  
  // If we don't need any successes, the probability of meeting the target is 100%
  if (activeTargets.length === 0) {
    return 1.0;
  }

  // Boundary Exception Guards
  const totalK = activeTargets.reduce((sum, t) => sum + t.K, 0);
  const totalNeeded = activeTargets.reduce((sum, t) => sum + t.k, 0);
  
  if (totalNeeded > n || totalK > N || n > N) {
    return 0.0;
  }

  for (const t of activeTargets) {
    if (t.k > t.K) {
      return 0.0;
    }
  }

  const den = nCr(N, n);
  if (den === 0) return 0.0;

  let successfulWays = 0;

  // Recursive search to find all combinations of draws (x_1, x_2, ..., x_m)
  // such that x_i >= k_i and sum(x_i) <= n
  function search(targetIndex, currentSum, currentCombos) {
    if (targetIndex === activeTargets.length) {
      const remainingDraw = n - currentSum;
      const remainingDeck = N - totalK;
      if (remainingDraw >= 0 && remainingDraw <= remainingDeck) {
        const ways = currentCombos * nCr(remainingDeck, remainingDraw);
        successfulWays += ways;
      }
      return;
    }

    const target = activeTargets[targetIndex];
    // We can draw between target.k and min(target.K, n - currentSum) cards of this category
    const maxDraw = Math.min(target.K, n - currentSum);
    for (let x = target.k; x <= maxDraw; x++) {
      search(
        targetIndex + 1,
        currentSum + x,
        currentCombos * nCr(target.K, x)
      );
    }
  }

  search(0, 0, 1);
  return Math.max(0, Math.min(1, successfulWays / den));
}

/**
 * Computes individual Hypergeometric Probability P(X = k)
 */
export function hypergeometricPdf(k, N, K, n) {
  if (k > n || k > K || n > N || k < 0 || n < 0 || K < 0 || N < 0) {
    return 0;
  }
  const num = nCr(K, k) * nCr(N - K, n - k);
  const den = nCr(N, n);
  if (den === 0) return 0;
  return num / den;
}

/**
 * Computes Cumulative Hypergeometric Probability P(X >= k) - wrapper using general solver
 */
export function hypergeometricCdf(k, N, K, n) {
  // Boundary Exception Guard Rules
  if (k > n || k > K || n > N) {
    return 0;
  }
  if (k <= 0) {
    return 1;
  }
  return calculateMultivariateHypergeometric(N, n, [{ K: K, k: k }]);
}

/**
 * Evaluates dual-target joint probability for Full House - wrapper using general solver
 */
export function multivariateHypergeometricCdf(kA, kB, N, KA, KB, n) {
  return calculateMultivariateHypergeometric(N, n, [
    { K: KA, k: kA },
    { K: KB, k: kB }
  ]);
}
