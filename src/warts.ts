import {LOG_PRIMES, PRIMES} from 'xen-dev-utils';

/** A vector mapping (formal) primes to integers usually interpreted as EDO steps. */
export type Val = number[];

/** A just intonatin point: an array of natural logarithms of (formal) primes. */
export type Jip = number[];

export type JipOrLimit = Jip | number;

const DIGIT_PATTERN = new RegExp('\\d');

function isDigit(character: string) {
  return DIGIT_PATTERN.test(character);
}

function toDivisionsModifications(
  token: number | string
): [number, number[][]] {
  if (typeof token === 'number') {
    return [token, []];
  }
  let numString = '';
  while (isDigit(token[0]) || token[0] === '-') {
    numString += token[0];
    token = token.slice(1);
  }
  const divisions = parseInt(numString);
  const warts = token
    .toLowerCase()
    .split('')
    .map(w => w.charCodeAt(0) - 97);
  const counts: Map<number, number> = new Map();
  warts.forEach(index => {
    counts.set(index, (counts.get(index) || 0) + 1);
  });
  const modifications: number[][] = [];
  for (const [index, count] of counts) {
    const modification = Math.floor((count + 1) / 2) * (2 * (count % 2) - 1);
    modifications.push([index, modification]);
  }
  return [divisions, modifications];
}

function resolveJip(jipOrLimit: JipOrLimit) {
  if (typeof jipOrLimit === 'number') {
    return LOG_PRIMES.slice(0, PRIMES.indexOf(jipOrLimit) + 1);
  }
  return jipOrLimit;
}

/**
 * Calculate the patent val for an EDO.
 * @param edo Number of equal divisions of the octave to calculate the patent val for.
 * @param primeLimit Highest prime to calculate the mapping for.
 * @returns Array of the number of edo steps corresponding to each prime.
 */
export function patentVal(edo: number, primeLimit: number): Val;
/**
 * Calculate the patent val based on the given just intonation point.
 * @param divisions Number of divisions of the first formal prime.
 * @param jip An array of natural logarithms of (formal) primes.
 * @returns Array of the number of steps corresponding to each (formal) prime.
 */
export function patentVal(divisions: number, jip: Jip): Val;
export function patentVal(divisions: number, jipOrLimit: JipOrLimit): Val {
  const jip = resolveJip(jipOrLimit);
  const divisionsPerLogEquave = divisions / jip[0];
  return jip.map(logBasis => Math.round(logBasis * divisionsPerLogEquave));
}

/**
 * Calculate the val corresponding to the given warts as progressive modifications to the patent val.
 * @param edoOrWarts Number of equal divisions of the octave or a number followed by letters in [Wart Notation](https://en.xen.wiki/w/Val#Shorthand_notation) such as `'17c'`.
 * @param primeLimit Highest prime to calculate the mapping for.
 * @returns Array of the number of edo steps corresponding to each prime.
 */
export function fromWarts(edoOrWarts: number | string, primeLimit: number): Val;
/**
 * Calculate the val corresponding to the given warts as progressive modifications to the patent val.
 * @param divisionsOrWarts Number of divisions of the first formal prime or a number followed by letters of the alphabet corresponding to the formal primes in order.
 * @param jip An array of natural logarithms of (formal) primes.
 * @returns Array of the number of steps corresponding to each (formal) prime.
 */
export function fromWarts(divisionsOrWarts: number | string, jip: Jip): Val;
export function fromWarts(
  divisionsOrWarts: number | string,
  jipOrLimit: JipOrLimit
): Val {
  const jip = resolveJip(jipOrLimit);
  const [divisions, modifications] = toDivisionsModifications(divisionsOrWarts);
  const divisionsPerLogEquave = divisions / jip[0];
  const result = patentVal(divisions, jip);
  modifications.forEach(m => {
    const [index, modification] = m;
    if (jip[index] * divisionsPerLogEquave > result[index]) {
      result[index] += modification;
    } else {
      result[index] -= modification;
    }
  });
  return result;
}

/**
 * Convert a val (step mapping) to a wart string.
 * @param val Array of the number of edo steps corresponding to each prime.
 * @returns The val as wart string such as `'17c'`.
 */
export function toWarts(val: Val): string;
/**
 * Convert a val (step mapping) to a wart string.
 * @param val Array of the number of steps corresponding to each (formal) prime.
 * @returns The val as wart string such as `'17c'`.
 */
export function toWarts(val: Val, jip: Jip): string;
export function toWarts(val: Val, jipOrLimit?: JipOrLimit): string {
  const jip = resolveJip(jipOrLimit || PRIMES[val.length - 1]);
  const divisions = val[0];
  const divisionsPerLogEquave = divisions / jip[0];
  const patent = patentVal(divisions, jip);
  let result = divisions.toString();
  for (let index = 0; index < val.length; ++index) {
    const modification = val[index] - patent[index];
    let count = 2 * Math.abs(modification);
    if (jip[index] * divisionsPerLogEquave > patent[index]) {
      if (modification > 0) {
        count--;
      }
    } else {
      if (modification < 0) {
        count--;
      }
    }
    for (let i = 0; i < count; ++i) {
      result += String.fromCharCode(97 + index);
    }
  }
  return result;
}
