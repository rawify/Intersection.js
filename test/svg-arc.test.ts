import { describe, expect, it } from 'vitest';
import type { Arc } from '../src/types.js';
import { arcFromSvg } from '../src/svg-arc.js';
import { isAngleInArc } from '../src/internal/angle.js';
import { ellipsePointAt } from '../src/internal/ellipse.js';
import { distance, randomPoint, randomSource, uniform } from './test-utils.js';

/** Angular width of the sweep, which `largeArc` is supposed to control. */
function sweepWidth(arc: Arc): number {
  return arc.beta - arc.alpha;
}

describe('arcFromSvg', () => {
  it('converts a quarter circle', () => {
    const arc = arcFromSvg({ x: 1, y: 0 }, 1, 1, 0, false, true, { x: 0, y: 1 });

    expect(arc).not.toBeNull();
    expect(arc!.x).toBeCloseTo(0, 12);
    expect(arc!.y).toBeCloseTo(0, 12);
    expect(arc!.alpha).toBeCloseTo(0, 12);
    expect(arc!.beta).toBeCloseTo(Math.PI / 2, 12);
  });

  it('puts the other centre on the other side when the sweep flag flips', () => {
    const arc = arcFromSvg({ x: 1, y: 0 }, 1, 1, 0, false, false, { x: 0, y: 1 });

    expect(arc!.x).toBeCloseTo(1, 12);
    expect(arc!.y).toBeCloseTo(1, 12);
    expect(distance(ellipsePointAt(arc!, arc!.alpha), { x: 0, y: 1 })).toBeLessThan(1e-12);
    expect(distance(ellipsePointAt(arc!, arc!.beta), { x: 1, y: 0 })).toBeLessThan(1e-12);
  });

  it('takes the long way round when largeArc is set', () => {
    const short = arcFromSvg({ x: 1, y: 0 }, 1, 1, 0, false, true, { x: 0, y: 1 })!;
    const long = arcFromSvg({ x: 1, y: 0 }, 1, 1, 0, true, true, { x: 0, y: 1 })!;

    expect(sweepWidth(short)).toBeLessThan(Math.PI);
    expect(sweepWidth(long)).toBeGreaterThan(Math.PI);
  });

  it('grows radii that cannot reach across the chord', () => {
    // A half-unit radius cannot span endpoints two apart; the spec says scale up
    // until it just does, which makes this a half circle of radius one.
    const arc = arcFromSvg({ x: -1, y: 0 }, 0.5, 0.5, 0, false, true, { x: 1, y: 0 })!;

    expect(arc.rx).toBeCloseTo(1, 12);
    expect(arc.ry).toBeCloseTo(1, 12);
    expect(arc.x).toBeCloseTo(0, 12);
    expect(Math.abs(sweepWidth(arc))).toBeCloseTo(Math.PI, 12);
  });

  it('takes negative radii as their absolute value', () => {
    const negative = arcFromSvg({ x: 1, y: 0 }, -1, -1, 0, false, true, { x: 0, y: 1 })!;
    const positive = arcFromSvg({ x: 1, y: 0 }, 1, 1, 0, false, true, { x: 0, y: 1 })!;
    expect(negative).toEqual(positive);
  });

  it('rejects what the spec says is not an arc', () => {
    // Coincident endpoints: the segment is dropped entirely.
    expect(arcFromSvg({ x: 1, y: 1 }, 2, 2, 0, false, true, { x: 1, y: 1 })).toBeNull();
    // A zero radius: a straight line.
    expect(arcFromSvg({ x: 0, y: 0 }, 0, 2, 0, false, true, { x: 1, y: 1 })).toBeNull();
    expect(arcFromSvg({ x: 0, y: 0 }, 2, 0, 0, false, true, { x: 1, y: 1 })).toBeNull();
    // Non-finite input.
    expect(arcFromSvg({ x: Number.NaN, y: 0 }, 2, 2, 0, false, true, { x: 1, y: 1 })).toBeNull();
    expect(arcFromSvg({ x: 0, y: 0 }, 2, 2, 0, false, true, { x: Infinity, y: 1 })).toBeNull();
    expect(arcFromSvg({ x: 0, y: 0 }, Number.NaN, 2, 0, false, true, { x: 1, y: 1 })).toBeNull();
    expect(arcFromSvg({ x: 0, y: 0 }, 2, Infinity, 0, false, true, { x: 1, y: 1 })).toBeNull();
    expect(arcFromSvg({ x: 0, y: 0 }, 2, 2, Number.NaN, false, true, { x: 1, y: 1 })).toBeNull();
  });

  it('lands on both endpoints for every flag combination, rotated or not', () => {
    const random = randomSource(777);
    let converted = 0;

    for (let i = 0; i < 200; i++) {
      const start = randomPoint(random, 6);
      const end = randomPoint(random, 6);
      const rx = uniform(random, 0.5, 8);
      const ry = uniform(random, 0.5, 8);
      const phi = uniform(random, -Math.PI, Math.PI);

      for (const largeArc of [false, true]) {
        for (const sweep of [false, true]) {
          const arc = arcFromSvg(start, rx, ry, phi, largeArc, sweep, end);
          if (!arc) continue;
          converted++;

          // Both endpoints are on the arc, at its two limits.
          const atAlpha = ellipsePointAt(arc, arc.alpha);
          const atBeta = ellipsePointAt(arc, arc.beta);
          const forward = distance(atAlpha, start) + distance(atBeta, end);
          const backward = distance(atAlpha, end) + distance(atBeta, start);
          expect(Math.min(forward, backward)).toBeLessThan(1e-9);

          expect(isAngleInArc(arc.alpha, arc.alpha, arc.beta)).toBe(true);
          expect(isAngleInArc(arc.beta, arc.alpha, arc.beta)).toBe(true);

          if (arc.rx > rx + 1e-12) {
            // Radii that had to be grown to reach put the endpoints opposite
            // each other, so both flags describe the same half-ellipse and
            // largeArc stops distinguishing anything. Only ~1e-8 of the angle
            // survives here: the centre comes out of a square root whose
            // argument is zero in exactly this configuration, which costs half
            // the available digits. The endpoints themselves stay exact to 1e-9,
            // as asserted above.
            expect(sweepWidth(arc)).toBeCloseTo(Math.PI, 6);
          } else {
            // Otherwise largeArc is exactly the choice of the wider sweep.
            expect(sweepWidth(arc) > Math.PI).toBe(largeArc);
          }
        }
      }
    }
    expect(converted).toBeGreaterThan(500);
  });
});
