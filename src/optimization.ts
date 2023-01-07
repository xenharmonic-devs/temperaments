import {
  centsToNats,
  dot,
  natsToCents,
  natsToSemitones,
  semitonesToNats,
} from 'xen-dev-utils';
import {Subgroup, Mapping, PitchUnits} from './subgroup';
import {Comma, Weights} from './temperament';
import {fromWarts, Val} from './warts';
import {multiply, pinv} from 'mathjs';
import {MonzoValue, resolveMonzo} from './monzo';

function norm(monzo: Comma) {
  let total = 0;
  monzo.forEach(component => {
    total += component * component;
  });
  return Math.sqrt(total);
}

function scalarMul(scalar: number, monzo: Comma) {
  return monzo.map(component => scalar * component);
}

function subInPlace(a: Comma, b: Comma) {
  for (let i = 0; i < a.length; ++i) {
    a[i] -= b[i];
  }
}

/**
 * Adjust mapping until specified commas vanish.
 * @param commas Array of commas in the mapping's semantics.
 * @param subgroupOrJip A {@link Subgroup} instance or a just intonation point (JIP).
 * @param weights Importance weighting for the JIP's coordinates (defaults to 1 / JIP).
 * @param temperEquaves If `true` tempering is applied to octaves as well.
 * @param units The units pitch of intervals and mappings are measured in.
 * @param numberOfIterations Number of iterations to adjust the mapping.
 * @returns A mapping close to the JIP where the commas vanish.
 */
export function vanishCommas(
  commas: MonzoValue[],
  subgroupOrJip?: Subgroup | Mapping,
  weights?: Weights,
  temperEquaves = true,
  units: PitchUnits = 'cents',
  numberOfIterations = 1000
) {
  if (subgroupOrJip === undefined) {
    subgroupOrJip = Subgroup.inferPrimeSubgroup(commas);
  }
  let commas_: Comma[];
  if (subgroupOrJip instanceof Subgroup) {
    commas_ = commas.map(comma =>
      (subgroupOrJip as Subgroup).resolveMonzo(comma)
    );
  } else {
    commas_ = commas.map(comma => resolveMonzo(comma));
  }
  let jip: Mapping;
  if (subgroupOrJip instanceof Subgroup) {
    jip = subgroupOrJip.jip(units);
  } else {
    jip = subgroupOrJip;
  }
  // The process is linear and scale-free in log-space so the particular units don't matter.
  if (units === 'ratio') {
    jip = jip.map(Math.log);
  }

  if (weights === undefined) {
    weights = jip.map(j => 1 / j);
  }
  weights = weights.map(w => w / weights![0]);

  let mapping = jip.slice().map((j, i) => j * weights![i]);

  const normalizedCommas = commas_
    .map(comma => comma.map((c, i) => c / weights![i]))
    .map(comma => scalarMul(1 / norm(comma), comma));

  for (let i = 0; i < numberOfIterations; ++i) {
    for (const comma of normalizedCommas) {
      const delta = scalarMul(dot(mapping, comma), comma);
      if (!temperEquaves) {
        delta[0] = 0;
      }
      subInPlace(mapping, delta);
    }
  }

  mapping = mapping.map((m, i) => m / weights![i]);

  if (units === 'ratio') {
    return mapping.map(Math.exp);
  }
  return mapping;
}

/**
 * Find a Tenney-Euclid optimal linear combination of vals.
 * @param vals Array of vals in using the JIP's semantics.
 * @param subgroupOrJip A {@link Subgroup} instance or a just intonation point (JIP).
 * @param weights Importance weighting for the JIP's coordinates (defaults to 1 / JIP).
 * @param units The units pitch of intervals and mappings are measured in.
 * @returns A Tenney-Euclid optimal mapping representing a temperament supported by all of the vals.
 */
export function tenneyVals(
  vals: (number | string | Val)[],
  subgroupOrJip: Subgroup | Mapping,
  weights?: Weights,
  units: PitchUnits = 'cents'
) {
  let jip: Mapping;
  if (subgroupOrJip instanceof Subgroup) {
    jip = subgroupOrJip.jip('nats');
  } else {
    jip = subgroupOrJip;
    if (units === 'cents') {
      jip = jip.map(centsToNats);
    } else if (units === 'semitones') {
      jip = jip.map(semitonesToNats);
    } else if (units === 'ratio') {
      jip = jip.map(Math.log);
    }
  }

  if (weights === undefined) {
    weights = jip.map(j => 1 / j);
  }

  let vals_ = vals.map(val => {
    if (typeof val === 'number' || typeof val === 'string') {
      if (subgroupOrJip instanceof Subgroup) {
        return subgroupOrJip.fromWarts(val);
      } else {
        return fromWarts(val, jip);
      }
    }
    return val;
  });

  vals_ = vals_.map(val => val.map((v, i) => v * weights![i]));
  jip = jip.map((j, i) => j * weights![i]);

  const mapping = multiply(jip, multiply(pinv(vals_), vals_)).map(
    (m, i) => m / weights![i]
  );

  if (units === 'cents') {
    return mapping.map(natsToCents);
  } else if (units === 'semitones') {
    return mapping.map(natsToSemitones);
  } else if (units === 'ratio') {
    return mapping.map(Math.exp);
  }
  return mapping;
}
