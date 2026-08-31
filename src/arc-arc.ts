import type { Arc, Intersection } from './types.js';
import { isAngleInArc } from './internal/angle.js';
import { ellipseEllipse } from './ellipse-ellipse.js';

/**
 * Intersections of two elliptical arcs.
 *
 * `ellipseEllipse` on the underlying full ellipses, then keeping only the
 * points that fall inside both sweeps.
 */
export function arcArc(first: Arc, second: Arc): Intersection[] {
  return ellipseEllipse(first, second).filter((hit) => (
    isAngleInArc(hit.t1, first.alpha, first.beta)
    && isAngleInArc(hit.t2, second.alpha, second.beta)
  ));
}
