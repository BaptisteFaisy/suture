/**
 * The internal A1 ↔ L1C1 converter used while `@suture/formula` is silent.
 */
import { describe, expect, it } from "vitest";
import { a1ToR1c1, shiftA1 } from "./fallback-formula";
import { columnIndexOf, columnLetters, formatCellRef, parseCellRef } from "./refs";

describe("A1 address helpers", () => {
  it("parses and formats addresses", () => {
    expect(parseCellRef("B14")).toEqual({ row: 14, col: 2 });
    expect(parseCellRef("$AA$3")).toEqual({ row: 3, col: 27 });
    expect(parseCellRef("nope")).toBeUndefined();
    expect(formatCellRef({ row: 14, col: 2 })).toBe("B14");
    expect(columnLetters(27)).toBe("AA");
    expect(columnIndexOf("AA")).toBe(27);
  });
});

describe("a1ToR1c1", () => {
  it("matches the example of the canonical format", () => {
    expect(a1ToR1c1("=SUM(B2:B13)", { row: 14, col: 2 })).toBe("=SUM(R[-12]C:R[-1]C)");
  });

  it("keeps absolute anchors absolute", () => {
    expect(a1ToR1c1("=$B$2+B$2+$B2", { row: 5, col: 4 })).toBe("=R2C2+R2C[-2]+R[-3]C2");
  });

  it("leaves identifiers, strings and sheet names untouched", () => {
    expect(a1ToR1c1('=LOG10(A1)&"B2:C3"&Sheet1!D4', { row: 1, col: 1 })).toBe(
      '=LOG10(RC)&"B2:C3"&Sheet1!R[3]C[3]',
    );
  });
});

describe("shiftA1", () => {
  it("moves relative references and freezes absolute ones", () => {
    expect(shiftA1("=A1+$A$1+A$1+$A1", 3, 2)).toBe("=C4+$A$1+C$1+$A4");
  });

  it("flags an out-of-bounds shift instead of inventing an address", () => {
    expect(shiftA1("=A1", -1, 0)).toBe("=#REF!");
  });
});
