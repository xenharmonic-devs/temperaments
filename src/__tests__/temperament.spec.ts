import {describe, it, expect} from 'vitest';
import {Temperament, FreeTemperament} from '../temperament';
import {Subgroup} from '../subgroup';
import {
  dot,
  toMonzo,
  toMonzoAndResidual,
  arraysEqual,
  Fraction,
  LOG_PRIMES,
  mmod,
  natsToCents,
  monzoToFraction,
} from 'xen-dev-utils';
import {simplifyCommas} from '../monzo';

describe('Temperament', () => {
  it('supports equal temperaments', () => {
    const edo12 = Temperament.fromVals([12], 5);

    const majorThird = edo12.steps('5/4');
    const perfectFifth = edo12.steps('3/2');

    expect(majorThird).toBe(4);
    expect(perfectFifth).toBe(7);
  });

  it('calculates meantone from vals', () => {
    const subgroup = new Subgroup([2, 3, 5]);
    const edo12 = [12, 19, 28];
    const edo19 = [19, 30, 44];
    const temperament = Temperament.fromVals([edo12, edo19], subgroup);
    const meantone = temperament.getMapping();

    const syntonicComma = toMonzoAndResidual(new Fraction(81, 80), 3)[0];
    const fifth = toMonzoAndResidual(new Fraction(3, 2), 3)[0];
    const octave = [1, 0, 0];

    expect(dot(meantone, syntonicComma)).toBeCloseTo(0);
    expect(dot(meantone, octave)).toBeCloseTo(1200);
    expect(dot(meantone, fifth)).toBeCloseTo(696.239);
  });

  it('calculates meantone from commas', () => {
    const subgroup = new Subgroup(5);
    const syntonicComma = toMonzo(new Fraction(81, 80));
    const temperament = Temperament.fromCommas([syntonicComma], subgroup);
    const meantone = temperament.getMapping({units: 'nats'});

    const fifth = toMonzoAndResidual(new Fraction(3, 2), 3)[0];
    const octave = [1, 0, 0];

    expect(dot(meantone, syntonicComma)).toBeCloseTo(0);
    expect(dot(meantone, octave)).toBeCloseTo(Math.LN2);
    expect(natsToCents(dot(meantone, fifth))).toBeCloseTo(696.239);
  });

  it('calculates quarter-comma meantone when constrained to pure major thirds', () => {
    const temperament = Temperament.fromCommas(['81/80']);
    const meantone = temperament.getMapping({
      units: 'nats',
      constraints: ['2/1', '5/4'],
    });

    const syntonicComma = toMonzo('81/80');
    const fifth = toMonzoAndResidual('3/2', 3)[0];
    const third = toMonzo('5/4');
    const octave = [1, 0, 0];

    expect(dot(meantone, syntonicComma)).toBeCloseTo(0);
    expect(dot(meantone, octave)).toBeCloseTo(Math.LN2);
    expect(dot(meantone, fifth)).toBeCloseTo(Math.log(5) / 4, 4);
    expect(dot(meantone, third)).toBeCloseTo(Math.log(5 / 4), 3);
  });

  it('calculates meantone constrained to pure major sixths', () => {
    const temperament = Temperament.fromCommas(['81/80']);
    const meantone = temperament.getMapping({
      units: 'nats',
      constraints: ['2/1', '5/3'],
    });

    const syntonicComma = toMonzo('81/80');
    const sixth = toMonzo('5/3');
    const octave = [1, 0, 0];

    expect(dot(meantone, syntonicComma)).toBeCloseTo(0);
    expect(dot(meantone, octave)).toBeCloseTo(Math.LN2);
    expect(dot(meantone, sixth)).toBeCloseTo(Math.log(5 / 3), 3);
  });

  it('calculates mint constrained to pure thirds and sevenths', () => {
    const temperament = Temperament.fromCommas(['36/35']);
    const mint = temperament.getMapping({
      units: 'nats',
      constraints: ['2/1', '5/4', '7/4'],
    });

    const septimalQuarterTone = toMonzo('36/35');
    const third = toMonzoAndResidual('5/4', 3)[0];
    const seventh = toMonzo('7/4');
    const octave = [1, 0, 0, 0];

    expect(dot(mint, septimalQuarterTone)).toBeCloseTo(0);
    expect(dot(mint, octave)).toBeCloseTo(Math.LN2);
    expect(dot(mint, third)).toBeCloseTo(Math.log(5 / 4), 3);
    expect(dot(mint, seventh)).toBeCloseTo(Math.log(7 / 4), 3);
  });

  it('calculates CTE septimal meantone', () => {
    const temperament = Temperament.fromVals([12, 19], 7);

    const meantone = temperament.getMapping({
      constraints: ['2/1'],
    });

    expect(meantone.length).toBe(4);
    expect(meantone[0]).toBeCloseTo(1200);
    expect(meantone[1]).toBeCloseTo(1896.9521);
    expect(meantone[2]).toBeCloseTo(2787.8085);
    expect(meantone[3]).toBeCloseTo(3369.5214);
  });

  it('reduces to the trivial temperament when given no vals', () => {
    const subgroup = new Subgroup(5);
    const temperament = Temperament.fromVals([], subgroup);
    const trivial = temperament.getMapping({temperEquaves: true});
    const octave = [1, 0, 0];
    const tritave = [0, 1, 0];
    const pentave = [0, 0, 1];

    expect(dot(trivial, octave)).toBe(0);
    expect(dot(trivial, tritave)).toBe(0);
    expect(dot(trivial, pentave)).toBe(0);
  });

  it('reduces to just intonation when given no commas', () => {
    const temperament = Temperament.fromCommas([], 5);
    const justIntonation = temperament.getMapping({
      temperEquaves: true,
      units: 'nats',
    });
    const octave = [1, 0, 0];
    const tritave = [0, 1, 0];
    const pentave = [0, 0, 1];

    expect(dot(justIntonation, octave)).toBeCloseTo(Math.LN2);
    expect(dot(justIntonation, tritave)).toBeCloseTo(Math.log(3));
    expect(dot(justIntonation, pentave)).toBeCloseTo(Math.log(5));
  });

  it('calculates miracle from commas', () => {
    const marvelComma = toMonzo(new Fraction(225, 224));
    const gamelisma = toMonzo(new Fraction(1029, 1024));
    const temperament = Temperament.fromCommas([marvelComma, gamelisma], 7);
    const miracle = temperament.getMapping();

    const largeSecor = toMonzo(new Fraction(15, 14));
    const smallSecor = toMonzoAndResidual(new Fraction(16, 15), 4)[0];
    const octave = [1, 0, 0, 0];

    expect(dot(miracle, marvelComma)).toBeCloseTo(0);
    expect(dot(miracle, gamelisma)).toBeCloseTo(0);
    expect(dot(miracle, octave)).toBeCloseTo(1200);
    expect(dot(miracle, smallSecor)).toBeCloseTo(116.675);
    expect(temperament.tune(largeSecor)).toBeCloseTo(116.675);
  });

  it('calculates miracle from vals', () => {
    const temperament = Temperament.fromVals([10, 21], 7);
    const miracle = temperament.getMapping();

    const marvelComma = toMonzo(new Fraction(225, 224));
    const gamelisma = toMonzo(new Fraction(1029, 1024));
    const largeSecor = toMonzo(new Fraction(15, 14));
    const smallSecor = toMonzoAndResidual(new Fraction(16, 15), 4)[0];
    const octave = [1, 0, 0, 0];

    expect(dot(miracle, marvelComma)).toBeCloseTo(0);
    expect(dot(miracle, gamelisma)).toBeCloseTo(0);
    expect(dot(miracle, octave)).toBeCloseTo(1200);
    expect(dot(miracle, smallSecor)).toBeCloseTo(116.675);
    expect(dot(miracle, largeSecor)).toBeCloseTo(116.675);
  });

  it('calculates orgone from commas', () => {
    const orgonisma = toMonzo(new Fraction(65536, 65219));
    const temperament = Temperament.fromCommas(['65536/65219']);
    const orgone = temperament.getMapping({primeMapping: true});
    const smitone = toMonzo(new Fraction(77, 64));
    const octave = [1, 0, 0, 0, 0];

    expect(dot(orgone, orgonisma)).toBeCloseTo(0);
    expect(dot(orgone, octave)).toBeCloseTo(1200);
    expect(dot(orgone, smitone)).toBeCloseTo(323.372);
  });

  it('calculates orgone from vals', () => {
    const subgroup = new Subgroup('2.7.11');
    const edo11 = subgroup.patentVal(11);
    const edo18 = subgroup.patentVal(18);
    const temperament = Temperament.fromVals([edo11, edo18], subgroup);
    const orgone = temperament.getMapping({primeMapping: true});
    const orgonisma = toMonzo(new Fraction(65536, 65219));
    const smitone = toMonzo(new Fraction(77, 64));
    const octave = [1, 0, 0, 0, 0];

    expect(dot(orgone, orgonisma)).toBeCloseTo(0);
    expect(dot(orgone, octave)).toBeCloseTo(1200);
    expect(dot(orgone, smitone)).toBeCloseTo(323.372);
  });

  it('calculates blackwood in the 2.3 subgroup', () => {
    const temperament = Temperament.fromCommas([new Fraction(256, 243)]);
    const blackwood = temperament.getMapping();
    const fifth = toMonzo(new Fraction(3, 2));

    expect(blackwood.length).toBe(2);
    expect(dot(blackwood, fifth)).toBeCloseTo((3 * 1200) / 5);
  });

  it('calculates blackwood in the 2.3.5 subgroup', () => {
    const subgroup = new Subgroup(5);
    const limma = subgroup.toMonzoAndResidual(new Fraction(256, 243))[0];
    const temperament = Temperament.fromCommas([limma], subgroup);
    const blackwood = temperament.getMapping();
    const majorThird = toMonzo(new Fraction(5, 4));
    const fifth = [-1, 1, 0];

    expect(blackwood.length).toBe(3);
    expect(dot(blackwood, fifth)).toBeCloseTo((3 * 1200) / 5);
    expect(dot(blackwood, majorThird)).toBeCloseTo(399.594);
  });

  it('calculates arcturus in the 3.5.7 subgroup', () => {
    const temperament = Temperament.fromCommas([['15625', '15309']]);
    const arcturus = temperament.getMapping();
    const majorSixth = temperament.subgroup.toMonzoAndResidual(
      new Fraction(5, 3)
    )[0];

    expect(arcturus.length).toBe(3);
    expect(dot(arcturus, majorSixth)).toBeCloseTo(878.042);
  });

  it('calculates starling rank 3 from a comma', () => {
    const comma = toMonzo(new Fraction(126, 125));
    const temperament = Temperament.fromCommas([comma]);
    const starling = temperament.getMapping({temperEquaves: true});
    const septimalQuarterTone = toMonzo(new Fraction(36, 35));
    const jubilisma = toMonzo(new Fraction(50, 49));
    const octave = [1, 0, 0, 0];

    expect(starling.length).toBe(4);
    expect(dot(starling, septimalQuarterTone)).toBeCloseTo(
      dot(starling, jubilisma)
    );
    expect(dot(starling, octave)).toBeGreaterThan(1199);
    expect(dot(starling, octave)).toBeLessThan(1200);
  });

  it('calculates starling rank 3 from a list of vals', () => {
    const subgroup = new Subgroup(7);
    const edo12 = subgroup.patentVal(12);
    const edo27 = subgroup.patentVal(27);
    const edo31 = subgroup.patentVal(31);
    const temperament = Temperament.fromVals([edo12, edo27, edo31], subgroup);
    const starling = temperament.getMapping({temperEquaves: true});
    const comma = toMonzo(new Fraction(126, 125));
    const octave = [1, 0, 0, 0];

    expect(starling.length).toBe(4);
    expect(dot(starling, comma)).toBeCloseTo(0);
    expect(dot(starling, octave)).toBeGreaterThan(1199);
    expect(dot(starling, octave)).toBeLessThan(1200);
    expect(dot(edo12, comma)).toBe(0);
    expect(dot(edo27, comma)).toBe(0);
    expect(dot(edo31, comma)).toBe(0);
  });

  it('calculates marvel rank 3 from a comma', () => {
    const temperament = Temperament.fromCommas(['225/224']);
    const marvel = temperament.getMapping();
    const fifth = toMonzoAndResidual(new Fraction(3, 2), 4)[0];
    const majorThird = toMonzoAndResidual(new Fraction(5, 4), 4)[0];

    expect(marvel.length).toBe(4);
    expect(dot(marvel, fifth)).toBeCloseTo(700.4075);
    expect(dot(marvel, majorThird)).toBeCloseTo(383.6376);
  });

  it('calculates keenanismic rank 4 from a comma', () => {
    const keenanisma = toMonzo(new Fraction(385, 384));
    const temperament = Temperament.fromCommas([keenanisma]);
    const keenanismic = temperament.getMapping();

    expect(keenanismic.length).toBe(5);
    expect(dot(keenanismic, keenanisma)).toBeCloseTo(0);
  });

  it('calculates keenanismic rank 4 from a list of vals', () => {
    const temperament = Temperament.fromVals([9, 10, '12e', 15], 11);
    const keenanismic = temperament.getMapping();

    const keenanisma = toMonzo(new Fraction(385, 384));
    expect(keenanismic.length).toBe(5);
    expect(dot(keenanismic, keenanisma)).toBeCloseTo(0);
  });

  it('has a consistent internal representation for the same temperament in 3D', () => {
    const subgroup = new Subgroup(5);

    const twelveAndNineteen = Temperament.fromVals([12, 19], subgroup);
    const twelveAndThirtyOne = Temperament.fromVals([12, 31], subgroup);
    const nineteenAndThirtyOne = Temperament.fromVals([19, 31], subgroup);
    const meantone = Temperament.fromCommas([{n: 81, d: 80}]);

    for (let i = 0; i < 2 ** 3; ++i) {
      expect(meantone.value[i]).toBe(Math.floor(meantone.value[i]));
      expect(twelveAndNineteen.value[i]).toBeCloseTo(meantone.value[i]);
      expect(twelveAndThirtyOne.value[i]).toBeCloseTo(meantone.value[i]);
      expect(nineteenAndThirtyOne.value[i]).toBeCloseTo(-meantone.value[i]);
    }
  });

  it('has a consistent internal representation for the same temperament in 4D', () => {
    const subgroup = new Subgroup(7);
    const edo9 = subgroup.patentVal(9);
    const comma = toMonzo(new Fraction(225, 224));

    const nineAndTenAndTwelve = Temperament.fromVals([edo9, 10, 12], subgroup);
    const marvel = Temperament.fromCommas([comma], subgroup);

    for (let i = 0; i < 2 ** 4; ++i) {
      expect(marvel.value[i]).toBe(Math.floor(marvel.value[i]));
      expect(nineAndTenAndTwelve.value[i]).toBeCloseTo(marvel.value[i]);
    }
  });

  it('has a consistent internal representation for the same temperament in 4D with a 3D comma', () => {
    const subgroup = new Subgroup(7);

    const tenAndTwelveAndFortySix = Temperament.fromVals(
      [10, 12, 46],
      subgroup
    );
    const diaschismic = Temperament.fromCommas(['2048/2025'], subgroup);

    for (let i = 0; i < 2 ** 4; ++i) {
      expect(diaschismic.value[i]).toBe(Math.floor(diaschismic.value[i]));
      expect(tenAndTwelveAndFortySix.value[i]).toBeCloseTo(
        -diaschismic.value[i]
      );
    }
  });

  it('can figure out the period and a generator for meantone', () => {
    const syntonicComma = toMonzo(new Fraction(81, 80));
    const temperament = Temperament.fromCommas([syntonicComma]);
    const [numPeriods, generator] = temperament.numPeriodsGenerator();

    expect(numPeriods).toBe(1);
    expect(generator.length).toBe(3);

    const meantone = temperament.getMapping();
    const poteGenerator = 696.239;

    // XXX: This is technically not the correct check. 1200 - poteGenerator is also valid.
    expect(dot(meantone, generator) % 1200).toBeCloseTo(poteGenerator);
  });

  it('can figure out the period and a generator for orgone', () => {
    const orgonisma = toMonzo(new Fraction(65536, 65219));
    const temperament = Temperament.fromCommas([orgonisma]);
    const [period, generator] = temperament.periodGenerator();

    expect(period).toBeCloseTo(1200);
    const poteGenerator = 323.372;
    expect(generator).toBeCloseTo(poteGenerator);
  });

  it('can figure out the period and a generator for blackwood', () => {
    const limma = toMonzoAndResidual(new Fraction(256, 243), 3)[0];
    const subgroup = new Subgroup(5);
    const temperament = Temperament.fromCommas([limma], subgroup);
    const [period, generator] = temperament.periodGenerator();

    expect(period).toBeCloseTo(240);
    const poteGenerator = 399.594;
    expect(generator).toBeCloseTo(mmod(-poteGenerator, 240));
  });

  it('can figure out the period and a generator for augmented', () => {
    const diesis = toMonzo(new Fraction(128, 125));
    const subgroup = new Subgroup(5);
    const temperament = Temperament.fromCommas([diesis], subgroup);
    const [period, generator] = temperament.periodGenerator();

    expect(period).toBeCloseTo(400);
    const poteGenerator = 706.638;
    expect(generator).toBeCloseTo(mmod(-poteGenerator, 400));
  });

  it('can figure out the period and a generator for miracle', () => {
    const temperament = Temperament.fromCommas(['225/224', '1029/1024']);
    const [period, generator] = temperament.periodGenerator();

    expect(period).toBeCloseTo(1200);
    const poteGenerator = 116.675;
    expect(generator).toBeCloseTo(poteGenerator);
  });

  it('can figure out the generators of whitewood', () => {
    const temperament = Temperament.fromCommas(['2187/2048'], 5);
    const generators = temperament.generators();

    expect(generators[0]).toBeCloseTo(1200 / 7);
    expect(generators[1]).toBeCloseTo(mmod(374.469, 1200 / 7));
  });

  it('can figure out the generators of kleismic', () => {
    const temperament = Temperament.fromCommas(['15625/15552'], 7);
    const generators = temperament.generators();

    const mapping = temperament.getMapping();

    expect(generators[0]).toBeCloseTo(mapping[0]);
    expect(generators[1]).toBeCloseTo(mmod(-mapping[3], 1200));
    expect(generators[2]).toBeCloseTo(mmod(mapping[1] - mapping[2], 1200));
  });

  it('can figure out the generators of manwe', () => {
    const temperament = Temperament.fromCommas(['176/175', '1331/1323']);
    const generators = temperament.generators();

    const mapping = temperament.getMapping();

    expect(generators[0]).toBeCloseTo(mapping[0]);
    expect(generators[1]).toBeCloseTo(mmod(-mapping[1], 1200));
    expect(generators[2]).toBeCloseTo(mmod(mapping[2], 1200));
  });

  it('can figure out the generators of kalismic', () => {
    const temperament = Temperament.fromCommas(['9801/9800']);
    const generators = temperament.generators();

    const mapping = temperament.getMapping();

    expect(generators[0]).toBeCloseTo(600);
    expect(generators[0]).toBeCloseTo(temperament.tune('99/70'));
    expect(generators[1]).toBeCloseTo(mmod(mapping[1], 600));
    expect(generators[2]).toBeCloseTo(mmod(-mapping[2], 600));
    expect(generators[3]).toBeCloseTo(mmod(-mapping[4], 600));
  });

  it('can figure out the generators of xeimtionic', () => {
    const temperament = Temperament.fromCommas(['625/616']);

    const generators = temperament.generators();
    const mapping = temperament.getMapping();

    expect(generators[0]).toBeCloseTo(1200);
    expect(generators[1]).toBeCloseTo(mmod(mapping[1], 1200));
    expect(generators[2]).toBeCloseTo(mmod(mapping[3], 1200));
  });

  it('can figure out the generators of rank-2 xeimtionic', () => {
    const temperament = Temperament.fromCommas(['245/242', '625/616']);
    const generators = temperament.generators();
    const periodGenerator = temperament.periodGenerator();

    expect(generators[1]).toBeCloseTo(periodGenerator[1]);
  });

  it('can figure out the generators of frostmic', () => {
    const temperament = Temperament.fromCommas(['245/242']);
    const generators = temperament.generators();
    const mapping = temperament.getMapping();

    expect(generators[0]).toBeCloseTo(1200);
    expect(generators[1]).toBeCloseTo(mmod(-mapping[2], 1200));
    expect(generators[2]).toBeCloseTo(mmod(mapping[3], 1200));
  });

  it('can recover semaphore from its prefix', () => {
    const diesis = toMonzo(new Fraction(49, 48));
    const temperament = Temperament.fromCommas([diesis]);
    temperament.canonize();
    expect(temperament.subgroup.basis.length).toBe(3);
    const subgroup = new Subgroup('2.3.7');
    const prefix = temperament.rankPrefix();
    expect(prefix.length).toBe(2);
    expect(prefix[0]).toBe(2);
    expect(prefix[1]).toBe(1);
    const recovered = Temperament.fromPrefix(2, prefix, subgroup);
    recovered.canonize();
    expect(temperament.equals(recovered)).toBeTruthy();
  });

  it('can recover miracle from its prefix', () => {
    const temperament = Temperament.fromCommas(['225/224', '1029/1024']);
    temperament.canonize();
    expect(temperament.subgroup.basis.length).toBe(4);
    const prefix = temperament.rankPrefix(2);
    expect(prefix.length).toBe(3);
    expect(prefix[0]).toBe(6);
    expect(prefix[1]).toBe(-7);
    expect(prefix[2]).toBe(-2);
    const recovered = Temperament.fromPrefix(2, prefix, temperament.subgroup);
    recovered.canonize();
    expect(temperament.equals(recovered)).toBeTruthy();
  });

  it('can recover augmented from its prefix', () => {
    const diesis = toMonzo(new Fraction(128, 125));
    const subgroup = new Subgroup(5);
    const temperament = Temperament.fromCommas([diesis], subgroup);
    temperament.canonize();
    expect(temperament.subgroup.basis.length).toBe(3);
    const prefix = temperament.rankPrefix(2);
    expect(prefix.length).toBe(2);
    expect(prefix[0]).toBe(3);
    expect(prefix[1]).toBe(0);
    const recovered = Temperament.fromPrefix(2, prefix, subgroup);
    recovered.canonize();
    expect(temperament.equals(recovered)).toBeTruthy();
  });

  it('calculates marvel rank 3 from its prefix', () => {
    const comma = toMonzo(new Fraction(225, 224));
    const temperament = Temperament.fromCommas([comma]);
    temperament.canonize();
    const prefix = temperament.rankPrefix(3);
    const recovered = Temperament.fromPrefix(3, prefix, temperament.subgroup);
    recovered.canonize();
    expect(temperament.equals(recovered)).toBeTruthy();
  });

  it('can handle a fractional non-orthogonal JI subgroup such as 2.3.13/5.19/5 (pinkan)', () => {
    const subgroup = new Subgroup('2.3.13/5.19/5');
    const islandComma = subgroup.toMonzoAndResidual('676/675')[0];
    const password = subgroup.toMonzoAndResidual('1216/1215')[0];
    const temperament = Temperament.fromCommas(
      [islandComma, password],
      subgroup
    );
    const pinkan = temperament.getMapping();

    const [d, g] = temperament.numPeriodsGenerator();

    const semifourth = subgroup.toMonzoAndResidual(new Fraction(15, 13))[0];
    const octave = [1, 0, 0, 0];

    expect(d).toBe(1);
    expect(dot(pinkan, islandComma)).toBeCloseTo(0);
    expect(dot(pinkan, password)).toBeCloseTo(0);
    expect(dot(pinkan, octave)).toBeCloseTo(1200);
    expect(dot(pinkan, semifourth)).toBeCloseTo(248.868);
    expect(mmod(dot(pinkan, g), 1200)).toBeCloseTo(1200 - 248.868);

    const primePinkan = temperament.getMapping({primeMapping: true});

    const fullSemifourth = toMonzoAndResidual('15/13', 8)[0];
    expect(mmod(dot(primePinkan, fullSemifourth), 1200)).toBeCloseTo(248.868);
  });

  it('can val-join temperaments', () => {
    const edo12 = Temperament.fromVals([12], 7);
    const edo19 = Temperament.fromVals([19], 7);
    const meantone = edo12.valJoin(edo19);

    const expected = Temperament.fromVals([12, 19], 7);
    meantone.canonize();
    expected.canonize();
    expect(meantone.equals(expected)).toBeTruthy();

    const edo31 = Temperament.fromVals([31], 7);
    const jointone = meantone.valJoin(edo31);
    jointone.canonize();
    expect(meantone.equals(jointone)).toBeTruthy();
  });

  it('can val-meet temperaments', () => {
    const meantone = Temperament.fromVals([12, 19], 7);
    const flattone = Temperament.fromCommas(['81/80', '525/512']);
    const nineteen = meantone.valMeet(flattone).canonize();

    const expected = Temperament.fromVals([19], 7);
    expected.canonize();
    expect(nineteen.equals(expected)).toBeTruthy();
  });

  it('can calculate JI mapping', () => {
    const augmented = Temperament.fromVals([3, 12], 5);
    const period = [1 / 3, 0, 0]; // [-2, 0, 1] works too
    const tritave = [0, 1, 0];
    const mapping = augmented.basisMapping([period, tritave]);

    expect(mapping.length).toBe(2);
    expect(arraysEqual(mapping[0], [3, 0, 7])).toBeTruthy();
    expect(arraysEqual(mapping[1], [0, 1, 0])).toBeTruthy();
  });

  it('ignores extra linearly dependent vals', () => {
    const meantone = Temperament.fromVals([12, 19, 31], 7);
    expect(meantone.getRank()).toBe(2);
  });

  it('ignores extra linearly dependent commas', () => {
    const twelve = Temperament.fromCommas(['81/80', '128/125', '2048/2025']);
    expect(twelve.getRank()).toBe(1);
  });

  it('supports fractional subgroup commas given in a prime basis', () => {
    const terrain = Temperament.fromCommas([[-4, 6, -6, 3]], '2.9/5.9/7', true);

    const [comma, residual] =
      terrain.subgroup.toMonzoAndResidual('250047/250000');
    expect(residual.equals(1)).toBeTruthy();
    expect(terrain.tune(comma)).toBeCloseTo(0);
  });

  it('can construct tobago temperament', () => {
    const subgroup = new Subgroup('2.3.11.13/5');
    const commas = [
      [-1, 5, 0, 0, -2],
      [2, -3, -2, 0, 0, 2],
    ];
    const tobago = Temperament.fromCommas(commas, subgroup, true);

    for (const comma of commas) {
      expect(tobago.tune(comma, {primeMapping: true})).toBeCloseTo(0);
    }
  });

  it('can handle sparse fractional subgroups', () => {
    const owowhatsthismatic = Temperament.fromCommas(
      [[-2, 3, -1, 0, 0, 0, 0, 0, 1, 0, -1]],
      '2.3.155/23',
      true
    );
    expect(owowhatsthismatic.value).toHaveLength(8);
    expect(owowhatsthismatic.tune('621/620')).toBeCloseTo(0);
  });

  it('can factorize meantone into vals', () => {
    const meantone = Temperament.fromCommas(['81/80']);
    const factors = meantone.valFactorize();
    expect(factors).toHaveLength(2);
    expect(arraysEqual(factors[0], [5, 8, 12])).toBeTruthy();
    expect(arraysEqual(factors[1], [7, 11, 16])).toBeTruthy();
  });

  it('can factorize barton into vals', () => {
    const barton = Temperament.fromCommas(
      ['2200/2197', '6656/6655'],
      '2.5.11.13'
    );
    const factors = barton.valFactorize();
    expect(factors).toHaveLength(2);
    expect(arraysEqual(factors[0], [11, 26, 38, 41])).toBeTruthy();
    expect(arraysEqual(factors[1], [13, 30, 45, 48])).toBeTruthy();
  });

  it('can factorize haumea into vals', () => {
    const haumea = Temperament.fromCommas(
      ['352/351', '676/675', '847/845'],
      '2.3.7/5.11/5.13/5'
    );
    const factors = haumea.valFactorize();
    expect(factors).toHaveLength(2);
    expect(arraysEqual(factors[0], [5, 8, 2, 6, 7])).toBeTruthy();
    expect(arraysEqual(factors[1], [24, 38, 12, 27, 33])).toBeTruthy();
  });

  it('can factorize jamesbond into vals', () => {
    const jamesbond = Temperament.fromCommas(['25/24', '81/80'], 7);
    const factors = jamesbond.valFactorize(2, 99, 1);
    expect(factors).toHaveLength(2);
    expect(arraysEqual(factors[0], [7, 11, 16, 19])).toBeTruthy();
    expect(arraysEqual(factors[1], [7, 11, 16, 20])).toBeTruthy();
  });

  it('can factorize escapismic into vals', () => {
    const escapismic = Temperament.fromCommas([
      [24, -6, 0, 1, -5],
      [32, -7, -9],
    ]);
    const factors = escapismic.valFactorize(2, 600, 0, 'GPV');
    expect(factors).toHaveLength(3);
    expect(factors[0][0]).toBe(21);
    expect(factors[1][0]).toBe(22);
    expect(factors[2][0]).toBe(521);
  });

  it('has sanity limits in val factoring', () => {
    const temperament = Temperament.fromPrefix(2, [0, 3, 3], '2.5.7.11');
    const factors = temperament.valFactorize(5, 100, 0, 'GM');
    expect(factors).toHaveLength(2);
  });

  it('can factorize miracle into commas', () => {
    const miracle = Temperament.fromVals([10, 21], 7);
    const factors = miracle.commaFactorize();
    const commas = simplifyCommas(factors);
    expect(commas.map(c => monzoToFraction(c).toFraction()).join(', ')).toBe(
      '225/224, 1029/1024'
    );
  });

  it('can factorize 12edo into commas', () => {
    const twelve = Temperament.fromVals([12], 5);
    const factors = twelve.commaFactorize();
    const commas = simplifyCommas(factors);
    expect(commas.map(c => monzoToFraction(c).toFraction()).join(', ')).toBe(
      '81/80, 128/125'
    );
  });

  it('can factorize enlil into commas', () => {
    const subgroup = new Subgroup(13);
    const prefix = [0, 6, -6, 0, 5, -5, 0, -1, -14, 14];
    const temperament = Temperament.fromPrefix(3, prefix, subgroup);
    const reconstructed = Temperament.fromCommas(
      temperament.commaFactorize(),
      subgroup
    );
    expect(
      reconstructed.equals(temperament) ||
        reconstructed.value.neg().equals(temperament.value)
    ).toBeTruthy();
  });
});

describe('Free Temperament', () => {
  it('supports equal temperaments', () => {
    const jip = [Math.LN2, Math.log(5), Math.log(9 / 7)];
    const marveltri = FreeTemperament.fromVals([13], jip);

    const majorThird = marveltri.steps([-2, 1, 0]);
    const supermajorThird = marveltri.steps([0, 0, 1]);

    expect(majorThird).toBe(4);
    expect(supermajorThird).toBe(5);

    expect(marveltri.tune([-2, 1, 0], {units: 'ratio'})).toBeCloseTo(
      2 ** (4 / 13)
    );
  });

  it('calculates meantone from vals', () => {
    const jip = LOG_PRIMES.slice(0, 3);
    const edo12 = [12, 19, 28];
    const edo19 = [19, 30, 44];
    const temperament = FreeTemperament.fromVals([edo12, edo19], jip);
    const meantone = temperament.getMapping();

    const syntonicComma = toMonzo(new Fraction(81, 80));
    const fifth = toMonzoAndResidual(new Fraction(3, 2), 3)[0];
    const octave = [1, 0, 0];

    expect(dot(meantone, syntonicComma)).toBeCloseTo(0);
    expect(dot(meantone, octave)).toBeCloseTo(1200);
    expect(dot(meantone, fifth)).toBeCloseTo(696.239);
  });

  it('can handle a fractional JI subgroup such as 2.3.13/5 (barbados)', () => {
    const monzo = toMonzo(new Fraction(676, 675));
    const islandComma = [monzo[0], monzo[1], monzo[5]];
    const jip = [Math.LN2, LOG_PRIMES[1], LOG_PRIMES[5] - LOG_PRIMES[2]];
    const temperament = FreeTemperament.fromCommas([islandComma], jip);

    const barbados = temperament.getMapping({units: 'nats'});

    const [period, generator] = temperament.periodGenerator();

    temperament.canonize();
    const prefix = temperament.rankPrefix(2);
    const recovered = FreeTemperament.fromPrefix(2, prefix, jip);
    recovered.canonize();

    const genMonzo = toMonzo(new Fraction(15, 13));
    const semifourth = [genMonzo[0], genMonzo[1], genMonzo[5]];
    const octave = [1, 0, 0];

    expect(period).toBeCloseTo(1200);
    expect(dot(barbados, islandComma)).toBeCloseTo(0);
    expect(dot(barbados, octave)).toBeCloseTo(Math.LN2);
    expect(natsToCents(dot(barbados, semifourth))).toBeCloseTo(248.621);
    expect(temperament.tune(semifourth)).toBeCloseTo(248.621);
    expect(generator).toBeCloseTo(248.621);
    expect(temperament.equals(recovered)).toBeTruthy();
  });

  it('can handle a fractional non-orthogonal JI subgroup such as 2.3.13/5.19/5 (pinkan)', () => {
    const islandComma_ = toMonzo(new Fraction(676, 675));
    const password_ = toMonzo(new Fraction(1216, 1215));
    const islandComma = [islandComma_[0], islandComma_[1], islandComma_[5], 0];
    const password = [password_[0], password_[1], password_[5], password_[7]];
    const jip = [
      Math.LN2,
      LOG_PRIMES[1],
      LOG_PRIMES[5] - LOG_PRIMES[2],
      LOG_PRIMES[7] - LOG_PRIMES[2],
    ];
    const temperament = FreeTemperament.fromCommas(
      [islandComma, password],
      jip
    );
    const pinkan = temperament.getMapping();

    const [d, g] = temperament.numPeriodsGenerator();

    const semifourth_ = toMonzo(new Fraction(15, 13));
    const semifourth = [semifourth_[0], semifourth_[1], semifourth_[5], 0];
    const octave = [1, 0, 0, 0];

    expect(d).toBe(1);
    expect(dot(pinkan, islandComma)).toBeCloseTo(0);
    expect(dot(pinkan, password)).toBeCloseTo(0);
    expect(dot(pinkan, octave)).toBeCloseTo(1200);
    expect(dot(pinkan, semifourth)).toBeCloseTo(248.868);
    expect(mmod(dot(pinkan, g), 1200)).toBeCloseTo(1200 - 248.868);
  });
});
