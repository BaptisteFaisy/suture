/**
 * Fast lookup of the cells of a sheet.
 */
import type { CellMap, CellRecord } from "@suture/contracts";

/** Indexes cells by their A1 address (later duplicates win, they are sorted). */
export function toCellMap(cells: readonly CellRecord[]): CellMap {
  const map: CellMap = new Map();
  for (const cell of cells) {
    map.set(cell.ref, cell);
  }
  return map;
}
