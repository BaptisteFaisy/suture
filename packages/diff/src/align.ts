import type { AlignmentEntry, CellRecord } from "@suture/contracts";
import { colSignature, columnOf, rowNumberOf, rowSignature } from "./signature";

/**
 * Longest Common Subsequence over line signatures (B.7 step 2).
 * Returns the matching pairs (oldIndex, newIndex), in order.
 */
export function lcsPairs(oldSigs: string[], newSigs: string[]): [number, number][] {
  const rows = oldSigs.length;
  const cols = newSigs.length;
  const dp: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0),
  );
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const same = oldSigs[i] === newSigs[j] && (oldSigs[i] ?? "").length > 0;
      const up = dp[i]![j + 1] ?? 0;
      const left = dp[i + 1]![j] ?? 0;
      dp[i + 1]![j + 1] = same ? (dp[i]![j] ?? 0) + 1 : Math.max(up, left);
    }
  }
  return walkBack(dp, oldSigs, newSigs);
}

function walkBack(
  dp: number[][],
  oldSigs: string[],
  newSigs: string[],
): [number, number][] {
  const pairs: [number, number][] = [];
  let i = oldSigs.length;
  let j = newSigs.length;
  while (i > 0 && j > 0) {
    const same = oldSigs[i - 1] === newSigs[j - 1] && (oldSigs[i - 1] ?? "").length > 0;
    if (same) {
      pairs.push([i - 1, j - 1]);
      i -= 1;
      j -= 1;
    } else if ((dp[i - 1]![j] ?? 0) >= (dp[i]![j - 1] ?? 0)) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return pairs.reverse();
}

/**
 * Number of cells two lines share, matched by their cross index.
 *
 * Sharing is positional, not by value: a row where three amounts out of five
 * were retyped still shares all five cells, and must be paired as "modified"
 * rather than split into a deletion and an insertion (B.7 step 2).
 */
export function sharedCellCount(
  a: CellRecord[],
  b: CellRecord[],
  key: (ref: string) => string,
): number {
  const keysA = new Set<string>();
  for (const cell of a) keysA.add(key(cell.ref));
  let count = 0;
  for (const cell of b) {
    if (keysA.has(key(cell.ref))) count += 1;
  }
  return count;
}

/**
 * Generic line alignment: unchanged lines (identical signature), then, between
 * two anchors, lines paired as "modified" when they share at least half of
 * their cells (B.7 step 2). Exported for reuse by `@suture/merge`.
 */
export function alignLines(
  oldLines: CellRecord[][],
  newLines: CellRecord[][],
  signature: (cells: CellRecord[]) => string,
  key: (ref: string) => string,
): AlignmentEntry[] {
  const anchors = lcsPairs(oldLines.map(signature), newLines.map(signature));
  const entries: AlignmentEntry[] = [];
  let oldCursor = 0;
  let newCursor = 0;
  for (const [oldAnchor, newAnchor] of anchors) {
    matchGap(oldLines, newLines, oldCursor, oldAnchor, newCursor, newAnchor, key, entries);
    entries.push({ type: "same", oldIndex: oldAnchor, newIndex: newAnchor });
    oldCursor = oldAnchor + 1;
    newCursor = newAnchor + 1;
  }
  matchGap(
    oldLines,
    newLines,
    oldCursor,
    oldLines.length,
    newCursor,
    newLines.length,
    key,
    entries,
  );
  return entries;
}

function matchGap(
  oldLines: CellRecord[][],
  newLines: CellRecord[][],
  oldFrom: number,
  oldTo: number,
  newFrom: number,
  newTo: number,
  key: (ref: string) => string,
  entries: AlignmentEntry[],
): void {
  let oi = oldFrom;
  let ni = newFrom;
  while (oi < oldTo && ni < newTo) {
    const oldCells = oldLines[oi] ?? [];
    const newCells = newLines[ni] ?? [];
    const shared = sharedCellCount(oldCells, newCells, key);
    const widest = Math.max(oldCells.length, newCells.length);
    if (widest > 0 && shared >= Math.ceil(widest / 2)) {
      entries.push({ type: "modified", oldIndex: oi, newIndex: ni, sharedCells: shared });
      oi += 1;
      ni += 1;
    } else {
      entries.push({ type: "deleted", oldIndex: oi });
      oi += 1;
    }
  }
  while (oi < oldTo) {
    entries.push({ type: "deleted", oldIndex: oi });
    oi += 1;
  }
  while (ni < newTo) {
    entries.push({ type: "inserted", newIndex: ni });
    ni += 1;
  }
}

/** Aligns rows of a sheet. */
export function alignRows(oldRows: CellRecord[][], newRows: CellRecord[][]): AlignmentEntry[] {
  return alignLines(oldRows, newRows, rowSignature, columnOf);
}

/** Aligns columns of a sheet (priority S, B.7 step 3). */
export function alignCols(oldCols: CellRecord[][], newCols: CellRecord[][]): AlignmentEntry[] {
  return alignLines(oldCols, newCols, colSignature, (ref) => String(rowNumberOf(ref)));
}
