import { describe, expect, it } from "vitest";
import { columnToNumber, formatRef, numberToColumn, parseRef } from "./refs";

describe("cell references", () => {
  it("parses plain and absolute references", () => {
    expect(parseRef("B14")).toEqual({ row: 14, col: 2 });
    expect(parseRef("$B$14")).toEqual({ row: 14, col: 2 });
    expect(parseRef("AA3")).toEqual({ row: 3, col: 27 });
    expect(parseRef("A1")).toEqual({ row: 1, col: 1 });
  });

  it("formats a position back to A1", () => {
    expect(formatRef({ row: 14, col: 2 })).toBe("B14");
    expect(formatRef({ row: 3, col: 27 })).toBe("AA3");
  });

  it("converts columns both ways", () => {
    expect(columnToNumber("A")).toBe(1);
    expect(columnToNumber("Z")).toBe(26);
    expect(columnToNumber("AA")).toBe(27);
    expect(columnToNumber("XFD")).toBe(16384);
    expect(numberToColumn(1)).toBe("A");
    expect(numberToColumn(26)).toBe("Z");
    expect(numberToColumn(27)).toBe("AA");
    expect(numberToColumn(16384)).toBe("XFD");
  });

  it("refuses something that is not a reference", () => {
    expect(() => parseRef("not a ref")).toThrow();
  });
});
