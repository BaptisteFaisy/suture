import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formulaArb } from "../test/generators";
import { protect } from "./protect";
import { numberToColumn } from "./refs";
import { findRefs, type RefMatch } from "./scan";
import { shiftA1 } from "./shift";

function refText(match: RefMatch): string {
  const col = `${match.colAbsolute ? "$" : ""}${numberToColumn(match.col)}`;
  return `${col}${match.rowAbsolute ? "$" : ""}${match.row}`;
}

function absoluteRefs(formula: string): string[] {
  return findRefs(protect(formula).text)
    .filter((match) => match.rowAbsolute && match.colAbsolute)
    .map(refText);
}

describe("shifting properties", () => {
  it("shifting by zero leaves every formula untouched", () => {
    fc.assert(
      fc.property(formulaArb, (formula) => {
        expect(shiftA1(formula, 0, 0).formula).toBe(formula);
      }),
      { numRuns: 300 },
    );
  });

  it("shifting never moves a fully absolute reference", () => {
    fc.assert(
      fc.property(
        formulaArb,
        fc.integer({ min: -5, max: 5 }),
        fc.integer({ min: -5, max: 5 }),
        (formula, dRow, dCol) => {
          const shifted = shiftA1(formula, dRow, dCol).formula;
          for (const absolute of absoluteRefs(formula)) {
            expect(shifted).toContain(absolute);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("shifting twice by the same delta equals shifting by double", () => {
    fc.assert(
      fc.property(formulaArb, fc.integer({ min: 0, max: 5 }), (formula, delta) => {
        const twice = shiftA1(shiftA1(formula, delta, 0).formula, delta, 0).formula;
        expect(shiftA1(formula, delta * 2, 0).formula).toBe(twice);
      }),
      { numRuns: 300 },
    );
  });
});
