/**
 * @suture/canonical - deterministic derivation of the `cells/` view.
 *
 * Public API:
 * - `deriveCanonical(parts)` — the canonical workbook of an OOXML archive;
 * - `serializeCellsTsv(sheet)` / `parseCellsTsv(text)` — the `cells/*.tsv` format;
 * - `serializeWorkbookJson(meta)` — the `cells/_workbook.json` content;
 * - helpers: addresses, number formats, escaping, origin marker, cell map.
 */
export { deriveCanonical, normalizeParts } from "./derive";
export type { DeriveOptions } from "./derive";
export {
  escapeTsvValue,
  isValidRef,
  parseCellsTsv,
  serializeCellsTsv,
  unescapeTsvValue,
} from "./tsv";
export { buildWorkbookJson, serializeWorkbookJson } from "./workbook-json";
export type { WorkbookJson, WorkbookJsonSheet } from "./workbook-json";
export {
  EXCEL_MAX_COL,
  EXCEL_MAX_ROW,
  cellRefSortKey,
  columnIndexOf,
  columnLetters,
  formatCellRef,
  isValidColumn,
  parseCellRef,
} from "./refs";
export { toCellMap } from "./cell-map";
export type { CellPosition } from "./refs";
export {
  BUILTIN_NUMBER_FORMATS,
  GENERAL_FORMAT,
  canonicalFormat,
  formatOfStyle,
  parseStyles,
  resolveFormatCode,
} from "./styles";
export type { StyleFormats } from "./styles";
export { parseSharedStrings } from "./shared-strings";
export type { SharedStrings } from "./shared-strings";
export { formatNumber, parseWorksheet } from "./worksheet";
export type { WorksheetContext } from "./worksheet";
export { parseRelationships, parseWorkbookMeta, resolveTarget } from "./workbook-meta";
export type { WorkbookParts } from "./workbook-meta";
export {
  CUSTOM_PROPERTIES_PART_PATH,
  isSutureProperty,
  parseCustomProperties,
  readOriginMarker,
  stripSutureProperties,
} from "./origin-marker";
export type { CustomProperty, OriginMarker } from "./origin-marker";
export { fallbackCodec, resolveFormulaCodec } from "./formula-codec";
export type { ConversionResult, FormulaCodec } from "./formula-codec";
export { CANONICAL_FORMAT_VERSION } from "@suture/contracts";
export type {
  CanonicalSheet,
  CanonicalWorkbook,
  CellKind,
  CellMap,
  CellRecord,
  DefinedName,
  SheetMeta,
  SheetState,
  WorkbookMeta,
} from "@suture/contracts";
