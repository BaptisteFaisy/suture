/**
 * Unit tests for `@suture/canonical`.
 */
import { describe, expect, it } from "vitest";
import {
  deriveCanonical,
  escapeTsvValue,
  parseCellsTsv,
  serializeCellsTsv,
  serializeWorkbookJson,
  unescapeTsvValue,
} from "../src/index";
import type { SheetMeta } from "../src/index";
import { buildWorkbookParts, text } from "./generators";
import { createTestFormulaCodec } from "./test-codec";

const codec = createTestFormulaCodec();

const SHEET: SheetMeta = {
  sheetId: 1,
  name: "Sheet1",
  order: 0,
  state: "visible",
  path: "xl/worksheets/sheet1.xml",
};

/** Derives the cells of a single-sheet workbook. */
function cellsOf(rows: string, options: Parameters<typeof buildWorkbookParts>[0] = { sheets: [] }) {
  const fixture = { ...options, sheets: [{ name: "Sheet1", sheetId: 1, rows }] };
  return deriveCanonical(buildWorkbookParts(fixture), { codec }).sheets[0]?.cells ?? [];
}

describe("cells/*.tsv escaping and round-trip", () => {
  it("escapes tab, newline, carriage return and backslash", () => {
    expect(escapeTsvValue("A\tB\nC\rD\\E")).toBe("A\\tB\\nC\\rD\\\\E");
    expect(unescapeTsvValue("A\\tB\\nC\\rD\\\\E")).toBe("A\tB\nC\rD\\E");
    expect(unescapeTsvValue(escapeTsvValue("tab\there\nnew\\line"))).toBe("tab\there\nnew\\line");
  });

  it("round-trips an empty sheet and a single cell", () => {
    expect(serializeCellsTsv({ meta: SHEET, cells: [] })).toBe("");
    expect(parseCellsTsv("")).toEqual([]);

    const cells = [{ ref: "A1", kind: "s" as const, input: "Hello", cached: "", fmt: "" }];
    const tsv = serializeCellsTsv({ meta: SHEET, cells });
    expect(tsv).toBe("A1\ts\tHello\t\t\n");
    expect(parseCellsTsv(tsv)).toEqual(cells);
  });

  it("sorts rows and columns numerically, not lexicographically", () => {
    const cells = [
      { ref: "A10", kind: "s" as const, input: "ten", cached: "", fmt: "" },
      { ref: "A2", kind: "s" as const, input: "two", cached: "", fmt: "" },
      { ref: "B1", kind: "s" as const, input: "b1", cached: "", fmt: "" },
      { ref: "A1", kind: "s" as const, input: "a1", cached: "", fmt: "" },
      { ref: "AA1", kind: "s" as const, input: "aa1", cached: "", fmt: "" },
    ];
    const parsed = parseCellsTsv(serializeCellsTsv({ meta: SHEET, cells }));
    expect(parsed.map((cell) => cell.ref)).toEqual(["A1", "B1", "AA1", "A2", "A10"]);
  });
});

describe("deriveCanonical — values", () => {
  it("resolves shared strings and flattens rich text", () => {
    const parts = buildWorkbookParts({
      sheets: [
        {
          name: "Sheet1",
          sheetId: 1,
          rows: '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
        },
      ],
      sharedStrings: [{ text: "Simple" }, { runs: ["Rich", " ", "Text"] }],
    });
    const canonical = deriveCanonical(parts, { codec });
    expect(canonical.sheets[0]?.cells).toEqual([
      { ref: "A1", kind: "s", input: "Simple", cached: "", fmt: "" },
      { ref: "B1", kind: "s", input: "Rich Text", cached: "", fmt: "" },
    ]);
  });

  it("omits style-only cells without values", () => {
    const cells = cellsOf('<row r="1"><c r="A1" s="1"/><c r="B1"><v>42</v></c></row>');
    expect(cells).toEqual([{ ref: "B1", kind: "n", input: "42", cached: "", fmt: "" }]);
  });

  it("handles booleans, errors, inline strings and cached formula values", () => {
    const cells = cellsOf(
      '<row r="1">' +
        '<c r="A1" t="b"><v>1</v></c>' +
        '<c r="B1" t="b"><v>0</v></c>' +
        '<c r="C1" t="e"><v>#DIV/0!</v></c>' +
        '<c r="D1" t="inlineStr"><is><t>Inline</t></is></c>' +
        '<c r="E1"><f>SUM(A1:A1)</f><v>1</v></c>' +
        "</row>",
    );
    expect(cells).toEqual([
      { ref: "A1", kind: "b", input: "TRUE", cached: "", fmt: "" },
      { ref: "B1", kind: "b", input: "FALSE", cached: "", fmt: "" },
      { ref: "C1", kind: "e", input: "#DIV/0!", cached: "", fmt: "" },
      { ref: "D1", kind: "s", input: "Inline", cached: "", fmt: "" },
      { ref: "E1", kind: "f", input: "=SUM(RC[-4]:RC[-4])", cached: "1", fmt: "" },
    ]);
  });

});

describe("deriveCanonical — numbers", () => {
  it("writes numbers in their shortest round-trip form", () => {
    const cells = cellsOf(
      '<row r="1">' +
        '<c r="A1"><v>13500</v></c>' +
        '<c r="B1"><v>13500.00</v></c>' +
        '<c r="C1"><v>0.1</v></c>' +
        '<c r="D1"><v>1e21</v></c>' +
        '<c r="E1"><v>-0</v></c>' +
        "</row>",
    );
    expect(cells.map((cell) => cell.input)).toEqual(["13500", "13500", "0.1", "1e+21", "0"]);
  });

});

describe("deriveCanonical — formats", () => {
  it("keeps a date as a number paired with its format", () => {
    const cells = cellsOf('<row r="1"><c r="A1" s="1"><v>44927</v></c></row>', {
      sheets: [],
      cellFormats: [0, 14],
    });
    expect(cells).toEqual([{ ref: "A1", kind: "n", input: "44927", cached: "", fmt: "mm-dd-yy" }]);
  });
});

describe("deriveCanonical — formulas", () => {
  it("expands a shared formula: every follower keeps the same relative text", () => {
    const rows = Array.from({ length: 12 }, (_unused, index) => {
      const row = index + 2;
      const formula = index === 0 ? '<f t="shared" ref="B2:B13" si="0">A2*2</f>' : '<f t="shared" si="0"/>';
      return `<row r="${row}"><c r="A${row}"><v>${row}</v></c><c r="B${row}">${formula}<v>${row * 2}</v></c></row>`;
    }).join("");
    const cells = cellsOf(rows).filter((cell) => cell.kind === "f");
    expect(cells).toHaveLength(12);
    expect(new Set(cells.map((cell) => cell.input))).toEqual(new Set(["=RC[-1]*2"]));
    expect(cells.map((cell) => cell.ref)).toEqual([
      "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12", "B13",
    ]);
    expect(cells[11]).toMatchObject({ ref: "B13", cached: "26" });
  });

  it("converts a plain formula to L1C1 relative to its cell", () => {
    const cells = cellsOf(
      '<row r="14"><c r="B14"><f>SUM(B2:B13)</f><v>131500</v></c></row>',
    );
    expect(cells).toEqual([
      { ref: "B14", kind: "f", input: "=SUM(R[-12]C:R[-1]C)", cached: "131500", fmt: "" },
    ]);
  });

  it("gives every follower of a 2x2 shared formula the same L1C1 text", () => {
    const rows =
      '<row r="1">' +
      '<c r="B1"><f t="shared" ref="B1:C2" si="0">A1+1</f><v>2</v></c>' +
      '<c r="C1"><f t="shared" si="0"/><v>3</v></c>' +
      "</row>" +
      '<row r="2">' +
      '<c r="B2"><f t="shared" si="0"/><v>4</v></c>' +
      '<c r="C2"><f t="shared" si="0"/><v>5</v></c>' +
      "</row>";
    const cells = cellsOf(rows);
    expect(cells.map((cell) => [cell.ref, cell.input])).toEqual([
      ["B1", "=RC[-1]+1"],
      ["C1", "=RC[-1]+1"],
      ["B2", "=RC[-1]+1"],
      ["C2", "=RC[-1]+1"],
    ]);
    expect(cells.map((cell) => cell.cached)).toEqual(["2", "3", "4", "5"]);
  });
});

describe("deriveCanonical — workbook", () => {
  it("extracts sheet state, order and defined names", () => {
    const parts = buildWorkbookParts({
      sheets: [
        { name: "Visible", sheetId: 1, state: "visible", rows: "" },
        { name: "Hidden", sheetId: 2, state: "hidden", rows: "" },
        { name: "Buried", sheetId: 7, state: "veryHidden", rows: "" },
      ],
      definedNames: ["Total", "Rate"],
    });
    const canonical = deriveCanonical(parts, { codec });
    expect(canonical.meta.sheets.map((sheet) => [sheet.name, sheet.state, sheet.order])).toEqual([
      ["Visible", "visible", 0],
      ["Hidden", "hidden", 1],
      ["Buried", "veryHidden", 2],
    ]);
    expect(canonical.meta.definedNames.map((name) => name.name)).toEqual(["Total", "Rate"]);
    expect(canonical.sheets.map((sheet) => sheet.meta.name)).toEqual(["Visible", "Hidden", "Buried"]);
  });

  it("resolves built-in and custom number formats", () => {
    const cells = cellsOf(
      '<row r="1">' +
        '<c r="A1" s="0"><v>1234</v></c>' +
        '<c r="B1" s="1"><v>0.15</v></c>' +
        '<c r="C1" s="2"><v>44927</v></c>' +
        "</row>",
      { sheets: [], numberFormats: { "165": "#,##0.00 €" }, cellFormats: [0, 9, 165] },
    );
    expect(cells.map((cell) => cell.fmt)).toEqual(["", "0%", "#,##0.00 €"]);
  });

});

describe("deriveCanonical — parts", () => {
  it("names worksheet parts from the relationships, not from sheet1.xml", () => {
    const parts = buildWorkbookParts({
      sheets: [
        {
          name: "Odd",
          sheetId: 3,
          path: "xl/worksheets/sheet9.xml",
          rows: '<row r="1"><c r="A1"><v>1</v></c></row>',
        },
      ],
    });
    const canonical = deriveCanonical(parts, { codec });
    expect(canonical.meta.sheets[0]?.path).toBe("xl/worksheets/sheet9.xml");
    expect(canonical.sheets[0]?.cells).toHaveLength(1);
  });

  it("strips Suture origin markers before deriving", () => {
    const custom =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties">' +
      '<property pid="2" name="SutureSourceVersion">commit-1234</property>' +
      '<property pid="3" name="SutureScenario">baseline</property>' +
      '<property pid="4" name="ClientProject">Acme</property>' +
      "</Properties>";
    const rows = '<row r="1"><c r="A1"><v>42</v></c></row>';
    const withMarker = buildWorkbookParts({
      sheets: [{ name: "S", sheetId: 1, rows }],
      extraParts: [{ path: "docProps/custom.xml", data: text(custom) }],
    });
    const clean = buildWorkbookParts({ sheets: [{ name: "S", sheetId: 1, rows }] });
    expect(deriveCanonical(withMarker, { codec })).toEqual(deriveCanonical(clean, { codec }));
  });
});

describe("serializeWorkbookJson", () => {
  it("serializes sheets and defined names predictably", () => {
    const json = serializeWorkbookJson({
      sheets: [SHEET],
      definedNames: [{ name: "TVA", formula: "0.2" }],
    });
    expect(JSON.parse(json)).toEqual({
      sheets: [
        { sheetId: 1, name: "Sheet1", order: 0, state: "visible", path: "xl/worksheets/sheet1.xml" },
      ],
      definedNames: [{ name: "TVA", formula: "0.2" }],
    });
    expect(json.endsWith("\n")).toBe(true);
  });
});
