import { nCr, calculateMultivariateHypergeometric, hypergeometricCdf, multivariateHypergeometricCdf } from './math.js';

console.log('--- STARTING BALATRO TACTICAL COMPANION MATH ENGINE V1 TESTS ---');

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`[PASS] ${description}`);
    passed++;
  } else {
    console.error(`[FAIL] ${description}`);
    failed++;
  }
}

// 1. Basic nCr Tests
assert('nCr(52, 5) should equal 2,598,960', nCr(52, 5) === 2598960);
assert('nCr(5, 2) should equal 10', nCr(5, 2) === 10);
assert('nCr(10, 0) should equal 1', nCr(10, 0) === 1);
assert('nCr(10, 11) should equal 0', nCr(10, 11) === 0);

// 2. Univariate Hypergeometric CDF test via general solver
const flushProb = hypergeometricCdf(2, 44, 9, 4);
assert(
  `Flush Draw Probability: P(X >= 2) from N=44, K=9, n=4 should be approx 0.18037 (got ${flushProb.toFixed(5)})`,
  Math.abs(flushProb - 0.180369) < 0.00001
);

// 3. Multivariate (Full House) joint target test via general solver
const fhProb = multivariateHypergeometricCdf(2, 1, 44, 3, 3, 4);
assert(
  `Full House joint probability should be approx 0.00261 (got ${fhProb.toFixed(5)})`,
  Math.abs(fhProb - 0.0026076) < 0.00001
);

// 4. Five of a Kind / Flush Five Check (Needs 5 of a kind)
// Case: We kept 3 Aces. We need 2 more Aces. Total remaining Aces in deck K = 2.
// Draw size n = 4. Remaining deck N = 44.
// Probability of drawing BOTH Aces: (2C2 * 42C2) / 44C4 = (1 * 861) / 135755 = ~0.00634
const acesNeededProb = calculateMultivariateHypergeometric(44, 4, [{ K: 2, k: 2 }]);
assert(
  `Five of a Kind (Ace) draw probability: P(X >= 2) from N=44, K=2, n=4 should be approx 0.00634 (got ${acesNeededProb.toFixed(5)})`,
  Math.abs(acesNeededProb - 0.0063423) < 0.00001
);

// 5. Straight Check (Multivariate)
// Case: Straight Draw (J-Q-K-A-10 range). We hold Queen, King, Ace. We need Jack and 10.
// Remaining deck N = 44. Remaining Jack cards = 4, Remaining 10 cards = 4.
// Draw size n = 4. We need >= 1 Jack and >= 1 ten.
// We pass targets: [{ K: 4, k: 1 }, { K: 4, k: 1 }].
// Joint probability should be calculated by summing ways.
// Let's compute. (44C4 = 135755)
// Ways to get exactly xJ, x10:
// - xJ=1, x10=1: (4C1 * 4C1 * 36C2) = 4 * 4 * 630 = 10080
// - xJ=1, x10=2: (4C1 * 4C2 * 36C1) = 4 * 6 * 36 = 864
// - xJ=1, x10=3: (4C1 * 4C3 * 36C0) = 4 * 4 * 1 = 16
// - xJ=2, x10=1: (4C2 * 4C1 * 36C1) = 6 * 4 * 36 = 864
// - xJ=2, x10=2: (4C2 * 4C2 * 36C0) = 6 * 6 * 1 = 36
// - xJ=3, x10=1: (4C3 * 4C1 * 36C0) = 4 * 4 * 1 = 16
// Total successful ways = 10080 + 864 + 16 + 864 + 36 + 16 = 11876
// Probability = 11876 / 135755 = ~0.08748
const straightProb = calculateMultivariateHypergeometric(44, 4, [
  { K: 4, k: 1 },
  { K: 4, k: 1 }
]);
assert(
  `Straight Draw (J-Q-K-A-10) needing Jack and 10 from N=44, n=4 should be approx 0.08748 (got ${straightProb.toFixed(5)})`,
  Math.abs(straightProb - 0.087481) < 0.00001
);

// 6. Royal Flush Check (Multivariate)
// Case: We hold King of Spades, Ace of Spades. We need 10, J, Q of Spades.
// Remaining deck has exactly 1 of each (10S, JS, QS). We need 1 of each.
// Draw size n = 4. Remaining deck N = 44.
// Targets: [{K: 1, k: 1}, {K: 1, k: 1}, {K: 1, k: 1}].
// Den = 44C4 = 135755.
// Successful draws: We must pick 10S, JS, QS, and 1 of the remaining 41 cards.
// Ways = 1C1 * 1C1 * 1C1 * 41C1 = 41.
// Probability = 41 / 135755 = ~0.000302
const royalFlushProb = calculateMultivariateHypergeometric(44, 4, [
  { K: 1, k: 1 },
  { K: 1, k: 1 },
  { K: 1, k: 1 }
]);
assert(
  `Royal Flush draw probability needing 3 specific cards (10S, JS, QS) from N=44, n=4 should be approx 0.000302 (got ${royalFlushProb.toFixed(6)})`,
  Math.abs(royalFlushProb - 0.000302) < 0.000001
);

console.log(`\n--- TESTS COMPLETE: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
