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

import {LOG_PRIMES, PRIMES} from './constants';
import {dot, Monzo} from './monzo';
import {Subgroup} from './temperament';

let rawRank2Data: Object | undefined;

export function getRank2Name(
  subgroup: Subgroup | string,
  prefix: number[]
): string | undefined {
  if (rawRank2Data === undefined) {
    rawRank2Data = require('./resources/x31eqRank2.json');
  }
  let subgroupString;
  if (typeof subgroup === 'string') {
    subgroupString = subgroup;
  } else {
    subgroupString = subgroup.map(i => PRIMES[i]).join('.');
  }
  const key = prefix.join(',');
  const subgroupData =
    rawRank2Data![subgroupString as keyof typeof rawRank2Data];
  if (subgroupData === undefined) {
    return undefined;
  }
  return subgroupData[key as keyof typeof subgroupData];
}

let rawCommaData: Object | undefined;

export function getCommaNames(monzo: Monzo): string[] {
  const size = dot(monzo, LOG_PRIMES);
  if (Math.abs(size) >= Math.LN2) {
    return [];
  }
  if (size < -1e-9) {
    monzo = monzo.map(m => -m);
  }
  if (rawCommaData === undefined) {
    rawCommaData = require('./resources/commas.json');
  }
  const key = monzo.slice(1).join(',');
  return rawCommaData![key as keyof typeof rawCommaData] || [];
}
