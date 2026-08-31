import { describe, expect, it } from 'vitest';
import { TAU } from '../../src/internal/eps.js';
import { isAngleInArc, isFullSweep, normalizeAngle } from '../../src/internal/angle.js';

describe('normalizeAngle', () => {
  it('folds any angle into [0, 2π)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(TAU)).toBe(0);
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(1.5 * Math.PI, 12);
    expect(normalizeAngle(5 * TAU + 1)).toBeCloseTo(1, 12);
    expect(normalizeAngle(-5 * TAU - 1)).toBeCloseTo(TAU - 1, 12);
  });
});

describe('normalizeAngle, at the seam', () => {
  it('never returns a full turn, however small the negative input', () => {
    // `-1e-17 + TAU` rounds to TAU exactly, which would leave the result
    // outside the half-open range the parametric angles are documented in.
    expect(normalizeAngle(-1e-17)).toBe(0);
    expect(normalizeAngle(-Number.MIN_VALUE)).toBe(0);
    expect(normalizeAngle(-1e-13)).toBeLessThan(TAU);
    expect(normalizeAngle(-1e-13)).toBeGreaterThan(0);
  });
});

describe('isFullSweep', () => {
  it('reads equal start and end angles as the complete ellipse', () => {
    expect(isFullSweep(0, 0)).toBe(true);
    expect(isFullSweep(1.2, 1.2 + TAU)).toBe(true);
    expect(isFullSweep(0, TAU - 1e-12)).toBe(true);
  });

  it('is false for a partial sweep', () => {
    expect(isFullSweep(0, Math.PI)).toBe(false);
    expect(isFullSweep(0, 1e-6)).toBe(false);
  });
});

describe('isAngleInArc', () => {
  it('accepts everything on a full sweep', () => {
    expect(isAngleInArc(2, 0, 0)).toBe(true);
    expect(isAngleInArc(-3, 1, 1)).toBe(true);
  });

  it('covers the counter-clockwise span from alpha to beta', () => {
    expect(isAngleInArc(Math.PI / 2, 0, Math.PI)).toBe(true);
    expect(isAngleInArc(1.5 * Math.PI, 0, Math.PI)).toBe(false);
  });

  it('handles a sweep that wraps past zero', () => {
    // From 300° counter-clockwise to 60°, i.e. across the positive x axis.
    const alpha = (300 / 180) * Math.PI;
    const beta = (60 / 180) * Math.PI;
    expect(isAngleInArc(0, alpha, beta)).toBe(true);
    expect(isAngleInArc(0.9, alpha, beta)).toBe(true);
    expect(isAngleInArc(1.2, alpha, beta)).toBe(false);
    expect(isAngleInArc(Math.PI, alpha, beta)).toBe(false);
    expect(isAngleInArc(TAU - 0.1, alpha, beta)).toBe(true);
  });

  it('keeps a hit that rounds to just before the start of the sweep', () => {
    expect(isAngleInArc(-1e-12, 0, Math.PI)).toBe(true);
    expect(isAngleInArc(Math.PI + 1e-12, 0, Math.PI)).toBe(true);
  });
});
