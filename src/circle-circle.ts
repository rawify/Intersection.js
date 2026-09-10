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
  if (distance === 0 || !Number.isFinite(distance)) return [];

  // Normalize all lengths before squaring. This avoids overflow for radii near
  // Number.MAX_VALUE and underflow for subnormal-scale geometry.
  const scale = Math.max(distance, first.r, second.r);
  const normalizedDistance = distance / scale;
  const firstRadius = first.r / scale;
  const secondRadius = second.r / scale;
  const sum = firstRadius + secondRadius;
  const difference = Math.abs(firstRadius - secondRadius);
  const tolerance = EPS * Math.max(normalizedDistance, sum);

  // Too far apart, or one nested inside the other without touching.
  if (normalizedDistance > sum + tolerance || normalizedDistance < difference - tolerance) {
    return [];
  }

  const ex = dx / distance;
  const ey = dy / distance;

  // Distance from `first`'s center to the radical line, along the center line.
  const along = ((firstRadius - secondRadius) * sum
    + normalizedDistance * normalizedDistance) / (2 * normalizedDistance);
  const heightSquared = firstRadius * firstRadius - along * along;
  if (heightSquared < -EPS * Math.max(1, firstRadius * firstRadius, along * along)) return [];

  const height = Math.sqrt(Math.max(0, heightSquared));

  const results: Intersection[] = [];
  for (const sign of [-1, 1]) {
    const offsetX = along * ex - sign * height * ey;
    const offsetY = along * ey + sign * height * ex;
    const p = {
      x: first.x + scale * offsetX,
      y: first.y + scale * offsetY,
    };
    results.push(intersection(
      p,
      normalizeAngle(Math.atan2(offsetY, offsetX)),
      normalizeAngle(Math.atan2(
        offsetY - normalizedDistance * ey,
        offsetX - normalizedDistance * ex,
      )),
    ));
  }
  // Tangency produces the same point twice; `finalize` folds it.
  return finalize(results, EPS * scale);
}
