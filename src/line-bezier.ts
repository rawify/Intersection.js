import type { CubicBezier, Intersection, Point } from './types.js';
import { PARAM_EPS, between01, clamp01, isFinitePoint } from './internal/eps.js';
import { boundsOfCubicHull, boundsOfSegment, boundsOverlap } from './bounds.js';
import { cubicCoefficients, cubicPointAt, isFiniteCubic } from './internal/bezier.js';
import { cubicRoots } from './internal/poly.js';
import { finalize, intersection } from './internal/result.js';

/**
 * Intersections of the segment `a → b` with a cubic Bezier: up to three points,
 * ordered along the curve.
 *
 * Substituting the curve's two coordinate polynomials into the line's implicit
 * form `n·p = n·a` collapses the problem to one cubic in `t`, which is solved
 * in closed form -- no subdivision, no tolerance to tune.
 *
 * The root only says the curve crosses the *infinite* line, so each hit is then
 * projected back onto the segment and rejected unless it lands within it. That
 * projection is `t2`.
 *
 * Pass a quadratic through `quadraticToCubic` first; degree elevation is exact.
 *
 * Derivation: https://raw.org/book/computer-graphics/line-segment-bezier-curve-intersection/
 */
export function lineBezier(a: Point, b: Point, curve: CubicBezier): Intersection[] {
  if (!isFinitePoint(a) || !isFinitePoint(b) || !isFiniteCubic(curve)) return [];

  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const lengthSquared = ux * ux + uy * uy;
  if (lengthSquared === 0) return [];

  if (!boundsOverlap(boundsOfSegment(a, b), boundsOfCubicHull(curve))) return [];

  // Normal of the line, and its offset: the line is `n·p - d = 0`.
  const nx = uy;
  const ny = -ux;
  const d = a.x * nx + a.y * ny;

  const { x, y } = cubicCoefficients(curve);
  const roots = cubicRoots(
    nx * x[0] + ny * y[0],
    nx * x[1] + ny * y[1],
    nx * x[2] + ny * y[2],
    nx * x[3] + ny * y[3] - d,
  );

  const results: Intersection[] = [];
  for (const root of roots) {
    if (!between01(root, PARAM_EPS)) continue;

    const t = clamp01(root);
    const p = cubicPointAt(curve, t);
    const s = ((p.x - a.x) * ux + (p.y - a.y) * uy) / lengthSquared;
    if (!between01(s, PARAM_EPS)) continue;

    results.push(intersection(p, t, clamp01(s)));
  }
  return finalize(results);
}
