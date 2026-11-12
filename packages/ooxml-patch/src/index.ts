/**
 * @suture/ooxml-patch — carrier patching.
 *
 * The patcher never rebuilds a workbook: it rewrites the worksheet parts that
 * hold the patched cells, drops the calculation chain and asks Excel for a
 * full recalculation. Every other part travels byte-for-byte (SUT-P-10).
 */
import type { OoxmlParts, PatchRequest, PatchResult } from "@suture/contracts";
import { removeCalcChain } from "./calc-chain";
import { stampMarker } from "./custom-props";
import { PatchError } from "./errors";
import { findPart, partToText, sortParts, textToPart, withPart } from "./parts";
import { writeSheet, type SheetWrite } from "./sheet-writer";

export { PatchError, type PatchErrorCode } from "./errors";
export { readOriginMarker, stampOriginMarker } from "./origin-marker";
export { readSheetCells, type SheetCell } from "./sheet-reader";
export type { SheetWrite } from "./sheet-writer";

/** Applies the requested cell edits to a carrier workbook. */
export function patchWorkbook(parts: OoxmlParts, request: PatchRequest): PatchResult {
  const writes = groupBySheet(request);
  let result = parts;
  const touchedSheets: string[] = [];
  for (const [sheetId, sheetWrites] of writes) {
    const path = resolveSheetPath(request, sheetId, result);
    const part = findPart(result, path);
    if (!part) {
      throw new PatchError("sheet-part-missing", `Worksheet part not found: ${path}`);
    }
    const xml = writeSheet(partToText(part), sheetWrites);
    result = withPart(result, path, textToPart(path, xml).data);
    touchedSheets.push(path);
  }
  let calcChainRemoved = false;
  if (writes.size > 0) {
    const removal = removeCalcChain(result);
    result = removal.parts;
    calcChainRemoved = removal.removed;
  }
  if (request.originMarker) {
    result = stampMarker(result, request.originMarker);
  }
  return { parts: sortParts(result), touchedSheets, calcChainRemoved };
}

function groupBySheet(request: PatchRequest): Map<number, SheetWrite[]> {
  const bySheet = new Map<number, SheetWrite[]>();
  const seen = new Set<string>();
  for (const patch of request.patches) {
    const key = `${patch.sheetId}:${patch.ref}`;
    if (seen.has(key)) {
      throw new PatchError("duplicate-cell-patch", `Two patches for the same cell ${patch.ref}.`);
    }
    seen.add(key);
    const writes = bySheet.get(patch.sheetId) ?? [];
    writes.push({ ref: patch.ref, record: patch.record });
    bySheet.set(patch.sheetId, writes);
  }
  return bySheet;
}

function resolveSheetPath(request: PatchRequest, sheetId: number, parts: OoxmlParts): string {
  const path = request.sheetPaths.get(sheetId);
  if (!path) {
    throw new PatchError("sheet-id-unknown", `Unknown sheet id ${sheetId} in the patch request.`);
  }
  if (!findPart(parts, path)) {
    throw new PatchError("sheet-part-missing", `Worksheet part not found: ${path}`);
  }
  return path;
}
