import {describe, it, expect} from 'vitest';
import {arraysEqual} from '../utils';

import {fromWarts, toWarts} from '../warts';

describe('Val to wart converter', () => {
  it('converts <12 19 28]', () => {
    expect(toWarts([12, 19, 28])).toBe('12');
  });
  it('converts <12 20 28]', () => {
    expect(toWarts([12, 20, 28])).toBe('12b');
  });
  it('converts <12 18 28]', () => {
    expect(toWarts([12, 18, 28])).toBe('12bb');
  });
  it('converts <12 19 27]', () => {
    expect(toWarts([12, 19, 27])).toBe('12c');
  });
  it('converts <12 19 26]', () => {
    expect(toWarts([12, 19, 26])).toBe('12ccc');
  });
  it('it is compatible with wart to val converter', () => {
    for (let n = 0; n < 10; ++n) {
      let token = Math.round(1 + 100 * Math.random()).toString();
      for (let i = 1; i < 4; ++i) {
        for (let j = 0; j < Math.floor(5 * Math.random()); ++j) {
          token += String.fromCharCode(97 + i);
        }
      }
      expect(toWarts(fromWarts(token, 4))).toBe(token);
    }
  });
});

describe('Wart to val converter', () => {
  it('converts 12', () => {
    expect(arraysEqual(fromWarts('12', 3), [12, 19, 28])).toBeTruthy();
  });
  it('converts 12b', () => {
    expect(arraysEqual(fromWarts('12b', 3), [12, 20, 28])).toBeTruthy();
  });
  it('converts 12bb', () => {
    expect(arraysEqual(fromWarts('12bb', 3), [12, 18, 28])).toBeTruthy();
  });
  it('converts 12c', () => {
    expect(arraysEqual(fromWarts('12c', 3), [12, 19, 27])).toBeTruthy();
  });
  it('converts 12ccc', () => {
    expect(arraysEqual(fromWarts('12ccc', 3), [12, 19, 26])).toBeTruthy();
  });
});
