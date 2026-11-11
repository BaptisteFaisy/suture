import { describe, expect, it } from "vitest";
import { cell, sheet, workbook } from "../test/generators";
import { planMerge, resolveMerge } from "../src";

/** A sheet with two rows of values. */
function budget(cells: { ref: string; input: string }[]): ReturnType<typeof workbook> {
  return workbook(sheet(1, "Budget", cells.map((item) => cell(item.ref, item.input))));
}

describe("case 2 — one side changed the structure", () => {
  const origin = budget([
    { ref: "A1", input: "Rent" },
    { ref: "B1", input: "1000" },
    { ref: "A2", input: "Energy" },
    { ref: "B2", input: "200" },
  ]);

  it("carries the other side's change onto the carrier's row", () => {
    // Marie inserted a row above: her file has one more line.
    const marie = budget([
      { ref: "A1", input: "Rent" },
      { ref: "B1", input: "1000" },
      { ref: "A2", input: "Travel" },
      { ref: "B2", input: "50" },
      { ref: "A3", input: "Energy" },
      { ref: "B3", input: "200" },
    ]);
    // Paul changed the energy amount, on the original row numbering.
    const paul = budget([
      { ref: "A1", input: "Rent" },
      { ref: "B1", input: "1000" },
      { ref: "A2", input: "Energy" },
      { ref: "B2", input: "240" },
    ]);

    const plan = planMerge(origin, paul, marie);
    // The carrier is the side that inserted a row: Marie's file.
    expect(plan.carrier).toBe("B");
    expect(plan.disagreements).toHaveLength(0);
    // Paul's change lands on the energy row of the carrier (row 3 now).
    const patch = plan.patches.find((item) => item.record?.input === "240");
    expect(patch?.ref).toBe("B3");
  });

  it("lists the carrier's structural change in the report", () => {
    // Only Marie inserted a row: the carrier is her file, and the row she
    // added is part of it — the report says so.
    const marie = budget([
      { ref: "A1", input: "Rent" },
      { ref: "B1", input: "1000" },
      { ref: "A2", input: "Travel" },
      { ref: "B2", input: "50" },
      { ref: "A3", input: "Energy" },
      { ref: "B3", input: "200" },
    ]);
    const plan = planMerge(origin, origin, marie);
    expect(plan.carrier).toBe("B");
    expect(plan.fallbacks).toHaveLength(0);
    expect(plan.report.some((entry) => entry.label.includes("Row"))).toBe(true);
  });
});

describe("case 4 — both sides changed the structure differently", () => {
  it("refuses to merge that sheet automatically", () => {
    const origin = budget([
      { ref: "A1", input: "Rent" },
      { ref: "A2", input: "Energy" },
    ]);
    const left = budget([
      { ref: "A1", input: "Rent" },
      { ref: "A2", input: "Travel" },
      { ref: "A3", input: "Energy" },
    ]);
    const right = budget([
      { ref: "A1", input: "Rent" },
      { ref: "A2", input: "Energy" },
      { ref: "A3", input: "Travel" },
    ]);
    const plan = planMerge(origin, left, right);
    expect(plan.fallbacks.length).toBeGreaterThan(0);
    expect(plan.fallbacks[0]?.reason).toBe("structure-divergence");
    expect(plan.report.some((entry) => entry.category === "not-carried")).toBe(true);
  });
});

describe("disagreements", () => {
  const origin = budget([
    { ref: "A1", input: "Rent" },
    { ref: "B1", input: "60000" },
  ]);

  const paul = budget([
    { ref: "A1", input: "Rent" },
    { ref: "B1", input: "61000" },
  ]);
  const marie = budget([
    { ref: "A1", input: "Rent" },
    { ref: "B1", input: "62000" },
  ]);

  it("asks the user when both sides changed the same amount", () => {
    const plan = planMerge(origin, paul, marie);
    expect(plan.disagreements).toHaveLength(1);
    const item = plan.disagreements[0];
    expect(item?.base?.input).toBe("60000");
    expect(item?.a?.input).toBe("61000");
    expect(item?.b?.input).toBe("62000");

    const resolved = resolveMerge(plan, [{ id: item?.id ?? "", pick: "B" }]);
    expect(resolved.patches).toHaveLength(1);
    expect(resolved.patches[0]?.record?.input).toBe("62000");
    expect(resolved.report.some((entry) => entry.category === "decided")).toBe(true);
  });

  it("refuses to resolve while a disagreement is open", () => {
    const plan = planMerge(origin, paul, marie);
    expect(() => resolveMerge(plan, [])).toThrow();
  });

  it("accepts a value typed by the user", () => {
    const plan = planMerge(origin, paul, marie);
    const item = plan.disagreements[0];
    const resolved = resolveMerge(plan, [
      { id: item?.id ?? "", pick: "custom", record: cell("B1", "61500") },
    ]);
    expect(resolved.patches[0]?.record?.input).toBe("61500");
  });
});
