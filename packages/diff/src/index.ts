/**
 * @suture/diff — row/column alignment and typed ChangeSet computation.
 * Implements the compare algorithm of section B.7 and the spec
 * `.kiro/specs/diff-engine`. The ChangeSet is the single input of the compare
 * view, of the summary and of the combine engine.
 */
export { compare, diffSheet, matchSheets, summarize } from "./compare";
export { alignCols, alignLines, alignRows, lcsPairs, sharedCellCount } from "./align";
export { classifyCell, compareAlignedCells, hasStructuralChange } from "./classify";
export { groupCols, groupRows, type LineBucket } from "./group";
export { compareParts, partLabel, type PartsByPath } from "./parts";
export {
  colSignature,
  columnNumberOf,
  columnOf,
  fnv1a64,
  lineSignature,
  rowNumberOf,
  rowSignature,
} from "./signature";

export const packageName = "@suture/diff";
