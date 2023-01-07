import {lusolve} from 'mathjs';
import {linSolve, wedge} from 'ts-geometric-algebra';
import {
  dot,
  Fraction,
  FractionValue,
  LOG_PRIMES,
  Monzo,
  PRIMES,
  toMonzo,
  toMonzoAndResidual,
} from 'xen-dev-utils';
import {MonzoValue} from './monzo';
import {getAlgebra} from './utils';
import {fromWarts, isDigit, patentVal, toWarts, Val} from './warts';

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

  /**
   * Converts the basis factors into monzos in standard prime basis.
   * @returns An array of arrays of prime exponents.
   */
  basisMonzos() {
    const basis = this.basis.map(toMonzo);

    const dimensions = basis.reduce((a, b) => Math.max(a, b.length), 0);
    basis.forEach(monzo => {
      while (monzo.length < dimensions) {
        monzo.push(0);
      }
    });
    return basis;
  }

  // Check if prime power subgroup and calculate prime indices
  private simpleIndices(basisMonzos?: Monzo[]) {
    if (basisMonzos === undefined) {
      basisMonzos = this.basisMonzos();
    }

    const simpleIndices = [];
    for (let i = 0; i < basisMonzos.length; ++i) {
      let numNonzero = 0;
      for (let j = 0; j < basisMonzos[i].length; ++j) {
        if (basisMonzos[i][j]) {
          if (numNonzero) {
            return [];
          }
          simpleIndices.push(j);
          numNonzero++;
        }
      }
    }
    return simpleIndices;
  }

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

    const basisMonzos = this.basisMonzos();
    const dimensions = basisMonzos[0].length;
    const primeMonzo = toMonzoAndResidual(fraction, dimensions)[0];

    const monzo = this.toMonzo_(primeMonzo, basisMonzos);

    monzo.forEach((component, index) => {
      fraction = fraction.div(this.basis[index].pow(component));
    });

    return [monzo, fraction];
  }

  private toMonzo_(primeMonzo: Monzo, basisMonzos?: Monzo[]): Monzo {
    if (basisMonzos === undefined) {
      basisMonzos = this.basisMonzos();
    }

    const simpleIndices = this.simpleIndices(basisMonzos);

    if (simpleIndices.length) {
      const result: Monzo = [];
      simpleIndices.forEach((index, i) => {
        const component = Math.floor(
          primeMonzo[index] / basisMonzos![i][index]
        );
        result.push(component);
        primeMonzo[index] -= component * basisMonzos![i][index];
      });
      return result;
    }

    // Strip away zero components
    const usedIndices = new Set<number>();

    basisMonzos.forEach(monzo => {
      monzo.forEach((component, i) => {
        if (component) {
          usedIndices.add(i);
        }
      });
    });
    primeMonzo.forEach((component, i) => {
      if (component) {
        usedIndices.add(i);
      }
    });

    const indices = [...usedIndices.values()];
    indices.sort((a, b) => a - b);

    const strippedBasis: Monzo[] = [];

    basisMonzos.forEach(monzo => {
      const stripped: Monzo = [];
      indices.forEach(i => {
        stripped.push(monzo[i]);
      });
      strippedBasis.push(stripped);
    });
    const stripped: Monzo = [];
    indices.forEach(i => {
      stripped.push(primeMonzo[i]);
    });

    // Generic solution using projection and linear solving
    const dimensions = indices.length;

    const algebra = getAlgebra(dimensions, 'float64');

    const basis = strippedBasis.map(monzo => algebra.fromVector(monzo));

    const monzo = algebra.fromVector(stripped);

    const hyperwedge = wedge(...basis);

    const projected = monzo.dotL(hyperwedge.inverse()).dotL(hyperwedge);

    return linSolve(projected, basis).map(Math.floor);
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
   * @param divisionsOrWarts Number of divisions of the first basis factor or a number followed by
   * letters of the alphabet corresponding to the primes in order with formal primes represented by letters starting from 'q'.
   * @returns Array of the number of steps corresponding to each basis factor.
   */
  fromWarts(divisionsOrWarts: number | string) {
    if (typeof divisionsOrWarts === 'string') {
      let divisions = '';
      while (isDigit(divisionsOrWarts[0])) {
        divisions += divisionsOrWarts[0];
        divisionsOrWarts = divisionsOrWarts.slice(1);
      }
      let warts = '';
      [...divisionsOrWarts.toLowerCase()].forEach(wart => {
        if (wart < 'q') {
          const prime = PRIMES[wart.charCodeAt(0) - 97];
          let i: number;
          for (i = 0; i < this.basis.length; ++i) {
            if (this.basis[i].equals(prime)) {
              break;
            }
          }
          if (i >= this.basis.length) {
            throw new Error(`Prime ${prime} not in subgroup`);
          }
          warts += String.fromCharCode(97 + i);
        } else {
          const i = wart.charCodeAt(0) - 113;
          const formalIndices: number[] = [];
          this.basis.forEach((factor, j) => {
            if (factor.d !== 1 || !PRIMES.includes(factor.n)) {
              formalIndices.push(j);
            }
          });
          warts += String.fromCharCode(97 + formalIndices[i]);
        }
      });
      divisionsOrWarts = divisions + warts;
    }
    return fromWarts(divisionsOrWarts, this.jip());
  }

  /**
   * Convert a val (step mapping) to a wart string.
   * @param val Array of the number of steps corresponding to each basis factor.
   * @returns The val as wart string such as `'17c'`.
   */
  toWarts(val: Val) {
    let formal = toWarts(val, this.jip());
    let divisions = '';
    while (isDigit(formal[0])) {
      divisions += formal[0];
      formal = formal.slice(1);
    }
    const formalIndices: number[] = [];
    this.basis.forEach((factor, j) => {
      if (factor.d !== 1 || !PRIMES.includes(factor.n)) {
        formalIndices.push(j);
      }
    });
    let warts = '';
    [...formal].forEach(wart => {
      const index = wart.charCodeAt(0) - 97;
      if (formalIndices.includes(index)) {
        warts += String.fromCharCode(113 + formalIndices.indexOf(index));
      } else {
        warts += String.fromCharCode(97 + PRIMES.indexOf(this.basis[index].n));
      }
    });
    return divisions + warts;
  }

  /**
   * Fill in or convert a subgroup mapping to a full prime mapping.
   * @param mapping Mapping given in terms of the formal primes of the subgroup.
   * @returns The mapping given in terms of consecutive primes.
   */
  toPrimeMapping(mapping: Mapping): Mapping {
    const basisMonzos = this.basis.map(b => toMonzo(b));
    const limit = basisMonzos.reduce((a, b) => Math.max(a, b.length), 0);

    const simpleIndices = this.simpleIndices(basisMonzos);
    if (simpleIndices.length) {
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
    return lusolve(basisMonzos, mapping_).flat() as Mapping;
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

  /**
   * Resolve a fraction into a monzo of this subgroup.
   * @param interval Fraction or monzo to resolve.
   * @param primeMapping Should be set to `true` if the monzo is given in terms of prime exponents. Strips away excess components.
   * @returns Monzo given in terms of the subgroup's basis.
   */
  resolveMonzo(interval: MonzoValue, primeMapping = false): Monzo {
    if (
      Array.isArray(interval) &&
      !(interval.length === 2 && typeof interval[0] === 'string')
    ) {
      if (primeMapping) {
        // XXX: Strips away residual
        return this.toMonzo_(interval as Monzo);
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

  /**
   * Check if the subgroup is non-composite and non-fractional.
   * @returns `true` if the subgroup consists of primes only.
   */
  isPrimeSubgroup() {
    return this.basis
      .map(b => b.d === 1 && PRIMES.includes(b.n))
      .reduce((a, b) => a && b);
  }
}
