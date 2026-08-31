import { describe, expect, it } from 'vitest';
import type { Arc } from '../src/types.js';
import { arcArc } from '../src/arc-arc.js';
import { TAU } from '../src/internal/eps.js';
import { distance, expectOnEllipse } from './test-utils.js';

/** The unit circle at the origin, as an arc over the given sweep. */
function unitArc(alpha: number, beta: number): Arc {
  return { x: 0, y: 0, rx: 1, ry: 1, alpha, beta };
}

/** The unit circle at (1, 0), which meets the one above at (½, ±√3/2). */
function shiftedArc(alpha: number, beta: number): Arc {
  return { x: 1, y: 0, rx: 1, ry: 1, alpha, beta };
}

describe('arcArc', () => {
  it('keeps only the crossing both sweeps contain', () => {
    const hits = arcArc(unitArc(0, Math.PI), shiftedArc(0, Math.PI));

    expect(hits).toHaveLength(1);
    expect(distance(hits[0]!, { x: 0.5, y: Math.sqrt(3) / 2 })).toBeLessThan(1e-9);
    expect(hits[0]!.t1).toBeCloseTo(Math.PI / 3, 9);
    expect(hits[0]!.t2).toBeCloseTo((2 * Math.PI) / 3, 9);
  });

  it('finds nothing when the sweeps are on opposite sides', () => {
    expect(arcArc(unitArc(Math.PI, TAU), shiftedArc(0, Math.PI))).toEqual([]);
  });

  it('finds both crossings when both sweeps are complete', () => {
    const hits = arcArc(unitArc(0, 0), shiftedArc(0, 0));

    expect(hits).toHaveLength(2);
    expect(hits.map((hit) => Number(hit.x.toFixed(9)))).toEqual([0.5, 0.5]);
  });

  it('honours a sweep that wraps past zero', () => {
    // The lower crossing sits at -π/3 on the first circle, inside a sweep that
    // runs from -π/2 up through zero to π/6.
    const hits = arcArc(unitArc(-Math.PI / 2, Math.PI / 6), shiftedArc(0, 0));

    expect(hits).toHaveLength(1);
    expect(hits[0]!.y).toBeCloseTo(-Math.sqrt(3) / 2, 9);
  });

  it('works on rotated elliptical arcs', () => {
    const first: Arc = { x: 0, y: 0, rx: 4, ry: 1.5, phi: 0.5, alpha: 0, beta: Math.PI };
    const second: Arc = { x: 1, y: 1, rx: 3, ry: 2, phi: -0.3, alpha: 0, beta: TAU };

    const whole = arcArc({ ...first, alpha: 0, beta: 0 }, second);
    const half = arcArc(first, second);

    expect(whole.length).toBeGreaterThan(half.length);
    for (const hit of half) {
      expectOnEllipse(hit, hit.t1, first, 1e-7);
      expectOnEllipse(hit, hit.t2, second, 1e-7);
      expect(hit.t1).toBeLessThanOrEqual(Math.PI);
    }
  });

  it('finds nothing for degenerate arcs', () => {
    expect(arcArc({ ...unitArc(0, Math.PI), rx: 0 }, shiftedArc(0, Math.PI))).toEqual([]);
  });
});
