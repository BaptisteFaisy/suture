import { describe, expect, it } from "vitest";
import type { OoxmlParts } from "@suture/contracts";
import { patchWorkbook, readOriginMarker, stampOriginMarker } from "./index";
import { cellSource, readSheetCells } from "./sheet-reader";
import { buildCarrier } from "../test/generators";

function sheetXml(parts: OoxmlParts): string {
  const part = parts.find((candidate) => candidate.path === "xl/worksheets/sheet1.xml");
  return new TextDecoder().decode(part?.data ?? new Uint8Array());
}

describe("origin marker", () => {
  it("reads back a marker that was stamped", () => {
    const parts = buildCarrier();
    const stamped = stampOriginMarker(parts, { versionId: "deadbeef", scenario: "reference" });
    expect(readOriginMarker(stamped)).toEqual({ versionId: "deadbeef", scenario: "reference" });
  });

  it("returns null when the workbook carries no marker", () => {
    expect(readOriginMarker(buildCarrier())).toBeNull();
  });

  it("returns null when the properties lost the Suture entries", () => {
    const parts = buildCarrier({ withCustomProps: true });
    expect(readOriginMarker(parts)).toBeNull();
  });
});

describe("reading the patched cells back", () => {
  it("gives the exact kind, value and style", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(parts, {
      patches: [
        {
          sheetId: 1,
          ref: "B2",
          record: { ref: "B2", kind: "n", input: "13500", cached: "", fmt: "" },
          source: "A",
        },
      ],
      sheetPaths: new Map([[1, "xl/worksheets/sheet1.xml"]]),
    });
    const cells = readSheetCells(sheetXml(result.parts));
    expect(cells.find((cell) => cell.ref === "B2")).toEqual({
      ref: "B2",
      kind: "n",
      input: "13500",
      cached: "",
      style: "2",
    });
  });

  it("gives the exact style of a text cell", () => {
    const parts = buildCarrier();
    const result = patchWorkbook(parts, {
      patches: [
        {
          sheetId: 1,
          ref: "A2",
          record: { ref: "A2", kind: "s", input: "Loyer", cached: "", fmt: "" },
          source: "A",
        },
      ],
      sheetPaths: new Map([[1, "xl/worksheets/sheet1.xml"]]),
    });
    expect(cellSource(sheetXml(result.parts), "A2")).toContain('s="1"');
  });
});
