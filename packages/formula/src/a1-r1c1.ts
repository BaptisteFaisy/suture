import type { CellPos, FormulaConversion, FormulaIssue } from "@suture/contracts";
import { syntaxIssues } from "./guard";
import { protect, restore } from "./protect";
import { replaceRefs, type RefMatch } from "./scan";

/** Renders one reference in R1C1 notation, relative to `origin`. */
export function refToR1c1(match: RefMatch, origin: CellPos): string {
  const row = match.rowAbsolute ? `R${match.row}` : offset("R", match.row - origin.row);
  const col = match.colAbsolute ? `C${match.col}` : offset("C", match.col - origin.col);
  return row + col;
}

/** Zero offset renders as a bare letter (Excel's convention): R, C, RC. */
function offset(letter: string, value: number): string {
  return value === 0 ? letter : `${letter}[${value}]`;
}

export function externalIssue(): FormulaIssue {
  return {
    code: "external-reference",
    message: "A reference to another workbook is kept exactly as it is.",
  };
}

/**
 * Converts an A1 formula to R1C1, relative to the cell that holds it.
 * `=SUM(B2:B13)` written in B14 becomes `=SUM(R[-12]C:R[-1]C)`.
 * String literals, quoted sheet names, external workbooks and structured
 * table references are never rewritten.
 */
export function a1ToR1c1(formula: string, origin: CellPos): FormulaConversion {
  const issues = syntaxIssues(formula);
  if (issues.length > 0) {
    return { formula, issues };
  }
  const guarded = protect(formula);
  if (guarded.hasExternal) {
    issues.push(externalIssue());
  }
  const converted = replaceRefs(guarded.text, (match) => refToR1c1(match, origin));
  return { formula: restore({ ...guarded, text: converted }), issues };
}
