import { describe, expect, it } from 'vitest';
import {
  cubicRoots,
  polyAdd,
  polyAddConstant,
  polyDerivative,
  polyEval,
  polyIsZero,
  polyMul,
  polyTrim,
  quadraticRoots,
  realRoots,
  realRootsInInterval,
} from '../../src/internal/poly.js';

/** Expands `(x - r1)(x - r2)...` into descending coefficients. */
function fromRoots(roots: readonly number[]): number[] {
  return roots.reduce<number[]>((acc, root) => polyMul(acc, [1, -root]), [1]);
}

function expectRootsClose(actual: readonly number[], expected: readonly number[], tolerance = 1e-9) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((root, index) => {
    expect(Math.abs(root - expected[index]!)).toBeLessThan(tolerance);
  });
}

describe('polynomial arithmetic', () => {
  it('evaluates by Horner in descending coefficient order', () => {
    // 2x³ - 3x + 1 at x = 2 -> 16 - 6 + 1
    expect(polyEval([2, 0, -3, 1], 2)).toBe(11);
    expect(polyEval([], 5)).toBe(0);
  });

  it('differentiates and bottoms out at the zero polynomial', () => {
    expect(polyDerivative([2, 0, -3, 1])).toEqual([6, 0, -3]);
    expect(polyDerivative([7])).toEqual([0]);
  });

  it('multiplies and adds polynomials of unequal degree', () => {
    expect(polyMul([1, 1], [1, -1])).toEqual([1, 0, -1]);
    expect(polyAdd([1, 0, -1], [2, 3])).toEqual([1, 2, 2]);
    expect(polyAddConstant([1, 2, 3], -3)).toEqual([1, 2, 0]);
  });

  it('trims leading coefficients that are negligible against the largest', () => {
    expect(polyTrim([1e-20, 1, 2])).toEqual([1, 2]);
    expect(polyTrim([0, 0, 0])).toEqual([0]);
    expect(polyTrim([3, 1])).toEqual([3, 1]);
    expect(polyIsZero([0, 0])).toBe(true);
    expect(polyIsZero([1e-20, 1])).toBe(false);
  });
});

describe('quadraticRoots', () => {
  it('solves the ordinary case in ascending order', () => {
    expectRootsClose(quadraticRoots(1, -3, 2), [1, 2]);
  });

  it('reports a touching root once instead of twice', () => {
    expectRootsClose(quadraticRoots(1, -2, 1), [1]);
  });

  it('returns nothing when the discriminant is genuinely negative', () => {
    expect(quadraticRoots(1, 0, 1)).toEqual([]);
  });

  it('falls back through the degenerate leading coefficients', () => {
    expectRootsClose(quadraticRoots(0, 2, -4), [2]);
    expect(quadraticRoots(0, 0, 5)).toEqual([]);
    expect(quadraticRoots(0, 0, 0)).toEqual([]);
  });

  it('keeps both roots accurate when they differ by 16 orders of magnitude', () => {
    // (x - 1e8)(x - 1e-8): the textbook formula computes the small root as the
    // difference of two nearly equal numbers and loses every digit of it.
    const [small, large] = quadraticRoots(1, -(1e8 + 1e-8), 1) as [number, number];
    expect(Math.abs(small / 1e-8 - 1)).toBeLessThan(1e-10);
    expect(Math.abs(large / 1e8 - 1)).toBeLessThan(1e-15);
  });
});

describe('cubicRoots', () => {
  it('finds three distinct real roots', () => {
    expectRootsClose(cubicRoots(1, -6, 11, -6), [1, 2, 3]);
  });

  it('finds the single real root when the other two are complex', () => {
    expectRootsClose(cubicRoots(1, 0, 0, -8), [2]);
  });

  it('collapses a triple root', () => {
    expectRootsClose(cubicRoots(1, -3, 3, -1), [1], 1e-5);
  });

  it('reports a double root and its single partner', () => {
    // (x - 1)²(x + 2)
    expectRootsClose(cubicRoots(1, 0, -3, 2), [-2, 1], 1e-7);
  });

  it('degrades to the quadratic and linear cases', () => {
    expectRootsClose(cubicRoots(0, 1, -3, 2), [1, 2]);
    expectRootsClose(cubicRoots(0, 0, 4, -2), [0.5]);
    expect(cubicRoots(0, 0, 0, 0)).toEqual([]);
  });

  it('stays accurate for roots spread over many magnitudes', () => {
    const roots = cubicRoots(...fromRoots([-1e4, 1e-3, 7]) as [number, number, number, number]);
    expectRootsClose(roots, [-1e4, 1e-3, 7], 1e-6);
  });
});

describe('realRootsInInterval', () => {
  it('solves a quartic with four real roots', () => {
    expectRootsClose(realRootsInInterval(fromRoots([-2, -0.5, 1, 3]), -10, 10), [-2, -0.5, 1, 3]);
  });

  it('solves a sextic with six real roots', () => {
    const expected = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
    expectRootsClose(realRootsInInterval(fromRoots(expected), 0, 1), expected, 1e-8);
  });

  it('finds a quartic double root, where the derivative vanishes too', () => {
    // (x - 0.5)²(x² + 1): a tangency, no sign change anywhere near it.
    const poly = polyMul(fromRoots([0.5, 0.5]), [1, 0, 1]);
    expectRootsClose(realRootsInInterval(poly, 0, 1), [0.5], 1e-7);
  });

  it('honours the interval and its endpoints', () => {
    const poly = fromRoots([-2, 0.25, 4]);
    expectRootsClose(realRootsInInterval(poly, 0, 1), [0.25]);
    expectRootsClose(realRootsInInterval(poly, 0.25, 4), [0.25, 4]);
    expect(realRootsInInterval(poly, 1, 3)).toEqual([]);
    expect(realRootsInInterval(poly, 1, 0)).toEqual([]);
  });

  it('solves the low-degree cases it is handed directly', () => {
    expectRootsClose(realRootsInInterval([2, -1], 0, 1), [0.5]);
    expectRootsClose(realRootsInInterval([1, -3, 2], 0, 1.5), [1]);
    expect(realRootsInInterval([2, -1], 0.6, 1)).toEqual([]);
  });

  it('has no roots to report for a constant', () => {
    expect(realRootsInInterval([5], -1, 1)).toEqual([]);
    expect(realRootsInInterval([0], -1, 1)).toEqual([]);
  });

  it('finds a root sitting exactly on the upper bound of a high-degree polynomial', () => {
    expectRootsClose(realRootsInInterval(fromRoots([1, 2, 3, 4, 5]), 0.5, 1), [1], 1e-8);
  });

  it('deduplicates a repeated root on an interval boundary', () => {
    expectRootsClose(realRootsInInterval(fromRoots([0, 0, 1, 2]), 0, 3), [0, 1, 2]);
  });
});

describe('realRoots', () => {
  it('brackets the whole spectrum without being told where to look', () => {
    expectRootsClose(realRoots(fromRoots([-30, -1, 0.5, 17])), [-30, -1, 0.5, 17], 1e-7);
  });

  it('returns nothing for a polynomial without real roots', () => {
    expect(realRoots(polyMul([1, 0, 1], [1, 0, 4]))).toEqual([]);
  });

  it('returns nothing for the zero polynomial', () => {
    expect(realRoots([0, 0, 0])).toEqual([]);
    expect(realRoots([])).toEqual([]);
  });
});
