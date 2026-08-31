/**
 * Real root finding for the polynomials the intersection routines reduce to.
 *
 * Coefficients are plain arrays in **descending** power order, so `[a, b, c]`
 * means `a x^2 + b x + c`. That ordering matches Horner evaluation -- the hot
 * path in here -- and reads the same as the closed-form signatures.
 *
 * Degrees 1 to 3 are solved in closed form (see
 * https://raw.org/book/algebra/solving-cubic-equations/). Degree 4 and up --
 * ellipse against ellipse produces a quartic, a cubic Bezier against an ellipse
 * a sextic -- go through `realRootsInInterval`, which isolates roots between
 * the critical points of the derivative and then converges with a Newton
 * iteration that keeps its bracket. That avoids Ferrari's quartic formula,
 * whose intermediate resolvent is badly conditioned exactly in the
 * near-tangency cases geometry keeps producing.
 *
 * Every tolerance in here is relative to the size of the coefficients or to
 * the running Horner sum, so the routines behave the same for a unit square
 * and for coordinates in the millions.
 */

/** Leading coefficients below this fraction of the largest one are dropped. */
const COEFF_EPS = 1e-14;

/** How close to zero a value must be, relatively, to count as a root. */
const VALUE_EPS = 1e-12;

/** Iteration cap for the bracketed Newton refinement. */
const MAX_REFINE_STEPS = 60;

/** Evaluates the polynomial at `x` by Horner's scheme. */
export function polyEval(coeffs: readonly number[], x: number): number {
  let acc = 0;
  for (let i = 0; i < coeffs.length; i++) {
    acc = acc * x + coeffs[i]!;
  }
  return acc;
}

/**
 * Sum of `|coeff| * |x|^k`, the natural scale for deciding whether a Horner
 * result is "zero". Rounding error in `polyEval` is bounded by a small
 * multiple of machine epsilon times this sum.
 */
function polyMagnitude(coeffs: readonly number[], x: number): number {
  const ax = Math.abs(x);
  let acc = 0;
  for (let i = 0; i < coeffs.length; i++) {
    acc = acc * ax + Math.abs(coeffs[i]!);
  }
  return acc;
}

/** `f(x)` is zero to within the noise floor of evaluating `f` at `x`. */
function isRootValue(coeffs: readonly number[], x: number, value: number): boolean {
  const scale = polyMagnitude(coeffs, x);
  return Math.abs(value) <= VALUE_EPS * Math.max(scale, Number.MIN_VALUE);
}

/** Derivative, again in descending order. */
export function polyDerivative(coeffs: readonly number[]): number[] {
  const degree = coeffs.length - 1;
  if (degree <= 0) return [0];

  const out = new Array<number>(degree);
  for (let i = 0; i < degree; i++) {
    out[i] = coeffs[i]! * (degree - i);
  }
  return out;
}

/** Product of two polynomials. */
export function polyMul(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j]! += a[i]! * b[j]!;
    }
  }
  return out;
}

/** Sum of two polynomials of possibly different degree. */
export function polyAdd(a: readonly number[], b: readonly number[]): number[] {
  const length = Math.max(a.length, b.length);
  const out = new Array<number>(length).fill(0);
  for (let i = 0; i < a.length; i++) {
    out[length - a.length + i]! += a[i]!;
  }
  for (let i = 0; i < b.length; i++) {
    out[length - b.length + i]! += b[i]!;
  }
  return out;
}

/** Adds a constant to a polynomial. */
export function polyAddConstant(coeffs: readonly number[], value: number): number[] {
  const out = coeffs.slice();
  out[out.length - 1] = out[out.length - 1]! + value;
  return out;
}

/**
 * Drops leading coefficients that are negligible against the largest one.
 *
 * A leading coefficient at `1e-14` of the others puts its root some `1e14`
 * away, i.e. nowhere near the region any of the callers care about, while
 * dividing by it wrecks the rest of the solution. Dropping it turns the
 * near-degenerate case into the exactly degenerate one, which the lower-degree
 * branch then handles well.
 */
export function polyTrim(coeffs: readonly number[]): number[] {
  let maxAbs = 0;
  for (const c of coeffs) {
    const abs = Math.abs(c);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs === 0) return [0];

  let start = 0;
  const limit = COEFF_EPS * maxAbs;
  while (start < coeffs.length - 1 && Math.abs(coeffs[start]!) <= limit) start++;
  return coeffs.slice(start);
}

/** `true` when the polynomial is the zero polynomial to within tolerance. */
export function polyIsZero(coeffs: readonly number[]): boolean {
  const trimmed = polyTrim(coeffs);
  return trimmed.length === 1 && trimmed[0] === 0;
}

/**
 * Real roots of `a x^2 + b x + c`, degenerate leading coefficients included.
 *
 * Uses the `q = -(b + sign(b) sqrt(D)) / 2` form so that neither root is ever
 * computed as the difference of two nearly equal numbers -- the textbook
 * formula loses most of its digits on one of the two roots whenever
 * `b^2 >> 4ac`, which for a line against a large circle is the normal case,
 * not a corner case.
 */
export function quadraticRoots(a: number, b: number, c: number): number[] {
  const trimmed = polyTrim([a, b, c]);
  if (trimmed.length < 3) return linearOrConstantRoots(trimmed);

  const [qa, qb, qc] = trimmed as [number, number, number];
  const discriminant = qb * qb - 4 * qa * qc;
  const scale = qb * qb + Math.abs(4 * qa * qc);

  if (discriminant < -COEFF_EPS * scale) return [];

  // A discriminant inside the noise floor is a touching root, not two roots a
  // rounding error apart: report it once.
  if (Math.abs(discriminant) <= COEFF_EPS * scale) return [-qb / (2 * qa)];

  const root = Math.sqrt(discriminant);
  const q = qb >= 0 ? -0.5 * (qb + root) : -0.5 * (qb - root);
  const x1 = q / qa;
  const x2 = qc / q;
  return x1 <= x2 ? [x1, x2] : [x2, x1];
}

/** Real roots of `a x^3 + b x^2 + c x + d`, ascending. */
export function cubicRoots(a: number, b: number, c: number, d: number): number[] {
  const trimmed = polyTrim([a, b, c, d]);
  if (trimmed.length < 4) {
    return trimmed.length === 3
      ? quadraticRoots(trimmed[0]!, trimmed[1]!, trimmed[2]!)
      : linearOrConstantRoots(trimmed);
  }

  const [ca, cb, cc, cd] = trimmed as [number, number, number, number];

  // Monic, then depressed: x = y - A/3 turns it into y^3 + p y + q.
  const A = cb / ca;
  const B = cc / ca;
  const C = cd / ca;
  const shift = A / 3;
  const p = B - A * A / 3;
  const q = (2 * A * A * A) / 27 - (A * B) / 3 + C;

  const half = q / 2;
  const third = p / 3;
  const discriminant = half * half + third * third * third;
  const scale = Math.abs(half * half) + Math.abs(third * third * third);

  let roots: number[];
  if (Math.abs(discriminant) <= COEFF_EPS * scale) {
    // Repeated root. |q| ~ 0 as well means all three coincide.
    roots = Math.abs(half) <= COEFF_EPS * (Math.abs(third) + 1)
      ? [-shift]
      : [2 * Math.cbrt(-half) - shift, -Math.cbrt(-half) - shift];
  } else if (discriminant > 0) {
    // One real root; the other two are a complex conjugate pair.
    const root = Math.sqrt(discriminant);
    roots = [Math.cbrt(-half + root) + Math.cbrt(-half - root) - shift];
  } else {
    // Three real roots -- the trigonometric form, which stays real throughout
    // instead of routing through complex cube roots (casus irreducibilis).
    const r = Math.sqrt(-third);
    const phi = Math.acos(clampUnit(-half / (r * r * r)));
    roots = [0, 1, 2].map((k) => 2 * r * Math.cos((phi + 2 * Math.PI * k) / 3) - shift);
  }

  const polished = roots.map((root) => polishRoot(trimmed, root));
  polished.sort((x, y) => x - y);
  return polished;
}

/** Roots of a polynomial already trimmed to degree 1 or 0. */
function linearOrConstantRoots(trimmed: readonly number[]): number[] {
  return trimmed.length === 2 ? [-trimmed[1]! / trimmed[0]!] : [];
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * A couple of unguarded Newton steps, kept only if they improve the residual.
 *
 * The closed forms above are accurate to a few ulps for well separated roots
 * but lose about half the digits for clustered ones, and geometry produces
 * clustered roots whenever two shapes nearly touch.
 */
function polishRoot(coeffs: readonly number[], start: number): number {
  const derivative = polyDerivative(coeffs);
  let x = start;
  let residual = Math.abs(polyEval(coeffs, x));

  for (let i = 0; i < 2; i++) {
    const slope = polyEval(derivative, x);
    if (slope === 0) break;

    const next = x - polyEval(coeffs, x) / slope;

    // Negated rather than `>=` so that a non-finite step -- which a denormal
    // slope can produce -- fails this test instead of sailing through it with a
    // NaN residual.
    const nextResidual = Math.abs(polyEval(coeffs, next));
    if (!(nextResidual < residual)) break;

    x = next;
    residual = nextResidual;
  }
  return x;
}

/**
 * Newton with a bracket it is not allowed to leave.
 *
 * `lo` and `hi` must straddle the root with opposite signs. Every step either
 * takes the Newton point, when it stays inside the current bracket, or bisects,
 * so convergence is quadratic in the common case and guaranteed in the bad one.
 */
function refineBracketed(coeffs: readonly number[], lo: number, hi: number, fLo: number): number {
  const derivative = polyDerivative(coeffs);
  let a = lo;
  let b = hi;
  let signA = Math.sign(fLo);
  let x = 0.5 * (a + b);

  for (let i = 0; i < MAX_REFINE_STEPS; i++) {
    const value = polyEval(coeffs, x);
    if (value === 0) return x;

    if (Math.sign(value) === signA) {
      a = x;
      signA = Math.sign(value);
    } else {
      b = x;
    }

    // A zero slope divides to an infinity, which fails the bracket test below
    // and bisects -- no special case needed.
    const slope = polyEval(derivative, x);
    let next = x - value / slope;
    if (!(a < next && next < b)) next = 0.5 * (a + b);

    if (Math.abs(next - x) <= Number.EPSILON * Math.max(1, Math.abs(x))) return next;
    x = next;
  }
  return x;
}

/**
 * Every real root of `coeffs` inside `[lo, hi]`, ascending and deduplicated.
 *
 * Degree 4 and up recurse: the roots of the derivative split `[lo, hi]` into
 * intervals on which the polynomial is monotone, so each interval holds at most
 * one root and a sign change is both necessary and sufficient to find it. A
 * critical point that evaluates to zero is a touching root and is reported
 * there -- that is the branch tangency lands in.
 */
export function realRootsInInterval(coeffs: readonly number[], lo: number, hi: number): number[] {
  if (hi < lo) return [];

  const p = polyTrim(coeffs);
  const degree = p.length - 1;
  if (degree <= 0) return [];

  if (degree <= 3) {
    const closed = degree === 1
      ? linearOrConstantRoots(p)
      : degree === 2
        ? quadraticRoots(p[0]!, p[1]!, p[2]!)
        : cubicRoots(p[0]!, p[1]!, p[2]!, p[3]!);
    return dedupeSorted(closed.filter((root) => lo <= root && root <= hi).sort((x, y) => x - y));
  }

  const critical = realRootsInInterval(polyDerivative(p), lo, hi);
  const nodes = dedupeSorted([lo, ...critical, hi].sort((x, y) => x - y));

  const roots: number[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]!;
    const b = nodes[i + 1]!;
    const fa = polyEval(p, a);
    const fb = polyEval(p, b);

    if (isRootValue(p, a, fa)) roots.push(a);
    if (i === nodes.length - 2 && isRootValue(p, b, fb)) roots.push(b);
    if (fa !== 0 && fb !== 0 && Math.sign(fa) !== Math.sign(fb)) {
      roots.push(refineBracketed(p, a, b, fa));
    }
  }
  return dedupeSorted(roots.sort((x, y) => x - y));
}

/**
 * Every real root, found by bracketing the whole spectrum with Cauchy's bound
 * `1 + max |a_i / a_n|` and handing that interval to `realRootsInInterval`.
 */
export function realRoots(coeffs: readonly number[]): number[] {
  const p = polyTrim(coeffs);
  if (p.length <= 1) return [];

  let maxRatio = 0;
  for (let i = 1; i < p.length; i++) {
    const ratio = Math.abs(p[i]! / p[0]!);
    if (ratio > maxRatio) maxRatio = ratio;
  }
  const bound = 1 + maxRatio;
  return realRootsInInterval(p, -bound, bound);
}

/** Collapses runs of near-identical values in an already sorted list. */
function dedupeSorted(values: readonly number[]): number[] {
  const out: number[] = [];
  for (const value of values) {
    const previous = out[out.length - 1];
    if (previous === undefined || Math.abs(value - previous) > 1e-10 * Math.max(1, Math.abs(value))) {
      out.push(value);
    }
  }
  return out;
}
