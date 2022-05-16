import {describe, it, expect} from 'vitest';
import Fraction from 'fraction.js';

import {dot, fractionToMonzoAndResidual} from '../monzo';
import {inverseLogMetric, Temperament, natsToCents} from '../temperament';

describe('Temperament', () => {
  it('can calculate meantone from vals', () => {
    const subgroup = [0, 1, 2];
    const metric = inverseLogMetric(subgroup);
    const edo12 = [12, 19, 28];
    const edo19 = [19, 30, 44];
    const temperament = Temperament.fromValList(
      [edo12, edo19],
      metric,
      subgroup
    );
    const meantone = temperament.toPOTE();

    const syntonicComma = fractionToMonzoAndResidual(
      new Fraction(81, 80),
      3
    )[0];
    const fifth = fractionToMonzoAndResidual(new Fraction(3, 2), 3)[0];
    const octave = [1, 0, 0];

    expect(dot(meantone, syntonicComma)).toBeCloseTo(0);
    expect(dot(meantone, octave)).toBeCloseTo(Math.LN2);
    expect(natsToCents(dot(meantone, fifth))).toBeCloseTo(696.239);
  });

  it('can calculate meantone from commas', () => {
    const subgroup = [0, 1, 2];
    const metric = inverseLogMetric(subgroup);
    const syntonicComma = fractionToMonzoAndResidual(
      new Fraction(81, 80),
      3
    )[0];
    const temperament = Temperament.fromCommaList(
      [syntonicComma],
      metric,
      subgroup
    );
    const meantone = temperament.toPOTE();

    const fifth = fractionToMonzoAndResidual(new Fraction(3, 2), 3)[0];
    const octave = [1, 0, 0];

    expect(dot(meantone, syntonicComma)).toBeCloseTo(0);
    expect(dot(meantone, octave)).toBeCloseTo(Math.LN2);
    expect(natsToCents(dot(meantone, fifth))).toBeCloseTo(696.239);
  });
});
