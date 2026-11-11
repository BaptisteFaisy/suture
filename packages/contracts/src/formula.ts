/**
 * Formula handling contract — A1 ↔ R1C1 conversion and reference shifting.
 * See spec `.kiro/specs/formula-r1c1`.
 */

/** 1-based cell position. */
export interface CellPos {
  row: number;
  col: number;
}

/** Something the converter could not translate faithfully. */
export interface FormulaIssue {
  code: "unsupported-syntax" | "external-reference" | "needs-review";
  message: string;
}

/** Conversion result: the (possibly unchanged) formula plus any issues. */
export interface FormulaConversion {
  /** Converted formula, or the original text when conversion failed. */
  formula: string;
  issues: FormulaIssue[];
}

/**
 * Public API implemented by `@suture/formula`.
 * Rule: defined names, structured table references and cross-workbook
 * references are left as-is (no issue, no rewrite).
 */
export interface FormulaCodec {
  /** Parses "B14" or "$B$14" into a position (absolute markers ignored here). */
  parseRef(ref: string): CellPos;
  /** Formats a position as an A1 address without absolute markers. */
  formatRef(pos: CellPos): string;
  /** A1 → R1C1, relative to `origin` (the cell holding the formula). */
  a1ToR1c1(formula: string, origin: CellPos): FormulaConversion;
  /** R1C1 → A1, relative to `origin` (the target cell in the carrier). */
  r1c1ToA1(formula: string, origin: CellPos): FormulaConversion;
  /** Translates an A1 formula by (dRow, dCol); used to expand shared formulas. */
  shiftA1(formula: string, dRow: number, dCol: number): FormulaConversion;
}
