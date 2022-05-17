import {describe, it, expect} from 'vitest';
import Fraction from 'fraction.js';

import {dot, fractionToMonzoAndResidual} from '../monzo';
import {inverseLogMetric, Temperament, natsToCents} from '../temperament';

describe('Temperament', () => {
  it('calculates meantone from vals', () => {
    const subgroup = [0, 1, 2];
    const metric = inverseLogMetric(subgroup);
    const edo12 = [12, 19, 28];
    const edo19 = [19, 30, 44];
    const temperament = Temperament.fromValList(
      [edo12, edo19],
      subgroup,
      metric
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

  it('calculates meantone from commas', () => {
    const subgroup = [0, 1, 2];
    const metric = inverseLogMetric(subgroup);
    const syntonicComma = fractionToMonzoAndResidual(
      new Fraction(81, 80),
      3
    )[0];
    const temperament = Temperament.fromCommaList(
      [syntonicComma],
      subgroup,
      metric
    );
    const meantone = temperament.toPOTE();

    const fifth = fractionToMonzoAndResidual(new Fraction(3, 2), 3)[0];
    const octave = [1, 0, 0];

    expect(dot(meantone, syntonicComma)).toBeCloseTo(0);
    expect(dot(meantone, octave)).toBeCloseTo(Math.LN2);
    expect(natsToCents(dot(meantone, fifth))).toBeCloseTo(696.239);
  });

  it('calculates miracle from commas', () => {
    const subgroup = [0, 1, 2, 3];
    const marvelComma = fractionToMonzoAndResidual(
      new Fraction(225, 224),
      4
    )[0];
    const gamelisma = fractionToMonzoAndResidual(
      new Fraction(1029, 1024),
      4
    )[0];
    const temperament = Temperament.fromCommaList(
      [marvelComma, gamelisma],
      subgroup
    );
    const miracle = temperament.toPOTE();

    const largeSecor = fractionToMonzoAndResidual(new Fraction(15, 14), 4)[0];
    const smallSecor = fractionToMonzoAndResidual(new Fraction(16, 15), 4)[0];
    const octave = [1, 0, 0, 0];

    expect(dot(miracle, marvelComma)).toBeCloseTo(0);
    expect(dot(miracle, gamelisma)).toBeCloseTo(0);
    expect(dot(miracle, octave)).toBeCloseTo(Math.LN2);
    expect(natsToCents(dot(miracle, smallSecor))).toBeCloseTo(116.675);
    expect(natsToCents(dot(miracle, largeSecor))).toBeCloseTo(116.675);
  });

  it('calculates orgone from commas', () => {
    const subgroup = [0, 3, 4];
    const orgonisma = fractionToMonzoAndResidual(
      new Fraction(65536, 65219),
      5
    )[0];
    const temperament = Temperament.fromCommaList([orgonisma], subgroup);
    const orgone = temperament.toPOTE();
    const smitone = fractionToMonzoAndResidual(new Fraction(77, 64), 5)[0];
    const octave = [1, 0, 0, 0, 0];

    expect(dot(orgone, orgonisma)).toBeCloseTo(0);
    expect(dot(orgone, octave)).toBeCloseTo(Math.LN2);
    expect(natsToCents(dot(orgone, smitone))).toBeCloseTo(323.372);
  });

  it('calculates blackwood in the 2.3 subgroup', () => {
    const limma = fractionToMonzoAndResidual(new Fraction(256, 243), 2)[0];
    const temperament = Temperament.fromCommaList([limma]);
    const blackwood = temperament.toPOTE();
    const fifth = [-1, 1];

    expect(blackwood.length).toBe(2);
    expect(dot(blackwood, fifth)).toBeCloseTo((3 * Math.LN2) / 5);
  });

  it('calculates blackwood in the 2.3.5 subgroup', () => {
    const subgroup = [0, 1, 2];
    const limma = fractionToMonzoAndResidual(new Fraction(256, 243), 3)[0];
    const temperament = Temperament.fromCommaList([limma], subgroup);
    const blackwood = temperament.toPOTE();
    const majorThird = fractionToMonzoAndResidual(new Fraction(5, 4), 3)[0];
    const fifth = [-1, 1, 0];

    expect(blackwood.length).toBe(3);
    expect(dot(blackwood, fifth)).toBeCloseTo((3 * Math.LN2) / 5);
    expect(natsToCents(dot(blackwood, majorThird))).toBeCloseTo(399.594);
  });

  it('calculates arcturus in the 3.5.7 subgroup', () => {
    const comma = fractionToMonzoAndResidual(new Fraction(15625, 15309), 4)[0];
    const temperament = Temperament.fromCommaList([comma]);
    const arcturus = temperament.toPOTE();
    const majorSixth = fractionToMonzoAndResidual(new Fraction(5, 3), 4)[0];

    expect(arcturus.length).toBe(4);
    expect(natsToCents(dot(arcturus, majorSixth))).toBeCloseTo(878.042);
  });
});
