import Algebra, {AlgebraElement, ElementBaseType} from 'ts-geometric-algebra';

/** Type of an an algebra.
 * `'int32'` means all-positive metric with integer components.
 * `'float64'` means all-positive metric with real components.
 * `'PGA'` means positive metric with an extra zero basis blade.
 * */
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

/**
 * Get an algebra from the cache.
 * @param dimensions Number of components of vectors in the base space.
 * @param algebraType Type of the algebra.
 * @returns Clifford or Plane-based Geometric Algebra.
 */
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

/** Clear cached algebras. */
export function clearCache() {
  Object.values(ALGEBRA_CACHES).forEach(cache => cache.clear());
}
