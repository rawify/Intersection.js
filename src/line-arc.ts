import type { Arc, Circle, Intersection, Point } from './types.js';
import { isAngleInArc } from './internal/angle.js';
import { lineEllipse } from './line-ellipse.js';

/**
 * Intersections of the segment `a → b` with an elliptical arc.
 *
 * Same as `lineEllipse`, then dropping whatever falls outside the sweep from
 * `arc.alpha` to `arc.beta`. With `alpha === beta` the whole ellipse is kept.
 */
export function lineArc(a: Point, b: Point, arc: Arc): Intersection[] {
  return lineEllipse(a, b, arc).filter((hit) => isAngleInArc(hit.t2, arc.alpha, arc.beta));
}

/** Builds the arc of a circle between two angles, for the `*Arc` functions. */
export function arcFromCircle(circle: Circle, alpha: number, beta: number): Arc {
  return { x: circle.x, y: circle.y, rx: circle.r, ry: circle.r, phi: 0, alpha, beta };
}
