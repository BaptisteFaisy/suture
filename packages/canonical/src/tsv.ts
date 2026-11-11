/**
 * The `cells/*.tsv` format — five tab-separated columns:
 * `ref`, `kind`, `input`, `cached`, `fmt`.
 *
 * Lines are sorted by numeric row, then numeric column. Text values escape
 * tabulations, line breaks and backslashes so a line never breaks.
 */
import type { CanonicalSheet, CellRecord } from "@suture/contracts";
import { cellRefSortKey, parseCellRef } from "./refs";

/** Escapes the characters that would break the line structure. */
export function escapeTsvValue(value: string): string {
  let escaped = "";
  for (const char of value) {
    if (char === "\\") escaped += "\\\\";
    else if (char === "\t") escaped += "\\t";
    else if (char === "\n") escaped += "\\n";
    else if (char === "\r") escaped += "\\r";
    else escaped += char;
  }
  return escaped;
}

/** Reverses {@link escapeTsvValue}. */
export function unescapeTsvValue(value: string): string {
  let plain = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      plain += char;
      continue;
    }
    const next = value[index + 1];
    index += 1;
    if (next === "t") plain += "\t";
    else if (next === "n") plain += "\n";
    else if (next === "r") plain += "\r";
    else if (next === "\\") plain += "\\";
    else plain += next === undefined ? "\\" : `\\${next}`;
  }
  return plain;
}

/** Serializes the cells of a sheet into the canonical TSV text. */
export function serializeCellsTsv(sheet: CanonicalSheet): string {
  const sorted = [...sheet.cells].sort(compareByPosition);
  const lines = sorted.map((cell) => serializeCell(cell));
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

/** Serializes one cell as a tab-separated line. */
function serializeCell(cell: CellRecord): string {
  const fields = [
    cell.ref,
    cell.kind,
    escapeTsvValue(cell.input),
    escapeTsvValue(cell.cached),
    escapeTsvValue(cell.fmt),
  ];
  return fields.join("\t");
}

/** Parses canonical TSV text back into cells. */
export function parseCellsTsv(text: string): CellRecord[] {
  const cells: CellRecord[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const cell = parseCellLine(line);
    if (cell !== undefined) cells.push(cell);
  }
  return cells.sort(compareByPosition);
}

/** Parses one tab-separated line. */
function parseCellLine(line: string): CellRecord | undefined {
  const fields = line.split("\t");
  const ref = fields[0] ?? "";
  const kind = fields[1];
  if (ref === "" || kind === undefined) return undefined;
  return {
    ref,
    kind: isCellKind(kind) ? kind : "s",
    input: unescapeTsvValue(fields[2] ?? ""),
    cached: unescapeTsvValue(fields[3] ?? ""),
    fmt: unescapeTsvValue(fields[4] ?? ""),
  };
}

/** True when the string is one of the five canonical kinds. */
function isCellKind(kind: string): kind is CellRecord["kind"] {
  return kind === "n" || kind === "s" || kind === "b" || kind === "e" || kind === "f";
}

/** Numeric comparison of two cells (row first, then column). */
function compareByPosition(a: CellRecord, b: CellRecord): number {
  const [rowA, colA] = cellRefSortKey(a.ref);
  const [rowB, colB] = cellRefSortKey(b.ref);
  if (rowA !== rowB) return rowA - rowB;
  if (colA !== colB) return colA - colB;
  return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
}

/** True when the reference is a well-formed A1 address. */
export function isValidRef(ref: string): boolean {
  return parseCellRef(ref) !== undefined;
}
