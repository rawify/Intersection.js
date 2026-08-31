import { describe, expect, it } from 'vitest';
import type { CubicBezier } from '../src/types.js';
import {
  boundsOfCircle,
  boundsOfCubic,
  boundsOfCubicHull,
  boundsOfEllipse,
  boundsOfPoints,
  boundsOfSegment,
  boundsOverlap,
  rectRect,
} from '../src/bounds.js';
import { cubicPointAt } from '../src/internal/bezier.js';
import { ellipsePointAt } from '../src/internal/ellipse.js';

describe('boundsOfPoints', () => {
  it('spans every point', () => {
    expect(boundsOfPoints([{ x: 1, y: 5 }, { x: -2, y: 0 }, { x: 3, y: 2 }]))
      .toEqual({ minX: -2, minY: 0, maxX: 3, maxY: 5 });
  });

  it('is empty, not zero, for no points at all', () => {
    const bounds = boundsOfPoints([]);
    expect(bounds.minX).toBe(Infinity);
    expect(bounds.maxX).toBe(-Infinity);
    expect(bounds.minY).toBe(Infinity);
    expect(bounds.maxY).toBe(-Infinity);
  });
});

describe('boundsOfSegment', () => {
  it('does not care which end comes first', () => {
    expect(boundsOfSegment({ x: 4, y: 1 }, { x: 0, y: 3 }))
      .toEqual({ minX: 0, minY: 1, maxX: 4, maxY: 3 });
  });
});

describe('boundsOfCubic', () => {
  const curve: CubicBezier = {
    p0: { x: 0, y: 0 },
    p1: { x: 0, y: 10 },
    p2: { x: 10, y: 10 },
    p3: { x: 10, y: 0 },
  };

  it('is tighter than the control hull and still contains the curve', () => {
    const tight = boundsOfCubic(curve);
    const hull = boundsOfCubicHull(curve);

    // The curve only reaches three quarters of the way up to its control points.
    expect(tight.maxY).toBeCloseTo(7.5, 12);
    expect(hull.maxY).toBe(10);
    expect(tight.minX).toBe(0);
    expect(tight.maxX).toBe(10);

    for (let k = 0; k <= 200; k++) {
      const p = cubicPointAt(curve, k / 200);
      expect(p.x).toBeGreaterThanOrEqual(tight.minX - 1e-12);
      expect(p.x).toBeLessThanOrEqual(tight.maxX + 1e-12);
      expect(p.y).toBeGreaterThanOrEqual(tight.minY - 1e-12);
      expect(p.y).toBeLessThanOrEqual(tight.maxY + 1e-12);
    }
  });

  it('reduces to the endpoints for a monotone curve', () => {
    const monotone: CubicBezier = {
      p0: { x: 0, y: 0 },
      p1: { x: 1, y: 1 },
      p2: { x: 2, y: 2 },
      p3: { x: 3, y: 3 },
    };
    expect(boundsOfCubic(monotone)).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 3 });
  });
});

describe('boundsOfCircle and boundsOfEllipse', () => {
  it('boxes a circle', () => {
    expect(boundsOfCircle({ x: 1, y: -1, r: 2 }))
      .toEqual({ minX: -1, minY: -3, maxX: 3, maxY: 1 });
  });

  it('boxes an axis-aligned ellipse exactly', () => {
    const bounds = boundsOfEllipse({ x: 0, y: 0, rx: 4, ry: 2 });
    expect(bounds.minX).toBeCloseTo(-4, 12);
    expect(bounds.maxY).toBeCloseTo(2, 12);
  });

  it('boxes a rotated ellipse without sampling it', () => {
    const ellipse = { x: 2, y: 3, rx: 5, ry: 1, phi: Math.PI / 4 };
    const bounds = boundsOfEllipse(ellipse);

    for (let k = 0; k < 720; k++) {
      const p = ellipsePointAt(ellipse, (k / 720) * 2 * Math.PI);
      expect(p.x).toBeGreaterThanOrEqual(bounds.minX - 1e-12);
      expect(p.x).toBeLessThanOrEqual(bounds.maxX + 1e-12);
      expect(p.y).toBeGreaterThanOrEqual(bounds.minY - 1e-12);
      expect(p.y).toBeLessThanOrEqual(bounds.maxY + 1e-12);
    }
    // Tight: a quarter turn either way touches each edge.
    expect(Math.hypot(bounds.maxX - bounds.minX, 0) / 2).toBeCloseTo(Math.hypot(5 * Math.SQRT1_2, 1 * Math.SQRT1_2), 12);
  });

  it('turns a 90° rotation into swapped radii', () => {
    const bounds = boundsOfEllipse({ x: 0, y: 0, rx: 4, ry: 2, phi: Math.PI / 2 });
    expect(bounds.maxX).toBeCloseTo(2, 12);
    expect(bounds.maxY).toBeCloseTo(4, 12);
  });
});

describe('boundsOverlap', () => {
  const unit = { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  it('detects overlap, touching included', () => {
    expect(boundsOverlap(unit, { minX: 0.5, minY: 0.5, maxX: 2, maxY: 2 })).toBe(true);
    expect(boundsOverlap(unit, { minX: 1, minY: 0, maxX: 2, maxY: 1 })).toBe(true);
  });

  it('rejects a gap on either axis', () => {
    expect(boundsOverlap(unit, { minX: 1.5, minY: 0, maxX: 2, maxY: 1 })).toBe(false);
    expect(boundsOverlap(unit, { minX: 0, minY: 2, maxX: 1, maxY: 3 })).toBe(false);
    expect(boundsOverlap({ minX: 1.5, minY: 0, maxX: 2, maxY: 1 }, unit)).toBe(false);
    expect(boundsOverlap({ minX: 0, minY: 2, maxX: 1, maxY: 3 }, unit)).toBe(false);
  });

  it('honours an explicit tolerance', () => {
    const far = { minX: 1.1, minY: 0, maxX: 2, maxY: 1 };
    expect(boundsOverlap(unit, far, 0)).toBe(false);
    expect(boundsOverlap(unit, far, 0.2)).toBe(true);
  });

  it('scales its default tolerance with the coordinates', () => {
    // Boxes a single ulp apart at 1e12 are touching as far as doubles can tell.
    const left = { minX: 0, minY: 0, maxX: 1e12, maxY: 1 };
    const right = { minX: 1e12 + 1e-4, minY: 0, maxX: 2e12, maxY: 1 };
    expect(boundsOverlap(left, right)).toBe(true);
  });
});

describe('rectRect', () => {
  const rect = { left: 0, top: 0, right: 10, bottom: 10 };

  it('detects overlapping DOM-style rects', () => {
    expect(rectRect(rect, { left: 5, top: 5, right: 15, bottom: 15 })).toBe(true);
    expect(rectRect(rect, { left: 10, top: 10, right: 20, bottom: 20 })).toBe(true);
  });

  it('rejects rects that miss on either axis', () => {
    expect(rectRect(rect, { left: 11, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(rectRect(rect, { left: 0, top: 11, right: 10, bottom: 20 })).toBe(false);
    expect(rectRect({ left: 11, top: 0, right: 20, bottom: 10 }, rect)).toBe(false);
    expect(rectRect({ left: 0, top: 11, right: 10, bottom: 20 }, rect)).toBe(false);
  });
});
