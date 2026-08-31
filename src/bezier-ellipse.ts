import type { Arc, Circle, CubicBezier, Ellipse, Intersection } from './types.js';
import { PARAM_EPS, clamp01 } from './internal/eps.js';
import { boundsOfCubicHull, boundsOfEllipse, boundsOverlap } from './bounds.js';
import {
  applyAffine,
  circleToEllipse,
  isValidCircle,
  isValidEllipse,
  worldToUnit,
} from './internal/ellipse.js';
import { cubicCoefficients, cubicPointAt, isFiniteCubic } from './internal/bezier.js';
import { isAngleInArc, normalizeAngle } from './internal/angle.js';
import { polyAdd, polyAddConstant, polyMul, realRootsInInterval } from './internal/poly.js';
import { finalize, intersection } from './internal/result.js';

/**
 * Intersections of a cubic Bezier with a full ellipse: up to six points,
 * ordered along the curve.
 *
 * The ellipse becomes the unit circle, which turns "is this point on the
 * ellipse" into `x(t)² + y(t)² - 1 = 0` -- a sextic in `t`, since `x` and `y`
 * are cubics. No subdivision and no tolerance to tune: `realRootsInInterval`
 * isolates the roots exactly on `[0, 1]`.
 */
export function bezierEllipse(curve: CubicBezier, ellipse: Ellipse): Intersection[] {
  if (!isFiniteCubic(curve) || !isValidEllipse(ellipse)) return [];
  if (!boundsOverlap(boundsOfCubicHull(curve), boundsOfEllipse(ellipse))) return [];

  const toUnit = worldToUnit(ellipse);
  const unitCurve: CubicBezier = {
    p0: applyAffine(toUnit, curve.p0),
    p1: applyAffine(toUnit, curve.p1),
    p2: applyAffine(toUnit, curve.p2),
    p3: applyAffine(toUnit, curve.p3),
  };

  const { x, y } = cubicCoefficients(unitCurve);
  const implicit = polyAddConstant(polyAdd(polyMul(x, x), polyMul(y, y)), -1);

  const results: Intersection[] = [];
  for (const root of realRootsInInterval(implicit, -PARAM_EPS, 1 + PARAM_EPS)) {
    const t = clamp01(root);
    const local = cubicPointAt(unitCurve, t);

    results.push(intersection(
      cubicPointAt(curve, t),
      t,
      normalizeAngle(Math.atan2(local.y, local.x)),
    ));
  }
  return finalize(results);
}

/** `bezierEllipse` for a circle. `t2` is the angle from the circle's center. */
export function bezierCircle(curve: CubicBezier, circle: Circle): Intersection[] {
  if (!isValidCircle(circle)) return [];
  return bezierEllipse(curve, circleToEllipse(circle));
}

/** `bezierEllipse` restricted to the arc's sweep. */
export function bezierArc(curve: CubicBezier, arc: Arc): Intersection[] {
  return bezierEllipse(curve, arc).filter((hit) => isAngleInArc(hit.t2, arc.alpha, arc.beta));
}
