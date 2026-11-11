import { describe, expect, it } from "vitest";
import {
  DEFAULT_UNZIP_LIMITS,
  SutureFileError,
  isEmptyChangeSet,
  type ChangeSet,
} from "./index";

const EMPTY: ChangeSet = {
  sheets: [],
  sheetChanges: [],
  partChanges: [],
  summary: {
    inputsModified: 0,
    consequences: 0,
    formats: 0,
    rowsInserted: 0,
    rowsDeleted: 0,
    colsInserted: 0,
    colsDeleted: 0,
    sheetsAdded: 0,
    sheetsRemoved: 0,
    sheetsRenamed: 0,
    partsChanged: 0,
  },
};

describe("contracts", () => {
  it("limits are contest-grade (50 MB decompressed, 1M cells)", () => {
    expect(DEFAULT_UNZIP_LIMITS.maxDecompressedBytes).toBe(50_000_000);
    expect(DEFAULT_UNZIP_LIMITS.maxCells).toBe(1_000_000);
  });

  it("an empty change set is detected", () => {
    expect(isEmptyChangeSet(EMPTY)).toBe(true);
    expect(
      isEmptyChangeSet({
        ...EMPTY,
        partChanges: [{ type: "modified", path: "xl/charts/chart1.xml", label: "Chart 1" }],
      }),
    ).toBe(false);
  });

  it("file errors carry a machine-readable code", () => {
    const error = new SutureFileError("encrypted", "Workbook is password protected");
    expect(error.code).toBe("encrypted");
    expect(error).toBeInstanceOf(Error);
  });
});
