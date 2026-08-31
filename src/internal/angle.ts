import { TAU } from './eps.js';

/**
 * Angular slack, in radians, for deciding whether an intersection sits on an
 * arc. Absolute rather than relative: angles are already dimensionless, and
 * `1e-9 rad` is roughly a micrometre at a kilometre radius -- far below any
 * geometry that matters, far above the noise a `Math.atan2` round trip leaves.
 */
export const ANGLE_EPS = 1e-9;

/** Folds an angle into `[0, 2π)`. */
export function normalizeAngle(angle: number): number {
  const wrapped = angle % TAU;
  if (wrapped >= 0) return wrapped;

  // `wrapped + TAU` rounds up to exactly TAU for any `wrapped` smaller than an
  // ulp of TAU, which would put the result outside the half-open range this
  // promises -- and a parametric angle of TAU instead of 0 is the kind of thing
  // that makes an arc reject a hit on its own start point.
  const shifted = wrapped + TAU;
  return shifted >= TAU ? 0 : shifted;
}

/**
 * `alpha` and `beta` describe a full turn rather than an empty sweep.
 *
 * Equal start and end angles are read as the complete ellipse; a zero-length
 * arc is not a shape anyone draws deliberately, whereas a full circle written
 * as `alpha === beta` is what both SVG's two-arc trick and every
 * `ctx.arc(x, y, r, 0, TAU)` call produce.
 */
export function isFullSweep(alpha: number, beta: number, eps: number = ANGLE_EPS): boolean {
  const delta = normalizeAngle(beta - alpha);
  return delta <= eps || TAU - delta <= eps;
}

/**
 * `angle` lies on the arc swept counter-clockwise from `alpha` to `beta`.
 *
 * The `TAU - eps` branch catches an intersection that rounds to just *before*
 * the start of the sweep, which is where a hit exactly on the arc's first
 * endpoint tends to land.
 */
export function isAngleInArc(
  angle: number,
  alpha: number,
  beta: number,
  eps: number = ANGLE_EPS,
): boolean {
  if (isFullSweep(alpha, beta, eps)) return true;

  const sweep = normalizeAngle(beta - alpha);
  const offset = normalizeAngle(angle - alpha);
  return offset <= sweep + eps || offset >= TAU - eps;
}
