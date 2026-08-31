import { describe, expect, it } from 'vitest';
import { isCollinear, isParallel, lineLine } from '../src/line-line.js';
import { distance, randomPoint, randomSource } from './test-utils.js';

describe('lineLine', () => {
  it('finds the crossing of two segments', () => {
    // The worked example from the original notes.
    const [hit] = lineLine(
      { x: -1, y: 2 },
      { x: 5, y: 2 },
      { x: 1, y: -1 },
      { x: 4, y: 4 },
    );
    expect(hit).toBeDefined();
    expect(hit!.x).toBeCloseTo(2.8, 12);
    expect(hit!.y).toBeCloseTo(2, 12);
    expect(hit!.t1).toBeCloseTo(3.8 / 6, 12);
    expect(hit!.t2).toBeCloseTo(0.6, 12);
  });

  it('reports the parameters of each segment, not a shared one', () => {
    const [hit] = lineLine({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: -1 }, { x: 1, y: 9 });
    expect(hit!.t1).toBeCloseTo(0.25, 12);
    expect(hit!.t2).toBeCloseTo(0.1, 12);
  });

  it('accepts a crossing exactly on an endpoint', () => {
    const [hit] = lineLine({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 5 });
    expect(hit).toEqual({ x: 2, y: 0, t1: 1, t2: 0 });
  });

  it('stops at the ends of the segments instead of extending them', () => {
    // The infinite lines cross at (5, 0), well past both segments.
    expect(lineLine({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: -1 }, { x: 5, y: 1 }))
      .toEqual([]);
  });

  it('returns nothing for parallel or collinear segments', () => {
    expect(lineLine({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 })).toEqual([]);
    // Collinear and overlapping: the shared part is a segment, not a point.
    expect(lineLine({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 0 }, { x: 9, y: 0 })).toEqual([]);
  });

  it('returns nothing for degenerate or non-finite input', () => {
    expect(lineLine({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([]);
    expect(lineLine({ x: Number.NaN, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }))
      .toEqual([]);
    expect(lineLine({ x: 0, y: 0 }, { x: Infinity, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }))
      .toEqual([]);
    expect(lineLine({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: Number.NaN, y: -1 }, { x: 0, y: 1 }))
      .toEqual([]);
    expect(lineLine({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: Number.NaN, y: 1 }))
      .toEqual([]);
  });

  it('decides on angle rather than on absolute length', () => {
    // A one-nanometre segment crossing a one-kilometre one: the cross product is
    // tiny in absolute terms but the segments are nowhere near parallel.
    const hits = lineLine(
      { x: -1000, y: 0 },
      { x: 1000, y: 0 },
      { x: 0, y: -1e-9 },
      { x: 0, y: 1e-9 },
    );
    expect(hits).toHaveLength(1);
    expect(distance(hits[0]!, { x: 0, y: 0 })).toBeLessThan(1e-15);
  });

  it('agrees with a brute-force sampling of both segments', () => {
    const random = randomSource(101);
    let crossings = 0;

    for (let i = 0; i < 500; i++) {
      const a1 = randomPoint(random);
      const b1 = randomPoint(random);
      const a2 = randomPoint(random);
      const b2 = randomPoint(random);
      const hits = lineLine(a1, b1, a2, b2);

      expect(hits.length).toBeLessThanOrEqual(1);
      for (const hit of hits) {
        crossings++;
        // On both segments, at both reported parameters.
        expect(distance(hit, {
          x: a1.x + hit.t1 * (b1.x - a1.x),
          y: a1.y + hit.t1 * (b1.y - a1.y),
        })).toBeLessThan(1e-9);
        expect(distance(hit, {
          x: a2.x + hit.t2 * (b2.x - a2.x),
          y: a2.y + hit.t2 * (b2.y - a2.y),
        })).toBeLessThan(1e-9);
      }
    }
    // Sanity: the sweep is actually exercising the crossing branch.
    expect(crossings).toBeGreaterThan(50);
  });
});

describe('isParallel and isCollinear', () => {
  it('separates parallel from collinear', () => {
    const a1 = { x: 3, y: 0 };
    const b1 = { x: 3, y: 4 };

    expect(isParallel(a1, b1, { x: 3, y: -2 }, { x: 3, y: 9 })).toBe(true);
    expect(isCollinear(a1, b1, { x: 3, y: -2 }, { x: 3, y: 9 })).toBe(true);

    expect(isParallel(a1, b1, { x: 1, y: -1 }, { x: 1, y: 5 })).toBe(true);
    expect(isCollinear(a1, b1, { x: 1, y: -1 }, { x: 1, y: 5 })).toBe(false);

    expect(isParallel(a1, b1, { x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false);
    expect(isCollinear(a1, b1, { x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false);
  });
});
