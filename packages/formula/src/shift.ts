import type { FormulaConversion, FormulaIssue } from "@suture/contracts";
import { externalIssue } from "./a1-r1c1";
import { syntaxIssues } from "./guard";
import { protect, restore } from "./protect";
import { numberToColumn } from "./refs";
import { replaceRefs, type RefMatch } from "./scan";

/** Renders a reference shifted by (dRow, dCol); absolute parts never move. */
export function shiftRef(match: RefMatch, dRow: number, dCol: number, issues: FormulaIssue[]): string {
  const rawRow = match.row + dRow;
  const rawCol = match.col + dCol;
  const row = match.rowAbsolute ? match.row : Math.max(1, rawRow);
  const col = match.colAbsolute ? match.col : Math.max(1, rawCol);
  if (!match.rowAbsolute && rawRow < 1) {
    issues.push({
      code: "needs-review",
      message: `A relative row reference moved above row 1 (row ${rawRow}); kept at row 1.`,
    });
  }
  if (!match.colAbsolute && rawCol < 1) {
    issues.push({
      code: "needs-review",
      message: `A relative column reference moved before column A (column ${rawCol}); kept at column A.`,
    });
  }
  const colText = `${match.colAbsolute ? "$" : ""}${numberToColumn(col)}`;
  return `${colText}${match.rowAbsolute ? "$" : ""}${row}`;
}

/**
 * Translates an A1 formula by (dRow, dCol). This is what expands a shared
 * formula: the master `=SUM(B2:B13)` shared over B2:B13 gives `=SUM(B1:B12)`
 * in B2. Absolute references never move.
 */
export function shiftA1(formula: string, dRow: number, dCol: number): FormulaConversion {
  const issues = syntaxIssues(formula);
  if (issues.length > 0) {
    return { formula, issues };
  }
  const guarded = protect(formula);
  if (guarded.hasExternal) {
    issues.push(externalIssue());
  }
  const shifted = replaceRefs(guarded.text, (match) => shiftRef(match, dRow, dCol, issues));
  return { formula: restore({ ...guarded, text: shifted }), issues };
}
