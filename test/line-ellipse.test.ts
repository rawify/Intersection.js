import { describe, expect, it } from 'vitest';
import type { Ellipse } from '../src/types.js';
import { lineEllipse } from '../src/line-ellipse.js';
import {
  expectOnEllipse,
  expectOnSegment,
  randomPoint,
  randomSource,
  uniform,
} from './test-utils.js';

const wide: Ellipse = { x: 0, y: 0, rx: 4, ry: 2 };

describe('lineEllipse', () => {
  it('crosses an axis-aligned ellipse on its major axis', () => {
    const hits = lineEllipse({ x: -9, y: 0 }, { x: 9, y: 0 }, wide);

    expect(hits).toHaveLength(2);
    expect(hits[0]!.x).toBeCloseTo(-4, 12);
    expect(hits[1]!.x).toBeCloseTo(4, 12);
    expect(hits[0]!.t2).toBeCloseTo(Math.PI, 12);
    expect(hits[1]!.t2).toBeCloseTo(0, 12);
  });

  it('crosses it on the minor axis', () => {
    const hits = lineEllipse({ x: 0, y: -9 }, { x: 0, y: 9 }, wide);

    expect(hits).toHaveLength(2);
    expect(hits[0]!.y).toBeCloseTo(-2, 12);
    expect(hits[1]!.y).toBeCloseTo(2, 12);
    expect(hits[0]!.t2).toBeCloseTo(1.5 * Math.PI, 12);
    expect(hits[1]!.t2).toBeCloseTo(0.5 * Math.PI, 12);
  });

  it('rotates: a quarter turn swaps which axis the line meets', () => {
    const upright: Ellipse = { ...wide, phi: Math.PI / 2 };
    const hits = lineEllipse({ x: -9, y: 0 }, { x: 9, y: 0 }, upright);

    expect(hits).toHaveLength(2);
    expect(hits[0]!.x).toBeCloseTo(-2, 12);
    expect(hits[1]!.x).toBeCloseTo(2, 12);
    for (const hit of hits) expectOnEllipse(hit, hit.t2, upright);
  });

  it('reports the parametric angle, which is not the point angle', () => {
    const [hit] = lineEllipse({ x: 0, y: 0 }, { x: 9, y: 9 }, wide);

    expect(hit).toBeDefined();
    expectOnEllipse(hit!, hit!.t2, wide);
    // On the 45° ray the point sits at 45°, but its parameter does not.
    expect(Math.atan2(hit!.y, hit!.x)).toBeCloseTo(Math.PI / 4, 12);
    expect(hit!.t2).toBeGreaterThan(Math.PI / 4 + 0.2);
  });

  it('reports a tangent once', () => {
    const hits = lineEllipse({ x: -9, y: 2 }, { x: 9, y: 2 }, wide);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.y).toBeCloseTo(2, 12);
    expect(hits[0]!.t2).toBeCloseTo(Math.PI / 2, 6);
  });

  it('finds nothing when the segment misses, or stops short of, the ellipse', () => {
    expect(lineEllipse({ x: -9, y: 5 }, { x: 9, y: 5 }, wide)).toEqual([]);
    expect(lineEllipse({ x: -9, y: 0 }, { x: -5, y: 0 }, wide)).toEqual([]);
  });

  it('finds nothing for degenerate input', () => {
    expect(lineEllipse({ x: 1, y: 1 }, { x: 1, y: 1 }, wide)).toEqual([]);
    expect(lineEllipse({ x: -9, y: 0 }, { x: 9, y: 0 }, { x: 0, y: 0, rx: 0, ry: 2 })).toEqual([]);
    expect(lineEllipse({ x: Number.NaN, y: 0 }, { x: 9, y: 0 }, wide)).toEqual([]);
    expect(lineEllipse({ x: 0, y: 0 }, { x: Number.NaN, y: 0 }, wide)).toEqual([]);
  });

  it('keeps every invariant across a randomized sweep of rotated ellipses', () => {
    const random = randomSource(31337);
    let total = 0;

    for (let i = 0; i < 500; i++) {
      const a = randomPoint(random);
      const b = randomPoint(random);
      const ellipse: Ellipse = {
        x: uniform(random, -4, 4),
        y: uniform(random, -4, 4),
        rx: uniform(random, 0.3, 6),
        ry: uniform(random, 0.3, 6),
        phi: uniform(random, 0, Math.PI),
      };
      const hits = lineEllipse(a, b, ellipse);
      expect(hits.length).toBeLessThanOrEqual(2);

      for (const hit of hits) {
        total++;
        expectOnSegment(hit, hit.t1, a, b);
        expectOnEllipse(hit, hit.t2, ellipse, 1e-8);
      }
    }
    expect(total).toBeGreaterThan(100);
  });
});
