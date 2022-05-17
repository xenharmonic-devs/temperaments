import {PRIMES} from './constants';
import Fraction from 'fraction.js';

// No interpretation in Geometric Algebra
export type Monzo = number[];

export function monzosEqual(a: Monzo, b: Monzo) {
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

export function numberToMonzoAndResidual(
  n: number,
  numberOfComponents: number
): [Monzo, number] {
  const result: Monzo = [];
  for (let i = 0; i < numberOfComponents; ++i) {
    let component = 0;
    while (n % PRIMES[i] === 0) {
      n /= PRIMES[i];
      component++;
    }
    result.push(component);
  }
  return [result, n];
}

export function numberToMonzo(n: number) {
  if (n < 0) {
    throw new Error('Cannot convert negative number to monzo');
  }
  const result: Monzo = [];
  PRIMES.every(prime => {
    let component = 0;
    while (n % prime === 0) {
      n /= prime;
      component++;
    }
    result.push(component);
    return n !== 1;
  });
  if (n !== 1) {
    throw new Error('Out of primes');
  }
  return result;
}

export function fractionToMonzoAndResidual(
  fraction: Fraction,
  numberOfComponents: number
): [Monzo, Fraction] {
  let numerator = fraction.n;
  let denominator = fraction.d;

  const result: Monzo = [];
  for (let i = 0; i < numberOfComponents; ++i) {
    let component = 0;
    while (numerator % PRIMES[i] === 0) {
      numerator /= PRIMES[i];
      component++;
    }
    while (denominator % PRIMES[i] === 0) {
      denominator /= PRIMES[i];
      component--;
    }
    result.push(component);
  }

  const residual = new Fraction({
    s: fraction.s,
    n: numerator,
    d: denominator,
  });
  return [result, residual];
}

export function fractionToMonzo(fraction: Fraction) {
  if (fraction.s < 0) {
    throw new Error('Cannot convert negative fraction to monzo');
  }
  let numerator = fraction.n;
  let denominator = fraction.d;

  const result: Monzo = [];
  PRIMES.every(prime => {
    let component = 0;
    while (numerator % prime === 0) {
      numerator /= prime;
      component++;
    }
    while (denominator % prime === 0) {
      denominator /= prime;
      component--;
    }
    result.push(component);
    return numerator !== 1 || denominator !== 1;
  });
  if (numerator !== 1 || denominator !== 1) {
    throw new Error('Out of primes');
  }
  return result;
}

export function dot(a: Monzo, b: Monzo): number {
  let result = 0;
  for (let i = 0; i < Math.min(a.length, b.length); ++i) {
    result += a[i] * b[i];
  }
  return result;
}
