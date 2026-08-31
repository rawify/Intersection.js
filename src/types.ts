/**
 * A point in the plane.
 *
 * Structural on purpose: anything carrying `x` and `y` is accepted, so
 * `@rawify/vector2` instances, `DOMPoint`s and plain object literals all work
 * without conversion.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A circle with a positive radius. */
export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * An axis-aligned or rotated ellipse.
 *
 * The parametrization used throughout is
 * `p(t) = center + R(phi) * (rx * cos t, ry * sin t)`, so `t` is the
 * *parametric* angle, not the polar angle of the point as seen from the
 * center. The two coincide only when `rx === ry`.
 */
export interface Ellipse {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  /** Rotation of the `rx` axis in radians. Defaults to `0`. */
  readonly phi?: number;
}

/**
 * A piece of an ellipse, swept counter-clockwise from `alpha` to `beta` in
 * parametric angles.
 *
 * `alpha === beta` (mod 2π) denotes the *full* ellipse rather than an empty
 * arc, which is the convention SVG's arc flags end up expressing too.
 *
 * An `Arc` is structurally an `Ellipse`, so passing one to an ellipse function
 * is legal and simply ignores the angular limits.
 */
export interface Arc extends Ellipse {
  readonly alpha: number;
  readonly beta: number;
}

/** A cubic Bezier segment. */
export interface CubicBezier {
  readonly p0: Point;
  readonly p1: Point;
  readonly p2: Point;
  readonly p3: Point;
}

/** A quadratic Bezier segment. Raise it with `quadraticToCubic` to intersect it. */
export interface QuadraticBezier {
  readonly p0: Point;
  readonly p1: Point;
  readonly p2: Point;
}

/**
 * One intersection point, plus where it sits on each operand.
 *
 * `t1` belongs to the first argument of the function that produced it, `t2` to
 * the second. What the number means depends on the shape:
 *
 * | operand                    | parameter                          |
 * | -------------------------- | ---------------------------------- |
 * | line segment               | `t` in `[0, 1]` from start to end   |
 * | cubic/quadratic Bezier     | `t` in `[0, 1]`                     |
 * | circle, ellipse, arc       | parametric angle in `[0, 2π)`        |
 *
 * `Intersection` extends `Point`, so results drop straight into code that only
 * cares about coordinates.
 */
export interface Intersection extends Point {
  readonly x: number;
  readonly y: number;
  readonly t1: number;
  readonly t2: number;
}

/** An axis-aligned box in min/max form, as returned by the `boundsOf*` helpers. */
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * An axis-aligned box in DOM `getBoundingClientRect()` form.
 *
 * Both `left <= right` and `top <= bottom` are assumed, which holds for DOM
 * rects (y grows downwards) and for y-up coordinates as long as the caller is
 * consistent about which edge is called `top`.
 */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}
