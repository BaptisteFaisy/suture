/**
 * Coordinate mapping between the other side and the carrier (B.8, case 2).
 *
 * The other side's changes are expressed in ITS coordinates; the carrier is
 * the kept file. Both are related to the origin, so the mapping is composed:
 *
 *   other reference  →  origin reference  →  carrier reference
 *
 * The alignment itself is `@suture/diff`'s (LCS and pairing): this module only
 * turns alignments into reference-to-reference maps, so no LCS is duplicated.
 */
import type { CanonicalSheet } from "@suture/contracts";
import { alignCols, alignRows, columnNumberOf, groupCols, groupRows, rowNumberOf } from "@suture/diff";
import { numberToColumn } from "@suture/formula";

/** Maps a reference from one side to another. */
export interface CoordinateMap {
  /** Target reference, or null when the row or column disappeared. */
  mapRef(ref: string): string | null;
  /** True when rows or columns moved, i.e. mapping was necessary. */
  structural: boolean;
}

/** Line-number map built from an alignment of two grouped line lists. */
function lineMap(
  fromBuckets: { index: number }[],
  toBuckets: { index: number }[],
  alignment: { type: string; oldIndex?: number; newIndex?: number }[],
): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const bucket of fromBuckets) map.set(bucket.index, null);
  for (const entry of alignment) {
    if (entry.oldIndex === undefined || entry.newIndex === undefined) continue;
    const from = fromBuckets[entry.oldIndex];
    const to = toBuckets[entry.newIndex];
    if (from !== undefined && to !== undefined) map.set(from.index, to.index);
  }
  return map;
}

/** Composes two line maps: from → origin → to. */
function compose(
  first: Map<number, number | null>,
  second: Map<number, number | null>,
): Map<number, number | null> {
  const composed = new Map<number, number | null>();
  for (const [from, middle] of first) {
    if (middle === null) {
      composed.set(from, null);
      continue;
    }
    composed.set(from, second.get(middle) ?? null);
  }
  return composed;
}

/** The identity map, used when nothing moved. */
export function identityMap(): CoordinateMap {
  return { mapRef: (ref) => ref, structural: false };
}

/**
 * Builds the map from the other side's coordinates to the carrier's.
 * A row or column that the carrier does not have maps to null: the change it
 * carried cannot be applied and must go to the report instead of vanishing.
 */
export function buildCoordinateMap(
  originSheet: CanonicalSheet | undefined,
  otherSheet: CanonicalSheet | undefined,
  carrierSheet: CanonicalSheet | undefined,
): CoordinateMap {
  if (originSheet === undefined || otherSheet === undefined || carrierSheet === undefined) {
    return identityMap();
  }

  const otherRows = groupRows(otherSheet.cells);
  const originRows = groupRows(originSheet.cells);
  const carrierRows = groupRows(carrierSheet.cells);
  const otherToOrigin = alignRows(
    otherRows.map((bucket) => bucket.cells),
    originRows.map((bucket) => bucket.cells),
  );
  const originToCarrier = alignRows(
    originRows.map((bucket) => bucket.cells),
    carrierRows.map((bucket) => bucket.cells),
  );
  const rows = compose(
    lineMap(otherRows, originRows, otherToOrigin),
    lineMap(originRows, carrierRows, originToCarrier),
  );

  const otherCols = groupCols(otherSheet.cells);
  const originCols = groupCols(originSheet.cells);
  const carrierCols = groupCols(carrierSheet.cells);
  const otherToOriginCols = alignCols(
    otherCols.map((bucket) => bucket.cells),
    originCols.map((bucket) => bucket.cells),
  );
  const originToCarrierCols = alignCols(
    originCols.map((bucket) => bucket.cells),
    carrierCols.map((bucket) => bucket.cells),
  );
  const cols = compose(
    lineMap(otherCols, originCols, otherToOriginCols),
    lineMap(originCols, carrierCols, originToCarrierCols),
  );

  const structural =
    otherToOrigin.some((entry) => entry.type === "inserted" || entry.type === "deleted") ||
    originToCarrier.some((entry) => entry.type === "inserted" || entry.type === "deleted") ||
    otherToOriginCols.some((entry) => entry.type === "inserted" || entry.type === "deleted") ||
    originToCarrierCols.some((entry) => entry.type === "inserted" || entry.type === "deleted");

  return { structural, mapRef: (ref) => mapRef(ref, rows, cols) };
}

function mapRef(
  ref: string,
  rows: Map<number, number | null>,
  cols: Map<number, number | null>,
): string | null {
  const row = rowNumberOf(ref);
  const col = columnNumberOf(ref);
  const targetRow = rows.get(row);
  const targetCol = cols.get(col);
  if (targetRow === null || targetCol === null) return null;
  if (targetRow === undefined || targetCol === undefined) return ref;
  return `${numberToColumn(targetCol)}${targetRow}`;
}
