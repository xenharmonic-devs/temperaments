import {wedge} from 'ts-geometric-algebra';
import {
  accumulate,
  add,
  dot,
  Fraction,
  FractionValue,
  gcd,
  LOG_PRIMES,
  Monzo,
  monzoToFraction,
  scale,
  sub,
  toMonzo,
} from 'xen-dev-utils';
import {getAlgebra} from './utils';

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

function taxicab(monzo: Monzo, start = 0) {
  return monzo.slice(start).reduce((a, b) => Math.abs(a) + Math.abs(b));
}

function positiveTenney(monzo: Monzo, start = 0) {
  return monzo
    .slice(start)
    .map((component, index) => Math.max(0, component) * LOG_PRIMES[index])
    .reduce((a, b) => a + b);
}

function negativeTenney(monzo: Monzo, start = 0) {
  return monzo
    .slice(start)
    .map((component, index) => Math.max(0, -component) * LOG_PRIMES[index])
    .reduce((a, b) => a + b);
}

function basisSpell(monzo: Monzo, basis: Monzo[], searchBreadth: number) {
  // Find and apply breadth=1 simplifications using a cheap metric
  const basisMonzo = Array(basis.length).fill(0);
  let distance = taxicab(monzo);
  let done;
  do {
    done = true;
    for (let i = 0; i < basis.length; ++i) {
      let candidate = add(monzo, basis[i]);
      let candidateDistance = taxicab(candidate);
      if (candidateDistance < distance) {
        monzo = candidate;
        basisMonzo[i]++;
        distance = candidateDistance;
        done = false;
        continue;
      }
      candidate = sub(monzo, basis[i]);
      candidateDistance = taxicab(candidate);
      if (candidateDistance < distance) {
        monzo = candidate;
        basisMonzo[i]--;
        distance = candidateDistance;
        done = false;
      }
    }
  } while (!done);

  const best: Monzo = [...basisMonzo];
  const result = {
    minNumerator: best,
    minDenominator: best,
    minBenedetti: best,
  };

  let positive = positiveTenney(monzo);
  let negative = negativeTenney(monzo);
  let error = positive + negative;
  let positiveTiebreak = negative;
  let negativeTiebreak = positive;

  function search(accumulator: Monzo, bMonzo: Monzo, index: number) {
    if (index >= basis.length) {
      const candidatePositive = positiveTenney(accumulator);
      const candidateNegative = negativeTenney(accumulator);
      const candidateError = candidatePositive + candidateNegative;
      if (
        candidatePositive < positive ||
        (candidatePositive === positive && candidateNegative < positiveTiebreak)
      ) {
        result.minNumerator = bMonzo;
        positive = candidatePositive;
        positiveTiebreak = candidateNegative;
      }
      if (
        candidateNegative < negative ||
        (candidateNegative === negative && candidatePositive < negativeTiebreak)
      ) {
        result.minDenominator = bMonzo;
        negative = candidateNegative;
        negativeTiebreak = candidatePositive;
      }
      if (candidateError < error) {
        result.minBenedetti = bMonzo;
        error = candidateError;
      }
      return;
    }
    search(accumulator, bMonzo, index + 1);
    for (let i = 0; i < 2 * searchBreadth; ++i) {
      accumulator = add(accumulator, basis[index]);
      bMonzo = [...bMonzo];
      bMonzo[index]++;
      search(accumulator, bMonzo, index + 1);
    }
  }

  const accumulator = [...monzo];
  for (let i = 0; i < basis.length; ++i) {
    while (accumulator.length < basis[i].length) {
      accumulator.push(0);
    }
    for (let j = 0; j < basis[i].length; ++j) {
      accumulator[j] -= basis[i][j] * searchBreadth;
    }
    basisMonzo[i] -= searchBreadth;
  }
  search(accumulator, basisMonzo, 0);

  return result;
}

/** Simple spellings of a fraction according to various criteria. */
export type Spelling = {
  /** Spelling with the least numerator. */
  minNumerator: Fraction;
  /** Spelling with the least denominator. */
  minDenominator: Fraction;
  /** Spelling with the least product of numerator and denominator. */
  minBenedetti: Fraction;
  /** Spelling with the least numerator, ignoring powers of two. */
  noTwosMinNumerator: Fraction;
  /** Spelling with the least denominator, ignoring powers of two. */
  noTwosMinDenominator: Fraction;
  /** Spelling with the least product of numerator and denominator, ignoring powers of two. */
  noTwosMinBenedetti: Fraction;
};

/**
 * Find simpler spellings of a fraction assuming that the given commas are tempered out.
 * @param fraction Fraction to simplify.
 * @param commas List of commas that should only affect the spelling, but not the pitch.
 * @param searchBreadth Half-width of the search lattice.
 * @returns Simple spellings of a fraction according to various criteria.
 */
export function spell(
  fraction: MonzoValue,
  commas: MonzoValue[],
  searchBreadth = 3
): Spelling {
  const monzo = resolveMonzo(fraction);
  const basis = commas.map(resolveMonzo);

  const fraction_ = monzoToFraction(monzo);
  const commas_ = basis.map(monzoToFraction);

  const result = basisSpell(monzo, basis, searchBreadth);

  monzo[0] = 0;
  basis.forEach(comma => (comma[0] = 0));

  const noTwosResult = basisSpell(monzo, basis, searchBreadth);

  function combine(basisMonzo: Monzo) {
    return fraction_.mul(
      basisMonzo
        .map((exponent, i) => commas_[i].pow(exponent)!)
        .reduce((a, b) => a.mul(b))
    );
  }

  return {
    minNumerator: combine(result.minNumerator),
    minDenominator: combine(result.minDenominator),
    minBenedetti: combine(result.minBenedetti),
    noTwosMinNumerator: combine(noTwosResult.minNumerator),
    noTwosMinDenominator: combine(noTwosResult.minDenominator),
    noTwosMinBenedetti: combine(noTwosResult.minBenedetti),
  };
}

/**
 * Find a fraction that splits the given fraction assuming that the gives commas are tempered out.
 * @param fraction Fraction to split.
 * @param commas List of commas that should only affect the spelling, but not the pitch.
 * @param divisions How many pieces to split into. Calculated if not known initially.
 * @param searchBreadth Half-width of the search lattice.
 * @returns Fraction that stacked `divisions` times equals the given fraction in the given temperament.
 */
export function split(
  fraction: MonzoValue,
  commas: MonzoValue[],
  divisions?: number,
  searchBreadth = 3
) {
  const monzo = resolveMonzo(fraction);
  const basis = commas.map(resolveMonzo);

  let dimensions = monzo.length;
  basis.forEach(comma => {
    dimensions = Math.max(comma.length, dimensions);
  });

  while (monzo.length < dimensions) {
    monzo.push(0);
  }

  basis.forEach(comma => {
    while (comma.length < dimensions) {
      comma.push(0);
    }
  });

  if (divisions === undefined) {
    const algebra = getAlgebra(dimensions, 'float64');

    const hyperwedge = wedge(
      algebra.fromVector(monzo),
      ...basis.map(comma => algebra.fromVector(comma))
    );

    divisions = Math.abs(hyperwedge.reduce(gcd));
  }

  if (!divisions) {
    throw new Error('Divisions cannot be zero.');
  }

  let done = false;
  let result: Monzo | undefined;

  function search(accumulator: Monzo, index: number) {
    if (index >= basis.length) {
      if (done) {
        return;
      }
      done = true;
      for (const component of accumulator) {
        if (component % divisions!) {
          done = false;
          break;
        }
      }
      if (done) {
        result = accumulator.map(component => component / divisions!);
      }
      return;
    }

    search(accumulator, index + 1);
    for (let i = 0; i < 2 * searchBreadth; ++i) {
      accumulator = add(accumulator, basis[index]);
      search(accumulator, index + 1);
    }
  }

  const accumulator = [...monzo];
  for (let i = 0; i < basis.length; ++i) {
    for (let j = 0; j < basis[i].length; ++j) {
      accumulator[j] -= basis[i][j] * searchBreadth;
    }
  }
  search(accumulator, 0);

  if (result === undefined) {
    throw new Error('Failed to find the split.');
  }
  return monzoToFraction(result);
}

function tenney(monzo: Monzo) {
  return monzo
    .map((component, index) => Math.abs(component) * LOG_PRIMES[index])
    .reduce((a, b) => a + b);
}

function normalize(monzo: Monzo) {
  const size = dot(monzo, LOG_PRIMES);
  if (size < 0) {
    return monzo.map(m => -m);
  }
  return monzo;
}

/**
 * Find simpler spellings for an array of commas.
 * @param commas List of commas that should only affect the spelling, but not the pitch.
 * @param searchBreadth Half-width of the search lattice.
 * @returns An array of commas with smaller or equal tenney heights.
 */
export function simplifyCommas(commas: MonzoValue[], searchBreadth = 3) {
  const monzos = commas.map(comma => [...resolveMonzo(comma)]);

  for (let i = 0; i < monzos.length; ++i) {
    const basis = [...monzos];
    basis.splice(i, 1);
    const simplifications = basisSpell(
      monzos[i],
      basis,
      searchBreadth
    ).minBenedetti;
    for (let j = 0; j < basis.length; ++j) {
      accumulate(monzos[i], scale(basis[j], simplifications[j]));
    }
  }

  monzos.sort((a, b) => tenney(a) - tenney(b));
  return monzos.map(normalize);
}
