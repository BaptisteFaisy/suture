import type {
  CanonicalSheet,
  CanonicalWorkbook,
  CellChange,
  ChangeSet,
  ChangeSummary,
  SheetChange,
  SheetDiff,
} from "@suture/contracts";
import { alignCols, alignRows } from "./align";
import { compareAlignedCells, hasStructuralChange } from "./classify";
import { groupCols, groupRows, type LineBucket } from "./group";
import { collectCols, collectRows, compareParts, type PartsByPath } from "./parts";
import { fnv1a64 } from "./signature";

/** A pair of matched sheets, old and new. */
interface SheetPair {
  oldSheet: CanonicalSheet;
  newSheet: CanonicalSheet;
}

/** Matches sheets by sheetId first, then by name; detects renames. */
export function matchSheets(
  oldWorkbook: CanonicalWorkbook,
  newWorkbook: CanonicalWorkbook,
): { pairs: SheetPair[]; changes: SheetChange[] } {
  const pairs: SheetPair[] = [];
  const changes: SheetChange[] = [];
  const used = new Set<number>();

  for (const oldSheet of oldWorkbook.sheets) {
    const match = findMatch(oldSheet, newWorkbook.sheets, used);
    if (match === undefined) {
      changes.push({
        type: "removed",
        sheetId: oldSheet.meta.sheetId,
        before: oldSheet.meta.name,
      });
      continue;
    }
    used.add(match.meta.sheetId);
    pairs.push({ oldSheet, newSheet: match });
    if (match.meta.name !== oldSheet.meta.name) {
      changes.push({
        type: "renamed",
        sheetId: oldSheet.meta.sheetId,
        before: oldSheet.meta.name,
        after: match.meta.name,
      });
    }
    if (match.meta.state !== oldSheet.meta.state) {
      changes.push({
        type: "state",
        sheetId: oldSheet.meta.sheetId,
        before: oldSheet.meta.state,
        after: match.meta.state,
      });
    }
  }

  for (const newSheet of newWorkbook.sheets) {
    if (!used.has(newSheet.meta.sheetId)) {
      changes.push({
        type: "added",
        sheetId: newSheet.meta.sheetId,
        after: newSheet.meta.name,
      });
    }
  }

  return { pairs, changes };
}

function findMatch(
  oldSheet: CanonicalSheet,
  candidates: CanonicalSheet[],
  used: Set<number>,
): CanonicalSheet | undefined {
  const byId = candidates.find(
    (sheet) => sheet.meta.sheetId === oldSheet.meta.sheetId && !used.has(sheet.meta.sheetId),
  );
  if (byId !== undefined) return byId;
  return candidates.find(
    (sheet) => sheet.meta.name === oldSheet.meta.name && !used.has(sheet.meta.sheetId),
  );
}

/** Diffs one matched pair of sheets: alignment then cell comparison. */
export function diffSheet(
  sheetId: number,
  oldSheet: CanonicalSheet,
  newSheet: CanonicalSheet,
): SheetDiff {
  const oldRows = groupRows(oldSheet.cells);
  const newRows = groupRows(newSheet.cells);
  const rows = alignRows(
    oldRows.map((bucket) => bucket.cells),
    newRows.map((bucket) => bucket.cells),
  );

  const oldCols = groupCols(oldSheet.cells);
  const newCols = groupCols(newSheet.cells);
  const cols = alignCols(
    oldCols.map((bucket) => bucket.cells),
    newCols.map((bucket) => bucket.cells),
  );

  const cells = compareAlignedRows(sheetId, rows, oldRows, newRows);
  const rowsChanged = collectRows(sheetId, rows, oldRows, newRows);
  const colsChanged = collectCols(sheetId, cols, oldCols, newCols);

  return {
    sheetId,
    rows,
    cols,
    cells,
    rowsChanged,
    colsChanged,
    structural: hasStructuralChange(rows) || hasStructuralChange(cols),
  };
}

function compareAlignedRows(
  sheetId: number,
  rows: SheetDiff["rows"],
  oldRows: LineBucket[],
  newRows: LineBucket[],
): CellChange[] {
  const changes: CellChange[] = [];
  for (const entry of rows) {
    if (entry.oldIndex === undefined || entry.newIndex === undefined) continue;
    const before = oldRows[entry.oldIndex];
    const after = newRows[entry.newIndex];
    if (before === undefined || after === undefined) continue;
    changes.push(...compareAlignedCells(sheetId, before.cells, after.cells));
  }
  return changes;
}

/** Counts everything the summary reports (SUT-F-13). */
export function summarize(
  sheets: SheetDiff[],
  sheetChanges: SheetChange[],
  partsChanged: number,
): ChangeSummary {
  const summary: ChangeSummary = {
    inputsModified: 0,
    consequences: 0,
    formats: 0,
    rowsInserted: 0,
    rowsDeleted: 0,
    colsInserted: 0,
    colsDeleted: 0,
    sheetsAdded: 0,
    sheetsRemoved: 0,
    sheetsRenamed: 0,
    partsChanged,
  };
  for (const sheet of sheets) {
    for (const change of sheet.cells) {
      if (change.kind === "input") summary.inputsModified += 1;
      else if (change.kind === "consequence") summary.consequences += 1;
      else summary.formats += 1;
    }
    for (const change of sheet.rowsChanged) {
      if (change.type === "inserted") summary.rowsInserted += 1;
      else summary.rowsDeleted += 1;
    }
    for (const change of sheet.colsChanged) {
      if (change.type === "inserted") summary.colsInserted += 1;
      else summary.colsDeleted += 1;
    }
  }
  for (const change of sheetChanges) {
    if (change.type === "added") summary.sheetsAdded += 1;
    else if (change.type === "removed") summary.sheetsRemoved += 1;
    else if (change.type === "renamed") summary.sheetsRenamed += 1;
  }
  return summary;
}

/**
 * Compares two canonical workbooks (and their optional raw parts) into a typed
 * ChangeSet — the single input of the compare view, the summary and the
 * combine engine.
 */
export function compare(
  oldWorkbook: CanonicalWorkbook,
  newWorkbook: CanonicalWorkbook,
  oldParts: PartsByPath = {},
  newParts: PartsByPath = {},
): ChangeSet {
  const { pairs, changes: sheetChanges } = matchSheets(oldWorkbook, newWorkbook);
  const sheets = pairs.map(({ oldSheet, newSheet }) =>
    diffSheet(oldSheet.meta.sheetId, oldSheet, newSheet),
  );
  const partChanges = compareParts(oldParts, newParts, fnv1a64);
  return {
    sheets,
    sheetChanges,
    partChanges,
    summary: summarize(sheets, sheetChanges, partChanges.length),
  };
}
