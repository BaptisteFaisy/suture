/**
 * A1 ↔ L1C1 conversion and reference shifting.
 *
 * Fallback used while `@suture/formula` does not expose its codec yet:
 * `resolveFormulaCodec()` prefers the real package and falls back to this
 * module, so the canonical view never waits on a package still in flight.
 *
 * Scope: A1 references (`B14`, `$B$14`, `B$14`, `$B14`) and ranges. Double
 * quoted string literals are copied verbatim; identifiers, function names and
 * defined names are left alone.
 */
import { columnIndexOf, columnLetters, EXCEL_MAX_COL, EXCEL_MAX_ROW } from "./refs";

/** 1-based position of a cell. */
export interface CellPos {
  row: number;
  col: number;
}

/** A1 reference token: optional `$`, 1-3 letters, optional `$`, digits. */
const A1_TOKEN = /(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]*)/g;

/** Rewrites one A1 reference; returns `undefined` to keep it verbatim. */
type Rewriter = (colAbs: boolean, col: number, rowAbs: boolean, row: number) => string | undefined;

/** Converts an A1 formula to L1C1, relative to the cell that holds it. */
export function a1ToR1c1(formula: string, origin: CellPos): string {
  return rewriteOutsideStrings(formula, (colAbs, col, rowAbs, row) => {
    const rowPart = rowAbs ? `R${row}` : row === origin.row ? "R" : `R[${row - origin.row}]`;
    const colPart = colAbs ? `C${col}` : col === origin.col ? "C" : `C[${col - origin.col}]`;
    return `${rowPart}${colPart}`;
  });
}

/** Translates an A1 formula by (dRow, dCol); absolute parts do not move. */
export function shiftA1(formula: string, dRow: number, dCol: number): string {
  return rewriteOutsideStrings(formula, (colAbs, col, rowAbs, row) => {
    const targetCol = colAbs ? col : col + dCol;
    const targetRow = rowAbs ? row : row + dRow;
    if (targetCol < 1 || targetRow < 1) return "#REF!";
    return `${colAbs ? "$" : ""}${columnLetters(targetCol)}${rowAbs ? "$" : ""}${targetRow}`;
  });
}

/** Applies the rewriter to every chunk of the formula outside string literals. */
function rewriteOutsideStrings(formula: string, rewrite: Rewriter): string {
  let output = "";
  let index = 0;
  while (index < formula.length) {
    if (formula[index] === '"') {
      const end = endOfStringLiteral(formula, index);
      output += formula.slice(index, end);
      index = end;
      continue;
    }
    const next = formula.indexOf('"', index);
    const stop = next === -1 ? formula.length : next;
    output += rewriteChunk(formula.slice(index, stop), rewrite);
    index = stop;
  }
  return output;
}

/** Index just after the closing quote of a string literal (`""` escapes). */
function endOfStringLiteral(formula: string, start: number): number {
  let index = start + 1;
  while (index < formula.length) {
    if (formula[index] === '"') {
      if (formula[index + 1] === '"') {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return formula.length;
}

/** Rewrites the A1 references of one quote-free chunk. */
function rewriteChunk(chunk: string, rewrite: Rewriter): string {
  return chunk.replace(A1_TOKEN, (match, colDollar, letters, rowDollar, digits, offset: number) => {
    if (isGluedToIdentifier(chunk, offset, offset + match.length)) return match;
    const col = columnIndexOf(letters);
    const row = Number(digits);
    if (col < 1 || col > EXCEL_MAX_COL || row > EXCEL_MAX_ROW) return match;
    return rewrite(colDollar === "$", col, rowDollar === "$", row) ?? match;
  });
}

/** True when the token belongs to a longer identifier or a function call. */
function isGluedToIdentifier(chunk: string, start: number, end: number): boolean {
  const before = chunk[start - 1] ?? "";
  const after = chunk[end] ?? "";
  return /[A-Za-z0-9_.]/.test(before) || /[A-Za-z0-9_(]/.test(after);
}
