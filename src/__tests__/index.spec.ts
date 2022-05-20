import Fraction from 'fraction.js';
import {describe, it, expect} from 'vitest';

import {fractionToMonzoAndResidual, getRank2Name, Temperament} from '../index';

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
});
