import {gcd, LOG_PRIMES, natsToCents} from 'xen-dev-utils';
import {Temperament, dot, monzosEqual, getRank2GivenName} from '../src/index';
import {Subgroup} from '../src/subgroup';

const subgroup = new Subgroup(7);

const temperaments: Temperament[] = [];

const minEdo = 5;
const maxEdo = 53;
for (let a = minEdo; a <= maxEdo; ++a) {
  const valA = subgroup.patentVal(a);
  for (let b = a + 1; b <= maxEdo; ++b) {
    const valB = subgroup.patentVal(b);
    const temperament = Temperament.fromVals([valA, valB], subgroup);
    if (temperament.isNil()) {
      continue;
    }
    temperament.canonize();
    let novel = true;
    for (let i = 0; i < temperaments.length; ++i) {
      if (temperaments[i].equals(temperament)) {
        novel = false;
      }
    }
    if (novel) {
      temperaments.push(temperament);
    }
  }
}

console.log(
  'There are',
  temperaments.length,
  'unique rank 2 temperaments in the subgroup 2.3.5.7 representable as a combination of two patent vals between 5 and 53 (inclusive).'
);

let allGood = true;
temperaments.forEach(temperament => {
  const prefix = temperament.rankPrefix(2);
  const recovered = Temperament.fromPrefix(2, prefix, subgroup);
  recovered.canonize();
  if (!temperament.equals(recovered)) {
    allGood = false;
    console.log('Unable to recover temperament');
    console.log(temperament);
  }
});

if (allGood) {
  console.log('All of them recoverable from their prefixes.');
}

const names: string[] = [];
temperaments.forEach(temperament => {
  const name = getRank2GivenName(temperament);
  if (name !== undefined) {
    names.push(name);
  }
});
console.log('Found names for', names.length, 'of them.');
console.log("Here's like ten:");
names.slice(0, 10).forEach(name => {
  console.log(name);
});

const commas = [];
const N = 6;
const maxCents = 100;
const jip = LOG_PRIMES.slice(0, 4);
for (let a = 0; a <= N; ++a) {
  for (let b = -N; b <= N; ++b) {
    for (let c = -N; c <= N; ++c) {
      const comma = [0, a, b, c];
      let nats = dot(comma, jip);
      const twos = Math.round(nats / Math.LN2);
      nats -= twos * Math.LN2;
      if (natsToCents(Math.abs(nats)) < maxCents) {
        comma[0] = -twos;
        let commonFactor = comma.reduce(gcd);
        if (nats < 0) {
          commonFactor = -commonFactor;
        }
        for (let i = 0; i < comma.length; ++i) {
          comma[i] /= commonFactor;
        }
        let novel = true;
        for (let i = 0; i < commas.length; ++i) {
          if (monzosEqual(comma, commas[i])) {
            novel = false;
          }
        }
        if (novel) {
          commas.push(comma);
        }
      }
    }
  }
}

console.log(
  'Found',
  commas.length,
  'commas <',
  maxCents,
  'cents with off-twos component magnitude <=',
  N
);

console.log('Tempering out pairs of commas...');
for (let i = 0; i < commas.length; ++i) {
  for (let j = i + 1; j < commas.length; ++j) {
    const temperament = Temperament.fromCommas(
      [commas[i], commas[j]],
      subgroup
    );
    if (temperament.isNil()) {
      continue;
    }
    temperament.canonize();
    let novel = true;
    for (let i = 0; i < temperaments.length; ++i) {
      if (temperaments[i].equals(temperament)) {
        novel = false;
      }
    }
    if (novel) {
      temperaments.push(temperament);
    }
  }
}

console.log(
  'Total of',
  temperaments.length,
  'unique rank 2 temperaments in the subgroup 2.3.5.7'
);

let numIrrecoverable = 0;
let numNamed = 0;
temperaments.forEach(temperament => {
  const prefix = temperament.rankPrefix(2);
  const recovered = Temperament.fromPrefix(2, prefix, subgroup);
  recovered.canonize();
  if (!temperament.equals(recovered)) {
    numIrrecoverable++;
    return;
  }

  if (getRank2GivenName(temperament) !== undefined) {
    numNamed++;
  }
});
console.log('Found names for', numNamed, 'of them.');
console.log(
  'There were',
  numIrrecoverable,
  "temperaments that couldn't be recovered from their prefixes."
);
