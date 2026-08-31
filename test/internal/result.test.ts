import { describe, expect, it } from 'vitest';
import { finalize, intersection } from '../../src/internal/result.js';

describe('intersection', () => {
  it('carries the point and both parameters', () => {
    expect(intersection({ x: 1, y: 2 }, 0.25, 3)).toEqual({ x: 1, y: 2, t1: 0.25, t2: 3 });
  });
});

describe('finalize', () => {
  it('passes zero- and one-element results straight through', () => {
    expect(finalize([])).toEqual([]);
    const single = [intersection({ x: 1, y: 1 }, 0.5, 0.5)];
    expect(finalize(single)).toEqual(single);
  });

  it('orders by the first operand parameter', () => {
    const result = finalize([
      intersection({ x: 2, y: 0 }, 0.8, 0.1),
      intersection({ x: 1, y: 0 }, 0.2, 0.9),
    ]);
    expect(result.map((hit) => hit.x)).toEqual([1, 2]);
  });

  it('folds points that coincide, keeping the first', () => {
    const result = finalize([
      intersection({ x: 5, y: -5 }, 0.25, 1),
      intersection({ x: 5 + 1e-13, y: -5 - 1e-13 }, 0.75, 2),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.t1).toBe(0.25);
  });

  it('keeps two crossings that are genuinely distinct, however close', () => {
    const result = finalize([
      intersection({ x: 0, y: 0 }, 0.1, 0.1),
      intersection({ x: 1e-6, y: 0 }, 0.2, 0.2),
    ]);
    expect(result).toHaveLength(2);
  });

  it('takes an explicit tolerance from a routine that resolves points coarsely', () => {
    const results = [
      intersection({ x: 0, y: 0 }, 0.1, 0.1),
      intersection({ x: 1e-6, y: 0 }, 0.2, 0.2),
    ];
    expect(finalize(results)).toHaveLength(2);
    expect(finalize(results, 1e-5)).toHaveLength(1);
  });

  it('scales the duplicate tolerance with the coordinates', () => {
    // At a magnitude of 1e9 the last few digits of a double are worth ~1e-7,
    // so two results that far apart are the same point, not two.
    const result = finalize([
      intersection({ x: 1e9, y: 1e9 }, 0.4, 0.4),
      intersection({ x: 1e9 + 1e-4, y: 1e9 }, 0.6, 0.6),
    ]);
    expect(result).toHaveLength(1);
  });
});
