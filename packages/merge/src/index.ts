/**
 * @suture/merge — three-way combine engine.
 *
 * Implements the combine algorithm of section B.8, the contract in
 * `@suture/contracts` and the `no-silent-loss` invariant.
 */
export { mergeEngine, planMerge, resolveMerge } from "./plan";
export { applyChoice, cellText, disagreementId, resolveCell } from "./cells";
export {
  chooseCarrier,
  sameStructuralChanges,
  sheetById,
  structuralCase,
  structures,
  type SheetStructure,
  type StructuralCase,
} from "./carrier";

export const packageName = "@suture/merge";
