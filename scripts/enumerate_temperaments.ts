import {Temperament, patentVal} from '../src/index';

const temperaments: Temperament[] = [];

const minEdo = 5;
const maxEdo = 53;
for (let a = minEdo; a <= maxEdo; ++a) {
  const valA = patentVal(a, 2, 4);
  for (let b = a + 1; b <= maxEdo; ++b) {
    const valB = patentVal(b, 2, 4);
    const temperament = Temperament.fromValList([valA, valB]);
    if (temperament.isNil()) {
      continue;
    }
    temperament.canonize();
    let novel = true;
    for (let i = 0; i < temperaments.length; ++i) {
      if (temperaments[i].equals(temperament)) {
        novel = false;
      }
    }
    if (novel) {
      temperaments.push(temperament);
    }
  }
}

console.log(
  'There are',
  temperaments.length,
  'unique rank 2 temperaments in the subgroup 2.3.5.7 representable as a combination of two patent vals between 5 and 53 (inclusive).'
);
