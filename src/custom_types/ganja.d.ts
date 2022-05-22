declare module 'ganja.js';

export interface Description {
  basis: string[];
  metric: number[];
  mulTable: string[][];
  matrix: string[][];
}

export class Element extends Float32Array {
  constructor(value: number[]);

  Add(other: Element): Element;
  Sub(other: Element): Element;
  Dot(other: Element): Element;
  Wedge(other: Element): Element;
  Vee(other: Element): Element;
  Mul(other: Element): Element;
  Div(other: Element): Element;

  get s(): number;

  static describe(): Description;

  static Add(a: Element, b: Element): Element;
  static Sub(a: Element, b: Element): Element;
  static Dot(a: Element, b: Element): Element;
  static Wedge(a: Element, b: Element): Element;
  static Vee(a: Element, b: Element): Element;
  static Mul(a: Element, b: Element): Element;
  static Div(a: Element, b: Element): Element;
}
