import { describe, expect, it } from 'vitest';
import type { Circle } from '../src/types.js';
import { circleCircle } from '../src/circle-circle.js';
import {
  circleResidual,
  expectOnCircle,
  randomSource,
  uniform,
} from './test-utils.js';

const unit: Circle = { x: 0, y: 0, r: 1 };

describe('circleCircle', () => {
  it('finds both points of two overlapping circles', () => {
    const hits = circleCircle(unit, { x: 1, y: 0, r: 1 });

    expect(hits).toHaveLength(2);
    const ys = hits.map((hit) => hit.y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-Math.sqrt(3) / 2, 12);
    expect(ys[1]).toBeCloseTo(Math.sqrt(3) / 2, 12);
    for (const hit of hits) {
      expect(hit.x).toBeCloseTo(0.5, 12);
      expectOnCircle(hit, hit.t1, unit);
    }
  });

  it('reports the angle on each circle separately', () => {
    const [hit] = circleCircle({ x: 0, y: 0, r: 1 }, { x: 2, y: 0, r: 1 });

    expect(hit).toBeDefined();
    expect(hit!.x).toBeCloseTo(1, 12);
    expect(hit!.t1).toBeCloseTo(0, 9);
    expect(hit!.t2).toBeCloseTo(Math.PI, 9);
  });

  it('folds an external tangency into one point', () => {
    const hits = circleCircle(unit, { x: 3, y: 0, r: 2 });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.x).toBeCloseTo(1, 12);
    expect(hits[0]!.y).toBeCloseTo(0, 12);
  });

  it('folds an internal tangency into one point', () => {
    const hits = circleCircle({ x: 0, y: 0, r: 3 }, { x: 2, y: 0, r: 1 });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.x).toBeCloseTo(3, 12);
  });

  it('finds nothing for circles that are too far apart or nested', () => {
    expect(circleCircle(unit, { x: 5, y: 0, r: 1 })).toEqual([]);
    expect(circleCircle({ x: 0, y: 0, r: 5 }, { x: 0.5, y: 0, r: 1 })).toEqual([]);
  });

  it('finds nothing for concentric circles, identical ones included', () => {
    expect(circleCircle(unit, { x: 0, y: 0, r: 2 })).toEqual([]);
    expect(circleCircle(unit, unit)).toEqual([]);
  });

  it('rejects a false tangency between nearly concentric nested circles', () => {
    expect(circleCircle(unit, { x: 1e-16, y: 0, r: 1 + 1e-13 })).toEqual([]);
  });

  it('preserves two crossings for nearly concentric circles of equal size', () => {
    const hits = circleCircle(unit, { x: 1e-16, y: 0, r: 1 });

    expect(hits).toHaveLength(2);
    expect(hits[0]!.x).toBeCloseTo(5e-17, 25);
    expect(Math.abs(hits[0]!.y)).toBeCloseTo(1, 12);
  });

  it.each([1e-200, 1e200])('avoids square overflow or underflow at scale %g', (scale) => {
    const hits = circleCircle(
      { x: 0, y: 0, r: scale },
      { x: scale, y: 0, r: scale },
    );

    expect(hits).toHaveLength(2);
    for (const hit of hits) {
      expect(Number.isFinite(hit.x)).toBe(true);
      expect(Number.isFinite(hit.y)).toBe(true);
      expect(hit.x / scale).toBeCloseTo(0.5, 12);
      expect(Math.abs(hit.y / scale)).toBeCloseTo(Math.sqrt(3) / 2, 12);
    }
  });

  it('finds nothing for a degenerate radius', () => {
    expect(circleCircle(unit, { x: 1, y: 0, r: 0 })).toEqual([]);
    expect(circleCircle({ x: 0, y: 0, r: -1 }, { x: 1, y: 0, r: 1 })).toEqual([]);
  });

  it('holds up for circles that are huge and barely overlapping', () => {
    const a: Circle = { x: 0, y: 0, r: 1e6 };
    const b: Circle = { x: 2e6 - 1, y: 0, r: 1e6 };
    const hits = circleCircle(a, b);

    expect(hits).toHaveLength(2);
    for (const hit of hits) {
      expect(circleResidual(hit, a)).toBeLessThan(1e-6);
      expect(circleResidual(hit, b)).toBeLessThan(1e-6);
    }
  });

  it('keeps every invariant across a randomized sweep', () => {
    const random = randomSource(90210);
    let total = 0;

    for (let i = 0; i < 500; i++) {
      const a: Circle = {
        x: uniform(random, -5, 5),
        y: uniform(random, -5, 5),
        r: uniform(random, 0.2, 5),
      };
      const b: Circle = {
        x: uniform(random, -5, 5),
        y: uniform(random, -5, 5),
        r: uniform(random, 0.2, 5),
      };
      const hits = circleCircle(a, b);
      expect(hits.length).toBeLessThanOrEqual(2);

      for (const hit of hits) {
        total++;
        expectOnCircle(hit, hit.t1, a);
        expectOnCircle(hit, hit.t2, b);
      }
    }
    expect(total).toBeGreaterThan(200);
  });
});
