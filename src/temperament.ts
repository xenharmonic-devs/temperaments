import {dot, Monzo, MonzoValue} from './monzo';
import Algebra, {AlgebraElement, vee, wedge} from 'ts-geometric-algebra';
import {
  binomial,
  gcd,
  iteratedEuclid,
  FractionValue,
  mmod,
  cachedLinSolve,
} from './utils';
import Fraction from 'fraction.js';
import {Subgroup, SubgroupValue} from './subgroup';
import {fromWarts} from './warts';

// No interpretation in Geometric Algebra
export type Mapping = number[];

// Promoted to vectors in Geometric Algebra
export type Val = number[];

// Promoted to pseudovectors in GA
export type Comma = number[];

// The weighting vector
// Temperaments are stored as integers; Applied as needed.
export type Metric = number[];

export type PitchUnits = 'ratio' | 'cents' | 'nats';

export type TuningOptions = {
  units?: PitchUnits;
  temperEquaves?: boolean;
  primeMapping?: boolean;
  metric?: Metric;
};

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

const ALGEBRA_CACHES: Map<number, typeof AlgebraElement>[] = [
  new Map(),
  new Map(),
];
function getAlgebra(dimensions: number, real = false) {
  const cache = real ? ALGEBRA_CACHES[0] : ALGEBRA_CACHES[1];
  if (cache.has(dimensions)) {
    return cache.get(dimensions)!;
  }
  const baseType = real ? Float64Array : Int32Array;
  const algebra = Algebra(dimensions, 0, 0, baseType);
  cache.set(dimensions, algebra);
  return algebra;
}

export function clearCache() {
  ALGEBRA_CACHES[0].clear();
  ALGEBRA_CACHES[1].clear();
}

abstract class BaseTemperament {
  algebra: typeof AlgebraElement; // Clifford Algebra
  value: AlgebraElement; // Multivector of the Clifford Algebra

  constructor(algebra: typeof AlgebraElement, value: AlgebraElement) {
    this.algebra = algebra;
    this.value = value;
  }

  abstract getMapping(options?: TuningOptions): Mapping;

  abstract valJoin(other: BaseTemperament): BaseTemperament;
  abstract valMeet(other: BaseTemperament): BaseTemperament;
  abstract kernelJoin(other: BaseTemperament): BaseTemperament;
  abstract kernelMeet(other: BaseTemperament): BaseTemperament;

  periodGenerator(options?: TuningOptions): [number, number] {
    const mappingOptions = Object.assign({}, options || {});
    mappingOptions.units = 'nats';
    mappingOptions.primeMapping = false;
    const mapping = this.getMapping(mappingOptions);

    const [divisions, generatorMonzo] = this.divisionsGenerator();

    const period = mapping[0] / divisions;
    let generator = dot(mapping, generatorMonzo);
    generator = Math.min(mmod(generator, period), mmod(-generator, period));
    if (options?.units === 'nats') {
      return [period, generator];
    }
    if (options?.units === 'ratio') {
      return [Math.exp(period), Math.exp(generator)];
    }
    return [natsToCents(period), natsToCents(generator)];
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
    const equaveUnit = this.algebra.basisBlade(0);
    const equaveProj = equaveUnit.dot(this.value).vector();
    const generator = iteratedEuclid(equaveProj);
    const divisions = Math.abs(dot(generator, equaveProj));

    return [divisions, generator];
  }

  getRank(): number {
    return this.value.grades()[0];
  }

  rankPrefix(rank: number): number[] {
    return [
      ...this.value
        .vector(rank)
        .slice(0, binomial(this.dimensions - 1, rank - 1)),
    ];
  }

  getNames(): {given?: string; color?: string; wedgie: string} {
    throw new Error('Unimplemented');
  }

  rescaleValue(value: AlgebraElement, persistence = 100, threshold = 1e-4) {
    const grade = value.grades()[0];
    const blade = value.vector(grade);

    let minValue = Infinity;
    for (let i = 0; i < blade.length; ++i) {
      const component = Math.abs(blade[i]);
      if (component > threshold && component < Math.abs(minValue)) {
        minValue = blade[i];
      }
    }

    let normalizer = 1 / minValue;

    let good = false;
    for (let j = 1; j < persistence; ++j) {
      const n = normalizer * j;
      good = true;
      for (let i = 0; i < blade.length; ++i) {
        const component = blade[i] * n;
        if (Math.abs(component - Math.round(component)) > threshold) {
          good = false;
          break;
        }
      }
      if (good) {
        normalizer = n;
        break;
      }
    }
    if (!good) {
      throw new Error('Failed to rescale. Try increasing persistence.');
    }

    return this.algebra.fromVector(
      blade.map(c => Math.round(c * normalizer)),
      grade
    );
  }

  jiMapping(generators: number[][], tolerance = 1e-5) {
    if (generators.length !== this.getRank()) {
      throw new Error('Number of basis generators must match rank');
    }
    const Clifford = getAlgebra(this.algebra.dimensions, true);

    // Not real commas with integer components, but we're not using them in the final result anyway
    const commas = new Clifford(this.value.dual())
      .bladeFactorize()[0]
      .map(b => [...b.vector()]);
    const basis = generators.concat(commas);

    const primes = [];
    for (let i = 0; i < this.algebra.dimensions; ++i) {
      const prime = Array(this.algebra.dimensions).fill(0);
      prime[i] = 1;
      primes.push(prime);
    }
    // Calculate how each prime maps
    const result_ = [];
    for (let i = 0; i < primes.length; ++i) {
      result_.push(
        cachedLinSolve(primes[i], basis, tolerance).slice(0, generators.length)
      );
    }
    // Transpose to get the mapping vectors
    const result = [];
    for (let i = 0; i < generators.length; ++i) {
      const row = [];
      for (let j = 0; j < result_.length; ++j) {
        row.push(Math.round(result_[j][i]));
      }
      result.push(row);
    }
    return result;
  }
}

// Temperament with an arbitrary basis represented in Geometric Algebra
export class FreeTemperament extends BaseTemperament {
  jip: Mapping; // Just Intonation Point

  constructor(algebra: typeof AlgebraElement, value: AlgebraElement, jip: any) {
    super(algebra, value);
    this.jip = jip;
  }

  steps(interval: Monzo): number {
    return this.value.star(this.algebra.fromVector(interval));
  }

  tune(interval: Monzo, options?: TuningOptions): number {
    const mappingOptions = Object.assign({}, options || {});
    mappingOptions.units = 'nats';
    mappingOptions.primeMapping = false;
    const result = dot(this.getMapping(mappingOptions), interval);
    if (options?.units === 'nats') {
      return result;
    }
    if (options?.units === 'ratio') {
      return Math.exp(result);
    }
    return natsToCents(result);
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

  getMapping(options?: TuningOptions): Mapping {
    options = options || {};

    if (options.primeMapping === true) {
      throw new Error('Free temperaments cannot be interpreted as primes');
    }

    const metric = options.metric || this.jip.map(j => 1 / j);

    const Clifford = getAlgebra(this.algebra.dimensions, true);

    const jip = Clifford.fromVector(this.jip.map((j, i) => j * metric[i]));

    const weightedValue = new Clifford(this.value).applyWeights(metric);

    const projected = jip.dotL(weightedValue.inverse()).dotL(weightedValue);
    const mapping = [...projected.vector().map((p, i) => p / metric[i])];

    if (!options.temperEquaves) {
      const purifier = this.jip[0] / mapping[0];
      for (let i = 0; i < mapping.length; ++i) {
        mapping[i] *= purifier;
      }
    }
    if (options.units === 'nats') {
      return mapping;
    }
    if (options.units === 'ratio') {
      return mapping.map(component => Math.exp(component));
    }
    return mapping.map(component => natsToCents(component));
  }

  valJoin(other: FreeTemperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, true);
    let join = new Clifford(this.value).meetJoin(
      new Clifford(other.value),
      threshold
    )[1];
    join = this.rescaleValue(join, persistence, threshold);
    return new FreeTemperament(this.algebra, join, this.jip);
  }
  kernelMeet(other: FreeTemperament) {
    return this.valJoin(other);
  }

  valMeet(other: FreeTemperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, true);
    let meet = new Clifford(this.value).meetJoin(
      new Clifford(other.value),
      threshold
    )[0];
    meet = this.rescaleValue(meet, persistence, threshold);
    return new FreeTemperament(this.algebra, meet, this.jip);
  }
  kernelJoin(other: FreeTemperament) {
    return this.valMeet(other);
  }

  static fromVals(vals: (Val | number | string)[], jip: Mapping) {
    const Clifford = getAlgebra(jip.length);

    if (!vals.length) {
      return new FreeTemperament(Clifford, Clifford.scalar(), jip);
    }

    const promotedVals = vals.map(val_ => {
      let val: Val;
      if (typeof val_ === 'number' || typeof val_ === 'string') {
        val = fromWarts(val_, jip);
      } else {
        val = val_;
      }
      return Clifford.fromVector(val);
    });

    return new FreeTemperament(Clifford, wedge(...promotedVals), jip);
  }

  static fromCommas(commas: Comma[], jip: Mapping) {
    const Clifford = getAlgebra(jip.length);

    if (!commas.length) {
      return new FreeTemperament(Clifford, Clifford.pseudoscalar(), jip);
    }

    const promotedCommas = commas.map(comma =>
      Clifford.fromVector(comma).dual()
    );

    return new FreeTemperament(Clifford, vee(...promotedCommas), jip);
  }

  static fromPrefix(rank: number, wedgiePrefix: number[], jip: Mapping) {
    const dims = jip.length;
    const Clifford = getAlgebra(dims, true);

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
    const IntClifford = getAlgebra(dims);
    const intValue = new IntClifford(value);
    return new FreeTemperament(IntClifford, intValue, jip);
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

  steps(interval: MonzoValue, primeMapping = false): number {
    const monzo = this.subgroup.resolveMonzo(interval, primeMapping);
    return this.value.star(this.algebra.fromVector(monzo));
  }

  tune(interval: MonzoValue, options?: TuningOptions): number {
    options = options || {};
    const primeMapping = !!options.primeMapping;
    const monzo = this.subgroup.resolveMonzo(interval, primeMapping);
    const mappingOptions = Object.assign({}, options || {});
    mappingOptions.units = 'nats';
    const result = dot(this.getMapping(mappingOptions), monzo);
    if (options.units === 'nats') {
      return result;
    }
    if (options.units === 'ratio') {
      return Math.exp(result);
    }
    return natsToCents(result);
  }

  // Only checks numerical equality, canonize your inputs beforehand
  equals(other: Temperament) {
    if (!this.subgroup.equals(other.subgroup)) {
      return false;
    }
    return super.equals(other);
  }

  getMapping(options?: TuningOptions): Mapping {
    options = options || {};
    const jip_ = this.subgroup.jip();
    const metric = options.metric || jip_.map(j => 1 / j);

    const Clifford = getAlgebra(this.algebra.dimensions, true);

    const jip = Clifford.fromVector(jip_.map((j, i) => j * metric[i]));

    const weightedValue = new Clifford(this.value).applyWeights(metric);

    const projected = jip.dotL(weightedValue.inverse()).dotL(weightedValue);
    let mapping = [...projected.vector().map((p, i) => p / metric[i])];
    if (!options.temperEquaves) {
      const purifier = Math.log(this.subgroup.basis[0].valueOf()) / mapping[0];
      mapping = mapping.map(component => component * purifier);
    }
    if (options.primeMapping) {
      mapping = this.subgroup.toPrimeMapping(mapping);
    }
    if (options.units === 'nats') {
      return mapping;
    }
    if (options.units === 'ratio') {
      return mapping.map(component => Math.exp(component));
    }
    return mapping.map(component => natsToCents(component));
  }

  valJoin(other: Temperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, true);
    let join = new Clifford(this.value).meetJoin(
      new Clifford(other.value),
      threshold
    )[1];
    join = this.rescaleValue(join, persistence, threshold);
    return new Temperament(this.algebra, join, this.subgroup);
  }
  kernelMeet(other: Temperament) {
    return this.valJoin(other);
  }

  valMeet(other: Temperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, true);
    let meet = new Clifford(this.value).meetJoin(
      new Clifford(other.value),
      threshold
    )[0];
    meet = this.rescaleValue(meet, persistence, threshold);
    return new Temperament(this.algebra, meet, this.subgroup);
  }
  kernelJoin(other: Temperament) {
    return this.valMeet(other);
  }

  static fromVals(vals: (Val | number | string)[], subgroup: SubgroupValue) {
    const subgroup_ = new Subgroup(subgroup);
    const Clifford = getAlgebra(subgroup_.basis.length);

    if (!vals.length) {
      return new Temperament(Clifford, Clifford.scalar(), subgroup_);
    }
    const promotedVals = vals.map(val_ => {
      let val: Val;
      if (typeof val_ === 'number' || typeof val_ === 'string') {
        val = subgroup_.fromWarts(val_);
      } else {
        val = val_;
      }
      return Clifford.fromVector(val);
    });
    return new Temperament(Clifford, wedge(...promotedVals), subgroup_);
  }

  static fromCommas(
    commas: (Comma | FractionValue)[],
    subgroup?: SubgroupValue,
    stripCommas?: boolean
  ) {
    let subgroup_: Subgroup;
    if (subgroup === undefined) {
      subgroup_ = Subgroup.inferPrimeSubgroup(commas);
    } else {
      subgroup_ = new Subgroup(subgroup);
    }
    const Clifford = getAlgebra(subgroup_.basis.length);

    if (!commas.length) {
      return new Temperament(Clifford, Clifford.pseudoscalar(), subgroup_);
    }

    if (stripCommas === undefined) {
      stripCommas = subgroup === undefined;
    }

    const promotedCommas = commas.map(comma =>
      Clifford.fromVector(subgroup_.resolveMonzo(comma, stripCommas)).dual()
    );

    return new Temperament(Clifford, vee(...promotedCommas), subgroup_);
  }

  static fromPrefix(
    rank: number,
    wedgiePrefix: number[],
    subgroup: SubgroupValue
  ) {
    const subgroup_ = new Subgroup(subgroup);
    const dims = subgroup_.basis.length;
    const Clifford = getAlgebra(dims, true);

    const jip = subgroup_.jip();
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
    const IntClifford = getAlgebra(dims);
    const intValue = new IntClifford(value);
    return new Temperament(IntClifford, intValue, subgroup_);
  }

  // Monkey patched in at names.ts
  static fromName(
    name: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    subgroup?: SubgroupValue // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Temperament {
    throw new Error('Unimplemented');
  }
  static fromColor(
    color: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Temperament {
    throw new Error('Unimplemented');
  }
}
