import {FractionValue, Monzo, toMonzo} from 'xen-dev-utils';

/** Value that represents a rational number and can be normalized into a monzo. */
export type MonzoValue = Monzo | FractionValue;

/**
 * Normalize value into a monzo.
 * @param value Rational number as a number, string, fraction or a monzo.
 * @returns An array of exponents of prime numbers.
 */
export function resolveMonzo(value: MonzoValue): Monzo {
  if (
    Array.isArray(value) &&
    !(value.length === 2 && typeof value[0] === 'string')
  ) {
    return value as Monzo;
  } else {
    return toMonzo(value as FractionValue);
  }
}
