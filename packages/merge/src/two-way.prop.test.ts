import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type {
  CanonicalSheet,
  CanonicalWorkbook,
  CellRecord,
  MergePlan,
  ReportEntry,
} from "@suture/contracts";
import { columnNumberOf, rowNumberOf } from "@suture/diff";
import { cell, sheet, twoSidesArb, workbook } from "../test/generators";
import { planTwoWay } from "../src";

/**
 * Two workbooks with no common origin: the two sides of the shared grid
 * generator, plus — half of the time — a sheet that only side B has, so the
 * property also exercises what cannot become a cell decision.
 */
const noOriginArb: fc.Arbitrary<{ a: CanonicalWorkbook; b: CanonicalWorkbook }> = twoSidesArb.chain(
  ({ a, b }) =>
    fc.boolean().map((withExtraSheet) => ({
      a,
      b: withExtraSheet
        ? workbook(...b.sheets, sheet(2, "Travel", [cell("A1", "Train"), cell("B1", "90")]))
        : b,
    })),
);

/** Number of times one address is accounted for by name in the plan. */
function refAccountings(plan: MergePlan, key: string, sheetName: string, ref: string): number {
  const decisions = plan.disagreements.filter((item) => item.id === key).length;
  const reports = plan.report.filter(
    (entry) => entry.sheetName === sheetName && entry.ref === ref,
  ).length;
  return decisions + reports;
}

/** True when a report line names the row, the column or the whole sheet. */
function coversStructurally(entry: ReportEntry, sheetName: string, ref: string): boolean {
  if (entry.sheetName !== sheetName || entry.ref !== undefined) return false;
  const row = /^Row (\d+) only on this side/.exec(entry.label);
  if (row !== null) return Number(row[1]) === rowNumberOf(ref);
  const column = /^Column (\d+) only on this side/.exec(entry.label);
  if (column !== null) return Number(column[1]) === columnNumberOf(ref);
  return entry.label.startsWith("Sheet only on this side");
}

function coveredStructurally(plan: MergePlan, sheetName: string, ref: string): boolean {
  return plan.report.some((entry) => coversStructurally(entry, sheetName, ref));
}

/** True when both sides hold the same typed value at one address. */
function sameValue(a: CellRecord | null, b: CellRecord | null): boolean {
  if (a === null || b === null) return a === b;
  return a.input === b.input && a.kind === b.kind;
}

function cellsOf(sheet: CanonicalSheet | undefined): Map<string, CellRecord> {
  return new Map((sheet?.cells ?? []).map((item) => [item.ref, item]));
}

/** Every address where the two files differ, accounted for exactly once. */
function expectAccounted(plan: MergePlan, a: CanonicalWorkbook, b: CanonicalWorkbook): void {
  const ids = plan.disagreements.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);

  for (const aSheet of a.sheets) {
    const name = aSheet.meta.name;
    const bSheet = b.sheets.find((item) => item.meta.sheetId === aSheet.meta.sheetId);
    if (bSheet === undefined) {
      // The carrier keeps its own sheet and says so in the report.
      expect(plan.report.some((entry) => entry.sheetName === name)).toBe(true);
      continue;
    }
    const aCells = cellsOf(aSheet);
    const bCells = cellsOf(bSheet);
    for (const ref of new Set([...aCells.keys(), ...bCells.keys()])) {
      if (sameValue(aCells.get(ref) ?? null, bCells.get(ref) ?? null)) continue;
      const key = `${aSheet.meta.sheetId}:${ref}`;
      const named = refAccountings(plan, key, name, ref);
      expect(named + (coveredStructurally(plan, name, ref) ? 1 : 0)).toBeGreaterThanOrEqual(1);
      expect(named).toBeLessThanOrEqual(1);
    }
  }
  for (const bSheet of b.sheets) {
    if (a.sheets.some((item) => item.meta.sheetId === bSheet.meta.sheetId)) continue;
    const name = bSheet.meta.name;
    expect(
      plan.report.some((entry) => entry.sheetName === name && entry.category === "not-carried"),
    ).toBe(true);
  }
}

describe("SUT-F-24 — two-way mode, no silent loss", () => {
  it("accounts for every difference between the two files", () => {
    fc.assert(
      fc.property(noOriginArb, ({ a, b }) => {
        expectAccounted(planTwoWay(a, b), a, b);
      }),
      { numRuns: 120 },
    );
  });

  it("decides nothing when the two files are the same", () => {
    fc.assert(
      fc.property(noOriginArb, ({ a }) => {
        const plan = planTwoWay(a, a);
        expect(plan.carrier).toBe("A");
        expect(plan.disagreements).toHaveLength(0);
        expect(plan.patches).toHaveLength(0);
        expect(plan.report).toHaveLength(0);
      }),
      { numRuns: 120 },
    );
  });

  it("hands every difference to the user: nothing is applied behind their back", () => {
    fc.assert(
      fc.property(noOriginArb, ({ a, b }) => {
        const plan = planTwoWay(a, b);
        expect(plan.patches).toHaveLength(0);
        expect(plan.fallbacks).toHaveLength(0);
        for (const item of plan.disagreements) {
          expect(item.base).toBeNull();
          expect(item.id).toBe(`${item.sheetId}:${item.ref}`);
          expect(sameValue(item.a, item.b)).toBe(false);
        }
      }),
      { numRuns: 120 },
    );
  });
});
