/**
 * ChangeSet model — the single typed input of the compare view, the summary
 * and the combine engine. See spec `.kiro/specs/diff-engine`.
 */
import type { CellRecord } from "./canonical";

/** Three natures of a cell-level difference (SUT-F-08). */
export type CellChangeKind = "input" | "consequence" | "format";

/** One cell-level change between two versions. */
export interface CellChange {
  sheetId: number;
  /** Cell address in the NEW version. */
  ref: string;
  kind: CellChangeKind;
  before: CellRecord | null;
  after: CellRecord | null;
}

/** Alignment entry type between old and new rows (or columns). */
export type AlignmentEntryType = "same" | "modified" | "inserted" | "deleted";

/** One line of the row/column alignment table. */
export interface AlignmentEntry {
  type: AlignmentEntryType;
  /** Index in the OLD sheet (0-based); absent when inserted. */
  oldIndex?: number;
  /** Index in the NEW sheet (0-based); absent when deleted. */
  newIndex?: number;
  /** For "modified": number of shared cells that justified the pairing. */
  sharedCells?: number;
}

/** A structurally inserted or deleted row, with its cells. */
export interface RowChange {
  sheetId: number;
  type: "inserted" | "deleted";
  /** Row index (0-based) in the NEW sheet when inserted, OLD when deleted. */
  rowIndex: number;
  cells: CellRecord[];
}

/** A structurally inserted or deleted column. */
export interface ColumnChange {
  sheetId: number;
  type: "inserted" | "deleted";
  /** Column index (0-based). */
  colIndex: number;
}

/** Diff of one sheet: alignment + typed changes. */
export interface SheetDiff {
  sheetId: number;
  /** Row alignment, old → new. */
  rows: AlignmentEntry[];
  /** Column alignment, old → new (empty when columns were not aligned). */
  cols: AlignmentEntry[];
  cells: CellChange[];
  rowsChanged: RowChange[];
  colsChanged: ColumnChange[];
  /** True when row/column insertions or deletions happened on this sheet. */
  structural: boolean;
}

/** Sheet-level event (added, removed, renamed, visibility). */
export type SheetChangeType = "added" | "removed" | "renamed" | "state";

/** One sheet-level change. */
export interface SheetChange {
  type: SheetChangeType;
  sheetId: number;
  /** Name before (removed/renamed/state) or after (added). */
  before?: string;
  after?: string;
}

/** Non-cell part compared by fingerprint only (charts, macros, styles...). */
export type NonCellPartChangeType = "modified" | "added" | "removed";

/** One non-cell part change, with a human label. */
export interface NonCellPartChange {
  type: NonCellPartChangeType;
  path: string;
  /** Human label, e.g. "Chart 2" or "VBA project". */
  label: string;
}

/** Deterministic counters used by the summary (SUT-F-13). */
export interface ChangeSummary {
  inputsModified: number;
  consequences: number;
  formats: number;
  rowsInserted: number;
  rowsDeleted: number;
  colsInserted: number;
  colsDeleted: number;
  sheetsAdded: number;
  sheetsRemoved: number;
  sheetsRenamed: number;
  partsChanged: number;
}

/** Full typed result of comparing two versions. */
export interface ChangeSet {
  sheets: SheetDiff[];
  sheetChanges: SheetChange[];
  partChanges: NonCellPartChange[];
  summary: ChangeSummary;
}

/** True when nothing at all changed (property SUT-P-04 target). */
export function isEmptyChangeSet(changeSet: ChangeSet): boolean {
  const cellsEmpty = changeSet.sheets.every(
    (sheet) =>
      sheet.cells.length === 0 &&
      sheet.rowsChanged.length === 0 &&
      sheet.colsChanged.length === 0,
  );
  return (
    cellsEmpty &&
    changeSet.sheetChanges.length === 0 &&
    changeSet.partChanges.length === 0
  );
}
