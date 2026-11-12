/**
 * ZIP guards — magic bytes, resource limits and archive shape.
 *
 * Every refusal is a `SutureFileError` whose message is written for the end
 * user (English, plain language).
 */
import { DEFAULT_UNZIP_LIMITS } from "@suture/contracts";
import type { UnzipLimits } from "@suture/contracts";
import { refuse } from "./errors";

/** Local file header signature: the usual start of a ZIP archive. */
const ZIP_LOCAL_HEADER = [0x50, 0x4b, 0x03, 0x04];
/** End-of-central-directory signature: an empty ZIP archive. */
const ZIP_EMPTY_ARCHIVE = [0x50, 0x4b, 0x05, 0x06];
/** OLE2 / Compound File Binary signature (legacy `.xls`, encrypted workbooks). */
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

/**
 * Smallest decompressed size for which the compression ratio is inspected.
 *
 * Below one megabyte, the ratio says more about the deflate overhead than
 * about the payload, so a legitimate part would be refused for no reason.
 * See `.kiro/specs/ooxml-io/requirements.md` (SUT-N-04).
 */
export const RATIO_CHECK_MIN_BYTES = 1024 * 1024;

/** Merge caller-provided limits with the contest defaults. */
export function resolveLimits(limits?: Partial<UnzipLimits>): UnzipLimits {
  return { ...DEFAULT_UNZIP_LIMITS, ...limits };
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Check the leading bytes of the archive.
 *
 * - OLE2 container (legacy `.xls`, password-protected workbook) -> `encrypted`
 * - anything that is not a ZIP -> `not-a-zip`
 */
export function assertZipMagic(bytes: Uint8Array): void {
  if (startsWith(bytes, OLE2_MAGIC)) {
    throw refuse(
      "encrypted",
      "This workbook is password-protected or uses the legacy Excel format. Remove the password and save it as .xlsx, then try again.",
    );
  }
  if (startsWith(bytes, ZIP_LOCAL_HEADER) || startsWith(bytes, ZIP_EMPTY_ARCHIVE)) {
    return;
  }
  throw refuse(
    "not-a-zip",
    "This file is not an Excel workbook. Suture reads .xlsx and .xlsm files only.",
  );
}

/** True when the archive carries an encrypted-OOXML marker part. */
export function isEncryptedPackagePart(path: string): boolean {
  return path === "EncryptionInfo" || path === "EncryptedPackage";
}

/** True when the archive holds a binary worksheet (`.xlsb`), which is not supported. */
export function isBinaryWorksheetPart(path: string): boolean {
  return /^xl\/worksheets\/sheet\d+\.bin$/.test(path);
}

/**
 * True when the compression ratio of an entry is meaningful.
 *
 * The ratio is only inspected for entries of at least one kilobyte: below
 * that size the compressed and decompressed sizes are too close for the
 * ratio to say anything about the payload.
 */
export function isRatioCheckable(originalSize: number, compressedSize: number): boolean {
  return compressedSize > 0 && originalSize >= RATIO_CHECK_MIN_BYTES;
}

/**
 * Check the declared size of one entry against the resource limits.
 *
 * @param originalSize Decompressed size announced by the archive.
 * @param compressedSize Compressed size announced by the archive.
 */
export function assertEntryLimits(
  path: string,
  originalSize: number,
  compressedSize: number,
  limits: UnzipLimits,
): void {
  if (originalSize > limits.maxDecompressedBytes) {
    throw refuse(
      "too-large",
      `This workbook is too large to open: the part "${path}" alone needs ${originalSize} bytes.`,
    );
  }
  if (!isRatioCheckable(originalSize, compressedSize)) return;
  if (originalSize / compressedSize > limits.maxCompressionRatio) {
    throw refuse(
      "zip-bomb",
      `This workbook was refused: the part "${path}" expands far beyond its stored size, which is a sign of a damaged or hostile file.`,
    );
  }
}

/** Check the accumulated decompressed size against the limits. */
export function assertTotalSize(totalBytes: number, limits: UnzipLimits): void {
  if (totalBytes > limits.maxDecompressedBytes) {
    throw refuse(
      "too-large",
      `This workbook is too large to open: it expands to ${totalBytes} bytes, above the ${limits.maxDecompressedBytes} byte limit.`,
    );
  }
}

/** Check the number of entries against the limits. */
export function assertEntryCount(entryCount: number, limits: UnzipLimits): void {
  if (entryCount > limits.maxEntries) {
    throw refuse(
      "too-many-entries",
      `This workbook was refused: it holds more than ${limits.maxEntries} internal files, which is not a normal spreadsheet.`,
    );
  }
}
