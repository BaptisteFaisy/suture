/**
 * @suture/merge — three-way combine engine.
 *
 * Implements the combine algorithm of section B.8, the contract in
 * `@suture/contracts` and the `no-silent-loss` invariant.
 */
export { mergeEngine, planMerge, resolveMerge, nameOf } from "./plan";
export { applyChoice, cellText, disagreementId } from "./cells";
export {
  chooseCarrier,
  sameStructuralChanges,
  sheetById,
  structuralCase,
  structures,
  type SheetStructure,
  type StructuralCase,
} from "./carrier";
export { buildCoordinateMap, identityMap, type CoordinateMap } from "./coordinates";
export { combineSheet, describeChange, otherSide, type CellIndex } from "./sheet-plan";

export const packageName = "@suture/merge";
