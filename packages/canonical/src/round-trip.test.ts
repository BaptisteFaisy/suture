/**
 * Round-trip of the canonical view: derive -> serialize -> parse.
 */
import { describe, expect, it } from "vitest";
import { deriveCanonical, parseCellsTsv, serializeCellsTsv } from "./index";
import { buildWorkbookParts } from "../test/generators";


const ROWS =
  '<row r="1">' +
  '<c r="A1" t="s"><v>0</v></c>' +
  '<c r="B1" t="s"><v>1</v></c>' +
  '<c r="C1" s="1"><v>13500</v></c>' +
  '<c r="D1" t="str"><v>Computed</v></c>' +
  '<c r="E1" t="d"><v>2026-11-11</v></c>' +
  "</row>" +
  '<row r="2">' +
  '<c r="A2" s="2"/>' +
  '<c r="B2"><f>SUM(C1:C1)</f><v>13500</v></c>' +
  "</row>" +
  '<row r="10">' +
  '<c r="AA10" t="s"><v>2</v></c>' +
  "</row>";

/** Builds the fixture used by every test of this file. */
function fixtureParts() {
  return buildWorkbookParts({
    sheets: [{ name: "Budget", sheetId: 1, rows: ROWS }],
    sharedStrings: [{ text: "Loyer" }, { text: "Tab\there\nand\\back" }, { text: "Far" }],
    numberFormats: { "165": "#,##0.00 €" },
    cellFormats: [0, 0, 165],
  });
}

describe("canonical round-trip", () => {
  it("derives, serializes and parses back the very same cells", () => {
    const sheet = deriveCanonical(fixtureParts()).sheets[0];
    expect(sheet).toBeDefined();
    const tsv = serializeCellsTsv(sheet!);
    const parsed = parseCellsTsv(tsv);
    expect(parsed).toEqual(sheet!.cells);
    expect(serializeCellsTsv({ meta: sheet!.meta, cells: parsed })).toBe(tsv);
  });

  it("escapes the special characters of a shared string", () => {
    const sheet = deriveCanonical(fixtureParts()).sheets[0]!;
    const line = serializeCellsTsv(sheet).split("\n")[1];
    expect(line).toBe("B1\ts\tTab\\there\\nand\\\\back\t\t");
    expect(parseCellsTsv(`${line}\n`)[0]?.input).toBe("Tab\there\nand\\back");
  });

  it("keeps the numeric sort and drops the style-only cell", () => {
    const sheet = deriveCanonical(fixtureParts()).sheets[0]!;
    expect(sheet.cells.map((cell) => cell.ref)).toEqual([
      "A1", "B1", "C1", "D1", "E1", "B2", "AA10",
    ]);
  });

  it("reads the ISO date cell and the cached formula value", () => {
    const cells = deriveCanonical(fixtureParts()).sheets[0]!.cells;
    expect(cells.find((cell) => cell.ref === "E1")).toMatchObject({ kind: "s", input: "2026-11-11" });
    expect(cells.find((cell) => cell.ref === "B2")).toMatchObject({
      kind: "f",
      input: "=SUM(R[-1]C[1]:R[-1]C[1])",
      cached: "13500",
    });
  });
});
