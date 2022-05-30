import {dot, Monzo} from './monzo';
import Algebra, {AlgebraElement, vee, wedge} from 'ts-geometric-algebra';
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
// Temperaments are stored as integers; Applied as needed.
export type Metric = number[];

// Parse a subgroup string like 2.15.11/7 to a list of logarithms
export function parseJIP(token: string) {
  return token.split('.').map(t => Math.log(new Fraction(t).valueOf()));
}

export function natsToCents(nats: number) {
  return (nats / Math.LN2) * 1200;
}

export function centsToNats(cents: number) {
  return (cents / 1200) * Math.LN2;
}

const ALGEBRA_CACHE: Map<number, typeof AlgebraElement> = new Map();
function getAlgebra(dimensions: number) {
  if (ALGEBRA_CACHE.has(dimensions)) {
    return ALGEBRA_CACHE.get(dimensions)!;
  }
  const algebra = Algebra(dimensions);
  ALGEBRA_CACHE.set(dimensions, algebra);
  return algebra;
}

export function clearCache() {
  ALGEBRA_CACHE.clear();
}

abstract class BaseTemperament {
  algebra: typeof AlgebraElement; // Clifford Algebra
  value: AlgebraElement; // Multivector of the Clifford Algebra

  constructor(algebra: typeof AlgebraElement, value: AlgebraElement) {
    this.algebra = algebra;
    this.value = value;
  }

  isNil() {
    return this.value.isNil();
  }

  canonize() {
    let firstSign = 0;
    let commonFactor = 0;
    const lexicographic = this.value.ganja();
    for (let i = 0; i < lexicographic.length; ++i) {
      commonFactor = gcd(commonFactor, Math.abs(this.value[i]));
      if (!firstSign && lexicographic[i]) {
        firstSign = Math.sign(lexicographic[i]);
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
    return this.value.equals(other.value);
  }

  get dimensions() {
    return this.algebra.dimensions;
  }

  // Assumes this is canonized rank-2
  divisionsGenerator(): [number, Monzo] {
    const equaveUnit = this.algebra.basisVector(0);
    const equaveProj = [...equaveUnit.dot(this.value).vector()];
    const generator = iteratedEuclid([...equaveProj]);
    const divisions = Math.abs(dot(generator, equaveProj));

    return [divisions, generator];
  }

  rankPrefix(rank: number): number[] {
    return [
      ...this.value
        .vector(rank)
        .slice(0, binomial(this.dimensions - 1, rank - 1)),
    ];
  }
}

// Temperament with an arbitrary basis represented in Geometric Algebra
export class FreeTemperament extends BaseTemperament {
  jip: Mapping; // Just Intonation Point

  constructor(algebra: typeof AlgebraElement, value: AlgebraElement, jip: any) {
    super(algebra, value);
    this.jip = jip;
  }

  // Only checks numerical equality, canonize your inputs beforehand
  equals(other: FreeTemperament) {
    if (this.jip.length !== other.jip.length) {
      return false;
    }
    for (let i = 0; i < this.jip.length; ++i) {
      if (this.jip[i] !== other.jip[i]) {
        return false;
      }
    }
    return super.equals(other);
  }

  toTenneyEuclid(metric_?: Metric): Mapping {
    const metric = metric_ === undefined ? this.jip.map(j => 1 / j) : metric_;

    const jip = this.algebra.fromVector(this.jip.map((j, i) => j * metric[i]));

    const weightedValue = this.value.applyWeights(metric);

    const projected = jip.dotL(weightedValue.inverse()).dotL(weightedValue);
    return [...projected.vector().map((p, i) => p / metric[i])];
  }

  toPOTE(metric?: Metric): Mapping {
    const result = this.toTenneyEuclid(metric);
    const purifier = this.jip[0] / result[0];
    return result.map(component => component * purifier);
  }

  static fromValList(vals: Val[], jip: Mapping) {
    const Clifford = getAlgebra(jip.length);

    if (!vals.length) {
      return new FreeTemperament(Clifford, Clifford.scalar(), jip);
    }
    const promotedVals = vals.map(val => Clifford.fromVector(val));
    return new FreeTemperament(
      Clifford,
      promotedVals.reduce((a, b) => wedge(a, b)),
      jip
    );
  }

  static fromCommaList(commas: Comma[], jip: Mapping) {
    const Clifford = getAlgebra(jip.length);

    if (!commas.length) {
      return new FreeTemperament(Clifford, Clifford.pseudoscalar(), jip);
    }

    const promotedCommas = commas.map(comma =>
      Clifford.fromVector(comma).dual()
    );

    return new FreeTemperament(
      Clifford,
      promotedCommas.reduce((a, b) => vee(a, b)),
      jip
    );
  }

  static fromPrefix(rank: number, wedgiePrefix: number[], jip: Mapping) {
    const dims = jip.length;
    const Clifford = getAlgebra(dims);

    const jip1 = Clifford.fromVector(jip.map(j => j / jip[0]));

    const paddedWedgie = Array(binomial(dims, rank - 1)).fill(0);
    paddedWedgie.splice(
      paddedWedgie.length - wedgiePrefix.length,
      wedgiePrefix.length,
      ...wedgiePrefix
    );

    const value = Clifford.fromVector(paddedWedgie, rank - 1).wedge(jip1);
    for (let i = 0; i < value.length; ++i) {
      value[i] = Math.round(value[i]);
    }
    return new FreeTemperament(Clifford, value, jip);
  }
}

// Fractional just intonation subgroup represented in Geometric Algebra
export class Temperament extends BaseTemperament {
  subgroup: Subgroup;

  constructor(
    algebra: typeof AlgebraElement,
    value: AlgebraElement,
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

    const jip = this.algebra.fromVector(jip_.map((j, i) => j * metric[i]));

    const weightedValue = this.value.applyWeights(metric);

    const projected = jip.dotL(weightedValue.inverse()).dotL(weightedValue);
    const result = [...projected.vector().map((p, i) => p / metric[i])];
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
    const Clifford = getAlgebra(subgroup.basis.length);

    if (!vals.length) {
      return new Temperament(Clifford, Clifford.scalar(), subgroup);
    }
    const promotedVals = vals.map(val_ => {
      let val: Val;
      if (typeof val_ === 'number' || typeof val_ === 'string') {
        val = subgroup.fromWarts(val_);
      } else {
        val = val_;
      }
      return Clifford.fromVector(val);
    });
    return new Temperament(
      Clifford,
      promotedVals.reduce((a, b) => wedge(a, b)),
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
    const Clifford = getAlgebra(subgroup.basis.length);

    if (!commas.length) {
      return new Temperament(Clifford, Clifford.pseudoscalar(), subgroup);
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
      return Clifford.fromVector(comma).dual();
    });

    return new Temperament(
      Clifford,
      promotedCommas.reduce((a, b) => vee(a, b)),
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
    const Clifford = getAlgebra(dims);

    const jip = subgroup.jip();
    const jip1 = Clifford.fromVector(jip.map(j => j / jip[0]));

    const paddedWedgie = Array(binomial(dims, rank - 1)).fill(0);
    paddedWedgie.splice(
      paddedWedgie.length - wedgiePrefix.length,
      wedgiePrefix.length,
      ...wedgiePrefix
    );

    const value = Clifford.fromVector(paddedWedgie, rank - 1).wedge(jip1);
    for (let i = 0; i < value.length; ++i) {
      value[i] = Math.round(value[i]);
    }
    return new Temperament(Clifford, value, subgroup);
  }
}
