import {LOG_PRIMES} from 'xen-dev-utils';

const DIGIT_PATTERN = new RegExp('\\d');

function isDigit(character: string) {
  return DIGIT_PATTERN.test(character);
}

export function toDivisionsModifications(
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

export type MaybeJip = number[] | number;

function actuallyJip(jipOrNumberOfPrimes: number[] | number) {
  if (typeof jipOrNumberOfPrimes === 'number') {
    return LOG_PRIMES.slice(0, jipOrNumberOfPrimes);
  }
  return jipOrNumberOfPrimes;
}

export function patentVal(divisions: number, jip: MaybeJip) {
  const jip_ = actuallyJip(jip);
  const divisionsPerLogEquave = divisions / jip_[0];
  return jip_.map(logBasis => Math.round(logBasis * divisionsPerLogEquave));
}

export function fromWarts(token: number | string, jip: MaybeJip) {
  const jip_ = actuallyJip(jip);
  const [divisions, modifications] = toDivisionsModifications(token);
  const divisionsPerLogEquave = divisions / jip_[0];
  const result = patentVal(divisions, jip_);
  modifications.forEach(m => {
    const [index, modification] = m;
    if (jip_[index] * divisionsPerLogEquave > result[index]) {
      result[index] += modification;
    } else {
      result[index] -= modification;
    }
  });
  return result;
}

export function toWarts(val: number[], jip?: MaybeJip) {
  const jip_ = actuallyJip(jip || val.length);
  const divisions = val[0];
  const divisionsPerLogEquave = divisions / jip_[0];
  const patent = patentVal(divisions, jip_);
  let result = divisions.toString();
  for (let index = 0; index < val.length; ++index) {
    const modification = val[index] - patent[index];
    let count = 2 * Math.abs(modification);
    if (jip_[index] * divisionsPerLogEquave > patent[index]) {
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
