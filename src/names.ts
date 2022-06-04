import {LOG_PRIMES} from './constants';
import {dot, Monzo} from './monzo';
import {Temperament} from './temperament';
import {getSingleCommaColorName, parseColorTemperament} from './color';
import {Subgroup, SubgroupValue} from './subgroup';

let rawRank2Data: {[sg: string]: {[key: string]: string}} | undefined;

// Assumes the argument has been canonized
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

let rawCommaData: {[key: string]: string[]} | undefined;

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

const subgroupsByName: {[key: string]: [string, number[]][]} = {};

export function getPrefixByNameAndSubgroup(
  name: string,
  subgroup?: SubgroupValue
): [string, number[]] | undefined {
  if (!Object.keys(subgroupsByName).length) {
    if (rawRank2Data === undefined) {
      rawRank2Data = require('../resources/x31eqRank2.json');
    }
    Object.keys(rawRank2Data!).forEach(sg => {
      const subgroupData = rawRank2Data![sg];
      Object.keys(subgroupData).forEach(prefix => {
        const name_ = subgroupData[prefix];
        subgroupsByName[name_] = subgroupsByName[name_] || [];
        subgroupsByName[name_].push([
          sg,
          prefix.split(',').map(n => parseInt(n)),
        ]);
      });
    });

    Object.values(subgroupsByName).forEach(value => {
      value.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    });
  }
  const values = subgroupsByName[name];
  if (values === undefined) {
    return undefined;
  }
  if (subgroup === undefined) {
    return values[0];
  }
  const subgroupKey = new Subgroup(subgroup).toString();
  for (let i = 0; i < values.length; ++i) {
    if (values[i][0] === subgroupKey) {
      return values[i];
    }
  }
  return undefined;
}

// Monkey patch
Temperament.prototype.getNames = function () {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const temperament: Temperament = this;
  // There should be enough guards in getRank2GivenName to avoid false positives even for rank 3
  const given = getRank2GivenName(temperament);
  let color: string | undefined = undefined;
  try {
    color = getSingleCommaColorName(temperament);
  } catch {}
  const rank = temperament.getRank();
  const wedgie =
    '<'.repeat(rank) +
    temperament.value.vector(rank).join(',') +
    ']'.repeat(rank);
  return {given, color, wedgie};
};

Temperament.fromName = function (
  name: string,
  subgroup?: SubgroupValue
): Temperament {
  const sp = getPrefixByNameAndSubgroup(name, subgroup);
  if (sp === undefined) {
    throw new Error(`Named temperament '${name}' not found`);
  }
  return Temperament.fromPrefix(2, sp[1], sp[0]);
};

Temperament.fromColor = function (color: string) {
  return parseColorTemperament(color);
};
