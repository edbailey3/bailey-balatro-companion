import { nCr, hypergeometricCdf, multivariateHypergeometricCdf } from './math.js';

console.log('--- STARTING BALATRO TACTICAL COMPANION MATH ENGINE TESTS ---');

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

// 1. Test Combinations (nCr)
assert('nCr(52, 5) should equal 2,598,960', nCr(52, 5) === 2598960);
assert('nCr(5, 2) should equal 10', nCr(5, 2) === 10);
assert('nCr(10, 0) should equal 1', nCr(10, 0) === 1);
assert('nCr(10, 11) should equal 0 (out of bounds)', nCr(10, 11) === 0);
assert('nCr(10, -1) should equal 0 (out of bounds)', nCr(10, -1) === 0);

// 2. Test Hypergeometric CDF (Single Target)
// Case: Flush Draw. N = 44 remaining cards, K = 9 remaining suit outs.
// We draw n = 4 cards. We need k = 2 successes (we hold 3 in kept hand).
// P(X >= 2) = P(X=2) + P(X=3) + P(X=4)
// P(X=2) = (9C2 * 35C2) / 44C4 = (36 * 595) / 135755 = 21420 / 135755 = ~0.157784
// P(X=3) = (9C3 * 35C1) / 44C4 = (84 * 35) / 135755 = 2940 / 135755 = ~0.021657
// P(X=4) = (9C4 * 35C0) / 44C4 = (126 * 1) / 135755 = 126 / 135755 = ~0.000928
// Total P(X >= 2) = (21420 + 2940 + 126) / 135755 = 24486 / 135755 = 0.180369... (18.04%)
const flushProb = hypergeometricCdf(2, 44, 9, 4);
assert(
  `Flush Draw Probability: P(X >= 2) from N=44, K=9, n=4 should be approx 0.18037 (got ${flushProb.toFixed(5)})`,
  Math.abs(flushProb - 0.180369) < 0.00001
);

// 3. Test Boundary Exception Guards
assert('k > n returns 0.00%', hypergeometricCdf(5, 44, 9, 4) === 0);
assert('k > K returns 0.00%', hypergeometricCdf(3, 44, 2, 4) === 0);
assert('n > N returns 0.00%', hypergeometricCdf(1, 44, 9, 50) === 0);

// 4. Test Multivariate Hypergeometric CDF (Full House Joint Target)
// Case: N = 44, KA = 3, KB = 3, n = 4.
// We need kA = 2 (to make 3 of Rank A) and kB = 1 (to make 2 of Rank B).
// Summing xA from 2 to 3, and xB from 1 to 4 - xA.
// Possible pairs (xA, xB):
// - (2, 1): xA=2, xB=1, remainder=1. Num = (3C2) * (3C1) * (38C1) = 3 * 3 * 38 = 342
// - (2, 2): xA=2, xB=2, remainder=0. Num = (3C2) * (3C2) * (38C0) = 3 * 3 * 1 = 9
// - (3, 1): xA=3, xB=1, remainder=0. Num = (3C3) * (3C1) * (38C0) = 1 * 3 * 1 = 3
// Total joint num = 342 + 9 + 3 = 354
// Den = 44C4 = 135755
// Joint probability = 354 / 135755 = ~0.0026076
const fhProb = multivariateHypergeometricCdf(2, 1, 44, 3, 3, 4);
assert(
  `Full House joint probability should be approx 0.00261 (got ${fhProb.toFixed(5)})`,
  Math.abs(fhProb - 0.0026076) < 0.00001
);

console.log(`\n--- TESTS COMPLETE: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
