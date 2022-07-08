import Algebra, {
  AlgebraElement,
  ElementBaseType,
  linSolve,
} from 'ts-geometric-algebra';

export type AlgebraType = 'int32' | 'float64' | 'PGA';

const ALGEBRA_CACHES: {
  [key in AlgebraType]: Map<number, typeof AlgebraElement>;
} = {
  int32: new Map(),
  float64: new Map(),
  PGA: new Map(),
};

const ALGEBRA_BASE_TYPES: {[key in AlgebraType]: typeof ElementBaseType} = {
  int32: Int32Array,
  float64: Float64Array,
  PGA: Float64Array,
};

export function getAlgebra(
  dimensions: number,
  algebraType: AlgebraType = 'int32'
) {
  const cache = ALGEBRA_CACHES[algebraType];
  if (cache.has(dimensions)) {
    return cache.get(dimensions)!;
  }
  const baseType = ALGEBRA_BASE_TYPES[algebraType];
  let algebra: typeof AlgebraElement;
  if (algebraType === 'PGA') {
    algebra = Algebra(dimensions, 0, 1, {baseType});
  } else {
    algebra = Algebra(dimensions, 0, 0, {baseType});
  }
  cache.set(dimensions, algebra);
  return algebra;
}

export function clearCache() {
  Object.values(ALGEBRA_CACHES).forEach(cache => cache.clear());
}

export function cachedLinSolve(
  x: number[],
  basis: number[][],
  threshold = 1e-5
) {
  const algebra = getAlgebra(x.length, 'float64');
  return linSolve(
    algebra.fromVector(x),
    basis.map(b => algebra!.fromVector(b)),
    threshold
  );
}
