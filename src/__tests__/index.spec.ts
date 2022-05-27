import Fraction from 'fraction.js';
import {describe, it, expect} from 'vitest';

import {
  fractionToMonzoAndResidual,
  getCommaNames,
  getRank2GivenName,
  Temperament,
} from '../index';
import {fractionToMonzo} from '../monzo';

describe('Temperament namer', () => {
  it('knows about meantone', () => {
    const temperament = Temperament.fromPrefix(2, [1, 4], 5);
    temperament.canonize();
    expect(getRank2GivenName(temperament)).toBe('Meantone');
  });

  it('knows about augmented', () => {
    const temperament = Temperament.fromPrefix(2, [3, 0], 5);
    temperament.canonize();
    expect(getRank2GivenName(temperament)).toBe('Augmented');
  });

  it('knows about semaphore', () => {
    const temperament = Temperament.fromPrefix(2, [2, 1], '2.3.7');
    temperament.canonize();
    expect(getRank2GivenName(temperament)).toBe('Semaphore');
  });

  it('knows about miracle', () => {
    const temperament = Temperament.fromPrefix(2, [6, -7, -2], 7);
    temperament.canonize();
    expect(getRank2GivenName(temperament)).toBe('Miracle');
  });

  it('knows about blackwood', () => {
    const limma = fractionToMonzoAndResidual(new Fraction(256, 243), 3)[0];
    const temperament = Temperament.fromCommaList([limma], 5);
    temperament.canonize();
    expect(getRank2GivenName(temperament)).toBe('Blackwood');
  });

  it('knows about fractional subgroup temperaments like haumea', () => {
    const subgroup = '2.3.7/5.11/5.13/5';
    const commas = [
      [5, -3, 0, 1, -1],
      [2, -3, 0, 0, 2],
      [0, 0, 1, 2, -2],
    ];
    const temperament = Temperament.fromCommaList(commas, subgroup);
    temperament.canonize();
    expect(getRank2GivenName(temperament, subgroup)).toBe('Haumea');
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
