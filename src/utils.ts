import Fraction, {NumeratorDenominator} from 'fraction.js';

export type FractionValue =
  | Fraction
  | number
  | string
  | [number | string, number | string]
  | NumeratorDenominator;

export function arraysEqual(a: any[], b: any[]) {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

// Stolen from fraction.js, because it's not exported.
export function gcd(a: number, b: number): number {
  if (!a) return b;
  if (!b) return a;
  while (true) {
    a %= b;
    if (!a) return b;
    b %= a;
    if (!b) return a;
  }
}

export function lcm(a: number, b: number): number {
  return (Math.abs(a) / gcd(a, b)) * Math.abs(b);
}

export function mmod(a: number, b: number) {
  return ((a % b) + b) % b;
}

export function divmod(a: number, b: number): [number, number] {
  const remainder = mmod(a, b);
  const quotient = (a - remainder) / b;
  return [quotient, remainder];
}

export function div(a: number, b: number): number {
  return Math.floor(a / b);
}

// https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm#Pseudocode
// a * result.coefA + b * result.coefB = gcd(a, b) = result.gcd
// result.quotientA = div(a, gcd(a, b))
// result.quotientB = div(b, gcd(a, b))
export function extendedEuclid(a: number, b: number) {
  if (isNaN(a) || isNaN(b)) {
    throw new Error('Invalid input');
  }

  let [rOld, r] = [a, b];
  let [sOld, s] = [1, 0];
  let [tOld, t] = [0, 1];

  while (r !== 0) {
    const quotient = div(rOld, r);
    [rOld, r] = [r, rOld - quotient * r];
    [sOld, s] = [s, sOld - quotient * s];
    [tOld, t] = [t, tOld - quotient * t];
  }

  return {
    coefA: sOld,
    coefB: tOld,
    gcd: rOld,
    quotientA: t,
    quotientB: Math.abs(s),
  };
}

export function iteratedEuclid(params: number[]) {
  if (!params.length) {
    return [];
  }
  const coefs = [1];
  let a = params[0];
  let i = 1;
  while (i < params.length) {
    const ee = extendedEuclid(a, params[i]);
    for (let j = 0; j < coefs.length; ++j) {
      coefs[j] *= ee.coefA;
    }
    a = ee.gcd;
    coefs.push(ee.coefB);
    i++;
  }
  return coefs;
}

// https://stackoverflow.com/a/37716142
// step 1: a basic LUT with a few steps of Pascal's triangle
const BINOMIALS = [
  [1],
  [1, 1],
  [1, 2, 1],
  [1, 3, 3, 1],
  [1, 4, 6, 4, 1],
  [1, 5, 10, 10, 5, 1],
  [1, 6, 15, 20, 15, 6, 1],
  [1, 7, 21, 35, 35, 21, 7, 1],
  [1, 8, 28, 56, 70, 56, 28, 8, 1],
];

// step 2: a function that builds out the LUT if it needs to.
export function binomial(n: number, k: number) {
  while (n >= BINOMIALS.length) {
    const s = BINOMIALS.length;
    const lastRow = BINOMIALS[s - 1];
    const nextRow = [1];
    for (let i = 1; i < s; i++) {
      nextRow.push(lastRow[i - 1] + lastRow[i]);
    }
    nextRow.push(1);
    BINOMIALS.push(nextRow);
  }
  return BINOMIALS[n][k];
}
