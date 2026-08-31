import type { Circle, Intersection, Point } from './types.js';
import { PARAM_EPS, between01, clamp01, isFinitePoint } from './internal/eps.js';
import { boundsOfCircle, boundsOfSegment, boundsOverlap } from './bounds.js';
import { isValidCircle } from './internal/ellipse.js';
import { normalizeAngle } from './internal/angle.js';
import { intersection } from './internal/result.js';
import { unitCircleSegmentParams } from './internal/unit-circle.js';

/**
 * Intersections of the segment `a → b` with a circle.
 *
 * Zero, one (tangent) or two points, ordered along the segment. `t2` is the
 * angle of the point as seen from the center, in `[0, 2π)`.
 *
 * A non-positive or non-finite radius yields no intersections.
 */
export function lineCircle(a: Point, b: Point, circle: Circle): Intersection[] {
  if (!isFinitePoint(a) || !isFinitePoint(b) || !isValidCircle(circle)) return [];
  if (!boundsOverlap(boundsOfSegment(a, b), boundsOfCircle(circle))) return [];

  // Into the unit circle's frame. Uniform scaling keeps the segment parameter,
  // so the roots need no correction on the way back.
  const ua = { x: (a.x - circle.x) / circle.r, y: (a.y - circle.y) / circle.r };
  const ub = { x: (b.x - circle.x) / circle.r, y: (b.y - circle.y) / circle.r };

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
