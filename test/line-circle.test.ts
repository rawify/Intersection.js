import { describe, expect, it } from 'vitest';
import type { Circle } from '../src/types.js';
import { lineCircle } from '../src/line-circle.js';
import {
  expectOnCircle,
  expectOnSegment,
  randomPoint,
  randomSource,
  uniform,
} from './test-utils.js';

const unit: Circle = { x: 0, y: 0, r: 1 };

describe('lineCircle', () => {
  it('finds both ends of a chord through the center, ordered along the segment', () => {
    const hits = lineCircle({ x: -2, y: 0 }, { x: 2, y: 0 }, unit);

    expect(hits).toHaveLength(2);
    expect(hits[0]!.x).toBeCloseTo(-1, 12);
    expect(hits[1]!.x).toBeCloseTo(1, 12);
    expect(hits[0]!.t1).toBeCloseTo(0.25, 12);
    expect(hits[1]!.t1).toBeCloseTo(0.75, 12);
    // t2 is the angle from the center: π on the left, 0 on the right.
    expect(hits[0]!.t2).toBeCloseTo(Math.PI, 12);
    expect(hits[1]!.t2).toBeCloseTo(0, 12);
  });

  it('reports a tangent as a single point', () => {
    const hits = lineCircle({ x: -2, y: 1 }, { x: 2, y: 1 }, unit);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.x).toBeCloseTo(0, 9);
    expect(hits[0]!.y).toBeCloseTo(1, 12);
    expect(hits[0]!.t2).toBeCloseTo(Math.PI / 2, 6);
  });

  it('finds one crossing when the segment ends inside the circle', () => {
    const hits = lineCircle({ x: -2, y: 0 }, { x: 0, y: 0 }, unit);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.x).toBeCloseTo(-1, 12);
  });

  it('finds nothing for a segment wholly inside, or wholly clear of, the circle', () => {
    expect(lineCircle({ x: -0.5, y: 0 }, { x: 0.5, y: 0 }, unit)).toEqual([]);
    expect(lineCircle({ x: -2, y: 3 }, { x: 2, y: 3 }, unit)).toEqual([]);
  });

  it('finds nothing for degenerate input', () => {
    expect(lineCircle({ x: 0, y: 0 }, { x: 0, y: 0 }, unit)).toEqual([]);
    expect(lineCircle({ x: -2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 0, r: 0 })).toEqual([]);
    expect(lineCircle({ x: -2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 0, r: -1 })).toEqual([]);
    expect(lineCircle({ x: Number.NaN, y: 0 }, { x: 2, y: 0 }, unit)).toEqual([]);
    expect(lineCircle({ x: -2, y: 0 }, { x: Number.NaN, y: 0 }, unit)).toEqual([]);
  });

  it('holds up at coordinates far from the origin', () => {
    const far: Circle = { x: 1e7, y: -1e7, r: 250 };
    const hits = lineCircle({ x: 1e7 - 1000, y: -1e7 }, { x: 1e7 + 1000, y: -1e7 }, far);

    expect(hits).toHaveLength(2);
    for (const hit of hits) expectOnCircle(hit, hit.t2, far, 1e-6);
    expect(hits[0]!.x).toBeCloseTo(1e7 - 250, 6);
    expect(hits[1]!.x).toBeCloseTo(1e7 + 250, 6);
  });

  it('keeps every invariant across a randomized sweep', () => {
    const random = randomSource(4242);
    let total = 0;

    for (let i = 0; i < 500; i++) {
      const a = randomPoint(random);
      const b = randomPoint(random);
      const circle: Circle = {
        x: uniform(random, -5, 5),
        y: uniform(random, -5, 5),
        r: uniform(random, 0.2, 6),
      };
      const hits = lineCircle(a, b, circle);
      expect(hits.length).toBeLessThanOrEqual(2);

      for (const hit of hits) {
        total++;
        expectOnCircle(hit, hit.t2, circle);
        expectOnSegment(hit, hit.t1, a, b);
      }
      // Independent count: sign changes of |p(t) - c|² - r² over the segment.
      const implicit = (t: number) => {
        const x = a.x + t * (b.x - a.x) - circle.x;
        const y = a.y + t * (b.y - a.y) - circle.y;
        return x * x + y * y - circle.r * circle.r;
      };
      let changes = 0;
      let previous = implicit(0);
      for (let k = 1; k <= 2000; k++) {
        const value = implicit(k / 2000);
        if (Math.sign(value) !== Math.sign(previous)) changes++;
        previous = value;
      }
      expect(hits.length).toBeGreaterThanOrEqual(changes);
    }
    expect(total).toBeGreaterThan(100);
  });
});
