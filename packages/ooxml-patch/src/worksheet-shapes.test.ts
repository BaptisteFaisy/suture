import { describe, expect, it } from "vitest";
import type { OoxmlParts } from "@suture/contracts";
import { patchWorkbook } from "./index";
import { buildCarrier, buildSheet } from "../test/generators";

function sheetXml(parts: OoxmlParts): string {
  const part = parts.find((candidate) => candidate.path === "xl/worksheets/sheet1.xml");
  return new TextDecoder().decode(part?.data ?? new Uint8Array());
}

function withSheet(sheet: { path: string; data: Uint8Array }): OoxmlParts {
  return buildCarrier().map((part) => (part.path === sheet.path ? sheet : part));
}

const REQUEST = {
  patches: [{ sheetId: 1, ref: "B2", record: { ref: "B2", kind: "n" as const, input: "5", cached: "", fmt: "" }, source: "A" as const }],
  sheetPaths: new Map([[1, "xl/worksheets/sheet1.xml"]]),
};

describe("worksheet shapes", () => {
  it("fills a self-closing row", () => {
    const sheet = buildSheet([[]]);
    const parts = withSheet(sheet);
    const result = patchWorkbook(parts, REQUEST);
    expect(sheetXml(result.parts)).toContain('<row r="2"><c r="B2"><v>5</v></c></row>');
  });

  it("keeps the sheet usable when its sheetData is empty", () => {
    const sheet = buildSheet([]);
    const parts = withSheet(sheet);
    const result = patchWorkbook(parts, REQUEST);
    expect(sheetXml(result.parts)).toContain("<sheetData>");
    expect(sheetXml(result.parts)).toContain('<c r="B2"><v>5</v></c>');
  });

  it("empties a row whose only cell is removed", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(parts, {
      patches: [{ sheetId: 1, ref: "B4", record: null, source: "B" }],
      sheetPaths: new Map([[1, "xl/worksheets/sheet1.xml"]]),
    });
    const xml = sheetXml(result.parts);
    expect(xml).not.toContain('r="B4"');
    expect(xml).toContain('<row r="4">');
  });

  it("widens the dimension when a cell lands outside it", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(parts, {
      patches: [{ sheetId: 1, ref: "E9", record: { ref: "E9", kind: "n", input: "1", cached: "", fmt: "" }, source: "A" }],
      sheetPaths: new Map([[1, "xl/worksheets/sheet1.xml"]]),
    });
    expect(sheetXml(result.parts)).toContain('<dimension ref="A1:E9"/>');
  });
});
