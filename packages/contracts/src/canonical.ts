/**
 * Canonical workbook model — the `cells/` view stored in every version.
 * See `.kiro/steering/canonical-format.md` for the TSV file format.
 */

/** Version of the canonical format written under `.suture/format.json`. */
export const CANONICAL_FORMAT_VERSION = 1;

/** Data kind of a cell. */
export type CellKind = "n" | "s" | "b" | "e" | "f";

/** One non-empty cell of a sheet, in canonical form. */
export interface CellRecord {
  /** A1-style address, e.g. "B14". */
  ref: string;
  /** Number, string, boolean, error, or formula. */
  kind: CellKind;
  /** What was typed: literal value, or formula in R1C1 notation when kind is "f". */
  input: string;
  /** Last cached computed value (formulas only); empty string otherwise. */
  cached: string;
  /** Number-format code; empty string when General. */
  fmt: string;
}

/** Sheet visibility as stored in `xl/workbook.xml`. */
export type SheetState = "visible" | "hidden" | "veryHidden";

/** Identity and display metadata of a sheet. */
export interface SheetMeta {
  /** Stable sheetId from xl/workbook.xml (survives renames). */
  sheetId: number;
  /** Sheet name as shown in the workbook. */
  name: string;
  /** 0-based position among all sheets. */
  order: number;
  /** Visibility state. */
  state: SheetState;
  /** Worksheet part path, e.g. "xl/worksheets/sheet1.xml". */
  path: string;
}

/** A defined name (workbook- or sheet-scoped). */
export interface DefinedName {
  name: string;
  /** Referenced formula/range in A1 notation, as stored. */
  formula: string;
  /** Scope: sheetId when sheet-scoped, undefined when workbook-scoped. */
  sheetId?: number;
}

/** Workbook-level metadata (sheet list + defined names). */
export interface WorkbookMeta {
  sheets: SheetMeta[];
  definedNames: DefinedName[];
}

/** A sheet with its cells, sorted by row then column. */
export interface CanonicalSheet {
  meta: SheetMeta;
  cells: CellRecord[];
}

/** Full canonical view of a workbook. Sheets sorted by `meta.order`. */
export interface CanonicalWorkbook {
  meta: WorkbookMeta;
  sheets: CanonicalSheet[];
}

/** Fast lookup of cells by A1 ref for one sheet. */
export type CellMap = Map<string, CellRecord>;
