# temperaments
Musical tunings/temperaments for Javascript

## Installation ##
```bash
npm i temperaments
```

## Documentation
Below are some examples. The main API documentation is hosted on the project [Github pages](https://xenharmonic-devs.github.io/temperaments).

To generate documentation locally run:
```bash
npm run doc
```

## Equal temperaments
```typescript
import Temperament from 'temperaments';

// Twelve-tone equal temperament for 5-limit = 2.3.5
const edo12 = Temperament.fromVals([12], '2.3.5');

// How many steps represents a major seventh
edo12.steps('15/8'); // 11

// How many cents is a major seventh in 12edo
edo12.tune('15/8'); // 1100.0
```

## Rank-2 temperaments
```typescript
import Temperament from 'temperaments';

// Meantone as the val-join of 12edo and 19edo
const meantone = Temperament.fromVals([12, 19], '2.3.5');

// How many cents is the fifth in POTE meantone
meantone.tune('3/2'); // 696.239

// How about with tempered octaves
meantone.tune('3/2', {temperEquaves: true}); // 697.049

// How big is that octave
meantone.tune('2/1', {temperEquaves: true}); // 1201.397
```

## POTE Mapping vector
```typescript
import {toMonzo, dot} from 'xen-dev-utils';
import {Temperament} from 'temperaments';

// Porcupine temperament from the porcupine comma
// The subgroup 2.3.5 is automatically inferred
const porcupine = Temperament.fromCommas(['250/243']);

const POTE = porcupine.getMapping();

const minorThird = toMonzo('6/5');
const perfectFourth = toMonzo('4/3');

const m3Cents = dot(minorThird, POTE); // 327.901
const P4Cents = dot(perfectFourth, POTE); // 491.851

// These are the same because we're in porcupine
2 * P4Cents; // 983.702
3 * m3Cents; // 983.702
```

## Fractional just intonation subgroups
```typescript
import {Temperament} from 'temperaments';

const pinkan = Temperament.fromCommas(
  ['676/675', '1216/1215'],
  '2.3.13/5.19/5'
);

// CTE optimized
pinkan.tune('15/13', {constraints: ['2/1']}); // 248.846
```

## Named temperaments
```typescript
const passion = Temperament.fromName('passion');
```

## Color temperaments
```typescript
import {colorTemperament} from 'temperaments';
const mavila = colorTemperament('Layobi');

const superkleismic = colorTemperament('Tritriyo & Zotriyo');
```

### Color commas
```typescript
import {colorComma} from 'temperaments';

const comma = colorComma('Loru');
```

## Large subgroups
`Temperament` instances get computationally expensive beyond subgroups larger than ~8. If you just need the TE mapping you can get it through optimized numeric methods.
```typescript
import {tenneyVals, Subgroup, vanishCommas} from 'temperaments';

const magicMapping = tenneyVals([19, 22], new Subgroup(5));

// Not an exact TE mapping, but pretty close.
const miracleMapping = vanishCommas(["225/224", "1029/1024"]);
```

## Gotchas

Subgroup needs to be explicit if the commas do not involve all of the primes in the limit.
```typescript
// Specifying 5-limit is required if you do not want 2.5
const augmented = Temperament.fromCommas(['128/125'], 5);
```
If you want a mapping vector that covers a full prime limit, must pass `{primeMapping: true}` to `Temperament.getMapping` for subgroups that aren't full prime limits.
```typescript
const slendric = Temperament.fromCommas(['1029/1024']);
const POTE = slendric.getMapping({primeMapping: true});
```

## Additional resources

To work with named temperaments like Meantone or Marvel see [named-temperaments](https://github.com/frostburn/named-temperaments).
