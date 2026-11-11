import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isEmptyChangeSet } from "@suture/contracts";
import { compare } from "../src";
import {
  canonicalWorkbookArb,
  gridSheetArb,
  insertRows,
  workbookOf,
} from "../test/generators";

describe("diff properties — identity", () => {
  it("SUT-P-04: comparing a workbook to itself yields no change", () => {
    fc.assert(
      fc.property(canonicalWorkbookArb, (workbook) => {
        const changeSet = compare(workbook, workbook);
        expect(isEmptyChangeSet(changeSet)).toBe(true);
        expect(changeSet.summary.inputsModified).toBe(0);
        expect(changeSet.summary.consequences).toBe(0);
        expect(changeSet.summary.formats).toBe(0);
        expect(changeSet.summary.rowsInserted).toBe(0);
        expect(changeSet.summary.rowsDeleted).toBe(0);
      }),
      { numRuns: 200 },
    );
  });
});

describe("diff properties — structure", () => {
  it("SUT-P-05: inserting k rows yields exactly k insertions and no modified input", () => {
    fc.assert(
      fc.property(
        gridSheetArb,
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 9 }),
        (sheet, count, position) => {
          const before = workbookOf(sheet);
          const after = workbookOf(insertRows(sheet, position, count));
          const changeSet = compare(before, after);
          const inserted = changeSet.sheets[0]?.rowsChanged.filter(
            (change) => change.type === "inserted",
          );
          expect(inserted?.length ?? 0).toBe(count);
          expect(changeSet.summary.inputsModified).toBe(0);
          expect(changeSet.summary.rowsDeleted).toBe(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});
