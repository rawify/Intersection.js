import { describe, expect, it } from 'vitest';
import type { CubicBezier, QuadraticBezier } from '../../src/types.js';
import {
  cubicCoefficients,
  cubicControlPoints,
  cubicPointAt,
  cubicTangentAt,
  isFiniteCubic,
  quadraticToCubic,
  splitCubic,
} from '../../src/internal/bezier.js';
import { polyEval } from '../../src/internal/poly.js';
import { distance, randomCubic, randomSource, uniform } from '../test-utils.js';

const curve: CubicBezier = {
  p0: { x: 0, y: 0 },
  p1: { x: 1, y: 3 },
  p2: { x: 2, y: -3 },
  p3: { x: 3, y: 0 },
};

describe('cubicPointAt', () => {
  it('reproduces the endpoints exactly', () => {
    expect(cubicPointAt(curve, 0)).toEqual({ x: 0, y: 0 });
    expect(cubicPointAt(curve, 1)).toEqual({ x: 3, y: 0 });
  });

  it('agrees with the power-basis form everywhere', () => {
    const { x, y } = cubicCoefficients(curve);
    const random = randomSource(7);

    for (let i = 0; i < 200; i++) {
      const t = random();
      const p = cubicPointAt(curve, t);
      expect(Math.abs(p.x - polyEval(x, t))).toBeLessThan(1e-12);
      expect(Math.abs(p.y - polyEval(y, t))).toBeLessThan(1e-12);
    }
  });
});

describe('cubicTangentAt', () => {
  it('matches a central difference of the curve', () => {
    const h = 1e-6;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const ahead = cubicPointAt(curve, t + h);
      const behind = cubicPointAt(curve, t - h);
      const tangent = cubicTangentAt(curve, t);
      expect(Math.abs(tangent.x - (ahead.x - behind.x) / (2 * h))).toBeLessThan(1e-6);
      expect(Math.abs(tangent.y - (ahead.y - behind.y) / (2 * h))).toBeLessThan(1e-6);
    }
  });
});

describe('splitCubic', () => {
  it('produces two halves that trace the original curve', () => {
    const random = randomSource(11);

    for (let i = 0; i < 50; i++) {
      const original = randomCubic(random);
      const at = uniform(random, 0.05, 0.95);
      const [left, right] = splitCubic(original, at);

      expect(distance(left.p3, right.p0)).toBeLessThan(1e-12);

      for (let k = 0; k <= 10; k++) {
        const local = k / 10;
        expect(distance(cubicPointAt(left, local), cubicPointAt(original, local * at)))
          .toBeLessThan(1e-12);
        expect(distance(cubicPointAt(right, local), cubicPointAt(original, at + local * (1 - at))))
          .toBeLessThan(1e-12);
      }
    }
  });
});

describe('quadraticToCubic', () => {
  it('elevates the degree without changing the path', () => {
    const quadratic: QuadraticBezier = {
      p0: { x: -2, y: 1 },
      p1: { x: 0, y: 5 },
      p2: { x: 4, y: -1 },
    };
    const elevated = quadraticToCubic(quadratic);

    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      const u = 1 - t;
      const expected = {
        x: u * u * quadratic.p0.x + 2 * u * t * quadratic.p1.x + t * t * quadratic.p2.x,
        y: u * u * quadratic.p0.y + 2 * u * t * quadratic.p1.y + t * t * quadratic.p2.y,
      };
      expect(distance(cubicPointAt(elevated, t), expected)).toBeLessThan(1e-12);
    }
  });
});

describe('helpers', () => {
  it('lists the control points in order', () => {
    expect(cubicControlPoints(curve)).toEqual([curve.p0, curve.p1, curve.p2, curve.p3]);
  });

  it('rejects a curve with a non-finite control point', () => {
    expect(isFiniteCubic(curve)).toBe(true);
    expect(isFiniteCubic({ ...curve, p2: { x: Number.NaN, y: 0 } })).toBe(false);
    expect(isFiniteCubic({ ...curve, p1: { x: 0, y: Infinity } })).toBe(false);
  });
});
