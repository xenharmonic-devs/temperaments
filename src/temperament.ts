import type {Monzo} from './monzo';
import Algebra from 'ganja.js';
import {LOG_PRIMES} from './constants';

// No interpretation in Geometric Algebra
export type Mapping = number[];

// Promoted to vectors in Geometric Algebra
export type Val = number[];

// Promoted to pseudovectors in GA
export type Comma = number[];

// The weighting vector
// I think ganja.js ignores metric magnitude so we pre- and post-process
export type Metric = number[];

export type Subgroup = number[];

export function inverseLogMetric(subgroup: Subgroup) {
  return subgroup.map(index => 1 / LOG_PRIMES[index]);
}

export function natsToCents(nats: number) {
  return (nats / Math.LN2) * 1200;
}

export function centsToNats(cents: number) {
  return (cents / 1200) * Math.LN2;
}

export function inferSubgroup(monzos: Monzo[]): Subgroup {
  const result: Subgroup = [];
  if (!monzos.length) {
    return result;
  }
  for (let i = 0; i < monzos[0].length; ++i) {
    let hasComponent = false;
    monzos.forEach(monzo => {
      if (monzo[i] !== 0) {
        hasComponent = true;
      }
    });
    if (hasComponent) {
      result.push(i);
    }
  }
  return result;
}

// Musical temperament represented in Geometric Algebra
export class Temperament {
  algebra: any; // Clifford Algebra
  value: any; // Multivector of the Clifford Algebra
  metric: Metric;
  subgroup: Subgroup;

  constructor(algebra: any, value: any, metric: Metric, subgroup: Subgroup) {
    this.algebra = algebra;
    this.value = value;
    this.metric = metric;
    this.subgroup = subgroup;
  }

  toTenneyEuclid(): Mapping {
    const jip = this.subgroup.map(
      (index, i) => LOG_PRIMES[index] * this.metric[i]
    );
    const vector = Array(1 << this.metric.length).fill(0);
    vector.splice(1, jip.length, ...jip);
    const promotedJip = new this.algebra(vector);
    const projected = promotedJip.Dot(this.value).Div(this.value);

    const result = LOG_PRIMES.slice(
      0,
      1 + this.subgroup.reduce((a, b) => Math.max(a, b))
    );
    this.subgroup.forEach((index, i) => {
      result[index] = projected[1 + i] / this.metric[i];
    });
    return result;
  }

  toPOTE(): Mapping {
    const result = this.toTenneyEuclid();
    const indexOfEquivalence = this.subgroup.reduce((a, b) => Math.min(a, b));
    const purifier =
      LOG_PRIMES[indexOfEquivalence] / result[indexOfEquivalence];
    return result.map(component => component * purifier);
  }

  static fromValList(vals: Val[], subgroup: Subgroup, metric_?: Metric) {
    const metric = metric_ === undefined ? inverseLogMetric(subgroup) : metric_;

    const Clifford = Algebra(metric.length);
    const algebraSize = 1 << metric.length;

    if (!vals.length) {
      const scalar = Array(algebraSize).fill(0);
      scalar[0] = 1;
      return new Temperament(Clifford, new Clifford(scalar), metric, subgroup);
    }
    const promotedVals = vals.map(val => {
      const vector = Array(algebraSize).fill(0);
      vector.splice(
        1,
        subgroup.length,
        ...subgroup.map((index, i) => val[index] * metric[i])
      );
      return new Clifford(vector);
    });
    return new Temperament(
      Clifford,
      promotedVals.reduce((a, b) => Clifford.Wedge(a, b)),
      metric,
      subgroup
    );
  }

  static fromCommaList(
    commas: Comma[],
    subgroup_?: Subgroup,
    metric_?: Metric
  ) {
    const subgroup =
      subgroup_ === undefined ? inferSubgroup(commas) : subgroup_;
    const metric = metric_ === undefined ? inverseLogMetric(subgroup) : metric_;

    const Clifford = Algebra(metric.length);
    const algebraSize = 1 << metric.length;

    const pseudoScalar_ = Array(algebraSize).fill(0);
    pseudoScalar_[algebraSize - 1] = 1;
    const pseudoScalar = new Clifford(pseudoScalar_);
    if (!commas.length) {
      return new Temperament(Clifford, pseudoScalar, metric, subgroup);
    }

    const promotedCommas = commas.map(comma => {
      const vector = Array(algebraSize).fill(0);
      vector.splice(
        1,
        subgroup.length,
        ...subgroup.map((index, i) => comma[index] / metric[i])
      );
      return new Clifford(vector).Mul(pseudoScalar);
    });
    return new Temperament(
      Clifford,
      promotedCommas.reduce((a, b) => Clifford.Vee(a, b)),
      metric,
      subgroup
    );
  }
}
