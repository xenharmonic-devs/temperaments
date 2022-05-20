export {PRIMES, LOG_PRIMES} from './constants';
export {gcd, lcm, mmod} from './utils';
export {
  monzosEqual,
  numberToMonzo,
  numberToMonzoAndResidual,
  fractionToMonzo,
  fractionToMonzoAndResidual,
  dot,
  type Monzo,
} from './monzo';
export {
  inverseLogMetric,
  flatMetric,
  natsToCents,
  centsToNats,
  inferSubgroup,
  patentVal,
  fromWarts,
  Temperament,
  type Subgroup,
} from './temperament';

import {PRIMES} from './constants';
import {Subgroup} from './temperament';

let rawRank2Data: Object | undefined;

export function getRank2Name(
  subgroup: Subgroup,
  prefix: number[]
): string | undefined {
  if (rawRank2Data === undefined) {
    rawRank2Data = require('./resources/x31eqRank2.json');
  }
  const subgroupString = subgroup.map(i => PRIMES[i]).join('.');
  const key = prefix.join(',');
  const subgroupData =
    rawRank2Data![subgroupString as keyof typeof rawRank2Data];
  if (subgroupData === undefined) {
    return undefined;
  }
  return subgroupData[key as keyof typeof subgroupData];
}
