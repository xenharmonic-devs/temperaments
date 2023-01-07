import {describe, it, expect} from 'vitest';
import {
  dot,
  Fraction,
  PRIMES,
  PRIME_CENTS,
  toMonzoAndResidual,
} from 'xen-dev-utils';

import {tenneyVals, vanishCommas} from '../optimization';
import {Subgroup} from '../subgroup';

describe('Comma vanisher', () => {
  it('can make the syntonic comma disappear (tempered octaves)', () => {
    const jip = PRIME_CENTS.slice(0, 3);
    const syntonic = [-4, 4, -1];
    const mapping = vanishCommas([syntonic], jip);
    expect(dot(mapping, syntonic)).toBeCloseTo(0);

    const octave = mapping[0];
    expect(octave).not.toBe(1200);
    expect(octave).toBeLessThan(1202);
    expect(octave).toBeGreaterThan(1198);
  });

  it('can make the syntonic comma disappear (tempered octaves with weights)', () => {
    const syntonic = [-4, 4, -1];
    const mapping = vanishCommas([syntonic], undefined, [100, 3, 2]);
    expect(dot(mapping, syntonic)).toBeCloseTo(0);

    const octave = mapping[0];
    expect(octave).not.toBe(1200);
    expect(octave).toBeLessThan(1201);
    expect(octave).toBeGreaterThan(1199);
  });

  it('can make the syntonic comma disappear (pure octaves)', () => {
    const syntonic = [-4, 4, -1];
    const mapping = vanishCommas([syntonic], undefined, undefined, false);
    expect(dot(mapping, syntonic)).toBeCloseTo(0);

    const octave = mapping[0];
    expect(octave).toBe(1200);

    const twelfth = mapping[1];
    expect(twelfth).not.toBe(PRIME_CENTS[1]);
    expect(twelfth).toBeLessThan(1905);
    expect(twelfth).toBeGreaterThan(1896);

    const five = mapping[2];
    expect(five).not.toBe(PRIME_CENTS[2]);
    expect(five).toBeLessThan(2789);
    expect(five).toBeGreaterThan(2783);
  });

  it('can handle multiple commas', () => {
    const mapping = vanishCommas(['225/224', '1029/1024']);
    expect(dot(mapping, [-5, 2, 2, -1])).toBeCloseTo(0);
    expect(dot(mapping, [-10, 1, 0, 3])).toBeCloseTo(0);
  });

  it('can handle big subgroups (ratio units)', () => {
    const primes = PRIMES.slice(0, 25);
    const commas = [
      toMonzoAndResidual(new Fraction(621, 620), 25)[0],
      toMonzoAndResidual(new Fraction(87, 86), 25)[0],
      toMonzoAndResidual(new Fraction(98, 97), 25)[0],
    ];
    const mapping = vanishCommas(commas, primes, undefined, false, 'ratio');

    for (const comma of commas) {
      let interval = 1;
      for (let i = 0; i < 25; ++i) {
        interval *= mapping[i] ** comma[i];
      }
      expect(interval).toBeCloseTo(1);
    }
  });
});

describe('Tenney-Euclid optimal val combiner', () => {
  it('calculates POTE meantone', () => {
    const jip = PRIME_CENTS.slice(0, 3);
    const twelve = [12, 19, 28];
    const nineteen = [19, 30, 44];

    const mapping = tenneyVals([twelve, nineteen], jip);

    const syntonic = [-4, 4, -1];
    expect(dot(mapping, syntonic)).toBeCloseTo(0);

    const pote = mapping.map(m => (1200 * m) / mapping[0]);
    expect(dot(pote, [-1, 1, 0])).toBeCloseTo(696.239);
  });

  it('calculates TE magic', () => {
    const mapping = tenneyVals([19, 22], new Subgroup(5));
    const magic = [-10, -1, 5];
    expect(dot(mapping, magic)).toBeCloseTo(0);
  });
});
