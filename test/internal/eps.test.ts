import { describe, expect, it } from 'vitest';
import { EPS, PARAM_EPS, TAU, between01, clamp, clamp01, isFinitePoint, relEps } from '../../src/internal/eps.js';

describe('tolerances', () => {
  it('keeps the parameter slack looser than the baseline', () => {
    // Curve parameters come out of a polynomial solve and land a few ulps
    // outside [0, 1]; raw geometric comparisons do not need that much room.
    expect(PARAM_EPS).toBeGreaterThan(EPS);
    expect(TAU).toBe(2 * Math.PI);
  });

  it('scales a tolerance with the magnitude it will be compared against', () => {
    expect(relEps(1)).toBe(EPS);
    expect(relEps(0)).toBe(EPS);
    expect(relEps(0.5)).toBe(EPS);
    expect(relEps(1000)).toBe(EPS * 1000);
    expect(relEps(-1000)).toBe(EPS * 1000);
    expect(relEps(4, 1e-6)).toBe(4e-6);
  });
});

describe('between01', () => {
  it('accepts the closed interval and a sliver either side', () => {
    expect(between01(0)).toBe(true);
    expect(between01(1)).toBe(true);
    expect(between01(0.5)).toBe(true);
    expect(between01(-1e-13)).toBe(true);
    expect(between01(1 + 1e-13)).toBe(true);
  });

  it('rejects anything further out', () => {
    expect(between01(-0.001)).toBe(false);
    expect(between01(1.001)).toBe(false);
    expect(between01(-1e-10)).toBe(false);
    expect(between01(-1e-10, PARAM_EPS)).toBe(true);
    expect(between01(-1e-8, PARAM_EPS)).toBe(false);
  });
});

describe('clamp', () => {
  it('pins a value into its interval from either side', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(4, 0, 10)).toBe(4);
  });

  it('pins a curve parameter into the unit interval', () => {
    expect(clamp01(-1e-13)).toBe(0);
    expect(clamp01(1 + 1e-13)).toBe(1);
    expect(clamp01(0.25)).toBe(0.25);
  });
});

describe('isFinitePoint', () => {
  it('rejects any point that is not fully finite', () => {
    expect(isFinitePoint({ x: 1, y: 2 })).toBe(true);
    expect(isFinitePoint({ x: Number.NaN, y: 2 })).toBe(false);
    expect(isFinitePoint({ x: 1, y: Infinity })).toBe(false);
    expect(isFinitePoint({ x: -Infinity, y: 0 })).toBe(false);
  });
});
