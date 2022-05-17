import {describe, it, expect} from 'vitest';
import Fraction from 'fraction.js';

import {dot, fractionToMonzoAndResidual, fractionToMonzo} from '../monzo';
import {
  inverseLogMetric,
  Temperament,
  natsToCents,
  patentVal,
} from '../temperament';

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
    const syntonicComma = fractionToMonzo(new Fraction(81, 80));
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
    const marvelComma = fractionToMonzo(new Fraction(225, 224));
    const gamelisma = fractionToMonzo(new Fraction(1029, 1024));
    const temperament = Temperament.fromCommaList(
      [marvelComma, gamelisma],
      subgroup
    );
    const miracle = temperament.toPOTE();

    const largeSecor = fractionToMonzo(new Fraction(15, 14));
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
    const orgonisma = fractionToMonzo(new Fraction(65536, 65219));
    const temperament = Temperament.fromCommaList([orgonisma], subgroup);
    const orgone = temperament.toPOTE();
    const smitone = fractionToMonzo(new Fraction(77, 64));
    const octave = [1, 0, 0, 0, 0];

    expect(dot(orgone, orgonisma)).toBeCloseTo(0);
    expect(dot(orgone, octave)).toBeCloseTo(Math.LN2);
    expect(natsToCents(dot(orgone, smitone))).toBeCloseTo(323.372);
  });

  it('calculates orgone from vals', () => {
    const subgroup = [0, 3, 4];
    const edo11 = patentVal(11, 2, 5);
    const edo18 = patentVal(18, 2, 5);
    const temperament = Temperament.fromValList([edo11, edo18], subgroup);
    const orgone = temperament.toPOTE();
    const orgonisma = fractionToMonzo(new Fraction(65536, 65219));
    const smitone = fractionToMonzo(new Fraction(77, 64));
    const octave = [1, 0, 0, 0, 0];

    expect(dot(edo11, orgonisma)).toBe(0);
    expect(dot(edo18, orgonisma)).toBe(0);
    expect(dot(orgone, orgonisma)).toBeCloseTo(0);
    expect(dot(orgone, octave)).toBeCloseTo(Math.LN2);
    expect(natsToCents(dot(orgone, smitone))).toBeCloseTo(323.372);
  });

  it('calculates blackwood in the 2.3 subgroup', () => {
    const limma = fractionToMonzo(new Fraction(256, 243));
    const temperament = Temperament.fromCommaList([limma]);
    const blackwood = temperament.toPOTE();
    const fifth = fractionToMonzo(new Fraction(3, 2));

    expect(blackwood.length).toBe(2);
    expect(dot(blackwood, fifth)).toBeCloseTo((3 * Math.LN2) / 5);
  });

  it('calculates blackwood in the 2.3.5 subgroup', () => {
    const subgroup = [0, 1, 2];
    const limma = fractionToMonzoAndResidual(new Fraction(256, 243), 3)[0];
    const temperament = Temperament.fromCommaList([limma], subgroup);
    const blackwood = temperament.toPOTE();
    const majorThird = fractionToMonzo(new Fraction(5, 4));
    const fifth = [-1, 1, 0];

    expect(blackwood.length).toBe(3);
    expect(dot(blackwood, fifth)).toBeCloseTo((3 * Math.LN2) / 5);
    expect(natsToCents(dot(blackwood, majorThird))).toBeCloseTo(399.594);
  });

  it('calculates arcturus in the 3.5.7 subgroup', () => {
    const comma = fractionToMonzo(new Fraction(15625, 15309));
    const temperament = Temperament.fromCommaList([comma]);
    const arcturus = temperament.toPOTE();
    const majorSixth = fractionToMonzoAndResidual(new Fraction(5, 3), 4)[0];

    expect(arcturus.length).toBe(4);
    expect(natsToCents(dot(arcturus, majorSixth))).toBeCloseTo(878.042);
  });

  it('calculates starling rank 3 from a comma', () => {
    const comma = fractionToMonzo(new Fraction(126, 125));
    const temperament = Temperament.fromCommaList([comma]);
    const starling = temperament.toTenneyEuclid();
    const septimalQuarterTone = fractionToMonzo(new Fraction(36, 35));
    const jubilisma = fractionToMonzo(new Fraction(50, 49));
    const octave = [1, 0, 0, 0];

    expect(starling.length).toBe(4);
    expect(dot(starling, septimalQuarterTone)).toBeCloseTo(
      dot(starling, jubilisma)
    );
    expect(natsToCents(dot(starling, octave))).toBeGreaterThan(1199);
    expect(natsToCents(dot(starling, octave))).toBeLessThan(1200);
  });

  it('calculates starling rank 3 from a list of vals', () => {
    const edo12 = patentVal(12, 2, 4);
    const edo27 = patentVal(27, 2, 4);
    const edo31 = patentVal(31, 2, 4);
    const temperament = Temperament.fromValList([edo12, edo27, edo31]);
    const starling = temperament.toTenneyEuclid();
    const comma = fractionToMonzo(new Fraction(126, 125));
    const octave = [1, 0, 0, 0];

    expect(starling.length).toBe(4);
    expect(dot(starling, comma)).toBeCloseTo(0);
    expect(natsToCents(dot(starling, octave))).toBeGreaterThan(1199);
    expect(natsToCents(dot(starling, octave))).toBeLessThan(1200);
    expect(dot(edo12, comma)).toBe(0);
    expect(dot(edo27, comma)).toBe(0);
    expect(dot(edo31, comma)).toBe(0);
  });
});
