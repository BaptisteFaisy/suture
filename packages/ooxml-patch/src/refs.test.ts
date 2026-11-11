import { describe, expect, it } from "vitest";
import { columnLetters, columnNumber, formatRef, parseRef } from "./refs";
import { containsR1c1, toSheetFormula } from "./formula-input";
import { escapeAttr, escapeText, unescapeText } from "./xml";

describe("cell references", () => {
  it("parses and formats an A1 address", () => {
    expect(parseRef("B14")).toEqual({ row: 14, col: 2 });
    expect(parseRef("$AA$3")).toEqual({ row: 3, col: 27 });
    expect(formatRef({ row: 14, col: 2 })).toBe("B14");
    expect(formatRef({ row: 3, col: 27 })).toBe("AA3");
  });

  it("converts between column letters and column numbers", () => {
    expect(columnLetters(1)).toBe("A");
    expect(columnLetters(26)).toBe("Z");
    expect(columnLetters(27)).toBe("AA");
    expect(columnNumber("A")).toBe(1);
    expect(columnNumber("AA")).toBe(27);
  });

  it("refuses an address it cannot understand", () => {
    expect(() => parseRef("")).toThrow();
    expect(() => parseRef("12")).toThrow();
    expect(() => parseRef("B0")).toThrow();
    expect(() => parseRef("B")).toThrow();
  });
});

describe("formula input", () => {
  it("keeps an A1 formula as it is", () => {
    expect(toSheetFormula("SUM(B2:B13)", "B14")).toBe("SUM(B2:B13)");
    expect(toSheetFormula("=SUM(B2:B13)", "B14")).toBe("SUM(B2:B13)");
  });

  it("translates an R1C1 formula to the target position", () => {
    expect(containsR1c1("SUM(R[-12]C:R[-1]C)")).toBe(true);
    expect(toSheetFormula("SUM(R[-12]C:R[-1]C)", "B14")).toBe("SUM(B2:B13)");
    expect(toSheetFormula("R1C1", "B14")).toBe("$A$1");
  });

  it("leaves an A1 formula that looks like R1C1 alone", () => {
    expect(containsR1c1("SUM(A1:R5)")).toBe(false);
    expect(containsR1c1("ROUND(A1)")).toBe(false);
    expect(toSheetFormula("SUM(A1:R5)", "B14")).toBe("SUM(A1:R5)");
    expect(toSheetFormula("ROUND(A1)", "B14")).toBe("ROUND(A1)");
  });
});

describe("XML escaping", () => {
  it("escapes the special characters of a text", () => {
    expect(escapeText("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
    expect(escapeAttr('say "hi"')).toBe("say &quot;hi&quot;");
  });

  it("decodes the entities of a text", () => {
    expect(unescapeText("a &amp; b &lt; c")).toBe("a & b < c");
    expect(unescapeText("&#65;&#x42;")).toBe("AB");
  });
});
