import type { Intersection, Point } from './types.js';
import { EPS, PARAM_EPS, between01, clamp01, isFinitePoint } from './internal/eps.js';
import { boundsOfSegment, boundsOverlap } from './bounds.js';
import { intersection } from './internal/result.js';

/**
 * Intersection of the segments `a1 → b1` and `a2 → b2`.
 *
 * Returns at most one point. Parallel segments, collinear segments -- whether
 * they overlap or not -- and zero-length segments all return an empty array:
 * an overlap is a segment, not a point, and reporting one of its ends would be
 * arbitrary. Test for that case with `isCollinear` if you need to know.
 */
export function lineLine(a1: Point, b1: Point, a2: Point, b2: Point): Intersection[] {
  if (!isFinitePoint(a1) || !isFinitePoint(b1) || !isFinitePoint(a2) || !isFinitePoint(b2)) {
    return [];
  }
  if (!boundsOverlap(boundsOfSegment(a1, b1), boundsOfSegment(a2, b2))) return [];

  const ux = b1.x - a1.x;
  const uy = b1.y - a1.y;
  const vx = b2.x - a2.x;
  const vy = b2.y - a2.y;
  const wx = a2.x - a1.x;
  const wy = a2.y - a1.y;

  const denominator = ux * vy - uy * vx;

  // Relative test: `denominator` is a product of two lengths, so comparing it
  // against a fixed epsilon would call long segments parallel and short ones
  // crossing at the same angle.
  const magnitude = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (Math.abs(denominator) <= EPS * magnitude) return [];

  const t = (wx * vy - wy * vx) / denominator;
  if (!between01(t, PARAM_EPS)) return [];

  const s = (wx * uy - wy * ux) / denominator;
  if (!between01(s, PARAM_EPS)) return [];

  const t1 = clamp01(t);
  return [intersection({ x: a1.x + t1 * ux, y: a1.y + t1 * uy }, t1, clamp01(s))];
}

/** The two segments run in parallel (or one of them is degenerate). */
export function isParallel(a1: Point, b1: Point, a2: Point, b2: Point): boolean {
  if (!isFinitePoint(a1) || !isFinitePoint(b1) || !isFinitePoint(a2) || !isFinitePoint(b2)) {
    return false;
  }

  const ux = b1.x - a1.x;
  const uy = b1.y - a1.y;
  const vx = b2.x - a2.x;
  const vy = b2.y - a2.y;
  const magnitude = Math.hypot(ux, uy) * Math.hypot(vx, vy);

  return Math.abs(ux * vy - uy * vx) <= EPS * magnitude;
}

/**
 * The two segments lie on one common line.
 *
 * A point segment is collinear only when its point lies on the other segment's
 * supporting line. Any two point segments are considered collinear.
 */
export function isCollinear(a1: Point, b1: Point, a2: Point, b2: Point): boolean {
  if (!isParallel(a1, b1, a2, b2)) return false;

  let ux = b1.x - a1.x;
  let uy = b1.y - a1.y;
  let wx = a2.x - a1.x;
  let wy = a2.y - a1.y;
  let length = Math.hypot(ux, uy);

  // A point segment has no direction of its own. Use the other segment's
  // supporting line so the result does not depend on argument order.
  if (length === 0) {
    ux = b2.x - a2.x;
    uy = b2.y - a2.y;
    wx = a1.x - a2.x;
    wy = a1.y - a2.y;
    length = Math.hypot(ux, uy);
  }

  if (length === 0) return true;

  const magnitude = length * Math.hypot(wx, wy);

  return Math.abs(ux * wy - uy * wx) <= EPS * magnitude;
}
