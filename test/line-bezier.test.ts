import { describe, expect, it } from 'vitest';
import type { CubicBezier } from '../src/types.js';
import { lineBezier } from '../src/line-bezier.js';
import { quadraticToCubic } from '../src/internal/bezier.js';
import {
  countSignChanges,
  expectOnCubic,
  expectOnSegment,
  lineResidual,
  randomCubic,
  randomPoint,
  randomSource,
} from './test-utils.js';

/** An S through y = 0 at t = 0, ½ and 1: y(t) = 9t(1-t)(1-2t). */
const sCurve: CubicBezier = {
  p0: { x: 0, y: 0 },
  p1: { x: 1, y: 3 },
  p2: { x: 2, y: -3 },
  p3: { x: 3, y: 0 },
};

/** An arch peaking at (5, 7.5), t = ½. */
const arch: CubicBezier = {
  p0: { x: 0, y: 0 },
  p1: { x: 0, y: 10 },
  p2: { x: 10, y: 10 },
  p3: { x: 10, y: 0 },
};

describe('lineBezier', () => {
  it('finds all three crossings a cubic can have with one line', () => {
    const hits = lineBezier({ x: -1, y: 0 }, { x: 4, y: 0 }, sCurve);

    expect(hits).toHaveLength(3);
    expect(hits.map((hit) => hit.t1)).toEqual([0, 0.5, 1]);
    expect(hits.map((hit) => Number(hit.x.toFixed(9)))).toEqual([0, 1.5, 3]);
    for (const hit of hits) expect(Math.abs(hit.y)).toBeLessThan(1e-12);
  });

  it('orders the results along the curve, not along the line', () => {
    // Same line, traversed the other way: t1 still ascends, t2 mirrors.
    const hits = lineBezier({ x: 4, y: 0 }, { x: -1, y: 0 }, sCurve);

    expect(hits.map((hit) => hit.t1)).toEqual([0, 0.5, 1]);
    expect(hits[0]!.t2).toBeGreaterThan(hits[2]!.t2);
  });

  it('rejects crossings of the infinite line that miss the segment', () => {
    // The line y = 0 restricted to x in [-1, 2] leaves out the crossing at x = 3.
    const hits = lineBezier({ x: -1, y: 0 }, { x: 2, y: 0 }, sCurve);

    expect(hits).toHaveLength(2);
    expect(hits.map((hit) => hit.t1)).toEqual([0, 0.5]);
  });

  it('reports a tangential touch once', () => {
    const hits = lineBezier({ x: -5, y: 7.5 }, { x: 15, y: 7.5 }, arch);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.t1).toBeCloseTo(0.5, 9);
    expect(hits[0]!.x).toBeCloseTo(5, 9);
  });

  it('handles a curve whose control points are collinear', () => {
    const straight: CubicBezier = {
      p0: { x: 0, y: 0 },
      p1: { x: 1, y: 1 },
      p2: { x: 2, y: 2 },
      p3: { x: 3, y: 3 },
    };
    const hits = lineBezier({ x: 0, y: 2 }, { x: 4, y: 2 }, straight);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.x).toBeCloseTo(2, 9);
    expect(hits[0]!.y).toBeCloseTo(2, 9);
  });

  it('takes a quadratic once it has been elevated', () => {
    // y(t) = 4t(1-t) on this parabola, so y = 0.75 at t = ¼ and ¾, where
    // x(t) = -1 and 1. The apex is y = 1, which the arch test above covers.
    const parabola = quadraticToCubic({
      p0: { x: -2, y: 0 },
      p1: { x: 0, y: 2 },
      p2: { x: 2, y: 0 },
    });
    const hits = lineBezier({ x: -5, y: 0.75 }, { x: 5, y: 0.75 }, parabola);

    expect(hits).toHaveLength(2);
    expect(hits.map((hit) => Number(hit.x.toFixed(9)))).toEqual([-1, 1]);
    expect(hits.map((hit) => Number(hit.t1.toFixed(9)))).toEqual([0.25, 0.75]);
    for (const hit of hits) expect(hit.y).toBeCloseTo(0.75, 9);
  });

  it('finds nothing for degenerate input', () => {
    expect(lineBezier({ x: 1, y: 1 }, { x: 1, y: 1 }, sCurve)).toEqual([]);
    expect(lineBezier({ x: -1, y: 50 }, { x: 4, y: 50 }, sCurve)).toEqual([]);
    expect(lineBezier({ x: Number.NaN, y: 0 }, { x: 4, y: 0 }, sCurve)).toEqual([]);
    expect(lineBezier({ x: -1, y: 0 }, { x: 4, y: 0 }, { ...sCurve, p1: { x: Number.NaN, y: 0 } }))
      .toEqual([]);
  });

  it('matches a brute-force count over a randomized sweep', () => {
    const random = randomSource(555);
    let total = 0;

    for (let i = 0; i < 400; i++) {
      const curve = randomCubic(random);
      // A segment long enough to cover the whole curve, so every crossing of
      // the infinite line is also a crossing of the segment.
      const through = randomPoint(random);
      const direction = randomPoint(random);
      const a = { x: through.x - 40 * direction.x, y: through.y - 40 * direction.y };
      const b = { x: through.x + 40 * direction.x, y: through.y + 40 * direction.y };

      const hits = lineBezier(a, b, curve);
      expect(hits.length).toBeLessThanOrEqual(3);

      for (const hit of hits) {
        total++;
        expectOnCubic(hit, hit.t1, curve);
        expectOnSegment(hit, hit.t2, a, b, 1e-6);
        expect(lineResidual(hit, a, b)).toBeLessThan(1e-6);
      }

      // Sign changes of the line's implicit form along the curve: an
      // independent lower bound on how many roots there are.
      const nx = b.y - a.y;
      const ny = a.x - b.x;
      const d = a.x * nx + a.y * ny;
      const implicit = (t: number) => {
        const u = 1 - t;
        const x = u * u * u * curve.p0.x + 3 * u * u * t * curve.p1.x
          + 3 * u * t * t * curve.p2.x + t * t * t * curve.p3.x;
        const y = u * u * u * curve.p0.y + 3 * u * u * t * curve.p1.y
          + 3 * u * t * t * curve.p2.y + t * t * t * curve.p3.y;
        return nx * x + ny * y - d;
      };
      expect(hits.length).toBeGreaterThanOrEqual(countSignChanges(implicit, 4000));
    }
    expect(total).toBeGreaterThan(200);
  });
});
