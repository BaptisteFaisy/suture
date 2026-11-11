import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formulaArb, originArb } from "../test/generators";
import { a1ToR1c1 } from "./a1-r1c1";
import { r1c1ToA1 } from "./r1c1-a1";

/** An external workbook reference is a bracketed file name, quoted or not. */
const EXTERNAL = /'?\[[^\]]*\.[A-Za-z0-9]{1,6}\]'?/;

describe("SUT-P-03 — conversion round trips", () => {
  it("A1 -> R1C1 -> A1 gives back the original formula", () => {
    fc.assert(
      fc.property(formulaArb, originArb, (formula, origin) => {
        const converted = a1ToR1c1(formula, origin);
        expect(r1c1ToA1(converted.formula, origin).formula).toBe(formula);
      }),
      { numRuns: 300 },
    );
  });

  it("R1C1 -> A1 -> R1C1 is stable", () => {
    fc.assert(
      fc.property(formulaArb, originArb, (formula, origin) => {
        const r1c1 = a1ToR1c1(formula, origin).formula;
        const back = r1c1ToA1(r1c1, origin).formula;
        expect(a1ToR1c1(back, origin).formula).toBe(r1c1);
      }),
      { numRuns: 300 },
    );
  });

  it("reports an external workbook exactly when there is one", () => {
    fc.assert(
      fc.property(formulaArb, originArb, (formula, origin) => {
        const reports = a1ToR1c1(formula, origin).issues.some(
          (issue) => issue.code === "external-reference",
        );
        expect(reports).toBe(EXTERNAL.test(formula));
      }),
      { numRuns: 300 },
    );
  });
});
