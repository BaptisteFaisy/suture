import { describe, expect, it } from "vitest";
import type { CellRecord, OoxmlParts, PatchRequest } from "@suture/contracts";
import { patchWorkbook, PatchError, readOriginMarker } from "./index";
import { cellSource, readSheetCells } from "./sheet-reader";
import { buildCarrier, buildSheet } from "../test/generators";

function sheetXml(parts: OoxmlParts): string {
  const part = parts.find((candidate) => candidate.path === "xl/worksheets/sheet1.xml");
  return new TextDecoder().decode(part?.data ?? new Uint8Array());
}

function request(patches: PatchRequest["patches"], extra: Partial<PatchRequest> = {}): PatchRequest {
  return {
    patches,
    sheetPaths: new Map([[1, "xl/worksheets/sheet1.xml"]]),
    ...extra,
  };
}

function number(input: string): CellRecord {
  return { ref: "", kind: "n", input, cached: "", fmt: "" };
}

describe("patchWorkbook — cell values", () => {
  it("writes a number as a <v> value", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(parts, request([{ sheetId: 1, ref: "B2", record: number("13500"), source: "A" }]));
    expect(cellSource(sheetXml(result.parts), "B2")).toBe('<c r="B2" s="2"><v>13500</v></c>');
  });

  it("writes a text as an inline string and leaves the shared strings alone", () => {
    const parts = buildCarrier();
    const before = parts.find((part) => part.path === "xl/sharedStrings.xml")?.data;
    const result = patchWorkbook(
      parts,
      request([{ sheetId: 1, ref: "A2", record: { ref: "", kind: "s", input: "Loyer", cached: "", fmt: "" }, source: "B" }]),
    );
    expect(cellSource(sheetXml(result.parts), "A2")).toBe(
      '<c r="A2" s="1" t="inlineStr"><is><t xml:space="preserve">Loyer</t></is></c>',
    );
    const after = result.parts.find((part) => part.path === "xl/sharedStrings.xml")?.data;
    expect(after).toBe(before);
  });

});

describe("patchWorkbook — text, formula and flags", () => {
  it("escapes the special characters of a text", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([{ sheetId: 1, ref: "A5", record: { ref: "", kind: "s", input: "a & b < c", cached: "", fmt: "" }, source: "A" }]),
    );
    expect(cellSource(sheetXml(result.parts), "A5")).toContain("a &amp; b &lt; c");
  });

  it("writes a formula without its cached value and keeps the style", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([{ sheetId: 1, ref: "B3", record: { ref: "", kind: "f", input: "SUM(B2:B13)", cached: "13500", fmt: "" }, source: "B" }]),
    );
    const source = cellSource(sheetXml(result.parts), "B3");
    expect(source).toBe('<c r="B3" s="2"><f>SUM(B2:B13)</f></c>');
    expect(source).not.toContain("<v>");
  });

  it("writes a boolean and an error", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([
        { sheetId: 1, ref: "C1", record: { ref: "", kind: "b", input: "true", cached: "", fmt: "" }, source: "A" },
        { sheetId: 1, ref: "C2", record: { ref: "", kind: "e", input: "#DIV/0!", cached: "", fmt: "" }, source: "A" },
      ]),
    );
    const xml = sheetXml(result.parts);
    expect(cellSource(xml, "C1")).toBe('<c r="C1" t="b"><v>1</v></c>');
    expect(cellSource(xml, "C2")).toBe('<c r="C2" t="e"><v>#DIV/0!</v></c>');
  });

});

describe("patchWorkbook — cell removal", () => {
  it("removes a cell from the XML", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([{ sheetId: 1, ref: "B2", record: null, source: "B" }]),
    );
    expect(cellSource(sheetXml(result.parts), "B2")).toBeUndefined();
    expect(sheetXml(result.parts)).not.toContain("<c r=\"B2\"");
  });

});

describe("patchWorkbook — cell layout", () => {
  it("keeps the style of a cell and the style-only cells around it", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([{ sheetId: 1, ref: "A3", record: number("42"), source: "A" }]),
    );
    const xml = sheetXml(result.parts);
    expect(cellSource(xml, "A3")).toBe('<c r="A3" s="1"><v>42</v></c>');
    expect(cellSource(xml, "B4")).toBe('<c r="B4" s="2"><f t="shared" si="0"/><v>27000</v></c>');
  });

  it("keeps rows and cells in ascending order", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([
        { sheetId: 1, ref: "C2", record: number("7"), source: "A" },
        { sheetId: 1, ref: "A6", record: number("9"), source: "A" },
        { sheetId: 1, ref: "B5", record: number("8"), source: "A" },
      ]),
    );
    const xml = sheetXml(result.parts);
    const order = [...xml.matchAll(/<c r="([A-Z]+\d+)"/g)].map((match) => match[1] ?? "");
    expect(order).toEqual([...order].sort((a, b) => rowOf(a) - rowOf(b) || colOf(a) - colOf(b)));
    expect(xml).toContain('<row r="5"');
    expect(xml).toContain('<row r="6"');
  });

  it("updates the spans of the touched rows", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([{ sheetId: 1, ref: "D2", record: number("1"), source: "A" }]),
    );
    expect(sheetXml(result.parts)).toContain('<row r="2" spans="1:4">');
  });
});

describe("patchWorkbook — calculation chain", () => {
  it("removes the chain, its override, its relationship and asks for a recalculation", () => {
    const parts = buildCarrier({ withCalcChain: true });
    const result = patchWorkbook(parts, request([{ sheetId: 1, ref: "B2", record: number("1"), source: "A" }]));
    expect(result.calcChainRemoved).toBe(true);
    expect(result.parts.find((part) => part.path === "xl/calcChain.xml")).toBeUndefined();
    expect(textOf(result.parts, "[Content_Types].xml")).not.toContain("calcChain");
    expect(textOf(result.parts, "xl/_rels/workbook.xml.rels")).not.toContain("calcChain");
    expect(textOf(result.parts, "xl/workbook.xml")).toContain('fullCalcOnLoad="1"');
  });
});

describe("patchWorkbook — recalculation flag", () => {
  it("creates the calcPr element when the workbook has none", () => {
    const parts = buildCarrier().map((part) =>
      part.path === "xl/workbook.xml"
        ? { path: part.path, data: new TextEncoder().encode(textOf([part], part.path).replace(/<calcPr[^>]*\/>/, "")) }
        : part,
    );
    const result = patchWorkbook(parts, request([{ sheetId: 1, ref: "B2", record: number("1"), source: "A" }]));
    expect(textOf(result.parts, "xl/workbook.xml")).toContain('<calcPr calcId="0" fullCalcOnLoad="1"/>');
  });

  it("is a no-op when the workbook has no calculation chain", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(parts, request([{ sheetId: 1, ref: "B2", record: number("1"), source: "A" }]));
    expect(result.calcChainRemoved).toBe(false);
    expect(textOf(result.parts, "[Content_Types].xml")).not.toContain("calcChain");
  });
});

describe("patchWorkbook — origin marker", () => {
  it("creates the custom properties, the override and the root relationship", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(parts, request([], { originMarker: { versionId: "abc123", scenario: "embauche" } }));
    const custom = textOf(result.parts, "docProps/custom.xml");
    expect(custom).toContain('name="SutureSourceVersion"');
    expect(custom).toContain("<vt:lpwstr>abc123</vt:lpwstr>");
    expect(custom).toContain("<vt:lpwstr>embauche</vt:lpwstr>");
    expect(textOf(result.parts, "[Content_Types].xml")).toContain("/docProps/custom.xml");
    expect(textOf(result.parts, "_rels/.rels")).toContain("custom-properties");
    expect(readOriginMarker(result.parts)).toEqual({ versionId: "abc123", scenario: "embauche" });
  });

  it("updates an existing custom properties part without losing the other properties", () => {
    const parts = buildCarrier({ withCustomProps: true });
    const result = patchWorkbook(parts, request([], { originMarker: { versionId: "v1", scenario: "reference" } }));
    const custom = textOf(result.parts, "docProps/custom.xml");
    expect(custom).toContain("ACME");
    expect(readOriginMarker(result.parts)).toEqual({ versionId: "v1", scenario: "reference" });
  });
});

describe("patchWorkbook — carried parts", () => {
  it("carries the macros and the charts untouched", () => {
    const parts = buildCarrier({ macroEnabled: true, withChart: true });
    const result = patchWorkbook(parts, request([{ sheetId: 1, ref: "B2", record: number("1"), source: "A" }]));
    for (const path of ["xl/vbaProject.bin", "xl/charts/chart1.xml", "xl/drawings/drawing1.xml"]) {
      const before = parts.find((part) => part.path === path)?.data;
      const after = result.parts.find((part) => part.path === path)?.data;
      expect(after).toBe(before);
    }
  });

  it("keeps the macro-enabled content type of a .xlsm", () => {
    const parts = buildCarrier({ macroEnabled: true });
    const result = patchWorkbook(parts, request([{ sheetId: 1, ref: "B2", record: number("1"), source: "A" }]));
    expect(textOf(result.parts, "[Content_Types].xml")).toContain(
      '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>',
    );
    expect(textOf(result.parts, "[Content_Types].xml")).toContain(
      '<Override PartName="/xl/worksheets/sheet1.xml"',
    );
  });

  it("keeps the untouched parts byte-for-byte", () => {
    const parts = buildCarrier({ macroEnabled: true, withChart: true, withCalcChain: true });
    const result = patchWorkbook(parts, request([{ sheetId: 1, ref: "B2", record: number("1"), source: "A" }]));
    const allowed = new Set([
      "xl/worksheets/sheet1.xml",
      "xl/workbook.xml",
      "[Content_Types].xml",
      "xl/_rels/workbook.xml.rels",
      "xl/calcChain.xml",
    ]);
    for (const part of parts) {
      if (allowed.has(part.path)) continue;
      const after = result.parts.find((candidate) => candidate.path === part.path);
      expect(after?.data).toBe(part.data);
    }
  });

});

describe("patchWorkbook — error handling", () => {
  it("reports a clear error when the worksheet is missing", () => {
    const parts = buildCarrier();
    expect(() =>
      patchWorkbook(parts, request([{ sheetId: 1, ref: "B2", record: number("1"), source: "A" }], {
        sheetPaths: new Map([[1, "xl/worksheets/sheet9.xml"]]),
      })),
    ).toThrow(PatchError);
  });

  it("reports a clear error when the sheet id is unknown", () => {
    const parts = buildCarrier();
    expect(() =>
      patchWorkbook(parts, request([{ sheetId: 7, ref: "B2", record: number("1"), source: "A" }])),
    ).toThrow(PatchError);
  });

  it("refuses two patches for the same cell", () => {
    const parts = buildCarrier();
    expect(() =>
      patchWorkbook(
        parts,
        request([
          { sheetId: 1, ref: "B2", record: number("1"), source: "A" },
          { sheetId: 1, ref: "B2", record: number("2"), source: "B" },
        ]),
      ),
    ).toThrow(PatchError);
  });

  it("reads the patched cells back", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(
      parts,
      request([
        { sheetId: 1, ref: "B2", record: number("13500"), source: "A" },
        { sheetId: 1, ref: "A2", record: { ref: "", kind: "s", input: "Loyer", cached: "", fmt: "" }, source: "A" },
      ]),
    );
    const cells = readSheetCells(sheetXml(result.parts));
    expect(cells.find((cell) => cell.ref === "B2")?.input).toBe("13500");
    expect(cells.find((cell) => cell.ref === "A2")?.input).toBe("Loyer");
  });
});

describe("patchWorkbook — sheet without rows", () => {
  it("creates the missing row", () => {
    const sheet = buildSheet([]);
    const parts = buildCarrier().map((part) => (part.path === sheet.path ? sheet : part));
    const result = patchWorkbook(parts, request([{ sheetId: 1, ref: "B2", record: number("5"), source: "A" }]));
    expect(sheetXml(result.parts)).toContain('<row r="2"><c r="B2"><v>5</v></c></row>');
  });
});

function textOf(parts: OoxmlParts, path: string): string {
  const part = parts.find((candidate) => candidate.path === path);
  return new TextDecoder().decode(part?.data ?? new Uint8Array());
}

function rowOf(ref: string): number {
  return Number(ref.slice(1));
}

function colOf(ref: string): number {
  return ref.charCodeAt(0);
}
