import type { CellPos } from "@suture/contracts";

/** Matches a cell reference with optional absolute markers: B14, $B$14, AA3. */
const CELL_REF = /^\$?([A-Za-z]{1,3})\$?([0-9]+)$/;

/** Converts column letters ("A", "AA", "XFD") to a 1-based column number. */
export function columnToNumber(letters: string): number {
  let total = 0;
  for (const char of letters.toUpperCase()) {
    total = total * 26 + (char.charCodeAt(0) - 64);
  }
  return total;
}

/** Converts a 1-based column number to letters ("A", "AA", "XFD"). */
export function numberToColumn(column: number): string {
  let rest = column;
  let out = "";
  while (rest > 0) {
    const digit = (rest - 1) % 26;
    out = String.fromCharCode(65 + digit) + out;
    rest = Math.floor((rest - 1) / 26);
  }
  return out;
}

/** One end of a range, with its absolute markers. */
export interface RefToken {
  pos: CellPos;
  rowAbsolute: boolean;
  colAbsolute: boolean;
}

/** Parses "B14" or "$B$14" into a position (absolute markers are dropped). */
export function parseRef(ref: string): CellPos {
  const token = parseRefToken(ref);
  if (token === null) {
    throw new Error(`Not a cell reference: ${ref}`);
  }
  return token.pos;
}

/** Formats a position as an A1 address, without absolute markers. */
export function formatRef(pos: CellPos): string {
  return `${numberToColumn(pos.col)}${pos.row}`;
}

/** Parses a cell reference and keeps its absolute markers. */
export function parseRefToken(ref: string): RefToken | null {
  const match = CELL_REF.exec(ref);
  if (match === null) {
    return null;
  }
  const letters = match[1];
  const row = match[2];
  if (letters === undefined || row === undefined) {
    return null;
  }
  const parts = ref.split("$");
  // "$B$14" → ["", "B", "14"] ; "B$14" → ["B", "14"] ; "$B14" → ["", "B14"]
  const colAbsolute = parts.length >= 2 && parts[0] === "";
  const rowAbsolute = ref.includes(`$${row}`);
  return {
    pos: { row: Number(row), col: columnToNumber(letters) },
    rowAbsolute,
    colAbsolute,
  };
}

/** Renders a reference token back to A1 text, with its absolute markers. */
export function formatRefToken(token: RefToken): string {
  const col = `${token.colAbsolute ? "$" : ""}${numberToColumn(token.pos.col)}`;
  const row = `${token.rowAbsolute ? "$" : ""}${token.pos.row}`;
  return `${col}${row}`;
}
