import {FractionValue, Monzo, toMonzo} from 'xen-dev-utils';

// No interpretation in Geometric Algebra
export type MonzoValue = Monzo | FractionValue;

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
