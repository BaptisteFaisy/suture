import fc from "fast-check";
import { numberToColumn } from "../src/refs";

/** A cell reference with its absolute markers. */
export interface RefSpec {
  row: number;
  col: number;
  rowAbsolute: boolean;
  colAbsolute: boolean;
}

export const refSpecArb: fc.Arbitrary<RefSpec> = fc.record({
  row: fc.integer({ min: 1, max: 200 }),
  col: fc.integer({ min: 1, max: 40 }),
  rowAbsolute: fc.boolean(),
  colAbsolute: fc.boolean(),
});

/** Renders a reference specification as A1 text. */
export function refText(spec: RefSpec): string {
  const col = `${spec.colAbsolute ? "$" : ""}${numberToColumn(spec.col)}`;
  return `${col}${spec.rowAbsolute ? "$" : ""}${spec.row}`;
}

export const originArb: fc.Arbitrary<{ row: number; col: number }> = fc.record({
  row: fc.integer({ min: 1, max: 200 }),
  col: fc.integer({ min: 1, max: 40 }),
});

/** Atoms that must survive a conversion untouched. */
const opaqueAtoms = fc.constantFrom(
  '"Rent"',
  '"Total loyer"',
  "Tax_Rate",
  "Total",
  "Budget_Total",
  "Table1[Amount]",
  "Data[Price]",
  "'[Book1.xlsx]Sheet1'!A1",
  "[Other.xlsx]Data!B2",
  "Sheet2!C3",
);

const atomArb = fc.oneof(
  refSpecArb.map(refText),
  fc.integer({ min: 0, max: 99999 }).map(String),
  opaqueAtoms,
);

/** A synthetic but syntactically valid formula, prefixed with "=". */
export const formulaArb: fc.Arbitrary<string> = fc
  .oneof(
    atomArb,
    fc
      .tuple(
        fc.constantFrom("SUM", "AVERAGE", "COUNT", "MIN", "MAX"),
        fc.array(atomArb, { minLength: 1, maxLength: 3 }),
      )
      .map(([name, args]) => `${name}(${args.join(",")})`),
    fc
      .tuple(atomArb, fc.constantFrom("+", "-", "*", "/", "&"), atomArb)
      .map(([left, op, right]) => `${left}${op}${right}`),
    fc
      .tuple(refSpecArb, refSpecArb)
      .map(([from, to]) => `SUM(${refText(from)}:${refText(to)})`),
  )
  .map((body) => `=${body}`);
