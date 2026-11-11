/**
 * Formula text handling at the patch boundary.
 *
 * The merge engine is responsible for carrying formulas to their final
 * position; the patcher writes the formula as it must appear in the sheet.
 * A1 notation (`SUM(B2:B13)`) is written as is. R1C1 notation
 * (`SUM(R[-12]C:R[-1]C)`), the notation used by the canonical `cells/` view,
 * is translated to the target cell position.
 */
import { columnLetters, parseRef } from "./refs";

/**
 * R1C1 tokens: `R3C4`, `R[-3]C[-4]`, `RC4`.
 *
 * The column part is mandatory: it is what tells an R1C1 reference from an
 * A1 range such as `A1:R5`. A token must not start a name (`ROUND`, `RCPT`…)
 * nor be a function call (`R(`).
 */
const R1C1_TOKEN = /(?<![A-Za-z0-9_$.])R(?:\[-?\d+\]|\d+)?C(?:\[-?\d+\]|\d+)?(?![A-Za-z0-9_(])/g;

interface Reference {
  absoluteRow?: number;
  offsetRow?: number;
  absoluteCol?: number;
  offsetCol?: number;
}

function parseToken(token: string): Reference {
  const match = /^R(\[-?\d+\]|\d+)?C(\[-?\d+\]|\d+)?$/.exec(token);
  if (!match) return {};
  const result: Reference = {};
  const row = match[1];
  const col = match[2];
  if (row !== undefined) {
    if (row.startsWith("[")) result.offsetRow = Number(row.slice(1, -1));
    else result.absoluteRow = Number(row);
  }
  if (col !== undefined) {
    if (col.startsWith("[")) result.offsetCol = Number(col.slice(1, -1));
    else result.absoluteCol = Number(col);
  }
  return result;
}

function convertToken(token: string, targetRow: number, targetCol: number): string {
  const parts = parseToken(token);
  const row = parts.absoluteRow ?? targetRow + (parts.offsetRow ?? 0);
  const col = parts.absoluteCol ?? targetCol + (parts.offsetCol ?? 0);
  const rowText = parts.absoluteRow === undefined ? String(row) : `$${row}`;
  const colText =
    parts.absoluteCol === undefined ? columnLetters(col) : `$${columnLetters(col)}`;
  return `${colText}${rowText}`;
}

/** True when the text holds at least one R1C1 reference. */
export function containsR1c1(formula: string): boolean {
  R1C1_TOKEN.lastIndex = 0;
  return R1C1_TOKEN.test(formula);
}

/**
 * Returns the formula to write in the sheet, in A1 notation and without the
 * leading `=`. R1C1 references are translated to the target cell position.
 */
export function toSheetFormula(input: string, targetRef: string): string {
  const text = input.startsWith("=") ? input.slice(1) : input;
  if (!containsR1c1(text)) return text;
  const target = parseRef(targetRef);
  return text.replace(R1C1_TOKEN, (token) => convertToken(token, target.row, target.col));
}
