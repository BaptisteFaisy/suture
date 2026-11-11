/**
 * Spec vs "vibe coding" — the measured comparison the submission asks for.
 *
 * Two implementations of the same function (A1 → R1C1, the conversion the
 * canonical cell view depends on):
 *
 *  - `spec`: the one in `packages/formula`, written against the acceptance
 *    criteria of `.kiro/specs/formula-r1c1/requirements.md`, with fast-check
 *    as the oracle (property SUT-P-03).
 *  - `vibe`: the version below, written from the prose of the brief alone
 *    ("convert relative references to R1C1"), without reading the spec's
 *    criteria list.
 *
 * Both are run against the SAME generated corpus. This test documents the
 * result: the prose-only version breaks on the cases the spec enumerated.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { a1ToR1c1, r1c1ToA1 } from "../../packages/formula/src/index";

/** The "vibe coded" converter: a single regex over the whole formula. */
export function vibeA1ToR1c1(formula: string, origin: { row: number; col: number }): string {
  const colToNum = (letters: string) =>
    letters.split("").reduce((total, ch) => total * 26 + (ch.charCodeAt(0) - 64), 0);
  return formula.replace(
    /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g,
    (_whole, dollarCol: string, letters: string, dollarRow: string, row: string) => {
      const col = colToNum(letters);
      const rowNumber = Number(row);
      const rowPart = dollarRow === "$" ? `R${rowNumber}` : `R[${rowNumber - origin.row}]`;
      const colPart = dollarCol === "$" ? `C${col}` : `C[${col - origin.col}]`;
      return rowPart + colPart;
    },
  );
}

/** Its inverse, written the same way. */
export function vibeR1c1ToA1(formula: string, origin: { row: number; col: number }): string {
  const numToCol = (num: number) => {
    let rest = num;
    let out = "";
    while (rest > 0) {
      const digit = (rest - 1) % 26;
      out = String.fromCharCode(65 + digit) + out;
      rest = Math.floor((rest - 1) / 26);
    }
    return out;
  };
  return formula.replace(
    /R(\[(-?\d+)\]|(\d+))?C(\[(-?\d+)\]|(\d+))?/g,
    (_w, _r, rRel, rAbs, _c, cRel, cAbs) => {
      const row = rAbs !== undefined ? Number(rAbs) : origin.row + Number(rRel ?? 0);
      const col = cAbs !== undefined ? Number(cAbs) : origin.col + Number(cRel ?? 0);
      return `${numToCol(col)}${row}`;
    },
  );
}

/** The corpus both implementations are measured on. */
const corpus = fc.oneof(
  fc.constant("=SUM(B2:B13)"),
  fc.constant('="Total: "&A1'),
  fc.constant("=Tax_Rate*B2"),
  fc.constant("=SUM(Table1[Amount])"),
  fc.constant("=LOG10(A1)"),
  fc.constant("=Sheet2!B5"),
  fc.constant("='[Book1.xlsx]Sheet1'!A1"),
  fc.constant("=$B$2+B3"),
  fc.constant("=IF(A1>0,B1,C1)"),
);

const origins = fc.record({ row: fc.integer({ min: 1, max: 20 }), col: fc.integer({ min: 1, max: 8 }) });

function failures(
  forward: (formula: string, origin: { row: number; col: number }) => string,
  backward: (formula: string, origin: { row: number; col: number }) => string,
): { count: number; examples: string[] } {
  let count = 0;
  const examples: string[] = [];
  fc.assert(
    fc.property(corpus, origins, (formula, origin) => {
      const round = backward(forward(formula, origin), origin);
      if (round !== formula) {
        count += 1;
        if (examples.length < 5) examples.push(`${formula} -> ${forward(formula, origin)}`);
      }
      return true;
    }),
    { numRuns: 400 },
  );
  return { count, examples };
}

describe("spec vs vibe coding (formula-r1c1)", () => {
  it("the spec-driven implementation round-trips the whole corpus", () => {
    const result = failures(
      (formula, origin) => a1ToR1c1(formula, origin).formula,
      (formula, origin) => r1c1ToA1(formula, origin).formula,
    );
    expect(result.examples).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("the prose-only implementation breaks on the cases the spec enumerated", () => {
    const result = failures(vibeA1ToR1c1, vibeR1c1ToA1);
    // Documented, not asserted as a fixed number: the point is that the
    // spec's criteria list (strings, defined names, structured references,
    // external workbooks, function names) is what the prose omitted.
    expect(result.count).toBeGreaterThan(0);
    console.log(
      `spec vs vibe coding — "vibe" : ${result.count} contre-exemples / 400 tirages ; exemples : ${result.examples.join(" | ")}`,
    );
  });
});
