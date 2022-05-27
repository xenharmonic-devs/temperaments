import {Subgroup} from '../src/subgroup';
import {Temperament} from '../src/temperament';
import {getSingleCommaColorName} from '../src/color';

const rawRank2Data = require('../resources/x31eqRank2.json');

Object.entries(rawRank2Data).forEach(e => {
  const [subgroupString, data] = e;
  const subgroup = new Subgroup(subgroupString);
  if (subgroup.basis.length !== 3) {
    return;
  }
  Object.entries(data as Object).forEach(entry => {
    const [prefixString, name] = entry;
    const prefix = prefixString.split(',').map(n => parseInt(n));
    const temperament = Temperament.fromPrefix(2, prefix, subgroup);

    try {
      const colorName = getSingleCommaColorName(temperament);
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
