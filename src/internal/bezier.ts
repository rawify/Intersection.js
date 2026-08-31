import type { CubicBezier, Point, QuadraticBezier } from '../types.js';
import { isFinitePoint } from './eps.js';

/** Power-basis coefficients of a cubic Bezier, descending, per axis. */
export interface CubicCoefficients {
  readonly x: [number, number, number, number];
  readonly y: [number, number, number, number];
}

/**
 * Rewrites the Bernstein form as `A t^3 + B t^2 + C t + D` per axis.
 *
 * Every curve routine works from this: substituting these two cubics into a
 * shape's implicit equation is what turns an intersection problem into a
 * polynomial one.
 */
export function cubicCoefficients(curve: CubicBezier): CubicCoefficients {
  const { p0, p1, p2, p3 } = curve;
  return {
    x: [
      3 * (p1.x - p2.x) + p3.x - p0.x,
      3 * (p0.x - 2 * p1.x + p2.x),
      3 * (p1.x - p0.x),
      p0.x,
    ],
    y: [
      3 * (p1.y - p2.y) + p3.y - p0.y,
      3 * (p0.y - 2 * p1.y + p2.y),
      3 * (p1.y - p0.y),
      p0.y,
    ],
  };
}

/** Point on the curve at `t`, by de Casteljau (stable at the endpoints). */
export function cubicPointAt(curve: CubicBezier, t: number): Point {
  const { p0, p1, p2, p3 } = curve;
  const u = 1 - t;

  const ax = u * p0.x + t * p1.x;
  const ay = u * p0.y + t * p1.y;
  const bx = u * p1.x + t * p2.x;
  const by = u * p1.y + t * p2.y;
  const cx = u * p2.x + t * p3.x;
  const cy = u * p2.y + t * p3.y;

  const dx = u * ax + t * bx;
  const dy = u * ay + t * by;
  const ex = u * bx + t * cx;
  const ey = u * by + t * cy;

  return { x: u * dx + t * ex, y: u * dy + t * ey };
}

/** Tangent vector at `t`. Zero-length where the curve has a cusp. */
export function cubicTangentAt(curve: CubicBezier, t: number): Point {
  const { p0, p1, p2, p3 } = curve;
  const u = 1 - t;
  const d0x = 3 * (p1.x - p0.x);
  const d0y = 3 * (p1.y - p0.y);
  const d1x = 3 * (p2.x - p1.x);
  const d1y = 3 * (p2.y - p1.y);
  const d2x = 3 * (p3.x - p2.x);
  const d2y = 3 * (p3.y - p2.y);

  return {
    x: u * u * d0x + 2 * u * t * d1x + t * t * d2x,
    y: u * u * d0y + 2 * u * t * d1y + t * t * d2y,
  };
}

/** de Casteljau split at `t` into the `[0, t]` and `[t, 1]` halves. */
export function splitCubic(curve: CubicBezier, t: number): [CubicBezier, CubicBezier] {
  const { p0, p1, p2, p3 } = curve;
  const lerp = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  const q0 = lerp(p0, p1);
  const q1 = lerp(p1, p2);
  const q2 = lerp(p2, p3);
  const r0 = lerp(q0, q1);
  const r1 = lerp(q1, q2);
  const s = lerp(r0, r1);

  return [
    { p0, p1: q0, p2: r0, p3: s },
    { p0: s, p1: r1, p2: q2, p3 },
  ];
}

/** The four control points, in order. */
export function cubicControlPoints(curve: CubicBezier): [Point, Point, Point, Point] {
  return [curve.p0, curve.p1, curve.p2, curve.p3];
}

/**
 * Raises a quadratic Bezier to the cubic that traces the identical path.
 *
 * Degree elevation is exact, so nothing is approximated by going through the
 * cubic routines.
 */
export function quadraticToCubic(curve: QuadraticBezier): CubicBezier {
  const { p0, p1, p2 } = curve;
  return {
    p0,
    p1: { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) },
    p2: { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) },
    p3: p2,
  };
}

export function isFiniteCubic(curve: CubicBezier): boolean {
  return isFinitePoint(curve.p0)
    && isFinitePoint(curve.p1)
    && isFinitePoint(curve.p2)
    && isFinitePoint(curve.p3);
}
