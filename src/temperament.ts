import {dot, Monzo, MonzoValue} from './monzo';
import {AlgebraElement, wedge} from 'ts-geometric-algebra';
import {getAlgebra} from './utils';
import {Subgroup, SubgroupValue} from './subgroup';
import {fromWarts} from './warts';
import {
  binomial,
  Fraction,
  FractionValue,
  gcd,
  iteratedEuclid,
  mmod,
  natsToCents,
  natsToSemitones,
} from 'xen-dev-utils';

// No interpretation in Geometric Algebra
export type Mapping = number[];

// Promoted to vectors in Geometric Algebra
export type Val = number[];

// Promoted to pseudovectors in GA
export type Comma = number[];

// The weighting vector
// Temperaments are stored as integers; Applied as needed.
export type Weights = number[];

export type PitchUnits = 'ratio' | 'cents' | 'nats' | 'semitones';

export type TuningOptions = {
  units?: PitchUnits;
  temperEquaves?: boolean;
  primeMapping?: boolean;
  weights?: Weights;
  constraints?: MonzoValue[];
};

// Parse a subgroup string like 2.15.11/7 to a list of logarithms
export function parseJIP(token: string) {
  return token.split('.').map(t => Math.log(new Fraction(t).valueOf()));
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

  calculateTenneyEuclid(jip: Mapping, weights: Weights) {
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');

    const jip_ = Clifford.fromVector(jip.map((j, i) => j * weights[i]));

    const weightedValue = new Clifford(this.value).applyWeights(weights);

    const projected = jip_.dotL(weightedValue.inverse()).dotL(weightedValue);
    return [...projected.vector().map((p, i) => p / weights[i])];
  }

  calculateCTE(jip: Mapping, weights: Weights, constraints: Monzo[]) {
    const PGA = getAlgebra(this.algebra.dimensions, 'PGA');
    const one = PGA.scalar();
    const e0 = PGA.basisBlade(0); // Null blade
    const pse = e0.dual(); // Euclidean pseudoscalar

    const dualWeights = [1, ...weights.map(weight => 1 / weight)];

    function promote(element: AlgebraElement) {
      element = element.dual();
      const components = Array(PGA.size).fill(0);
      for (let i = 0; i < element.length; ++i) {
        components[i << 1] = element[i];
      }
      return new PGA(components).applyWeights(dualWeights);
    }

    function point(x: number[]) {
      return one.sub(e0.mul(PGA.fromVector([0, ...x]))).mul(pse);
    }

    function unpoint(point: AlgebraElement) {
      const vec = point.dual().vector();
      return [...vec.slice(1).map(c => c / vec[0])];
    }

    function proj(x: AlgebraElement, y: AlgebraElement) {
      return y.inverse().mul(y.dotL(x));
    }

    let temperament = promote(this.value);

    constraints.forEach(constraint => {
      const distance = dot(jip, constraint);
      const constraintPlane = PGA.fromVector([
        -distance,
        ...constraint,
      ]).applyWeights(dualWeights);
      temperament = temperament.wedge(constraintPlane);
    });

    const jip_ = point(jip.map((j, i) => j * weights[i]));

    return unpoint(proj(jip_, temperament)).map((c, i) => c / weights[i]);
  }

  periodGenerator(options?: TuningOptions): [number, number] {
    const mappingOptions = Object.assign({}, options || {});
    mappingOptions.units = 'nats';
    mappingOptions.primeMapping = false;
    const mapping = this.getMapping(mappingOptions);

    const [numPeriods, generatorMonzo] = this.numPeriodsGenerator();

    const period = mapping[0] / numPeriods;
    let generator = dot(mapping, generatorMonzo);
    generator = Math.min(mmod(generator, period), mmod(-generator, period));
    if (options?.units === 'nats') {
      return [period, generator];
    }
    if (options?.units === 'ratio') {
      return [Math.exp(period), Math.exp(generator)];
    }
    if (options?.units === 'semitones') {
      return [natsToSemitones(period), natsToSemitones(generator)];
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
  numPeriodsGenerator(): [number, Monzo] {
    const equaveUnit = this.algebra.basisBlade(0);
    const equaveProj = equaveUnit.dot(this.value).vector();
    const generator = iteratedEuclid(equaveProj);
    const numPeriods = Math.abs(dot(generator, equaveProj));

    return [numPeriods, generator];
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

  // JI is a slight misnomer here as we're dealing with formal primes only
  jiMapping(generators: number[][], threshold = 1e-5) {
    if (generators.length !== this.getRank()) {
      throw new Error('Number of basis generators must match rank');
    }
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');

    const gens = generators.map(g => Clifford.fromVector(g));
    const commaWedge = new Clifford(this.value.dual());

    const hyperWedge = wedge(...gens).wedge(commaWedge);

    // Formal primes
    const primeMaps = [];

    for (let i = 0; i < Clifford.dimensions; ++i) {
      const map = [];
      let sign = 1;
      for (let j = 0; j < generators.length; ++j) {
        let primeWedge = Clifford.basisBlade(i);
        for (let k = 0; k < generators.length; ++k) {
          if (j === k) {
            continue;
          }
          primeWedge = primeWedge.wedge(gens[k]);
        }
        map.push(
          primeWedge.wedge(commaWedge).invScale(hyperWedge, threshold) * sign
        );
        sign = -sign;
      }
      primeMaps.push(map);
    }

    // Transpose to get the mapping vectors
    const result = [];
    for (let i = 0; i < generators.length; ++i) {
      const row = [];
      for (let j = 0; j < primeMaps.length; ++j) {
        row.push(primeMaps[j][i]);
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
    if (options?.units === 'semitones') {
      return natsToSemitones(result);
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

    const weights = options.weights || this.jip.map(j => 1 / j);

    const constraints: Monzo[] = [];

    (options.constraints || []).forEach(constraint => {
      if (
        Array.isArray(constraint) &&
        !(constraint.length === 2 && typeof constraint[0] === 'string')
      ) {
        constraints.push(constraint as Monzo);
      } else {
        throw new Error('Free temperament constraints must be in monzo form');
      }
    });

    let mapping: Mapping;

    if (constraints.length) {
      mapping = this.calculateCTE(this.jip, weights, constraints);
    } else {
      mapping = this.calculateTenneyEuclid(this.jip, weights);
    }

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
    if (options.units === 'semitones') {
      return mapping.map(component => natsToSemitones(component));
    }
    return mapping.map(component => natsToCents(component));
  }

  valJoin(other: FreeTemperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');
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
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');
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

    let value = Clifford.scalar();

    vals.forEach(val_ => {
      let val: Val;
      if (typeof val_ === 'number' || typeof val_ === 'string') {
        val = fromWarts(val_, jip);
      } else {
        val = val_;
      }
      const previousValue = value;
      value = value.wedge(Clifford.fromVector(val));
      if (value.isNil(0)) {
        value = previousValue;
      }
    });

    return new FreeTemperament(Clifford, value, jip);
  }

  static fromCommas(commas: Comma[], jip: Mapping) {
    const Clifford = getAlgebra(jip.length);

    let value = Clifford.pseudoscalar();

    commas.forEach(comma => {
      const previousValue = value;
      value = value.vee(Clifford.fromVector(comma).dual());
      if (value.isNil(0)) {
        value = previousValue;
      }
    });

    return new FreeTemperament(Clifford, value, jip);
  }

  static fromPrefix(rank: number, wedgiePrefix: number[], jip: Mapping) {
    const dims = jip.length;
    const Clifford = getAlgebra(dims, 'float64');

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
    if (options.units === 'semitones') {
      return natsToSemitones(result);
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
    const jip = this.subgroup.jip();
    const weights = options.weights || jip.map(j => 1 / j);

    const constraints = (options.constraints || []).map(constraint =>
      this.subgroup.resolveMonzo(constraint)
    );

    let mapping: Mapping;

    if (constraints.length) {
      mapping = this.calculateCTE(jip, weights, constraints);
    } else {
      mapping = this.calculateTenneyEuclid(jip, weights);
    }

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
    if (options.units === 'semitones') {
      return mapping.map(component => natsToSemitones(component));
    }
    return mapping.map(component => natsToCents(component));
  }

  valJoin(other: Temperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');
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
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');
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

    let value = Clifford.scalar();
    vals.forEach(val_ => {
      let val: Val;
      if (typeof val_ === 'number' || typeof val_ === 'string') {
        val = subgroup_.fromWarts(val_);
      } else {
        val = val_;
      }
      const previousValue = value;
      value = value.wedge(Clifford.fromVector(val));
      if (value.isNil(0)) {
        value = previousValue;
      }
    });
    return new Temperament(Clifford, value, subgroup_);
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

    if (stripCommas === undefined) {
      stripCommas = subgroup === undefined;
    }

    let value = Clifford.pseudoscalar();
    commas.forEach(comma => {
      const previousValue = value;
      value = value.vee(
        Clifford.fromVector(subgroup_.resolveMonzo(comma, stripCommas)).dual()
      );
      if (value.isNil(0)) {
        value = previousValue;
      }
    });

    return new Temperament(Clifford, value, subgroup_);
  }

  static fromPrefix(
    rank: number,
    wedgiePrefix: number[],
    subgroup: SubgroupValue
  ) {
    const subgroup_ = new Subgroup(subgroup);
    const dims = subgroup_.basis.length;
    const Clifford = getAlgebra(dims, 'float64');

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
