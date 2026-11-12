import type { CellRecord } from "@suture/contracts";

/**
 * 64-bit FNV-1a hash formatted as a 16-hex string. Deterministic, fast, pure
 * TypeScript — no Node `crypto` dependency so it runs in the browser.
 */
export function fnv1a64(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i] ?? 0;
    h1 = Math.imul(h1 ^ b, 0x01000193);
    h2 = Math.imul(h2 ^ b, 0x811c9dc5);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return part1 + part2;
}

const COL_LETTERS = /^[A-Za-z]+/;
const ROW_DIGITS = /[0-9]+$/;

/** Column letters of a reference, uppercased: "b14" -> "B". */
export function columnOf(ref: string): string {
  return (COL_LETTERS.exec(ref)?.[0] ?? "").toUpperCase();
}

/** Row number of a reference (1-based): "B14" -> 14. */
export function rowNumberOf(ref: string): number {
  const digits = ROW_DIGITS.exec(ref);
  return digits === null ? 1 : Number(digits[0]);
}

/** Column number of a reference (1-based): "B14" -> 2. */
export function columnNumberOf(ref: string): number {
  let total = 0;
  for (const char of columnOf(ref)) {
    total = total * 26 + (char.charCodeAt(0) - 64);
  }
  return total;
}

/**
 * Signature of a line of cells (B.7 step 1): computed on the typed inputs
 * only, ignoring cached results, and keyed by the CROSS index (the column for
 * a row, the row for a column) so that shifting a line does not change its
 * signature — that is what makes insertions detectable.
 */
export function lineSignature(cells: CellRecord[], crossIndex: (ref: string) => string): string {
  if (cells.length === 0) return "";
  const parts = cells
    .map((cell) => `${crossIndex(cell.ref)}:${cell.kind}:${cell.input}`)
    .sort();
  return fnv1a64(parts.join("|"));
}

/** Signature of a row: keyed by column. */
export function rowSignature(cells: CellRecord[]): string {
  return lineSignature(cells, columnOf);
}

/** Signature of a column: keyed by row. */
export function colSignature(cells: CellRecord[]): string {
  return lineSignature(cells, (ref) => String(rowNumberOf(ref)));
}
