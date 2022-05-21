import Fraction from 'fraction.js';
import {describe, it, expect} from 'vitest';
import {LOG_PRIMES} from '../constants';

import {
  fractionToMonzoAndResidual,
  getCommaNames,
  getRank2Name,
  Temperament,
} from '../index';
import {fractionToMonzo} from '../monzo';
import {SubgroupTemperament} from '../temperament';

describe('Temperament namer', () => {
  it('knows about meantone', () => {
    expect(getRank2Name([0, 1, 2], [1, 4])).toBe('Meantone');
  });

  it('knows about augmented', () => {
    expect(getRank2Name([0, 1, 2], [3, 0])).toBe('Augmented');
  });

  it('knows about semaphore', () => {
    expect(getRank2Name([0, 1, 3], [2, 1])).toBe('Semaphore');
  });

  it('knows about miracle', () => {
    expect(getRank2Name([0, 1, 2, 3], [6, -7, -2])).toBe('Miracle');
  });

  it('knows about blackwood', () => {
    const subgroup = [0, 1, 2];
    const limma = fractionToMonzoAndResidual(new Fraction(256, 243), 3)[0];
    const temperament = Temperament.fromCommaList([limma], subgroup);
    temperament.canonize();
    const prefix = temperament.rank2Prefix();
    expect(getRank2Name(subgroup, prefix)).toBe('Blackwood');
  });

  it('knows about fractional subgroup temperaments like haumea', () => {
    const subgroup = '2.3.7/5.11/5.13/5';
    const commas = [
      [5, -3, 0, 1, -1],
      [2, -3, 0, 0, 2],
      [0, 0, 1, 2, -2],
    ];
    const jip = [
      Math.LN2,
      LOG_PRIMES[1],
      LOG_PRIMES[3] - LOG_PRIMES[2],
      LOG_PRIMES[4] - LOG_PRIMES[2],
      LOG_PRIMES[5] - LOG_PRIMES[2],
    ];
    const temperament = SubgroupTemperament.fromCommaList(commas, jip);
    temperament.canonize();
    const prefix = temperament.rank2Prefix();
    expect(getRank2Name(subgroup, prefix)).toBe('Haumea');
  });
});

describe('Comma namer', () => {
  it('knows about the syntonic comma', () => {
    expect(getCommaNames([-4, 4, -1]).includes('syntonic comma')).toBeTruthy();
  });

  it('knows about the breedsma', () => {
    expect(
      getCommaNames(fractionToMonzo(new Fraction(2401, 2400))).includes(
        'breedsma'
      )
    ).toBeTruthy();
  });

  it('knows about neutrino', () => {
    expect(
      getCommaNames([1889, -2145, 138, 424]).includes('neutrino')
    ).toBeTruthy();
  });

  it("doesn't know about intervals larger than the octave", () => {
    expect(getCommaNames([-2, 2]).length).toBe(0);
  });

  it("doesn't know about about this comma I just made up", () => {
    expect(getCommaNames([1, 2, 3, 4, 5]).length).toBe(0);
  });
});
