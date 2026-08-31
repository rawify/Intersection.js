import { describe, expect, it } from 'vitest';
import type { Circle, Ellipse } from '../src/types.js';
import { ellipseEllipse } from '../src/ellipse-ellipse.js';
import { circleCircle } from '../src/circle-circle.js';
import { circleToEllipse, conicAt, ellipseToConic } from '../src/internal/ellipse.js';
import {
  distance,
  ellipseResidual,
  expectOnEllipse,
  randomSource,
  uniform,
} from './test-utils.js';

const unit: Ellipse = { x: 0, y: 0, rx: 1, ry: 1 };

function randomEllipse(random: () => number): Ellipse {
  return {
    x: uniform(random, -3, 3),
    y: uniform(random, -3, 3),
    rx: uniform(random, 0.4, 4),
    ry: uniform(random, 0.4, 4),
    phi: uniform(random, 0, Math.PI),
  };
}

describe('ellipseEllipse', () => {
  it('finds all four points of a circle crossing a flatter ellipse', () => {
    const hits = ellipseEllipse({ x: 0, y: 0, rx: 2, ry: 2 }, { x: 0, y: 0, rx: 3, ry: 1 });

    expect(hits).toHaveLength(4);
    for (const hit of hits) {
      expect(Math.abs(hit.x)).toBeCloseTo(Math.sqrt(27 / 8), 9);
      expect(Math.abs(hit.y)).toBeCloseTo(Math.sqrt(0.625), 9);
    }
  });

  it('finds the point the half-angle substitution cannot represent', () => {
    // Both circles pass through (-1, 0), which is θ = π on the first one --
    // exactly the angle u = tan(θ/2) sends to infinity.
    const hits = ellipseEllipse(unit, { x: -1, y: 1, rx: 1, ry: 1 });

    expect(hits).toHaveLength(2);
    const leftmost = hits.find((hit) => hit.x < -0.5);
    expect(leftmost).toBeDefined();
    expect(distance(leftmost!, { x: -1, y: 0 })).toBeLessThan(1e-9);
    expect(leftmost!.t1).toBeCloseTo(Math.PI, 9);
  });

  it('reports a tangency at that same angle once', () => {
    const hits = ellipseEllipse(unit, { x: -2, y: 0, rx: 1, ry: 0.5 });

    expect(hits).toHaveLength(1);
    expect(distance(hits[0]!, { x: -1, y: 0 })).toBeLessThan(1e-7);
  });

  it('reports an ordinary tangency once', () => {
    const hits = ellipseEllipse(unit, { x: 3, y: 0, rx: 2, ry: 2 });
    expect(hits).toHaveLength(1);
    expect(distance(hits[0]!, { x: 1, y: 0 })).toBeLessThan(1e-7);
  });

  it('finds nothing for coincident ellipses', () => {
    expect(ellipseEllipse(unit, unit)).toEqual([]);
    const rotated: Ellipse = { x: 1, y: 2, rx: 4, ry: 2, phi: 0.6 };
    expect(ellipseEllipse(rotated, { ...rotated })).toEqual([]);
    // Same curve, described half a turn along: still one shape, not four points.
    expect(ellipseEllipse(rotated, { ...rotated, phi: 0.6 + Math.PI })).toEqual([]);
  });

  it('finds nothing when they miss each other or one is nested', () => {
    expect(ellipseEllipse(unit, { x: 10, y: 0, rx: 1, ry: 1 })).toEqual([]);
    expect(ellipseEllipse({ x: 0, y: 0, rx: 9, ry: 9 }, { x: 0, y: 0, rx: 1, ry: 2 })).toEqual([]);
  });

  it('finds nothing for degenerate input', () => {
    expect(ellipseEllipse(unit, { x: 0, y: 0, rx: 0, ry: 1 })).toEqual([]);
    expect(ellipseEllipse({ x: 0, y: 0, rx: 1, ry: Number.NaN }, unit)).toEqual([]);
  });

  it('agrees with the closed-form circle solver on random circle pairs', () => {
    const random = randomSource(1234);
    let compared = 0;

    for (let i = 0; i < 300; i++) {
      const a: Circle = {
        x: uniform(random, -4, 4),
        y: uniform(random, -4, 4),
        r: uniform(random, 0.3, 4),
      };
      const b: Circle = {
        x: uniform(random, -4, 4),
        y: uniform(random, -4, 4),
        r: uniform(random, 0.3, 4),
      };

      const viaCircles = circleCircle(a, b);
      const viaQuartic = ellipseEllipse(circleToEllipse(a), circleToEllipse(b));
      expect(viaQuartic).toHaveLength(viaCircles.length);

      for (const hit of viaCircles) {
        compared++;
        const nearest = Math.min(...viaQuartic.map((other) => distance(hit, other)));
        expect(nearest).toBeLessThan(1e-7);
      }
    }
    expect(compared).toBeGreaterThan(100);
  });

  it('keeps every invariant across a randomized sweep of rotated ellipses', () => {
    const random = randomSource(24680);
    let total = 0;

    for (let i = 0; i < 400; i++) {
      const a = randomEllipse(random);
      const b = randomEllipse(random);
      const hits = ellipseEllipse(a, b);
      expect(hits.length).toBeLessThanOrEqual(4);

      for (const hit of hits) {
        total++;
        expectOnEllipse(hit, hit.t1, a, 1e-6);
        expectOnEllipse(hit, hit.t2, b, 1e-6);
      }

      // Independent count: sign changes of b's conic sampled along a.
      const conic = ellipseToConic(b);
      const toWorld = (theta: number) => ({
        x: a.x + a.rx * Math.cos(a.phi!) * Math.cos(theta) - a.ry * Math.sin(a.phi!) * Math.sin(theta),
        y: a.y + a.rx * Math.sin(a.phi!) * Math.cos(theta) + a.ry * Math.cos(a.phi!) * Math.sin(theta),
      });
      let changes = 0;
      let previous = conicAt(conic, toWorld(0));
      for (let k = 1; k <= 4000; k++) {
        const value = conicAt(conic, toWorld((k / 4000) * 2 * Math.PI));
        if (Math.sign(value) !== Math.sign(previous)) changes++;
        previous = value;
      }
      expect(hits.length).toBeGreaterThanOrEqual(changes);
    }
    expect(total).toBeGreaterThan(200);
  });

  it('holds up for ellipses far from the origin', () => {
    const a: Ellipse = { x: 1e6, y: -1e6, rx: 500, ry: 200, phi: 0.3 };
    const b: Ellipse = { x: 1e6 + 300, y: -1e6, rx: 400, ry: 400 };
    const hits = ellipseEllipse(a, b);

    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(ellipseResidual(hit, a)).toBeLessThan(1e-4);
      expect(ellipseResidual(hit, b)).toBeLessThan(1e-4);
    }
  });
});
