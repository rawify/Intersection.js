import { expect } from 'vitest';
import type { Circle, CubicBezier, Ellipse, Point } from '../src/types.js';
import { cubicPointAt } from '../src/internal/bezier.js';
import { applyAffine, ellipsePointAt, worldToUnit } from '../src/internal/ellipse.js';
import { normalizeAngle } from '../src/internal/angle.js';
import { TAU } from '../src/internal/eps.js';

/**
 * Test support. Not part of the build (see the `exclude` in tsconfig.json):
 * shared by the suites, shipped to nobody.
 *
 * The assertions here check *invariants* instead of hard-coded coordinates. A
 * hard-coded expectation only proves the number did not change; "the returned
 * point lies on both operands, and both parameters reproduce it" is the actual
 * contract, and it holds for cases whose closed form nobody wants to write out.
 */

/** Distance from a point to a circle's outline. */
export function circleResidual(p: Point, circle: Circle): number {
  return Math.abs(Math.hypot(p.x - circle.x, p.y - circle.y) - circle.r);
}

/**
 * How far off the ellipse a point is, measured in the unit-circle frame and
 * scaled back by the smaller radius so the number is a length again.
 */
export function ellipseResidual(p: Point, ellipse: Ellipse): number {
  const local = applyAffine(worldToUnit(ellipse), p);
  return Math.abs(Math.hypot(local.x, local.y) - 1) * Math.min(ellipse.rx, ellipse.ry);
}

/** Distance from a point to the line through `a` and `b`. */
export function lineResidual(p: Point, a: Point, b: Point): number {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  return Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux) / Math.hypot(ux, uy);
}

export function distance(p: Point, q: Point): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Angular distance, the short way round, so 0 and 2π-1e-16 are adjacent. */
export function angleDelta(a: number, b: number): number {
  const delta = Math.abs(normalizeAngle(a - b));
  return Math.min(delta, TAU - delta);
}

/**
 * The hit sits on the segment, and `t` is the parameter that produces it.
 *
 * The parameter is passed in rather than read off the hit: which of `t1`/`t2`
 * belongs to the segment depends on the argument order of the function under
 * test, and guessing wrong turns a real assertion into a vacuous one.
 */
export function expectOnSegment(
  hit: Point,
  t: number,
  a: Point,
  b: Point,
  tolerance = 1e-9,
): void {
  expect(t).toBeGreaterThanOrEqual(0);
  expect(t).toBeLessThanOrEqual(1);
  expect(distance(hit, {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  })).toBeLessThan(tolerance);
}

/** The hit sits on the circle, and the given angle reproduces it. */
export function expectOnCircle(
  hit: Point,
  angle: number,
  circle: Circle,
  tolerance = 1e-9,
): void {
  expect(circleResidual(hit, circle)).toBeLessThan(tolerance);
  expect(distance(hit, {
    x: circle.x + circle.r * Math.cos(angle),
    y: circle.y + circle.r * Math.sin(angle),
  })).toBeLessThan(tolerance);
}

/** The hit sits on the ellipse, and the given angle reproduces it. */
export function expectOnEllipse(
  hit: Point,
  angle: number,
  ellipse: Ellipse,
  tolerance = 1e-9,
): void {
  expect(ellipseResidual(hit, ellipse)).toBeLessThan(tolerance);
  expect(distance(hit, ellipsePointAt(ellipse, angle))).toBeLessThan(tolerance);
}

/** The hit sits on the curve at the reported parameter. */
export function expectOnCubic(
  hit: Point,
  t: number,
  curve: CubicBezier,
  tolerance = 1e-9,
): void {
  expect(t).toBeGreaterThanOrEqual(0);
  expect(t).toBeLessThanOrEqual(1);
  expect(distance(hit, cubicPointAt(curve, t))).toBeLessThan(tolerance);
}

/**
 * Deterministic pseudo-random numbers in `[0, 1)`.
 *
 * A fixed-seed LCG rather than `Math.random()`: the randomized sweeps below are
 * worth having precisely because they cover cases nobody thought to write down,
 * and a failure nobody can reproduce is worth nothing.
 */
export function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Uniform sample from `[lo, hi)`. */
export function uniform(random: () => number, lo: number, hi: number): number {
  return lo + (hi - lo) * random();
}

export function randomPoint(random: () => number, span = 10): Point {
  return { x: uniform(random, -span, span), y: uniform(random, -span, span) };
}

export function randomCubic(random: () => number, span = 10): CubicBezier {
  return {
    p0: randomPoint(random, span),
    p1: randomPoint(random, span),
    p2: randomPoint(random, span),
    p3: randomPoint(random, span),
  };
}

/**
 * Counts sign changes of `f` over a dense sampling of `[0, 1]`.
 *
 * The independent, dumb answer for how many transversal roots a routine should
 * have found. It cannot see a tangency (no sign change) or two roots inside one
 * step, so it is a lower bound -- which is exactly the direction that catches a
 * solver dropping roots.
 */
export function countSignChanges(f: (t: number) => number, steps = 20000): number {
  let changes = 0;
  let previous = f(0);

  for (let i = 1; i <= steps; i++) {
    const value = f(i / steps);
    if (previous !== 0 && value !== 0 && Math.sign(value) !== Math.sign(previous)) changes++;
    if (value !== 0) previous = value;
  }
  return changes;
}
