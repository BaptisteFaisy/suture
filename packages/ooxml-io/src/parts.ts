/**
 * Part helpers — path normalisation, deterministic ordering and the well-known
 * OOXML part paths used across Suture.
 *
 * See `.kiro/steering/ooxml.md` for the part-level knowledge base.
 */
import type { OoxmlParts } from "@suture/contracts";

/** Every OOXML package carries this part: the workbook definition. */
export const WORKBOOK_PART_PATH = "xl/workbook.xml";

/** Part holding the VBA project of a macro-enabled workbook (`.xlsm`). */
export const MACRO_PART_PATH = "xl/vbaProject.bin";

/** Content types manifest of an OPC package. */
export const CONTENT_TYPES_PART_PATH = "[Content_Types].xml";

/**
 * Normalise an archive entry name into an archive-relative POSIX path:
 * backslashes become slashes, a leading `./` or `/` is dropped.
 */
export function normalizePartPath(name: string): string {
  const slashed = name.replace(/\\/g, "/");
  return slashed.replace(/^\.\//, "").replace(/^\/+/, "");
}

/** True when the entry describes a directory rather than a part. */
export function isDirectoryEntry(name: string): boolean {
  return name.endsWith("/");
}

/** Sort parts by path (ascending UTF-16 code units) — deterministic order. */
export function sortParts(parts: OoxmlParts): OoxmlParts {
  return [...parts].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Sorted list of the part paths of an archive. */
export function listParts(parts: OoxmlParts): string[] {
  return sortParts(parts).map((part) => part.path);
}

/**
 * True when the archive carries a VBA project. Macros are never executed nor
 * interpreted: the part is carried as an opaque blob.
 */
export function isMacroEnabled(parts: OoxmlParts): boolean {
  return parts.some((part) => part.path === MACRO_PART_PATH);
}
