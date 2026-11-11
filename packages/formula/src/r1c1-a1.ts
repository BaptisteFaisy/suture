import type { CellPos, FormulaConversion, FormulaIssue } from "@suture/contracts";
import { externalIssue } from "./a1-r1c1";
import { syntaxIssues } from "./guard";
import { protect, restore } from "./protect";
import { numberToColumn } from "./refs";
import { replaceR1c1, type R1c1Match } from "./scan";

/** Renders one R1C1 reference back to A1, at the position it lands on. */
export function r1c1ToRef(match: R1c1Match, origin: CellPos, issues: FormulaIssue[]): string {
  const rawRow = match.row.absolute ? match.row.value : origin.row + match.row.value;
  const rawCol = match.col.absolute ? match.col.value : origin.col + match.col.value;
  if (rawRow < 1 || rawCol < 1) {
    issues.push({
      code: "needs-review",
      message: `A reference lands outside the sheet (row ${rawRow}, column ${rawCol}); kept at the edge.`,
    });
  }
  const row = Math.max(1, rawRow);
  const col = Math.max(1, rawCol);
  const colText = `${match.col.absolute ? "$" : ""}${numberToColumn(col)}`;
  return `${colText}${match.row.absolute ? "$" : ""}${row}`;
}

/**
 * Converts an R1C1 formula back to A1 at the target position. Relative
 * references are re-based on that position, which is what makes carrying a
 * formula into another row or column correct.
 */
export function r1c1ToA1(formula: string, origin: CellPos): FormulaConversion {
  const issues = syntaxIssues(formula);
  if (issues.length > 0) {
    return { formula, issues };
  }
  const guarded = protect(formula);
  if (guarded.hasExternal) {
    issues.push(externalIssue());
  }
  const converted = replaceR1c1(
    guarded.text,
    (match, position) => r1c1ToRef(match, position, issues),
    origin,
  );
  return { formula: restore({ ...guarded, text: converted }), issues };
}
