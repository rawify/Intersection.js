import type { Circle, Intersection } from './types.js';
import { EPS } from './internal/eps.js';
import { isValidCircle } from './internal/ellipse.js';
import { normalizeAngle } from './internal/angle.js';
import { finalize, intersection } from './internal/result.js';

/**
 * Intersections of two circles: none, one (tangent) or two.
 *
 * Kept as its own closed form rather than routed through `ellipseEllipse`,
 * because the radical line gives the answer with one square root and no
 * quartic -- and circle against circle is by far the most common case.
 *
 * Concentric circles return nothing, identical ones included: they share
 * either no point or all of them, and neither is a list of points.
 *
 * Derivation: https://raw.org/article/calculate-the-intersection-points-of-two-circles/
 */
export function circleCircle(first: Circle, second: Circle): Intersection[] {
  if (!isValidCircle(first) || !isValidCircle(second)) return [];

  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [];

  const sum = first.r + second.r;
  const difference = Math.abs(first.r - second.r);
  const tolerance = EPS * Math.max(distance, sum);

  // Too far apart, or one nested inside the other without touching.
  if (distance > sum + tolerance || distance < difference - tolerance) return [];

  const ex = dx / distance;
  const ey = dy / distance;

  // Distance from `first`'s center to the radical line, along the center line.
  const along = (first.r * first.r - second.r * second.r + distance * distance) / (2 * distance);
  const heightSquared = first.r * first.r - along * along;
  const height = heightSquared <= 0 ? 0 : Math.sqrt(heightSquared);

  const results: Intersection[] = [];
  for (const sign of [-1, 1]) {
    const p = {
      x: first.x + along * ex - sign * height * ey,
      y: first.y + along * ey + sign * height * ex,
    };
    results.push(intersection(
      p,
      normalizeAngle(Math.atan2(p.y - first.y, p.x - first.x)),
      normalizeAngle(Math.atan2(p.y - second.y, p.x - second.x)),
    ));
  }
  // Tangency produces the same point twice; `finalize` folds it.
  return finalize(results);
}
