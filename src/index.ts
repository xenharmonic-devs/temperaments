export * from './color';
export * from './monzo';
export * from './names';
export * from './subgroup';
export * from './temperament';
export * from './utils';
export * from './warts';

import {dot, LOG_PRIMES} from 'xen-dev-utils';
import {MonzoValue, resolveMonzo} from './monzo';
import {Temperament} from './temperament';
import {fromWarts} from './warts';

/**
 * Map an array of fractions/monzos by a val.
 * @param monzos Fractions or monzos to map.
 * @param edoOrWarts Number of equal divisions of the octave or a number followed by letters in [Wart Notation](https://en.xen.wiki/w/Val#Shorthand_notation) such as `'17c'`.
 * @returns The fractions interpreted consistently by the val as edo-steps.
 */
export function mapByVal(monzos: MonzoValue[], edoOrWarts: number | string) {
  const resolved = monzos.map(resolveMonzo);
  const limit = Math.max(...resolved.map(monzo => monzo.length));
  const val = fromWarts(edoOrWarts, LOG_PRIMES.slice(0, limit));
  return resolved.map(monzo => dot(monzo, val));
}

export default Temperament;
