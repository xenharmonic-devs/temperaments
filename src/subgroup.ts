import Fraction from 'fraction.js';
import {LOG_PRIMES, PRIMES} from './constants';
import {fractionToMonzo, type Monzo} from './monzo';
import {FractionValue} from './utils';
import {fromWarts, patentVal, toWarts} from './warts';

export type Basis = Fraction[];

export type SubgroupValue = number | string | number[] | Basis | Subgroup;

export class Subgroup {
  basis: Basis;

  constructor(basis: SubgroupValue) {
    if (basis instanceof Subgroup) {
      this.basis = basis.basis;
    } else if (typeof basis === 'number') {
      this.basis = PRIMES.slice(0, PRIMES.indexOf(basis) + 1).map(
        p => new Fraction(p)
      );
    } else if (typeof basis === 'string') {
      this.basis = basis.split('.').map(b => new Fraction(b));
    } else {
      this.basis = basis.map(b => new Fraction(b));
    }
  }

  toString() {
    return this.basis.map(b => b.toFraction()).join('.');
  }

  jip() {
    return this.basis.map(b => Math.log(b.valueOf()));
  }

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

  toFraction(monzo: Monzo) {
    return monzo
      .map((exponent, i) => this.basis[i].pow(exponent))
      .reduce((a, b) => a.mul(b));
  }

  patentVal(divisions: number) {
    return patentVal(divisions, this.jip());
  }

  fromWarts(token: number | string) {
    return fromWarts(token, this.jip());
  }

  toWarts(val: number[]) {
    return toWarts(val, this.jip());
  }

  toPrimeMapping(mapping: number[]): number[] {
    const basisMonzos = this.basis.map(b => fractionToMonzo(b));
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

    // Same assumptions as in monzo conversion
    // The result has "holes", but should work if the subgroup isn't too crazy
    const result = Array(limit).fill(0);
    for (let i = 0; i < basisMonzos.length; ++i) {
      let slotted = false;
      for (let j = 0; j < basisMonzos[i].length; ++j) {
        let slottable = true;
        if (basisMonzos[i][j]) {
          for (let k = 0; k < basisMonzos.length; ++k) {
            if (k === i) {
              continue;
            }
            if (basisMonzos[k][j]) {
              slottable = false;
              break;
            }
          }
          if (slottable) {
            result[j] = mapping[i] / basisMonzos[i][j];
            slotted = true;
            break;
          }
        }
      }
      if (!slotted) {
        throw new Error('Failed to produce a valid prime mapping');
      }
    }
    return result;

    /*
    *** Generic Algorithm but needs mathjs ***

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
      mapping.push(dot(basisMonzos[mapping_.length], LOG_PRIMES));
    }
    return flatten(lusolve(basisMonzos, mapping_));
    */
  }

  static inferPrimeSubgroup(commas: (Monzo | FractionValue)[]) {
    const monzos: Monzo[] = [];
    commas.forEach(comma => {
      if (
        Array.isArray(comma) &&
        !(comma.length === 2 && typeof comma[0] === 'string')
      ) {
        monzos.push(comma as Monzo);
        return;
      }
      monzos.push(fractionToMonzo(new Fraction(comma as FractionValue)));
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
  strip(comma: Monzo) {
    return this.basis.map(b => comma[PRIMES.indexOf(b.n)]);
  }
}
