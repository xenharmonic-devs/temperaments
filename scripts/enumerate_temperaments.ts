import {LOG_PRIMES, Temperament, dot, natsToCents} from '../src/index';

const N = 10;
for (let a = 0; a <= N; ++a) {
  for (let b = -N; b <= N; ++b) {
    for (let c = -N; c <= N; ++c) {
      const comma = [a, b, c];
      const subgroup = [0, 1, 2];
      let cents = natsToCents(
        dot(
          subgroup.map(i => LOG_PRIMES[i]),
          comma
        )
      );
      if (cents < 0) {
        for (let i = 0; i < comma.length; ++i) {
          comma[i] = -comma[i];
        }
        cents = -cents;
      }
      if (cents > 0 && cents < 100) {
        const temperament = Temperament.fromCommaList([comma], subgroup);
        console.log(temperament.value);
        console.log(comma, cents);
      }
    }
  }
}
