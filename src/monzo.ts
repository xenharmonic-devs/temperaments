import {PRIMES} from './constants';
import Fraction from 'fraction.js';

// No interpretation in Geometric Algebra
export type Monzo = number[];

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

export function dot(a: Monzo, b: Monzo): number {
  let result = 0;
  for (let i = 0; i < a.length; ++i) {
    result += a[i] * b[i];
  }
  return result;
}
