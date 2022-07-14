import {dot, LOG_PRIMES, Monzo, monzosEqual, PRIMES} from 'xen-dev-utils';
import {MonzoValue, resolveMonzo} from './monzo';
import {Temperament} from './temperament';

const PSEUDO_EDO_MAPPING = [7, 11, 16, 20, 24, 26, 29, 30, 32, 34, 37];

const UNICODE_EXPONENTS = {
  '⁰': 0,
  '¹': 1,
  '²': 2,
  '³': 3,
  '⁴': 4,
  '⁵': 5,
  '⁶': 6,
  '⁷': 7,
  '⁸': 8,
  '⁹': 9,

  '¹¹': 11,
  '¹³': 13,
  '¹⁷': 17,
  '¹⁹': 19,
  '²³': 23,
};

const REVERSE_UNICODE_EXPONENTS: {[k: string]: string} = {'-': '⁻'};
Object.entries(UNICODE_EXPONENTS).forEach(e => {
  REVERSE_UNICODE_EXPONENTS[e[1].toString()] = e[0];
});

const LONG_EXPONENTS = {
  bi: '²',
  tri: '³',
  quad: '⁴',
  quin: '⁵',
  sep: '⁷',
  le: '¹¹',
  the: '¹³',
  se: '¹⁷',
  ne: '¹⁹',
  twethe: '²³',
};

const LONG_FORMS = {
  a: '',

  la: 'L',
  sa: 's',

  wa: 'w',

  yo: 'y',
  gu: 'g',

  zo: 'z',
  ru: 'r',

  lo: '1o',
  lu: '1u',
  ilo: '1o',
  ilu: '1u',

  tho: '3o',
  thu: '3u',

  so: '17o',
  su: '17u',
  iso: '17o',
  isu: '17u',

  no: '19o',
  nu: '19u',
  ino: '19o',
  inu: '19u',

  twetho: '23o',
  twethu: '23u',

  tweno: '29o',
  twenu: '29u',

  thiwo: '31o',
  thiwu: '31u',
};

const LONG_FORMS_BY_LIMIT = [
  ['ca', 'ca'], // Placeholders to make this an array
  ['wa', 'wa'], // ---
  ['yo', 'gu'],
  ['zo', 'ru'],
  ['lo', 'lu'],
  ['tho', 'thu'],
  ['so', 'su'],
  ['no', 'nu'],
  ['twetho', 'twethu'],
  ['tweno', 'twenu'],
  ['thiwo', 'thiwu'],
];

const ALL_BY_LIMIT = [
  'ca',
  'wa',
  'ya',
  'za',
  'la',
  'tha',
  'sa',
  'na',
  'twetha',
  'twena',
  'thiwa',
];

const ABBREVIATIONS = {
  y: [2, 1],
  g: [2, -1],

  z: [3, 1],
  r: [3, -1],

  '1o': [4, 1],
  '1u': [4, -1],

  '3o': [5, 1],
  '3u': [5, -1],

  '17o': [6, 1],
  '17u': [6, -1],

  '19o': [7, 1],
  '19u': [7, -1],

  '23o': [8, 1],
  '23u': [8, -1],

  '29o': [9, 1],
  '29u': [9, -1],

  '31o': [10, 1],
  '31u': [10, -1],
};

function parseExponent(token: string): [string, number] {
  let num = 1;
  if (token.startsWith('^')) {
    if (token.length < 2) {
      return [token.slice(1), num];
    }
    num = parseInt(token[1]);
    token = token.slice(2);
  } else if (token[0] in UNICODE_EXPONENTS) {
    num = 0;
    while (token[0] in UNICODE_EXPONENTS) {
      num *= 10;
      num += UNICODE_EXPONENTS[token[0] as keyof typeof UNICODE_EXPONENTS];
      token = token.slice(1);
    }
  }
  return [token, num];
}

function numberToLongExponent(n: number) {
  if (n === 1) {
    return '';
  }
  if (n === 2) {
    return 'bi';
  }
  if (n === 3) {
    return 'tri';
  }
  if (n === 4) {
    return 'quad';
  }
  if (n === 5) {
    return 'quin';
  }
  if (n === 6) {
    return 'tribi';
  }
  if (n === 7) {
    return 'sep';
  }
  if (n === 11) {
    return 'le';
  }
  if (n === 13) {
    return 'the';
  }
  if (n === 17) {
    return 'se';
  }
  if (n === 19) {
    return 'ne';
  }
  if (n === 23) {
    return 'twethe';
  }
  if (n <= 0) {
    throw new Error('Can only convert positive numbers to long exponents');
  }
  let result = '';
  while (n % 4 === 0) {
    result += 'quad';
    n /= 4;
  }
  for (let i = 11; i >= 0; --i) {
    while (n % PRIMES[i] === 0) {
      result += numberToLongExponent(PRIMES[i]);
      n /= PRIMES[i];
    }
  }
  if (n !== 1) {
    throw new Error('Unable to reduce number to long exponents');
  }
  return result;
}

const VERBOSE_DEGREES: {[key: string]: number} = {
  unison: 1,
  first: 1,
  '1st': 1,

  second: 2,
  '2nd': 2,

  third: 3,
  '3rd': 3,

  fourth: 4,
  '4th': 4,

  fifth: 5,
  '5th': 5,

  sixth: 6,
  '6th': 6,

  seventh: 7,
  '7th': 7,

  octave: 8,
  eight: 8,
  '8th': 8,

  ninth: 9,
  '9th': 9,

  tenth: 10,
  '10th': 10,

  eleventh: 11,
  '11th': 11,

  twelfth: 12,
  '12th': 12,

  thirteenth: 13,
  '13th': 13,

  fourteenth: 14,
  '14th': 14,

  fifteenth: 15,
  '15th': 15,

  sixteenth: 16,
  '16th': 16,

  seventeenth: 17,
  '17th': 17,

  eighteenth: 18,
  '18th': 18,

  nineteenth: 19,
  '19th': 19,
};

/**
 * Interval of [Color Notation](https://en.xen.wiki/w/Color_notation).
 */
export class ColorInterval {
  /** Zero indexed size class of the interval. A musical 6th has a stepspan of 5. */
  stepspan: number;
  /** Complexity class of the interval. 0 = central, 1 = large, -1 = small etc. */
  magnitude: number;
  /** The colors of the interval as a monzo with zero twos and threes components. */
  offWhite: Monzo;
  /** Stepspan adjustment. Adds pythagorean commas. */
  poQu: number;

  /**
   * Construct an interval of Color Notation.
   * @param stepspan Zero indexed size class of the interval. A musical 6th has a stepspan of 5.
   * @param magnitude Complexity class of the interval. 0 = central, 1 = large, -1 = small etc.
   * @param offWhite The colors of the interval as a monzo with zero twos and threes components.
   * @param poQu Stepspan adjustment. Adds pythagorean commas.
   */
  constructor(stepspan: number, magnitude: number, offWhite: Monzo, poQu = 0) {
    this.stepspan = stepspan;
    this.magnitude = magnitude;
    this.offWhite = offWhite;
    this.poQu = poQu;
  }

  /**
   * Check if a string can be parsed into a `ColorInterval` instance.
   * @param token String to check if it can be parsed.
   * @returns `true` if the string is valid input to `ColorInterval.fromString`.
   */
  static canParse(token: string) {
    return /[Ls]*(([ygzr]|\d+[ou]+)((\^\d)|[⁰¹²³⁴⁵⁶⁷⁸⁹]+)*)+[pq]*-*\d+/.test(
      token
    );
  }

  /**
   * Parse a string in abbreviated Color Notation into a `ColorInterval` instance.
   * @param token String to parse such as 'zg5'.
   * @returns Instance of `ColorInterval`.
   */
  static fromString(token: string) {
    const offWhite = PSEUDO_EDO_MAPPING.map(() => 0);
    let magnitude = 0;
    let exponent: number;
    while (token.startsWith('L')) {
      token = token.slice(1);
      [token, exponent] = parseExponent(token);
      magnitude += exponent;
    }
    while (token.startsWith('s')) {
      token = token.slice(1);
      [token, exponent] = parseExponent(token);
      magnitude -= exponent;
    }
    let lastIndex = Infinity;
    let done = false;
    do {
      done = true;
      for (const prefix in ABBREVIATIONS) {
        if (token.startsWith(prefix)) {
          token = token.slice(prefix.length);
          const [index, amount] =
            ABBREVIATIONS[prefix as keyof typeof ABBREVIATIONS];
          if (index > lastIndex) {
            throw new Error(
              'Colors must be specified with the higher primes first'
            );
          }
          lastIndex = index;
          let total = amount;
          if (prefix.endsWith('o') || prefix.endsWith('u')) {
            while (prefix.endsWith(token[0])) {
              token = token.slice(1);
              total += amount;
            }
          }
          [token, exponent] = parseExponent(token);
          offWhite[index] += total * exponent;
          done = false;
        }
      }
    } while (!done);

    if (token.startsWith('w')) {
      token = token.slice(1);
    }
    let poQu = 0;
    while (token.startsWith('p')) {
      poQu += 1;
      token = token.slice(1);
    }
    while (token.startsWith('q')) {
      poQu -= 1;
      token = token.slice(1);
    }

    let stepspan = parseInt(token);
    stepspan -= Math.sign(stepspan);
    return new ColorInterval(stepspan, magnitude, offWhite, poQu);
  }

  /**
   * Parse a string in verbose Color Notation into a `ColorInterval` instance.
   * @param token String to parse such as 'Zogu Fifth'.
   * @param degree Optional numeric degree.
   * @returns Instance of `ColorInterval`.
   */
  static fromVerboseString(token: string, degree?: number) {
    if (degree === undefined) {
      const [token_, degreeToken] = token.split(' ');
      degree = VERBOSE_DEGREES[degreeToken.toLocaleLowerCase()];
      token = token_;
    }
    const [abbreviation, ordinal] = verboseToAbbreviation(token);
    if (ordinal !== 1) {
      throw new Error('Ordinals are not supported with intervals');
    }
    return ColorInterval.fromString(abbreviation + degree.toString());
  }

  /**
   * Convert a monzo or fraction to an interval of Color Notation.
   * @param monzo Monzo or fraction to convert.
   * @returns Color interval corresponding to the fraction.
   */
  static fromMonzo(monzo: MonzoValue) {
    monzo = resolveMonzo(monzo);
    if (monzo.length > PSEUDO_EDO_MAPPING.length) {
      throw new Error('Too many components to represent in color notation');
    }
    const offWhite = [0, 0, ...monzo.slice(2)];
    while (offWhite.length < PSEUDO_EDO_MAPPING.length) {
      offWhite.push(0);
    }
    const magnitude = Math.round(monzo.slice(1).reduce((a, b) => a + b) / 7);
    const stepspan = dot(monzo, PSEUDO_EDO_MAPPING);
    return new ColorInterval(stepspan, magnitude, offWhite);
  }

  /**
   * Get the (one-indexed) degree of the color interval.
   */
  get degree() {
    if (this.stepspan < 0) {
      return this.stepspan - 1;
    }
    return this.stepspan + 1;
  }

  /**
   * Convert the interval into a monzo with integer components.
   * @returns Array of exponents of consecutive prime numbers up to 31.
   */
  toMonzo(): Monzo {
    const stepspan = this.stepspan - this.poQu;
    const spanPrime = dot(this.offWhite, PSEUDO_EDO_MAPPING);
    const magnitudePrime = Math.round(
      (2 * (stepspan - spanPrime) + this.offWhite.reduce((a, b) => a + b)) / 7
    );
    const a =
      -3 * (stepspan - spanPrime) - 11 * (this.magnitude - magnitudePrime);
    const b =
      2 * (stepspan - spanPrime) + 7 * (this.magnitude - magnitudePrime);

    const result = [...this.offWhite];
    result[0] = a;
    result[1] = b;
    return result;
  }
}

function verboseToAbbreviation(token: string): [string, number] {
  token = token.toLowerCase().replace('-', '');
  let shortToken = '';
  let exponent: null | string = null;
  let modified = true;
  let fresh = false;
  while (modified) {
    fresh = false;
    modified = false;
    exponent = null;
    const exponents: string[] = [];
    let done = false;
    while (!done) {
      done = true;
      for (const name in LONG_EXPONENTS) {
        if (token.startsWith(name)) {
          exponents.push(LONG_EXPONENTS[name as keyof typeof LONG_EXPONENTS]);
          token = token.slice(name.length);
          done = false;
          break;
        }
      }
    }
    if (exponents.length) {
      fresh = true;
      let m = 1;
      exponents.forEach(exponent_ => {
        m *= UNICODE_EXPONENTS[exponent_ as keyof typeof UNICODE_EXPONENTS];
      });
      exponent = m
        .toString()
        .split('')
        .map(c => REVERSE_UNICODE_EXPONENTS[c])
        .join('');
    }
    done = false;
    while (!done) {
      done = true;
      for (const longForm in LONG_FORMS) {
        if (token.startsWith(longForm)) {
          shortToken += LONG_FORMS[longForm as keyof typeof LONG_FORMS];
          token = token.slice(longForm.length);
          modified = true;
          if (longForm === 'a') {
            done = true;
            break;
          }
          if (exponent !== null) {
            shortToken += exponent;
            done = false;
          }
          if (longForm === 'sa' || longForm === 'la') {
            done = true;
          }
          break;
        }
      }
    }
  }
  let ordinal = 1;
  if (fresh && exponent !== null) {
    ordinal = UNICODE_EXPONENTS[exponent as keyof typeof UNICODE_EXPONENTS];
  }

  return [shortToken + token, ordinal];
}

export function colorComma(token: string) {
  const [abbreviation, ordinal] = verboseToAbbreviation(token);
  const segment: [number, Monzo][] = [];
  let degree = -2;
  while (true) {
    const monzo = ColorInterval.fromString(
      abbreviation + degree.toString()
    ).toMonzo();
    const nats = dot(LOG_PRIMES, monzo);
    if (nats < 0) {
      break;
    }
    segment.push([nats, monzo]);
    degree--;
  }
  degree = 1;
  while (segment.length < 7) {
    const monzo = ColorInterval.fromString(
      abbreviation + degree.toString()
    ).toMonzo();
    const nats = dot(LOG_PRIMES, monzo);
    if (nats > 0) {
      segment.push([nats, monzo]);
    }
    degree++;
  }

  segment.sort((a, b) => a[0] - b[0]);
  return segment[ordinal - 1][1];
}

export function monzoToColorComma(monzo: Monzo): string {
  if (monzo.length > PSEUDO_EDO_MAPPING.length) {
    throw new Error('Too many components to represent in color notation');
  }
  const offWhite = [0, 0, ...monzo.slice(2)];
  while (offWhite.length < PSEUDO_EDO_MAPPING.length) {
    offWhite.push(0);
  }
  const magnitude = Math.round(monzo.slice(1).reduce((a, b) => a + b) / 7);
  const segment: [number, Monzo][] = [];
  let stepspan = -1;
  while (true) {
    const segmentMonzo = new ColorInterval(
      stepspan,
      magnitude,
      offWhite
    ).toMonzo();
    const nats = dot(LOG_PRIMES, segmentMonzo);
    if (nats < 0) {
      break;
    }
    segment.push([nats, segmentMonzo]);
    stepspan--;
  }
  stepspan = 0;
  while (segment.length < 7) {
    const segmentMonzo = new ColorInterval(
      stepspan,
      magnitude,
      offWhite
    ).toMonzo();
    const nats = dot(LOG_PRIMES, segmentMonzo);
    if (nats > 0) {
      segment.push([nats, segmentMonzo]);
    }
    stepspan++;
  }

  segment.sort((a, b) => a[0] - b[0]);
  let ordinal = -1;
  for (let i = 0; i < 7; ++i) {
    const segmentMonzo = segment[i][1];
    if (monzosEqual(monzo, segmentMonzo)) {
      ordinal = i + 1;
      break;
    }
  }

  if (ordinal < 0) {
    throw new Error('Unable to locate segment');
  }

  let token = '';
  let numSyllables = 0;
  let lastExponent = -1;
  let biBackup = '';
  for (let i = offWhite.length - 1; i > 1; --i) {
    const exponent = Math.abs(offWhite[i]);
    if (!exponent) {
      continue;
    }
    if (
      ((token === biBackup && lastExponent > 1) || lastExponent > 2) &&
      lastExponent !== exponent
    ) {
      token += '-a';
    }
    const color = LONG_FORMS_BY_LIMIT[i][offWhite[i] > 0 ? 0 : 1];
    if (exponent === 2) {
      if (lastExponent === 2) {
        token = biBackup;
      } else {
        biBackup = token + 'bi';
        token += color;
        numSyllables++;
      }
    } else if (exponent > 2) {
      if (lastExponent !== exponent) {
        token += numberToLongExponent(exponent);
        numSyllables++; // XXX: Not exact
      }
    }
    token += color;
    biBackup += color;
    numSyllables++;
    lastExponent = exponent;
  }
  if (!token.length) {
    token = 'wa';
    numSyllables = 1;
  }
  if (Math.abs(magnitude) > 1 && numSyllables > 1) {
    token = '-' + token;
  }
  if (magnitude === 1) {
    token = 'la' + token;
  }
  if (magnitude === 2) {
    token = 'lala' + token;
  }
  if (magnitude > 2) {
    token = numberToLongExponent(magnitude) + 'la' + token;
  }
  if (magnitude === -1) {
    token = 'sa' + token;
  }
  if (magnitude === -2) {
    token = 'sasa' + token;
  }
  if (magnitude < -2) {
    token = numberToLongExponent(-magnitude) + 'sa' + token;
  }

  if (['lo', 'lu', 'so', 'su', 'no', 'nu'].includes(token)) {
    token = 'i' + token;
  }

  return (
    token.charAt(0).toUpperCase() +
    token.slice(1) +
    numberToLongExponent(ordinal)
  );
}

// Get color name for a temperament of only one vanishing comma
export function getSingleCommaColorName(temperament: Temperament) {
  const commish = temperament.value.dual().vector();
  const monzo: Monzo = Array(PSEUDO_EDO_MAPPING.length).fill(0);
  const primeIndices: number[] = [];
  temperament.subgroup.basis.forEach((maybePrime, i) => {
    if (maybePrime.d !== 1) {
      throw new Error('Non-prime subgroup');
    }
    const index = PRIMES.indexOf(maybePrime.n);
    primeIndices.push(index);
    if (index >= monzo.length) {
      throw new Error('Subgroup too complex');
    }
    monzo[index] = commish[i];
  });
  const nats = dot(LOG_PRIMES, monzo);
  if (nats < 0) {
    for (let i = 0; i < monzo.length; ++i) {
      monzo[i] = -monzo[i];
    }
  }
  let name = monzoToColorComma(monzo);

  if (!primeIndices.includes(1)) {
    if (!primeIndices.includes(0)) {
      name += ' Nowaca';
    } else {
      name += ' Nowa';
    }
  } else if (!primeIndices.includes(0)) {
    name += ' Noca';
  }

  for (let i = primeIndices.length - 1; i >= 0; --i) {
    const limit = primeIndices[i];
    if (limit > 1 && monzo[limit] === 0) {
      name += ' + ' + ALL_BY_LIMIT[limit];
    }
  }

  return name;
}

export function parseColorTemperament(name: string) {
  const commas = name.split('&').map(c => c.trim());
  if (!commas.length) {
    throw new Error('Failed to extract color commas');
  }
  const [commaNowaca_, ...limits] = commas
    .pop()!
    .split('+')
    .map(c => c.trim());
  const commaNowaca = commaNowaca_.split(' ');
  const comma = commaNowaca.shift();
  if (comma === undefined) {
    throw new Error('Failed to extract color comma');
  }
  const primeIndices = new Set<number>([0, 1]);
  if (commaNowaca.length) {
    const nowaca = commaNowaca.shift()!.toLowerCase();
    if (!nowaca.startsWith('no')) {
      throw new Error("Second word must start with 'no'");
    }
    if (nowaca.includes('ca')) {
      primeIndices.delete(0);
    }
    if (nowaca.includes('wa')) {
      primeIndices.delete(1);
    }
  }
  limits.forEach(limit => {
    primeIndices.add(ALL_BY_LIMIT.indexOf(limit.toLowerCase().trim()));
  });

  const lastMonzo = colorComma(comma);
  const commaMonzos = commas.map(c => colorComma(c));
  commaMonzos.push(lastMonzo);

  commaMonzos.forEach(commaMonzo => {
    commaMonzo.forEach((component, index) => {
      if (component) {
        primeIndices.add(index);
      }
    });
  });
  const primes = [...primeIndices].map(i => PRIMES[i]);
  primes.sort((a, b) => a - b);
  return Temperament.fromCommas(commaMonzos, primes);
}
