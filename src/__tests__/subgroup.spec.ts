import {describe, it, expect} from 'vitest';
import {Subgroup} from '../subgroup';
import {arraysEqual, Fraction, PRIME_CENTS} from 'xen-dev-utils';

describe('Fractional just intonation subgroup', () => {
  it('can be constructed from a string', () => {
    const subgroup = new Subgroup('2.3.5');
    expect(subgroup.basis.length).toBe(3);
    expect(subgroup.basis[0].equals(2)).toBeTruthy();
    expect(subgroup.basis[1].equals(3)).toBeTruthy();
    expect(subgroup.basis[2].equals(5)).toBeTruthy();
  });

  it('can be constructed from a list of numbers', () => {
    const subgroup = new Subgroup([3, 35, 19]);
    expect(subgroup.basis.length).toBe(3);
    expect(subgroup.basis[0].equals(3)).toBeTruthy();
    expect(subgroup.basis[1].equals(35)).toBeTruthy();
    expect(subgroup.basis[2].equals(19)).toBeTruthy();
  });

  it('can be constructed from a prime limit', () => {
    const subgroup = new Subgroup(11);
    expect(subgroup.basis.length).toBe(5);
    expect(subgroup.basis[0].equals(2)).toBeTruthy();
    expect(subgroup.basis[1].equals(3)).toBeTruthy();
    expect(subgroup.basis[2].equals(5)).toBeTruthy();
    expect(subgroup.basis[3].equals(7)).toBeTruthy();
    expect(subgroup.basis[4].equals(11)).toBeTruthy();
  });

  it('can produce patent vals', () => {
    const subgroup = new Subgroup('2.3.13/5');
    const edo24 = subgroup.patentVal(24);
    expect(edo24[0]).toBe(24);
    expect(edo24[1]).toBe(38);
    expect(edo24[2]).toBe(33);
  });

  it('can parse warts', () => {
    const subgroup = new Subgroup('2.3.13/5');
    const edo24 = subgroup.fromWarts('24bq');
    expect(edo24[0]).toBe(24);
    expect(edo24[1]).toBe(39);
    expect(edo24[2]).toBe(34);
  });

  it('can convert to warts', () => {
    const subgroup = new Subgroup('2.3.13/5');
    const warts = subgroup.toWarts([24, 39, 34]);
    expect(warts).toBe('24bq');
  });

  it('can infer a prime subgroup from commas', () => {
    const subgroup = Subgroup.inferPrimeSubgroup(['81/80', '121/120']);
    expect(subgroup.basis.length).toBe(4);
    expect(subgroup.basis[0].equals(2)).toBeTruthy();
    expect(subgroup.basis[1].equals(3)).toBeTruthy();
    expect(subgroup.basis[2].equals(5)).toBeTruthy();
    expect(subgroup.basis[3].equals(11)).toBeTruthy();
  });

  it('can break down an integer to its subgroup components', () => {
    const subgroup = new Subgroup('2.9.5');
    const [monzo, residual] = subgroup.toMonzoAndResidual(360);
    expect(residual.equals(1)).toBeTruthy();
    expect(monzo[0]).toBe(3);
    expect(monzo[1]).toBe(1);
    expect(monzo[2]).toBe(1);
    expect(2 ** monzo[0] * 9 ** monzo[1] * 5 ** monzo[2]).toBe(360);
  });

  it('can break down a fraction to its subgroup components', () => {
    const subgroup = new Subgroup('2.9.5');
    const [monzo, residual] = subgroup.toMonzoAndResidual(new Fraction(45, 32));
    expect(residual.equals(1)).toBeTruthy();
    expect(monzo[0]).toBe(-5);
    expect(monzo[1]).toBe(1);
    expect(monzo[2]).toBe(1);
    expect(
      new Fraction(2)
        .pow(monzo[0])!
        .mul(9 ** monzo[1])
        .mul(5 ** monzo[2])
        .equals(new Fraction(45, 32))
    ).toBeTruthy();
  });

  it('can break down commas in the 2.3.13/5.19/5 subgroup', () => {
    const subgroup = new Subgroup('2.3.13/5.19/5');
    const [password, passwordResidual] =
      subgroup.toMonzoAndResidual('1216/1215');
    expect(passwordResidual.equals(1)).toBeTruthy();
    expect(arraysEqual(password, [6, -5, 0, 1])).toBeTruthy();
    expect(
      new Fraction(19, 5)
        .pow(password[3])!
        .div(3 ** -password[1])
        .mul(2 ** password[0])
        .equals(new Fraction(1216, 1215))
    ).toBeTruthy();

    const [island, islandResidual] = subgroup.toMonzoAndResidual('676/675');
    expect(islandResidual.equals(1)).toBeTruthy();
    expect(arraysEqual(island, [2, -3, 2, 0])).toBeTruthy();
    expect(
      new Fraction(13, 5)
        .pow(island[2])!
        .div(3 ** -island[1])
        .mul(2 ** island[0])
        .equals(new Fraction(676, 675))
    ).toBeTruthy();
  });

  it('can break down commas when the equave is a fraction', () => {
    const subgroup = new Subgroup('4/3.2.5');
    const [diesis, diesisResidual] = subgroup.toMonzoAndResidual('128/125');
    expect(diesis).toHaveLength(3);
    expect(diesis[0]).toBe(0);
    expect(diesis[1]).toBe(7);
    expect(diesis[2]).toBe(-3);
    expect(diesisResidual.equals(1)).toBeTruthy();

    const [monzo, residual] = subgroup.toMonzoAndResidual('7/3');
    expect(monzo[0]).toBe(1);
    expect(monzo[1]).toBe(-2);
    expect(monzo[2]).toBe(0);
    expect(residual.equals(7)).toBeTruthy();
  });

  it('throws for invalid limits', () => {
    expect(() => new Subgroup(NaN)).toThrow();
    expect(() => new Subgroup(4)).toThrow();
    expect(() => new Subgroup(-5)).toThrow();
  });

  it('throws for invalid fractions', () => {
    expect(() => new Subgroup('1.2.3')).toThrow();
    expect(() => new Subgroup('2.-3')).toThrow();
  });

  it('can convert mappings from fractional basis to primes', () => {
    const subgroup = new Subgroup('2.3.13/5');
    const original = [1200, 1901, 1654];
    const mapping = subgroup.toPrimeMapping(original);
    expect(mapping[0]).toBeCloseTo(1200);
    expect(mapping[1]).toBeCloseTo(1901);
    expect(mapping[3]).toBeCloseTo(PRIME_CENTS[3]);
    expect(mapping[4]).toBeCloseTo(PRIME_CENTS[4]);
    expect(mapping[5] - mapping[2]).toBeCloseTo(1654);
  });

  it("doesn't mutate resolving monzos", () => {
    const subgroup = new Subgroup(11);
    const resolving = [
      [24, -6, 0, 1, -5],
      [32, -7, -9],
    ];
    const resolved = resolving.map(monzo => subgroup.resolveMonzo(monzo, true));
    expect(arraysEqual(resolving[1], [32, -7, -9])).toBeTruthy();
    expect(arraysEqual(resolved[1], [32, -7, -9, 0, 0])).toBeTruthy();
  });

  it('pads resolved monzos', () => {
    const subgroup = new Subgroup(5);
    const monzo = subgroup.resolveMonzo([-3, 2]);
    expect(arraysEqual(monzo, [-3, 2, 0])).toBeTruthy();
  });

  it('iterates over a GPV sequence in 5-limit', () => {
    const subgroup = new Subgroup(5);
    const vals = [...subgroup.generalizedPatentVals(5, 6)];
    expect(arraysEqual(vals[0], [5, 8, 12]));
    expect(arraysEqual(vals[1], [5, 9, 12]));
    expect(arraysEqual(vals[2], [5, 9, 13]));
    expect(arraysEqual(vals[3], [6, 9, 13]));
    expect(arraysEqual(vals[4], [6, 9, 14]));
    expect(arraysEqual(vals[5], [6, 10, 14]));
  });

  it('can list all valid warts', () => {
    const subgroup = new Subgroup('5.41.9.13/7');
    expect(subgroup.wartLetters().join('')).toBe('cmqr');
  });

  it('can convert standard monzos to subgroup monzos', () => {
    const subgroup = new Subgroup('2.9.7/5');
    expect(subgroup.primeMonzoToSubgroupMonzo([1, 2, 2, -2])).toEqual([
      1, 1, -2,
    ]);
  });
});
