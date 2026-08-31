import { describe, expect, it } from 'vitest';
import type { Circle, CubicBezier, Ellipse } from '../src/types.js';
import { bezierArc, bezierCircle, bezierEllipse } from '../src/bezier-ellipse.js';
import { cubicPointAt } from '../src/internal/bezier.js';
import {
  countSignChanges,
  distance,
  expectOnCircle,
  expectOnCubic,
  expectOnEllipse,
  randomCubic,
  randomSource,
  uniform,
} from './test-utils.js';

const unit: Circle = { x: 0, y: 0, r: 1 };

/** Crosses the unit circle twice, on the way in and on the way out. */
const through: CubicBezier = {
  p0: { x: -3, y: 0 },
  p1: { x: -1, y: 0 },
  p2: { x: 1, y: 0 },
  p3: { x: 3, y: 0 },
};

describe('bezierEllipse', () => {
  it('finds both crossings of a curve passing through a circle', () => {
    const hits = bezierCircle(through, unit);

    expect(hits).toHaveLength(2);
    expect(hits[0]!.x).toBeCloseTo(-1, 9);
    expect(hits[1]!.x).toBeCloseTo(1, 9);
    expect(hits[0]!.t2).toBeCloseTo(Math.PI, 9);
    expect(hits[1]!.t2).toBeCloseTo(0, 9);
    expect(hits[0]!.t1).toBeLessThan(hits[1]!.t1);
  });

  it('finds all six crossings a cubic can have with one circle', () => {
    // Six is the maximum: |P(t) - c|² - r² is a sextic. This configuration
    // weaves in and out three times, with the roots well separated.
    const weaving: CubicBezier = {
      p0: { x: 2.639, y: 1.135 },
      p1: { x: -1.572, y: -1.454 },
      p2: { x: 1.987, y: 3.331 },
      p3: { x: 1.376, y: -0.806 },
    };
    const circle: Circle = { x: 1.012, y: 0.503, r: 0.443 };
    const hits = bezierEllipse(weaving, { x: circle.x, y: circle.y, rx: circle.r, ry: circle.r });

    expect(hits).toHaveLength(6);
    for (const hit of hits) {
      expectOnCubic(hit, hit.t1, weaving);
      expectOnCircle(hit, hit.t2, circle);
    }
    // Strictly increasing along the curve.
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]!.t1).toBeGreaterThan(hits[i - 1]!.t1);
    }
  });

  it('crosses a rotated ellipse', () => {
    const ellipse: Ellipse = { x: 0, y: 0, rx: 3, ry: 1, phi: Math.PI / 3 };
    const hits = bezierEllipse(through, ellipse);

    expect(hits.length).toBeGreaterThanOrEqual(2);
    for (const hit of hits) {
      expectOnCubic(hit, hit.t1, through);
      expectOnEllipse(hit, hit.t2, ellipse, 1e-8);
    }
  });

  it('reports a tangential touch once', () => {
    // The arch peaks at (5, 7.5); a circle sitting on that peak touches it.
    const arch: CubicBezier = {
      p0: { x: 0, y: 0 },
      p1: { x: 0, y: 10 },
      p2: { x: 10, y: 10 },
      p3: { x: 10, y: 0 },
    };
    const hits = bezierCircle(arch, { x: 5, y: 9.5, r: 2 });

    expect(hits).toHaveLength(1);
    expect(hits[0]!.t1).toBeCloseTo(0.5, 5);
    expect(distance(hits[0]!, { x: 5, y: 7.5 })).toBeLessThan(1e-5);
  });

  it('picks up an endpoint that sits exactly on the ellipse', () => {
    const hits = bezierCircle({
      p0: { x: 1, y: 0 },
      p1: { x: 3, y: 1 },
      p2: { x: 4, y: 2 },
      p3: { x: 5, y: 5 },
    }, unit);

    expect(hits).toHaveLength(1);
    // The sextic puts the root at the endpoint to within 1e-30, not exactly on
    // it; the library reports what it computed rather than snapping.
    expect(hits[0]!.t1).toBeCloseTo(0, 12);
    expect(hits[0]!.t2).toBeCloseTo(0, 9);
  });

  it('finds nothing when the curve stays clear of the ellipse', () => {
    expect(bezierCircle(through, { x: 0, y: 20, r: 1 })).toEqual([]);
    // Entirely inside.
    expect(bezierCircle({
      p0: { x: -0.2, y: 0 },
      p1: { x: 0, y: 0.2 },
      p2: { x: 0.2, y: 0 },
      p3: { x: 0, y: -0.2 },
    }, unit)).toEqual([]);
  });

  it('finds nothing for degenerate input', () => {
    expect(bezierCircle(through, { x: 0, y: 0, r: 0 })).toEqual([]);
    expect(bezierCircle(through, { x: 0, y: 0, r: Number.NaN })).toEqual([]);
    expect(bezierEllipse(through, { x: 0, y: 0, rx: 1, ry: -1 })).toEqual([]);
    expect(bezierEllipse({ ...through, p3: { x: Number.NaN, y: 0 } }, { x: 0, y: 0, rx: 1, ry: 1 }))
      .toEqual([]);
  });

  it('matches a brute-force count across a randomized sweep', () => {
    const random = randomSource(80808);
    let total = 0;

    for (let i = 0; i < 300; i++) {
      const curve = randomCubic(random, 4);
      const ellipse: Ellipse = {
        x: uniform(random, -2, 2),
        y: uniform(random, -2, 2),
        rx: uniform(random, 0.5, 3),
        ry: uniform(random, 0.5, 3),
        phi: uniform(random, 0, Math.PI),
      };
      const hits = bezierEllipse(curve, ellipse);
      expect(hits.length).toBeLessThanOrEqual(6);

      for (const hit of hits) {
        total++;
        expectOnCubic(hit, hit.t1, curve, 1e-8);
        expectOnEllipse(hit, hit.t2, ellipse, 1e-7);
      }

      const cos = Math.cos(ellipse.phi!);
      const sin = Math.sin(ellipse.phi!);
      const implicit = (t: number) => {
        const p = cubicPointAt(curve, t);
        const dx = p.x - ellipse.x;
        const dy = p.y - ellipse.y;
        const local = { x: (cos * dx + sin * dy) / ellipse.rx, y: (-sin * dx + cos * dy) / ellipse.ry };
        return local.x * local.x + local.y * local.y - 1;
      };
      expect(hits.length).toBeGreaterThanOrEqual(countSignChanges(implicit, 4000));
    }
    expect(total).toBeGreaterThan(200);
  });
});

describe('bezierArc', () => {
  it('keeps only the crossings inside the sweep', () => {
    const all = bezierCircle(through, unit);
    const right = bezierArc(through, {
      x: 0, y: 0, rx: 1, ry: 1, alpha: -Math.PI / 2, beta: Math.PI / 2,
    });

    expect(all).toHaveLength(2);
    expect(right).toHaveLength(1);
    expect(right[0]!.x).toBeCloseTo(1, 9);
  });
});
