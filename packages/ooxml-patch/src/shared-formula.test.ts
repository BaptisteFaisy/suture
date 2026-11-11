import { describe, expect, it } from "vitest";
import type { OoxmlParts } from "@suture/contracts";
import { patchWorkbook } from "./index";
import { cellSource } from "./sheet-reader";
import { translateFormula } from "./shared-formula";
import { buildCarrier } from "../test/generators";

function sheetXml(parts: OoxmlParts): string {
  const part = parts.find((candidate) => candidate.path === "xl/worksheets/sheet1.xml");
  return new TextDecoder().decode(part?.data ?? new Uint8Array());
}

function request(patches: { ref: string; record: { ref: string; kind: "n"; input: string; cached: string; fmt: string } | null }[]) {
  return {
    patches: patches.map((patch) => ({ sheetId: 1, ...patch, source: "A" as const })),
    sheetPaths: new Map([[1, "xl/worksheets/sheet1.xml"]]),
  };
}

describe("shared formulas", () => {
  it("expands the follower when the master is overwritten", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([{ ref: "B3", record: { ref: "B3", kind: "n", input: "42", cached: "", fmt: "" } }]),
    );
    expect(cellSource(sheetXml(result.parts), "B4")).toBe('<c r="B4" s="2"><f>SUM(B3:B3)</f><v>27000</v></c>');
  });

  it("develops the master when a follower is overwritten", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([{ ref: "B4", record: { ref: "B4", kind: "n", input: "7", cached: "", fmt: "" } }]),
    );
    expect(cellSource(sheetXml(result.parts), "B3")).toBe(
      '<c r="B3" s="2"><f>SUM(B2:B2)</f><v>13500</v></c>',
    );
    expect(cellSource(sheetXml(result.parts), "B4")).toBe('<c r="B4" s="2"><v>7</v></c>');
  });

  it("keeps the group untouched when another cell is patched", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([{ ref: "B2", record: { ref: "B2", kind: "n", input: "1", cached: "", fmt: "" } }]),
    );
    expect(cellSource(sheetXml(result.parts), "B4")).toBe('<c r="B4" s="2"><f t="shared" si="0"/><v>27000</v></c>');
    expect(cellSource(sheetXml(result.parts), "B3")).toContain('t="shared"');
  });

  it("translates a formula by the row and column offsets", () => {
    expect(translateFormula("SUM(B2:B2)", 1, 0)).toBe("SUM(B3:B3)");
    expect(translateFormula("SUM($B$2:B2)", 1, 1)).toBe("SUM($B$2:C3)");
    expect(translateFormula("SUM(Sheet2!A1)", 3, 3)).toBe("SUM(Sheet2!A1)");
    expect(translateFormula('IF(A1>0,"A1","x")', 1, 0)).toBe('IF(A2>0,"A1","x")');
  });
});
