import {dot, LOG_PRIMES} from '../src';
import {parseSubgroup, Temperament} from '../src/temperament';
import {monzoToColorComma} from '../src/color';

const rawRank2Data = require('../resources/x31eqRank2.json');

Object.entries(rawRank2Data).forEach(e => {
  const [subgroupString, data] = e;
  const subgroup = parseSubgroup(subgroupString);
  if (subgroup === undefined || subgroup.length !== 3) {
    return;
  }
  Object.entries(data as Object).forEach(entry => {
    const [prefixString, name] = entry;
    const prefix = prefixString.split(',').map(n => parseInt(n));
    const temperament = Temperament.recoverRank2(prefix, subgroup);
    const commaMonzo = Array(11).fill(0);
    subgroup.forEach(
      (index, i) => (commaMonzo[index] = temperament.value.Dual[i + 1])
    );
    const nats = dot(LOG_PRIMES, commaMonzo);
    if (nats < 0) {
      for (let i = 0; i < commaMonzo.length; ++i) {
        commaMonzo[i] = -commaMonzo[i];
      }
    }
    try {
      const colorName = monzoToColorComma(commaMonzo);
      if (colorName.toLowerCase() === name.toLowerCase()) {
        console.log(name);
      }
      // console.log(name, colorName);
    } catch {
      // console.log("FAIL", name);
      return;
    }
  });
});
