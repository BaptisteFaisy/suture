/**
 * Reading an OOXML archive: decompress, guard, sort.
 *
 * The bytes of every part are returned untouched — fidelity is the whole
 * point of this boundary (property SUT-P-01).
 */
import { unzipSync } from "fflate";
import type { OoxmlParts, ReadWorkbookResult, UnzipLimits } from "@suture/contracts";
import { isFileError, refuse } from "./errors";
import {
  assertEntryCount,
  assertEntryLimits,
  assertTotalSize,
  assertZipMagic,
  isBinaryWorksheetPart,
  isEncryptedPackagePart,
  resolveLimits,
} from "./guards";
import { isDirectoryEntry, normalizePartPath, sortParts, WORKBOOK_PART_PATH } from "./parts";

/** Guard state shared by the per-entry filter. */
interface GuardState {
  entryCount: number;
  declaredBytes: number;
}

/**
 * Run the per-entry guards while the archive is walked.
 * Throwing from the filter aborts the extraction immediately.
 */
function guardEntry(
  state: GuardState,
  name: string,
  originalSize: number,
  compressedSize: number,
  limits: UnzipLimits,
): void {
  state.entryCount += 1;
  assertEntryCount(state.entryCount, limits);
  const path = normalizePartPath(name);
  assertEntryLimits(path, originalSize, compressedSize, limits);
  state.declaredBytes += originalSize;
  assertTotalSize(state.declaredBytes, limits);
}

/** Turn the extracted entries into sorted, de-duplicated parts. */
function toParts(files: Record<string, Uint8Array>): OoxmlParts {
  const parts: OoxmlParts = [];
  const seen = new Set<string>();
  for (const [name, data] of Object.entries(files)) {
    const path = normalizePartPath(name);
    if (path === "" || seen.has(path)) continue;
    seen.add(path);
    parts.push({ path, data });
  }
  return sortParts(parts);
}

/** Sum of the decompressed bytes actually produced. */
function totalBytes(parts: OoxmlParts): number {
  return parts.reduce((sum, part) => sum + part.data.byteLength, 0);
}

/**
 * Decompress every entry of the archive, applying the resource guards.
 *
 * This is the low-level reader: it knows nothing about spreadsheets and
 * returns whatever parts the archive holds.
 */
export function unzipParts(bytes: Uint8Array, limits?: Partial<UnzipLimits>): OoxmlParts {
  const resolved = resolveLimits(limits);
  assertZipMagic(bytes);
  const state: GuardState = { entryCount: 0, declaredBytes: 0 };
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        guardEntry(state, file.name, file.originalSize, file.size, resolved);
        return !isDirectoryEntry(file.name);
      },
    });
  } catch (error) {
    if (isFileError(error)) throw error;
    throw refuse(
      "corrupt",
      "This workbook could not be opened: the file is damaged or was cut short. Try saving it again from Excel.",
    );
  }
  const parts = toParts(files);
  assertTotalSize(totalBytes(parts), resolved);
  return parts;
}

/** Refuse archives that are not spreadsheet packages. */
function assertSupportedWorkbook(parts: OoxmlParts): void {
  const paths = new Set(parts.map((part) => part.path));
  for (const path of paths) {
    if (isEncryptedPackagePart(path)) {
      throw refuse(
        "encrypted",
        "This workbook is password-protected. Remove the password and save it again, then try.",
      );
    }
    if (isBinaryWorksheetPart(path)) {
      throw refuse(
        "unsupported-format",
        "This file uses the binary workbook format (.xlsb). Suture reads .xlsx and .xlsm files only.",
      );
    }
  }
  if (!paths.has(WORKBOOK_PART_PATH)) {
    throw refuse(
      "unsupported-format",
      "This archive is not an Excel workbook: it has no workbook part. Suture reads .xlsx and .xlsm files only.",
    );
  }
}

/**
 * Read an OOXML workbook archive.
 *
 * @param bytes Raw bytes of the `.xlsx` / `.xlsm` file.
 * @param limits Optional resource limits (contest defaults otherwise).
 * @returns The parts, sorted by path, and whether macros are present.
 * @throws {SutureFileError} with a typed code when the file is refused.
 */
export function readWorkbook(
  bytes: Uint8Array,
  limits?: Partial<UnzipLimits>,
): ReadWorkbookResult {
  const parts = unzipParts(bytes, limits);
  assertSupportedWorkbook(parts);
  return {
    parts,
    macroEnabled: parts.some((part) => part.path === "xl/vbaProject.bin"),
  };
}
