/** Two pi, the full turn. */
export const TAU = 2 * Math.PI;

/**
 * Baseline tolerance for quantities that are already dimensionless -- curve
 * parameters, normalized cross products, relative residuals.
 *
 * Anything carrying a length is compared against `relEps(scale)` instead:
 * a fixed absolute epsilon silently stops working once coordinates reach the
 * magnitudes real drawings use (map projections, CAD units, PDF user space).
 */
export const EPS = 1e-12;

/**
 * Slack for curve parameters and arc-length fractions.
 *
 * Wider than `EPS` on purpose: a root the cubic or sextic solve places a few
 * ulps outside `[0, 1]` is a real intersection at an endpoint, and dropping it
 * would make a shape's own corner invisible to a hit test.
 */
export const PARAM_EPS = 1e-9;

/** Tolerance for an absolute quantity living at magnitude `scale`. */
export function relEps(scale: number, eps: number = EPS): number {
  return eps * Math.max(1, Math.abs(scale));
}

/** `t` is inside the unit interval, give or take `eps`. */
export function between01(t: number, eps: number = EPS): boolean {
  return -eps <= t && t <= 1 + eps;
}

/** Pins a value into `[lo, hi]`. */
export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

/** Clamps a curve parameter that `between01` has already accepted. */
export function clamp01(t: number): number {
  return clamp(t, 0, 1);
}

/** The input guard every entry point taking points runs first. */
export function isFinitePoint(p: { x: number; y: number }): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
