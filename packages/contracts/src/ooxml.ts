/**
 * OOXML archive model — parts of a `.xlsx`/`.xlsm` workbook.
 * See `.kiro/steering/ooxml.md` for the part-level knowledge base.
 */

/** One file of the OPC archive. */
export interface OoxmlPart {
  /** Archive-relative path, e.g. "xl/worksheets/sheet1.xml". */
  path: string;
  /** Raw bytes of the part, unchanged. */
  data: Uint8Array;
}

/** All parts of a workbook, deterministically sorted by path (ascending). */
export type OoxmlParts = OoxmlPart[];

/** Hard limits applied before and while reading an archive. */
export interface UnzipLimits {
  /** Total decompressed size limit, in bytes (zip-bomb guard). */
  maxDecompressedBytes: number;
  /** Maximum number of entries in the archive. */
  maxEntries: number;
  /** Maximum compression ratio per entry (decompressed / compressed). */
  maxCompressionRatio: number;
  /** Maximum number of non-empty cells in the workbook. */
  maxCells: number;
}

/** Contest-grade defaults: 50 MB decompressed, 1,000,000 cells. */
export const DEFAULT_UNZIP_LIMITS: UnzipLimits = {
  maxDecompressedBytes: 50_000_000,
  maxEntries: 20_000,
  maxCompressionRatio: 200,
  maxCells: 1_000_000,
};

/** Machine-readable reason a workbook was refused. */
export type FileErrorCode =
  | "not-a-zip"
  | "encrypted"
  | "unsupported-format"
  | "corrupt"
  | "too-large"
  | "too-many-entries"
  | "zip-bomb"
  | "too-many-cells"
  | "missing-workbook";

/** Typed refusal raised when a file cannot be tracked (SUT-F-04). */
export class SutureFileError extends Error {
  constructor(
    readonly code: FileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SutureFileError";
  }
}

/** Result of reading a workbook archive. */
export interface ReadWorkbookResult {
  parts: OoxmlParts;
  /** True when the archive carries a VBA project (`.xlsm`). */
  macroEnabled: boolean;
}
