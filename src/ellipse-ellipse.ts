import type { Ellipse, Intersection } from './types.js';
import { boundsOfEllipse, boundsOverlap } from './bounds.js';
import {
  applyAffine,
  ellipseAngleAt,
  ellipseToConic,
  isValidEllipse,
  normalizeConic,
  transformConic,
  unitToWorld,
  type Conic,
} from './internal/ellipse.js';
import { normalizeAngle } from './internal/angle.js';
import { realRoots } from './internal/poly.js';
import { finalize, intersection } from './internal/result.js';

/** Residual of the normalized conic still counted as "on the curve". */
const RESIDUAL_EPS = 1e-6;

/** Coefficient magnitude below which the quartic counts as identically zero. */
const DEGENERATE_EPS = 1e-12;

/**
 * Intersections of two ellipses (circles and rotated ellipses included): up to
 * four points.
 *
 * The first ellipse is mapped to the unit circle, which carries the second one
 * to some conic `Q`. Substituting the circle's rational parametrization
 * `cos θ = (1-u²)/(1+u²)`, `sin θ = 2u/(1+u²)` with `u = tan(θ/2)` and clearing
 * denominators leaves a quartic in `u` -- one polynomial solve instead of the
 * Bezout resultant of two general conics, and the map back is exact.
 *
 * `u = tan(θ/2)` cannot represent `θ = π`, so that one angle is tested against
 * `Q` directly; without it an ellipse touching the first one at its own
 * leftmost point would go unreported.
 *
 * Coincident ellipses share every point rather than finitely many, so they
 * return an empty array.
 */
export function ellipseEllipse(first: Ellipse, second: Ellipse): Intersection[] {
  if (!isValidEllipse(first) || !isValidEllipse(second)) return [];
  if (!boundsOverlap(boundsOfEllipse(first), boundsOfEllipse(second))) return [];

  const toWorld = unitToWorld(first);
  // The second ellipse seen from the first one's unit-circle frame.
  const q = normalizeConic(transformConic(ellipseToConic(second), toWorld));

  const quartic = [
    q.a - q.d + q.f,
    2 * (q.e - q.b),
    2 * (q.f - q.a) + 4 * q.c,
    2 * (q.b + q.e),
    q.a + q.d + q.f,
  ];

  // An identically zero quartic means every point of the unit circle satisfies
  // Q: the two ellipses are the same curve.
  if (quartic.every((coefficient) => Math.abs(coefficient) <= DEGENERATE_EPS)) return [];

  const angles = realRoots(quartic).map((u) => 2 * Math.atan(u));

  // The root at infinity, which the half-angle substitution drops.
  if (Math.abs(conicAtAngle(q, Math.PI)) <= RESIDUAL_EPS) angles.push(Math.PI);

  const results: Intersection[] = [];
  for (const candidate of angles) {
    // No residual filter here: every root came out of the quartic that *is* the
    // conic restricted to the circle, and the one angle that did not -- θ = π --
    // was gated on its residual above.
    const theta = polishAngle(q, candidate);
    const point = applyAffine(toWorld, { x: Math.cos(theta), y: Math.sin(theta) });
    results.push(intersection(
      point,
      normalizeAngle(theta),
      ellipseAngleAt(second, point),
    ));
  }
  return finalize(results);
}

/** The conic evaluated on the unit circle at angle `theta`. */
function conicAtAngle(q: Conic, theta: number): number {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return q.a * cos * cos + q.b * cos * sin + q.c * sin * sin + q.d * cos + q.e * sin + q.f;
}

/**
 * A couple of Newton steps on `θ` rather than on `u`.
 *
 * Near a tangency the quartic's roots are clustered and lose about half their
 * digits; recovering them on the circle itself costs two evaluations and is
 * what keeps a tangential touch from drifting off the curve and being rejected
 * by the residual test.
 */
function polishAngle(q: Conic, start: number): number {
  let theta = start;
  let residual = Math.abs(conicAtAngle(q, theta));

  for (let i = 0; i < 3; i++) {
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const slope = -2 * q.a * cos * sin
      + q.b * (cos * cos - sin * sin)
      + 2 * q.c * sin * cos
      - q.d * sin
      + q.e * cos;
    if (Math.abs(slope) <= Number.EPSILON) break;

    const next = theta - conicAtAngle(q, theta) / slope;
    const nextResidual = Math.abs(conicAtAngle(q, next));
    if (nextResidual >= residual) break;

    theta = next;
    residual = nextResidual;
  }
  // Stays within a few ulps of the incoming angle, which `2·atan(u)` already
  // put in (-π, π); the caller normalizes.
  return theta;
}
