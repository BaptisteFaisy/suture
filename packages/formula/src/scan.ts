import type { CellPos } from "@suture/contracts";
import { columnToNumber } from "./refs";

export interface RefMatch {
  row: number;
  col: number;
  rowAbsolute: boolean;
  colAbsolute: boolean;
  start: number;
  end: number;
}

const A1_PATTERN = /(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)/g;
const IDENT_CHAR = /[A-Za-z0-9_.$]/;

function isA1Boundary(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] ?? "" : "";
  const after = end < text.length ? text[end] ?? "" : "";
  // Not part of a function name or identifier; not followed by '(' or '['
  if (IDENT_CHAR.test(before)) return false;
  if (IDENT_CHAR.test(after) || after === "(" || after === "[") return false;
  return true;
}

export function findRefs(text: string): RefMatch[] {
  const matches: RefMatch[] = [];
  A1_PATTERN.lastIndex = 0;
  let hit = A1_PATTERN.exec(text);
  while (hit !== null) {
    const [whole, dollarCol, letters, dollarRow, rowStr] = hit;
    if (
      whole !== undefined &&
      letters !== undefined &&
      rowStr !== undefined &&
      isA1Boundary(text, hit.index, hit.index + whole.length)
    ) {
      matches.push({
        row: Number(rowStr),
        col: columnToNumber(letters),
        rowAbsolute: dollarRow === "$",
        colAbsolute: dollarCol === "$",
        start: hit.index,
        end: hit.index + whole.length,
      });
    }
    hit = A1_PATTERN.exec(text);
  }
  return matches;
}

export function replaceRefs(text: string, render: (match: RefMatch) => string): string {
  const matches = findRefs(text);
  let out = "";
  let cursor = 0;
  for (const match of matches) {
    out += text.slice(cursor, match.start) + render(match);
    cursor = match.end;
  }
  return out + text.slice(cursor);
}

export interface R1c1Match {
  row: { absolute: boolean; value: number };
  col: { absolute: boolean; value: number };
  start: number;
  end: number;
}

// Matches R[row]C[col], R[row]C, RC[col], RC, R#C#, R#C[col], R[row]C#, etc.
// Requires both an R and a C part to distinguish from variable names.
const R1C1_PATTERN =
  /\bR(?:\[(-?\d+)\]|(\d+))?C(?:\[(-?\d+)\]|(\d+))?(?![A-Za-z0-9_(\[])/g;

function parsePart(bracketed: string | undefined, numbered: string | undefined) {
  if (numbered !== undefined && numbered.length > 0) {
    return { absolute: true, value: Number(numbered) };
  }
  if (bracketed !== undefined && bracketed.length > 0) {
    return { absolute: false, value: Number(bracketed) };
  }
  return { absolute: false, value: 0 };
}

export function findR1c1(text: string): R1c1Match[] {
  const matches: R1c1Match[] = [];
  R1C1_PATTERN.lastIndex = 0;
  let hit = R1C1_PATTERN.exec(text);
  while (hit !== null) {
    const [whole, rowBracket, rowNum, colBracket, colNum] = hit;
    if (whole !== undefined) {
      const start = hit.index;
      const end = start + whole.length;
      const before = start > 0 ? text[start - 1] ?? "" : "";
      if (!IDENT_CHAR.test(before)) {
        matches.push({
          row: parsePart(rowBracket, rowNum),
          col: parsePart(colBracket, colNum),
          start,
          end,
        });
      }
    }
    hit = R1C1_PATTERN.exec(text);
  }
  return matches;
}

export function replaceR1c1(
  text: string,
  render: (match: R1c1Match, origin: CellPos) => string,
  origin: CellPos,
): string {
  const matches = findR1c1(text);
  let out = "";
  let cursor = 0;
  for (const match of matches) {
    out += text.slice(cursor, match.start) + render(match, origin);
    cursor = match.end;
  }
  return out + text.slice(cursor);
}
