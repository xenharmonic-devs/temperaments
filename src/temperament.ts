import type {Monzo} from './monzo';
import Algebra = require('ganja.js');
import {type Element} from 'ganja.js';
import {binomial, gcd, iteratedEuclid} from './utils';
import Fraction from 'fraction.js';
import {Subgroup, SubgroupValue, FractionValue} from './subgroup';

// No interpretation in Geometric Algebra
export type Mapping = number[];

// Promoted to vectors in Geometric Algebra
export type Val = number[];

// Promoted to pseudovectors in GA
export type Comma = number[];

// The weighting vector
// I think ganja.js ignores metric magnitude so we pre- and post-process
export type Metric = number[];

// Parse a subgroup like 2.15.11/7 to a list of logarithms
export function parseJIP(token: string) {
  return token.split('.').map(t => Math.log(new Fraction(t).valueOf()));
}

export function natsToCents(nats: number) {
  return (nats / Math.LN2) * 1200;
}

export function centsToNats(cents: number) {
  return (cents / 1200) * Math.LN2;
}

abstract class BaseTemperament {
  algebra: typeof Element; // Clifford Algebra
  value: Element; // Multivector of the Clifford Algebra

  constructor(algebra: typeof Element, value: Element) {
    this.algebra = algebra;
    this.value = value;
  }

  isNil() {
    for (let i = 0; i < this.value.length; ++i) {
      if (this.value[i]) {
        return false;
      }
    }
    return true;
  }

  canonize() {
    let firstSign = 0;
    let commonFactor = 0;
    for (let i = 0; i < this.value.length; ++i) {
      commonFactor = gcd(commonFactor, Math.abs(this.value[i]));
      if (!firstSign && this.value[i]) {
        firstSign = Math.sign(this.value[i]);
      }
    }
    if (!commonFactor) {
      return;
    }
    for (let i = 0; i < this.value.length; ++i) {
      this.value[i] *= firstSign / commonFactor;
      if (Object.is(this.value[i], -0)) {
        this.value[i] = 0;
      }
    }
  }

  // Only checks numerical equality, canonize your inputs beforehand
  equals(other: BaseTemperament) {
    if (this.value.length !== other.value.length) {
      return false;
    }

    for (let i = 0; i < this.value.length; ++i) {
      if (this.value[i] !== other.value[i]) {
        return false;
      }
    }
    return true;
  }

  // abstract toTenneyEuclid(metric_?: Metric): Mapping;
  // abstract toPOTE(metric?: Metric): Mapping;

  get dimensions() {
    return Math.round(Math.log(this.value.length) / Math.LN2);
  }

  // Assumes this is canonized rank-2
  divisionsGenerator(): [number, Monzo] {
    const equaveUnit = new this.algebra(Array(this.value.length).fill(0));
    equaveUnit[1] = 1;
    const equaveProj = equaveUnit.Dot(this.value);
    const generator = new this.algebra(iteratedEuclid([...equaveProj]));
    const divisions = Math.abs(generator.Dot(equaveProj).s);

    return [divisions, [...generator.slice(1, this.dimensions + 1)]];
  }

  rankPrefix(rank: number): number[] {
    const dims = this.dimensions;
    let start = 0;
    for (let i = 0; i < rank; ++i) {
      start += binomial(dims, i);
    }
    return [...this.value.slice(start, start + binomial(dims - 1, rank - 1))];
  }
}

// Temperament with an arbitrary basis represented in Geometric Algebra
export class FreeTemperament extends BaseTemperament {
  jip: Mapping; // Just Intonation Point

  constructor(algebra: typeof Element, value: Element, jip: any) {
    super(algebra, value);
    this.jip = jip;
  }

  // Only checks numerical equality, canonize your inputs beforehand
  equals(other: FreeTemperament) {
    if (this.jip.length !== other.jip.length) {
      return false;
    }
    for (let i = 0; i < this.jip.length; ++i) {
      // XXX: This probably should be a check for closeness instead
      if (this.jip[i] !== other.jip[i]) {
        return false;
      }
    }
    return super.equals(other);
  }

  toTenneyEuclid(metric_?: Metric): Mapping {
    const metric = metric_ === undefined ? this.jip.map(j => 1 / j) : metric_;

    const jip = new this.algebra(Array(this.value.length).fill(0));
    this.jip.forEach((j, i) => (jip[i + 1] = j * metric[i]));

    const weightedValue_: number[] = [];
    (this.algebra.describe().basis as string[]).forEach((label, index) => {
      let component = this.value[index];
      if (label[0] === 'e') {
        label
          .slice(1)
          .split('')
          .forEach(i => (component *= metric[parseInt(i) - 1]));
      }
      weightedValue_.push(component);
    });
    const weightedValue = new this.algebra(weightedValue_);

    const projected = jip.Dot(weightedValue).Div(weightedValue);
    for (let i = 0; i < metric.length; ++i) {
      projected[i + 1] /= metric[i];
    }
    return [...projected.slice(1, 1 + metric.length)];
  }

  toPOTE(metric?: Metric): Mapping {
    const result = this.toTenneyEuclid(metric);
    const purifier = this.jip[0] / result[0];
    return result.map(component => component * purifier);
  }

  static fromValList(vals: Val[], jip: Mapping) {
    const Clifford: typeof Element = (Algebra as any)(jip.length);
    const algebraSize = 1 << jip.length;

    if (!vals.length) {
      const scalar = new Clifford(Array(algebraSize).fill(0));
      scalar[0] = 1;
      return new FreeTemperament(Clifford, scalar, jip);
    }
    const promotedVals = vals.map(val => {
      const vector = Array(algebraSize).fill(0);
      vector.splice(1, val.length, ...val);
      return new Clifford(vector);
    });
    return new FreeTemperament(
      Clifford,
      promotedVals.reduce((a, b) => Clifford.Wedge(a, b)),
      jip
    );
  }

  static fromCommaList(commas: Comma[], jip: Mapping) {
    const Clifford: typeof Element = (Algebra as any)(jip.length);
    const algebraSize = 1 << jip.length;

    const pseudoScalar = new Clifford(Array(algebraSize).fill(0));
    pseudoScalar[algebraSize - 1] = 1;
    if (!commas.length) {
      return new FreeTemperament(Clifford, pseudoScalar, jip);
    }

    const promotedCommas = commas.map(comma => {
      const vector = Array(algebraSize).fill(0);
      vector.splice(1, comma.length, ...comma);
      return new Clifford(vector).Mul(pseudoScalar);
    });

    return new FreeTemperament(
      Clifford,
      promotedCommas.reduce((a, b) => Clifford.Vee(a, b)),
      jip
    );
  }

  static fromPrefix(rank: number, wedgiePrefix: number[], jip: Mapping) {
    const dims = jip.length;
    const Clifford: typeof Element = (Algebra as any)(dims);
    const algebraSize = 1 << dims;

    const jip1 = new Clifford(Array(algebraSize).fill(0));
    jip.forEach((j, i) => (jip1[i + 1] = j / jip[0]));

    let end = 0;
    for (let i = 0; i < rank; ++i) {
      end += binomial(dims, i);
    }

    const vector = Array(algebraSize).fill(0);
    vector.splice(
      end - wedgiePrefix.length,
      wedgiePrefix.length,
      ...wedgiePrefix
    );
    const value = new Clifford(vector).Wedge(jip1);
    for (let i = 0; i < algebraSize; ++i) {
      value[i] = Math.round(value[i]);
    }
    return new FreeTemperament(Clifford, value, jip);
  }
}

// Fractional just intonation subgroup represented in Geometric Algebra
export class Temperament extends BaseTemperament {
  subgroup: Subgroup;

  constructor(
    algebra: typeof Element,
    value: Element,
    subgroup: SubgroupValue
  ) {
    super(algebra, value);
    this.subgroup = new Subgroup(subgroup);
  }

  // Only checks numerical equality, canonize your inputs beforehand
  equals(other: Temperament) {
    if (!this.subgroup.equals(other.subgroup)) {
      return false;
    }
    return super.equals(other);
  }

  toTenneyEuclid(primeMapping = false, metric_?: Metric): Mapping {
    const jip_ = this.subgroup.jip();
    const metric = metric_ === undefined ? jip_.map(j => 1 / j) : metric_;

    const jip = new this.algebra(Array(this.value.length).fill(0));
    jip_.forEach((j, i) => (jip[i + 1] = j * metric[i]));

    const weightedValue_: number[] = [];
    (this.algebra.describe().basis as string[]).forEach((label, index) => {
      let component = this.value[index];
      if (label[0] === 'e') {
        label
          .slice(1)
          .split('')
          .forEach(i => (component *= metric[parseInt(i) - 1]));
      }
      weightedValue_.push(component);
    });
    const weightedValue = new this.algebra(weightedValue_);

    const projected = jip.Dot(weightedValue).Div(weightedValue);
    for (let i = 0; i < metric.length; ++i) {
      projected[i + 1] /= metric[i];
    }
    const result = [...projected.slice(1, 1 + metric.length)];
    if (primeMapping) {
      return this.subgroup.toPrimeMapping(result) as Mapping;
    }
    return result;
  }

  toPOTE(primeMapping = false, metric?: Metric): Mapping {
    let result = this.toTenneyEuclid(false, metric);
    const purifier = Math.log(this.subgroup.basis[0].valueOf()) / result[0];
    result = result.map(component => component * purifier);
    if (primeMapping) {
      return this.subgroup.toPrimeMapping(result) as Mapping;
    }
    return result;
  }

  static fromValList(
    vals: (Val | number | string)[],
    subgroup_: SubgroupValue
  ) {
    const subgroup = new Subgroup(subgroup_);
    const Clifford: typeof Element = (Algebra as any)(subgroup.basis.length);
    const algebraSize = 1 << subgroup.basis.length;

    if (!vals.length) {
      const scalar = new Clifford(Array(algebraSize).fill(0));
      scalar[0] = 1;
      return new Temperament(Clifford, scalar, subgroup);
    }
    const promotedVals = vals.map(val_ => {
      let val: Val;
      if (typeof val_ === 'number' || typeof val_ === 'string') {
        val = subgroup.fromWarts(val_);
      } else {
        val = val_;
      }
      const vector = Array(algebraSize).fill(0);
      vector.splice(1, val.length, ...val);
      return new Clifford(vector);
    });
    return new Temperament(
      Clifford,
      promotedVals.reduce((a, b) => Clifford.Wedge(a, b)),
      subgroup
    );
  }

  static fromCommaList(
    commas: (Comma | FractionValue)[],
    subgroup_?: SubgroupValue
  ) {
    let subgroup: Subgroup;
    if (subgroup_ === undefined) {
      subgroup = Subgroup.inferPrimeSubgroup(commas);
    } else {
      subgroup = new Subgroup(subgroup_);
    }
    const Clifford: typeof Element = (Algebra as any)(subgroup.basis.length);
    const algebraSize = 1 << subgroup.basis.length;

    const pseudoScalar = new Clifford(Array(algebraSize).fill(0));
    pseudoScalar[algebraSize - 1] = 1;
    if (!commas.length) {
      return new Temperament(Clifford, pseudoScalar, subgroup);
    }

    const promotedCommas = commas.map(comma_ => {
      let comma: Comma;
      if (Array.isArray(comma_) && comma_.length > 2) {
        if (subgroup_ === undefined) {
          comma = subgroup.strip(comma_ as Monzo);
        } else {
          comma = comma_ as Comma;
        }
      } else {
        const [monzo, residual] = subgroup.toMonzoAndResidual(
          comma_ as FractionValue
        );
        if (!residual.equals(1)) {
          throw new Error('Comma outside subgroup');
        }
        comma = monzo;
      }
      const vector = Array(algebraSize).fill(0);
      vector.splice(1, comma.length, ...comma);
      return new Clifford(vector).Mul(pseudoScalar);
    });

    return new Temperament(
      Clifford,
      promotedCommas.reduce((a, b) => Clifford.Vee(a, b)),
      subgroup
    );
  }

  static fromPrefix(
    rank: number,
    wedgiePrefix: number[],
    subgroup_: SubgroupValue
  ) {
    const subgroup = new Subgroup(subgroup_);
    const dims = subgroup.basis.length;
    const Clifford: typeof Element = (Algebra as any)(dims);
    const algebraSize = 1 << dims;

    const jip1 = new Clifford(Array(algebraSize).fill(0));
    const jip = subgroup.jip();
    jip.forEach((j, i) => (jip1[i + 1] = j / jip[0]));

    let end = 0;
    for (let i = 0; i < rank; ++i) {
      end += binomial(dims, i);
    }

    const vector = Array(algebraSize).fill(0);
    vector.splice(
      end - wedgiePrefix.length,
      wedgiePrefix.length,
      ...wedgiePrefix
    );
    const value = new Clifford(vector).Wedge(jip1);
    for (let i = 0; i < algebraSize; ++i) {
      value[i] = Math.round(value[i]);
    }
    return new Temperament(Clifford, value, subgroup);
  }
}
