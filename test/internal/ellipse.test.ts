import { describe, expect, it } from 'vitest';
import type { Ellipse } from '../../src/types.js';
import {
  UNIT_CIRCLE_CONIC,
  applyAffine,
  circleToEllipse,
  conicAt,
  ellipseAngleAt,
  ellipsePhi,
  ellipsePointAt,
  ellipseToConic,
  invertAffine,
  isValidCircle,
  isValidEllipse,
  normalizeConic,
  transformConic,
  unitToWorld,
  worldToUnit,
} from '../../src/internal/ellipse.js';
import {
  angleDelta,
  distance,
  randomPoint,
  randomSource,
  uniform,
} from '../test-utils.js';

const rotated: Ellipse = { x: 3, y: -2, rx: 5, ry: 2, phi: 0.7 };

describe('validation', () => {
  it('defaults the rotation to zero', () => {
    expect(ellipsePhi({ x: 0, y: 0, rx: 1, ry: 1 })).toBe(0);
    expect(ellipsePhi(rotated)).toBe(0.7);
  });

  it('rejects degenerate ellipses rather than emitting NaN later', () => {
    expect(isValidEllipse(rotated)).toBe(true);
    expect(isValidEllipse({ x: 0, y: 0, rx: 0, ry: 1 })).toBe(false);
    expect(isValidEllipse({ x: 0, y: 0, rx: 1, ry: -1 })).toBe(false);
    expect(isValidEllipse({ x: Number.NaN, y: 0, rx: 1, ry: 1 })).toBe(false);
    expect(isValidEllipse({ x: 0, y: Infinity, rx: 1, ry: 1 })).toBe(false);
    expect(isValidEllipse({ x: 0, y: 0, rx: Infinity, ry: 1 })).toBe(false);
    expect(isValidEllipse({ x: 0, y: 0, rx: 1, ry: Number.NaN })).toBe(false);
    expect(isValidEllipse({ x: 0, y: 0, rx: 1, ry: 1, phi: Number.NaN })).toBe(false);
  });

  it('rejects degenerate circles', () => {
    expect(isValidCircle({ x: 0, y: 0, r: 2 })).toBe(true);
    expect(isValidCircle({ x: 0, y: 0, r: 0 })).toBe(false);
    expect(isValidCircle({ x: 0, y: 0, r: -1 })).toBe(false);
    expect(isValidCircle({ x: Number.NaN, y: 0, r: 1 })).toBe(false);
    expect(isValidCircle({ x: 0, y: Number.NaN, r: 1 })).toBe(false);
    expect(isValidCircle({ x: 0, y: 0, r: Infinity })).toBe(false);
  });

  it('widens a circle into an ellipse', () => {
    expect(circleToEllipse({ x: 1, y: 2, r: 3 }))
      .toEqual({ x: 1, y: 2, rx: 3, ry: 3, phi: 0 });
  });
});

describe('affine maps', () => {
  it('round-trips through its inverse', () => {
    const random = randomSource(23);

    for (let i = 0; i < 100; i++) {
      const m = {
        a: uniform(random, -3, 3),
        b: uniform(random, -3, 3),
        c: uniform(random, -3, 3),
        d: uniform(random, -3, 3),
        e: uniform(random, -9, 9),
        f: uniform(random, -9, 9),
      };
      // Skip the near-singular draws: their inverse is meaningless, and the
      // library never builds one (radii are validated as positive first).
      if (Math.abs(m.a * m.d - m.b * m.c) < 0.1) continue;

      const p = randomPoint(random);
      expect(distance(applyAffine(invertAffine(m), applyAffine(m, p)), p)).toBeLessThan(1e-10);
    }
  });

  it('maps the unit circle onto the ellipse and back', () => {
    const toWorld = unitToWorld(rotated);
    const toUnit = worldToUnit(rotated);

    for (let k = 0; k < 12; k++) {
      const theta = (k / 12) * 2 * Math.PI;
      const unit = { x: Math.cos(theta), y: Math.sin(theta) };
      const world = applyAffine(toWorld, unit);

      expect(distance(world, ellipsePointAt(rotated, theta))).toBeLessThan(1e-12);
      expect(distance(applyAffine(toUnit, world), unit)).toBeLessThan(1e-12);
    }
  });
});

describe('ellipseAngleAt', () => {
  it('inverts ellipsePointAt', () => {
    for (let k = 0; k < 24; k++) {
      const theta = (k / 24) * 2 * Math.PI;
      const point = ellipsePointAt(rotated, theta);
      expect(angleDelta(ellipseAngleAt(rotated, point), theta)).toBeLessThan(1e-12);
    }
  });

  it('is the parametric angle, not the polar angle of the point', () => {
    const ellipse: Ellipse = { x: 0, y: 0, rx: 10, ry: 1 };
    const point = ellipsePointAt(ellipse, Math.PI / 4);

    expect(ellipseAngleAt(ellipse, point)).toBeCloseTo(Math.PI / 4, 12);
    // The polar angle is nowhere near it once the ellipse is this eccentric.
    expect(Math.atan2(point.y, point.x)).toBeLessThan(0.2);
  });
});

describe('conics', () => {
  it('vanishes exactly on the ellipse and has a consistent sign either side', () => {
    const conic = ellipseToConic(rotated);

    for (let k = 0; k < 16; k++) {
      const theta = (k / 16) * 2 * Math.PI;
      expect(Math.abs(conicAt(conic, ellipsePointAt(rotated, theta)))).toBeLessThan(1e-12);
    }
    expect(conicAt(conic, { x: rotated.x, y: rotated.y })).toBeLessThan(0);
    expect(conicAt(conic, { x: rotated.x + 100, y: rotated.y })).toBeGreaterThan(0);
  });

  it('pulls a conic back through a map so it vanishes on the preimage', () => {
    const toWorld = unitToWorld(rotated);
    // The world ellipse seen from unit-circle coordinates is the unit circle.
    const pulled = normalizeConic(transformConic(ellipseToConic(rotated), toWorld));
    const expected = normalizeConic(UNIT_CIRCLE_CONIC);

    for (const key of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
      expect(Math.abs(pulled[key] - expected[key])).toBeLessThan(1e-12);
    }
  });

  it('normalizes to a largest coefficient of one, and leaves nothing to scale alone', () => {
    const normalized = normalizeConic({ a: 20, b: -40, c: 10, d: 0, e: 5, f: -1 });
    expect(normalized.b).toBe(-1);
    expect(normalized.a).toBe(0.5);

    const zero = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
    expect(normalizeConic(zero)).toBe(zero);
    const broken = { a: Number.NaN, b: 0, c: 0, d: 0, e: 0, f: 0 };
    expect(normalizeConic(broken)).toBe(broken);
  });
});
