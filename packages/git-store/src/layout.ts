/**
 * Layout of a version inside the Git tree (B.6):
 *
 *   ooxml/                 the parts of the .xlsx, byte-for-byte
 *   cells/_workbook.json   sheets metadata and defined names
 *   cells/NN-<name>.tsv    one line per non-empty cell
 *   .suture/format.json    canonical format version
 *   .suture/workbook.json  the tracked workbook's own metadata
 */
import { CANONICAL_FORMAT_VERSION } from "@suture/contracts";

export const OOXML_DIR = "ooxml";
export const CELLS_DIR = "cells";
export const SUTURE_DIR = ".suture";
export const FORMAT_PATH = `${SUTURE_DIR}/format.json`;
export const WORKBOOK_JSON = `${CELLS_DIR}/_workbook.json`;
export const WORKBOOK_META = `${SUTURE_DIR}/workbook.json`;

/** Reference scenario: the branch every tracked workbook starts on. */
export const REFERENCE = "reference";

/** Path of one OOXML part inside the tree. */
export function partPath(part: string): string {
  return `${OOXML_DIR}/${part}`;
}

/** True for a path that holds an OOXML part. */
export function isPartPath(path: string): boolean {
  return path.startsWith(`${OOXML_DIR}/`);
}

/** Part name of a tree path ("ooxml/xl/workbook.xml" -> "xl/workbook.xml"). */
export function partName(path: string): string {
  return path.slice(OOXML_DIR.length + 1);
}

/** True for a path that holds a sheet's cell view. */
export function isCellsPath(path: string): boolean {
  return path.startsWith(`${CELLS_DIR}/`) && path.endsWith(".tsv");
}

/**
 * File name of a sheet's cell view: "cells/01-Budget.tsv". The order prefix
 * keeps `git log -p` readable and the name is sanitised for the file system.
 */
export function sheetFileName(order: number, name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  const prefix = String(order + 1).padStart(2, "0");
  return `${CELLS_DIR}/${prefix}-${safe.length > 0 ? safe : "sheet"}.tsv`;
}

/** Content of `.suture/format.json`. */
export function formatJson(): string {
  return `${JSON.stringify({ version: CANONICAL_FORMAT_VERSION }, null, 2)}\n`;
}
