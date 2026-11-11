/**
 * A1 address helpers — parsing, formatting and sorting of cell references.
 *
 * Delegates parsing and formatting to `@suture/formula` so reference rules
 * have one single source of truth across Suture.
 */
import type { CellPos } from "@suture/contracts";
import { columnToNumber, formatRef, parseRefToken } from "@suture/formula";

/** Excel bounds of a worksheet address. */
export const EXCEL_MAX_ROW = 1_048_576;
export const EXCEL_MAX_COL = 16_384;

/** Parses `B14` or `$B$14` into a 1-based position; `undefined` when invalid. */
export function parseCellRef(ref: string): CellPos | undefined {
  const token = parseRefToken(ref.trim());
  if (token === null) return undefined;
  const { row, col } = token.pos;
  if (row < 1 || row > EXCEL_MAX_ROW || col < 1 || col > EXCEL_MAX_COL) return undefined;
  return token.pos;
}

/** True when the letters form a valid Excel column (A .. XFD). */
export function isValidColumn(letters: string): boolean {
  if (!/^[A-Za-z]{1,3}$/.test(letters)) return false;
  const col = columnToNumber(letters);
  return col >= 1 && col <= EXCEL_MAX_COL;
}

/** Formats `{ row: 14, col: 2 }` as `B14`. */
export function formatCellRef(position: CellPos): string {
  return formatRef(position);
}

/** Numeric sort key of a cell reference (row first, then column). */
export function cellRefSortKey(ref: string): [number, number] {
  const position = parseCellRef(ref);
  return position
    ? [position.row, position.col]
    : [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
}
