import { describe, expect, it } from "vitest";
import type { CellRecord, ChangeSet, MergePlan } from "@suture/contracts";
import { cellText, toCombineView, toComparisonView, toVersionSummaries } from "./mappers";

function cell(ref: string, input: string, overrides: Partial<CellRecord> = {}): CellRecord {
  return { ref, kind: "n", input, cached: "", fmt: "", ...overrides };
}

const SUMMARY = {
  inputsModified: 1,
  consequences: 0,
  formats: 0,
  rowsInserted: 1,
  rowsDeleted: 0,
  colsInserted: 0,
  colsDeleted: 0,
  sheetsAdded: 0,
  sheetsRemoved: 0,
  sheetsRenamed: 0,
  partsChanged: 1,
};

const CHANGE_SET: ChangeSet = {
  sheets: [
    {
      sheetId: 1,
      rows: [],
      cols: [],
      cells: [
        {
          sheetId: 1,
          ref: "B5",
          kind: "input",
          before: cell("B5", "60000"),
          after: cell("B5", "61000"),
        },
      ],
      rowsChanged: [
        { sheetId: 1, type: "inserted", rowIndex: 5, cells: [cell("A6", "Transport")] },
      ],
      colsChanged: [],
      structural: true,
    },
  ],
  sheetChanges: [],
  partChanges: [{ type: "modified", path: "xl/charts/chart1.xml", label: "Chart 1" }],
  summary: SUMMARY,
};

const ALL = { sheetId: "all" as const, nature: "all" as const };

describe("cellText", () => {
  it("renders booleans as words and nothing for a missing cell", () => {
    expect(cellText(null)).toBe("");
    expect(cellText(cell("A1", "1", { kind: "b" }))).toBe("TRUE");
    expect(cellText(cell("A1", "0", { kind: "b" }))).toBe("FALSE");
    expect(cellText(cell("A1", "1200"))).toBe("1200");
  });
});

describe("toComparisonView", () => {
  it("carries cell changes, added rows and non-cell parts", () => {
    const view = toComparisonView(CHANGE_SET, ALL);
    expect(view.rows).toHaveLength(2);
    expect(view.rows[0]).toMatchObject({ ref: "B5", nature: "input", before: "60000", after: "61000" });
    expect(view.rows[1]).toMatchObject({ ref: "A6", before: "", after: "Transport" });
    expect(view.otherParts).toEqual(["Chart 1"]);
    expect(view.summary.inputsModified).toBe(1);
    expect(view.summary.rowsInserted).toBe(1);
    expect(view.summary.partsChanged).toBe(1);
  });

  it("applies the sheet filter", () => {
    const view = toComparisonView(CHANGE_SET, { sheetId: 2, nature: "all" });
    expect(view.rows).toHaveLength(0);
    expect(view.summary.inputsModified).toBe(1);
  });

  it("applies the nature filter", () => {
    const view = toComparisonView(CHANGE_SET, { sheetId: "all", nature: "consequence" });
    expect(view.rows).toHaveLength(0);
  });
});

describe("toVersionSummaries", () => {
  it("counts the origins of a version", () => {
    const summaries = toVersionSummaries([
      {
        id: "abc",
        note: "Combined Paul and Marie",
        author: "Nadia",
        timestamp: 1_700_000_000_000,
        parents: ["one", "two"],
        scenario: "Reference",
        milestone: "Budget voted",
      },
    ]);
    expect(summaries[0]).toMatchObject({ id: "abc", parents: 2, milestone: "Budget voted" });
  });
});

const PLAN: MergePlan = {
  carrier: "A",
  patches: [{ sheetId: 1, ref: "B2", record: cell("B2", "950"), source: "B" }],
  disagreements: [
    {
      id: "d1",
      sheetId: 1,
      ref: "B5",
      base: cell("B5", "60000"),
      a: cell("B5", "61000"),
      b: cell("B5", "62000"),
    },
  ],
  fallbacks: [],
  report: [{ category: "applied", side: "B", sheetName: "Budget", ref: "B2", label: "950" }],
};

describe("toCombineView", () => {
  const names = new Map<number, string>([[1, "Budget"]]);

  it("labels patches and disagreements with sheet names", () => {
    const view = toCombineView(PLAN, names, {}, []);
    expect(view.automatic[0]).toMatchObject({ sheetName: "Budget", ref: "B2", value: "950", source: "B" });
    expect(view.disagreements[0]).toMatchObject({
      id: "d1",
      sheetName: "Budget",
      base: "60000",
      a: "61000",
      b: "62000",
    });
  });

  it("is not ready while a disagreement is open", () => {
    expect(toCombineView(PLAN, names, {}, []).ready).toBe(false);
    expect(toCombineView(PLAN, names, { d1: { id: "d1", pick: "A" } }, []).ready).toBe(true);
  });

  it("prefers the resolved report once the combine is done", () => {
    const view = toCombineView(PLAN, names, { d1: { id: "d1", pick: "B" } }, [
      { category: "decided", side: "B", sheetName: "Budget", ref: "B5", label: "62000" },
    ]);
    expect(view.report).toHaveLength(1);
    expect(view.report[0]?.category).toBe("decided");
  });
});
