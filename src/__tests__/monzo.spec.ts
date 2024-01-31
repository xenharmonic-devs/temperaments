import {describe, it, expect} from 'vitest';
import {Fraction, monzoToFraction} from 'xen-dev-utils';
import {simplifyCommas, spell, split} from '../monzo';

describe('Respeller', () => {
  it('knows that 81/64 should be spelled 5/4 in meantone', () => {
    const spelling = spell('81/64', ['81/80']);
    expect(spelling.minBenedetti.equals('5/4')).toBeTruthy();
  });

  it('knows that the major third is 9/7 in pajara', () => {
    const third = new Fraction('3/2').div('7/5').pow(4)!;
    const spelling = spell(third, ['50/49', '64/63']);
    expect(spelling.minBenedetti.equals('9/7')).toBeTruthy();
    expect(spelling.noTwosMinNumerator.equals('32/25')).toBeTruthy();
    expect(spelling.noTwosMinDenominator.equals('81/64')).toBeTruthy();
  });

  it('knows that the minor third is 7/6 is in pajara', () => {
    const third = new Fraction('4/3').pow(3)!.div('10/7').div('10/7');
    const spelling = spell(third, ['50/49', '64/63']);
    expect(spelling.minBenedetti.equals('7/6')).toBeTruthy();
  });

  it('knows that the minor third is 6/5 in srutal', () => {
    const third = new Fraction('3/2').div('45/32').pow(3)!;
    const spelling = spell(third, ['2048/2025', '4375/4374']);
    expect(spelling.minBenedetti.equals('6/5')).toBeTruthy();
  });

  it('knows that the major third is 5/4 is in srutal', () => {
    const third = new Fraction('4/3').pow(2)!.div('45/32');
    const spelling = spell(third, ['2048/2025', '4375/4374']);
    expect(spelling.minBenedetti.equals('5/4')).toBeTruthy();
  });
});

describe('Splitter', () => {
  it('can split the octave in pajara', () => {
    const tritone = split('2/1', ['50/49', '64/63']);
    const spelling = spell(tritone, ['50/49', '64/63']);
    expect(spelling.minBenedetti.equals('7/5')).toBeTruthy();
  });

  it('can split the fifth in mohaha', () => {
    const neutralThird = split('3/2', ['81/80', '121/120']);
    const spelling = spell(neutralThird, ['81/80', '121/120']);
    expect(spelling.minBenedetti.equals('11/9')).toBeTruthy();
  });
});

describe('Comma simplifier', () => {
  it('can simplify the commas of uniwiz', () => {
    const commas = ['289/288', '561/560', '1089/1088'];
    const simplified = simplifyCommas(commas).map(c =>
      monzoToFraction(c).toFraction()
    );
    expect(simplified.join(', ')).toBe('289/288, 385/384, 561/560');
  });
});
