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
  natsToCents,
  centsToNats,
  Temperament,
  FreeTemperament,
} from './temperament';
export {patentVal} from './warts';

import {getSingleCommaColorName} from './color';
import {LOG_PRIMES} from './constants';
import {dot, Monzo} from './monzo';
import {Temperament} from './temperament';

let rawRank2Data: Object | undefined;

export function getRank2GivenName(
  temperament: Temperament
): string | undefined {
  const prefix = temperament.rankPrefix(2);
  const recovered = Temperament.fromPrefix(2, prefix, temperament.subgroup);
  recovered.canonize();
  if (!temperament.equals(recovered)) {
    return undefined;
  }
  if (rawRank2Data === undefined) {
    rawRank2Data = require('../resources/x31eqRank2.json');
  }
  const key = prefix.join(',');
  const subgroupData =
    rawRank2Data![temperament.subgroup.toString() as keyof typeof rawRank2Data];
  if (subgroupData === undefined) {
    return undefined;
  }
  return subgroupData[key as keyof typeof subgroupData];
}

// Assumes the argument has been canonized
export function getSingleCommaName(temperament: Temperament) {
  // There should be enough guards in getRank2GivenName to avoid false positives even for rank 3
  const given = getRank2GivenName(temperament);
  let color: string | undefined = undefined;
  try {
    color = getSingleCommaColorName(temperament);
  } catch {}
  return {given, color};
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
    rawCommaData = require('../resources/commas.json');
  }
  const key = monzo.slice(1).join(',');
  return rawCommaData![key as keyof typeof rawCommaData] || [];
}
