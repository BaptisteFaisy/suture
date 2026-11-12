/**
 * Bridge to `@suture/formula` — A1 ↔ L1C1 conversion and reference shifting.
 */
import type { CellPos } from "@suture/contracts";
import { a1ToR1c1, shiftA1 } from "@suture/formula";

/** Result of a formula conversion. */
export interface ConversionResult {
  formula: string;
  /** True when the codec flagged an issue (kept as-is for review). */
  needsCheck: boolean;
}

/** The two formula operations the canonical derivation needs. */
export interface FormulaCodec {
  a1ToR1c1(formula: string, origin: CellPos): ConversionResult;
  shiftA1(formula: string, dRow: number, dCol: number): ConversionResult;
}

/** Default codec backed directly by `@suture/formula`. */
export const defaultFormulaCodec: FormulaCodec = {
  a1ToR1c1(formula, origin) {
    const result = a1ToR1c1(formula, origin);
    return { formula: result.formula, needsCheck: result.issues.length > 0 };
  },
  shiftA1(formula, dRow, dCol) {
    const result = shiftA1(formula, dRow, dCol);
    return { formula: result.formula, needsCheck: result.issues.length > 0 };
  },
};

/** Returns the `@suture/formula` codec. */
export function resolveFormulaCodec(): FormulaCodec {
  return defaultFormulaCodec;
}
