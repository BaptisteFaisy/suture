/**
 * @suture/ooxml-io - OOXML archive I/O.
 *
 * Public API:
 * - `readWorkbook(bytes, limits?)` — decompress and validate a workbook archive;
 * - `zipParts(parts)` — recompress parts into a deterministic ZIP archive;
 * - helpers: `listParts`, `isMacroEnabled`, `sortParts`, `describeRefusal`.
 *
 * The bytes of every part are carried unchanged: this package never rebuilds a
 * workbook, it only reads and writes the OPC container.
 */
export { DEFAULT_UNZIP_LIMITS } from "@suture/contracts";
export type {
  FileErrorCode,
  OoxmlPart,
  OoxmlParts,
  ReadWorkbookResult,
  UnzipLimits,
} from "@suture/contracts";

export { readWorkbook } from "./unzip";
export { zipParts } from "./zip";
export {
  isMacroEnabled,
  listParts,
  normalizePartPath,
  sortParts,
  CONTENT_TYPES_PART_PATH,
  MACRO_PART_PATH,
  WORKBOOK_PART_PATH,
} from "./parts";
export { describeRefusal, isFileError } from "./errors";
export { resolveLimits } from "./guards";
