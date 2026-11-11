/**
 * Shared formulas.
 *
 * A shared formula is written once, in a master cell
 * (`<f t="shared" ref="B3:B13" si="0">SUM(B2:B2)</f>`); the followers only
 * carry its index (`<f t="shared" si="0"/>`).
 *
 * When the patcher touches one cell of such a group, the group is broken:
 * Excel expects the master and its followers to stay consistent, and a
 * dangling `si` makes it ask to repair the file. Every cell of the group
 * therefore becomes a standalone formula, translated to its own position.
 * The patched cell keeps the value the caller asked for.
 */
import { formatRef, parseRef } from "./refs";
import { formulaText, translateFormula } from "./shared-formula";
import { attrValue, findElements } from "./xml";

/** A shared formula master found in a sheet. */
interface SharedMaster {
  /** Shared formula index (`si`). */
  si: string;
  /** Formula text of the master. */
  formula: string;
  /** Row of the master cell. */
  row: number;
  /** Column of the master cell. */
  col: number;
}

/** One member of a shared formula group. */
interface SharedMember {
  ref: string;
  si: string;
  row: number;
  col: number;
  /** True for the cell holding the formula text. */
  isMaster: boolean;
}

/**
 * Returns, for every cell of a shared group the patch touches, the
 * standalone formula it must carry. `patchedRefs` holds the patched cells.
 */
export function breakSharedGroups(
  xml: string,
  patchedRefs: Set<string>,
): Map<string, string> {
  const masters = new Map<string, SharedMaster>();
  const members = new Map<string, SharedMember[]>();
  for (const cell of cellsOf(xml)) {
    const formula = findElements(cell.inner, "f")[0];
    if (!formula) continue;
    const si = attrValue(formula, "si");
    if (si === undefined) continue;
    const text = cell.inner.slice(formula.innerStart, formula.innerEnd);
    const address = parseRef(cell.ref);
    const isMaster = text.trim() !== "";
    if (isMaster) {
      masters.set(si, { si, formula: text, row: address.row, col: address.col });
    }
    const group = members.get(si) ?? [];
    group.push({ ref: cell.ref, si, row: address.row, col: address.col, isMaster });
    members.set(si, group);
  }
  const result = new Map<string, string>();
  for (const [si, group] of members) {
    const master = masters.get(si);
    if (!master) continue;
    const touched = group.some((member) => patchedRefs.has(member.ref));
    if (!touched) continue;
    for (const member of group) {
      if (patchedRefs.has(member.ref)) continue;
      result.set(
        member.ref,
        translateFormula(master.formula, member.row - master.row, member.col - master.col),
      );
    }
  }
  return result;
}

/** One cell of a worksheet, with its inner XML. */
interface SheetCellInfo {
  ref: string;
  inner: string;
}

/** Lists the cells of a worksheet with their inner XML. */
export function cellsOf(xml: string): SheetCellInfo[] {
  const sheetData = findElements(xml, "sheetData")[0];
  if (!sheetData) return [];
  const inner = xml.slice(sheetData.innerStart, sheetData.innerEnd);
  const cells: SheetCellInfo[] = [];
  for (const cell of findElements(inner, "c")) {
    const ref = attrValue(cell, "r");
    if (!ref) continue;
    cells.push({ ref, inner: inner.slice(cell.innerStart, cell.innerEnd) });
  }
  return cells;
}

/**
 * Replaces the `<f>` element of a cell by a standalone formula.
 * Used to break a shared formula group.
 */
export function withStandaloneFormula(cellXml: string, formula: string): string {
  const formulaElement = findElements(cellXml, "f")[0];
  if (!formulaElement) return cellXml;
  const replacement = `<f>${formulaText(formula)}</f>`;
  return cellXml.slice(0, formulaElement.start) + replacement + cellXml.slice(formulaElement.end);
}

/** Ref of a cell position, used by the callers of this module. */
export function refOf(position: { row: number; col: number }): string {
  return formatRef(position);
}
