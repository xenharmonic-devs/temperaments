import {
  dot,
  Fraction,
  FractionValue,
  LOG_PRIMES,
  Monzo,
  PRIMES,
  toMonzo,
} from 'xen-dev-utils';
import {MonzoValue} from './monzo';
import {cachedLinSolve} from './utils';
import {fromWarts, patentVal, toWarts, Val} from './warts';

/**
 * Array of fractions intended as the basis / formal primes of a just intonation subgroup.
 */
export type Basis = Fraction[];

/**
 * Value that can be interpreted as the basis of a fractional just intonation subgroup.
 * Numbers are interpreted as prime limits. `7` means 7-limit = first 4 primes.
 * Strings such as `'2.3.13/5'` are interpreted as a period-separated array of fractions.
 * An array of numbers/strings/fractions is normalized to Fraction instances.
 * If another subgroup is passed it's basis is copied.
 */
export type SubgroupValue = number | string | FractionValue[] | Subgroup;

/**
 * A vector mapping (formal) primes to their logarithms or tempered versions thereof.
 */
export type Mapping = number[];

/**
 * Fractional just intonation subgroup.
 */
export class Subgroup {
  /** Array of fractions forming the basis of the subgroup. */
  basis: Basis;

  /**
   * Construct a fractional just intonation subgroup.
   * @param basis An array of fractions or a value that can be interpreted as a basis of the new subgroup.
   */
  constructor(basis: SubgroupValue) {
    if (basis instanceof Subgroup) {
      this.basis = basis.basis.map(b => new Fraction(b));
    } else if (typeof basis === 'number') {
      if (isNaN(basis)) {
        throw new Error('Invalid limit');
      }
      if (basis === 1) {
        this.basis = [];
      }
      const index = PRIMES.indexOf(basis);
      if (index < 0) {
        throw new Error('Limit must be a prime');
      }
      this.basis = PRIMES.slice(0, index + 1).map(p => new Fraction(p));
    } else if (typeof basis === 'string') {
      this.basis = basis.split('.').map(b => new Fraction(b));
    } else {
      this.basis = basis.map(b => new Fraction(b));
    }
    this.basis.forEach(factor => {
      if (factor.equals(1)) {
        throw new Error('The number 1 is not a valid basis factor');
      }
      if (factor.compare(0) < 0) {
        throw new Error('Basis factors must be positive');
      }
    });
  }

  /**
   * Convert the subgroup to a string.
   * @returns The basis as a period-joined string.
   */
  toString() {
    return this.basis.map(b => b.toFraction()).join('.');
  }

  /**
   * Just intonation point of the subgroup.
   * @returns Array of natural logarithms of the basis factors.
   */
  jip(): Mapping {
    return this.basis.map(b => Math.log(b.valueOf()));
  }

  /**
   * Check equality between subgroups.
   * @param other Another subgroup instance.
   * @returns `true` if the subgroups are the same.
   */
  equals(other: Subgroup) {
    if (this.basis.length !== other.basis.length) {
      return false;
    }
    return this.basis
      .map((b, i) => b.equals(other.basis[i]))
      .reduce((a, b) => a && b);
  }

  // Please note that this assumes that the basis is somewhat regular.
  // The general solution would require doing Gauss-Jordan elimination over Fractions.
  /**
   * Convert a fraction to a monzo in the subgroup's basis.
   * @param firstValue Fraction or the numerator of a fraction.
   * @param secondValue Optional denominator of the fraction.
   * @returns An array of basis exponents and a multiplicative residue that lies outside of the basis of the subgroup.
   */
  toMonzoAndResidual(
    firstValue: FractionValue,
    secondValue?: number
  ): [Monzo, Fraction] {
    let fraction = new Fraction(firstValue, secondValue);
    const monzo: Monzo = [];
    this.basis.forEach(basisFraction => {
      let component = 0;
      while (fraction.n % basisFraction.n === 0) {
        fraction = fraction.div(basisFraction);
        component++;
      }
      while (fraction.d % basisFraction.n === 0) {
        fraction = fraction.mul(basisFraction);
        component--;
      }
      monzo.push(component);
    });
    return [monzo, fraction];
  }

  /**
   * Convert a monzo to a fraction according to the subgroup's basis.
   * @param monzo Array of basis exponents.
   * @returns The fraction corresponding to the monzo in the subgroup's basis.
   */
  toFraction(monzo: Monzo) {
    return monzo
      .map((exponent, i) => this.basis[i].pow(exponent))
      .reduce((a, b) => a.mul(b));
  }

  /**
   * Calculate a patent val of the subgroup.
   * @param divisions Number of divisions of the first basis factor.
   * @returns Array of the number of steps corresponding to each basis factor.
   */
  patentVal(divisions: number) {
    return patentVal(divisions, this.jip());
  }

  /**
   * Calculate the val corresponding to the given warts as progressive modifications to the patent val.
   * @param divisionsOrWarts Number of divisions of the first basis factor or a number followed by letters of the alphabet corresponding to the formal primes in order.
   * @returns Array of the number of steps corresponding to each basis factor.
   */
  fromWarts(divisionsOrWarts: number | string) {
    return fromWarts(divisionsOrWarts, this.jip());
  }

  /**
   * Convert a val (step mapping) to a wart string.
   * @param val Array of the number of steps corresponding to each basis factor.
   * @returns The val as wart string such as `'17c'`.
   */
  toWarts(val: Val) {
    return toWarts(val, this.jip());
  }

  /**
   * Fill in or convert a subgroup mapping to a full prime mapping.
   * @param mapping Mapping given in terms of the formal primes of the subgroup.
   * @returns The mapping given in terms of consecutive primes.
   */
  toPrimeMapping(mapping: Mapping): Mapping {
    const basisMonzos = this.basis.map(b => toMonzo(b));
    const limit = basisMonzos.reduce((a, b) => Math.max(a, b.length), 0);

    // Check if prime power subgroup
    let simple = true;
    const simpleIndices = [];
    for (let i = 0; i < basisMonzos.length; ++i) {
      let numNonzero = 0;
      for (let j = 0; j < basisMonzos[i].length; ++j) {
        if (basisMonzos[i][j]) {
          if (numNonzero) {
            simple = false;
            break;
          }
          simpleIndices.push(j);
          numNonzero++;
        }
      }
      if (!simple) {
        break;
      }
    }
    if (simple) {
      const result = LOG_PRIMES.slice(0, limit);
      simpleIndices.forEach(
        (index, i) => (result[index] = mapping[i] / basisMonzos[i][index])
      );
      return result;
    }

    // Calculate the full matrix and solve BasisMatrix * result = mapping
    const missing = new Set<number>();
    for (let i = 0; i < limit; ++i) {
      missing.add(i);
    }
    basisMonzos.forEach(monzo => {
      monzo.forEach((component, j) => {
        if (component > 0) {
          missing.delete(j);
        }
      });
      while (monzo.length < limit) {
        monzo.push(0);
      }
    });
    for (const index of missing) {
      const extraBasis = Array(limit).fill(0);
      extraBasis[index] = 1;
      basisMonzos.push(extraBasis);
    }
    const mapping_ = [...mapping];
    while (mapping_.length < limit) {
      mapping_.push(dot(basisMonzos[mapping_.length], LOG_PRIMES));
    }
    const transposed = [];
    for (let i = 0; i < limit; ++i) {
      const row = [];
      for (let j = 0; j < limit; ++j) {
        row.push(basisMonzos[j][i]);
      }
      transposed.push(row);
    }
    return cachedLinSolve(mapping_, transposed);
  }

  /**
   * Infer a prime subgroup based on an array of commas.
   * @param commas Array of commas as fractions or monzos.
   * @returns Smallest prime subgroup containing the commas.
   */
  static inferPrimeSubgroup(commas: MonzoValue[]) {
    const monzos: Monzo[] = [];
    commas.forEach(comma => {
      if (
        Array.isArray(comma) &&
        !(comma.length === 2 && typeof comma[0] === 'string')
      ) {
        monzos.push(comma as Monzo);
        return;
      }
      monzos.push(toMonzo(comma as FractionValue));
    });
    if (!monzos.length) {
      return new Subgroup([]);
    }
    const primeIndices = new Set<number>();
    monzos.forEach(monzo => {
      monzo.forEach((component, i) => {
        if (component) {
          primeIndices.add(i);
        }
      });
    });
    const indices = [...primeIndices];
    indices.sort((a, b) => a - b);
    return new Subgroup(indices.map(i => PRIMES[i]));
  }

  // This should be used to strip monzos after infering prime subgroup
  /**
   * Strip excess components from monzos.
   * @param comma Monzo of a comma given in terms of prime exponents.
   * @returns Monzo given in terms of the subgroup's basis.
   */
  strip(comma: Monzo): Monzo {
    return this.basis.map(b => comma[PRIMES.indexOf(b.n)]);
  }

  /**
   * Resolve a fraction into a monzo of this subgroup.
   * @param interval Fraction or monzo to resolve.
   * @param strip Strip away excess components. Should be set to `true` if the monzo is given in terms of prime exponents.
   * @returns Monzo given in terms of the subgroup's basis.
   */
  resolveMonzo(interval: MonzoValue, strip = false): Monzo {
    if (
      Array.isArray(interval) &&
      !(interval.length === 2 && typeof interval[0] === 'string')
    ) {
      if (strip) {
        return this.strip(interval as Monzo);
      } else {
        return interval as Monzo;
      }
    } else {
      const [monzo, residual] = this.toMonzoAndResidual(
        interval as FractionValue
      );
      if (!residual.equals(1)) {
        throw new Error('Interval outside subgroup');
      }
      return monzo;
    }
  }
}
