/**
 * A1 address helpers: parsing, formatting and ordering of cell references.
 */

/** A cell position, 1-based, as used by SpreadsheetML. */
export interface CellAddress {
  /** Row number, 1-based. */
  row: number;
  /** Column number, 1-based (A = 1). */
  col: number;
}

/** Thrown when a cell reference cannot be understood. */
export class InvalidCellRefError extends Error {
  constructor(readonly ref: string) {
    super(`Invalid cell reference: ${ref}`);
    this.name = "InvalidCellRefError";
  }
}

/** Converts a column number to its letters (1 → "A", 27 → "AA"). */
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

/** Converts column letters to a column number ("A" → 1, "AA" → 27). */
export function columnNumber(letters: string): number {
  let value = 0;
  for (const char of letters.toUpperCase()) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) throw new InvalidCellRefError(letters);
    value = value * 26 + (code - 64);
  }
  if (value === 0) throw new InvalidCellRefError(letters);
  return value;
}

/** Parses an A1 address such as "B14" or "$B$14". */
export function parseRef(ref: string): CellAddress {
  const match = /^\$?([A-Za-z]+)\$?([0-9]+)$/.exec(ref.trim());
  if (!match) throw new InvalidCellRefError(ref);
  const row = Number(match[2]);
  if (!Number.isInteger(row) || row < 1) throw new InvalidCellRefError(ref);
  return { row, col: columnNumber(match[1] ?? "") };
}

/** Formats a position as an A1 address without absolute markers. */
export function formatRef(address: CellAddress): string {
  return `${columnLetters(address.col)}${address.row}`;
}

/** Compares two addresses: row first, then column. */
export function compareAddresses(a: CellAddress, b: CellAddress): number {
  if (a.row !== b.row) return a.row - b.row;
  return a.col - b.col;
}
