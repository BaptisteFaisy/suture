import { describe, expect, it } from "vitest";
import { compare } from "../src";
import { cell, sheet, workbook } from "../test/builders";

describe("three natures of a difference", () => {
  const before = workbook(
    sheet(1, "Budget", [
      cell("A1", "Rent", { kind: "s" }),
      cell("B1", "1000"),
      cell("B2", "=SUM(B1:B1)", { kind: "f", cached: "1000", fmt: "#,##0" }),
    ]),
  );

  it("counts a typed value as a modified input", () => {
    const after = workbook(
      sheet(1, "Budget", [
        cell("A1", "Rent", { kind: "s" }),
        cell("B1", "1200"),
        cell("B2", "=SUM(B1:B1)", { kind: "f", cached: "1000", fmt: "#,##0" }),
      ]),
    );
    const changes = compare(before, after);
    expect(changes.summary.inputsModified).toBe(1);
    expect(changes.summary.consequences).toBe(0);
  });

  it("counts a recalculated result as a consequence", () => {
    const after = workbook(
      sheet(1, "Budget", [
        cell("A1", "Rent", { kind: "s" }),
        cell("B1", "1000"),
        cell("B2", "=SUM(B1:B1)", { kind: "f", cached: "1200", fmt: "#,##0" }),
      ]),
    );
    const changes = compare(before, after);
    expect(changes.summary.consequences).toBe(1);
    expect(changes.summary.inputsModified).toBe(0);
  });

  it("counts a number format change as a format", () => {
    const after = workbook(
      sheet(1, "Budget", [
        cell("A1", "Rent", { kind: "s" }),
        cell("B1", "1000"),
        cell("B2", "=SUM(B1:B1)", { kind: "f", cached: "1000", fmt: "0.00" }),
      ]),
    );
    const changes = compare(before, after);
    expect(changes.summary.formats).toBe(1);
    expect(changes.summary.inputsModified).toBe(0);
  });
});

describe("rows", () => {
  const before = workbook(
    sheet(1, "Budget", [cell("A1", "a"), cell("A2", "b"), cell("A3", "c")]),
  );

  it("reports an inserted row and does not mark shifted cells as modified", () => {
    const after = workbook(
      sheet(1, "Budget", [
        cell("A1", "a"),
        cell("A2", "new"),
        cell("A3", "b"),
        cell("A4", "c"),
      ]),
    );
    const changes = compare(before, after);
    expect(changes.summary.rowsInserted).toBe(1);
    expect(changes.summary.inputsModified).toBe(0);
    expect(changes.sheets[0]?.structural).toBe(true);
  });

  it("reports a deleted row", () => {
    const after = workbook(sheet(1, "Budget", [cell("A1", "a"), cell("A3", "c")]));
    const changes = compare(before, after);
    expect(changes.summary.rowsDeleted).toBe(1);
    expect(changes.summary.inputsModified).toBe(0);
  });

  it("pairs a retyped row as modified, not as a deletion plus an insertion", () => {
    const wide = workbook(
      sheet(1, "Budget", [
        cell("A1", "a"),
        cell("B1", "b"),
        cell("C1", "c"),
        cell("D1", "d"),
        cell("E1", "e"),
      ]),
    );
    const retyped = workbook(
      sheet(1, "Budget", [
        cell("A1", "a"),
        cell("B1", "B"),
        cell("C1", "C"),
        cell("D1", "D"),
        cell("E1", "e"),
      ]),
    );
    const changes = compare(wide, retyped);
    expect(changes.summary.inputsModified).toBe(3);
    expect(changes.summary.rowsInserted).toBe(0);
    expect(changes.summary.rowsDeleted).toBe(0);
    expect(changes.sheets[0]?.structural).toBe(false);
  });
});

describe("sheets and parts", () => {
  it("detects a renamed sheet by its stable id", () => {
    const before = workbook(sheet(1, "Budget", [cell("A1", "a")]));
    const after = workbook(sheet(1, "Budget 2026", [cell("A1", "a")]));
    const changes = compare(before, after);
    expect(changes.summary.sheetsRenamed).toBe(1);
    expect(changes.sheetChanges[0]?.before).toBe("Budget");
    expect(changes.sheetChanges[0]?.after).toBe("Budget 2026");
  });

  it("detects added and removed sheets", () => {
    const before = workbook(sheet(1, "Budget", [cell("A1", "a")]));
    const after = workbook(sheet(2, "Staff", [cell("A1", "x")]));
    const changes = compare(before, after);
    expect(changes.summary.sheetsAdded).toBe(1);
    expect(changes.summary.sheetsRemoved).toBe(1);
  });

  it("compares non-cell parts by fingerprint only", () => {
    const before = workbook(sheet(1, "Budget", [cell("A1", "a")]));
    const changes = compare(
      before,
      before,
      { "xl/charts/chart1.xml": new Uint8Array([1, 2, 3]) },
      { "xl/charts/chart1.xml": new Uint8Array([9, 9, 9]) },
    );
    expect(changes.summary.partsChanged).toBe(1);
    expect(changes.partChanges[0]).toMatchObject({ type: "modified", label: "Chart 1" });
  });
});
