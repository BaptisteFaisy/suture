/**
 * A1 address helpers — parsing and formatting of cell references.
 */

/** 1-based position of a cell. */
export interface CellPosition {
  row: number;
  col: number;
}

/** True when the letters form a valid Excel column (A .. XFD). */
export function isValidColumn(letters: string): boolean {
  if (!/^[A-Za-z]{1,3}$/.test(letters)) return false;
  let col = 0;
  for (const letter of letters.toUpperCase()) {
    col = col * 26 + (letter.charCodeAt(0) - 64);
  }
  return col >= 1 && col <= 16384;
}

/** Column letters of a 1-based column index (`2` -> `B`). */
export function columnLetters(col: number): string {
  let remaining = col;
  let letters = "";
  while (remaining > 0) {
    const rest = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}

/** Parses `B14` into `{ row: 14, col: 2 }`; `undefined` when invalid. */
export function parseCellRef(ref: string): CellPosition | undefined {
  const match = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]*)$/.exec(ref.trim());
  if (!match) return undefined;
  const letters = match[1] ?? "";
  const row = Number(match[2] ?? "");
  if (!isValidColumn(letters)) return undefined;
  let col = 0;
  for (const letter of letters.toUpperCase()) {
    col = col * 26 + (letter.charCodeAt(0) - 64);
  }
  return { row, col };
}

/** Formats `{ row: 14, col: 2 }` as `B14`. */
export function formatCellRef(position: CellPosition): string {
  return `${columnLetters(position.col)}${position.row}`;
}

/** Numeric sort key of a cell reference (row first, then column). */
export function cellRefSortKey(ref: string): [number, number] {
  const position = parseCellRef(ref);
  return position ? [position.row, position.col] : [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
}
