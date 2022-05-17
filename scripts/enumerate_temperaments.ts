import {
  Temperament,
  patentVal,
  LOG_PRIMES,
  dot,
  natsToCents,
  gcd,
  monzosEqual,
} from '../src/index';

const temperaments: Temperament[] = [];

const minEdo = 5;
const maxEdo = 53;
for (let a = minEdo; a <= maxEdo; ++a) {
  const valA = patentVal(a, 2, 4);
  for (let b = a + 1; b <= maxEdo; ++b) {
    const valB = patentVal(b, 2, 4);
    const temperament = Temperament.fromValList([valA, valB]);
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
  'cents with off-twos component magintude <=',
  N
);

console.log('Tempering out pairs of commas...');
for (let i = 0; i < commas.length; ++i) {
  for (let j = i + 1; j < commas.length; ++j) {
    const temperament = Temperament.fromCommaList([commas[i], commas[j]]);
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
