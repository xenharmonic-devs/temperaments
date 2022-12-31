import {
  centsToNats,
  dot,
  Monzo,
  natsToCents,
  natsToSemitones,
  semitonesToNats,
  sub,
} from 'xen-dev-utils';
import {type Mapping} from './subgroup';
import {PitchUnits, Weights, type Comma} from './temperament';
import {Val} from './warts';

function norm(monzo: Monzo) {
  let total = 0;
  monzo.forEach(component => {
    total += component * component;
  });
  return Math.sqrt(total);
}

function scalarMul(scalar: number, monzo: Monzo) {
  return monzo.map(component => scalar * component);
}

function subInPlace(a: Monzo, b: Monzo) {
  for (let i = 0; i < a.length; ++i) {
    a[i] -= b[i];
  }
}

/*
function weightedDot(a: Val, b: Mapping, weights: Weights) {
  let result = 0;
  for (let i = 0; i < Math.min(a.length, b.length, weights.length); ++i) {
    result += a[i] * b[i] * weights[i] * weights[i];
  }
  return result;
}
*/

export function vanishCommas(
  initial: Mapping,
  commas: Comma[],
  temperEquaves = true,
  units: PitchUnits = 'cents',
  numberOfIterations = 1000
) {
  // The process is linear in log-space so the particular units don't matter.
  if (units === 'ratio') {
    initial = initial.map(Math.log);
  }

  const mapping = initial.slice();

  const normalizedCommas = commas.map(comma =>
    scalarMul(1 / norm(comma), comma)
  );

  for (let i = 0; i < numberOfIterations; ++i) {
    for (const comma of normalizedCommas) {
      const delta = scalarMul(dot(mapping, comma), comma);
      if (!temperEquaves) {
        delta[0] = 0;
      }
      subInPlace(mapping, delta);
    }
  }

  if (units === 'ratio') {
    return mapping.map(Math.exp);
  }
  return mapping;
}

export function combineVals(
  jip: Mapping,
  vals: Val[],
  temperEquaves = true,
  units: PitchUnits = 'cents',
  weights?: Weights,
  numberOfIterations = 1000
) {
  if (units === 'cents') {
    jip = jip.map(centsToNats);
  } else if (units === 'semitones') {
    jip = jip.map(semitonesToNats);
  } else if (units === 'ratio') {
    jip = jip.map(Math.log);
  }

  if (weights === undefined) {
    weights = jip.map(j => 1 / j);
  }

  const normalizedVals = vals.map(val => val.map((c, i) => (jip[0] * c * weights![i]) / val[0]));

  jip = jip.map((j, i) => j * weights![i]);

  const coefficients = Array(vals.length).fill(1 / vals.length);

  let k = 0;
  while (true) {
    let mapping = Array(jip.length).fill(0);

    for (let i = 0; i < vals.length; ++i) {
      for (let j = 0; j < jip.length; ++j) {
        mapping[j] += normalizedVals[i][j] * coefficients[i];
      }
    }

    let error = 0;
    for (let i = 0; i < jip.length; ++i) {
      error += (jip[i] - mapping[i]) ** 2;
    }
    console.log(error, coefficients);

    if (++k > numberOfIterations) {
      mapping = mapping.map((m, i) => m / weights![i]);
      if (units === 'cents') {
        return mapping.map(natsToCents);
      } else if (units === 'semitones') {
        return mapping.map(natsToSemitones);
      } else if (units === 'ratio') {
        return mapping.map(Math.exp);
      }
      return mapping;
    }

    for (let i = 0; i < vals.length; ++i) {
      const delta = dot(normalizedVals[i], sub(jip, mapping));
      // console.log(delta);
      coefficients[i] += delta * 0.1;
    }

    if (!temperEquaves) {
      const normalizer = 1 / coefficients.reduce((a, b) => a + b);
      for (let i = 0; i < vals.length; ++i) {
        coefficients[i] *= normalizer;
      }
    }
  }
}
