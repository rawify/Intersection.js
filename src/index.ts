/**
 * @license Intersection.js v0.1.1 9/10/2026
 * https://raw.org/software/libraries/intersection-js/
 *
 * Copyright (c) 2026, Robert Eisele (https://raw.org/)
 * Licensed under the MIT license.
 **/

/**
 * Intersection.js -- intersection points between the primitives 2D vector
 * graphics are actually made of.
 *
 * Every function returns an array of `Intersection`, empty when there is no
 * hit, ordered by the first operand's parameter. Nothing throws: degenerate
 * input (zero-length segments, non-positive radii, NaN coordinates) yields an
 * empty array.
 */

export type {
  Arc,
  Bounds,
  Circle,
  CubicBezier,
  Ellipse,
  Intersection,
  Point,
  QuadraticBezier,
  Rect,
} from './types.js';

export { lineLine, isCollinear, isParallel } from './line-line.js';
export { lineCircle } from './line-circle.js';
export { lineEllipse } from './line-ellipse.js';
export { arcFromCircle, lineArc } from './line-arc.js';
export { arcFromSvg } from './svg-arc.js';
export { lineBezier } from './line-bezier.js';
export { circleCircle } from './circle-circle.js';
export { ellipseEllipse } from './ellipse-ellipse.js';
export { arcArc } from './arc-arc.js';
export { bezierArc, bezierCircle, bezierEllipse } from './bezier-ellipse.js';
export { bezierBezier } from './bezier-bezier.js';

export {
  boundsOfCircle,
  boundsOfCubic,
  boundsOfCubicHull,
  boundsOfEllipse,
  boundsOfPoints,
  boundsOfSegment,
  boundsOverlap,
  rectRect,
} from './bounds.js';

// Shape helpers worth having outside the library: they are what turns a `t2`
// back into a point, or a quadratic into something the cubic routines take.
export {
  cubicControlPoints,
  cubicPointAt,
  cubicTangentAt,
  quadraticToCubic,
  splitCubic,
} from './internal/bezier.js';
export { circleToEllipse, ellipseAngleAt, ellipsePointAt } from './internal/ellipse.js';
export { isAngleInArc, normalizeAngle } from './internal/angle.js';
export { TAU } from './internal/eps.js';
