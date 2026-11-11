import type { CellRecord } from "@suture/contracts";
import { columnNumberOf, rowNumberOf } from "./signature";

/** A line of cells, with its 1-based index in the sheet. */
export interface LineBucket {
  index: number;
  cells: CellRecord[];
}

/** Groups cells into rows, sorted by row number. */
export function groupRows(cells: CellRecord[]): LineBucket[] {
  return groupBy(cells, (cell) => rowNumberOf(cell.ref));
}

/** Groups cells into columns, sorted by column number. */
export function groupCols(cells: CellRecord[]): LineBucket[] {
  return groupBy(cells, (cell) => columnNumberOf(cell.ref));
}

function groupBy(cells: CellRecord[], indexOf: (cell: CellRecord) => number): LineBucket[] {
  const buckets = new Map<number, CellRecord[]>();
  for (const cell of cells) {
    const key = indexOf(cell);
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [cell]);
    } else {
      bucket.push(cell);
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, value]) => ({ index, cells: value }));
}
