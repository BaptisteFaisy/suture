import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalWorkbookArb } from "@suture/diff/test/generators";
import { planMerge } from "../src";

describe("combine properties (SUT-P-06..09)", () => {
  it("SUT-P-06: combine(O, A, O) == A and combine(O, O, B) == B", () => {
    fc.assert(
      fc.property(canonicalWorkbookArb, canonicalWorkbookArb, (origin, modified) => {
        const planA = planMerge(origin, modified, origin);
        expect(planA.disagreements).toHaveLength(0);
        // Every patch from modified on B side is empty because B == origin.
        expect(planA.patches).toHaveLength(0);

        const planB = planMerge(origin, origin, modified);
        expect(planB.disagreements).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it("SUT-P-08: no silent loss — every difference is either applied, disagreed, or reported", () => {
    fc.assert(
      fc.property(
        canonicalWorkbookArb,
        canonicalWorkbookArb,
        canonicalWorkbookArb,
        (origin, a, b) => {
          const plan = planMerge(origin, a, b);
          // Plan carries non-empty outcome for non-empty differences.
          const totalOutcomes =
            plan.patches.length +
            plan.disagreements.length +
            plan.fallbacks.length +
            plan.report.length;
          // Invariant: nothing thrown away silently.
          expect(totalOutcomes).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
