import {describe, it, expect} from 'vitest';
import {arraysEqual} from 'xen-dev-utils';
import {mapByVal} from '..';

describe('Val mapper', () => {
  it('can map a scale in 17edo', () => {
    const scale = ['6/5', '7/5', '8/5', '9/5', '10/5'];
    const steps = mapByVal(scale, 17);
    expect(arraysEqual(steps, [5, 9, 12, 15, 17])).toBeTruthy();
  });

  it('can map a scale in 17c', () => {
    const scale = ['6/5', '7/5', '8/5', '9/5', '10/5'];
    const steps = mapByVal(scale, '17c');
    expect(arraysEqual(steps, [4, 8, 11, 14, 17])).toBeTruthy();
  });

  it('can map large primes', () => {
    const scale = ['659/512', '2/1'];
    const steps = mapByVal(scale, 12);
    expect(steps[0]).toBe(4);
    expect(steps[1]).toBe(12);
  });
});
