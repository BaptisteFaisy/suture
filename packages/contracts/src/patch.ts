/**
 * Carrier patching contract — edits written into the workbook XML without
 * ever rebuilding the file. See spec `.kiro/specs/ooxml-patch`.
 */
import type { CellPatch } from "./merge";
import type { OoxmlParts } from "./ooxml";

/** Origin marker stored in docProps/custom.xml (SUT-F-06). */
export interface OriginMarker {
  /** Version id the working copy started from. */
  versionId: string;
  /** Scenario name, when known. */
  scenario?: string;
}

/** Everything the patcher needs to edit a carrier archive. */
export interface PatchRequest {
  /** Cell edits (already resolved), possibly across several sheets. */
  patches: CellPatch[];
  /** sheetId → worksheet part path in the carrier. */
  sheetPaths: Map<number, string>;
  /** Optional origin marker to write into docProps/custom.xml. */
  originMarker?: OriginMarker;
}

/** Result of a patch run. */
export interface PatchResult {
  parts: OoxmlParts;
  /** Part paths that were modified (worksheets only). */
  touchedSheets: string[];
  /** True when xl/calcChain.xml was removed (SUT-F-22). */
  calcChainRemoved: boolean;
}
