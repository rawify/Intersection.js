import type { Intersection, Point } from '../types.js';

/**
 * How close two results must be, relative to their own magnitude, to count as
 * the same intersection. Loose enough to fold the duplicate a double root
 * produces, tight enough to keep two genuinely distinct crossings apart.
 */
const DUPLICATE_EPS = 1e-9;

export function intersection(p: Point, t1: number, t2: number): Intersection {
  return { x: p.x, y: p.y, t1, t2 };
}

/**
 * Sorts by the first operand's parameter and folds duplicates.
 *
 * Two sources of duplicates: a repeated polynomial root reported once per
 * multiplicity, and a subdivision search converging on one crossing from
 * several neighbouring cells. Both should surface as a single point.
 *
 * `tolerance` overrides the default for routines that resolve points less
 * finely than a closed form does -- a numeric solver has to fold at the
 * accuracy it actually claims, or a tangential touch comes back as a cluster of
 * near-identical points.
 */
export function finalize(
  results: readonly Intersection[],
  tolerance?: number,
): Intersection[] {
  if (results.length < 2) return results.slice();

  const sorted = results.slice().sort((a, b) => a.t1 - b.t1);
  const out: Intersection[] = [];

  for (const candidate of sorted) {
    const limit = tolerance ?? DUPLICATE_EPS
      * Math.max(1, Math.abs(candidate.x), Math.abs(candidate.y));

    const duplicate = out.some((kept) => Math.abs(kept.x - candidate.x) <= limit
      && Math.abs(kept.y - candidate.y) <= limit);

    if (!duplicate) out.push(candidate);
  }
  return out;
}
