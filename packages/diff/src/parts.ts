import type { ColumnChange, NonCellPartChange, RowChange } from "@suture/contracts";
import type { AlignmentEntry } from "@suture/contracts";
import type { LineBucket } from "./group";

/** Row insertions and deletions, with the cells they carry. */
export function collectRows(
  sheetId: number,
  alignment: AlignmentEntry[],
  oldBuckets: LineBucket[],
  newBuckets: LineBucket[],
): RowChange[] {
  const changes: RowChange[] = [];
  for (const entry of alignment) {
    if (entry.type === "inserted" && entry.newIndex !== undefined) {
      const bucket = newBuckets[entry.newIndex];
      if (bucket !== undefined) {
        changes.push({
          sheetId,
          type: "inserted",
          rowIndex: bucket.index - 1,
          cells: bucket.cells,
        });
      }
    }
    if (entry.type === "deleted" && entry.oldIndex !== undefined) {
      const bucket = oldBuckets[entry.oldIndex];
      if (bucket !== undefined) {
        changes.push({
          sheetId,
          type: "deleted",
          rowIndex: bucket.index - 1,
          cells: bucket.cells,
        });
      }
    }
  }
  return changes;
}

/** Column insertions and deletions. */
export function collectCols(
  sheetId: number,
  alignment: AlignmentEntry[],
  oldBuckets: LineBucket[],
  newBuckets: LineBucket[],
): ColumnChange[] {
  const changes: ColumnChange[] = [];
  for (const entry of alignment) {
    if (entry.type === "inserted" && entry.newIndex !== undefined) {
      const bucket = newBuckets[entry.newIndex];
      if (bucket !== undefined) {
        changes.push({ sheetId, type: "inserted", colIndex: bucket.index - 1 });
      }
    }
    if (entry.type === "deleted" && entry.oldIndex !== undefined) {
      const bucket = oldBuckets[entry.oldIndex];
      if (bucket !== undefined) {
        changes.push({ sheetId, type: "deleted", colIndex: bucket.index - 1 });
      }
    }
  }
  return changes;
}

/** Parts that carry no cell: charts, macros, styles, pivot tables, media. */
const NON_CELL_PATTERNS = [
  /^xl\/charts\//,
  /^xl\/drawings\//,
  /^xl\/pivotTables\//,
  /^xl\/pivotCache\//,
  /^xl\/media\//,
  /^xl\/embeddings\//,
  /^xl\/vbaProject\.bin$/,
  /^xl\/tables\//,
  /^xl\/comments/,
  /^xl\/externalLinks\//,
];

export interface PartsByPath {
  [path: string]: Uint8Array;
}

/** Human label for a non-cell part ("Chart 2", "Macros"...). */
export function partLabel(path: string): string {
  if (path.endsWith("vbaProject.bin")) return "Macros (VBA project)";
  const chart = /chart(\d+)\.xml$/.exec(path);
  if (chart !== null && chart[1] !== undefined) return `Chart ${chart[1]}`;
  if (path.includes("pivotTable")) return "Pivot table";
  if (path.includes("pivotCache")) return "Pivot cache";
  if (path.includes("drawings/")) return "Drawing";
  if (path.includes("media/")) return "Image";
  if (path.includes("tables/")) return "Table";
  if (path.includes("comments")) return "Comment";
  if (path.includes("externalLinks")) return "External link";
  return path;
}

/** Compares non-cell parts by fingerprint only, without any detail. */
export function compareParts(
  oldParts: PartsByPath,
  newParts: PartsByPath,
  fingerprint: (data: Uint8Array) => string,
): NonCellPartChange[] {
  const changes: NonCellPartChange[] = [];
  const paths = new Set<string>([...Object.keys(oldParts), ...Object.keys(newParts)]);
  for (const path of [...paths].sort()) {
    if (!NON_CELL_PATTERNS.some((pattern) => pattern.test(path))) continue;
    const before = oldParts[path];
    const after = newParts[path];
    const label = partLabel(path);
    if (before === undefined && after !== undefined) {
      changes.push({ type: "added", path, label });
    } else if (before !== undefined && after === undefined) {
      changes.push({ type: "removed", path, label });
    } else if (before !== undefined && after !== undefined) {
      if (fingerprint(before) !== fingerprint(after)) {
        changes.push({ type: "modified", path, label });
      }
    }
  }
  return changes;
}
