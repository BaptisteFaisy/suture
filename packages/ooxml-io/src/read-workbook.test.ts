/**
 * Reading a workbook archive: refusals, ordering, macros and limits.
 */
import { describe, expect, it } from "vitest";
import { SutureFileError } from "@suture/contracts";
import { readWorkbook } from "./unzip";
import { listParts, isMacroEnabled } from "./parts";
import { rawZip, text, workbookBytes, workbookParts } from "./test-fixtures";

/** Read a file and return the refusal code it raised. */
function refusalCode(bytes: Uint8Array, limits?: Parameters<typeof readWorkbook>[1]): string {
  try {
    readWorkbook(bytes, limits);
  } catch (error) {
    if (error instanceof SutureFileError) return error.code;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("readWorkbook — refusals", () => {
  it("refuses a file that is not a ZIP archive", () => {
    expect(refusalCode(text("this is a plain text file, not a workbook"))).toBe("not-a-zip");
  });

  it("refuses an empty buffer", () => {
    expect(refusalCode(new Uint8Array(0))).toBe("not-a-zip");
  });

  it("refuses a legacy or password-protected OLE2 container", () => {
    const ole2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00, 0x00, 0x00]);
    expect(refusalCode(ole2)).toBe("encrypted");
  });

  it("refuses a ZIP archive without a workbook part", () => {
    const archive = rawZip({ "hello.txt": text("hello"), "docProps/app.xml": text("<x/>") });
    expect(refusalCode(archive)).toBe("unsupported-format");
  });

  it("refuses an empty archive", () => {
    expect(refusalCode(rawZip({}))).toBe("unsupported-format");
  });

  it("refuses a truncated archive as corrupt", () => {
    const complete = workbookBytes();
    const truncated = complete.subarray(0, Math.floor(complete.length / 2));
    expect(refusalCode(truncated)).toBe("corrupt");
  });

  it("refuses an archive whose compressed bytes are damaged", () => {
    const damaged = workbookBytes([{ path: "xl/big.bin", data: new Uint8Array(4096).fill(65) }]);
    const middle = Math.floor(damaged.length / 2);
    for (let index = middle; index < middle + 8; index += 1) {
      damaged[index] = 0xff;
    }
    expect(refusalCode(damaged)).toBe("corrupt");
  });

  it("refuses an encrypted OOXML package", () => {
    const archive = rawZip({
      "EncryptionInfo": text("encrypted"),
      "EncryptedPackage": text("encrypted"),
      "xl/workbook.xml": text("<workbook/>"),
    });
    expect(refusalCode(archive)).toBe("encrypted");
  });

  it("refuses a binary workbook (.xlsb)", () => {
    const archive = rawZip({
      "xl/workbook.xml": text("<workbook/>"),
      "xl/worksheets/sheet1.bin": text("binary"),
    });
    expect(refusalCode(archive)).toBe("unsupported-format");
  });
});

describe("readWorkbook — resource limits", () => {
  it("refuses a workbook larger than the decompressed limit", () => {
    const archive = workbookBytes([{ path: "xl/big.bin", data: new Uint8Array(5000) }]);
    expect(refusalCode(archive, { maxDecompressedBytes: 1000 })).toBe("too-large");
  });

  it("refuses a workbook with too many entries", () => {
    const archive = workbookBytes([
      { path: "xl/a.bin", data: text("a") },
      { path: "xl/b.bin", data: text("b") },
      { path: "xl/c.bin", data: text("c") },
    ]);
    expect(refusalCode(archive, { maxEntries: 2 })).toBe("too-many-entries");
  });

  it("refuses an entry whose compression ratio is absurd", () => {
    const bomb = new Uint8Array(4 * 1024 * 1024);
    const archive = workbookBytes([{ path: "xl/bomb.bin", data: bomb }]);
    expect(refusalCode(archive)).toBe("zip-bomb");
  });

  it("honours custom limits", () => {
    const archive = workbookBytes([{ path: "xl/big.bin", data: new Uint8Array(2000) }]);
    expect(refusalCode(archive, { maxDecompressedBytes: 1000 })).toBe("too-large");
    expect(readWorkbook(archive, { maxDecompressedBytes: 100_000 }).parts.length).toBe(3);
  });
});

describe("readWorkbook — contents", () => {
  it("returns the parts sorted by path", () => {
    const archive = workbookBytes([
      { path: "xl/worksheets/sheet2.xml", data: text("2") },
      { path: "xl/worksheets/sheet1.xml", data: text("1") },
      { path: "docProps/core.xml", data: text("c") },
    ]);
    const result = readWorkbook(archive);
    expect(result.parts.map((part) => part.path)).toEqual([
      "[Content_Types].xml",
      "docProps/core.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
    ]);
  });

  it("returns the part bytes unchanged", () => {
    const raw = new Uint8Array([0x00, 0xff, 0x10, 0x80, 0x00]);
    const archive = workbookBytes([{ path: "xl/raw.bin", data: raw }]);
    const result = readWorkbook(archive);
    const part = result.parts.find((entry) => entry.path === "xl/raw.bin");
    expect(Array.from(part?.data ?? [])).toEqual([0x00, 0xff, 0x10, 0x80, 0x00]);
  });

  it("detects a macro-enabled workbook", () => {
    const plain = readWorkbook(workbookBytes());
    expect(plain.macroEnabled).toBe(false);
    const macro = readWorkbook(
      workbookBytes([{ path: "xl/vbaProject.bin", data: new Uint8Array([1, 2, 3]) }]),
    );
    expect(macro.macroEnabled).toBe(true);
    expect(isMacroEnabled(macro.parts)).toBe(true);
  });

  it("lists the part paths", () => {
    const parts = workbookParts();
    expect(listParts(parts)).toEqual(["[Content_Types].xml", "xl/workbook.xml"]);
  });
});
