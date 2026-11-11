/**
 * Test codec for `@suture/canonical`.
 *
 * Prefers the real codec exposed by `@suture/formula`; falls back to a small
 * deterministic A1 ↔ L1C1 translator for the canonical unit tests so they can
 * run before that package lands.
 */
import { resolveFormulaCodec, type FormulaCodec } from "../src/formula-codec";
import { columnLetters } from "../src/refs";

/** Creates the codec used by the tests. */
export function createTestFormulaCodec(): FormulaCodec {
  try {
    return resolveFormulaCodec();
  } catch {
    return fallbackCodec();
  }
}

/** Minimal A1 ↔ L1C1 translator, for tests only. */
function fallbackCodec(): FormulaCodec {
  return {
    a1ToR1c1(formula, origin) {
      return { formula: translateA1ToR1c1(formula, origin), needsCheck: false };
    },
    shiftA1(formula, dRow, dCol) {
      return { formula: shiftA1Formula(formula, dRow, dCol), needsCheck: false };
    },
  };
}

/** Translates an A1 formula to L1C1 relative to `origin`. */
function translateA1ToR1c1(formula: string, origin: { row: number; col: number }): string {
  return formula.replace(
    /(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]*)/g,
    (_all, colDollar, colLetters, rowDollar, rowDigits) => {
      const isColAbs = colDollar === "$";
      const isRowAbs = rowDollar === "$";
      const row = Number(rowDigits);
      const col = lettersToCol(colLetters);
      const rowPart = isRowAbs ? `R${row}` : row === origin.row ? "R" : `R[${row - origin.row}]`;
      const colPart = isColAbs ? `C${col}` : col === origin.col ? "C" : `C[${col - origin.col}]`;
      return `${rowPart}${colPart}`;
    },
  );
}

/** Translates an A1 formula by (dRow, dCol). */
function shiftA1Formula(formula: string, dRow: number, dCol: number): string {
  return formula.replace(
    /(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]*)/g,
    (_all, colDollar, colLetters, rowDollar, rowDigits) => {
      const isColAbs = colDollar === "$";
      const isRowAbs = rowDollar === "$";
      const row = Number(rowDigits);
      const col = lettersToCol(colLetters);
      const targetRow = isRowAbs ? row : row + dRow;
      const targetCol = isColAbs ? col : col + dCol;
      return `${colDollar}${columnLetters(targetCol)}${rowDollar}${targetRow}`;
    },
  );
}

/** Converts column letters to 1-based column index. */
function lettersToCol(letters: string): number {
  let col = 0;
  for (const letter of letters.toUpperCase()) {
    col = col * 26 + (letter.charCodeAt(0) - 64);
  }
  return col;
}
