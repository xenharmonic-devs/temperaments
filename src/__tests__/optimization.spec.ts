import {describe, it, expect} from 'vitest';
import {
  dot,
  Fraction,
  LOG_PRIMES,
  PRIMES,
  PRIME_CENTS,
  toMonzoAndResidual,
} from 'xen-dev-utils';
import {combineVals, vanishCommas} from '../optimization';

describe('Comma vanisher', () => {
  it('can make the syntonic comma disappear (tempered octaves)', () => {
    const inital = PRIME_CENTS.slice(0, 3);
    const syntonic = [-4, 4, -1];
    const mapping = vanishCommas(inital, [syntonic]);
    expect(dot(mapping, syntonic)).toBeCloseTo(0);

    const octave = mapping[0];
    expect(octave).not.toBe(1200);
    expect(octave).toBeLessThan(1203);
    expect(octave).toBeGreaterThan(1197);
  });

  it('can make the syntonic comma disappear (pure octaves)', () => {
    const inital = PRIME_CENTS.slice(0, 3);
    const syntonic = [-4, 4, -1];
    const mapping = vanishCommas(inital, [syntonic], false);
    expect(dot(mapping, syntonic)).toBeCloseTo(0);

    const octave = mapping[0];
    expect(octave).toBe(1200);

    const twelfth = mapping[1];
    expect(twelfth).not.toBe(PRIME_CENTS[1]);
    expect(twelfth).toBeLessThan(1905);
    expect(twelfth).toBeGreaterThan(1896);

    const five = mapping[2];
    expect(five).not.toBe(PRIME_CENTS[2]);
    expect(five).toBeLessThan(2788);
    expect(five).toBeGreaterThan(2783);
  });

  it('can handle big subgroups (ratio units)', () => {
    const initial = PRIMES.slice(0, 25);
    const commas = [
      toMonzoAndResidual(new Fraction(621, 620), 25)[0],
      toMonzoAndResidual(new Fraction(87, 86), 25)[0],
      toMonzoAndResidual(new Fraction(98, 97), 25)[0],
    ];
    const mapping = vanishCommas(initial, commas, false, 'ratio');

    for (const comma of commas) {
      let interval = 1;
      for (let i = 0; i < 25; ++i) {
        interval *= mapping[i] ** comma[i];
      }
      expect(interval).toBeCloseTo(1);
    }
  });
});

describe('Val combiner', () => {
  it('can combine 12 and 19 into meantone (tempered octaves)', () => {
    const jip = LOG_PRIMES.slice(0, 3);
    const twelve = [12, 19, 28];
    const nineteen = [19, 30, 44];

    const mapping = combineVals(jip, [twelve, nineteen], true, 'nats');

    console.log("nats", mapping.map(m => (m / Math.LN2) * 1200));

    const syntonic = [-4, 4, -1];
    expect(dot(mapping, syntonic)).toBeCloseTo(0);

    const octave = mapping[0];
    expect(octave).not.toBe(Math.LN2);
    expect(octave).toBeLessThan(0.7);
    expect(octave).toBeGreaterThan(0.69);
  });

  it('can combine 12 and 7 into meantone (pure octaves)', () => {
    const jip = PRIME_CENTS.slice(0, 3);
    const twelve = [12, 19, 28];
    const seven = [7, 11, 16];
    // const seven = [19, 30, 44];

    const mapping = combineVals(jip, [twelve, seven], true, 'cents');

    console.log("cents", mapping);

    const syntonic = [-4, 4, -1];
    expect(dot(mapping, syntonic)).toBeCloseTo(0);

    const octave = mapping[0];
    // expect(octave).toBeCloseTo(1200);

    const twelfth = mapping[1];
    expect(twelfth).not.toBe(PRIME_CENTS[1]);
    expect(twelfth).toBeLessThan(1905);
    expect(twelfth).toBeGreaterThan(1896);

    const five = mapping[2];
    expect(five).not.toBe(PRIME_CENTS[2]);
    expect(five).toBeLessThan(2790);
    expect(five).toBeGreaterThan(2783);
  });
});
