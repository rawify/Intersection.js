import type { Point } from '../types.js';
import { quadraticRoots } from './poly.js';

/**
 * Parameters `t` where the segment `a → b` meets the unit circle centered at
 * the origin.
 *
 * Every line-versus-conic case funnels through here: an affine map turns any
 * circle or ellipse into this circle, and affine maps leave the segment's own
 * parameter untouched, so the `t` values come back usable as they are.
 *
 * A degenerate segment (`a === b`) leaves no quadratic to solve and yields
 * nothing, which is the documented result for zero-length input.
 */
export function unitCircleSegmentParams(a: Point, b: Point): number[] {
  const vx = b.x - a.x;
  const vy = b.y - a.y;

  return quadraticRoots(
    vx * vx + vy * vy,
    2 * (a.x * vx + a.y * vy),
    a.x * a.x + a.y * a.y - 1,
  );
}
