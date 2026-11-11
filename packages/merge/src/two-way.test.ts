import { describe, expect, it } from "vitest";
import type { DisagreementChoice } from "@suture/contracts";
import { cell, sheet, workbook } from "../test/generators";
import { planTwoWay, resolveMerge } from "../src";

/** The carrier of a two-way plan is always side A: nothing arbitrates. */
const budgetA = workbook(
  sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1000"), cell("A2", "Energy")]),
);

/** The same budget, with an amount on the second row. */
const budgetAmounts = workbook(
  sheet(1, "Budget", [
    cell("A1", "Rent"),
    cell("B1", "1000"),
    cell("A2", "Energy"),
    cell("B2", "200"),
  ]),
);

/** Side B retyped the amount and the label of the second row. */
const budgetEdited = workbook(
  sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1200"), cell("A2", "Gas")]),
);

/** Side B inserted a travel row above the energy row. */
const budgetExtraRow = workbook(
  sheet(1, "Budget", [
    cell("A1", "Rent"),
    cell("B1", "1000"),
    cell("A2", "Travel"),
    cell("B2", "50"),
    cell("A3", "Energy"),
    cell("B3", "1000"),
  ]),
);

describe("SUT-F-24 — every difference is decided by hand", () => {
  it("carries side A and applies nothing by itself", () => {
    const plan = planTwoWay(budgetA, budgetEdited);
    expect(plan.carrier).toBe("A");
    expect(plan.patches).toHaveLength(0);
    expect(plan.fallbacks).toHaveLength(0);
  });

  it("turns every cell difference into a decision with a null base", () => {
    const plan = planTwoWay(budgetA, budgetEdited);
    expect(plan.disagreements).toHaveLength(2);
    expect(plan.disagreements.find((item) => item.ref === "B1")).toMatchObject({
      id: "1:B1",
      sheetId: 1,
      ref: "B1",
      base: null,
      a: { input: "1000" },
      b: { input: "1200" },
    });
    // The identifiers are stable: one per address of the carried file.
    expect(plan.disagreements.map((item) => item.id).sort()).toEqual(["1:A2", "1:B1"]);
  });

  it("decides a cell one side holds and the other does not", () => {
    const plan = planTwoWay(budgetAmounts, budgetA);
    expect(plan.disagreements).toHaveLength(1);
    expect(plan.disagreements[0]).toMatchObject({
      id: "1:B2",
      ref: "B2",
      base: null,
      a: { input: "200" },
      b: null,
    });
  });

  it("produces an empty plan when the two files do not differ", () => {
    const plan = planTwoWay(budgetA, budgetA);
    expect(plan.disagreements).toHaveLength(0);
    expect(plan.patches).toHaveLength(0);
    expect(plan.report).toHaveLength(0);
  });
});

describe("SUT-F-24 — what cannot be decided is reported, never lost", () => {
  it("reports a sheet only one side has", () => {
    const withTravel = workbook(
      sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1000"), cell("A2", "Energy")]),
      sheet(2, "Travel", [cell("A1", "Train"), cell("B1", "90")]),
    );
    const plan = planTwoWay(budgetA, withTravel);
    expect(plan.disagreements).toHaveLength(0);
    expect(plan.report.find((item) => item.sheetName === "Travel")).toMatchObject({
      category: "not-carried",
      side: "B",
    });
    // The other way round: the carrier keeps its own sheet and says so.
    const reversed = planTwoWay(withTravel, budgetA);
    expect(reversed.report.find((item) => item.sheetName === "Travel")).toMatchObject({
      category: "applied",
      side: "A",
    });
  });

  it("reports a row one side inserted and decides the rest by hand", () => {
    const plan = planTwoWay(budgetAmounts, budgetExtraRow);
    const rows = plan.report.filter((item) => item.label.startsWith("Row"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: "not-carried", side: "B" });
    // The energy amount differs on the row both files have: a decision.
    const amount = plan.disagreements.find((item) => item.ref === "B2");
    expect(amount).toMatchObject({ base: null, a: { input: "200" }, b: { input: "50" } });
  });

  it("reports a defined name that differs (non-cell part)", () => {
    const withName = workbook(sheet(1, "Budget", [cell("A1", "Rent")]));
    withName.meta.definedNames = [{ name: "Tax", formula: "Budget!$B$1" }];
    const plan = planTwoWay(workbook(sheet(1, "Budget", [cell("A1", "Rent")])), withName);
    expect(plan.disagreements).toHaveLength(0);
    expect(plan.report.some((item) => item.label.includes("Tax"))).toBe(true);
  });

  it("pairs unrelated files by sheet name and keeps the carrier's sheet ids", () => {
    // Two histories that never met: the sheet identifiers need not agree.
    const a = workbook(sheet(1, "Budget", [cell("A1", "Rent"), cell("B1", "1000")]));
    const b = workbook(sheet(7, "Budget", [cell("A1", "Rent"), cell("B1", "1200")]));
    const plan = planTwoWay(a, b);
    expect(plan.disagreements).toHaveLength(1);
    // The decision is written into the carried file, at its own sheet id.
    expect(plan.disagreements[0]).toMatchObject({ id: "1:B1", sheetId: 1, ref: "B1" });
  });
});

describe("SUT-F-24 — the existing resolver consumes the two-way plan", () => {
  it("refuses to save while a decision is open", () => {
    expect(() => resolveMerge(planTwoWay(budgetA, budgetEdited), [])).toThrow(/still open/);
  });

  it("applies the decisions as patches on the carrier", () => {
    const choices: DisagreementChoice[] = [
      { id: "1:B1", pick: "B" },
      { id: "1:A2", pick: "A" },
    ];
    const resolved = resolveMerge(planTwoWay(budgetA, budgetEdited), choices);
    expect(resolved.patches).toHaveLength(2);
    expect(resolved.patches.find((item) => item.ref === "B1")).toMatchObject({
      record: { input: "1200" },
      source: "B",
    });
    expect(resolved.patches.find((item) => item.ref === "A2")).toMatchObject({
      record: { input: "Energy" },
      source: "A",
    });
    // Every decision is listed in the report of the finished combine.
    expect(resolved.report.filter((item) => item.category === "decided")).toHaveLength(2);
  });
});
