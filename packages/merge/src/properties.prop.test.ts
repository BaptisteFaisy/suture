import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { CanonicalWorkbook, MergePlan } from "@suture/contracts";
import { disjointSidesArb, editedPairArb, twoSidesArb } from "../test/generators";
import { planMerge } from "../src";

/** Cell values of a workbook, keyed by "sheetId:ref". */
function valuesOf(workbook: CanonicalWorkbook): Map<string, string> {
  const values = new Map<string, string>();
  for (const sheet of workbook.sheets) {
    for (const cell of sheet.cells) {
      values.set(`${sheet.meta.sheetId}:${cell.ref}`, cell.input);
    }
  }
  return values;
}

/** Cell values of the carrier once the plan's automatic patches are applied. */
function applyPatches(carrier: CanonicalWorkbook, plan: MergePlan): Map<string, string> {
  const values = valuesOf(carrier);
  for (const patch of plan.patches) {
    const key = `${patch.sheetId}:${patch.ref}`;
    if (patch.record === null) values.delete(key);
    else values.set(key, patch.record.input);
  }
  return values;
}

describe("SUT-P-06 — combining with the origin on one side", () => {
  it("combine(O, A, O) leaves A untouched", () => {
    fc.assert(
      fc.property(editedPairArb, ({ origin, edited }) => {
        const plan = planMerge(origin, edited, origin);
        expect(plan.disagreements).toHaveLength(0);
        expect(plan.patches).toHaveLength(0);
        const carrier = plan.carrier === "A" ? edited : origin;
        expect(applyPatches(carrier, plan)).toEqual(valuesOf(edited));
      }),
      { numRuns: 80 },
    );
  });

  it("combine(O, O, B) reproduces B on the carrier", () => {
    fc.assert(
      fc.property(editedPairArb, ({ origin, edited }) => {
        const plan = planMerge(origin, origin, edited);
        expect(plan.disagreements).toHaveLength(0);
        // The carrier is the side whose file is patched: whichever the plan
        // chose, the result must be the edited workbook.
        const carrier = plan.carrier === "A" ? origin : edited;
        expect(applyPatches(carrier, plan)).toEqual(valuesOf(edited));
      }),
      { numRuns: 80 },
    );
  });

  it("combine(O, X, X) needs no patch and no decision", () => {
    fc.assert(
      fc.property(editedPairArb, ({ origin, edited }) => {
        const plan = planMerge(origin, edited, edited);
        expect(plan.disagreements).toHaveLength(0);
        expect(plan.patches).toHaveLength(0);
      }),
      { numRuns: 80 },
    );
  });
});

describe("SUT-P-07 — disjoint changes never disagree", () => {
  it("produces no disagreement when both sides touch different cells", () => {
    fc.assert(
      fc.property(disjointSidesArb, ({ origin, a, b }) => {
        const plan = planMerge(origin, a, b);
        expect(plan.disagreements).toHaveLength(0);
      }),
      { numRuns: 80 },
    );
  });
});

describe("SUT-P-08 — nothing is lost silently", () => {
  it("accounts for every change the other side brought", () => {
    fc.assert(
      fc.property(twoSidesArb, ({ origin, a, b }) => {
        const plan = planMerge(origin, a, b);
        const other = plan.carrier === "A" ? b : a;
        const sheetId = other.sheets[0]?.meta.sheetId ?? 1;
        const name = other.sheets[0]?.meta.name ?? "Budget";

        const changes = changesOf(origin, other, sheetId);
        if (changes === 0) return;

        const patches = plan.patches.filter((item) => item.sheetId === sheetId).length;
        const decisions = plan.disagreements.filter((item) => item.sheetId === sheetId).length;
        const reported = plan.report.filter(
          (entry) => entry.sheetName === name && entry.ref !== undefined,
        ).length;
        const sheetReported = plan.report.some(
          (entry) => entry.sheetName === name && entry.ref === undefined,
        );
        const fallback = plan.fallbacks.some((item) => item.sheetId === sheetId);
        if (fallback || sheetReported) return;
        expect(patches + decisions + reported).toBeGreaterThanOrEqual(changes);
      }),
      { numRuns: 80 },
    );
  });
});

/** Number of cell changes between two workbooks, for one sheet. */
function changesOf(
  origin: CanonicalWorkbook,
  other: CanonicalWorkbook,
  sheetId: number,
): number {
  const base = valuesOf(origin);
  const next = valuesOf(other);
  let count = 0;
  for (const [key, value] of next) {
    if (key.startsWith(`${sheetId}:`) && (base.get(key) ?? "") !== value) count += 1;
  }
  for (const [key] of base) {
    if (key.startsWith(`${sheetId}:`) && !next.has(key)) count += 1;
  }
  return count;
}

describe("SUT-P-09 — symmetry of the combine", () => {
  it("gives the same disagreements, with their sides swapped (B.13)", () => {
    fc.assert(
      fc.property(twoSidesArb, ({ origin, a, b }) => {
        const forward = planMerge(origin, a, b);
        const backward = planMerge(origin, b, a);
        const refs = (plan: MergePlan) =>
          plan.disagreements.map((item) => `${item.sheetId}:${item.ref}`).sort();
        expect(refs(backward)).toEqual(refs(forward));

        const backMap = new Map(backward.disagreements.map((d) => [`${d.sheetId}:${d.ref}`, d]));
        for (const d of forward.disagreements) {
          const mirror = backMap.get(`${d.sheetId}:${d.ref}`);
          expect(mirror).toBeDefined();
          expect(mirror?.a?.input ?? "").toBe(d.b?.input ?? "");
          expect(mirror?.b?.input ?? "").toBe(d.a?.input ?? "");
          expect(mirror?.base?.input ?? "").toBe(d.base?.input ?? "");
        }
      }),
      { numRuns: 80 },
    );
  });
});
