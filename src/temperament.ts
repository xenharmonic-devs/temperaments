import {MonzoValue, resolveMonzo} from './monzo';
import {AlgebraElement, vee, wedge} from 'ts-geometric-algebra';
import {getAlgebra} from './utils';
import {Mapping, PitchUnits, Subgroup, SubgroupValue} from './subgroup';
import {fromWarts, generalizedPatentVals, Val, wartVariants} from './warts';
import {
  binomial,
  dot,
  FractionValue,
  gcd,
  iteratedEuclid,
  iterKCombinations,
  mmod,
  Monzo,
  natsToCents,
  natsToSemitones,
} from 'xen-dev-utils';

// Vals promoted to vectors in Geometric Algebra
// Commas Promoted to pseudovectors in GA

/** Rational number representing a small musical interval in monzo form. */
export type Comma = number[];

// The weighting vector
// Temperaments are stored as integers; Applied as needed.
/** Importance weighting for the basis factors of a subgroup. */
export type Weights = number[];

/**
 * Options that determine how a temperament is interpreted as a musical tuning.
 */
export type TuningOptions = {
  /** The units pitch of intervals and mappings are measured in. */
  units?: PitchUnits;
  /** If `true` tempering is applied to octaves as well (or whatever the first basis factor of the subgroup is). */
  temperEquaves?: boolean;
  /** If `true` the intervals and mappings are given in terms of consecutive prime numbers instead of the basis of the subgroup. */
  primeMapping?: boolean;
  /** Importance weighting for the basis factors of the subgroup. */
  weights?: Weights;
  /** Invariant intervals i.e. eigenmonzos of the tuning. */
  constraints?: MonzoValue[];
};

/**
 * Factorization strategy.
 * 'patent': Use patent vals only.
 * 'GPV': Use generalized patent vals.
 * 'mapping': Use ET approximation to the temperament's POTE mapping.
 * 'GM': Use generalized approximations to the temperament's TE mapping.
 */
export type FactorizationStrategy =
  | 'patent'
  | 'GPV'
  | 'mapping'
  | 'GM'
  | 'warts';

abstract class BaseTemperament {
  /** The Clifford algebra where the temperament is interpreted in. All-positive metric with integer coefficients. */
  algebra: typeof AlgebraElement;
  /** An element of the Clifford algebra representing the temperament. */
  value: AlgebraElement;

  constructor(algebra: typeof AlgebraElement, value: AlgebraElement) {
    this.algebra = algebra;
    this.value = value;
  }

  abstract getJip(units: PitchUnits): Mapping;
  abstract getMapping(options?: TuningOptions): Mapping;

  abstract valJoin(other: BaseTemperament): BaseTemperament;
  abstract valMeet(other: BaseTemperament): BaseTemperament;
  abstract kernelJoin(other: BaseTemperament): BaseTemperament;
  abstract kernelMeet(other: BaseTemperament): BaseTemperament;

  protected calculateTenneyEuclid(jip: Mapping, weights: Weights) {
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');

    const jip_ = Clifford.fromVector(jip.map((j, i) => j * weights[i]));

    const weightedValue = new Clifford(this.value).applyWeights(weights);

    const projected = jip_.dotL(weightedValue.inverse()).dotL(weightedValue);
    return [...projected.vector().map((p, i) => p / weights[i])];
  }

  protected calculateCTE(jip: Mapping, weights: Weights, constraints: Monzo[]) {
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

  /**
   * Obtain the period and generator of a rank 2 temperament.
   * @param options Options determining how the temperament is interpreted as a tuning and the units of the result.
   * @returns A pair `[period, generator]` in cents (default) or the specified units.
   */
  periodGenerators(options?: TuningOptions): number[] {
    const mappingOptions = Object.assign({}, options || {});
    mappingOptions.units = 'nats';
    mappingOptions.primeMapping = false;
    const mapping = this.getMapping(mappingOptions);

    const [numPeriods, generatorMonzos] = this.numPeriodsGenerators();

    const period = mapping[0] / numPeriods;
    let generators = generatorMonzos.map(g => dot(mapping, g));
    generators = generators.map(g =>
      Math.min(mmod(g, period), mmod(-g, period))
    );
    generators.sort((a, b) => a - b);
    const result = [period].concat(generators);
    if (options?.units === 'nats') {
      return result;
    }
    if (options?.units === 'ratio') {
      return result.map(Math.exp);
    }
    if (options?.units === 'semitones') {
      return result.map(natsToSemitones);
    }
    return result.map(natsToCents);
  }

  /** Returns `true` if the temperament value is zero representing the trivial temperament of a single pitch only.*/
  isNil() {
    return this.value.isNil();
  }

  /**
   * Canonize the temperament in-place into wedgie form.
   * Remove a common factor and make the lexicographically first non-zero element positive.
   */
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
      return this;
    }
    for (let i = 0; i < this.value.length; ++i) {
      this.value[i] *= firstSign / commonFactor;
      if (Object.is(this.value[i], -0)) {
        this.value[i] = 0;
      }
    }
    return this;
  }

  /**
   * Check if two temperaments are the same.
   * Only checks numerical equality, canonize your inputs beforehand.
   * @param other Another temperament.
   * @returns `true` if the temperament is equal to the other.
   */
  equals(other: BaseTemperament) {
    return this.value.equals(other.value);
  }

  /**
   * The size of the temperament's subgroup.
   */
  get dimensions() {
    return this.algebra.dimensions;
  }

  /**
   * Obtain the number of periods per octave (or equave) and the generators in monzo form.
   * The procedure assumes that the temperament is canonized.
   * @returns A pair representing the number of periods per equave and the generators as monzos of the temperament's subgroup.
   */
  numPeriodsGenerators(): [number, Monzo[]] {
    const rank = this.getRank();
    const equaveUnit = this.algebra.basisBlade(0);
    const equaveOrthoComplement = equaveUnit.dotL(this.value);
    const numPeriods = Math.abs(equaveOrthoComplement.reduce(gcd));
    if (rank === 1) {
      return [numPeriods, []];
    }
    if (rank === 2) {
      const generator = iteratedEuclid(equaveOrthoComplement.vector());
      return [numPeriods, [generator]];
    }

    let remaining = rank - 1;

    const generators = [];
    for (let i = 1; i < this.dimensions; ++i) {
      const blade = this.algebra.basisBlade(i);
      if (remaining === 1) {
        const measure = blade
          .wedge(generators.reduce((a, b) => a.wedge(b)))
          .star(equaveOrthoComplement);
        if (measure === numPeriods) {
          generators.push(blade);
          return [numPeriods, generators.map(g => [...g.vector()])];
        }
      } else if (
        Math.abs(blade.dotL(equaveOrthoComplement).reduce(gcd)) === numPeriods
      ) {
        generators.push(blade);
        remaining--;
      }
    }
    if (remaining !== 1) {
      throw new Error('Failed to find generators');
    }
    const final = iteratedEuclid(
      generators
        .reduce((a, b) => a.wedge(b))
        .dotL(equaveOrthoComplement)
        .vector()
    );
    return [numPeriods, [final].concat(generators.map(g => [...g.vector()]))];
  }

  /**
   * Get the rank of the temperament i.e. the number of inpendent intervals in the tuning.
   * @returns The rank of the temperament.
   */
  getRank(): number {
    return this.value.grades()[0];
  }

  /**
   * Get a prefix of the temperament's full wedgie that may be used to reconstruct it. Potentially lossy compression.
   * @param rank The rank of the temperament.
   * @returns The first few components of the temperament's wedgie that can be used to reconstruct the temperament if it's regular enough.
   */
  rankPrefix(rank?: number): number[] {
    if (rank === undefined) {
      rank = this.getRank();
    }
    return [
      ...this.value
        .vector(rank)
        .slice(0, binomial(this.dimensions - 1, rank - 1)),
    ];
  }

  protected rescaleValue(
    value: AlgebraElement,
    persistence = 100,
    threshold = 1e-4
  ) {
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

  /**
   * Calculate the change of basis mapping from primes to the generators of the temperament.
   * @param generators Period and generators used as the new basis.
   * @param threshold Zero threshold used during the calculation.
   * @returns Change of basis matrix as an array of arrays of numbers.
   */
  basisMapping(generators: number[][], threshold = 1e-5) {
    if (generators.length !== this.getRank()) {
      throw new Error('Number of basis generators must match rank');
    }
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');

    const gens = generators.map(g => Clifford.fromVector(g));
    const commaWedge = new Clifford(this.value.dual());

    const hyperwedge = wedge(...gens).wedge(commaWedge);

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
          primeWedge.wedge(commaWedge).invScale(hyperwedge, threshold) * sign
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

  /**
   * Factorize the temperament into vals.
   * @param maxDivisions Maximum divisions of the equave to consider.
   * @param wartRadius Maximum deviations from closest tunings to consider.
   * @param strategy Factorization strategy.
   * @returns An array of vals that recreates the original temperament when passed to `.fromVals`.
   * @throws An error if the search space doesn't contain the factors.
   */
  valFactorize(
    minDivisions = 2,
    maxDivisions = 99,
    wartRadius = 0,
    strategy: FactorizationStrategy = 'patent',
    subgroup?: Subgroup
  ) {
    let mapping: Mapping;
    if (strategy === 'patent' || strategy === 'GPV') {
      mapping = this.getJip('nats');
    } else {
      mapping = this.getMapping({units: 'nats', temperEquaves: true});
    }

    const factors: Val[] = [];

    let hyperwedge = this.algebra.scalar();

    const pushAndWedge = (candidate: AlgebraElement) => {
      if (
        this.value.wedge(candidate).isNil() &&
        !hyperwedge.wedge(candidate).isNil()
      ) {
        hyperwedge = hyperwedge.wedge(candidate);
        factors.push([...candidate.vector()]);
        if (
          hyperwedge.equals(this.value) ||
          hyperwedge.equals(this.value.neg())
        ) {
          return true;
        }
      }
      return false;
    };

    function* vary(
      letters: string[],
      base: string,
      radius: number
    ): Generator<Val> {
      if (radius <= 0) {
        yield subgroup!.fromWarts(base);
      } else {
        for (const letter of letters) {
          yield* vary(letters, base + letter, radius - 1);
        }
      }
    }

    const normalizedMapping = mapping.map(m => m / mapping[0]);

    if (strategy === 'patent' || strategy === 'mapping') {
      for (
        let divisions = minDivisions;
        divisions <= maxDivisions;
        ++divisions
      ) {
        const base = normalizedMapping.map(m => Math.round(m * divisions));
        for (const variant of wartVariants(base, wartRadius)) {
          if (variant.reduce(gcd) !== 1) {
            continue;
          }
          const candidate = this.algebra.fromVector(variant);
          if (pushAndWedge(candidate)) {
            return factors;
          }
        }
      }
    } else if (strategy === 'GPV' || strategy === 'GM') {
      for (const base of generalizedPatentVals(
        mapping,
        minDivisions,
        maxDivisions
      )) {
        for (const variant of wartVariants(base, wartRadius)) {
          if (variant.reduce(gcd) !== 1) {
            continue;
          }
          const candidate = this.algebra.fromVector(variant);
          if (pushAndWedge(candidate)) {
            return factors;
          }
        }
      }
    } else {
      const letters = subgroup!.wartLetters().slice(1);

      for (
        let divisions = minDivisions;
        divisions <= maxDivisions;
        ++divisions
      ) {
        for (let radius = 0; radius <= wartRadius; ++radius) {
          for (const variant of vary(letters, divisions.toString(), radius)) {
            const candidate = this.algebra.fromVector(variant);
            if (pushAndWedge(candidate)) {
              return factors;
            }
          }
        }
      }
    }
    throw new Error('Val factorization not found within the search space');
  }

  /**
   * Factorize the temperament into commas.
   * @param maxDivisions Maximum divisions of the equave to consider.
   * @returns An array of commas that recreates the original temperament when passed to `.fromCommas`.
   * @throws An error if the search space doesn't contain the factors.
   */
  commaFactorize(maxDivisions = 99) {
    const mapping = this.getJip('nats');
    const normalizedMapping = mapping.map(m => m / mapping[0]);
    const corank = this.dimensions - this.getRank();

    if (corank <= 1) {
      return [[...this.value.dual().vector()]];
    }

    const hyperwedges: [number, AlgebraElement][] = [[corank, this.value]];

    const commaDuals: AlgebraElement[] = [];

    const pushAndVee = (commaDual: AlgebraElement) => {
      const neg = commaDual.neg();
      for (const existing of commaDuals) {
        if (commaDual.equals(existing) || neg.equals(existing)) {
          return null;
        }
      }
      commaDuals.push(commaDual);
      const negValue = this.value.neg();
      for (const combination of iterKCombinations(commaDuals, corank)) {
        const hypervee = vee(...combination);
        if (hypervee.equals(this.value) || hypervee.equals(negValue)) {
          return combination;
        }
      }
      return null;
    };

    for (let divisions = 1; divisions <= maxDivisions; ++divisions) {
      const val = this.algebra.fromVector(
        normalizedMapping.map(m => Math.round(m * divisions))
      );
      for (let [cr, hyperwedge] of hyperwedges) {
        hyperwedge = hyperwedge.wedge(val);
        if (hyperwedge.isNil()) {
          continue;
        }
        cr -= 1;
        const factor = hyperwedge.reduce(gcd);
        hyperwedge.rescale(1 / factor);

        if (cr <= 1) {
          const result = pushAndVee(hyperwedge);
          if (result !== null) {
            return result.map(cd => [...cd.dual().vector()]);
          }
          continue;
        }

        const neg = hyperwedge.neg();
        let novel = true;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [_, existing] of hyperwedges) {
          if (hyperwedge.equals(existing) || neg.equals(existing)) {
            novel = false;
            break;
          }
        }
        if (novel) {
          hyperwedges.push([cr, hyperwedge]);
        }
      }
    }

    throw new Error('Comma factorization not found within the search space');
  }
}

/**
 * Temperament with an arbitrary basis represented as an element of a Clifford algebra.
 */
export class FreeTemperament extends BaseTemperament {
  /** Natural logarithms of the basis factors. */
  jip: Mapping; // Just Intonation Point

  /**
   * Construct a new temperament of an arbitrary basis.
   * @param algebra Clifford algebra of with an all-positive metric and integer components.
   * @param value Element of the Clifford algebra representing the temperament.
   * @param jip Natural logarithms of the basis factors.
   */
  constructor(
    algebra: typeof AlgebraElement,
    value: AlgebraElement,
    jip: Mapping
  ) {
    super(algebra, value);
    this.jip = jip;
  }

  /**
   * Just intonation point.
   * @param units: Units to measure the basis factors in.
   * @returns Array of logarithms of the basis factors or the factors themselves if 'ratio' was specified.
   */
  getJip(units: PitchUnits = 'cents') {
    if (units === 'cents') {
      return this.jip.map(natsToCents);
    } else if (units === 'semitones') {
      return this.jip.map(natsToSemitones);
    } else if (units === 'ratio') {
      return this.jip.map(Math.exp);
    }
    return [...this.jip];
  }

  /**
   * Calculate how many steps of the rank 1 temperament represents the given interval.
   * @param interval Array of exponents of the basis factors.
   * @returns The number of steps that represents the interval.
   */
  steps(interval: Monzo): number {
    return this.value.star(this.algebra.fromVector(interval));
  }

  /**
   * Tune a musical interval according to the temperament.
   * @param interval Array of exponents of the basis factors.
   * @param options Options determining how the temperament is interpreted as a tuning and the units of the result.
   * @returns The interval tuned according to the temperament in cents (default) or the specified units.
   */
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

  /**
   * Check if two temperaments are the same and have the same subgroup.
   * Only checks numerical equality, canonize your inputs beforehand.
   * @param other Another temperament.
   * @returns `true` if the temperament is equal to the other.
   */
  equals(other: FreeTemperament): boolean {
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

  /**
   * Obtain the mapping vector for the temperament's basis factors.
   * @param options Options determining how the temperament is interpreted as a tuning and the units of the result.
   * @returns A vector mapping basis factors to tempered versions of their logarithms in cents (default) or the specified pitch units.
   */
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

  /**
   * Calculate the true val join of two temperaments.
   * @param other Another temperament in the same basis.
   * @param persistence Search range for normalizing the result.
   * @param threshold Rounding threshold.
   * @returns A temperament supported by all the vals supporting either temperament.
   */
  valJoin(other: FreeTemperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');
    let join = new Clifford(this.value).meetJoin(
      new Clifford(other.value),
      threshold
    )[1];
    join = this.rescaleValue(join, persistence, threshold);
    return new FreeTemperament(this.algebra, join, this.jip);
  }
  /**
   * Calculate the true kernel meet of two temperaments.
   * @param other Another temperament in the same basis.
   * @param persistence Search range for normalizing the result.
   * @param threshold Rounding threshold.
   * @returns A temperament tempering out only the commas tempered out by both temperaments.
   */
  kernelMeet(other: FreeTemperament, persistence = 100, threshold = 1e-4) {
    return this.valJoin(other, persistence, threshold);
  }

  /**
   * Calculate the true val meet of two temperaments.
   * @param other Another temperament in the same basis.
   * @param persistence Search range for normalizing the result.
   * @param threshold Rounding threshold.
   * @returns A temperament supported only by the vals shared by both temperaments.
   */
  valMeet(other: FreeTemperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');
    let meet = new Clifford(this.value).meetJoin(
      new Clifford(other.value),
      threshold
    )[0];
    meet = this.rescaleValue(meet, persistence, threshold);
    return new FreeTemperament(this.algebra, meet, this.jip);
  }
  /**
   * Calculate the true kernel join of two temperaments.
   * @param other Another temperament in the same basis.
   * @param persistence Search range for normalizing the result.
   * @param threshold Rounding threshold.
   * @returns A temperament tempering out commas tempered out by either temperament.
   */
  kernelJoin(other: FreeTemperament, persistence = 100, threshold = 1e-4) {
    return this.valMeet(other, persistence, threshold);
  }

  /**
   * Construct a temperament supported by all of the given vals.
   * @param vals An array of step mappings for the basis factors or strings in [Wart Notation](https://en.xen.wiki/w/Val#Shorthand_notation).
   * In the warts the letters of the alphabet correspond to the basis, not prime numbers.
   * @param jip Natural logarithms of the basis factors.
   * @returns A `FreeTemperament` instance supported by all of the given vals.
   */
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

  /**
   * Construct a temperament tempering out all of the given commas.
   * @param commas An array of small musical intervals you want to map to unison.
   * @param jip Natural logarithms of the basis factors.
   * @returns A `FreeTemperament` instance mapping all of the given commas to unison.
   */
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

  /**
   * Recover a temperament from its rank prefix.
   * @param rank Rank of the original temperament.
   * @param wedgiePrefix Array of integers obtained from `FreeTemperament.rankPrefix()`.
   * @param jip Natural logarithms of the basis factors.
   * @returns The original temperament if reconstruction was possible.
   */
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

/**
 * Temperament of a fractional just intonation subgroup represented as an element of a Clifford algebra.
 */
export class Temperament extends BaseTemperament {
  /** Fractional just intonation subgroup defining what vectors of the algebra mean. */
  subgroup: Subgroup;

  /**
   * Construct a new temperament of a fractional just intonation subgroup.
   * @param algebra Clifford algebra of with an all-positive metric and integer components.
   * @param value Element of the Clifford algebra representing the temperament.
   * @param subgroup Fractional just intonation subgroup defining what vectors of the algebra mean.
   */
  constructor(
    algebra: typeof AlgebraElement,
    value: AlgebraElement,
    subgroup: SubgroupValue
  ) {
    super(algebra, value);
    this.subgroup = new Subgroup(subgroup);
  }

  /**
   * Just intonation point of the subgroup.
   * @param units: Units to measure the basis factors in.
   * @returns Array of logarithms of the basis factors or the factors themselves if 'ratio' was specified.
   */
  getJip(units: PitchUnits = 'cents') {
    return this.subgroup.jip(units);
  }

  /**
   * Calculate how many steps of the rank 1 temperament represents the given interval.
   * @param interval Rational number representing a musical interval.
   * @param primeMapped Set to `true` if the interval is in monzo form and given in terms of consecutive prime exponents.
   * @returns The number of steps that represents the interval.
   */
  steps(interval: MonzoValue, primeMapped = false): number {
    const monzo = this.subgroup.resolveMonzo(interval, primeMapped);
    return this.value.star(this.algebra.fromVector(monzo));
  }

  /**
   * Tune a musical interval according to the temperament.
   * @param interval Rational number representing a musical interval.
   * @param options Options determining how the temperament is interpreted as a tuning and the units of the result.
   * Set `options.primeMapping` to `true` if the interval is in monzo form and given in terms of consecutive prime exponents.
   * @returns The interval tuned according to the temperament in cents (default) or the specified units.
   */
  tune(interval: MonzoValue, options?: TuningOptions): number {
    options = Object.assign({}, options);
    const monzo = options.primeMapping
      ? resolveMonzo(interval)
      : this.subgroup.resolveMonzo(interval);
    const units = options.units;
    options.units = 'nats';
    const result = dot(this.getMapping(options), monzo);
    if (units === 'nats') {
      return result;
    }
    if (units === 'ratio') {
      return Math.exp(result);
    }
    if (units === 'semitones') {
      return natsToSemitones(result);
    }
    return natsToCents(result);
  }

  /**
   * Check if two temperaments are the same and have the same subgroup.
   * Only checks numerical equality, canonize your inputs beforehand.
   * @param other Another temperament.
   * @returns `true` if the temperament is equal to the other.
   */
  equals(other: Temperament): boolean {
    if (!this.subgroup.equals(other.subgroup)) {
      return false;
    }
    return super.equals(other);
  }

  /**
   * Obtain the mapping vector for the temperament's subgroup or for consecutive primes if `options.primeMapping` is `true`.
   * @param options Options determining how the temperament is interpreted as a tuning and the units of the result.
   * @returns A vector mapping (formal) primes to tempered versions of their logarithms in cents (default) or the specified pitch units.
   */
  getMapping(options?: TuningOptions): Mapping {
    options = options || {};
    const jip = this.subgroup.jip('nats');
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
      mapping = this.subgroup.toPrimeMapping(mapping, 'nats');
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

  /**
   * Calculate the true val join of two temperaments.
   * @param other Another temperament in the same subgroup.
   * @param persistence Search range for normalizing the result.
   * @param threshold Rounding threshold.
   * @returns A temperament supported by all the vals supporting either temperament.
   */
  valJoin(other: Temperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');
    let join = new Clifford(this.value).meetJoin(
      new Clifford(other.value),
      threshold
    )[1];
    join = this.rescaleValue(join, persistence, threshold);
    return new Temperament(this.algebra, join, this.subgroup);
  }
  /**
   * Calculate the true kernel meet of two temperaments.
   * @param other Another temperament in the same subgroup.
   * @param persistence Search range for normalizing the result.
   * @param threshold Rounding threshold.
   * @returns A temperament tempering out only the commas tempered out by both temperaments.
   */
  kernelMeet(other: Temperament, persistence = 100, threshold = 1e-4) {
    return this.valJoin(other, persistence, threshold);
  }

  /**
   * Calculate the true val meet of two temperaments.
   * @param other Another temperament in the same subgroup.
   * @param persistence Search range for normalizing the result.
   * @param threshold Rounding threshold.
   * @returns A temperament supported only by the vals shared by both temperaments.
   */
  valMeet(other: Temperament, persistence = 100, threshold = 1e-4) {
    const Clifford = getAlgebra(this.algebra.dimensions, 'float64');
    let meet = new Clifford(this.value).meetJoin(
      new Clifford(other.value),
      threshold
    )[0];
    meet = this.rescaleValue(meet, persistence, threshold);
    return new Temperament(this.algebra, meet, this.subgroup);
  }
  /**
   * Calculate the true kernel join of two temperaments.
   * @param other Another temperament in the same subgroup.
   * @param persistence Search range for normalizing the result.
   * @param threshold Rounding threshold.
   * @returns A temperament tempering out commas tempered out by either temperament.
   */
  kernelJoin(other: Temperament, persistence = 100, threshold = 1e-4) {
    return this.valMeet(other, persistence, threshold);
  }

  /**
   * Factorize the temperament into vals.
   * @param maxDivisions Maximum divisions of the equave to consider.
   * @param wartRadius Maximum deviations from closest tunings to consider.
   * @param strategy Factorization strategy.
   * @returns An array of vals that recreates the original temperament when passed to `.fromVals`.
   * @throws An error if the search space doesn't contain the factors.
   */
  valFactorize(
    minDivisions = 2,
    maxDivisions = 99,
    wartRadius = 0,
    strategy: FactorizationStrategy = 'patent'
  ) {
    return super.valFactorize(
      minDivisions,
      maxDivisions,
      wartRadius,
      strategy,
      this.subgroup
    );
  }

  /**
   * Construct a temperament supported by all of the given vals.
   * @param vals An array of step mappings for the subgroup's basis or strings in [Wart Notation](https://en.xen.wiki/w/Val#Shorthand_notation).
   * In the warts the letters of the alphabet correspond to the subgroup's basis, not prime numbers.
   * @param subgroup Fractional just intonation subgroup such as `'2.3.13/5'`.
   * @returns A `Temperament` instance supported by all of the given vals.
   */
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

  /**
   * Construct a temperament tempering out all of the given commas.
   * @param commas An array of small musical intervals you want to map to unison.
   * @param subgroup Fractional just intonation subgroup. A prime subgroup is inferred from the commas if not given explicitly.
   * @param primeMapping Should be set to `true` if the monzo is given in terms of prime exponents. Strips away excess components.
   * @returns A `Temperament` instance mapping all of the given commas to unison.
   */
  static fromCommas(
    commas: (Comma | FractionValue)[],
    subgroup?: SubgroupValue,
    primeMapping?: boolean
  ) {
    let subgroup_: Subgroup;
    if (subgroup === undefined) {
      subgroup_ = Subgroup.inferPrimeSubgroup(commas);
    } else {
      subgroup_ = new Subgroup(subgroup);
    }
    const Clifford = getAlgebra(subgroup_.basis.length);

    if (primeMapping === undefined) {
      primeMapping = subgroup === undefined;
    }

    let value = Clifford.pseudoscalar();
    commas.forEach(comma => {
      const previousValue = value;
      value = value.vee(
        Clifford.fromVector(subgroup_.resolveMonzo(comma, primeMapping)).dual()
      );
      if (value.isNil(0)) {
        value = previousValue;
      }
    });

    return new Temperament(Clifford, value, subgroup_);
  }

  /**
   * Recover a temperament from its rank prefix.
   * @param rank Rank of the original temperament.
   * @param wedgiePrefix Array of integers obtained from `Temperament.rankPrefix()`.
   * @param subgroup Subgroup of the original temperament.
   * @returns The original temperament if reconstruction was possible.
   */
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
}
