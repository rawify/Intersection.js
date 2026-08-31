import type { CubicBezier, Intersection } from './types.js';
import { clamp01 } from './internal/eps.js';
import { boundsOfCubicHull, boundsOverlap } from './bounds.js';
import { cubicPointAt, cubicTangentAt, isFiniteCubic, splitCubic } from './internal/bezier.js';
import { finalize, intersection } from './internal/result.js';

/**
 * Parameter width at which a cell stops being subdivided.
 *
 * The stop is on the *parameter* interval rather than on the control hull, and
 * that choice is what keeps the search bounded. Hull-based subdivision resolves
 * a transversal crossing in a handful of cells but needs on the order of
 * `1/tolerance²` of them for a tangential touch, where the two hulls keep
 * overlapping instead of separating. Stopping at a fixed parameter width caps
 * the depth at `log2(1/tolerance)` per curve and hands the accuracy problem to
 * the refinement below, which is far better at it.
 */
const PARAM_TOLERANCE = 1e-3;

/**
 * Hull size, relative to the curves' extent, at which a cell has collapsed to a
 * point and there is nothing left to subdivide.
 *
 * Only degenerate input gets here -- a zero-length segment, or a cusp where the
 * curve stands still. Without it those cells would be split all the way down to
 * `PARAM_TOLERANCE`, producing a thousand identical candidates for a curve that
 * is a single point.
 */
const GEOMETRY_TOLERANCE = 1e-12;

/**
 * Candidate cells accepted before the pair is declared overlapping.
 *
 * Two cubics cross in at most nine points (Bezout), and each crossing costs a
 * few cells. A shared span costs one cell per step along the whole diagonal, so
 * it trips this immediately -- which is the overlap test.
 */
const MAX_CANDIDATES = 64;

/** Residual, relative to the curves' extent, still counted as a touch. */
const RESIDUAL_EPS = 1e-7;

interface Cell {
  readonly a: CubicBezier;
  readonly at0: number;
  readonly at1: number;
  readonly b: CubicBezier;
  readonly bt0: number;
  readonly bt1: number;
}

/**
 * Intersections of two cubic Beziers.
 *
 * The only pair here without a closed form worth having -- implicitizing a
 * cubic leaves a degree-9 system -- so it is solved in two stages. First,
 * recursive subdivision: split whichever cell is coarser in its own parameter,
 * throw away pairs whose control hulls no longer overlap, and keep what is left
 * as candidates. Second, each candidate is sharpened by a Levenberg-Marquardt
 * iteration on `|P₁(t) - P₂(s)|²`.
 *
 * The damped least-squares step is what makes tangential contact work. Plain
 * Newton on `P₁(t) - P₂(s) = 0` has a singular Jacobian exactly where the
 * curves touch, and stalls; adding the damping term turns the same iteration
 * into a descent on the distance, which converges either way. Crossings come
 * back accurate to rounding, touches to roughly `1e-7` of the curves' extent.
 *
 * Curves that overlap along a shared span do not have isolated intersection
 * points, and an empty array is returned for them -- two identical curves
 * included.
 */
export function bezierBezier(first: CubicBezier, second: CubicBezier): Intersection[] {
  if (!isFiniteCubic(first) || !isFiniteCubic(second)) return [];

  const hullA = boundsOfCubicHull(first);
  const hullB = boundsOfCubicHull(second);
  if (!boundsOverlap(hullA, hullB)) return [];

  const extent = Math.max(
    hullA.maxX - hullA.minX,
    hullA.maxY - hullA.minY,
    hullB.maxX - hullB.minX,
    hullB.maxY - hullB.minY,
    1,
  );

  const stack: Cell[] = [{ a: first, at0: 0, at1: 1, b: second, bt0: 0, bt1: 1 }];
  const candidates: Array<{ t: number; s: number }> = [];

  const geometryTolerance = GEOMETRY_TOLERANCE * extent;

  while (stack.length > 0) {
    const cell = stack.pop()!;
    const boundsA = boundsOfCubicHull(cell.a);
    const boundsB = boundsOfCubicHull(cell.b);
    if (!boundsOverlap(boundsA, boundsB)) continue;

    const spanA = cell.at1 - cell.at0;
    const spanB = cell.bt1 - cell.bt0;
    const sizeA = Math.max(boundsA.maxX - boundsA.minX, boundsA.maxY - boundsA.minY);
    const sizeB = Math.max(boundsB.maxX - boundsB.minX, boundsB.maxY - boundsB.minY);
    const doneA = spanA <= PARAM_TOLERANCE || sizeA <= geometryTolerance;
    const doneB = spanB <= PARAM_TOLERANCE || sizeB <= geometryTolerance;

    if (doneA && doneB) {
      candidates.push({ t: 0.5 * (cell.at0 + cell.at1), s: 0.5 * (cell.bt0 + cell.bt1) });
      if (candidates.length > MAX_CANDIDATES) return [];
      continue;
    }

    if (!doneA && (doneB || spanA >= spanB)) {
      const middle = 0.5 * (cell.at0 + cell.at1);
      const [left, right] = splitCubic(cell.a, 0.5);
      stack.push({ ...cell, a: left, at1: middle });
      stack.push({ ...cell, a: right, at0: middle });
    } else {
      const middle = 0.5 * (cell.bt0 + cell.bt1);
      const [left, right] = splitCubic(cell.b, 0.5);
      stack.push({ ...cell, b: left, bt1: middle });
      stack.push({ ...cell, b: right, bt0: middle });
    }
  }

  const results: Intersection[] = [];
  for (const candidate of candidates) {
    const refined = refinePair(first, second, candidate.t, candidate.s, extent);
    if (refined) results.push(refined);
  }

  // Folded at the accuracy this routine claims: several cells around a
  // tangential touch each converge to a point a few 1e-8 apart, and those are
  // one intersection, not three.
  return finalize(results, RESIDUAL_EPS * extent);
}

/**
 * Levenberg-Marquardt on `F(t, s) = P₁(t) - P₂(s)`.
 *
 * Solves `(JᵀJ + λ·diag) δ = -JᵀF` and only keeps a step that lowers the
 * squared distance, so the iteration is monotone and cannot run away. `λ`
 * shrinks while steps succeed, which makes this behave like Gauss-Newton (hence
 * quadratic) at a transversal crossing, and grows where the Jacobian goes
 * singular, which is what lets a tangential touch converge at all.
 *
 * Returns `null` for a candidate cell that turned out to be a near miss.
 */
function refinePair(
  first: CubicBezier,
  second: CubicBezier,
  startT: number,
  startS: number,
  extent: number,
): Intersection | null {
  let t = clamp01(startT);
  let s = clamp01(startS);

  let pa = cubicPointAt(first, t);
  let pb = cubicPointAt(second, s);
  let fx = pa.x - pb.x;
  let fy = pa.y - pb.y;
  let squared = fx * fx + fy * fy;
  let damping = 1e-3;

  for (let i = 0; i < 40 && squared > 0; i++) {
    const da = cubicTangentAt(first, t);
    const db = cubicTangentAt(second, s);

    // JᵀJ and JᵀF for J = [da, -db].
    const a11 = da.x * da.x + da.y * da.y;
    const a12 = -(da.x * db.x + da.y * db.y);
    const a22 = db.x * db.x + db.y * db.y;
    const g1 = da.x * fx + da.y * fy;
    const g2 = -(db.x * fx + db.y * fy);

    const scale = Math.max(a11 + a22, Number.MIN_VALUE);
    const m11 = a11 + damping * scale;
    const m22 = a22 + damping * scale;
    const determinant = m11 * m22 - a12 * a12;
    if (!(determinant > 0)) break;

    const deltaT = (-g1 * m22 + a12 * g2) / determinant;
    const deltaS = (-g2 * m11 + a12 * g1) / determinant;

    const nextT = clamp01(t + deltaT);
    const nextS = clamp01(s + deltaS);
    const nextA = cubicPointAt(first, nextT);
    const nextB = cubicPointAt(second, nextS);
    const nextFx = nextA.x - nextB.x;
    const nextFy = nextA.y - nextB.y;
    const nextSquared = nextFx * nextFx + nextFy * nextFy;

    if (nextSquared >= squared) {
      // Rejected step: trust the linearization less and try again from here.
      damping *= 8;
      if (damping > 1e12) break;
      continue;
    }

    const moved = Math.max(Math.abs(nextT - t), Math.abs(nextS - s));
    t = nextT;
    s = nextS;
    pa = nextA;
    pb = nextB;
    fx = nextFx;
    fy = nextFy;
    squared = nextSquared;
    damping = Math.max(damping / 8, 1e-14);

    if (moved <= Number.EPSILON) break;
  }

  if (Math.sqrt(squared) > RESIDUAL_EPS * extent) return null;
  return intersection({ x: 0.5 * (pa.x + pb.x), y: 0.5 * (pa.y + pb.y) }, t, s);
}
