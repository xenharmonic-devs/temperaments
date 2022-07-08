import {describe, it, expect} from 'vitest';

import {getCommaNames, getRank2GivenName, namedComma} from '../names';
import {fractionToMonzo, fractionToMonzoAndResidual} from '../monzo';
import {Temperament} from '../temperament';
import {arraysEqual, Fraction} from 'xen-dev-utils';

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
    const temperament = Temperament.fromCommas([limma], 5);
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
    const temperament = Temperament.fromCommas(commas, subgroup);
    temperament.canonize();
    expect(getRank2GivenName(temperament)).toBe('Haumea');
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

describe('Comma retriever', () => {
  it('knows about ragisma', () => {
    const comma = namedComma('ragisma', true);
    expect(arraysEqual(comma, [-1, -7, 4, 1])).toBeTruthy();
  });

  it('can reproduce an example from README.md', () => {
    const pinkan = Temperament.fromCommas(
      [namedComma('island comma'), namedComma('password')],
      '2.3.13/5.19/5'
    );

    expect(pinkan.tune('15/13')).toBeCloseTo(248.868);
  });
});

describe('Temperament monkey patch', () => {
  it('knows about the given name, color and wedgie of Magic', () => {
    const temperament = Temperament.fromVals([19, 22], 5);
    const names = temperament.getNames();
    expect(names.given).toBe('Magic');
    expect(names.color).toBe('Laquinyo');
    expect(names.wedgie).toBe('<<5,1,-10]]');
  });

  it('can be constructed from a name', () => {
    const temperament = Temperament.fromName('Injera');
    temperament.canonize();
    expect(
      arraysEqual(temperament.value.vector(2), [2, 8, 8, 8, 7, -4])
    ).toBeTruthy();
  });

  it('can be constructed from a lower case name', () => {
    const temperament = Temperament.fromName('passion');
    temperament.canonize();
    expect(arraysEqual(temperament.value.vector(2), [5, -4, -18])).toBeTruthy();
  });

  it('can be constructed from a color', () => {
    const temperament = Temperament.fromColor('Sazoquingubi Nowa + La');
    expect(temperament.subgroup.toString()).toBe('2.5.7.11');
    temperament.canonize();
    expect(
      arraysEqual(temperament.value.vector(3), [1, 5, 0, -9])
    ).toBeTruthy();
  });

  it('can be constructed from two colors', () => {
    const temperament = Temperament.fromColor('Sagugu & Zotrigu');
    expect(temperament.subgroup.toString()).toBe('2.3.5.7');
    temperament.canonize();
    expect(
      arraysEqual(temperament.value.vector(2), [2, -4, -16, -11, -31, -26])
    ).toBeTruthy();
  });
});
