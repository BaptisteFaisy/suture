import type {
  AlignmentEntry,
  CellChange,
  CellRecord,
} from "@suture/contracts";
import { columnOf } from "./signature";

/** Classifies one cell pair into the three natures of B.7 step 4. */
export function classifyCell(
  before: CellRecord,
  after: CellRecord,
): CellChange["kind"] | null {
  if (before.input !== after.input || before.kind !== after.kind) {
    return "input";
  }
  if (before.cached !== after.cached) {
    return "consequence";
  }
  if (before.fmt !== after.fmt) {
    return "format";
  }
  return null;
}

/**
 * Compares two aligned lines of cells. Cells are matched by their CROSS index
 * (column for rows) because the line itself may have moved. The reported
 * address is the one in the NEW version.
 */
export function compareAlignedCells(
  sheetId: number,
  oldCells: CellRecord[],
  newCells: CellRecord[],
): CellChange[] {
  const oldByColumn = new Map<string, CellRecord>();
  for (const cell of oldCells) {
    oldByColumn.set(columnOf(cell.ref), cell);
  }
  const changes: CellChange[] = [];
  const seen = new Set<string>();

  for (const after of newCells) {
    const key = columnOf(after.ref);
    seen.add(key);
    const before = oldByColumn.get(key);
    if (before === undefined) {
      changes.push({ sheetId, ref: after.ref, kind: "input", before: null, after });
      continue;
    }
    const kind = classifyCell(before, after);
    if (kind !== null) {
      changes.push({ sheetId, ref: after.ref, kind, before, after });
    }
  }

  for (const before of oldCells) {
    const key = columnOf(before.ref);
    if (seen.has(key)) continue;
    changes.push({ sheetId, ref: before.ref, kind: "input", before, after: null });
  }

  return changes;
}

/** Compares two whole sheets cell by cell, ignoring any row alignment. */
export function compareCells(
  sheetId: number,
  oldCells: CellRecord[],
  newCells: CellRecord[],
): CellChange[] {
  return compareAlignedCells(sheetId, oldCells, newCells);
}

/** True when the alignment contains an insertion or a deletion. */
export function hasStructuralChange(alignment: AlignmentEntry[]): boolean {
  return alignment.some(
    (entry) => entry.type === "inserted" || entry.type === "deleted",
  );
}
