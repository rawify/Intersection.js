import { describe, expect, it } from 'vitest';
import type { CubicBezier, Point } from '../src/types.js';
import { bezierBezier } from '../src/bezier-bezier.js';
import { cubicPointAt, splitCubic } from '../src/internal/bezier.js';
import { lineLine } from '../src/line-line.js';
import {
  distance,
  expectOnCubic,
  randomCubic,
  randomSource,
} from './test-utils.js';

/** An arch peaking at (5, 7.5). */
const arch: CubicBezier = {
  p0: { x: 0, y: 0 },
  p1: { x: 0, y: 10 },
  p2: { x: 10, y: 10 },
  p3: { x: 10, y: 0 },
};

/** The same shape upside down, bottoming out at (5, 7.5) -- a tangential touch. */
const inverted: CubicBezier = {
  p0: { x: 0, y: 15 },
  p1: { x: 0, y: 5 },
  p2: { x: 10, y: 5 },
  p3: { x: 10, y: 15 },
};

/**
 * Independent oracle: flatten both curves and intersect the polylines. Slow and
 * approximate, but it knows nothing about the solver under test.
 */
function polylineCrossings(first: CubicBezier, second: CubicBezier, steps = 96): Point[] {
  const flatten = (curve: CubicBezier): Point[] => (
    Array.from({ length: steps + 1 }, (_, i) => cubicPointAt(curve, i / steps))
  );
  const a = flatten(first);
  const b = flatten(second);
  const out: Point[] = [];

  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < steps; k++) {
      for (const hit of lineLine(a[i]!, a[i + 1]!, b[k]!, b[k + 1]!)) out.push(hit);
    }
  }
  return out;
}

describe('bezierBezier', () => {
  it('finds a single transversal crossing to machine precision', () => {
    const rising: CubicBezier = {
      p0: { x: 0, y: 0 },
      p1: { x: 3, y: 0 },
      p2: { x: 7, y: 10 },
      p3: { x: 10, y: 10 },
    };
    const falling: CubicBezier = {
      p0: { x: 0, y: 10 },
      p1: { x: 3, y: 10 },
      p2: { x: 7, y: 0 },
      p3: { x: 10, y: 0 },
    };
    const hits = bezierBezier(rising, falling);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.x).toBeCloseTo(5, 9);
    expect(hits[0]!.y).toBeCloseTo(5, 9);
    expect(hits[0]!.t1).toBeCloseTo(0.5, 9);
    expect(hits[0]!.t2).toBeCloseTo(0.5, 9);
    // Both curves agree on the point, not just approximately.
    expect(distance(cubicPointAt(rising, hits[0]!.t1), cubicPointAt(falling, hits[0]!.t2)))
      .toBeLessThan(1e-9);
  });

  it('finds several crossings and orders them along the first curve', () => {
    // y(t) = 36t(1-t)(1-2t) on this wave, so the x axis meets it at t = 0, ½
    // and 1 -- two of the three being endpoints.
    const wave: CubicBezier = {
      p0: { x: 0, y: 0 },
      p1: { x: 3, y: 12 },
      p2: { x: 7, y: -12 },
      p3: { x: 10, y: 0 },
    };
    const axis: CubicBezier = {
      p0: { x: 0, y: 0 },
      p1: { x: 3, y: 0 },
      p2: { x: 7, y: 0 },
      p3: { x: 10, y: 0 },
    };
    const hits = bezierBezier(wave, axis);

    expect(hits).toHaveLength(3);
    expect(hits.map((hit) => Number(hit.t1.toFixed(6)))).toEqual([0, 0.5, 1]);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]!.t1).toBeGreaterThan(hits[i - 1]!.t1);
    }
    for (const hit of hits) {
      expectOnCubic(hit, hit.t1, wave, 1e-6);
      expectOnCubic(hit, hit.t2, axis, 1e-6);
    }
  });

  it('counts only the lobes a line actually reaches', () => {
    // The same wave is antisymmetric about y = 0, so an offset line catches the
    // upward lobe twice and never reaches the downward one.
    const wave: CubicBezier = {
      p0: { x: 0, y: 0 },
      p1: { x: 3, y: 12 },
      p2: { x: 7, y: -12 },
      p3: { x: 10, y: 0 },
    };
    const offset: CubicBezier = {
      p0: { x: 0, y: 0.5 },
      p1: { x: 3, y: 0.5 },
      p2: { x: 7, y: 0.5 },
      p3: { x: 10, y: 0.5 },
    };
    const hits = bezierBezier(wave, offset);

    expect(hits).toHaveLength(2);
    for (const hit of hits) expect(hit.y).toBeCloseTo(0.5, 7);
  });

  it('finds six crossings between two loops without tripping the overlap guard', () => {
    // Well past the point where the subdivision has to keep several candidate
    // cells alive at once, and cross-checked against the polyline oracle below.
    const first: CubicBezier = {
      p0: { x: 1.398, y: -0.322 },
      p1: { x: 5.303, y: -5.872 },
      p2: { x: -5.971, y: 2.804 },
      p3: { x: 0.954, y: -4.265 },
    };
    const second: CubicBezier = {
      p0: { x: -5.608, y: -3.216 },
      p1: { x: 2.549, y: -0.746 },
      p2: { x: 4.138, y: 1.862 },
      p3: { x: -0.098, y: -5.422 },
    };
    const hits = bezierBezier(first, second);

    expect(hits).toHaveLength(6);
    expect(polylineCrossings(first, second, 160)).toHaveLength(6);
    for (const hit of hits) {
      expectOnCubic(hit, hit.t1, first, 1e-9);
      expectOnCubic(hit, hit.t2, second, 1e-9);
    }
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]!.t1).toBeGreaterThan(hits[i - 1]!.t1);
    }
  });

  it('finds a shared endpoint', () => {
    const left: CubicBezier = {
      p0: { x: 0, y: 0 },
      p1: { x: 1, y: 2 },
      p2: { x: 2, y: 2 },
      p3: { x: 3, y: 0 },
    };
    const right: CubicBezier = {
      p0: { x: 3, y: 0 },
      p1: { x: 4, y: -2 },
      p2: { x: 5, y: -2 },
      p3: { x: 6, y: 0 },
    };
    const hits = bezierBezier(left, right);

    expect(hits).toHaveLength(1);
    expect(distance(hits[0]!, { x: 3, y: 0 })).toBeLessThan(1e-6);
    expect(hits[0]!.t1).toBeCloseTo(1, 5);
    expect(hits[0]!.t2).toBeCloseTo(0, 5);
  });

  it('finds a tangential touch, where Newton has nothing to converge to', () => {
    const hits = bezierBezier(arch, inverted);

    expect(hits).toHaveLength(1);
    expect(distance(hits[0]!, { x: 5, y: 7.5 })).toBeLessThan(1e-4);
    expect(hits[0]!.t1).toBeCloseTo(0.5, 3);
  });

  it('finds nothing for curves that stay apart', () => {
    expect(bezierBezier(arch, { ...arch, p0: { x: 0, y: 100 }, p3: { x: 10, y: 100 }, p1: { x: 0, y: 110 }, p2: { x: 10, y: 110 } }))
      .toEqual([]);
  });

  it('returns nothing for curves that overlap along a span', () => {
    // Identical curves share every point, so there is no list of points.
    expect(bezierBezier(arch, arch)).toEqual([]);
    // And a sub-span of the same curve is the same situation.
    const [half] = splitCubic(arch, 0.5);
    expect(bezierBezier(arch, half)).toEqual([]);
  });

  it('rejects a near miss the bounding boxes cannot separate', () => {
    // The touching pair, pulled 1e-4 apart and then turned 45°. The rotation is
    // the point: axis-aligned, the two boxes around the contact are flat and the
    // gap culls them outright, so nothing reaches the refinement. Turned, the
    // boxes are square, overlap despite the gap, and the candidates survive as
    // far as the residual test -- which is what has to reject them.
    const lifted: CubicBezier = {
      p0: { x: 0, y: 15.0001 },
      p1: { x: 0, y: 5.0001 },
      p2: { x: 10, y: 5.0001 },
      p3: { x: 10, y: 15.0001 },
    };
    const turn = (curve: CubicBezier): CubicBezier => {
      const cos = Math.SQRT1_2;
      const sin = Math.SQRT1_2;
      const spin = (p: Point) => ({ x: cos * p.x - sin * p.y, y: sin * p.x + cos * p.y });
      return { p0: spin(curve.p0), p1: spin(curve.p1), p2: spin(curve.p2), p3: spin(curve.p3) };
    };

    expect(bezierBezier(arch, lifted)).toEqual([]);
    expect(bezierBezier(turn(arch), turn(lifted))).toEqual([]);
    // The same pair actually touching, to show the rotation did not simply
    // move the curves out of each other's way.
    expect(bezierBezier(turn(arch), turn(inverted))).toHaveLength(1);
  });

  it('handles a curve that has collapsed to a single point', () => {
    // A zero-length segment, which generated path data produces all the time.
    const dot: CubicBezier = {
      p0: { x: 5, y: 7.5 },
      p1: { x: 5, y: 7.5 },
      p2: { x: 5, y: 7.5 },
      p3: { x: 5, y: 7.5 },
    };
    const hits = bezierBezier(arch, dot);

    expect(hits).toHaveLength(1);
    expect(distance(hits[0]!, { x: 5, y: 7.5 })).toBeLessThan(1e-6);
    expect(bezierBezier(arch, { ...dot, p0: { x: 5, y: 20 }, p1: { x: 5, y: 20 }, p2: { x: 5, y: 20 }, p3: { x: 5, y: 20 } }))
      .toEqual([]);
  });

  it('handles two collapsed curves, where neither has a tangent to work with', () => {
    // Both Jacobian columns vanish, so the refinement has no direction to move
    // in and has to fall back on the residual it already has.
    const dot = (x: number, y: number): CubicBezier => ({
      p0: { x, y }, p1: { x, y }, p2: { x, y }, p3: { x, y },
    });
    expect(bezierBezier(dot(3, 4), dot(3, 4))).toHaveLength(1);

    const hits = bezierBezier(dot(3, 4), dot(3 + 1e-12, 4));
    expect(hits).toHaveLength(1);
    expect(distance(hits[0]!, { x: 3, y: 4 })).toBeLessThan(1e-9);
  });

  it('returns nothing for degenerate input', () => {
    expect(bezierBezier({ ...arch, p1: { x: Number.NaN, y: 0 } }, inverted)).toEqual([]);
    expect(bezierBezier(arch, { ...inverted, p3: { x: 0, y: Infinity } })).toEqual([]);
  });

  it('agrees with a flattened-polyline oracle across a randomized sweep', () => {
    const random = randomSource(60606);
    let total = 0;

    for (let i = 0; i < 60; i++) {
      const first = randomCubic(random, 5);
      const second = randomCubic(random, 5);
      const hits = bezierBezier(first, second);
      expect(hits.length).toBeLessThanOrEqual(9);

      for (const hit of hits) {
        total++;
        expectOnCubic(hit, hit.t1, first, 1e-6);
        expectOnCubic(hit, hit.t2, second, 1e-6);
      }

      // Every crossing the polyline sees must have a solver hit near it.
      for (const crossing of polylineCrossings(first, second)) {
        const nearest = hits.length === 0
          ? Infinity
          : Math.min(...hits.map((hit) => distance(hit, crossing)));
        expect(nearest).toBeLessThan(0.05);
      }
    }
    expect(total).toBeGreaterThan(20);
  });
});
