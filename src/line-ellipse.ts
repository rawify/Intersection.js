import type { Ellipse, Intersection, Point } from './types.js';
import { PARAM_EPS, between01, clamp01, isFinitePoint } from './internal/eps.js';
import { boundsOfEllipse, boundsOfSegment, boundsOverlap } from './bounds.js';
import { applyAffine, isValidEllipse, worldToUnit } from './internal/ellipse.js';
import { normalizeAngle } from './internal/angle.js';
import { intersection } from './internal/result.js';
import { unitCircleSegmentParams } from './internal/unit-circle.js';

/**
 * Intersections of the segment `a → b` with a full ellipse, rotated or not.
 * See `lineArc` to restrict the result to a sweep.
 *
 * `t2` is the ellipse's *parametric* angle, the one `ellipsePointAt` consumes --
 * for `rx !== ry` that is not the polar angle of the point.
 *
 * Derivation: https://raw.org/math/computer-graphics/line-segment-ellipse-intersection/
 */
export function lineEllipse(a: Point, b: Point, ellipse: Ellipse): Intersection[] {
  if (!isFinitePoint(a) || !isFinitePoint(b) || !isValidEllipse(ellipse)) return [];
  if (!boundsOverlap(boundsOfSegment(a, b), boundsOfEllipse(ellipse))) return [];

  const toUnit = worldToUnit(ellipse);
  const ua = applyAffine(toUnit, a);
  const ub = applyAffine(toUnit, b);

  const results: Intersection[] = [];
  for (const root of unitCircleSegmentParams(ua, ub)) {
    if (!between01(root, PARAM_EPS)) continue;

    const t = clamp01(root);
    const ux = ua.x + t * (ub.x - ua.x);
    const uy = ua.y + t * (ub.y - ua.y);

    results.push(intersection(
      { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) },
      t,
      normalizeAngle(Math.atan2(uy, ux)),
    ));
  }
  return results;
}
