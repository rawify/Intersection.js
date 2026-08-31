import type { Arc, Point } from './types.js';
import { isFinitePoint } from './internal/eps.js';

/**
 * Converts an SVG `A` command to the centre parametrization the `*Arc`
 * functions take.
 *
 * SVG describes an arc by where it ends up -- two endpoints plus two flags --
 * while every intersection routine needs a centre, two radii and an angular
 * sweep. This is the conversion in the SVG spec's implementation notes (F.6.5),
 * including the radius correction of F.6.6: radii too small to join the two
 * endpoints are scaled up uniformly until they just reach, which is what the
 * spec requires and what the returned `rx`/`ry` reflect.
 *
 * `phi` is in **radians**, unlike the degrees that appear in path data --
 * multiply by `Math.PI / 180` on the way in.
 *
 * Returns `null` for the two cases the spec says are not arcs at all: coincident
 * endpoints (the segment is dropped) and a zero radius (it becomes a straight
 * line).
 *
 * The result describes the arc as a *set* of points, always swept
 * counter-clockwise from `alpha` to `beta`; the `sweep` flag decides which of
 * the two candidate arcs that is, not which direction it is drawn in. Nothing
 * about an intersection depends on the direction of travel.
 */
export function arcFromSvg(
  start: Point,
  rx: number,
  ry: number,
  phi: number,
  largeArc: boolean,
  sweep: boolean,
  end: Point,
): Arc | null {
  if (!isFinitePoint(start) || !isFinitePoint(end)) return null;
  if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(phi)) return null;
  if (start.x === end.x && start.y === end.y) return null;

  // "If rx or ry is 0, treat this as a straight line": not an arc.
  let radiusX = Math.abs(rx);
  let radiusY = Math.abs(ry);
  if (radiusX === 0 || radiusY === 0) return null;

  const cos = Math.cos(phi);
  const sin = Math.sin(phi);

  // Half the chord, rotated into the ellipse's own frame (F.6.5.1).
  const halfDx = (start.x - end.x) / 2;
  const halfDy = (start.y - end.y) / 2;
  const x1 = cos * halfDx + sin * halfDy;
  const y1 = -sin * halfDx + cos * halfDy;

  // F.6.6: grow radii that cannot span the chord.
  const lambda = (x1 * x1) / (radiusX * radiusX) + (y1 * y1) / (radiusY * radiusY);
  if (lambda > 1) {
    const growth = Math.sqrt(lambda);
    radiusX *= growth;
    radiusY *= growth;
  }

  const rxSquared = radiusX * radiusX;
  const rySquared = radiusY * radiusY;
  const denominator = rxSquared * y1 * y1 + rySquared * x1 * x1;
  const numerator = rxSquared * rySquared - denominator;

  // Which of the two centres: the flags pick the arc, and their disagreement
  // picks the side (F.6.5.2). `max(0, …)` absorbs the rounding left over from
  // the correction above, where the true value is exactly zero.
  const sign = largeArc === sweep ? -1 : 1;
  const factor = sign * Math.sqrt(Math.max(0, numerator / denominator));
  const cx1 = (factor * radiusX * y1) / radiusY;
  const cy1 = (-factor * radiusY * x1) / radiusX;

  const centerX = cos * cx1 - sin * cy1 + (start.x + end.x) / 2;
  const centerY = sin * cx1 + cos * cy1 + (start.y + end.y) / 2;

  // Parametric angles of both endpoints, read in the unit-circle frame.
  const startAngle = Math.atan2((y1 - cy1) / radiusY, (x1 - cx1) / radiusX);
  const endAngle = Math.atan2((-y1 - cy1) / radiusY, (-x1 - cx1) / radiusX);

  let delta = endAngle - startAngle;
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  return {
    x: centerX,
    y: centerY,
    rx: radiusX,
    ry: radiusY,
    phi,
    alpha: delta >= 0 ? startAngle : startAngle + delta,
    beta: delta >= 0 ? startAngle + delta : startAngle,
  };
}
