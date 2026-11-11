import { describe, expect, it } from "vitest";
import { GROUP_SEPARATOR, formatAmount, formatValue } from "./format";

const grouped = (digits: string) => digits.replace(/,/g, GROUP_SEPARATOR);

describe("formatAmount", () => {
  it("groups thousands with a narrow space", () => {
    expect(formatAmount(120_000, "fr")).toBe(grouped("120,000"));
    expect(formatAmount(1_234_567, "en")).toBe(grouped("1,234,567"));
  });

  it("keeps small numbers untouched", () => {
    expect(formatAmount(12, "fr")).toBe("12");
    expect(formatAmount(0, "en")).toBe("0");
  });

  it("uses the decimal separator of the language (SUT-N-08)", () => {
    expect(formatAmount(131_500.5, "fr")).toBe(`${grouped("131,500")},5`);
    expect(formatAmount(131_500.5, "en")).toBe(`${grouped("131,500")}.5`);
  });

  it("keeps the sign", () => {
    expect(formatAmount(-2500, "fr")).toBe(`-${grouped("2,500")}`);
  });
});

describe("formatValue", () => {
  it("formats plain numbers", () => {
    expect(formatValue("120000", "fr")).toBe(grouped("120,000"));
    expect(formatValue("131500", "en")).toBe(grouped("131,500"));
  });

  it("leaves text untouched", () => {
    expect(formatValue("Rent", "fr")).toBe("Rent");
    expect(formatValue("", "en")).toBe("");
  });

  it("leaves formulas untouched", () => {
    expect(formatValue("=SUM(R[-12]C:R[-1]C)", "en")).toBe("=SUM(R[-12]C:R[-1]C)");
  });

  it("leaves already formatted values to the engine", () => {
    expect(formatValue("12 000", "fr")).toBe("12 000");
  });
});
