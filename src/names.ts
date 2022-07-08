import {dot, Monzo, monzoToFraction, MonzoValue, resolveMonzo} from './monzo';
import {Temperament} from './temperament';
import {getSingleCommaColorName, parseColorTemperament} from './color';
import {Subgroup, SubgroupValue} from './subgroup';
import {Fraction, LOG_PRIMES} from 'xen-dev-utils';

let rawCommaData: {[key: string]: string[]} | undefined;

export function getCommaNames(comma: MonzoValue): string[] {
  let monzo = resolveMonzo(comma);

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

const commaByName: Map<string, Monzo> = new Map();

export function namedComma(name: string): Fraction;
export function namedComma(name: string, asMonzo: boolean): Monzo;
export function namedComma(name: string, asMonzo?: boolean): Fraction | Monzo {
  if (!commaByName.size) {
    if (rawCommaData === undefined) {
      rawCommaData = require('../resources/commas.json');
    }
    Object.keys(rawCommaData!).forEach(key => {
      const comma = key.split(',').map(c => parseInt(c));
      comma.unshift(0);
      const offTwoSize = dot(comma, LOG_PRIMES);
      comma[0] = -Math.round(offTwoSize / Math.LN2);
      rawCommaData![key].forEach(name => {
        commaByName.set(name.toLowerCase(), comma);
      });
    });
  }
  name = name.toLowerCase();
  if (!commaByName.has(name)) {
    throw new Error(`Unrecognized comma ${name}`);
  }
  const result = commaByName.get(name)!;
  if (asMonzo) {
    return result;
  }
  if (asMonzo !== undefined) {
    throw new Error('Incorrect call signature');
  }
  return monzoToFraction(result);
}

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

const subgroupsByName: Map<string, [string, number[]][]> = new Map();

function getPrefixByNameAndSubgroup(
  name: string,
  subgroup?: SubgroupValue
): [string, number[]] | undefined {
  if (!subgroupsByName.size) {
    if (rawRank2Data === undefined) {
      rawRank2Data = require('../resources/x31eqRank2.json');
    }
    Object.keys(rawRank2Data!).forEach(sg => {
      const subgroupData = rawRank2Data![sg];
      Object.keys(subgroupData).forEach(prefix => {
        const name_ = subgroupData[prefix];
        const subgroupPrefixArray = subgroupsByName.get(name_) || [];
        subgroupPrefixArray.push([sg, prefix.split(',').map(n => parseInt(n))]);
        subgroupsByName.set(name_, subgroupPrefixArray);
      });
    });

    for (const value of subgroupsByName.values()) {
      value.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    }
  }
  name = name.toLowerCase();
  if (name.length) {
    name = name[0].toUpperCase() + name.slice(1);
  }
  const values = subgroupsByName.get(name);
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
