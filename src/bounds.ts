import type { Bounds, Circle, CubicBezier, Ellipse, Point, Rect } from './types.js';
import { cubicCoefficients, cubicPointAt } from './internal/bezier.js';
import { ellipsePhi } from './internal/ellipse.js';
import { quadraticRoots } from './internal/poly.js';
import { relEps } from './internal/eps.js';

/** Tightest axis-aligned box containing every given point. */
export function boundsOfPoints(points: readonly Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function boundsOfSegment(a: Point, b: Point): Bounds {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

/**
 * The control polygon's box -- a superset of the curve's own, cheap enough to
 * use as a rejection test before doing any real work.
 */
export function boundsOfCubicHull(curve: CubicBezier): Bounds {
  return boundsOfPoints([curve.p0, curve.p1, curve.p2, curve.p3]);
}

/**
 * The curve's exact box: endpoints plus the interior extrema, which are the
 * roots of the derivative and therefore a quadratic per axis.
 */
export function boundsOfCubic(curve: CubicBezier): Bounds {
  const { x, y } = cubicCoefficients(curve);
  const samples: Point[] = [curve.p0, curve.p3];

  for (const axis of [x, y]) {
    // d/dt (A t³ + B t² + C t + D) = 3A t² + 2B t + C
    for (const t of quadraticRoots(3 * axis[0], 2 * axis[1], axis[2])) {
      if (0 < t && t < 1) samples.push(cubicPointAt(curve, t));
    }
  }
  return boundsOfPoints(samples);
}

export function boundsOfCircle(circle: Circle): Bounds {
  return {
    minX: circle.x - circle.r,
    minY: circle.y - circle.r,
    maxX: circle.x + circle.r,
    maxY: circle.y + circle.r,
  };
}

/**
 * The full ellipse's exact box.
 *
 * `rx cos φ cos t - ry sin φ sin t` is a sinusoid of amplitude
 * `hypot(rx cos φ, ry sin φ)`, which gives the half-extent in closed form
 * without sampling. Used on an `Arc` this is a superset, since the sweep may
 * never reach the extremum -- correct for culling, not tight.
 */
export function boundsOfEllipse(ellipse: Ellipse): Bounds {
  const phi = ellipsePhi(ellipse);
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const halfWidth = Math.hypot(ellipse.rx * cos, ellipse.ry * sin);
  const halfHeight = Math.hypot(ellipse.rx * sin, ellipse.ry * cos);

  return {
    minX: ellipse.x - halfWidth,
    minY: ellipse.y - halfHeight,
    maxX: ellipse.x + halfWidth,
    maxY: ellipse.y + halfHeight,
  };
}

/**
 * Boxes share at least a point, touching included.
 *
 * The default tolerance scales with the boxes so that a segment lying exactly
 * on a box edge is not rejected by a one-ulp gap.
 */
export function boundsOverlap(a: Bounds, b: Bounds, eps?: number): boolean {
  const tolerance = eps ?? relEps(Math.max(
    Math.abs(a.minX),
    Math.abs(a.maxX),
    Math.abs(a.minY),
    Math.abs(a.maxY),
    Math.abs(b.minX),
    Math.abs(b.maxX),
    Math.abs(b.minY),
    Math.abs(b.maxY),
  ));

  return a.minX <= b.maxX + tolerance
    && b.minX <= a.maxX + tolerance
    && a.minY <= b.maxY + tolerance
    && b.minY <= a.maxY + tolerance;
}

/**
 * `boundsOverlap` for boxes in DOM `getBoundingClientRect()` form.
 *
 * Touching edges count as overlapping, which is the behaviour a hit test
 * wants; use strict comparisons yourself if you need positive area.
 */
export function rectRect(a: Rect, b: Rect): boolean {
  return b.left <= a.right && a.left <= b.right && b.top <= a.bottom && a.top <= b.bottom;
}
