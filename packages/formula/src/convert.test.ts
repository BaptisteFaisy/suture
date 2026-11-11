import { describe, expect, it } from "vitest";
import { a1ToR1c1 } from "./a1-r1c1";
import { r1c1ToA1 } from "./r1c1-a1";
import { shiftA1 } from "./shift";

const ORIGIN_B14 = { row: 14, col: 2 };
const ORIGIN_A1 = { row: 1, col: 1 };

describe("A1 to R1C1", () => {
  it("converts the documented example", () => {
    const result = a1ToR1c1("=SUM(B2:B13)", ORIGIN_B14);
    expect(result.formula).toBe("=SUM(R[-12]C:R[-1]C)");
    expect(result.issues).toEqual([]);
  });

  it("converts absolute references to numbered R and C", () => {
    expect(a1ToR1c1("=$B$2", ORIGIN_B14).formula).toBe("=R2C2");
  });

  it("converts mixed references", () => {
    expect(a1ToR1c1("=B$2", ORIGIN_B14).formula).toBe("=R2C");
    expect(a1ToR1c1("=$B2", ORIGIN_B14).formula).toBe("=R[-12]C2");
  });

  it("renders a zero offset as a bare letter", () => {
    expect(a1ToR1c1("=B14+1", ORIGIN_B14).formula).toBe("=RC+1");
  });

  it("leaves string literals alone", () => {
    expect(a1ToR1c1('="Total: "&A1', ORIGIN_A1).formula).toBe('="Total: "&RC');
  });

  it("leaves defined names and structured references alone", () => {
    expect(a1ToR1c1("=Tax_Rate*B2", ORIGIN_A1).formula).toBe("=Tax_Rate*R[1]C[1]");
    expect(a1ToR1c1("=SUM(Table1[Amount])", ORIGIN_A1).formula).toBe("=SUM(Table1[Amount])");
  });

  it("keeps an external workbook reference untouched and reports it", () => {
    const result = a1ToR1c1("='[Book1.xlsx]Sheet1'!A1", ORIGIN_A1);
    expect(result.formula).toBe("='[Book1.xlsx]Sheet1'!A1");
    expect(result.issues.map((issue) => issue.code)).toContain("external-reference");
  });

  it("converts a reference qualified by a local sheet", () => {
    expect(a1ToR1c1("=Sheet2!B5", ORIGIN_A1).formula).toBe("=Sheet2!R[4]C[1]");
  });

  it("does not mistake a function name or a defined name for a reference", () => {
    expect(a1ToR1c1("=LOG10(A1)+Budget_2026", ORIGIN_A1).formula).toBe("=LOG10(RC)+Budget_2026");
  });

  it("keeps a broken formula as it is and reports it", () => {
    const result = a1ToR1c1("=SUM(B2:B13", ORIGIN_B14);
    expect(result.formula).toBe("=SUM(B2:B13");
    expect(result.issues.map((issue) => issue.code)).toContain("unsupported-syntax");
  });
});

describe("R1C1 to A1", () => {
  it("inverts the documented example", () => {
    expect(r1c1ToA1("=SUM(R[-12]C:R[-1]C)", ORIGIN_B14).formula).toBe("=SUM(B2:B13)");
  });

  it("inverts absolute and mixed references", () => {
    expect(r1c1ToA1("=R2C2", ORIGIN_B14).formula).toBe("=$B$2");
    expect(r1c1ToA1("=R2C", ORIGIN_B14).formula).toBe("=B$2");
    expect(r1c1ToA1("=R[-12]C2", ORIGIN_B14).formula).toBe("=$B2");
    expect(r1c1ToA1("=RC+1", ORIGIN_B14).formula).toBe("=B14+1");
  });

  it("re-bases a relative reference on the target position", () => {
    expect(r1c1ToA1("=R[-1]C", { row: 20, col: 5 }).formula).toBe("=E19");
  });

  it("reports a reference that lands outside the sheet", () => {
    const result = r1c1ToA1("=R[-3]C", ORIGIN_A1);
    expect(result.issues.map((issue) => issue.code)).toContain("needs-review");
  });
});

describe("shifting an A1 formula", () => {
  it("expands a shared formula downwards", () => {
    expect(shiftA1("=SUM(B2:B13)", -1, 0).formula).toBe("=SUM(B1:B12)");
  });

  it("never moves an absolute reference", () => {
    expect(shiftA1("=$B$2+B3", 1, 1).formula).toBe("=$B$2+C4");
  });

  it("leaves strings, names and structured references alone", () => {
    expect(shiftA1('="A1"&Tax_Rate+Table1[Amount]', 2, 2).formula).toBe(
      '="A1"&Tax_Rate+Table1[Amount]',
    );
  });

  it("keeps a reference that would move above row 1 and reports it", () => {
    const result = shiftA1("=A1+A2", -5, 0);
    expect(result.formula).toBe("=A1+A1");
    expect(result.issues.map((issue) => issue.code)).toContain("needs-review");
  });
});
