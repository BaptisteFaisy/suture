import { describe, expect, it } from "vitest";
import type { CanonicalSheet, CanonicalWorkbook, CellRecord } from "@suture/contracts";
import { planMerge, resolveMerge } from "../src";

function cell(ref: string, input: string): CellRecord {
  return { ref, kind: "n", input, cached: "", fmt: "" };
}

function sheet(sheetId: number, name: string, cells: CellRecord[]): CanonicalSheet {
  return {
    meta: { sheetId, name, order: 0, state: "visible", path: `xl/worksheets/sheet${sheetId}.xml` },
    cells,
  };
}

function workbook(...sheets: CanonicalSheet[]): CanonicalWorkbook {
  return { meta: { sheets: sheets.map((s) => s.meta), definedNames: [] }, sheets };
}

describe("three-way combine (B.8)", () => {
  const origin = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1000")]));

  it("applies changes from one side without competition", () => {
    const a = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1000")]));
    const b = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1200")]));
    const plan = planMerge(origin, a, b);
    expect(plan.disagreements).toHaveLength(0);
    expect(plan.patches).toHaveLength(1);
    expect(plan.patches[0]).toMatchObject({ ref: "B1", record: { input: "1200" }, source: "B" });
  });

  it("detects disagreements when both sides change the same cell differently", () => {
    const a = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1100")]));
    const b = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1200")]));
    const plan = planMerge(origin, a, b);
    expect(plan.disagreements).toHaveLength(1);
    expect(plan.disagreements[0]).toMatchObject({
      ref: "B1",
      base: { input: "1000" },
      a: { input: "1100" },
      b: { input: "1200" },
    });
  });

  it("produces no disagreement when both sides typed the same change", () => {
    const a = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1200")]));
    const b = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1200")]));
    const plan = planMerge(origin, a, b);
    expect(plan.disagreements).toHaveLength(0);
  });

  it("refuses resolution when an open disagreement has no answer", () => {
    const a = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1100")]));
    const b = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1200")]));
    const plan = planMerge(origin, a, b);
    expect(() => resolveMerge(plan, [])).toThrow();
  });

  it("resolves a disagreement when the user chooses", () => {
    const a = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1100")]));
    const b = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1200")]));
    const plan = planMerge(origin, a, b);
    const resolved = resolveMerge(plan, [{ id: plan.disagreements[0]!.id, pick: "B" }]);
    expect(resolved.patches).toHaveLength(1);
    expect(resolved.patches[0]?.record?.input).toBe("1200");
  });
});
