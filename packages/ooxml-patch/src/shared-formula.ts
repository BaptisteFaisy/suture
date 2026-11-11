/**
 * Shared formulas.
 *
 * A shared formula is written once, in a master cell
 * (`<f t="shared" ref="B3:B13" si="0">SUM(B2:B2)</f>`), and the followers
 * only carry its index (`<f t="shared" si="0"/>`).
 *
 * When the patcher overwrites the master, the followers would point at a
 * formula that no longer exists and Excel would ask to repair the file. The
 * followers are therefore expanded into standalone formulas, translated to
 * their own position.
 */
import { columnLetters, parseRef } from "./refs";
import { escapeText } from "./xml";

/** A shared formula master found in a sheet. */
export interface SharedMaster {
  /** Shared formula index (`si`). */
  si: string;
  /** Formula text of the master. */
  formula: string;
  /** Row of the master cell. */
  row: number;
  /** Column of the master cell. */
  col: number;
}

/** A reference inside a formula, with its anchors. */
interface Reference {
  start: number;
  end: number;
  /** Sheet qualifier, when the reference points to another sheet. */
  qualifier: string;
  /** Raw source of the reference, without the sheet qualifier. */
  raw: string;
  absoluteCol: boolean;
  col: number;
  absoluteRow: boolean;
  row: number;
}

const REFERENCE = /((?:'[^']*'|[A-Za-z0-9_]+)!)?(\$?)([A-Z]{1,3})(\$?)([0-9]{1,7})/g;
const LITERAL = /"[^"]*"/g;

/**
 * Translates a formula by the given row and column offsets. Absolute
 * references stay put, references to another sheet are left untouched.
 */
export function translateFormula(formula: string, dRow: number, dCol: number): string {
  const literals: string[] = [];
  const withoutLiterals = formula.replace(LITERAL, (literal) => {
    literals.push(literal);
    return `~${literals.length - 1}~`;
  });
  const shifted = shiftReferences(withoutLiterals, dRow, dCol);
  return shifted.replace(/~(\d+)~/g, (_, index) => literals[Number(index)] ?? "");
}

function shiftReferences(formula: string, dRow: number, dCol: number): string {
  const references = findReferences(formula);
  if (references.length === 0) return formula;
  let result = "";
  let cursor = 0;
  for (const reference of references) {
    result += formula.slice(cursor, reference.start);
    result += renderReference(reference, dRow, dCol);
    cursor = reference.end;
  }
  return result + formula.slice(cursor);
}

function renderReference(reference: Reference, dRow: number, dCol: number): string {
  // A reference to another sheet keeps its position: it is not part of the
  // shared range of the current sheet.
  if (reference.qualifier !== "") return reference.qualifier + reference.raw;
  const col = reference.absoluteCol ? reference.col : reference.col + dCol;
  const row = reference.absoluteRow ? reference.row : reference.row + dRow;
  if (col < 1 || row < 1) return "#REF!";
  const colText = reference.absoluteCol ? `$${columnLetters(reference.col)}` : columnLetters(col);
  const rowText = reference.absoluteRow ? `$${reference.row}` : String(row);
  return `${reference.qualifier}${colText}${rowText}`;
}

function findReferences(formula: string): Reference[] {
  const found: Reference[] = [];
  REFERENCE.lastIndex = 0;
  let match = REFERENCE.exec(formula);
  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    if (isRealReference(formula, start, end)) {
      found.push({
        start,
        end,
        qualifier: match[1] ?? "",
        raw: match[0].slice((match[1] ?? "").length),
        absoluteCol: match[2] === "$",
        col: parseRef(`${match[3]}${match[5]}`).col,
        absoluteRow: match[4] === "$",
        row: Number(match[5]),
      });
    }
    match = REFERENCE.exec(formula);
  }
  return found;
}

/** Rejects matches that are part of a name, a number or a function call. */
function isRealReference(formula: string, start: number, end: number): boolean {
  const after = formula.slice(end);
  if (/^[A-Za-z0-9_.(]/.test(after)) return false;
  const before = formula.slice(0, start);
  return !/[A-Za-z0-9_.]/.test(before.slice(-1));
}

/** Escapes a formula for an XML text node. */
export function formulaText(formula: string): string {
  return escapeText(formula);
}
