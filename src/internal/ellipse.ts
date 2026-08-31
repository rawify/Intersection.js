import type { Circle, Ellipse, Point } from '../types.js';
import { normalizeAngle } from './angle.js';

/**
 * A 2D affine map, laid out like `DOMMatrix`:
 * `x' = a x + c y + e`, `y' = b x + d y + f`.
 */
export interface Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/** `a x² + b xy + c y² + d x + e y + f = 0`. */
export interface Conic {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/** The unit circle as a conic, the seed every ellipse is built from. */
export const UNIT_CIRCLE_CONIC: Conic = { a: 1, b: 0, c: 1, d: 0, e: 0, f: -1 };

export function ellipsePhi(ellipse: Ellipse): number {
  return ellipse.phi ?? 0;
}

/**
 * Radii must be strictly positive and everything finite.
 *
 * A zero radius collapses the ellipse to a segment or a point, at which point
 * the unit-circle map stops being invertible; rather than emit NaN coordinates
 * the entry points return no intersections for such input.
 */
export function isValidEllipse(ellipse: Ellipse): boolean {
  return Number.isFinite(ellipse.x)
    && Number.isFinite(ellipse.y)
    && Number.isFinite(ellipse.rx)
    && Number.isFinite(ellipse.ry)
    && Number.isFinite(ellipsePhi(ellipse))
    && ellipse.rx > 0
    && ellipse.ry > 0;
}

export function isValidCircle(circle: Circle): boolean {
  return Number.isFinite(circle.x)
    && Number.isFinite(circle.y)
    && Number.isFinite(circle.r)
    && circle.r > 0;
}

/** Widens a circle into the equivalent ellipse. */
export function circleToEllipse(circle: Circle): Ellipse {
  return { x: circle.x, y: circle.y, rx: circle.r, ry: circle.r, phi: 0 };
}

export function applyAffine(m: Affine, p: Point): Point {
  return {
    x: m.a * p.x + m.c * p.y + m.e,
    y: m.b * p.x + m.d * p.y + m.f,
  };
}

export function invertAffine(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

/**
 * The map taking unit-circle coordinates to world coordinates:
 * scale by the radii, rotate by `phi`, translate to the center.
 *
 * Its inverse turns any ellipse problem into the corresponding unit-circle
 * problem, which is why nothing in this library needs a rotated-ellipse special
 * case. Affine maps preserve line parameters, tangency and Bezier degree, so
 * the answer maps straight back.
 */
export function unitToWorld(ellipse: Ellipse): Affine {
  const phi = ellipsePhi(ellipse);
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  return {
    a: ellipse.rx * cos,
    b: ellipse.rx * sin,
    c: -ellipse.ry * sin,
    d: ellipse.ry * cos,
    e: ellipse.x,
    f: ellipse.y,
  };
}

export function worldToUnit(ellipse: Ellipse): Affine {
  return invertAffine(unitToWorld(ellipse));
}

/** Point at parametric angle `theta`. */
export function ellipsePointAt(ellipse: Ellipse, theta: number): Point {
  return applyAffine(unitToWorld(ellipse), { x: Math.cos(theta), y: Math.sin(theta) });
}

/**
 * Parametric angle of a point on (or near) the ellipse, in `[0, 2π)`.
 *
 * Note this is the angle in the *unit-circle* frame, not `atan2(y - cy, x - cx)`:
 * for a non-circular ellipse the two differ, and only the former round-trips
 * through `ellipsePointAt`.
 */
export function ellipseAngleAt(ellipse: Ellipse, p: Point): number {
  const local = applyAffine(worldToUnit(ellipse), p);
  return normalizeAngle(Math.atan2(local.y, local.x));
}

/** Evaluates the conic's left-hand side; zero exactly on the curve. */
export function conicAt(q: Conic, p: Point): number {
  return q.a * p.x * p.x
    + q.b * p.x * p.y
    + q.c * p.y * p.y
    + q.d * p.x
    + q.e * p.y
    + q.f;
}

/**
 * Pulls a conic back through an affine map: the returned conic vanishes at `q`
 * exactly where the original vanishes at `m(q)`.
 *
 * Substituting `x = a u + c v + e`, `y = b u + d v + f` into the general conic
 * and collecting terms; the equivalent of `Mᵀ Q M` on the homogeneous matrix,
 * written out to keep this dependency-free.
 */
export function transformConic(q: Conic, m: Affine): Conic {
  const { a, b, c, d, e, f } = m;
  return {
    a: q.a * a * a + q.b * a * b + q.c * b * b,
    b: 2 * q.a * a * c + q.b * (a * d + b * c) + 2 * q.c * b * d,
    c: q.a * c * c + q.b * c * d + q.c * d * d,
    d: 2 * q.a * a * e + q.b * (a * f + b * e) + 2 * q.c * b * f + q.d * a + q.e * b,
    e: 2 * q.a * c * e + q.b * (c * f + d * e) + 2 * q.c * d * f + q.d * c + q.e * d,
    f: q.a * e * e + q.b * e * f + q.c * f * f + q.d * e + q.e * f + q.f,
  };
}

/** The ellipse as an implicit conic in world coordinates. */
export function ellipseToConic(ellipse: Ellipse): Conic {
  return transformConic(UNIT_CIRCLE_CONIC, worldToUnit(ellipse));
}

/** Divides a conic by its largest coefficient so tolerances can be relative. */
export function normalizeConic(q: Conic): Conic {
  const scale = Math.max(
    Math.abs(q.a),
    Math.abs(q.b),
    Math.abs(q.c),
    Math.abs(q.d),
    Math.abs(q.e),
    Math.abs(q.f),
  );
  if (scale === 0 || !Number.isFinite(scale)) return q;

  return {
    a: q.a / scale,
    b: q.b / scale,
    c: q.c / scale,
    d: q.d / scale,
    e: q.e / scale,
    f: q.f / scale,
  };
}
