import {describe, it, expect} from 'vitest';
import Fraction from 'fraction.js';

import {numberToMonzoAndResidual, fractionToMonzoAndResidual} from '../monzo';

describe('Number to monzo converter', () => {
  it('can break down an integer to its prime components', () => {
    const [monzo, residual] = numberToMonzoAndResidual(360, 3);
    expect(residual).toBe(1);
    expect(monzo[0]).toBe(3);
    expect(monzo[1]).toBe(2);
    expect(monzo[2]).toBe(1);
    expect(2 ** monzo[0] * 3 ** monzo[1] * 5 ** monzo[2]).toBe(360);
  });
});

describe('Fraction to monzo converter', () => {
  it('can break down a fraction to its prime components', () => {
    const [monzo, residual] = fractionToMonzoAndResidual(
      new Fraction(45, 32),
      3
    );
    expect(residual.equals(1)).toBeTruthy();
    expect(monzo[0]).toBe(-5);
    expect(monzo[1]).toBe(2);
    expect(monzo[2]).toBe(1);
    expect(
      new Fraction(2)
        .pow(monzo[0])
        .mul(3 ** monzo[1])
        .mul(5 ** monzo[2])
        .equals(new Fraction(45, 32))
    ).toBeTruthy();
  });
});