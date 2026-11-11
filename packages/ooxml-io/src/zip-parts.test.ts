/**
 * Deterministic recompression: same parts, same bytes; sorted entries.
 */
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { zipParts } from "./zip";
import { readWorkbook } from "./unzip";
import { text, workbookBytes, workbookParts } from "./test-fixtures";

describe("zipParts", () => {
  it("produces an archive readable by any ZIP tool", () => {
    const archive = zipParts(workbookParts());
    const entries = unzipSync(archive);
    expect(Object.keys(entries).sort()).toEqual(["[Content_Types].xml", "xl/workbook.xml"]);
    expect(new TextDecoder().decode(entries["xl/workbook.xml"])).toContain("<workbook");
  });

  it("writes the entries sorted by path", () => {
    const archive = zipParts([
      { path: "zzz/last.xml", data: text("z") },
      { path: "aaa/first.xml", data: text("a") },
      { path: "mmm/middle.xml", data: text("m") },
    ]);
    expect(Object.keys(unzipSync(archive))).toEqual([
      "aaa/first.xml",
      "mmm/middle.xml",
      "zzz/last.xml",
    ]);
  });

  it("is deterministic: two builds of the same parts give the same bytes", () => {
    const first = zipParts(workbookParts());
    const second = zipParts(workbookParts());
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it("is deterministic whatever the input order", () => {
    const parts = workbookParts();
    const forwards = zipParts(parts);
    const backwards = zipParts([...parts].reverse());
    expect(Array.from(forwards)).toEqual(Array.from(backwards));
  });

  it("round-trips the parts byte for byte", () => {
    const parts = [
      { path: "xl/workbook.xml", data: text("<workbook/>") },
      { path: "xl/binary.bin", data: new Uint8Array([0, 1, 2, 255, 0]) },
    ];
    const result = readWorkbook(zipParts(parts));
    expect(result.parts).toHaveLength(2);
    expect(Array.from(result.parts[0]?.data ?? [])).toEqual([0, 1, 2, 255, 0]);
  });

  it("keeps the macro part untouched", () => {
    const macro = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x01]);
    const archive = workbookBytes([{ path: "xl/vbaProject.bin", data: macro }]);
    const result = readWorkbook(archive);
    const part = result.parts.find((entry) => entry.path === "xl/vbaProject.bin");
    expect(Array.from(part?.data ?? [])).toEqual(Array.from(macro));
    expect(result.macroEnabled).toBe(true);
  });
});
