import { describe, expect, it } from 'vitest';
import type { Arc } from '../src/types.js';
import { arcFromCircle, lineArc } from '../src/line-arc.js';
import { TAU } from '../src/internal/eps.js';

const upperHalf: Arc = { x: 0, y: 0, rx: 1, ry: 1, alpha: 0, beta: Math.PI };

describe('lineArc', () => {
  it('keeps only the crossing that lies on the sweep', () => {
    const hits = lineArc({ x: 0, y: -2 }, { x: 0, y: 2 }, upperHalf);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.y).toBeCloseTo(1, 12);
    expect(hits[0]!.t2).toBeCloseTo(Math.PI / 2, 12);
  });

  it('keeps both when the sweep is the whole ellipse', () => {
    expect(lineArc({ x: 0, y: -2 }, { x: 0, y: 2 }, { ...upperHalf, beta: 0 })).toHaveLength(2);
    expect(lineArc({ x: 0, y: -2 }, { x: 0, y: 2 }, { ...upperHalf, beta: TAU })).toHaveLength(2);
  });

  it('finds nothing when the segment only meets the discarded half', () => {
    expect(lineArc({ x: -2, y: -0.5 }, { x: 2, y: -0.5 }, upperHalf)).toEqual([]);
  });

  it('handles a sweep that wraps past zero', () => {
    // From -45° round to 45°, i.e. the right-hand quarter.
    const rightQuarter: Arc = { ...upperHalf, alpha: -Math.PI / 4, beta: Math.PI / 4 };
    const hits = lineArc({ x: -2, y: 0 }, { x: 2, y: 0 }, rightQuarter);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.x).toBeCloseTo(1, 12);
  });

  it('works on an elliptical, rotated arc', () => {
    const arc: Arc = { x: 1, y: 1, rx: 4, ry: 2, phi: 0.4, alpha: 0, beta: Math.PI };
    const all = lineArc({ x: -9, y: 1 }, { x: 9, y: 1 }, { ...arc, beta: 0 });
    const half = lineArc({ x: -9, y: 1 }, { x: 9, y: 1 }, arc);

    expect(all).toHaveLength(2);
    expect(half).toHaveLength(1);
    expect(half[0]!.t2).toBeLessThanOrEqual(Math.PI);
  });
});

describe('arcFromCircle', () => {
  it('builds a circular arc with equal radii', () => {
    expect(arcFromCircle({ x: 2, y: 3, r: 5 }, 0, Math.PI))
      .toEqual({ x: 2, y: 3, rx: 5, ry: 5, phi: 0, alpha: 0, beta: Math.PI });
  });

  it('is accepted by lineArc', () => {
    const arc = arcFromCircle({ x: 0, y: 0, r: 2 }, Math.PI, TAU);
    const hits = lineArc({ x: 0, y: -5 }, { x: 0, y: 5 }, arc);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.y).toBeCloseTo(-2, 12);
  });
});
